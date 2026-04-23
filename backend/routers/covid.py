from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from db.database import get_db
from models.data_model import CovidRecord
from datetime import datetime
from typing import Optional

router = APIRouter()

@router.get("/records")
async def get_covid_records(
    country:    Optional[str] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date:   Optional[str] = Query(None),
    limit:      int           = Query(1000, le=10000),
    db:         AsyncSession  = Depends(get_db)
):
    filters = []
    if country:
        filters.append(CovidRecord.country == country)
    if start_date:
        filters.append(CovidRecord.date >= datetime.fromisoformat(start_date))
    if end_date:
        filters.append(CovidRecord.date <= datetime.fromisoformat(end_date))

    stmt = (
        select(CovidRecord)
        .where(and_(*filters))
        .order_by(CovidRecord.date.asc())
        .limit(limit)
    )
    result = await db.execute(stmt)
    rows = result.scalars().all()

    return [
        {
            "id":           r.id,
            "country":      r.country,
            "date":         r.date.isoformat(),
            "total_cases":  r.total_cases,
            "new_cases":    r.new_cases,
            "total_deaths": r.total_deaths,
            "new_deaths":   r.new_deaths,
            "vaccinations": r.vaccinations,
        }
        for r in rows
    ]

@router.get("/summary")
async def get_covid_summary(db: AsyncSession = Depends(get_db)):
    from sqlalchemy import func
    stmt = select(
        func.count(CovidRecord.id).label("total_records"),
        func.sum(CovidRecord.new_cases).label("total_cases"),
        func.sum(CovidRecord.new_deaths).label("total_deaths"),
        func.count(func.distinct(CovidRecord.country)).label("countries"),
    )
    result = await db.execute(stmt)
    row = result.one()
    return {
        "total_records": row.total_records or 0,
        "total_cases":   row.total_cases   or 0,
        "total_deaths":  row.total_deaths  or 0,
        "countries":     row.countries     or 0,
    }