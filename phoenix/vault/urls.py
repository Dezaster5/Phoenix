from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    CredentialViewSet,
    DepartmentShareViewSet,
    DepartmentViewSet,
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
    
urlpatterns = [
    path("auth/login/", PortalLoginView.as_view(), name="portal-login"),
    path("me/", MeView.as_view(), name="me"),
    path("", include(router.urls)),
]
