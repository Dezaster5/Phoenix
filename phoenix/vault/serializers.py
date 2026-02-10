from django.contrib.auth import get_user_model
from rest_framework import serializers

from .models import Category, Credential, Service, ServiceAccess

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ("id", "portal_login", "full_name", "email", "role", "is_active")
        read_only_fields = ("id",)


class UserWriteSerializer(serializers.ModelSerializer):
    password = serializers.CharField(required=False, allow_blank=True, write_only=True)

    class Meta:
        model = User
        fields = ("id", "portal_login", "full_name", "email", "role", "is_active", "password")
        read_only_fields = ("id",)

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


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ("id", "name", "sort_order", "is_active")


class ServiceSerializer(serializers.ModelSerializer):
    category = CategorySerializer(read_only=True)
    category_id = serializers.PrimaryKeyRelatedField(
        queryset=Category.objects.all(), source="category", write_only=True, allow_null=True, required=False
    )

    class Meta:
        model = Service
        fields = ("id", "name", "url", "category", "category_id", "is_active")


class CredentialReadSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    service = ServiceSerializer(read_only=True)

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
            "created_at",
            "updated_at",
        )


class CredentialWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Credential
        fields = ("id", "user", "service", "login", "password", "notes", "is_active")


class ServiceAccessSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    user_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(), source="user", write_only=True
    )
    service = ServiceSerializer(read_only=True)
    service_id = serializers.PrimaryKeyRelatedField(
        queryset=Service.objects.all(), source="service", write_only=True
    )

    class Meta:
        model = ServiceAccess
        fields = ("id", "user", "user_id", "service", "service_id", "is_active", "created_at")
        read_only_fields = ("id", "created_at")
