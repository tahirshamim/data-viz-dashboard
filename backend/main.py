from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from db.database import engine, Base
from routers import climate, finance, covid
import os
from dotenv import load_dotenv

load_dotenv()

@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield

app = FastAPI(
    title="Data Viz Dashboard API",
    version="1.0.0",
    lifespan=lifespan
)

allowed_origins = [
    "http://localhost:5173",
    "http://localhost:3000",
    os.getenv("FRONTEND_URL", ""),
]
# remove empty strings
allowed_origins = [o for o in allowed_origins if o]

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # tighten this after testing
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(climate.router, prefix="/api/climate", tags=["climate"])
app.include_router(finance.router, prefix="/api/finance", tags=["finance"])
app.include_router(covid.router,   prefix="/api/covid",   tags=["covid"])

@app.get("/health")
async def health():
    return {"status": "ok"}