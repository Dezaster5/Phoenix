import json
import logging
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen

from django.conf import settings

logger = logging.getLogger(__name__)


class EmployeeRegistryError(Exception):
    """Raised when the external employee registry cannot be queried safely."""


def _build_employee_url(iin):
    template = getattr(settings, "AVATRACKER_EMPLOYEE_URL", "")
    if not template:
        raise EmployeeRegistryError("Employee registry URL is not configured.")
    encoded_iin = quote(str(iin), safe="")
    if "{iin}" in template:
        return template.format(iin=encoded_iin)
    return f"{template.rstrip('/')}/{encoded_iin}"


def _authorization_header():
    token = getattr(settings, "AVATRACKER_API_TOKEN", "").strip()
    if not token:
        raise EmployeeRegistryError("Employee registry token is not configured.")
    scheme = getattr(settings, "AVATRACKER_AUTH_SCHEME", "Token").strip()
    return f"{scheme} {token}" if scheme else token


def fetch_employee_identity_by_iin(iin):
    """Fetch employee identity from Avatracker by IIN.

    Returns a normalized dict used by registration or None when the employee is
    not found / the API says the employee object is not successful.
    """
    normalized_iin = str(iin or "").strip()
    if not normalized_iin.isdigit() or len(normalized_iin) != 12:
        return None

    request = Request(
        _build_employee_url(normalized_iin),
        headers={
            "Authorization": _authorization_header(),
            "Accept": "application/json",
        },
        method="GET",
    )

    timeout = getattr(settings, "AVATRACKER_TIMEOUT_SECONDS", 5)
    try:
        with urlopen(request, timeout=timeout) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except HTTPError as exc:
        if exc.code == 404:
            return None
        logger.warning("Avatracker employee lookup failed with HTTP %s", exc.code)
        raise EmployeeRegistryError("Employee registry returned an error.") from exc
    except (URLError, TimeoutError, json.JSONDecodeError, UnicodeDecodeError) as exc:
        logger.warning("Avatracker employee lookup failed: %s", exc)
        raise EmployeeRegistryError("Employee registry is unavailable.") from exc

    if not payload.get("success"):
        return None

    data = payload.get("data") or {}
    response_iin = str(data.get("iin") or "").strip()
    if response_iin and response_iin != normalized_iin:
        logger.warning("Avatracker returned mismatched IIN for lookup.")
        return None

    full_name = str(data.get("full_name") or "").strip()
    if not full_name:
        return None

    return {
        "iin": response_iin or normalized_iin,
        "full_name": full_name,
        "is_active": bool(data.get("active")),
    }
