
import os

from dotenv import load_dotenv
from sqlalchemy import URL, create_engine, text

load_dotenv()

required = [
    "DB_HOST",
    "DB_PORT",
    "DB_NAME",
    "DB_USER",
    "DB_PASSWORD",
]

missing = [key for key in required if not os.getenv(key)]

if missing:
    raise RuntimeError(
        f"Missing environment variables: {', '.join(missing)}"
    )

database_url = URL.create(
    drivername="postgresql+psycopg",
    username=os.environ["DB_USER"],
    password=os.environ["DB_PASSWORD"],
    host=os.environ["DB_HOST"],
    port=int(os.environ["DB_PORT"]),
    database=os.environ["DB_NAME"],
)

engine = create_engine(
    database_url,
    pool_pre_ping=True,
    connect_args={"connect_timeout": 5},
)

try:
    with engine.connect() as connection:
        result = connection.execute(
            text("SELECT current_database(), current_user")
        ).one()

        print("KEZZA DATABASE CONNECTED SUCCESSFULLY")
        print(f"Database: {result[0]}")
        print(f"User: {result[1]}")

except Exception as error:
    print("DATABASE CONNECTION FAILED")
    print(f"Error: {error}")
    raise

finally:
    engine.dispose()
