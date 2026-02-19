from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin

from .forms import UserChangeForm, UserCreationForm
from .models import (
    AccessRequest,
    AuditLog,
    Credential,
    CredentialVersion,
    Department,
    DepartmentShare,
    LoginChallenge,
    Service,
    ServiceAccess,
    User,
)


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    add_form = UserCreationForm
    form = UserChangeForm
    model = User
    ordering = ("portal_login",)
    list_display = (
        "portal_login",
        "full_name",
        "department",
        "role",
        "is_active",
        "is_staff",
        "is_superuser",
    )
    list_filter = ("role", "department", "is_active", "is_staff", "is_superuser")
    search_fields = ("portal_login", "full_name", "email", "department__name")

    fieldsets = (
        (None, {"fields": ("portal_login", "password")}),
        ("Profile", {"fields": ("full_name", "email", "department")}),
        (
            "Permissions",
            {"fields": ("role", "is_active", "is_staff", "is_superuser", "groups", "user_permissions")},
        ),
        ("Important dates", {"fields": ("last_login", "date_joined")}),
    )

    add_fieldsets = (
        (
            None,
            {
                "classes": ("wide",),
                "fields": (
                    "portal_login",
                    "full_name",
                    "email",
                    "department",
                    "role",
                    "is_active",
                    "is_staff",
                    "is_superuser",
                    "password1",
                    "password2",
                ),
            },
        ),
    )


@admin.register(Department)
class DepartmentAdmin(admin.ModelAdmin):
    list_display = ("name", "sort_order", "is_active")
    list_filter = ("is_active",)
    search_fields = ("name",)


@admin.register(Service)
class ServiceAdmin(admin.ModelAdmin):
    list_display = ("name", "url", "department", "is_active")
    list_filter = ("is_active", "department")
    search_fields = ("name", "url")


@admin.register(Credential)
class CredentialAdmin(admin.ModelAdmin):
    list_display = ("service", "user", "login", "is_active", "updated_at")
    list_filter = ("is_active", "service", "user")
    search_fields = ("login", "service__name", "user__portal_login")
    list_select_related = ("service", "user")


@admin.register(ServiceAccess)
class ServiceAccessAdmin(admin.ModelAdmin):
    list_display = ("service", "user", "is_active", "updated_at")
    list_filter = ("is_active", "service")
    search_fields = ("service__name", "user__portal_login")
    list_select_related = ("service", "user")


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ("created_at", "actor", "action", "object_type", "object_id", "ip_address")
    list_filter = ("action", "object_type")
    search_fields = ("actor__portal_login", "object_id")
    readonly_fields = (
        "created_at",
        "actor",
        "action",
        "object_type",
        "object_id",
        "ip_address",
        "user_agent",
        "metadata",
    )


@admin.register(DepartmentShare)
class DepartmentShareAdmin(admin.ModelAdmin):
    list_display = ("department", "grantor", "grantee", "expires_at", "is_active", "created_at")
    list_filter = ("department", "is_active")
    search_fields = ("department__name", "grantor__portal_login", "grantee__portal_login")


@admin.register(AccessRequest)
class AccessRequestAdmin(admin.ModelAdmin):
    list_display = ("requester", "service", "status", "reviewer", "requested_at", "reviewed_at")
    list_filter = ("status", "service")
    search_fields = ("requester__portal_login", "service__name", "reviewer__portal_login")


@admin.register(CredentialVersion)
class CredentialVersionAdmin(admin.ModelAdmin):
    list_display = ("credential", "version", "change_type", "changed_by", "created_at")
    list_filter = ("change_type",)
    search_fields = ("credential__user__portal_login", "credential__service__name", "changed_by__portal_login")
    readonly_fields = ("credential", "version", "created_at", "changed_by")

    def has_add_permission(self, request):
        return False


@admin.register(LoginChallenge)
class LoginChallengeAdmin(admin.ModelAdmin):
    list_display = ("user", "channel", "expires_at", "consumed_at", "attempts", "created_at")
    list_filter = ("channel",)
    search_fields = ("user__portal_login", "ip_address")
    readonly_fields = (
        "user",
        "channel",
        "code_digest",
        "magic_token_digest",
        "salt",
        "expires_at",
        "consumed_at",
        "attempts",
        "max_attempts",
        "ip_address",
        "user_agent",
        "created_at",
    )

    def has_add_permission(self, request):
        return False
