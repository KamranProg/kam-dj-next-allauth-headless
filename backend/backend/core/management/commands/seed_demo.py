from accounts.models import User
from allauth.account.models import EmailAddress
from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

DEMO_EMAIL = "demo@example.com"
DEMO_PASSWORD = "DemoPass123!"  # ruff: ignore[hardcoded-password-string]


class Command(BaseCommand):
    """Create a demo user for local development."""

    help = f"Creates the demo user {DEMO_EMAIL} (development only)."

    def handle(self, *args: object, **options: object) -> None:
        if not settings.DEBUG:
            msg = "seed_demo creates a user with a known password; it only runs with DEBUG=True."
            raise CommandError(msg)

        _, created = User.objects.get_or_create(
            email=DEMO_EMAIL, defaults={"username": DEMO_EMAIL}
        )
        user = User.objects.get(email=DEMO_EMAIL)
        user.set_password(DEMO_PASSWORD)
        user.save(update_fields=["password"])
        # Email verification is mandatory, so the demo user's address must be verified.
        EmailAddress.objects.update_or_create(
            user=user,
            email=DEMO_EMAIL,
            defaults={"verified": True, "primary": True},
        )

        action = "Created" if created else "Reset"
        self.stdout.write(
            self.style.SUCCESS(f"{action} demo user: {DEMO_EMAIL} / {DEMO_PASSWORD}")
        )
