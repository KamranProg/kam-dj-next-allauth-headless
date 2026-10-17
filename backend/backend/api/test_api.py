from http import HTTPStatus

import pytest
from django.core.management import call_command
from rest_framework.test import APIClient


@pytest.mark.django_db
class TestApiBasics:
    """Tests for the public API endpoints."""

    def test_health_check(self) -> None:
        """Reports the API as healthy without authentication."""
        response = APIClient().get("/api/health/")
        assert response.status_code == HTTPStatus.OK
        assert response.json() == {"status": "ok"}

    def test_openapi_schema_generates_without_errors(self) -> None:
        """Generates the OpenAPI schema with no warnings or errors."""
        call_command(
            "spectacular", "--validate", "--fail-on-warn", "--file", "/dev/null"
        )
