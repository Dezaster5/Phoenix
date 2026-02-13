from django.contrib.auth import authenticate, get_user_model
from django.db.models import Q
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.authtoken.models import Token
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import AuditLog, Credential, Department, DepartmentShare, Service, ServiceAccess
from .serializers import (
    CredentialReadSerializer,
    CredentialWriteSerializer,
    DepartmentSerializer,
    DepartmentShareSerializer,
    ServiceAccessSerializer,
    ServiceSerializer,
    UserSerializer,
    UserWriteSerializer,
)

User = get_user_model()


def log_action(actor, action, obj, metadata=None):
    AuditLog.objects.create(
        actor=actor,
        action=action,
        object_type=obj.__class__.__name__,
        object_id=str(obj.pk),
        metadata=metadata or {},
    )


def _is_superuser(user):
    return bool(user and user.is_authenticated and user.is_superuser)


def _is_department_head(user):
    return bool(user and user.is_authenticated and user.role in (User.Role.HEAD, "admin"))


def _shared_department_ids_for(user):
    if not user.is_authenticated:
        return []
    now = timezone.now()
    return list(
        DepartmentShare.objects.filter(
            grantee=user,
            is_active=True,
            expires_at__gt=now,
        ).values_list("department_id", flat=True)
    )


def _head_visible_department_ids(user):
    ids = set(_shared_department_ids_for(user))
    if user.department_id:
        ids.add(user.department_id)
    return ids


class PortalLoginView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        portal_login = str(request.data.get("portal_login", "")).strip()
        password = request.data.get("password")

        if not portal_login:
            return Response({"detail": "portal_login is required"}, status=status.HTTP_400_BAD_REQUEST)

        if password:
            user = authenticate(request, username=portal_login, password=password)
        else:
            user = authenticate(request, portal_login=portal_login)

        if user is None:
            return Response({"detail": "invalid credentials"}, status=status.HTTP_400_BAD_REQUEST)

        token, _ = Token.objects.get_or_create(user=user)
        AuditLog.objects.create(
            actor=user,
            action=AuditLog.Action.LOGIN,
            object_type="User",
            object_id=str(user.pk),
            metadata={"portal_login": user.portal_login},
        )
        return Response(
            {
                "token": token.key,
                "portal_login": user.portal_login,
                "role": user.role,
                "is_superuser": user.is_superuser,
                "full_name": user.full_name,
                "department": (
                    {"id": user.department_id, "name": user.department.name}
                    if user.department_id
                    else None
                ),
            }
        )


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        serializer = UserSerializer(request.user)
        return Response(serializer.data)


class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.select_related("department")
    permission_classes = [IsAuthenticated]

    def _ensure_can_manage_users(self):
        user = self.request.user
        if _is_superuser(user) or _is_department_head(user):
            return
        raise PermissionDenied("Only superuser or department head can manage users.")

    def get_serializer_class(self):
        if self.action in ("list", "retrieve"):
            return UserSerializer
        return UserWriteSerializer

    def get_queryset(self):
        user = self.request.user
        if _is_superuser(user):
            return User.objects.select_related("department")
        if _is_department_head(user):
            visible_department_ids = _head_visible_department_ids(user)
            return User.objects.select_related("department").filter(
                Q(department_id__in=visible_department_ids) | Q(role__in=[User.Role.HEAD, "admin"])
            ).distinct()
        return User.objects.none()

    def list(self, request, *args, **kwargs):
        self._ensure_can_manage_users()
        return super().list(request, *args, **kwargs)

    def retrieve(self, request, *args, **kwargs):
        self._ensure_can_manage_users()
        return super().retrieve(request, *args, **kwargs)

    def perform_create(self, serializer):
        self._ensure_can_manage_users()
        user = serializer.save()
        log_action(self.request.user, AuditLog.Action.CREATE, user)

    def perform_update(self, serializer):
        self._ensure_can_manage_users()
        target = self.get_object()
        actor = self.request.user
        if _is_department_head(actor):
            if target.is_superuser or target.role != User.Role.EMPLOYEE:
                raise PermissionDenied("Department head can update only employees.")
            if target.department_id != actor.department_id:
                raise PermissionDenied("You can update only your department users.")
        user = serializer.save()
        log_action(self.request.user, AuditLog.Action.UPDATE, user)

    def destroy(self, request, *args, **kwargs):
        self._ensure_can_manage_users()
        target = self.get_object()
        actor = request.user
        if _is_department_head(actor):
            if target.is_superuser or target.role != User.Role.EMPLOYEE:
                raise PermissionDenied("Department head can disable only employees.")
            if target.department_id != actor.department_id:
                raise PermissionDenied("You can disable only your department users.")

        target.is_active = False
        target.save(update_fields=["is_active"])
        log_action(request.user, AuditLog.Action.DISABLE, target)
        return Response(status=status.HTTP_204_NO_CONTENT)


