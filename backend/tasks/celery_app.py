from celery import Celery
from celery.schedules import crontab
import os

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")

celery_app = Celery(
    "data_viz",
    broker=REDIS_URL,
    backend=REDIS_URL,
    include=["tasks.ingestion"]
)

# Schedule ingestion jobs
celery_app.conf.beat_schedule = {
    # Fetch climate data every hour
    "fetch-climate-hourly": {
        "task":     "tasks.ingestion.fetch_climate_data",
        "schedule": crontab(minute=0),  # top of every hour
    },
    # Fetch COVID data once a day at midnight
    "fetch-covid-daily": {
        "task":     "tasks.ingestion.fetch_covid_data",
        "schedule": crontab(hour=0, minute=0),
    },
}

celery_app.conf.timezone = "UTC"