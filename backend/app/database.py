import os
from typing import Generator

from sqlalchemy import URL, create_engine
from sqlalchemy.orm import Session, sessionmaker

import app.config  # noqa: F401 - loads local environment files before reading variables

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
    required = ("DB_HOST", "DB_PORT", "DB_NAME", "DB_USER", "DB_PASSWORD")
    missing = [name for name in required if not os.getenv(name)]
    if missing:
        raise RuntimeError(
            "Set DATABASE_URL or configure all required database variables: "
            + ", ".join(missing)
        )

    db_host = os.environ["DB_HOST"]
    db_port = int(os.environ["DB_PORT"])
    db_name = os.environ["DB_NAME"]
    db_user = os.environ["DB_USER"]
    db_password = os.environ["DB_PASSWORD"]

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
