from fastapi import APIRouter, Depends, Query, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from db.database import get_db
from models.data_model import ClimateReading
from datetime import datetime
from typing import Optional
import time

router = APIRouter()

# in-memory cache — no Redis needed
_cache: dict = {}
CACHE_TTL = 300  # 5 minutes

def cache_get(key: str):
    if key in _cache:
        data, ts = _cache[key]
        if time.time() - ts < CACHE_TTL:
            return data
        del _cache[key]
    return None

def cache_set(key: str, data):
    _cache[key] = (data, time.time())


@router.get("/readings")
async def get_climate_readings(
    country:    Optional[str] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date:   Optional[str] = Query(None),
    limit:      int           = Query(200, le=5000),
    db:         AsyncSession  = Depends(get_db)
):
    try:
        cache_key = f"readings:{country}:{start_date}:{end_date}:{limit}"
        cached = cache_get(cache_key)
        if cached:
            return cached

        stmt = select(ClimateReading)

        if country:
            stmt = stmt.where(ClimateReading.country == country)
        if start_date:
            stmt = stmt.where(ClimateReading.timestamp >= datetime.fromisoformat(start_date))
        if end_date:
            stmt = stmt.where(ClimateReading.timestamp <= datetime.fromisoformat(end_date))

        stmt = stmt.order_by(ClimateReading.timestamp.desc()).limit(limit)

        result = await db.execute(stmt)
        rows = result.scalars().all()

        data = [
            {
                "id":        r.id,
                "station":   r.station   or "",
                "country":   r.country   or "",
                "latitude":  r.latitude  or 0.0,
                "longitude": r.longitude or 0.0,
                "temp_c":    r.temp_c    or 0.0,
                "humidity":  r.humidity  or 0.0,
                "co2_ppm":   r.co2_ppm,
                "timestamp": r.timestamp.isoformat() if r.timestamp else None,
            }
            for r in rows
        ]

        cache_set(cache_key, data)
        return data

    except Exception as e:
        return {"error": str(e), "type": type(e).__name__}


@router.get("/summary")
async def get_climate_summary(db: AsyncSession = Depends(get_db)):
    try:
        cached = cache_get("summary")
        if cached:
            return cached

        stmt = select(
            func.count(ClimateReading.id).label("total_records"),
            func.avg(ClimateReading.temp_c).label("avg_temp"),
            func.avg(ClimateReading.co2_ppm).label("avg_co2"),
            func.avg(ClimateReading.humidity).label("avg_humidity"),
        )
        result = await db.execute(stmt)
        row = result.one()

        data = {
            "total_records": row.total_records or 0,
            "avg_temp":      round(row.avg_temp or 0, 2),
            "avg_co2":       round(row.avg_co2 or 0, 2),
            "avg_humidity":  round(row.avg_humidity or 0, 2),
        }
        cache_set("summary", data)
        return data

    except Exception as e:
        return {"error": str(e), "type": type(e).__name__}
    


@router.get("/trigger-fetch")
async def trigger_climate_fetch(background_tasks: BackgroundTasks):
    """
    Returns immediately — runs fetch in background.
    Cron job won't timeout.
    """
    from tasks.ingestion import _fetch_climate
    background_tasks.add_task(_fetch_climate)
    return {"status": "ok", "message": "Climate fetch started in background"}