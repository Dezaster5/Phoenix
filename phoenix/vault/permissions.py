from rest_framework.permissions import BasePermission, SAFE_METHODS


class IsCompanyAdmin(BasePermission):
    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and getattr(user, "is_company_admin", False))


class IsCompanyAdminOrReadOnly(BasePermission):
    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return bool(request.user and request.user.is_authenticated)
        user = request.user
        return bool(user and user.is_authenticated and getattr(user, "is_company_admin", False))
