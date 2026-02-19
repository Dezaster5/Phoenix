from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import serializers

from .models import (
    AccessRequest,
    AuditLog,
    Credential,
    CredentialVersion,
    Department,
    DepartmentShare,
    Service,
    ServiceAccess,
)

User = get_user_model()


def _is_head_role(role):
    return role in (User.Role.HEAD, "admin")


class DepartmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Department
        fields = ("id", "name", "sort_order", "is_active")


class UserSerializer(serializers.ModelSerializer):
    department = DepartmentSerializer(read_only=True)

    class Meta:
        model = User
        fields = (
            "id",
            "portal_login",
            "full_name",
            "email",
            "role",
            "department",
            "is_active",
            "is_superuser",
        )
        read_only_fields = ("id", "is_superuser")


class UserWriteSerializer(serializers.ModelSerializer):
    password = serializers.CharField(required=False, allow_blank=True, write_only=True)
    department = DepartmentSerializer(read_only=True)
    department_id = serializers.PrimaryKeyRelatedField(
        queryset=Department.objects.filter(is_active=True),
        source="department",
        required=False,
        allow_null=True,
        write_only=True,
    )

    class Meta:
        model = User
        fields = (
            "id",
            "portal_login",
            "full_name",
            "email",
            "role",
            "department",
            "department_id",
            "is_active",
            "password",
        )
        read_only_fields = ("id",)

    def validate(self, attrs):
        request = self.context.get("request")
        actor = getattr(request, "user", None)
        instance = getattr(self, "instance", None)

        target_role = attrs.get("role", getattr(instance, "role", User.Role.EMPLOYEE))
        if target_role == "admin":
            target_role = User.Role.HEAD
            attrs["role"] = User.Role.HEAD
        target_department = attrs.get("department", getattr(instance, "department", None))

        if actor is None or not actor.is_authenticated:
            raise serializers.ValidationError("Authentication required.")

        if actor.is_superuser:
            target_is_superuser = getattr(instance, "is_superuser", False)
            if (
                not target_is_superuser
                and target_role in (User.Role.HEAD, User.Role.EMPLOYEE)
                and target_department is None
            ):
                raise serializers.ValidationError("department_id is required for department users.")
            return attrs

        if not _is_head_role(actor.role):
            raise serializers.ValidationError("Only department head or superuser can manage users.")

        if actor.department_id is None:
            raise serializers.ValidationError("Department head must have a department.")

        if instance is not None:
            if instance.is_superuser:
                raise serializers.ValidationError("Cannot modify superuser.")
            if instance.department_id != actor.department_id:
                raise serializers.ValidationError("You can manage only users from your department.")
            if instance.role != User.Role.EMPLOYEE:
                raise serializers.ValidationError("You can manage only employees.")

        if target_role != User.Role.EMPLOYEE:
            raise serializers.ValidationError("Department head can create only employees.")

        if target_department and target_department.id != actor.department_id:
            raise serializers.ValidationError("You can assign users only to your department.")

        attrs["department"] = actor.department
        return attrs

    def create(self, validated_data):
        password = validated_data.pop("password", None)
        return User.objects.create_user(password=password, **validated_data)

    def update(self, instance, validated_data):
        password = validated_data.pop("password", None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        if password is not None:
            if password:
                instance.set_password(password)
            else:
                instance.set_unusable_password()
        instance.save()
        return instance


class ServiceSerializer(serializers.ModelSerializer):
    department = DepartmentSerializer(read_only=True)
    department_id = serializers.PrimaryKeyRelatedField(
        queryset=Department.objects.filter(is_active=True),
        source="department",
        write_only=True,
        allow_null=True,
        required=False,
    )

    class Meta:
        model = Service
        fields = ("id", "name", "url", "department", "department_id", "is_active")


class CredentialReadSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    service = ServiceSerializer(read_only=True)
    latest_version = serializers.SerializerMethodField()

    class Meta:
        model = Credential
        fields = (
            "id",
            "user",
            "service",
            "login",
            "password",
            "notes",
            "is_active",
            "latest_version",
            "created_at",
            "updated_at",
        )

    def get_latest_version(self, obj):
        latest = obj.versions.order_by("-version").first()
        if not latest:
            return None
        return latest.version


class CredentialWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Credential
        fields = ("id", "user", "service", "login", "password", "notes", "is_active")


class ServiceAccessSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    user_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.filter(is_active=True), source="user", write_only=True
    )
    service = ServiceSerializer(read_only=True)
    service_id = serializers.PrimaryKeyRelatedField(
        queryset=Service.objects.filter(is_active=True), source="service", write_only=True
    )

    class Meta:
        model = ServiceAccess
        fields = ("id", "user", "user_id", "service", "service_id", "is_active", "created_at")
        read_only_fields = ("id", "created_at")


