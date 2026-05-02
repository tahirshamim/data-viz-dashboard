import asyncio
import httpx
from datetime import datetime
from tasks.celery_app import celery_app
from db.database import AsyncSessionLocal
from models.data_model import ClimateReading, StockPrice

# 20 cities around the world — all free from Open-Meteo
CITIES = [
    {"name": "London",     "country": "UK",          "lat": 51.51,  "lon": -0.13},
    {"name": "New York",   "country": "USA",          "lat": 40.71,  "lon": -74.01},
    {"name": "Tokyo",      "country": "Japan",        "lat": 35.68,  "lon": 139.69},
    {"name": "Karachi",    "country": "Pakistan",     "lat": 24.86,  "lon": 67.01},
    {"name": "Lagos",      "country": "Nigeria",      "lat": 6.52,   "lon": 3.38},
    {"name": "Sydney",     "country": "Australia",    "lat": -33.87, "lon": 151.21},
    {"name": "Paris",      "country": "France",       "lat": 48.85,  "lon": 2.35},
    {"name": "Dubai",      "country": "UAE",          "lat": 25.20,  "lon": 55.27},
    {"name": "Beijing",    "country": "China",        "lat": 39.91,  "lon": 116.39},
    {"name": "Moscow",     "country": "Russia",       "lat": 55.75,  "lon": 37.62},
    {"name": "Mumbai",     "country": "India",        "lat": 19.08,  "lon": 72.88},
    {"name": "São Paulo",  "country": "Brazil",       "lat": -23.55, "lon": -46.63},
    {"name": "Cairo",      "country": "Egypt",        "lat": 30.06,  "lon": 31.25},
    {"name": "Istanbul",   "country": "Turkey",       "lat": 41.01,  "lon": 28.95},
    {"name": "Berlin",     "country": "Germany",      "lat": 52.52,  "lon": 13.40},
    {"name": "Toronto",    "country": "Canada",       "lat": 43.65,  "lon": -79.38},
    {"name": "Singapore",  "country": "Singapore",    "lat": 1.35,   "lon": 103.82},
    {"name": "Nairobi",    "country": "Kenya",        "lat": -1.29,  "lon": 36.82},
    {"name": "Mexico City","country": "Mexico",       "lat": 19.43,  "lon": -99.13},
    {"name": "Lahore",     "country": "Pakistan",     "lat": 31.55,  "lon": 74.34},
]


@celery_app.task(bind=True, max_retries=3)
def fetch_climate_data(self):
    """
    Fetch real climate data from Open-Meteo API.
    Free — no API key needed.
    Runs every hour via Celery beat.
    """
    try:
        asyncio.run(_fetch_climate())
    except Exception as exc:
        raise self.retry(exc=exc, countdown=60 * (2 ** self.request.retries))


async def _fetch_climate():
    async with httpx.AsyncClient(timeout=30) as client:
        async with AsyncSessionLocal() as db:
            inserted = 0
            for city in CITIES:
                try:
                    url = (
                        "https://api.open-meteo.com/v1/forecast"
                        f"?latitude={city['lat']}"
                        f"&longitude={city['lon']}"
                        "&current=temperature_2m,relative_humidity_2m,"
                        "apparent_temperature,wind_speed_10m,precipitation"
                        "&hourly=temperature_2m,relative_humidity_2m"
                        "&past_days=1"
                        "&forecast_days=1"
                    )

                    resp = await client.get(url)
                    if resp.status_code != 200:
                        continue

                    data    = resp.json()
                    current = data.get("current", {})
                    hourly  = data.get("hourly",  {})

                    # insert current reading
                    reading = ClimateReading(
                        station   = city["name"],
                        country   = city["country"],
                        latitude  = city["lat"],
                        longitude = city["lon"],
                        temp_c    = current.get("temperature_2m"),
                        humidity  = current.get("relative_humidity_2m"),
                        co2_ppm   = None,  # Open-Meteo doesn't provide CO2
                        timestamp = datetime.utcnow(),
                    )
                    db.add(reading)

                    # also insert last 24 hours of hourly data
                    times = hourly.get("time", [])
                    temps = hourly.get("temperature_2m", [])
                    humids = hourly.get("relative_humidity_2m", [])

                    for i, t in enumerate(times[-24:]):
                        try:
                            ts = datetime.fromisoformat(t)
                        except Exception:
                            continue
                        h_reading = ClimateReading(
                            station   = city["name"],
                            country   = city["country"],
                            latitude  = city["lat"],
                            longitude = city["lon"],
                            temp_c    = temps[i]  if i < len(temps)  else None,
                            humidity  = humids[i] if i < len(humids) else None,
                            co2_ppm   = None,
                            timestamp = ts,
                        )
                        db.add(h_reading)

                    inserted += 1

                except Exception as e:
                    print(f"Error fetching {city['name']}: {e}")
                    continue

            await db.commit()
            print(f"Climate ingestion done — {inserted}/{len(CITIES)} cities updated")


