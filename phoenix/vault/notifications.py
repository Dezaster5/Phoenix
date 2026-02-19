import logging

from django.conf import settings
from django.core.mail import send_mail

logger = logging.getLogger(__name__)


def send_platform_email(subject, body, recipients):
    recipients = [email for email in recipients if email]
    if not recipients:
        return
    if not getattr(settings, "EMAIL_NOTIFICATIONS_ENABLED", False):
        logger.info("Email notifications disabled: %s -> %s", subject, recipients)
        return
    send_mail(
        subject=subject,
        message=body,
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=recipients,
        fail_silently=True,
    )

