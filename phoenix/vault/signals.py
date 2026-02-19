from django.contrib.auth import get_user_model
from django.db.models.signals import post_save
from django.dispatch import receiver
from rest_framework.authtoken.models import Token

from .models import Credential, ServiceAccess

@receiver(post_save, sender=get_user_model())
def create_auth_token(sender, instance=None, created=False, **kwargs):
    if created:
        Token.objects.get_or_create(user=instance)


@receiver(post_save, sender=Credential)
def ensure_service_access(sender, instance=None, created=False, **kwargs):
    if instance is None:
        return
    ServiceAccess.objects.update_or_create(
        user=instance.user,
        service=instance.service,
        defaults={"is_active": instance.is_active},
    )
