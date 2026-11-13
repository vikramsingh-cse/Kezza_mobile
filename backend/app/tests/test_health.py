"""
Smoke tests for the Kezza API health and info endpoints.

These tests require no database connection — they verify that the
application starts correctly and responds to basic requests.
"""

from fastapi.testclient import TestClient


class TestRootEndpoint:
    def test_returns_200(self, client: TestClient):
        response = client.get("/")
        assert response.status_code == 200

    def test_contains_application_name(self, client: TestClient):
        data = response = client.get("/").json()
        assert data["application"] == "Kezza"

    def test_contains_version(self, client: TestClient):
        data = client.get("/").json()
        assert "version" in data


class TestHealthEndpoint:
    def test_returns_200(self, client: TestClient):
        response = client.get("/health")
        assert response.status_code == 200

    def test_status_is_healthy(self, client: TestClient):
        data = client.get("/health").json()
        assert data["status"] == "healthy"
