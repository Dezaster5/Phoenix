from django.contrib.auth import authenticate, get_user_model
from django.db.models import Q
from rest_framework import status, viewsets
from rest_framework.authtoken.models import Token
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import AuditLog, Category, Credential, Service, ServiceAccess
from .permissions import IsCompanyAdmin, IsCompanyAdminOrReadOnly
from .serializers import (
    CategorySerializer,
    CredentialReadSerializer,
    CredentialWriteSerializer,
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
            }
        )


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        serializer = UserSerializer(request.user)
        return Response(serializer.data)


class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all()
    permission_classes = [IsCompanyAdmin]

    def get_serializer_class(self):
        if self.action in ("list", "retrieve"):
            return UserSerializer
        return UserWriteSerializer

    def perform_create(self, serializer):
        user = serializer.save()
        log_action(self.request.user, AuditLog.Action.CREATE, user)

    def perform_update(self, serializer):
        user = serializer.save()
        log_action(self.request.user, AuditLog.Action.UPDATE, user)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        instance.is_active = False
        instance.save(update_fields=["is_active"])
        log_action(request.user, AuditLog.Action.DISABLE, instance)
        return Response(status=status.HTTP_204_NO_CONTENT)


class CategoryViewSet(viewsets.ModelViewSet):
    serializer_class = CategorySerializer
    permission_classes = [IsCompanyAdminOrReadOnly]

    def get_queryset(self):
        qs = Category.objects.all()
        if getattr(self.request.user, "is_company_admin", False):
            return qs
        return qs.filter(
            services__accesses__user=self.request.user,
            services__accesses__is_active=True,
            services__is_active=True,
        ).distinct()

    def perform_create(self, serializer):
        category = serializer.save()
        log_action(self.request.user, AuditLog.Action.CREATE, category)

    def perform_update(self, serializer):
        category = serializer.save()
        log_action(self.request.user, AuditLog.Action.UPDATE, category)


class ServiceViewSet(viewsets.ModelViewSet):
    serializer_class = ServiceSerializer
    permission_classes = [IsCompanyAdminOrReadOnly]

    def get_queryset(self):
        qs = Service.objects.select_related("category")
        if getattr(self.request.user, "is_company_admin", False):
            return qs
        return qs.filter(
            accesses__user=self.request.user,
            accesses__is_active=True,
            is_active=True,
        ).distinct()

    def perform_create(self, serializer):
        service = serializer.save()
        log_action(self.request.user, AuditLog.Action.CREATE, service)

    def perform_update(self, serializer):
        service = serializer.save()
        log_action(self.request.user, AuditLog.Action.UPDATE, service)


class CredentialViewSet(viewsets.ModelViewSet):
    permission_classes = [IsCompanyAdminOrReadOnly]

    def get_queryset(self):
        qs = Credential.objects.select_related("user", "service", "service__category")
        if getattr(self.request.user, "is_company_admin", False):
            return qs
        return qs.filter(
            user=self.request.user,
            is_active=True,
            service__is_active=True,
        ).filter(Q(service__category__isnull=True) | Q(service__category__is_active=True)).filter(
            service__accesses__user=self.request.user,
            service__accesses__is_active=True,
        )

    def get_serializer_class(self):
        if self.action in ("list", "retrieve"):
            return CredentialReadSerializer
        return CredentialWriteSerializer

    def perform_create(self, serializer):
        credential = serializer.save()
        log_action(self.request.user, AuditLog.Action.CREATE, credential)

    def perform_update(self, serializer):
        credential = serializer.save()
        log_action(self.request.user, AuditLog.Action.UPDATE, credential)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
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
    permission_classes = [IsCompanyAdminOrReadOnly]

    def get_queryset(self):
        qs = ServiceAccess.objects.select_related("user", "service", "service__category")
        if getattr(self.request.user, "is_company_admin", False):
            return qs
        return qs.filter(user=self.request.user, is_active=True)

    def perform_create(self, serializer):
        access = serializer.save()
        log_action(self.request.user, AuditLog.Action.CREATE, access)

    def perform_update(self, serializer):
        access = serializer.save()
        log_action(self.request.user, AuditLog.Action.UPDATE, access)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        instance.is_active = False
        instance.save(update_fields=["is_active"])
        log_action(request.user, AuditLog.Action.DISABLE, instance)
        return Response(status=status.HTTP_204_NO_CONTENT)
    def retrieve(self, request, *args, **kwargs):
        response = super().retrieve(request, *args, **kwargs)
        instance = self.get_object()
        log_action(request.user, AuditLog.Action.VIEW, instance)
        return response
