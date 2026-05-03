import asyncio
import httpx
import logging
from datetime import datetime
from tasks.celery_app import celery_app
from db.database import AsyncSessionLocal
from models.data_model import ClimateReading, StockPrice

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

CITIES = [
    {"name": "London",      "country": "UK",        "lat": 51.51,  "lon": -0.13},
    {"name": "New York",    "country": "USA",        "lat": 40.71,  "lon": -74.01},
    {"name": "Tokyo",       "country": "Japan",      "lat": 35.68,  "lon": 139.69},
    {"name": "Karachi",     "country": "Pakistan",   "lat": 24.86,  "lon": 67.01},
    {"name": "Lagos",       "country": "Nigeria",    "lat": 6.52,   "lon": 3.38},
    {"name": "Sydney",      "country": "Australia",  "lat": -33.87, "lon": 151.21},
    {"name": "Paris",       "country": "France",     "lat": 48.85,  "lon": 2.35},
    {"name": "Dubai",       "country": "UAE",        "lat": 25.20,  "lon": 55.27},
    {"name": "Beijing",     "country": "China",      "lat": 39.91,  "lon": 116.39},
    {"name": "Moscow",      "country": "Russia",     "lat": 55.75,  "lon": 37.62},
    {"name": "Mumbai",      "country": "India",      "lat": 19.08,  "lon": 72.88},
    {"name": "Sao Paulo",   "country": "Brazil",     "lat": -23.55, "lon": -46.63},
    {"name": "Cairo",       "country": "Egypt",      "lat": 30.06,  "lon": 31.25},
    {"name": "Istanbul",    "country": "Turkey",     "lat": 41.01,  "lon": 28.95},
    {"name": "Berlin",      "country": "Germany",    "lat": 52.52,  "lon": 13.40},
    {"name": "Toronto",     "country": "Canada",     "lat": 43.65,  "lon": -79.38},
    {"name": "Singapore",   "country": "Singapore",  "lat": 1.35,   "lon": 103.82},
    {"name": "Nairobi",     "country": "Kenya",      "lat": -1.29,  "lon": 36.82},
    {"name": "Mexico City", "country": "Mexico",     "lat": 19.43,  "lon": -99.13},
    {"name": "Lahore",      "country": "Pakistan",   "lat": 31.55,  "lon": 74.34},
]

STOCKS = [
    "AAPL", "GOOGL", "MSFT", "AMZN",
    "TSLA", "NVDA",  "META", "NFLX",
    "AMD",  "BABA",
]


@celery_app.task(bind=True, max_retries=3)
def fetch_climate_data(self):
    try:
        asyncio.run(_fetch_climate())
    except Exception as exc:
        raise self.retry(exc=exc, countdown=300)


async def _fetch_climate():
    """
    Fetch all 20 cities in ONE request using Open-Meteo bulk API.
    This avoids rate limiting completely.
    """
    logger.info("=== Climate fetch started ===")
    try:
        # build comma-separated lat/lon lists for bulk request
        lats = ",".join(str(c["lat"]) for c in CITIES)
        lons = ",".join(str(c["lon"]) for c in CITIES)

        url = (
            "https://api.open-meteo.com/v1/forecast"
            f"?latitude={lats}"
            f"&longitude={lons}"
            "&daily=temperature_2m_max,temperature_2m_min,"
            "temperature_2m_mean,relative_humidity_2m_mean"
            "&timezone=UTC"
            "&forecast_days=1"
        )

        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(url)

        if resp.status_code == 429:
            logger.error("Rate limited by Open-Meteo — will retry next hour")
            return

        if resp.status_code != 200:
            logger.error(f"Open-Meteo error: HTTP {resp.status_code}")
            return

        # bulk response is a list when multiple locations requested
        data = resp.json()

        # if single city returns dict, wrap in list
        if isinstance(data, dict):
            data = [data]

        readings = []
        for i, city_data in enumerate(data):
            if i >= len(CITIES):
                break

            city  = CITIES[i]
            daily = city_data.get("daily", {})

            temp_mean = daily.get("temperature_2m_mean",       [None])[0]
            temp_max  = daily.get("temperature_2m_max",        [None])[0]
            temp_min  = daily.get("temperature_2m_min",        [None])[0]
            humidity  = daily.get("relative_humidity_2m_mean", [None])[0]

            if temp_mean is None and temp_max and temp_min:
                temp_mean = round((temp_max + temp_min) / 2, 1)

            logger.info(f"  {city['name']}: {temp_mean}°C  {humidity}% humidity")

            readings.append(ClimateReading(
                station   = city["name"],
                country   = city["country"],
                latitude  = city["lat"],
                longitude = city["lon"],
                temp_c    = temp_mean,
                humidity  = humidity,
                co2_ppm   = None,
                timestamp = datetime.utcnow().replace(
                    hour=0, minute=0, second=0, microsecond=0
                ),
            ))

        async with AsyncSessionLocal() as db:
            db.add_all(readings)
            await db.commit()

        logger.info(f"=== Saved {len(readings)} climate readings ===")

    except Exception as e:
        logger.error(f"=== Climate fetch FAILED: {e} ===")
        raise


async def fetch_one_stock(symbol: str):
    try:
        import yfinance as yf
        ticker = yf.Ticker(symbol)
        hist   = ticker.history(period="2d", interval="1d")

        if hist.empty:
            logger.warning(f"  {symbol}: no data")
            return None

        latest = hist.iloc[-1]
        ts     = hist.index[-1].to_pydatetime()
        close  = round(float(latest["Close"]), 2)
        logger.info(f"  {symbol}: ${close}")

        return StockPrice(
            symbol    = symbol,
            open      = round(float(latest["Open"]),  2),
            high      = round(float(latest["High"]),  2),
            low       = round(float(latest["Low"]),   2),
            close     = close,
            volume    = int(latest["Volume"]),
            timestamp = ts,
        )
    except Exception as e:
        logger.error(f"  {symbol} error: {e}")
        return None


@celery_app.task(bind=True, max_retries=3)
def fetch_stock_data(self):
    try:
        asyncio.run(_fetch_stocks())
    except Exception as exc:
        raise self.retry(exc=exc, countdown=300)


async def _fetch_stocks():
    logger.info("=== Stock fetch started ===")
    try:
        tasks   = [fetch_one_stock(s) for s in STOCKS]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        records = [r for r in results if r is not None and not isinstance(r, Exception)]

        async with AsyncSessionLocal() as db:
            db.add_all(records)
            await db.commit()

        logger.info(f"=== Saved {len(records)} stock records ===")

    except Exception as e:
        logger.error(f"=== Stock fetch FAILED: {e} ===")
        raise