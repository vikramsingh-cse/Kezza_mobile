import os
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

try:
    import pytest
except ImportError:
    pytest = None

# Set testing database URL before importing app modules
os.environ["DATABASE_URL"] = "sqlite:///:memory:"
os.environ["APP_ENV"] = "test"
os.environ["PAYMENT_VERIFICATION_API_KEY"] = "test-only-payment-key-for-automated-journey"

from app.base import Base
from app.database import get_db
from app.main import app as fastapi_app
import app.models  # noqa: F401 Ensure all models are registered

# Create in-memory test engine
test_engine = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
)
TestingSessionLocal = sessionmaker(
    bind=test_engine,
    autocommit=False,
    autoflush=False,
    expire_on_commit=False,
)

Base.metadata.create_all(bind=test_engine)

if pytest is not None:
    @pytest.fixture(scope="session", autouse=True)
    def setup_database():
        Base.metadata.create_all(bind=test_engine)
        yield
        Base.metadata.drop_all(bind=test_engine)

    @pytest.fixture
    def db_session():
        connection = test_engine.connect()
        transaction = connection.begin()
        session = TestingSessionLocal(bind=connection)
        yield session
        session.close()
        transaction.rollback()
        connection.close()

    @pytest.fixture
    def client(db_session):
        def override_get_db():
            yield db_session

        fastapi_app.dependency_overrides[get_db] = override_get_db
        with TestClient(fastapi_app) as c:
            yield c
        fastapi_app.dependency_overrides.clear()
