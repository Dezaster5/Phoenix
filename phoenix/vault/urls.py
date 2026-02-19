from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    AccessRequestViewSet,
    AuditLogViewSet,
    CredentialViewSet,
    DepartmentShareViewSet,
    DepartmentViewSet,
    HealthLiveView,
    HealthReadyView,
    MeView,
    PortalLoginView,
    ServiceAccessViewSet,
    ServiceViewSet,
    UserViewSet,
)

router = DefaultRouter()
router.register("users", UserViewSet, basename="user")
router.register("departments", DepartmentViewSet, basename="department")
router.register("services", ServiceViewSet, basename="service")
router.register("accesses", ServiceAccessViewSet, basename="access")
router.register("credentials", CredentialViewSet, basename="credential")
router.register("department-shares", DepartmentShareViewSet, basename="department-share")
router.register("access-requests", AccessRequestViewSet, basename="access-request")
router.register("audit-logs", AuditLogViewSet, basename="audit-log")
    
urlpatterns = [
    path("auth/login/", PortalLoginView.as_view(), name="portal-login"),
    path("health/live/", HealthLiveView.as_view(), name="health-live"),
    path("health/ready/", HealthReadyView.as_view(), name="health-ready"),
    path("me/", MeView.as_view(), name="me"),
    path("", include(router.urls)),
]
