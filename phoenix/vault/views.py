from urllib.parse import urlencode

from django.conf import settings
from django.contrib.auth import authenticate, get_user_model
from django.db import connection
from django.db.models import Max, Q
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.authtoken.models import Token
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

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
from .notifications import send_platform_email
from .security import generate_login_challenge, get_client_ip, get_user_agent, verify_login_challenge
from .serializers import (
    AccessRequestReadSerializer,
    AccessRequestReviewSerializer,
    AccessRequestWriteSerializer,
    AuditLogSerializer,
    CredentialReadSerializer,
    CredentialVersionSerializer,
    CredentialWriteSerializer,
    DepartmentSerializer,
    DepartmentShareSerializer,
    ServiceAccessSerializer,
    ServiceSerializer,
    UserSerializer,
    UserWriteSerializer,
)
from .throttling import AccessRequestCreateThrottle, LoginBurstThrottle, LoginSustainedThrottle

User = get_user_model()


def log_action(
    actor,
    action,
    obj=None,
    metadata=None,
    request=None,
    object_type=None,
    object_id=None,
):
    if obj is not None:
        object_type = obj.__class__.__name__
        object_id = str(obj.pk)
    if not object_type or object_id is None:
        raise ValueError("object_type/object_id required when obj is None")

    AuditLog.objects.create(
        actor=actor,
        action=action,
        object_type=object_type,
        object_id=str(object_id),
        ip_address=get_client_ip(request) if request else None,
        user_agent=get_user_agent(request) if request else "",
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


def _build_auth_payload(user, token_key):
    return {
        "token": token_key,
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


def _record_credential_version(credential, changed_by=None, change_type=CredentialVersion.ChangeType.UPDATE):
    max_version = (
        CredentialVersion.objects.filter(credential=credential).aggregate(max_v=Max("version"))["max_v"]
        or 0
    )
    return CredentialVersion.objects.create(
        credential=credential,
        version=max_version + 1,
        login=credential.login,
        password=credential.password,
        notes=credential.notes,
        is_active=credential.is_active,
        change_type=change_type,
        changed_by=changed_by,
    )


def _reviewer_emails_for_request(access_request):
    department_id = access_request.requester.department_id
    reviewers = User.objects.filter(is_active=True).filter(
        Q(is_superuser=True) | Q(role=User.Role.HEAD, department_id=department_id)
    )
    return [u.email for u in reviewers if u.email]


class PortalLoginView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [LoginBurstThrottle, LoginSustainedThrottle]

    def post(self, request):
        portal_login = str(request.data.get("portal_login", "")).strip()
        password = request.data.get("password")
        code = request.data.get("code")
        magic_token = request.data.get("magic_token")

        if not portal_login:
            return Response({"detail": "portal_login is required"}, status=status.HTTP_400_BAD_REQUEST)

        if password:
            user = authenticate(request, username=portal_login, password=password)
        else:
            user = authenticate(request, portal_login=portal_login)

        if user is None:
            return Response({"detail": "invalid credentials"}, status=status.HTTP_400_BAD_REQUEST)

        challenge_enabled = bool(getattr(settings, "LOGIN_CHALLENGE_ENABLED", False)) and not password
        if challenge_enabled:
            if not code and not magic_token:
                challenge, one_time_code, one_time_token = generate_login_challenge(user, request=request)
                frontend_base_url = getattr(settings, "FRONTEND_BASE_URL", "").strip().rstrip("/")
                magic_link = ""
                if frontend_base_url:
                    query = urlencode({"portal_login": user.portal_login, "magic_token": one_time_token})
                    magic_link = f"{frontend_base_url}/?{query}"

                email_body_lines = [
                    "Для входа в Phoenix Vault используйте одноразовый код:",
                    "",
                    f"Код: {one_time_code}",
                    "",
                    f"Код действителен до: {challenge.expires_at.isoformat()}",
                ]
                if magic_link:
                    email_body_lines.extend(["", f"Или войдите по ссылке: {magic_link}"])

                if user.email:
                    send_platform_email(
                        subject="Phoenix Vault: одноразовый код входа",
                        body="\n".join(email_body_lines),
                        recipients=[user.email],
                    )

                response_payload = {
                    "detail": "challenge sent",
                    "challenge_required": True,
                    "channel": "email",
                    "expires_at": challenge.expires_at,
                }
                if settings.DEBUG:
                    response_payload["debug_code"] = one_time_code
                    response_payload["debug_magic_token"] = one_time_token
                return Response(response_payload, status=status.HTTP_202_ACCEPTED)

            valid, result = verify_login_challenge(user, code=code, magic_token=magic_token)
            if not valid:
                return Response({"detail": result}, status=status.HTTP_400_BAD_REQUEST)

        token, _ = Token.objects.get_or_create(user=user)
        log_action(
            actor=user,
            action=AuditLog.Action.LOGIN,
            object_type="User",
            object_id=str(user.pk),
            metadata={"portal_login": user.portal_login, "challenge": challenge_enabled},
            request=request,
        )
        return Response(_build_auth_payload(user, token.key))


class HealthLiveView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        return Response({"status": "ok", "service": "phoenix-api"})


class HealthReadyView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
                cursor.fetchone()
        except Exception:
            return Response({"status": "degraded", "database": "down"}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        return Response({"status": "ok", "database": "up"})


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
        log_action(self.request.user, AuditLog.Action.CREATE, user, request=self.request)

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
        log_action(self.request.user, AuditLog.Action.UPDATE, user, request=self.request)

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
        log_action(request.user, AuditLog.Action.DISABLE, target, request=request)
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
        log_action(self.request.user, AuditLog.Action.CREATE, department, request=self.request)

    def perform_update(self, serializer):
        self._ensure_superuser_write()
        department = serializer.save()
        log_action(self.request.user, AuditLog.Action.UPDATE, department, request=self.request)

    def destroy(self, request, *args, **kwargs):
        self._ensure_superuser_write()
        instance = self.get_object()
        instance.is_active = False
        instance.save(update_fields=["is_active"])
        log_action(request.user, AuditLog.Action.DISABLE, instance, request=request)
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
        return qs.filter(is_active=True)

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
        log_action(self.request.user, AuditLog.Action.CREATE, service, request=self.request)

    def perform_update(self, serializer):
        service = self.get_object()
        self._ensure_service_write_allowed(service=service)
        if not _is_superuser(self.request.user):
            requested_department = serializer.validated_data.get("department")
            if requested_department and requested_department.id != self.request.user.department_id:
                raise ValidationError("You can keep service only in your department.")
        service = serializer.save()
        log_action(self.request.user, AuditLog.Action.UPDATE, service, request=self.request)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        self._ensure_service_write_allowed(service=instance)
        instance.is_active = False
        instance.save(update_fields=["is_active"])
        log_action(request.user, AuditLog.Action.DISABLE, instance, request=request)
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
        ServiceAccess.objects.update_or_create(
            user=credential.user,
            service=credential.service,
            defaults={"is_active": credential.is_active},
        )
        _record_credential_version(
            credential,
            changed_by=self.request.user,
            change_type=CredentialVersion.ChangeType.CREATE,
        )
        if credential.user.email:
            send_platform_email(
                subject="Phoenix Vault: доступ выдан",
                body=(
                    f"Для сервиса '{credential.service.name}' вам выданы учетные данные. "
                    "Войдите в Phoenix Vault, чтобы посмотреть данные."
                ),
                recipients=[credential.user.email],
            )
        log_action(self.request.user, AuditLog.Action.CREATE, credential, request=self.request)

    def perform_update(self, serializer):
        credential = self.get_object()
        self._ensure_credential_write_allowed(credential=credential)
        target_user = serializer.validated_data.get("user", credential.user)
        actor = self.request.user
        if not _is_superuser(actor) and target_user.department_id != actor.department_id:
            raise ValidationError("You can assign credentials only to your department users.")
        credential = serializer.save()
        ServiceAccess.objects.update_or_create(
            user=credential.user,
            service=credential.service,
            defaults={"is_active": credential.is_active},
        )
        _record_credential_version(
            credential,
            changed_by=self.request.user,
            change_type=CredentialVersion.ChangeType.UPDATE,
        )
        if credential.user.email:
            send_platform_email(
                subject="Phoenix Vault: учетные данные обновлены",
                body=(
                    f"Для сервиса '{credential.service.name}' ваши учетные данные обновлены."
                ),
                recipients=[credential.user.email],
            )
        log_action(self.request.user, AuditLog.Action.UPDATE, credential, request=self.request)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        self._ensure_credential_write_allowed(credential=instance)
        instance.is_active = False
        instance.save(update_fields=["is_active"])
        ServiceAccess.objects.filter(user=instance.user, service=instance.service).update(is_active=False)
        _record_credential_version(
            instance,
            changed_by=request.user,
            change_type=CredentialVersion.ChangeType.DISABLE,
        )
        if instance.user.email:
            send_platform_email(
                subject="Phoenix Vault: доступ отключен",
                body=(f"Доступ к сервису '{instance.service.name}' был отключен."),
                recipients=[instance.user.email],
            )
        log_action(request.user, AuditLog.Action.DISABLE, instance, request=request)
        return Response(status=status.HTTP_204_NO_CONTENT)

    def list(self, request, *args, **kwargs):
        response = super().list(request, *args, **kwargs)
        if isinstance(response.data, list):
            count = len(response.data)
        else:
            count = response.data.get("count") if isinstance(response.data, dict) else None
        log_action(
            actor=request.user,
            action=AuditLog.Action.VIEW,
            object_type="Credential",
            object_id="list",
            metadata={"count": count},
            request=request,
        )
        return response

    @action(detail=True, methods=["get"], permission_classes=[IsAuthenticated])
    def versions(self, request, pk=None):
        credential = self.get_object()
        versions = credential.versions.select_related("changed_by").all()
        serializer = CredentialVersionSerializer(versions, many=True)
        log_action(
            actor=request.user,
            action=AuditLog.Action.VIEW,
            object_type="CredentialVersion",
            object_id=f"credential:{credential.pk}",
            metadata={"count": versions.count()},
            request=request,
        )
        return Response(serializer.data)


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
        log_action(self.request.user, AuditLog.Action.CREATE, access, request=self.request)

    def perform_update(self, serializer):
        access = self.get_object()
        self._ensure_access_write_allowed(access=access)
        actor = self.request.user
        target_user = serializer.validated_data.get("user", access.user)
        if not _is_superuser(actor) and target_user.department_id != actor.department_id:
            raise ValidationError("You can assign access only to your department users.")
        access = serializer.save()
        log_action(self.request.user, AuditLog.Action.UPDATE, access, request=self.request)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        self._ensure_access_write_allowed(access=instance)
        instance.is_active = False
        instance.save(update_fields=["is_active"])
        log_action(request.user, AuditLog.Action.DISABLE, instance, request=request)
        return Response(status=status.HTTP_204_NO_CONTENT)

    def retrieve(self, request, *args, **kwargs):
        response = super().retrieve(request, *args, **kwargs)
        instance = self.get_object()
        log_action(request.user, AuditLog.Action.VIEW, instance, request=request)
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
            request=self.request,
        )

    def perform_update(self, serializer):
        instance = self.get_object()
        self._ensure_share_write_allowed(instance=instance)
        share = serializer.save()
        log_action(self.request.user, AuditLog.Action.UPDATE, share, request=self.request)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        self._ensure_share_write_allowed(instance=instance)
        instance.is_active = False
        instance.save(update_fields=["is_active"])
        log_action(request.user, AuditLog.Action.DISABLE, instance, request=request)
        return Response(status=status.HTTP_204_NO_CONTENT)


class AccessRequestViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        qs = AccessRequest.objects.select_related(
            "requester",
            "requester__department",
            "reviewer",
            "service",
            "service__department",
        )
        if _is_superuser(user):
            return qs
        if _is_department_head(user):
            visible_ids = _head_visible_department_ids(user)
            return qs.filter(requester__department_id__in=visible_ids)
        return qs.filter(requester=user)

    def get_serializer_class(self):
        if self.action == "create":
            return AccessRequestWriteSerializer
        if self.action in ("approve", "reject"):
            return AccessRequestReviewSerializer
        return AccessRequestReadSerializer

    def get_throttles(self):
        if self.action == "create":
            return [AccessRequestCreateThrottle()]
        return super().get_throttles()

    def perform_create(self, serializer):
        requester = self.request.user
        if not requester.is_active:
            raise ValidationError("Inactive users cannot create access requests.")
        access_request = serializer.save(requester=requester)
        log_action(self.request.user, AuditLog.Action.CREATE, access_request, request=self.request)

        reviewer_emails = _reviewer_emails_for_request(access_request)
        send_platform_email(
            subject="Phoenix Vault: новый запрос доступа",
            body=(
                f"Пользователь {requester.portal_login} запросил доступ к сервису "
                f"{access_request.service.name}."
            ),
            recipients=reviewer_emails,
        )

    def _ensure_can_review(self, access_request):
        actor = self.request.user
        if _is_superuser(actor):
            return
        if not _is_department_head(actor):
            raise PermissionDenied("Only department head or superuser can review requests.")
        if access_request.requester.department_id != actor.department_id:
            raise PermissionDenied("You can review only your own department requests.")

    @action(detail=True, methods=["post"], permission_classes=[IsAuthenticated])
    def approve(self, request, pk=None):
        access_request = self.get_object()
        self._ensure_can_review(access_request)
        if access_request.status != AccessRequest.Status.PENDING:
            raise ValidationError("Only pending requests can be approved.")

        access_request.status = AccessRequest.Status.APPROVED
        access_request.reviewer = request.user
        access_request.review_comment = str(request.data.get("review_comment", "")).strip()
        access_request.reviewed_at = timezone.now()
        access_request.save(update_fields=["status", "reviewer", "review_comment", "reviewed_at"])
        ServiceAccess.objects.update_or_create(
            user=access_request.requester,
            service=access_request.service,
            defaults={"is_active": True},
        )
        log_action(request.user, AuditLog.Action.UPDATE, access_request, request=request)

        if access_request.requester.email:
            send_platform_email(
                subject="Phoenix Vault: запрос доступа одобрен",
                body=(
                    f"Ваш запрос на доступ к сервису '{access_request.service.name}' одобрен."
                ),
                recipients=[access_request.requester.email],
            )

        serializer = AccessRequestReadSerializer(access_request)
        return Response(serializer.data)

    @action(detail=True, methods=["post"], permission_classes=[IsAuthenticated])
    def reject(self, request, pk=None):
        access_request = self.get_object()
        self._ensure_can_review(access_request)
        if access_request.status != AccessRequest.Status.PENDING:
            raise ValidationError("Only pending requests can be rejected.")

        access_request.status = AccessRequest.Status.REJECTED
        access_request.reviewer = request.user
        access_request.review_comment = str(request.data.get("review_comment", "")).strip()
        access_request.reviewed_at = timezone.now()
        access_request.save(update_fields=["status", "reviewer", "review_comment", "reviewed_at"])
        log_action(request.user, AuditLog.Action.UPDATE, access_request, request=request)

        if access_request.requester.email:
            send_platform_email(
                subject="Phoenix Vault: запрос доступа отклонен",
                body=(
                    f"Ваш запрос на доступ к сервису '{access_request.service.name}' отклонен."
                    f"\nКомментарий: {access_request.review_comment or '-'}"
                ),
                recipients=[access_request.requester.email],
            )

        serializer = AccessRequestReadSerializer(access_request)
        return Response(serializer.data)

    @action(detail=True, methods=["post"], permission_classes=[IsAuthenticated])
    def cancel(self, request, pk=None):
        access_request = self.get_object()
        if access_request.requester_id != request.user.id and not _is_superuser(request.user):
            raise PermissionDenied("You can cancel only your own requests.")
        if access_request.status != AccessRequest.Status.PENDING:
            raise ValidationError("Only pending requests can be canceled.")

        access_request.status = AccessRequest.Status.CANCELED
        access_request.review_comment = str(request.data.get("review_comment", "")).strip()
        access_request.reviewed_at = timezone.now()
        access_request.save(update_fields=["status", "review_comment", "reviewed_at"])
        log_action(request.user, AuditLog.Action.UPDATE, access_request, request=request)

        serializer = AccessRequestReadSerializer(access_request)
        return Response(serializer.data)


class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = AuditLogSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        qs = AuditLog.objects.select_related("actor", "actor__department")
        if _is_superuser(user):
            return qs
        if _is_department_head(user):
            visible_ids = _head_visible_department_ids(user)
            return qs.filter(Q(actor=user) | Q(actor__department_id__in=visible_ids)).distinct()
        return qs.filter(actor=user)
