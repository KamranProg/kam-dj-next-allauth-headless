from allauth.account.models import EmailAddress
from allauth.socialaccount.adapter import DefaultSocialAccountAdapter
from allauth.socialaccount.models import SocialLogin
from django.http import HttpRequest


class SocialAccountAdapter(DefaultSocialAccountAdapter):  # type: ignore[misc]
    """Only link a social sign-in to an existing account when both emails are verified.

    allauth already requires the social email to be verified (Google says so).
    This adds the other half: the local account's address must be verified too,
    so a sign-in never attaches to an account whose owner has not proved the email.
    """

    def can_authenticate_by_email(self, login: SocialLogin, email: str) -> bool:
        """Allow matching only against a verified local email address.

        Args:
            login: The social sign-in being matched.
            email: The verified email reported by the provider.

        Returns:
            True when allauth's own checks pass and a local address is verified.

        """
        allowed: bool = super().can_authenticate_by_email(login, email)
        if not allowed:
            return False
        return bool(
            EmailAddress.objects.filter(email__iexact=email, verified=True).exists()
        )

    def is_auto_signup_allowed(
        self, request: HttpRequest, sociallogin: SocialLogin
    ) -> bool:
        """Create accounts from social sign-ups only when the address is verified.

        Args:
            request: The current request.
            sociallogin: The social sign-in that would create the account.

        Returns:
            True when a verified address is present and allauth would allow signup.

        """
        if not any(e.verified for e in sociallogin.email_addresses):
            return False
        result = super().is_auto_signup_allowed(request, sociallogin)
        return bool(result)
