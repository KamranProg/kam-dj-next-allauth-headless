from collections.abc import Sequence

from django.urls import path
from drf_spectacular.utils import extend_schema, inline_serializer
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularRedocView,
    SpectacularSwaggerView,
)
from rest_framework import serializers
from rest_framework.authentication import BaseAuthentication
from rest_framework.permissions import BasePermission
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView


@extend_schema(
    responses=inline_serializer(
        name="HealthStatus",
        fields={"status": serializers.CharField()},
    ),
)
class HealthCheckView(APIView):
    authentication_classes: Sequence[type[BaseAuthentication]] = []
    permission_classes: Sequence[type[BasePermission]] = []

    def get(self, request: Request) -> Response:
        return Response({"status": "ok"})


urlpatterns = [
    path("health/", HealthCheckView.as_view(), name="health"),
    # Schema + Swagger UI
    path("schema/", SpectacularAPIView.as_view(), name="schema"),
    path("docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),
    # Authentication API (django-allauth headless) has its own OpenAPI spec.
    path(
        "docs/auth/",
        SpectacularSwaggerView.as_view(url="/_allauth/openapi.json"),
        name="swagger-ui-auth",
    ),
    path("redoc/", SpectacularRedocView.as_view(url_name="schema"), name="redoc"),
]
