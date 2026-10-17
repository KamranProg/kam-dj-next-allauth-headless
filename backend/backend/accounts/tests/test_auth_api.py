from http import HTTPStatus

import pytest
from rest_framework.test import APIClient

from accounts.models import User
from accounts.tests.conftest import APP, BROWSER, PASSWORD, csrf_headers


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

    def test_signup_creates_user_but_requires_email_verification(
        self,
        client: APIClient,
    ) -> None:
        """Registers a user without a session until the email is verified."""
        response = client.post(
            f"{BROWSER}/signup",
            {"email": "new@example.com", "password": PASSWORD},
            format="json",
            headers=csrf_headers(client),
        )
        body = response.json()
        pending = [f for f in body["data"]["flows"] if f["id"] == "verify_email"]
        assert response.status_code == HTTPStatus.UNAUTHORIZED
        assert pending
        assert pending[0]["is_pending"] is True
        assert User.objects.filter(email="new@example.com").exists()
        # The session cookie only holds the pending login; nobody is signed in.
        assert client.get(f"{BROWSER}/session").status_code == HTTPStatus.UNAUTHORIZED

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

    def test_signup_with_registered_email_reveals_nothing(
        self,
        client: APIClient,
        user: User,
    ) -> None:
        """Answers like a normal signup so registered emails cannot be probed."""
        response = client.post(
            f"{BROWSER}/signup",
            {"email": user.email, "password": PASSWORD},
            format="json",
            headers=csrf_headers(client),
        )
        assert response.status_code == HTTPStatus.UNAUTHORIZED
        assert User.objects.filter(email=user.email).count() == 1

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
class TestRateLimiting:
    """Tests for allauth's built-in rate limits."""

    def test_repeated_failed_logins_lock_the_account_for_a_while(
        self,
        client: APIClient,
        user: User,
    ) -> None:
        """Refuses further attempts for an email after too many failures."""
        codes = []
        for _ in range(7):
            response = client.post(
                f"{BROWSER}/login",
                {"email": user.email, "password": "wrong"},
                format="json",
                headers=csrf_headers(client),
            )
            codes.append(response.json()["errors"][0]["code"])

        assert codes[0] == "email_password_mismatch"
        assert codes[-1] == "too_many_login_attempts"

        # Even the right password is refused while the lock is active.
        correct = client.post(
            f"{BROWSER}/login",
            {"email": user.email, "password": PASSWORD},
            format="json",
            headers=csrf_headers(client),
        )
        assert correct.status_code == HTTPStatus.BAD_REQUEST
        assert correct.json()["errors"][0]["code"] == "too_many_login_attempts"
        assert "sessionid" not in correct.cookies

    def test_too_many_requests_from_one_address_get_429(
        self, client: APIClient
    ) -> None:
        """Answers 429 once an address makes more login requests than allowed."""
        statuses = {
            client.post(
                f"{BROWSER}/login",
                {"email": f"user{n}@example.com", "password": "wrong"},
                format="json",
                headers=csrf_headers(client),
            ).status_code
            for n in range(40)
        }
        assert HTTPStatus.TOO_MANY_REQUESTS in statuses


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
