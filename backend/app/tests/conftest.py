"""
Pytest configuration and shared fixtures for the Kezza backend test suite.
"""

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture(scope="module")
def client() -> TestClient:
    """Return a synchronous test client for the FastAPI app."""
    with TestClient(app) as c:
        yield c
