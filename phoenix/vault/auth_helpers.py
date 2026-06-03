from django.contrib.auth import get_user_model

from .employee_registry import EmployeeRegistryError, fetch_employee_identity_by_iin

User = get_user_model()


def normalize_email(value):
    return str(value or "").strip().lower()


def derive_portal_login(email):
    local_part = normalize_email(email).split("@", 1)[0]
    base = User.normalize_username(local_part)[:64] or "user"
    candidate = base
    suffix = 1
    while User.objects.filter(portal_login=candidate).exists():
        tail = f".{suffix}"
        candidate = f"{base[: max(1, 64 - len(tail))]}{tail}"
        suffix += 1
    return candidate


def verify_employee_active_by_iin(iin):
    """Return True/False for known status, or None when registry is unavailable."""
    try:
        identity = fetch_employee_identity_by_iin(iin)
    except EmployeeRegistryError:
        return None
    return bool(identity and identity.get("is_active"))


def verify_user_employee_active(user):
    if not user or not user.iin:
        return True
    return verify_employee_active_by_iin(user.iin)
