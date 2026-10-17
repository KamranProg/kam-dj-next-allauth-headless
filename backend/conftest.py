# backend/conftest.py

from typing import Any

from collections.abc import Iterator

import pytest
from django.core.cache import cache
from django.test import override_settings


def pytest_itemcollected(item: Any) -> None:
    """Override test display name with docstring."""
    doc = getattr(item.obj, "__doc__", None)
    if doc:
        item._nodeid = f"{item.parent.name}::{doc.strip()}"


@pytest.fixture(autouse=True)
def _in_memory_mail() -> Iterator[None]:
    """Send test emails to django.core.mail.outbox, never over SMTP."""
    mailers = {"default": {"BACKEND": "django.core.mail.backends.locmem.EmailBackend"}}
    with override_settings(MAILERS=mailers):
        yield


@pytest.fixture(autouse=True)
def _clear_cache() -> Iterator[None]:
    """Reset allauth's cache-based rate limits so tests do not affect each other."""
    cache.clear()
    yield
    cache.clear()
