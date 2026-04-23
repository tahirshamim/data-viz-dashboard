import asyncio
from db.database import engine, Base, AsyncSessionLocal
from models.data_model import ClimateReading, CovidRecord, StockPrice
from datetime import datetime, timedelta
import random

# ── climate ────────────────────────────────────────────────────────────────
cities = [
    {"name": "London",   "country": "UK",          "lat": 51.5,  "lon": -0.1,  "base_temp": 12},
    {"name": "New York", "country": "USA",          "lat": 40.7,  "lon": -74.0, "base_temp": 18},
    {"name": "Tokyo",    "country": "Japan",        "lat": 35.7,  "lon": 139.7, "base_temp": 16},
    {"name": "Karachi",  "country": "Pakistan",     "lat": 24.9,  "lon": 67.0,  "base_temp": 32},
    {"name": "Lagos",    "country": "Nigeria",      "lat": 6.5,   "lon": 3.4,   "base_temp": 30},
    {"name": "Sydney",   "country": "Australia",    "lat": -33.9, "lon": 151.2, "base_temp": 22},
    {"name": "Paris",    "country": "France",       "lat": 48.9,  "lon": 2.3,   "base_temp": 14},
    {"name": "Dubai",    "country": "UAE",          "lat": 25.2,  "lon": 55.3,  "base_temp": 38},
    {"name": "Beijing",  "country": "China",        "lat": 39.9,  "lon": 116.4, "base_temp": 15},
    {"name": "Moscow",   "country": "Russia",       "lat": 55.7,  "lon": 37.6,  "base_temp": 5},
]

# ── covid countries ────────────────────────────────────────────────────────
covid_countries = [
    {"country": "USA",       "base_cases": 80000, "base_deaths": 1200, "base_vax": 5000000},
    {"country": "India",     "base_cases": 50000, "base_deaths": 800,  "base_vax": 8000000},
    {"country": "Brazil",    "base_cases": 30000, "base_deaths": 600,  "base_vax": 3000000},
    {"country": "UK",        "base_cases": 20000, "base_deaths": 200,  "base_vax": 1500000},
    {"country": "France",    "base_cases": 18000, "base_deaths": 150,  "base_vax": 1200000},
    {"country": "Germany",   "base_cases": 15000, "base_deaths": 120,  "base_vax": 1400000},
    {"country": "Pakistan",  "base_cases": 5000,  "base_deaths": 80,   "base_vax": 500000},
    {"country": "Australia", "base_cases": 8000,  "base_deaths": 50,   "base_vax": 800000},
]

# ── stocks ─────────────────────────────────────────────────────────────────
stocks = [
    {"symbol": "AAPL",  "base": 175.0},
    {"symbol": "GOOGL", "base": 140.0},
    {"symbol": "MSFT",  "base": 380.0},
    {"symbol": "AMZN",  "base": 185.0},
    {"symbol": "TSLA",  "base": 245.0},
    {"symbol": "NVDA",  "base": 850.0},
]


async def seed():
    # create tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as db:
        records = []

        # ── climate: 90 days every 6 hours ──
        for city in cities:
            for day in range(90):
                for hour in range(0, 24, 6):
                    ts  = datetime.utcnow() - timedelta(days=day, hours=hour)
                    var = random.uniform(-6, 6)
                    records.append(ClimateReading(
                        station   = city["name"],
                        country   = city["country"],
                        latitude  = city["lat"],
                        longitude = city["lon"],
                        temp_c    = round(city["base_temp"] + var + random.uniform(-2, 2), 1),
                        humidity  = round(random.uniform(30, 90), 1),
                        co2_ppm   = round(random.uniform(410, 425), 2),
                        timestamp = ts,
                    ))

        db.add_all(records)
        print(f"  Climate: {len(records)} records")

        # ── covid: 180 days daily per country ──
        covid_records = []
        for c in covid_countries:
            total_cases  = c["base_cases"]  * 30
            total_deaths = c["base_deaths"] * 30
            total_vax    = c["base_vax"]    * 30
            for day in range(180):
                ts         = datetime.utcnow() - timedelta(days=179 - day)
                # simulate wave pattern
                wave       = 1 + 0.5 * abs(90 - day) / 90
                new_cases  = int(c["base_cases"]  * wave * random.uniform(0.7, 1.3))
                new_deaths = int(c["base_deaths"] * wave * random.uniform(0.7, 1.3))
                new_vax    = int(c["base_vax"]    * random.uniform(0.8, 1.2))
                total_cases  += new_cases
                total_deaths += new_deaths
                total_vax    += new_vax
                covid_records.append(CovidRecord(
                    country      = c["country"],
                    date         = ts,
                    new_cases    = new_cases,
                    new_deaths   = new_deaths,
                    total_cases  = total_cases,
                    total_deaths = total_deaths,
                    vaccinations = total_vax,
                ))

        db.add_all(covid_records)
        print(f"  COVID:   {len(covid_records)} records")

        # ── stocks: 365 days daily ──
        stock_records = []
        for s in stocks:
            price = s["base"]
            for day in range(365):
                ts     = datetime.utcnow() - timedelta(days=364 - day)
                change = random.uniform(-0.03, 0.03)   # ±3% daily move
                price  = round(price * (1 + change), 2)
                high   = round(price * random.uniform(1.001, 1.02), 2)
                low    = round(price * random.uniform(0.98, 0.999), 2)
                stock_records.append(StockPrice(
                    symbol    = s["symbol"],
                    open      = round(price * random.uniform(0.995, 1.005), 2),
                    high      = high,
                    low       = low,
                    close     = price,
                    volume    = random.randint(10_000_000, 80_000_000),
                    timestamp = ts,
                ))

        db.add_all(stock_records)
        print(f"  Stocks:  {len(stock_records)} records")

        await db.commit()
        total = len(records) + len(covid_records) + len(stock_records)
        print(f"\nDone — {total} total records seeded.")


if __name__ == "__main__":
    asyncio.run(seed())