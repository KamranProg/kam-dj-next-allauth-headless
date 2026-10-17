from collections.abc import Callable
from typing import Any

import pytest
from allauth.account.models import EmailAddress
from rest_framework.test import APIClient

from accounts.models import User

PASSWORD = "Str0ngPass!234"  # ruff: ignore[hardcoded-password-string]
BROWSER = "/_allauth/browser/v1/auth"
APP = "/_allauth/app/v1/auth"


@pytest.fixture
def client() -> APIClient:
    """Return an anonymous client that enforces CSRF like a real browser."""
    return APIClient(enforce_csrf_checks=True)


@pytest.fixture
def user() -> User:
    """Return a persisted user whose email address is verified."""
    member = User.objects.create_user(email="member@example.com", password=PASSWORD)
    EmailAddress.objects.create(
        user=member,
        email=member.email,
        verified=True,
        primary=True,
    )
    return member


def csrf_headers(client: APIClient) -> dict[str, str]:
    """Fetch a CSRF cookie the way the frontend does and build the header."""
    client.get(f"{BROWSER}/session")
    return {"X-CSRFToken": client.cookies["csrftoken"].value}


@pytest.fixture
def api_post(
    client: APIClient,
    django_capture_on_commit_callbacks: Callable[..., Any],
) -> Callable[[str, dict[str, str]], Any]:
    """POST JSON like the Next.js proxy: with a CSRF header, running on_commit hooks.

    allauth sends verification emails from transaction.on_commit, which would
    never fire inside pytest-django's wrapped test transaction.
    """

    def _post(path: str, data: dict[str, str]) -> Any:  # ruff: ignore[any-type]
        with django_capture_on_commit_callbacks(execute=True):
            return client.post(
                f"{BROWSER}/{path}",
                data,
                format="json",
                headers=csrf_headers(client),
            )

    return _post
