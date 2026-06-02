from unittest.mock import MagicMock, patch

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from vault.employee_registry import EmployeeRegistryError, fetch_employee_identity_by_iin
from vault.models import Department

User = get_user_model()


class IinRegistrationTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.department = Department.objects.create(name="IT")
        self.inactive_department = Department.objects.create(name="Archive", is_active=False)

    @patch("vault.serializers.fetch_employee_identity_by_iin")
    def test_registers_employee_by_iin_from_registry(self, fetch_identity):
        fetch_identity.return_value = {
            "iin": "123456789012",
            "full_name": "Тестовый Сотрудник",
            "is_active": True,
        }

        response = self.client.post(
            "/api/auth/register-iin/",
            {
                "iin": "123456789012",
                "department_id": self.department.id,
                "portal_login": "new.employee",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        user = User.objects.get(portal_login="new.employee")
        self.assertEqual(user.iin, "123456789012")
        self.assertEqual(user.full_name, "Тестовый Сотрудник")
        self.assertEqual(user.role, User.Role.EMPLOYEE)
        self.assertEqual(user.department, self.department)
        self.assertFalse(user.has_usable_password())

    def test_rejects_duplicate_iin(self):
        User.objects.create_user(
            portal_login="exists",
            iin="123456789012",
            department=self.department,
            role=User.Role.EMPLOYEE,
        )

        response = self.client.post(
            "/api/auth/register-iin/",
            {
                "iin": "123456789012",
                "department_id": self.department.id,
                "portal_login": "another",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("Пользователь уже зарегистрирован", str(response.json()))

    def test_rejects_duplicate_portal_login(self):
        User.objects.create_user(
            portal_login="exists",
            iin="111111111111",
            department=self.department,
            role=User.Role.EMPLOYEE,
        )

        response = self.client.post(
            "/api/auth/register-iin/",
            {
                "iin": "123456789012",
                "department_id": self.department.id,
                "portal_login": "exists",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("Логин уже занят", str(response.json()))

    def test_public_departments_returns_only_active_departments(self):
        response = self.client.get("/api/public/departments/")

        self.assertEqual(response.status_code, 200)
        department_names = [item["name"] for item in response.json()]
        self.assertIn(self.department.name, department_names)
        self.assertNotIn(self.inactive_department.name, department_names)

    def test_rejects_invalid_iin(self):
        response = self.client.post(
            "/api/auth/register-iin/",
            {
                "iin": "12345",
                "department_id": self.department.id,
                "portal_login": "bad.iin",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("ИИН должен состоять из 12 цифр", str(response.json()))

    @patch("vault.serializers.fetch_employee_identity_by_iin")
    def test_rejects_inactive_employee_from_registry(self, fetch_identity):
        fetch_identity.return_value = {
            "iin": "999456789012",
            "full_name": "Уволенный Сотрудник",
            "is_active": False,
        }

        response = self.client.post(
            "/api/auth/register-iin/",
            {
                "iin": "999456789012",
                "department_id": self.department.id,
                "portal_login": "inactive.employee",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("Сотрудник не активен", str(response.json()))

    @patch("vault.serializers.fetch_employee_identity_by_iin")
    def test_rejects_missing_employee_from_registry(self, fetch_identity):
        fetch_identity.return_value = None

        response = self.client.post(
            "/api/auth/register-iin/",
            {
                "iin": "000456789012",
                "department_id": self.department.id,
                "portal_login": "missing.employee",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("Сотрудник с таким ИИН не найден", str(response.json()))

    @patch("vault.serializers.fetch_employee_identity_by_iin")
    def test_rejects_when_registry_is_unavailable(self, fetch_identity):
        fetch_identity.side_effect = EmployeeRegistryError("offline")

        response = self.client.post(
            "/api/auth/register-iin/",
            {
                "iin": "123456789012",
                "department_id": self.department.id,
                "portal_login": "offline.employee",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("Не удалось проверить сотрудника", str(response.json()))

    def test_department_head_cannot_create_user_through_api(self):
        head = User.objects.create_user(
            portal_login="head.it",
            role=User.Role.HEAD,
            department=self.department,
        )
        self.client.force_authenticate(user=head)

        response = self.client.post(
            "/api/users/",
            {
                "portal_login": "created.by.head",
                "full_name": "Created By Head",
                "role": User.Role.EMPLOYEE,
                "is_active": True,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 403)
        self.assertFalse(User.objects.filter(portal_login="created.by.head").exists())

    def test_superuser_can_create_user_with_iin_through_api(self):
        superuser = User.objects.create_superuser("root", "StrongPass123!")
        self.client.force_authenticate(user=superuser)

        response = self.client.post(
            "/api/users/",
            {
                "portal_login": "api.employee",
                "iin": "222456789012",
                "full_name": "API Employee",
                "department_id": self.department.id,
                "role": User.Role.EMPLOYEE,
                "is_active": True,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()["iin"], "222456789012")
        self.assertTrue(User.objects.filter(portal_login="api.employee").exists())


class EmployeeRegistryClientTests(TestCase):
    @override_settings(
        AVATRACKER_API_TOKEN="test-token",
        AVATRACKER_AUTH_SCHEME="Token",
        AVATRACKER_EMPLOYEE_URL="https://registry.example/api/employees/{iin}",
        AVATRACKER_TIMEOUT_SECONDS=2,
    )
    @patch("vault.employee_registry.urlopen")
    def test_fetch_employee_identity_parses_avatracker_response(self, mocked_urlopen):
        response = MagicMock()
        response.__enter__.return_value.read.return_value = (
            b'{"success": true, "data": {"iin": "123456789012", '
            b'"full_name": "\\u0418\\u0432\\u0430\\u043d \\u0418\\u0432\\u0430\\u043d\\u043e\\u0432", '
            b'"active": true}}'
        )
        mocked_urlopen.return_value = response

        identity = fetch_employee_identity_by_iin("123456789012")

        self.assertEqual(
            identity,
            {
                "iin": "123456789012",
                "full_name": "Иван Иванов",
                "is_active": True,
            },
        )
        request = mocked_urlopen.call_args.args[0]
        self.assertEqual(request.full_url, "https://registry.example/api/employees/123456789012")
        self.assertEqual(request.headers["Authorization"], "Token test-token")

    @override_settings(
        AVATRACKER_API_TOKEN="test-token",
        AVATRACKER_EMPLOYEE_URL="https://registry.example/api/employees/{iin}",
    )
    @patch("vault.employee_registry.urlopen")
    def test_fetch_employee_identity_returns_none_when_api_success_is_false(self, mocked_urlopen):
        response = MagicMock()
        response.__enter__.return_value.read.return_value = b'{"success": false, "data": null}'
        mocked_urlopen.return_value = response

        self.assertIsNone(fetch_employee_identity_by_iin("123456789012"))

    @override_settings(AVATRACKER_API_TOKEN="")
    def test_fetch_employee_identity_requires_token(self):
        with self.assertRaises(EmployeeRegistryError):
            fetch_employee_identity_by_iin("123456789012")
