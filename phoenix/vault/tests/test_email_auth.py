from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from vault.models import Department

User = get_user_model()


@override_settings(DEBUG=True, EMAIL_NOTIFICATIONS_ENABLED=False)
class EmailRegistrationTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.department = Department.objects.create(name="IT")

    @patch("vault.serializers.fetch_employee_identity_by_iin")
    def test_registration_requires_email_verification(self, fetch_identity):
        fetch_identity.return_value = {
            "iin": "123456789012",
            "full_name": "Тестовый Сотрудник",
            "is_active": True,
        }

        first = self.client.post(
            "/api/auth/register/",
            {
                "email": "employee@example.com",
                "iin": "123456789012",
                "department_id": self.department.id,
                "password": "StrongPass123!",
                "password_confirm": "StrongPass123!",
            },
            format="json",
        )
        self.assertEqual(first.status_code, 202)
        debug_code = first.json()["debug_code"]

        second = self.client.post(
            "/api/auth/register/verify/",
            {"email": "employee@example.com", "code": debug_code},
            format="json",
        )
        self.assertEqual(second.status_code, 201)
        user = User.objects.get(email="employee@example.com")
        self.assertEqual(user.iin, "123456789012")
        self.assertTrue(user.check_password("StrongPass123!"))

    @patch("vault.serializers.fetch_employee_identity_by_iin")
    def test_registration_rejects_inactive_employee(self, fetch_identity):
        fetch_identity.return_value = {
            "iin": "123456789012",
            "full_name": "Уволенный Сотрудник",
            "is_active": False,
        }

        response = self.client.post(
            "/api/auth/register/",
            {
                "email": "inactive@example.com",
                "iin": "123456789012",
                "department_id": self.department.id,
                "password": "StrongPass123!",
                "password_confirm": "StrongPass123!",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("не активен", str(response.json()))


@override_settings(DEBUG=True, EMAIL_NOTIFICATIONS_ENABLED=False)
class EmailLoginTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.department = Department.objects.create(name="IT")
        self.user = User.objects.create_user(
            portal_login="employee",
            email="employee@example.com",
            password="StrongPass123!",
            iin="123456789012",
            department=self.department,
            role=User.Role.EMPLOYEE,
        )

    @patch("vault.views.verify_user_employee_active")
    def test_login_with_email_and_password_checks_registry(self, verify_active):
        verify_active.return_value = True
        response = self.client.post(
            "/api/auth/login/",
            {"email": "employee@example.com", "password": "StrongPass123!"},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertIn("token", response.json())

    @patch("vault.views.verify_user_employee_active")
    def test_login_rejects_inactive_employee_from_registry(self, verify_active):
        verify_active.return_value = False
        response = self.client.post(
            "/api/auth/login/",
            {"email": "employee@example.com", "password": "StrongPass123!"},
            format="json",
        )
        self.assertEqual(response.status_code, 403)
        self.assertIn("не активен", response.json()["detail"])


@override_settings(DEBUG=True, EMAIL_NOTIFICATIONS_ENABLED=False)
class PasswordManagementTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            portal_login="employee",
            email="employee@example.com",
            password="StrongPass123!",
            role=User.Role.EMPLOYEE,
        )

    def test_password_reset_flow(self):
        first = self.client.post(
            "/api/auth/password-reset/request/",
            {"email": "employee@example.com"},
            format="json",
        )
        self.assertEqual(first.status_code, 202)
        debug_code = first.json()["debug_code"]

        second = self.client.post(
            "/api/auth/password-reset/confirm/",
            {
                "email": "employee@example.com",
                "code": debug_code,
                "password": "NewStrongPass123!",
                "password_confirm": "NewStrongPass123!",
            },
            format="json",
        )
        self.assertEqual(second.status_code, 200)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password("NewStrongPass123!"))

    def test_password_change_requires_current_password(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.post(
            "/api/auth/password/change/",
            {
                "current_password": "StrongPass123!",
                "password": "AnotherStrongPass123!",
                "password_confirm": "AnotherStrongPass123!",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password("AnotherStrongPass123!"))