class DepartmentViewSet(viewsets.ModelViewSet):
    serializer_class = DepartmentSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        qs = Department.objects.all()
        if _is_superuser(user):
            return qs
        if _is_department_head(user):
            return qs.filter(id__in=_head_visible_department_ids(user))
        if user.department_id:
            return qs.filter(id=user.department_id)
        return qs.none()

    def _ensure_superuser_write(self):
        if not _is_superuser(self.request.user):
            raise PermissionDenied("Only superuser can create/update/delete departments.")

    def perform_create(self, serializer):
        self._ensure_superuser_write()
        department = serializer.save()
        log_action(self.request.user, AuditLog.Action.CREATE, department)

    def perform_update(self, serializer):
        self._ensure_superuser_write()
        department = serializer.save()
        log_action(self.request.user, AuditLog.Action.UPDATE, department)

    def destroy(self, request, *args, **kwargs):
        self._ensure_superuser_write()
        instance = self.get_object()
        instance.is_active = False
        instance.save(update_fields=["is_active"])
        log_action(request.user, AuditLog.Action.DISABLE, instance)
        return Response(status=status.HTTP_204_NO_CONTENT)


class ServiceViewSet(viewsets.ModelViewSet):
    serializer_class = ServiceSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        qs = Service.objects.select_related("department")
        if _is_superuser(user):
            return qs
        if _is_department_head(user):
            visible_department_ids = _head_visible_department_ids(user)
            return qs.filter(Q(is_active=True) | Q(department_id__in=visible_department_ids)).distinct()
        return qs.filter(accesses__user=user, accesses__is_active=True, is_active=True).distinct()

    def _ensure_service_write_allowed(self, service=None):
        user = self.request.user
        if _is_superuser(user):
            return
        if not _is_department_head(user):
            raise PermissionDenied("Only superuser or department head can change services.")
        if user.department_id is None:
            raise PermissionDenied("Department head must have a department.")
        if service is not None and service.department_id != user.department_id:
            raise PermissionDenied("You can change only your department services.")

    def perform_create(self, serializer):
        self._ensure_service_write_allowed()
        department = serializer.validated_data.get("department")
        user = self.request.user
        if not _is_superuser(user):
            if department and department.id != user.department_id:
                raise ValidationError("You can create services only in your department.")
            service = serializer.save(department=user.department)
        else:
            service = serializer.save()
        log_action(self.request.user, AuditLog.Action.CREATE, service)

    def perform_update(self, serializer):
        service = self.get_object()
        self._ensure_service_write_allowed(service=service)
        if not _is_superuser(self.request.user):
            requested_department = serializer.validated_data.get("department")
            if requested_department and requested_department.id != self.request.user.department_id:
                raise ValidationError("You can keep service only in your department.")
        service = serializer.save()
        log_action(self.request.user, AuditLog.Action.UPDATE, service)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        self._ensure_service_write_allowed(service=instance)
        instance.is_active = False
        instance.save(update_fields=["is_active"])
        log_action(request.user, AuditLog.Action.DISABLE, instance)
        return Response(status=status.HTTP_204_NO_CONTENT)


class CredentialViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        qs = Credential.objects.select_related("user", "service", "service__department", "user__department")
        if _is_superuser(user):
            return qs
        if _is_department_head(user):
            return qs.filter(user__department_id__in=_head_visible_department_ids(user))
        return (
            qs.filter(
                user=user,
                is_active=True,
                service__is_active=True,
                service__accesses__user=user,
                service__accesses__is_active=True,
            )
            .distinct()
        )

    def get_serializer_class(self):
        if self.action in ("list", "retrieve"):
            return CredentialReadSerializer
        return CredentialWriteSerializer

    def _ensure_credential_write_allowed(self, credential=None):
        user = self.request.user
        if _is_superuser(user):
            return
        if not _is_department_head(user):
            raise PermissionDenied("Only superuser or department head can modify credentials.")
        if user.department_id is None:
            raise PermissionDenied("Department head must have a department.")
        if credential and credential.user.department_id != user.department_id:
            raise PermissionDenied("You can modify only your department credentials.")

    def perform_create(self, serializer):
        self._ensure_credential_write_allowed()
        user = self.request.user
        target_user = serializer.validated_data["user"]
        if not _is_superuser(user) and target_user.department_id != user.department_id:
            raise ValidationError("You can assign credentials only to your department users.")
        credential = serializer.save()
        log_action(self.request.user, AuditLog.Action.CREATE, credential)

    def perform_update(self, serializer):
        credential = self.get_object()
        self._ensure_credential_write_allowed(credential=credential)
        target_user = serializer.validated_data.get("user", credential.user)
        actor = self.request.user
        if not _is_superuser(actor) and target_user.department_id != actor.department_id:
            raise ValidationError("You can assign credentials only to your department users.")
        credential = serializer.save()
        log_action(self.request.user, AuditLog.Action.UPDATE, credential)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        self._ensure_credential_write_allowed(credential=instance)
        instance.is_active = False
        instance.save(update_fields=["is_active"])
        log_action(request.user, AuditLog.Action.DISABLE, instance)
        return Response(status=status.HTTP_204_NO_CONTENT)

    def list(self, request, *args, **kwargs):
        response = super().list(request, *args, **kwargs)
        if isinstance(response.data, list):
            count = len(response.data)
        else:
            count = response.data.get("count") if isinstance(response.data, dict) else None
        AuditLog.objects.create(
            actor=request.user,
            action=AuditLog.Action.VIEW,
            object_type="Credential",
            object_id="list",
            metadata={"count": count},
        )
        return response


