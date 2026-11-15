import logging

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.database import engine

# Register all models with the declarative base
import app.models  # noqa: F401

from app.api.v1.endpoints.auth import router as auth_router
from app.api.v1.endpoints.referrals import router as referrals_router
from app.api.v1.endpoints.payments import router as payments_router
from app.api.v1.endpoints.wallet import router as wallet_router
from app.api.v1.endpoints.admin import router as admin_router

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Kezza API",
    description="Patient Rewards and Referral Management API",
    version="1.0.0",
)

# Enable CORS for React Native & Web clients
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include v1 routers
app.include_router(auth_router, prefix="/api/v1")
app.include_router(referrals_router, prefix="/api/v1")
app.include_router(payments_router, prefix="/api/v1")
app.include_router(wallet_router, prefix="/api/v1")
app.include_router(admin_router, prefix="/api/v1")


@app.get("/")
def home():
    return {
        "application": "Kezza",
        "message": "Kezza API is running successfully",
        "version": "1.0.0",
        "endpoints": {
            "auth": "/api/v1/auth",
            "referrals": "/api/v1/referrals",
            "payments": "/api/v1/payments",
            "wallet": "/api/v1/wallet",
        },
    }


@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "application": "Kezza API",
    }


@app.get("/health/db")
def database_health():
    try:
        with engine.connect() as connection:
            result = connection.execute(
                text("SELECT 1")
            ).one()

        return {
            "status": "connected",
            "check": result[0],
        }

    except SQLAlchemyError:
        logger.exception("Database health check failed")
        raise HTTPException(
            status_code=503,
            detail="Database connection unavailable",
        )
