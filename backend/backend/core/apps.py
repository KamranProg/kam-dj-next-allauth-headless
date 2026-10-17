from django.apps import AppConfig, apps
from django.conf import settings
from django.db.models.signals import post_migrate


def sync_site(**kwargs: object) -> None:  # ruff: ignore[unused-function-argument]
    """Point the default Site at this project so emails are not signed 'example.com'."""
    from django.contrib.sites.models import Site  # ruff: ignore[import-outside-top-level]

    Site.objects.update_or_create(
        pk=settings.SITE_ID,
        defaults={"domain": settings.SITE_DOMAIN, "name": settings.SITE_NAME},
    )


class CoreConfig(AppConfig):
    """Configuration for the Core app."""

    default_auto_field = "django.db.models.BigAutoField"
    name = "core"

    def ready(self) -> None:  # ruff: ignore[no-self-use]
        """Keep the Site record in sync with settings after migrations."""
        post_migrate.connect(sync_site, sender=apps.get_app_config("sites"))
