import hmac
from collections.abc import Callable

from django.conf import settings
from django.http import HttpRequest, HttpResponseBase


class TrustedProxyMiddleware:
    """Use the public host and scheme that Next.js reports, but only from Next.js.

    django-allauth builds OAuth callback URLs from the request host, and behind the
    Next.js proxy that host is the internal one. Next.js sends the public host in
    X-Forwarded-Host and X-Forwarded-Proto, together with X-Proxy-Secret, a value only
    the Next.js server knows. Both headers are ignored unless the secret matches, so
    a client that reaches Django directly cannot change the host it is served under.
    """

    def __init__(self, get_response: Callable[[HttpRequest], HttpResponseBase]) -> None:
        """Store the next middleware or view in the chain."""
        self.get_response = get_response

    def __call__(self, request: HttpRequest) -> HttpResponseBase:
        """Apply the forwarded host when the request proves it came from Next.js.

        Args:
            request: The incoming request, possibly rewritten to the public host.

        Returns:
            The response from the rest of the middleware chain.

        """
        secret = settings.PROXY_SHARED_SECRET
        supplied = request.headers.get("X-Proxy-Secret", "")
        forwarded_host = request.headers.get("X-Forwarded-Host")
        if secret and forwarded_host and hmac.compare_digest(supplied, secret):
            request.META["HTTP_HOST"] = forwarded_host
            scheme = request.headers.get("X-Forwarded-Proto", "http")
            request.META["wsgi.url_scheme"] = "https" if scheme == "https" else "http"
        return self.get_response(request)
