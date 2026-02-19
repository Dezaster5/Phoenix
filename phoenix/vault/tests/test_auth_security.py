from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from vault.models import AuditLog

User = get_user_model()


@override_settings(LOGIN_CHALLENGE_ENABLED=True, EMAIL_NOTIFICATIONS_ENABLED=False, DEBUG=True)
class LoginChallengeTests(TestCase):
    def setUp(self):
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
