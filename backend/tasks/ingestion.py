import asyncio
import httpx
from datetime import datetime
from tasks.celery_app import celery_app
from db.database import AsyncSessionLocal
from models.data_model import ClimateReading, StockPrice

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
    {"name": "São Paulo",   "country": "Brazil",     "lat": -23.55, "lon": -46.63},
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


async def fetch_one_city(client: httpx.AsyncClient, city: dict) -> ClimateReading | None:
    """Fetch weather for a single city — runs in parallel with others."""
    try:
        url = (
            "https://api.open-meteo.com/v1/forecast"
            f"?latitude={city['lat']}"
            f"&longitude={city['lon']}"
            "&daily=temperature_2m_max,temperature_2m_min,"
            "temperature_2m_mean,relative_humidity_2m_mean"
            "&timezone=UTC"
            "&forecast_days=1"
        )
        resp = await client.get(url, timeout=10)
        if resp.status_code != 200:
            return None

        data      = resp.json()
        daily     = data.get("daily", {})
        temp_mean = daily.get("temperature_2m_mean",      [None])[0]
        temp_max  = daily.get("temperature_2m_max",       [None])[0]
        temp_min  = daily.get("temperature_2m_min",       [None])[0]
        humidity  = daily.get("relative_humidity_2m_mean",[None])[0]

        if temp_mean is None and temp_max and temp_min:
            temp_mean = round((temp_max + temp_min) / 2, 1)

        return ClimateReading(
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
        )
    except Exception as e:
        print(f"  Error fetching {city['name']}: {e}")
        return None


@celery_app.task(bind=True, max_retries=3)
def fetch_climate_data(self):
    try:
        asyncio.run(_fetch_climate())
    except Exception as exc:
        raise self.retry(exc=exc, countdown=300)


async def _fetch_climate():
    """Fetch all cities in parallel — much faster than one by one."""
    async with httpx.AsyncClient() as client:
        # fire all requests at the same time
        tasks    = [fetch_one_city(client, city) for city in CITIES]
        results  = await asyncio.gather(*tasks)

    # filter out failed requests
    readings = [r for r in results if r is not None]

    async with AsyncSessionLocal() as db:
        db.add_all(readings)
        await db.commit()

    print(f"Climate ingestion done — {len(readings)}/{len(CITIES)} cities")


async def fetch_one_stock(symbol: str) -> StockPrice | None:
    """Fetch latest price for one stock symbol."""
    try:
        import yfinance as yf
        ticker = yf.Ticker(symbol)
        hist   = ticker.history(period="2d", interval="1d")

        if hist.empty:
            return None

        latest = hist.iloc[-1]
        ts     = hist.index[-1].to_pydatetime()

        return StockPrice(
            symbol    = symbol,
            open      = round(float(latest["Open"]),  2),
            high      = round(float(latest["High"]),  2),
            low       = round(float(latest["Low"]),   2),
            close     = round(float(latest["Close"]), 2),
            volume    = int(latest["Volume"]),
            timestamp = ts,
        )
    except Exception as e:
        print(f"  Error fetching {symbol}: {e}")
        return None


@celery_app.task(bind=True, max_retries=3)
def fetch_stock_data(self):
    try:
        asyncio.run(_fetch_stocks())
    except Exception as exc:
        raise self.retry(exc=exc, countdown=300)


async def _fetch_stocks():
    """Fetch all stocks in parallel."""
    tasks   = [fetch_one_stock(symbol) for symbol in STOCKS]
    results = await asyncio.gather(*tasks)
    records = [r for r in results if r is not None]

    async with AsyncSessionLocal() as db:
        db.add_all(records)
        await db.commit()

    print(f"Stock ingestion done — {len(records)}/{len(STOCKS)} symbols")