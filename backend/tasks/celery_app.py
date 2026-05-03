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

celery_app.conf.beat_schedule = {
    # climate every 6 hours — one bulk request for all 20 cities
    "fetch-climate-6hourly": {
        "task":     "tasks.ingestion.fetch_climate_data",
        "schedule": crontab(minute=0, hour="*/6"),
    },
    # stocks once daily after US market close
    "fetch-stocks-daily": {
        "task":     "tasks.ingestion.fetch_stock_data",
        "schedule": crontab(hour=20, minute=0),
    },
}

celery_app.conf.timezone = "UTC"