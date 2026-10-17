import re
from collections.abc import Callable
from http import HTTPStatus
from typing import Any
from urllib.parse import unquote

import pytest
from django.core import mail
from rest_framework.test import APIClient

from accounts.models import User
from accounts.tests.conftest import BROWSER, PASSWORD

NEW_PASSWORD = "NewStr0ngPass!567"  # ruff: ignore[hardcoded-password-string]


def link_key(pattern: str) -> str:
    """Extract and decode the key from the link in the latest email."""
    match = re.search(pattern, str(mail.outbox[-1].body))
    assert match, mail.outbox[-1].body
    return unquote(match.group(1))


@pytest.mark.django_db
class TestEmailVerification:
    """Tests for mandatory email verification."""

    def test_signup_sends_verification_email_with_frontend_link(
        self, client: APIClient, api_post: Callable[..., Any]
    ) -> None:
        """Emails a link that points at the frontend, signed with the site name."""
        api_post("signup", {"email": "new@example.com", "password": PASSWORD})
        assert len(mail.outbox) == 1
        assert mail.outbox[0].to == ["new@example.com"]
        assert "http://localhost:3000/account/verify-email/" in mail.outbox[0].body
        assert mail.outbox[0].subject.startswith("[dj-next]")

    def test_login_is_blocked_until_the_email_is_verified(
        self, client: APIClient, api_post: Callable[..., Any]
    ) -> None:
        """Refuses to sign in an unverified user."""
        api_post("signup", {"email": "new@example.com", "password": PASSWORD})
        response = api_post("login", {"email": "new@example.com", "password": PASSWORD})
        assert response.status_code == HTTPStatus.UNAUTHORIZED
        assert client.get(f"{BROWSER}/session").status_code == HTTPStatus.UNAUTHORIZED

    def test_confirming_the_key_allows_login(
        self, client: APIClient, api_post: Callable[..., Any]
    ) -> None:
        """Verifies the address from the emailed key, then signs in."""
        api_post("signup", {"email": "new@example.com", "password": PASSWORD})
        key = link_key(r"verify-email/(\S+)")

        info = client.get(
            f"{BROWSER}/email/verify", headers={"X-Email-Verification-Key": key}
        )
        assert info.status_code == HTTPStatus.OK
        assert info.json()["data"]["email"] == "new@example.com"

        api_post("email/verify", {"key": key})
        response = api_post("login", {"email": "new@example.com", "password": PASSWORD})
        assert response.status_code == HTTPStatus.OK
        assert "sessionid" in response.cookies

    def test_rejects_an_invalid_key(
        self, client: APIClient, api_post: Callable[..., Any]
    ) -> None:
        """Rejects a verification key that was never issued."""
        response = api_post("email/verify", {"key": "not-a-real-key"})
        assert response.status_code == HTTPStatus.BAD_REQUEST
        assert response.json()["errors"][0]["code"] == "invalid_or_expired_key"


@pytest.mark.django_db
class TestPasswordReset:
    """Tests for the password reset flow."""

    def test_reset_changes_the_password(
        self, client: APIClient, user: User, api_post: Callable[..., Any]
    ) -> None:
        """Resets the password from the emailed key; the old password stops working."""
        api_post("password/request", {"email": user.email})
        assert (
            "http://localhost:3000/account/password/reset/key/" in mail.outbox[-1].body
        )
        key = link_key(r"reset/key/(\S+)")

        api_post("password/reset", {"key": key, "password": NEW_PASSWORD})

        old = api_post("login", {"email": user.email, "password": PASSWORD})
        new = api_post("login", {"email": user.email, "password": NEW_PASSWORD})
        assert old.status_code == HTTPStatus.BAD_REQUEST
        assert new.status_code == HTTPStatus.OK

    def test_reset_key_can_only_be_used_once(
        self, user: User, api_post: Callable[..., Any]
    ) -> None:
        """Rejects a reset key after it has been used."""
        api_post("password/request", {"email": user.email})
        key = link_key(r"reset/key/(\S+)")
        api_post("password/reset", {"key": key, "password": NEW_PASSWORD})

        again = api_post("password/reset", {"key": key, "password": "Another!Pass999"})
        assert again.status_code == HTTPStatus.BAD_REQUEST
        assert again.json()["errors"][0]["code"] == "invalid_password_reset"

    def test_unknown_email_gets_the_same_response_and_no_reset_link(
        self, client: APIClient, api_post: Callable[..., Any]
    ) -> None:
        """Does not reveal whether an address is registered or send a usable link."""
        response = api_post("password/request", {"email": "nobody@example.com"})
        assert response.status_code == HTTPStatus.OK
        assert all(
            "/password/reset/key/" not in message.body for message in mail.outbox
        )

    def test_reset_rejects_a_weak_password(
        self, client: APIClient, user: User, api_post: Callable[..., Any]
    ) -> None:
        """Applies the password validators to the new password."""
        api_post("password/request", {"email": user.email})
        key = link_key(r"reset/key/(\S+)")
        response = api_post("password/reset", {"key": key, "password": "123"})
        assert response.status_code == HTTPStatus.BAD_REQUEST
