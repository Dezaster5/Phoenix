import hashlib
import secrets
from datetime import timedelta

from django.conf import settings
from django.utils import timezone

from .models import LoginChallenge


def get_client_ip(request):
    forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR", "")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR")


def get_user_agent(request):
    return request.META.get("HTTP_USER_AGENT", "")[:512]


def _digest(value, salt):
    payload = f"{value}:{salt}:{settings.SECRET_KEY}".encode("utf-8")
    return hashlib.sha256(payload).hexdigest()


def generate_login_challenge(user, request=None):
    code = "".join(secrets.choice("0123456789") for _ in range(6))
    magic_token = secrets.token_urlsafe(32)
    salt = secrets.token_hex(16)
    expires_at = timezone.now() + timedelta(
        minutes=getattr(settings, "LOGIN_CHALLENGE_TTL_MINUTES", 10)
    )
    ip_address = get_client_ip(request) if request else None
    user_agent = get_user_agent(request) if request else ""

    LoginChallenge.objects.filter(
        user=user,
        consumed_at__isnull=True,
        expires_at__gt=timezone.now(),
    ).update(consumed_at=timezone.now())

    challenge = LoginChallenge.objects.create(
        user=user,
        code_digest=_digest(code, salt),
        magic_token_digest=_digest(magic_token, salt),
        salt=salt,
        expires_at=expires_at,
        ip_address=ip_address,
        user_agent=user_agent,
    )
    return challenge, code, magic_token


def verify_login_challenge(user, code=None, magic_token=None):
    challenge = (
        LoginChallenge.objects.filter(
            user=user,
            consumed_at__isnull=True,
        )
        .order_by("-created_at")
        .first()
    )
    if challenge is None:
        return False, "Challenge not found."
    if not challenge.is_active:
        return False, "Challenge is expired or exhausted."
    if not code and not magic_token:
        return False, "Code or magic token is required."

    is_valid = False
    if code:
        is_valid = _digest(str(code).strip(), challenge.salt) == challenge.code_digest
    elif magic_token:
        is_valid = _digest(str(magic_token).strip(), challenge.salt) == challenge.magic_token_digest

    if not is_valid:
        challenge.attempts += 1
        challenge.save(update_fields=["attempts"])
        return False, "Invalid challenge."

    challenge.consumed_at = timezone.now()
    challenge.save(update_fields=["consumed_at"])
    return True, challenge
