from unittest.mock import MagicMock

import pytest
from allauth.account.models import EmailAddress
from allauth.account.models import EmailAddress as SocialEmail
from allauth.socialaccount.models import SocialAccount, SocialLogin

from accounts.adapters import SocialAccountAdapter
from accounts.models import User

PASSWORD = "Str0ngPass!234"  # ruff: ignore[hardcoded-password-string]


def google_login(email: str, *, verified: bool) -> SocialLogin:
    """Build a Google sign-in that reports `email` with the given verification status."""
    login = SocialLogin(account=SocialAccount(provider="google", uid="g-1"))
    login.email_addresses = [SocialEmail(email=email, verified=verified, primary=True)]
    # The provider lookup is not needed for these decisions; stub it.
    login.provider = MagicMock(app=None, get_settings=dict)
    return login


@pytest.fixture
def adapter() -> SocialAccountAdapter:
    """Return the project's social account adapter."""
    return SocialAccountAdapter(MagicMock())


@pytest.mark.django_db
class TestSocialLinking:
    """Account linking happens only when both email addresses are verified."""

    def test_verified_google_email_links_to_a_verified_local_account(
        self,
        adapter: SocialAccountAdapter,
    ) -> None:
        """Matches an existing local account when both emails are verified."""
        user = User.objects.create_user(email="ada@example.com", password=PASSWORD)
        EmailAddress.objects.create(
            user=user, email=user.email, verified=True, primary=True
        )
        login = google_login("ada@example.com", verified=True)
        assert adapter.can_authenticate_by_email(login, "ada@example.com") is True

    def test_unverified_local_account_is_never_matched(
        self,
        adapter: SocialAccountAdapter,
    ) -> None:
        """Does not attach a Google sign-in to an account whose email is unverified."""
        user = User.objects.create_user(email="bob@example.com", password=PASSWORD)
        EmailAddress.objects.create(
            user=user, email=user.email, verified=False, primary=True
        )
        login = google_login("bob@example.com", verified=True)
        assert adapter.can_authenticate_by_email(login, "bob@example.com") is False

    def test_unverified_google_email_is_not_used_to_match(
        self,
        adapter: SocialAccountAdapter,
    ) -> None:
        """Ignores a Google address that Google has not verified."""
        user = User.objects.create_user(email="cy@example.com", password=PASSWORD)
        EmailAddress.objects.create(
            user=user, email=user.email, verified=True, primary=True
        )
        login = google_login("cy@example.com", verified=False)
        assert adapter.authenticate_by_email(login) is None

    def test_verified_google_email_matches_the_verified_account(
        self,
        adapter: SocialAccountAdapter,
    ) -> None:
        """Returns the existing user when both sides are verified."""
        user = User.objects.create_user(email="dee@example.com", password=PASSWORD)
        EmailAddress.objects.create(
            user=user, email=user.email, verified=True, primary=True
        )
        login = google_login("dee@example.com", verified=True)
        match = adapter.authenticate_by_email(login)
        assert match is not None
        assert match[0] == user

    def test_new_account_is_created_only_from_a_verified_email(
        self,
        adapter: SocialAccountAdapter,
    ) -> None:
        """Allows a Google sign-up with a verified address and refuses an unverified one."""
        request = MagicMock()
        assert (
            adapter.is_auto_signup_allowed(
                request, google_login("new@example.com", verified=True)
            )
            is True
        )
        assert (
            adapter.is_auto_signup_allowed(
                request, google_login("new@example.com", verified=False)
            )
            is False
        )