class ServiceAccessViewSet(viewsets.ModelViewSet):
    serializer_class = ServiceAccessSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        qs = ServiceAccess.objects.select_related("user", "service", "service__department", "user__department")
        if _is_superuser(user):
            return qs
        if _is_department_head(user):
            return qs.filter(user__department_id__in=_head_visible_department_ids(user))
        return qs.filter(user=user, is_active=True, service__is_active=True)

    def _ensure_access_write_allowed(self, access=None):
        user = self.request.user
        if _is_superuser(user):
            return
        if not _is_department_head(user):
            raise PermissionDenied("Only superuser or department head can modify access rules.")
        if user.department_id is None:
            raise PermissionDenied("Department head must have a department.")
        if access and access.user.department_id != user.department_id:
            raise PermissionDenied("You can modify only your department users.")

    def perform_create(self, serializer):
        self._ensure_access_write_allowed()
        actor = self.request.user
        target_user = serializer.validated_data["user"]
        if not _is_superuser(actor) and target_user.department_id != actor.department_id:
            raise ValidationError("You can assign access only to your department users.")
        access = serializer.save()
        log_action(self.request.user, AuditLog.Action.CREATE, access)

    def perform_update(self, serializer):
        access = self.get_object()
        self._ensure_access_write_allowed(access=access)
        actor = self.request.user
        target_user = serializer.validated_data.get("user", access.user)
        if not _is_superuser(actor) and target_user.department_id != actor.department_id:
            raise ValidationError("You can assign access only to your department users.")
        access = serializer.save()
        log_action(self.request.user, AuditLog.Action.UPDATE, access)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        self._ensure_access_write_allowed(access=instance)
        instance.is_active = False
        instance.save(update_fields=["is_active"])
        log_action(request.user, AuditLog.Action.DISABLE, instance)
        return Response(status=status.HTTP_204_NO_CONTENT)

    def retrieve(self, request, *args, **kwargs):
        response = super().retrieve(request, *args, **kwargs)
        instance = self.get_object()
        log_action(request.user, AuditLog.Action.VIEW, instance)
        return response


class DepartmentShareViewSet(viewsets.ModelViewSet):
    serializer_class = DepartmentShareSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        qs = DepartmentShare.objects.select_related("department", "grantor", "grantee")
        if _is_superuser(user):
            return qs
        if _is_department_head(user):
            return qs.filter(Q(department_id=user.department_id) | Q(grantee=user))
        return qs.none()

    def _ensure_share_read_allowed(self):
        user = self.request.user
        if not (_is_superuser(user) or _is_department_head(user)):
            raise PermissionDenied("Only superuser or department head can view share rules.")

    def _ensure_share_write_allowed(self, instance=None):
        user = self.request.user
        if _is_superuser(user):
            return
        if not _is_department_head(user):
            raise PermissionDenied("Only superuser or department head can modify share rules.")
        if instance and instance.department_id != user.department_id:
            raise PermissionDenied("You can modify only shares for your own department.")

    def list(self, request, *args, **kwargs):
        self._ensure_share_read_allowed()
        return super().list(request, *args, **kwargs)

    def retrieve(self, request, *args, **kwargs):
        self._ensure_share_read_allowed()
        return super().retrieve(request, *args, **kwargs)

    def perform_create(self, serializer):
        self._ensure_share_write_allowed()
        data = serializer.validated_data
        share, created = DepartmentShare.objects.update_or_create(
            department=data["department"],
            grantor=data["grantor"],
            grantee=data["grantee"],
            defaults={
                "expires_at": data["expires_at"],
                "is_active": data.get("is_active", True),
            },
        )
        serializer.instance = share
        log_action(
            self.request.user,
            AuditLog.Action.CREATE if created else AuditLog.Action.UPDATE,
            share,
            metadata={"upsert": True},
        )

    def perform_update(self, serializer):
        instance = self.get_object()
        self._ensure_share_write_allowed(instance=instance)
        share = serializer.save()
        log_action(self.request.user, AuditLog.Action.UPDATE, share)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        self._ensure_share_write_allowed(instance=instance)
        instance.is_active = False
        instance.save(update_fields=["is_active"])
        log_action(request.user, AuditLog.Action.DISABLE, instance)
        return Response(status=status.HTTP_204_NO_CONTENT)
