from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from vault.models import AuditLog

User = get_user_model()


@override_settings(LOGIN_CHALLENGE_ENABLED=True, EMAIL_NOTIFICATIONS_ENABLED=False, DEBUG=True)
class LoginChallengeTests(TestCase):
    def setUp(self):
        cache.clear()
        self.client = APIClient()
        self.user = User.objects.create_user(
            portal_login="emp.security",
            role=User.Role.EMPLOYEE,
            email="",
            full_name="Security Employee",
        )

    def test_login_requires_challenge_and_can_be_verified(self):
        first = self.client.post("/api/auth/login/", {"portal_login": self.user.portal_login}, format="json")
        self.assertEqual(first.status_code, 202)
        payload = first.json()
        self.assertTrue(payload.get("challenge_required"))
        debug_code = payload.get("debug_code")
        self.assertTrue(debug_code)

        invalid = self.client.post(
            "/api/auth/login/",
            {"portal_login": self.user.portal_login, "code": "000000"},
            format="json",
        )
        self.assertEqual(invalid.status_code, 400)

        second = self.client.post(
            "/api/auth/login/",
            {"portal_login": self.user.portal_login, "code": debug_code},
            format="json",
        )
        self.assertEqual(second.status_code, 200)
        auth_payload = second.json()
        self.assertIn("token", auth_payload)

        reuse = self.client.post(
            "/api/auth/login/",
            {"portal_login": self.user.portal_login, "code": debug_code},
            format="json",
        )
        self.assertEqual(reuse.status_code, 400)

    def test_login_can_be_verified_by_magic_token(self):
        first = self.client.post("/api/auth/login/", {"portal_login": self.user.portal_login}, format="json")
        self.assertEqual(first.status_code, 202)
        payload = first.json()
        debug_magic_token = payload.get("debug_magic_token")
        self.assertTrue(debug_magic_token)

        second = self.client.post(
            "/api/auth/login/",
            {"portal_login": self.user.portal_login, "magic_token": debug_magic_token},
            format="json",
        )
        self.assertEqual(second.status_code, 200)
        self.assertIn("token", second.json())

        reuse = self.client.post(
            "/api/auth/login/",
            {"portal_login": self.user.portal_login, "magic_token": debug_magic_token},
            format="json",
        )
        self.assertEqual(reuse.status_code, 400)

    def test_login_event_written_to_audit(self):
        first = self.client.post("/api/auth/login/", {"portal_login": self.user.portal_login}, format="json")
        debug_code = first.json()["debug_code"]
        self.client.post(
            "/api/auth/login/",
            {"portal_login": self.user.portal_login, "code": debug_code},
            format="json",
        )
        self.assertTrue(
            AuditLog.objects.filter(
                actor=self.user,
                action=AuditLog.Action.LOGIN,
                object_type="User",
                object_id=str(self.user.pk),
            ).exists()
        )


@override_settings(
    LOGIN_CHALLENGE_ENABLED=True,
    EMAIL_NOTIFICATIONS_ENABLED=False,
    PASSWORDLESS_ROLES=["employee"],
    DEBUG=True,
)
class PrivilegedLoginPolicyTests(TestCase):
    def setUp(self):
        cache.clear()
        self.client = APIClient()
        self.head = User.objects.create_user(
            portal_login="head.security",
            role=User.Role.HEAD,
            email="head@example.com",
            full_name="Security Head",
        )

    def test_department_head_can_start_challenge_even_when_not_direct_passwordless(self):
        response = self.client.post("/api/auth/login/", {"portal_login": self.head.portal_login}, format="json")
        self.assertEqual(response.status_code, 202)
        self.assertTrue(response.json()["challenge_required"])

    @override_settings(LOGIN_CHALLENGE_ENABLED=False, PASSWORDLESS_ROLES=["employee"])
    def test_department_head_cannot_direct_login_without_challenge(self):
        response = self.client.post("/api/auth/login/", {"portal_login": self.head.portal_login}, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["detail"], "invalid credentials")

    @override_settings(LOGIN_CHALLENGE_ENABLED=False, PASSWORDLESS_ROLES=["employee"])
    def test_superuser_cannot_direct_login_without_challenge(self):
        superuser = User.objects.create_superuser("root.security", "StrongPass123!")
        response = self.client.post("/api/auth/login/", {"portal_login": superuser.portal_login}, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["detail"], "invalid credentials")


@override_settings(LOGIN_CHALLENGE_ENABLED=True, EMAIL_NOTIFICATIONS_ENABLED=False, DEBUG=False)
class LoginChallengeConfigurationTests(TestCase):
    def setUp(self):
        cache.clear()
        self.client = APIClient()
        self.user = User.objects.create_user(
            portal_login="emp.noemail",
            role=User.Role.EMPLOYEE,
            email="",
            full_name="No Email Employee",
        )

    def test_login_challenge_requires_email_in_non_debug_mode(self):
        response = self.client.post("/api/auth/login/", {"portal_login": self.user.portal_login}, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertIn("должна быть указана почта", response.json()["detail"])


@override_settings(
    PUBLIC_SUPPORT_EMAIL="security@example.com",
    PUBLIC_LOGIN_REQUEST_SUBJECT="Запрос логина Phoenix Vault",
    PUBLIC_LOGIN_REQUEST_TEMPLATE="ФИО: ____",
)
class PublicConfigTests(TestCase):
    def setUp(self):
        cache.clear()
        self.client = APIClient()

    def test_public_config_endpoint_exposes_operational_contact_settings(self):
        response = self.client.get("/api/config/public/")
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["product_name"], "Phoenix Vault")
        self.assertEqual(payload["support_email"], "security@example.com")
        self.assertEqual(payload["login_request_subject"], "Запрос логина Phoenix Vault")
        self.assertEqual(payload["login_request_template"], "ФИО: ____")


@override_settings(
    CONTENT_SECURITY_POLICY="default-src 'self'",
    PERMISSIONS_POLICY="camera=(), microphone=()",
)
class SecurityHeaderTests(TestCase):
    def setUp(self):
        cache.clear()
        self.client = APIClient()

    def test_public_responses_include_configured_security_headers(self):
        response = self.client.get("/api/health/live/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Content-Security-Policy"], "default-src 'self'")
        self.assertEqual(response["Permissions-Policy"], "camera=(), microphone=()")
