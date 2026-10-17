import base64
import hashlib
import hmac
import struct
import time
from collections.abc import Callable
from http import HTTPStatus
from typing import Any
from unittest.mock import patch

import pytest
from rest_framework.test import APIClient

from accounts.models import User
from accounts.tests.conftest import BROWSER, PASSWORD

ACCOUNT = "/_allauth/browser/v1/account/authenticators"
Post = Callable[..., Any]


def totp_code(secret: str) -> str:
    """Compute the current 6-digit TOTP code the way an authenticator app does."""
    key = base64.b32decode(secret.upper() + "=" * (-len(secret) % 8))
    counter = int(time.time()) // 30
    digest = hmac.new(key, struct.pack(">Q", counter), hashlib.sha1).digest()
    offset = digest[-1] & 15
    value = struct.unpack(">I", digest[offset : offset + 4])[0] & 0x7FFFFFFF
    return f"{value % 10**6:06d}"


def sign_in(api_post: Post, user: User) -> None:
    """Sign the user in with their password."""
    response = api_post("login", {"email": user.email, "password": PASSWORD})
    assert response.status_code == HTTPStatus.OK


def enable_totp(client: APIClient, api_post: Post) -> str:
    """Activate TOTP for the signed-in user and return the shared secret."""
    secret = str(client.get(f"{ACCOUNT}/totp").json()["meta"]["secret"])
    response = client.post(
        f"{ACCOUNT}/totp",
        {"code": totp_code(secret)},
        format="json",
        headers={"X-CSRFToken": client.cookies["csrftoken"].value},
    )
    assert response.status_code == HTTPStatus.OK
    return secret


@pytest.mark.django_db
class TestTotpSetup:
    """Tests for activating and removing an authenticator app."""

    def test_setup_info_contains_secret_and_otpauth_url(
        self,
        client: APIClient,
        user: User,
        api_post: Post,
    ) -> None:
        """Offers a secret and an otpauth URL naming the site, for the QR code."""
        sign_in(api_post, user)
        response = client.get(f"{ACCOUNT}/totp")
        meta = response.json()["meta"]
        assert response.status_code == HTTPStatus.NOT_FOUND
        assert meta["totp_url"].startswith("otpauth://totp/")
        assert "issuer=dj-next" in meta["totp_url"]
        assert meta["secret"]

    def test_wrong_code_does_not_activate(
        self,
        client: APIClient,
        user: User,
        api_post: Post,
    ) -> None:
        """Rejects an incorrect code during setup."""
        sign_in(api_post, user)
        response = client.post(
            f"{ACCOUNT}/totp",
            {"code": "000000"},
            format="json",
            headers={"X-CSRFToken": client.cookies["csrftoken"].value},
        )
        assert response.status_code == HTTPStatus.BAD_REQUEST
        assert client.get(ACCOUNT).json()["data"] == []

    def test_activation_creates_recovery_codes(
        self,
        client: APIClient,
        user: User,
        api_post: Post,
    ) -> None:
        """Activates TOTP and generates ten recovery codes."""
        sign_in(api_post, user)
        enable_totp(client, api_post)
        types = {a["type"] for a in client.get(ACCOUNT).json()["data"]}
        assert types == {"totp", "recovery_codes"}
        codes = client.get(f"{ACCOUNT}/recovery-codes").json()["data"]["unused_codes"]
        assert len(codes) == 10

    def test_deactivation_removes_everything(
        self,
        client: APIClient,
        user: User,
        api_post: Post,
    ) -> None:
        """Removes TOTP and the recovery codes, restoring plain sign-in."""
        sign_in(api_post, user)
        enable_totp(client, api_post)
        response = client.delete(
            f"{ACCOUNT}/totp",
            headers={"X-CSRFToken": client.cookies["csrftoken"].value},
        )
        assert response.status_code == HTTPStatus.OK
        assert client.get(ACCOUNT).json()["data"] == []

    def test_changing_mfa_after_a_while_requires_the_password(
        self,
        client: APIClient,
        user: User,
        api_post: Post,
    ) -> None:
        """Asks for reauthentication when the last sign-in is old, then allows it."""
        sign_in(api_post, user)
        secret = client.get(f"{ACCOUNT}/totp").json()["meta"]["secret"]
        later = time.time() + 3600
        with patch("time.time", return_value=later):
            stale = api_post_account(client, "totp", {"code": totp_code(secret)})
            flows = [f["id"] for f in stale.json()["data"]["flows"]]
            assert stale.status_code == HTTPStatus.UNAUTHORIZED
            assert "reauthenticate" in flows

            again = api_post("reauthenticate", {"password": PASSWORD})
            assert again.status_code == HTTPStatus.OK
            done = api_post_account(client, "totp", {"code": totp_code(secret)})
            assert done.status_code == HTTPStatus.OK


