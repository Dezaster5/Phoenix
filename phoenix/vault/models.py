from django.conf import settings
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models
from django.utils import timezone

from .encryption import decrypt_value, encrypt_value


class EncryptedTextField(models.TextField):
    def get_prep_value(self, value):
        value = super().get_prep_value(value)
        return encrypt_value(value) if value is not None else value

    def from_db_value(self, value, expression, connection):
        return decrypt_value(value) if value is not None else value

    def to_python(self, value):
        value = super().to_python(value)
        return decrypt_value(value) if value is not None else value


class UserManager(BaseUserManager):
    use_in_migrations = True

    def _create_user(self, portal_login, password, **extra_fields):
        if not portal_login:
            raise ValueError("The portal_login must be set")
        portal_login = self.model.normalize_username(portal_login)
        user = self.model(portal_login=portal_login, **extra_fields)
        if password:
            user.set_password(password)
        else:
            user.set_unusable_password()
        user.save(using=self._db)
        return user

    def create_user(self, portal_login, password=None, **extra_fields):
        extra_fields.setdefault("is_active", True)
        extra_fields.setdefault("is_staff", False)
        extra_fields.setdefault("is_superuser", False)
        return self._create_user(portal_login, password, **extra_fields)

    def create_superuser(self, portal_login, password, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("role", User.Role.HEAD)

        if extra_fields.get("is_staff") is not True:
            raise ValueError("Superuser must have is_staff=True")
        if extra_fields.get("is_superuser") is not True:
            raise ValueError("Superuser must have is_superuser=True")
        if not password:
            raise ValueError("Superuser must have a password")

        return self._create_user(portal_login, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    class Role(models.TextChoices):
        HEAD = "head", "Department Head"
        EMPLOYEE = "employee", "Employee"

    portal_login = models.CharField(max_length=64, unique=True)
    email = models.EmailField(blank=True)
    full_name = models.CharField(max_length=128, blank=True)
    role = models.CharField(max_length=16, choices=Role.choices, default=Role.EMPLOYEE)
    department = models.ForeignKey(
        "Department", on_delete=models.SET_NULL, null=True, blank=True, related_name="users"
    )
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    date_joined = models.DateTimeField(default=timezone.now)

    objects = UserManager()

    USERNAME_FIELD = "portal_login"
    REQUIRED_FIELDS = []
    EMAIL_FIELD = "email"

    def __str__(self):
        return self.portal_login

    @property
    def is_company_admin(self) -> bool:
        return self.is_superuser or self.role in (self.Role.HEAD, "admin")

    @property
    def is_department_head(self) -> bool:
        return self.role in (self.Role.HEAD, "admin")

    def get_full_name(self):
        return self.full_name or self.portal_login

    def get_short_name(self):
        return self.portal_login


class Department(models.Model):
    name = models.CharField(max_length=120, unique=True)
    sort_order = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["sort_order", "name"]

    def __str__(self):
        return self.name


class Service(models.Model):
    name = models.CharField(max_length=200)
    url = models.URLField(max_length=500)
    department = models.ForeignKey(
        Department, on_delete=models.SET_NULL, null=True, blank=True, related_name="services"
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]
        unique_together = ("name", "url")

    def __str__(self):
        return self.name


class ServiceAccess(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="service_accesses"
    )
    service = models.ForeignKey(Service, on_delete=models.CASCADE, related_name="accesses")
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("user", "service")
        ordering = ["service__name"]

    def __str__(self):
        return f"{self.user.portal_login} -> {self.service.name}"


class Credential(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="credentials")
    service = models.ForeignKey(Service, on_delete=models.CASCADE, related_name="credentials")
    login = models.CharField(max_length=255)
    password = EncryptedTextField()
    notes = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("user", "service")
        ordering = ["service__name"]

    def __str__(self):
        return f"{self.user.portal_login} -> {self.service.name}"


class AuditLog(models.Model):
    class Action(models.TextChoices):
        CREATE = "create", "Create"
        UPDATE = "update", "Update"
        VIEW = "view", "View"
        DISABLE = "disable", "Disable"
        ENABLE = "enable", "Enable"
        LOGIN = "login", "Login"

    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True
    )
    action = models.CharField(max_length=16, choices=Action.choices)
    object_type = models.CharField(max_length=64)
    object_id = models.CharField(max_length=64)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.action} {self.object_type} {self.object_id}"


class DepartmentShare(models.Model):
    department = models.ForeignKey(Department, on_delete=models.CASCADE, related_name="shares")
    grantor = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="granted_department_shares"
    )
    grantee = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="received_department_shares"
    )
    expires_at = models.DateTimeField()
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        unique_together = ("department", "grantor", "grantee")

    def __str__(self):
        return f"{self.grantor.portal_login} -> {self.grantee.portal_login} ({self.department.name})"