class DepartmentShareSerializer(serializers.ModelSerializer):
    department = DepartmentSerializer(read_only=True)
    department_id = serializers.PrimaryKeyRelatedField(
        queryset=Department.objects.filter(is_active=True),
        source="department",
        write_only=True,
        required=False,
        allow_null=True,
    )
    grantor = UserSerializer(read_only=True)
    grantor_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.filter(is_active=True),
        source="grantor",
        write_only=True,
        required=False,
    )
    grantee = UserSerializer(read_only=True)
    grantee_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.filter(is_active=True),
        source="grantee",
        write_only=True,
    )

    class Meta:
        model = DepartmentShare
        fields = (
            "id",
            "department",
            "department_id",
            "grantor",
            "grantor_id",
            "grantee",
            "grantee_id",
            "expires_at",
            "is_active",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")
        # Disable auto unique_together validator here because department/grantor
        # are filled server-side for department heads.
        validators = []

    def validate(self, attrs):
        request = self.context.get("request")
        actor = getattr(request, "user", None)
        instance = getattr(self, "instance", None)

        department = attrs.get("department", getattr(instance, "department", None))
        grantor = attrs.get("grantor", getattr(instance, "grantor", None))
        grantee = attrs.get("grantee", getattr(instance, "grantee", None))
        expires_at = attrs.get("expires_at", getattr(instance, "expires_at", None))

        if actor is None or not actor.is_authenticated:
            raise serializers.ValidationError("Authentication required.")

        if expires_at and expires_at <= timezone.now():
            raise serializers.ValidationError("expires_at must be in the future.")

        if actor.is_superuser:
            if department is None and instance is None:
                raise serializers.ValidationError("department_id is required.")
            if department is None and instance is not None:
                attrs["department"] = instance.department
                department = instance.department
            if grantor is None and instance is None:
                attrs["grantor"] = actor
                grantor = actor
            if grantor is None and instance is not None:
                attrs["grantor"] = instance.grantor
                grantor = instance.grantor
        else:
            if not _is_head_role(actor.role):
                raise serializers.ValidationError("Only department head or superuser can manage shares.")
            if actor.department_id is None:
                raise serializers.ValidationError("Department head must have a department.")
            if instance is None:
                if department and department.id != actor.department_id:
                    raise serializers.ValidationError("You can share only your own department.")
                attrs["department"] = actor.department
                attrs["grantor"] = actor
                department = actor.department
                grantor = actor
            else:
                if instance.department_id != actor.department_id:
                    raise serializers.ValidationError("You can modify only your own department shares.")
                attrs["department"] = instance.department
                attrs["grantor"] = instance.grantor
                department = instance.department
                grantor = instance.grantor

        if grantor and not grantor.is_superuser and not _is_head_role(grantor.role):
            raise serializers.ValidationError("grantor must be a department head.")
        if grantee and not grantee.is_superuser and not _is_head_role(grantee.role):
            raise serializers.ValidationError("grantee must be a department head.")
        if grantor and grantee and grantor.id == grantee.id:
            raise serializers.ValidationError("grantor and grantee must be different users.")
        if department and grantor and grantor.department_id != department.id and not grantor.is_superuser:
            raise serializers.ValidationError("grantor must belong to selected department.")

        return attrs


class AccessRequestReadSerializer(serializers.ModelSerializer):
    requester = UserSerializer(read_only=True)
    reviewer = UserSerializer(read_only=True)
    service = ServiceSerializer(read_only=True)

    class Meta:
        model = AccessRequest
        fields = (
            "id",
            "requester",
            "service",
            "status",
            "justification",
            "reviewer",
            "review_comment",
            "requested_at",
            "reviewed_at",
        )


class AccessRequestWriteSerializer(serializers.ModelSerializer):
    service_id = serializers.PrimaryKeyRelatedField(
        queryset=Service.objects.filter(is_active=True),
        source="service",
        write_only=True,
    )
    service = ServiceSerializer(read_only=True)

    class Meta:
        model = AccessRequest
        fields = (
            "id",
            "service",
            "service_id",
            "status",
            "justification",
            "requested_at",
            "reviewed_at",
        )
        read_only_fields = ("id", "status", "requested_at", "reviewed_at")

    def validate(self, attrs):
        request = self.context.get("request")
        actor = getattr(request, "user", None)
        service = attrs.get("service")
        if actor is None or not actor.is_authenticated:
            raise serializers.ValidationError("Authentication required.")
        if service is None:
            raise serializers.ValidationError("service_id is required.")
        if AccessRequest.objects.filter(
            requester=actor,
            service=service,
            status=AccessRequest.Status.PENDING,
        ).exists():
            raise serializers.ValidationError("You already have a pending request for this service.")
        return attrs


class AccessRequestReviewSerializer(serializers.ModelSerializer):
    class Meta:
        model = AccessRequest
        fields = ("status", "review_comment")

    def validate_status(self, value):
        if value not in (AccessRequest.Status.APPROVED, AccessRequest.Status.REJECTED):
            raise serializers.ValidationError("Status must be approved or rejected.")
        return value


class CredentialVersionSerializer(serializers.ModelSerializer):
    changed_by = UserSerializer(read_only=True)

    class Meta:
        model = CredentialVersion
        fields = (
            "id",
            "version",
            "login",
            "password",
            "notes",
            "is_active",
            "change_type",
            "changed_by",
            "created_at",
        )


class AuditLogSerializer(serializers.ModelSerializer):
    actor = UserSerializer(read_only=True)

    class Meta:
        model = AuditLog
        fields = (
            "id",
            "created_at",
            "actor",
            "action",
            "object_type",
            "object_id",
            "ip_address",
            "user_agent",
            "metadata",
        )
