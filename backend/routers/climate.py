from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from db.database import get_db
from models.data_model import ClimateReading
from datetime import datetime, timedelta
from typing import Optional
import redis.asyncio as aioredis
import json, os

router = APIRouter()

# Simple Redis cache — avoids hammering the DB on every chart pan/zoom
redis_client = aioredis.from_url(os.getenv("REDIS_URL", "redis://localhost:6379"))

CACHE_TTL = 300  # cache responses for 5 minutes


@router.get("/readings")
async def get_climate_readings(
    country:    Optional[str] = Query(None, description="Filter by country"),
    start_date: Optional[str] = Query(None, description="ISO date string e.g. 2024-01-01"),
    end_date:   Optional[str] = Query(None, description="ISO date string e.g. 2024-12-31"),
    limit:      int           = Query(1000, le=10000),
    db:         AsyncSession  = Depends(get_db)
):
    # Build a cache key from the query params
    cache_key = f"climate:{country}:{start_date}:{end_date}:{limit}"
    cached = await redis_client.get(cache_key)
    if cached:
        return json.loads(cached)

    # Build the query dynamically based on which filters were sent
    filters = []
    if country:
        filters.append(ClimateReading.country == country)
    if start_date:
        filters.append(ClimateReading.timestamp >= datetime.fromisoformat(start_date))
    if end_date:
        filters.append(ClimateReading.timestamp <= datetime.fromisoformat(end_date))

    stmt = (
        select(ClimateReading)
        .where(and_(*filters))
        .order_by(ClimateReading.timestamp.desc())
        .limit(limit)
    )

    result = await db.execute(stmt)
    rows = result.scalars().all()

    data = [
        {
            "id":        r.id,
            "station":   r.station,
            "country":   r.country,
            "latitude":  r.latitude,
            "longitude": r.longitude,
            "temp_c":    r.temp_c,
            "humidity":  r.humidity,
            "co2_ppm":   r.co2_ppm,
            "timestamp": r.timestamp.isoformat() if r.timestamp else None,
        }
        for r in rows
    ]

    # Store in cache so the next identical request is instant
    await redis_client.setex(cache_key, CACHE_TTL, json.dumps(data))
    return data


@router.get("/summary")
async def get_climate_summary(db: AsyncSession = Depends(get_db)):
    """Returns aggregate stats for the KPI cards on the dashboard."""
    from sqlalchemy import func

    stmt = select(
        func.count(ClimateReading.id).label("total_records"),
        func.avg(ClimateReading.temp_c).label("avg_temp"),
        func.avg(ClimateReading.co2_ppm).label("avg_co2"),
        func.avg(ClimateReading.humidity).label("avg_humidity"),
    )
    result = await db.execute(stmt)
    row = result.one()

    return {
        "total_records": row.total_records,
        "avg_temp":      round(row.avg_temp or 0, 2),
        "avg_co2":       round(row.avg_co2 or 0, 2),
        "avg_humidity":  round(row.avg_humidity or 0, 2),
    }