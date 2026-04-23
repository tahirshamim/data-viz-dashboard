from sqlalchemy import Column, String, Float, DateTime, Integer, Index
from sqlalchemy.sql import func
from db.database import Base

class ClimateReading(Base):
    __tablename__ = "climate_readings"

    id        = Column(Integer, primary_key=True, autoincrement=True)
    station   = Column(String(100), nullable=False, index=True)
    country   = Column(String(100), nullable=False, index=True)
    latitude  = Column(Float)
    longitude = Column(Float)
    temp_c    = Column(Float)       # temperature in Celsius
    humidity  = Column(Float)
    co2_ppm   = Column(Float)       # CO2 parts per million
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), index=True)

    # TimescaleDB hypertable index — speeds up time-range queries massively
    __table_args__ = (
        Index("idx_climate_station_time", "station", "timestamp"),
    )


class CovidRecord(Base):
    __tablename__ = "covid_records"

    id              = Column(Integer, primary_key=True, autoincrement=True)
    country         = Column(String(100), nullable=False, index=True)
    date            = Column(DateTime(timezone=True), nullable=False, index=True)
    total_cases     = Column(Integer, default=0)
    new_cases       = Column(Integer, default=0)
    total_deaths    = Column(Integer, default=0)
    new_deaths      = Column(Integer, default=0)
    vaccinations    = Column(Integer, default=0)

    __table_args__ = (
        Index("idx_covid_country_date", "country", "date"),
    )


class StockPrice(Base):
    __tablename__ = "stock_prices"

    id        = Column(Integer, primary_key=True, autoincrement=True)
    symbol    = Column(String(20),  nullable=False, index=True)
    open      = Column(Float)
    high      = Column(Float)
    low       = Column(Float)
    close     = Column(Float)
    volume    = Column(Integer)
    timestamp = Column(DateTime(timezone=True), nullable=False, index=True)

    __table_args__ = (
        Index("idx_stock_symbol_time", "symbol", "timestamp"),
    )