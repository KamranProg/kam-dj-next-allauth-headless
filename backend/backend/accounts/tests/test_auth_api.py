from http import HTTPStatus

import pytest
from rest_framework.test import APIClient

from accounts.models import User

BROWSER = "/_allauth/browser/v1/auth"
APP = "/_allauth/app/v1/auth"
PASSWORD = "Str0ngPass!234"  # ruff: ignore[hardcoded-password-string]


@pytest.fixture
def client() -> APIClient:
    """Return an anonymous client that enforces CSRF like a real browser."""
    return APIClient(enforce_csrf_checks=True)


@pytest.fixture
def user() -> User:
    """Return a persisted user."""
    return User.objects.create_user(email="member@example.com", password=PASSWORD)


def csrf_headers(client: APIClient) -> dict[str, str]:
    """Fetch a CSRF cookie the way the frontend does and build the header."""
    client.get(f"{BROWSER}/session")
    return {"X-CSRFToken": client.cookies["csrftoken"].value}


@pytest.mark.django_db
class TestBrowserAuthApi:
    """Tests for the cookie-session (browser) authentication endpoints."""

    def test_anonymous_session_is_unauthorized_and_sets_csrf_cookie(
        self,
        client: APIClient,
    ) -> None:
        """Reports no session and hands out a CSRF cookie."""
        response = client.get(f"{BROWSER}/session")
        assert response.status_code == HTTPStatus.UNAUTHORIZED
        assert response.json()["meta"]["is_authenticated"] is False
        assert "csrftoken" in response.cookies

    def test_signup_requires_csrf_token(self, client: APIClient) -> None:
        """Rejects a signup that lacks the CSRF header."""
        response = client.post(
            f"{BROWSER}/signup",
            {"email": "new@example.com", "password": PASSWORD},
            format="json",
        )
        assert response.status_code == HTTPStatus.FORBIDDEN

    def test_signup_creates_user_and_session(self, client: APIClient) -> None:
        """Registers a user, starts a session and returns no API token."""
        response = client.post(
            f"{BROWSER}/signup",
            {"email": "new@example.com", "password": PASSWORD},
            format="json",
            headers=csrf_headers(client),
        )
        body = response.json()
        assert response.status_code == HTTPStatus.OK
        assert body["data"]["user"]["email"] == "new@example.com"
        assert "session_token" not in body["meta"]
        assert "sessionid" in response.cookies
        assert User.objects.filter(email="new@example.com").exists()

    def test_signup_rejects_weak_password(self, client: APIClient) -> None:
        """Rejects a password that fails Django's validators."""
        response = client.post(
            f"{BROWSER}/signup",
            {"email": "new@example.com", "password": "123"},
            format="json",
            headers=csrf_headers(client),
        )
        assert response.status_code == HTTPStatus.BAD_REQUEST
        codes = {error["code"] for error in response.json()["errors"]}
        assert "password_too_short" in codes

    def test_signup_rejects_duplicate_email(
        self,
        client: APIClient,
        user: User,
    ) -> None:
        """Rejects an email that is already registered."""
        response = client.post(
            f"{BROWSER}/signup",
            {"email": user.email, "password": PASSWORD},
            format="json",
            headers=csrf_headers(client),
        )
        assert response.status_code == HTTPStatus.BAD_REQUEST
        assert response.json()["errors"][0]["code"] == "email_taken"

    def test_login_starts_session(self, client: APIClient, user: User) -> None:
        """Logs in with a session cookie and returns the user."""
        response = client.post(
            f"{BROWSER}/login",
            {"email": user.email, "password": PASSWORD},
            format="json",
            headers=csrf_headers(client),
        )
        assert response.status_code == HTTPStatus.OK
        assert response.json()["data"]["user"]["email"] == user.email
        assert "sessionid" in response.cookies

    def test_login_rejects_wrong_password(self, client: APIClient, user: User) -> None:
        """Rejects a login with the wrong password."""
        response = client.post(
            f"{BROWSER}/login",
            {"email": user.email, "password": "wrong"},
            format="json",
            headers=csrf_headers(client),
        )
        assert response.status_code == HTTPStatus.BAD_REQUEST
        assert response.json()["errors"][0]["code"] == "email_password_mismatch"
        assert "sessionid" not in response.cookies

    def test_session_returns_current_user(self, client: APIClient, user: User) -> None:
        """Returns the signed-in user's details."""
        client.force_login(user)
        response = client.get(f"{BROWSER}/session")
        assert response.status_code == HTTPStatus.OK
        assert response.json()["data"]["user"]["email"] == user.email

    def test_logout_ends_the_session(self, client: APIClient, user: User) -> None:
        """Logs out and reports no session afterwards."""
        client.force_login(user)
        client.delete(f"{BROWSER}/session", headers=csrf_headers(client))
        assert client.get(f"{BROWSER}/session").status_code == HTTPStatus.UNAUTHORIZED


@pytest.mark.django_db
class TestAppAuthApi:
    """Tests for the token-based (mobile app) authentication endpoints."""

    def test_app_login_returns_session_token(
        self, client: APIClient, user: User
    ) -> None:
        """Logs in without cookies or CSRF and returns a session token."""
        response = client.post(
            f"{APP}/login",
            {"email": user.email, "password": PASSWORD},
            format="json",
        )
        assert response.status_code == HTTPStatus.OK
        assert response.json()["meta"]["session_token"]
        assert "sessionid" not in response.cookies

    def test_session_token_authenticates_and_logout_revokes_it(
        self,
        client: APIClient,
        user: User,
    ) -> None:
        """Accepts the token in X-Session-Token until the app logs out."""
        login = client.post(
            f"{APP}/login",
            {"email": user.email, "password": PASSWORD},
            format="json",
        )
        headers = {"X-Session-Token": login.json()["meta"]["session_token"]}

        session = client.get(f"{APP}/session", headers=headers)
        assert session.status_code == HTTPStatus.OK
        assert session.json()["data"]["user"]["email"] == user.email

        client.delete(f"{APP}/session", headers=headers)
        assert (
            client.get(f"{APP}/session", headers=headers).status_code != HTTPStatus.OK
        )
