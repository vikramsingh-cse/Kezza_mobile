import os
from pathlib import Path
from typing import Generator

from dotenv import load_dotenv
from sqlalchemy import URL, create_engine
from sqlalchemy.orm import Session, sessionmaker

# Load environment variables from backend/.env and root .env
BACKEND_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BACKEND_DIR / ".env")
load_dotenv(BACKEND_DIR.parent / ".env")

database_url_str = os.getenv("DATABASE_URL")

if database_url_str:
    if "sqlite" in database_url_str:
        engine = create_engine(
            database_url_str,
            connect_args={"check_same_thread": False},
        )
    else:
        engine = create_engine(
            database_url_str,
            pool_pre_ping=True,
            connect_args={"connect_timeout": 5},
        )
else:
    # Build database URL from DB_* environment variables
    db_host = os.getenv("DB_HOST", "localhost")
    db_port = int(os.getenv("DB_PORT", 5432))
    db_name = os.getenv("DB_NAME", "kezza_db")
    db_user = os.getenv("DB_USER", "kezza_user")
    db_password = os.getenv("DB_PASSWORD", "kezza_pass123")

    database_url = URL.create(
        drivername="postgresql+psycopg",
        username=db_user,
        password=db_password,
        host=db_host,
        port=db_port,
        database=db_name,
    )

    engine = create_engine(
        database_url,
        pool_pre_ping=True,
        connect_args={"connect_timeout": 5},
    )

SessionLocal = sessionmaker(
    bind=engine,
    autocommit=False,
    autoflush=False,
    expire_on_commit=False,
)


def get_db() -> Generator[Session, None, None]:
    """
    FastAPI dependency yielding a database session and closing it on completion.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
