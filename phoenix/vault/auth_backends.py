from django.conf import settings
from django.contrib.auth.backends import BaseBackend
from django.contrib.auth import get_user_model


class PortalLoginBackend(BaseBackend):
    def authenticate(self, request, portal_login=None, **kwargs):
        if not getattr(settings, "ALLOW_PASSWORDLESS_LOGIN", False):
            return None

        login_value = portal_login or kwargs.get("username") or kwargs.get("login")
        if not login_value:
            return None

        User = get_user_model()
        try:
            user = User.objects.get(portal_login=login_value, is_active=True)
        except User.DoesNotExist:
            return None

        allowed_roles = getattr(settings, "PASSWORDLESS_ROLES", ["employee"])
        if user.role not in allowed_roles:
            return None

        return user

    def get_user(self, user_id):
        User = get_user_model()
        try:
            return User.objects.get(pk=user_id)
        except User.DoesNotExist:
            return None
