from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin

from .forms import UserChangeForm, UserCreationForm
from .models import AuditLog, Category, Credential, Service, ServiceAccess, User


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    add_form = UserCreationForm
    form = UserChangeForm
    model = User
    ordering = ("portal_login",)
    list_display = ("portal_login", "full_name", "role", "is_active", "is_staff", "is_superuser")
    list_filter = ("role", "is_active", "is_staff", "is_superuser")
    search_fields = ("portal_login", "full_name", "email")

    fieldsets = (
        (None, {"fields": ("portal_login", "password")}),
        ("Profile", {"fields": ("full_name", "email")}),
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


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ("name", "sort_order", "is_active")
    list_filter = ("is_active",)
    search_fields = ("name",)


@admin.register(Service)
class ServiceAdmin(admin.ModelAdmin):
    list_display = ("name", "url", "category", "is_active")
    list_filter = ("is_active", "category")
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
    list_display = ("created_at", "actor", "action", "object_type", "object_id")
    list_filter = ("action", "object_type")
    search_fields = ("actor__portal_login", "object_id")
    readonly_fields = ("created_at",)