def api_post_account(client: APIClient, path: str, data: dict[str, str]) -> Any:  # ruff: ignore[any-type]
    """POST to an account/authenticators endpoint with the CSRF header."""
    return client.post(
        f"{ACCOUNT}/{path}",
        data,
        format="json",
        headers={"X-CSRFToken": client.cookies["csrftoken"].value},
    )


@pytest.mark.django_db
class TestMfaSignIn:
    """Tests for signing in once TOTP is enabled."""

    @pytest.fixture
    def secret(self, client: APIClient, user: User, api_post: Post) -> str:
        """Enable TOTP for the user, sign out, and return the secret."""
        sign_in(api_post, user)
        shared = enable_totp(client, api_post)
        client.delete(
            f"{BROWSER}/session",
            headers={"X-CSRFToken": client.cookies["csrftoken"].value},
        )
        return shared

    def test_password_alone_leaves_an_mfa_challenge(
        self,
        client: APIClient,
        user: User,
        api_post: Post,
        secret: str,
    ) -> None:
        """Answers a correct password with a pending code challenge, not a session."""
        response = api_post("login", {"email": user.email, "password": PASSWORD})
        flow = next(
            f for f in response.json()["data"]["flows"] if f["id"] == "mfa_authenticate"
        )
        assert response.status_code == HTTPStatus.UNAUTHORIZED
        assert flow["is_pending"] is True
        assert set(flow["types"]) == {"totp", "recovery_codes"}
        assert client.get(f"{BROWSER}/session").status_code == HTTPStatus.UNAUTHORIZED

    def test_correct_code_completes_sign_in(
        self,
        client: APIClient,
        user: User,
        api_post: Post,
        secret: str,
    ) -> None:
        """Signs in after the authenticator code."""
        api_post("login", {"email": user.email, "password": PASSWORD})
        response = api_post("2fa/authenticate", {"code": totp_code(secret)})
        assert response.status_code == HTTPStatus.OK
        assert client.get(f"{BROWSER}/session").status_code == HTTPStatus.OK

    def test_wrong_code_is_rejected(
        self,
        client: APIClient,
        user: User,
        api_post: Post,
        secret: str,
    ) -> None:
        """Rejects an incorrect code and stays signed out."""
        api_post("login", {"email": user.email, "password": PASSWORD})
        response = api_post("2fa/authenticate", {"code": "000000"})
        assert response.status_code == HTTPStatus.BAD_REQUEST
        assert client.get(f"{BROWSER}/session").status_code == HTTPStatus.UNAUTHORIZED

    def test_recovery_code_works_once(
        self,
        client: APIClient,
        user: User,
        api_post: Post,
        secret: str,
    ) -> None:
        """Lets a recovery code replace the app code, but only one time."""
        sign_in_code = totp_code(secret)
        api_post("login", {"email": user.email, "password": PASSWORD})
        api_post("2fa/authenticate", {"code": sign_in_code})
        codes = client.get(f"{ACCOUNT}/recovery-codes").json()["data"]["unused_codes"]
        client.delete(
            f"{BROWSER}/session",
            headers={"X-CSRFToken": client.cookies["csrftoken"].value},
        )

        api_post("login", {"email": user.email, "password": PASSWORD})
        first = api_post("2fa/authenticate", {"code": codes[0]})
        assert first.status_code == HTTPStatus.OK

        client.delete(
            f"{BROWSER}/session",
            headers={"X-CSRFToken": client.cookies["csrftoken"].value},
        )
        api_post("login", {"email": user.email, "password": PASSWORD})
        reused = api_post("2fa/authenticate", {"code": codes[0]})
        assert reused.status_code == HTTPStatus.BAD_REQUEST
