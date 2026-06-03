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
    IinRegistrationView,
    MeView,
    PasswordChangeView,
    PasswordResetConfirmView,
    PasswordResetRequestView,
    PublicDepartmentListView,
    PublicConfigView,
    PortalLoginView,
    RegistrationRequestView,
    RegistrationVerifyView,
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
    path("auth/register/", RegistrationRequestView.as_view(), name="registration-request"),
    path("auth/register/verify/", RegistrationVerifyView.as_view(), name="registration-verify"),
    path("auth/register-iin/", IinRegistrationView.as_view(), name="iin-registration"),
    path("auth/password-reset/request/", PasswordResetRequestView.as_view(), name="password-reset-request"),
    path("auth/password-reset/confirm/", PasswordResetConfirmView.as_view(), name="password-reset-confirm"),
    path("auth/password/change/", PasswordChangeView.as_view(), name="password-change"),
    path("config/public/", PublicConfigView.as_view(), name="public-config"),
    path("public/departments/", PublicDepartmentListView.as_view(), name="public-departments"),
    path("health/live/", HealthLiveView.as_view(), name="health-live"),
    path("health/ready/", HealthReadyView.as_view(), name="health-ready"),
    path("me/", MeView.as_view(), name="me"),
    path("", include(router.urls)),
]
