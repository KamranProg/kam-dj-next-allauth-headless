from django.conf import LazySettings
from django.http import HttpRequest, HttpResponse
from django.test import RequestFactory

from accounts.middleware import TrustedProxyMiddleware

SECRET = "test-secret-value"  # ruff: ignore[hardcoded-password-string]


def seen_host(headers: dict[str, str]) -> str:
    """Return the host Django would use for a request with these headers."""
    captured: dict[str, str] = {}

    def view(request: HttpRequest) -> HttpResponse:
        captured["host"] = request.get_host()
        return HttpResponse()

    request = RequestFactory().get("/", headers=headers)
    TrustedProxyMiddleware(view)(request)
    return captured["host"]


def test_forwarded_host_is_used_with_the_shared_secret(settings: LazySettings) -> None:
    """Uses X-Forwarded-Host when the secret matches."""
    settings.PROXY_SHARED_SECRET = SECRET
    host = seen_host({"X-Proxy-Secret": SECRET, "X-Forwarded-Host": "localhost:3000"})
    assert host == "localhost:3000"


def test_forwarded_host_is_ignored_without_the_secret(settings: LazySettings) -> None:
    """Ignores X-Forwarded-Host from a client that does not know the secret."""
    settings.PROXY_SHARED_SECRET = SECRET
    assert seen_host({"X-Forwarded-Host": "evil.example"}) == "testserver"


def test_forwarded_host_is_ignored_with_a_wrong_secret(settings: LazySettings) -> None:
    """Ignores X-Forwarded-Host when the secret does not match."""
    settings.PROXY_SHARED_SECRET = SECRET
    host = seen_host({"X-Proxy-Secret": "guess", "X-Forwarded-Host": "evil.example"})
    assert host == "testserver"


def test_nothing_is_trusted_when_no_secret_is_configured(
    settings: LazySettings,
) -> None:
    """Keeps the real host when no secret is configured, even if the header is sent."""
    settings.PROXY_SHARED_SECRET = ""
    assert (
        seen_host({"X-Proxy-Secret": "", "X-Forwarded-Host": "evil.example"})
        == "testserver"
    )
