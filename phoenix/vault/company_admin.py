from django.contrib import admin
from django.contrib.admin import AdminSite
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin

from .forms import UserChangeForm, UserCreationForm
from .models import AuditLog, Credential, Department, DepartmentShare, Service, ServiceAccess, User


class CompanyAdminSite(AdminSite):
    site_header = "Phoenix Admin"
    site_title = "Phoenix Admin"
    index_title = "Company Admin"

    def has_permission(self, request):
        user = request.user
        return bool(user and user.is_active and user.is_superuser)


class CompanyUserAdmin(DjangoUserAdmin):
    add_form = UserCreationForm
    form = UserChangeForm
    model = User
    ordering = ("portal_login",)
    list_display = ("portal_login", "full_name", "role", "is_active")
    list_filter = ("role", "is_active")
    search_fields = ("portal_login", "full_name", "email")
    filter_horizontal = ()

    fieldsets = (
        (None, {"fields": ("portal_login", "password")}),
        ("Profile", {"fields": ("full_name", "email")}),
        ("Access", {"fields": ("role", "is_active")}),
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
                    "password1",
                    "password2",
                ),
            },
        ),
    )


class CompanyAuditLogAdmin(admin.ModelAdmin):
    list_display = ("created_at", "actor", "action", "object_type", "object_id")
    list_filter = ("action", "object_type")
    search_fields = ("actor__portal_login", "object_id")
    readonly_fields = ("created_at", "actor", "action", "object_type", "object_id", "metadata")

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


company_admin_site = CompanyAdminSite(name="company_admin")
company_admin_site.register(User, CompanyUserAdmin)
company_admin_site.register(Department)
company_admin_site.register(Service)
company_admin_site.register(ServiceAccess)
company_admin_site.register(Credential)
company_admin_site.register(DepartmentShare)
company_admin_site.register(AuditLog, CompanyAuditLogAdmin)
