import json
import logging
from urllib.error import HTTPError
from urllib.request import Request, urlopen

from django.conf import settings
from django.core.mail import send_mail

logger = logging.getLogger(__name__)

RESEND_ENDPOINT = "https://api.resend.com/emails"


def _send_via_resend(subject, body, recipients):
    api_key = getattr(settings, "RESEND_API_KEY", "").strip()
    payload = json.dumps(
        {
            "from": settings.DEFAULT_FROM_EMAIL,
            "to": recipients,
            "subject": subject,
            "text": body,
        }
    ).encode("utf-8")
    request = Request(
        RESEND_ENDPOINT,
        data=payload,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "Accept": "application/json",
            # Cloudflare (in front of api.resend.com) blocks the default
            # urllib User-Agent with HTTP 403 / error 1010. Send an explicit one.
            "User-Agent": "Mozilla/5.0 (compatible; PhoenixVault/1.0; +https://phoenix-vault)",
        },
        method="POST",
    )
    timeout = getattr(settings, "EMAIL_HTTP_TIMEOUT_SECONDS", 10)
    try:
        with urlopen(request, timeout=timeout) as response:
            response.read()
        return True
    except HTTPError as exc:
        detail = exc.read().decode("utf-8", "replace")[:300]
        logger.error("Resend email failed with HTTP %s: %s", exc.code, detail)
        return False


def send_platform_email(subject, body, recipients):
    recipients = [email for email in recipients if email]
    if not recipients:
        return False
    if not getattr(settings, "EMAIL_NOTIFICATIONS_ENABLED", False):
        logger.info("Email notifications disabled: %s -> %s", subject, recipients)
        return False
    try:
        if getattr(settings, "RESEND_API_KEY", "").strip():
            return _send_via_resend(subject, body, recipients)
        send_mail(
            subject=subject,
            message=body,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=recipients,
            fail_silently=False,
        )
        return True
    except Exception:
        # Never let a mail transport failure (timeout, blocked port, auth error)
        # bubble up and 500 the request / kill the worker.
        logger.exception("Failed to send platform email: %s -> %s", subject, recipients)
        return False