@celery_app.task(bind=True, max_retries=3)
def fetch_covid_data(self):
    """Fetch COVID data from Our World in Data."""
    try:
        asyncio.run(_fetch_covid())
    except Exception as exc:
        raise self.retry(exc=exc, countdown=300)


async def _fetch_covid():
    from models.data_model import CovidRecord
    url = "https://covid.ourworldindata.org/data/latest/owid-covid-latest.json"

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(url)
        if resp.status_code != 200:
            return
        data = resp.json()

    async with AsyncSessionLocal() as db:
        count = 0
        for iso_code, country_data in data.items():
            if iso_code.startswith("OWID_"):
                continue
            from models.data_model import CovidRecord
            record = CovidRecord(
                country      = country_data.get("location", iso_code),
                date         = datetime.utcnow(),
                total_cases  = int(country_data.get("total_cases")  or 0),
                new_cases    = int(country_data.get("new_cases")    or 0),
                total_deaths = int(country_data.get("total_deaths") or 0),
                new_deaths   = int(country_data.get("new_deaths")   or 0),
                vaccinations = int(country_data.get("total_vaccinations") or 0),
            )
            db.add(record)
            count += 1
        await db.commit()
        print(f"COVID ingestion done — {count} countries updated")

# Stock symbols to track — all free from Yahoo Finance
STOCKS = [
    "AAPL",   # Apple
    "GOOGL",  # Google
    "MSFT",   # Microsoft
    "AMZN",   # Amazon
    "TSLA",   # Tesla
    "NVDA",   # Nvidia
    "META",   # Meta
    "NFLX",   # Netflix
    "AMD",    # AMD
    "BABA",   # Alibaba
]


@celery_app.task(bind=True, max_retries=3)
def fetch_stock_data(self):
    """
    Fetch daily stock data from Yahoo Finance.
    Free — no API key needed.
    Runs once per day at 8pm UTC (after US markets close).
    """
    try:
        asyncio.run(_fetch_stocks())
    except Exception as exc:
        raise self.retry(exc=exc, countdown=300)


async def _fetch_stocks():
    import yfinance as yf
    from models.data_model import StockPrice

    async with AsyncSessionLocal() as db:
        inserted = 0
        for symbol in STOCKS:
            try:
                # fetch last 2 days to make sure we get today
                ticker = yf.Ticker(symbol)
                hist   = ticker.history(period="2d", interval="1d")

                if hist.empty:
                    print(f"  {symbol}: no data")
                    continue

                # get the latest row
                latest = hist.iloc[-1]
                ts     = hist.index[-1].to_pydatetime()

                record = StockPrice(
                    symbol    = symbol,
                    open      = round(float(latest["Open"]),   2),
                    high      = round(float(latest["High"]),   2),
                    low       = round(float(latest["Low"]),    2),
                    close     = round(float(latest["Close"]),  2),
                    volume    = int(latest["Volume"]),
                    timestamp = ts,
                )
                db.add(record)
                inserted += 1
                print(f"  {symbol}: ${round(float(latest['Close']), 2)}")

            except Exception as e:
                print(f"  {symbol} error: {e}")
                continue

        await db.commit()
        print(f"\nStock ingestion done — {inserted}/{len(STOCKS)} symbols")