
import os
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import URL, create_engine

# Load environment variables from backend/.env
BACKEND_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BACKEND_DIR / ".env")

required_vars = [
    "DB_HOST",
    "DB_PORT",
    "DB_NAME",
    "DB_USER",
    "DB_PASSWORD",
]

missing_vars = [
    key for key in required_vars if not os.getenv(key)
]

if missing_vars:
    raise RuntimeError(
        f"Missing environment variables: {', '.join(missing_vars)}"
    )

# Build database URL safely
database_url = URL.create(
    drivername="postgresql+psycopg",
    username=os.environ["DB_USER"],
    password=os.environ["DB_PASSWORD"],
    host=os.environ["DB_HOST"],
    port=int(os.environ["DB_PORT"]),
    database=os.environ["DB_NAME"],
)

# Create SQLAlchemy engine
engine = create_engine(
    database_url,
    pool_pre_ping=True,
    connect_args={"connect_timeout": 5},
)

