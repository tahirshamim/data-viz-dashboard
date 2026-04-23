from tasks.celery_app import celery_app
from db.database import AsyncSessionLocal
from models.data_model import ClimateReading, CovidRecord
import httpx
import asyncio
from datetime import datetime


@celery_app.task(bind=True, max_retries=3)
def fetch_climate_data(self):
    """
    Fetch temperature + humidity from Open-Meteo (free, no API key needed).
    We sample a handful of major cities.
    """
    cities = [
        {"name": "London",   "country": "UK",    "lat": 51.5,  "lon": -0.1},
        {"name": "New York", "country": "USA",   "lat": 40.7,  "lon": -74.0},
        {"name": "Tokyo",    "country": "Japan", "lat": 35.7,  "lon": 139.7},
        {"name": "Karachi",  "country": "Pakistan", "lat": 24.9, "lon": 67.0},
        {"name": "Lagos",    "country": "Nigeria",  "lat": 6.5,  "lon": 3.4},
    ]

    try:
        asyncio.run(_async_fetch_climate(cities))
    except Exception as exc:
        # Retry up to 3 times with exponential backoff
        raise self.retry(exc=exc, countdown=60 * (2 ** self.request.retries))


async def _async_fetch_climate(cities):
    async with AsyncSessionLocal() as db:
        async with httpx.AsyncClient() as client:
            for city in cities:
                url = (
                    f"https://api.open-meteo.com/v1/forecast"
                    f"?latitude={city['lat']}&longitude={city['lon']}"
                    f"&current=temperature_2m,relative_humidity_2m"
                )
                response = await client.get(url, timeout=10)
                if response.status_code != 200:
                    continue

                data = response.json()
                current = data.get("current", {})

                reading = ClimateReading(
                    station   = city["name"],
                    country   = city["country"],
                    latitude  = city["lat"],
                    longitude = city["lon"],
                    temp_c    = current.get("temperature_2m"),
                    humidity  = current.get("relative_humidity_2m"),
                    timestamp = datetime.utcnow()
                )
                db.add(reading)

        await db.commit()


@celery_app.task(bind=True, max_retries=3)
def fetch_covid_data(self):
    """
    Fetch COVID data from Our World in Data (free, no key needed).
    """
    try:
        asyncio.run(_async_fetch_covid())
    except Exception as exc:
        raise self.retry(exc=exc, countdown=300)


async def _async_fetch_covid():
    url = "https://covid.ourworldindata.org/data/latest/owid-covid-latest.json"

    async with httpx.AsyncClient() as client:
        response = await client.get(url, timeout=30)
        if response.status_code != 200:
            return

        data = response.json()

    async with AsyncSessionLocal() as db:
        for iso_code, country_data in list(data.items())[:50]:  # limit to 50 countries
            if iso_code.startswith("OWID_"):
                continue  # skip aggregate rows

            record = CovidRecord(
                country      = country_data.get("location", iso_code),
                date         = datetime.utcnow(),
                total_cases  = int(country_data.get("total_cases") or 0),
                new_cases    = int(country_data.get("new_cases") or 0),
                total_deaths = int(country_data.get("total_deaths") or 0),
                new_deaths   = int(country_data.get("new_deaths") or 0),
                vaccinations = int(country_data.get("total_vaccinations") or 0),
            )
            db.add(record)

        await db.commit()