from datetime import timedelta

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from vault.models import AuditLog, Credential, Department, DepartmentShare, Service

User = get_user_model()


class AuditVisibilityTests(TestCase):
    def setUp(self):
        self.client = APIClient()

        self.dep_it = Department.objects.create(name="IT")
        self.dep_marketing = Department.objects.create(name="Marketing")
        self.dep_finance = Department.objects.create(name="Finance")

        self.superuser = User.objects.create_superuser(
            portal_login="root.audit",
            password="root-pass-123",
            email="root@example.com",
        )
        self.head_it = User.objects.create_user(
            portal_login="head.it.audit",
            role=User.Role.HEAD,
            department=self.dep_it,
            email="head-it@example.com",
        )
        self.head_marketing = User.objects.create_user(
            portal_login="head.mkt.audit",
            role=User.Role.HEAD,
            department=self.dep_marketing,
            email="head-mkt@example.com",
        )
        self.employee_it = User.objects.create_user(
            portal_login="emp.it.audit",
            role=User.Role.EMPLOYEE,
            department=self.dep_it,
            email="emp-it@example.com",
        )
        self.employee_marketing = User.objects.create_user(
            portal_login="emp.mkt.audit",
            role=User.Role.EMPLOYEE,
            department=self.dep_marketing,
            email="emp-mkt@example.com",
        )
        self.employee_finance = User.objects.create_user(
            portal_login="emp.fin.audit",
            role=User.Role.EMPLOYEE,
            department=self.dep_finance,
            email="emp-fin@example.com",
        )

        DepartmentShare.objects.create(
            department=self.dep_it,
            grantor=self.head_it,
            grantee=self.head_marketing,
            expires_at=timezone.now() + timedelta(days=30),
            is_active=True,
        )

        self.it_log = AuditLog.objects.create(
            actor=self.employee_it,
            action=AuditLog.Action.VIEW,
            object_type="Credential",
            object_id="1",
            metadata={"source": "it"},
        )
        self.marketing_log = AuditLog.objects.create(
            actor=self.employee_marketing,
            action=AuditLog.Action.VIEW,
            object_type="Credential",
            object_id="2",
            metadata={"source": "marketing"},
        )
        self.finance_log = AuditLog.objects.create(
            actor=self.employee_finance,
            action=AuditLog.Action.VIEW,
            object_type="Credential",
            object_id="3",
            metadata={"source": "finance"},
        )

    def _auth(self, user):
        self.client.force_authenticate(user=user)

    def test_employee_sees_only_own_audit_entries(self):
        self._auth(self.employee_it)
        response = self.client.get("/api/audit-logs/")
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(len(payload), 1)
        self.assertEqual(payload[0]["actor"]["portal_login"], self.employee_it.portal_login)

    def test_department_head_sees_own_department_and_shared_department_audit_entries(self):
        self._auth(self.head_marketing)
        response = self.client.get("/api/audit-logs/")
        self.assertEqual(response.status_code, 200)
        actor_logins = {item["actor"]["portal_login"] for item in response.json()}
        self.assertIn(self.employee_it.portal_login, actor_logins)
        self.assertIn(self.employee_marketing.portal_login, actor_logins)
        self.assertNotIn(self.employee_finance.portal_login, actor_logins)

    def test_superuser_sees_all_audit_entries(self):
        self._auth(self.superuser)
        response = self.client.get("/api/audit-logs/")
        self.assertEqual(response.status_code, 200)
        actor_logins = {item["actor"]["portal_login"] for item in response.json()}
        self.assertIn(self.employee_it.portal_login, actor_logins)
        self.assertIn(self.employee_marketing.portal_login, actor_logins)
        self.assertIn(self.employee_finance.portal_login, actor_logins)

    def test_audit_log_filters_apply_after_visibility_scope(self):
        self._auth(self.head_marketing)

        by_actor = self.client.get("/api/audit-logs/?actor=emp.it.audit")
        self.assertEqual(by_actor.status_code, 200)
        actor_logins = {item["actor"]["portal_login"] for item in by_actor.json()}
        self.assertEqual(actor_logins, {self.employee_it.portal_login})

        by_object_type = self.client.get("/api/audit-logs/?object_type=Credential")
        self.assertEqual(by_object_type.status_code, 200)
        self.assertTrue(by_object_type.json())

    def test_superuser_can_export_audit_logs_as_csv(self):
        self._auth(self.superuser)
        response = self.client.get("/api/audit-logs/export/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Content-Type"], "text/csv; charset=utf-8")
        self.assertIn("attachment; filename=", response["Content-Disposition"])


class CredentialVersioningTests(TestCase):
    def setUp(self):
        self.client = APIClient()

        self.dep_it = Department.objects.create(name="IT")
        self.dep_finance = Department.objects.create(name="Finance")

        self.head_it = User.objects.create_user(
            portal_login="head.it.versions",
            role=User.Role.HEAD,
            department=self.dep_it,
            email="head-it@example.com",
        )
        self.employee_it = User.objects.create_user(
            portal_login="emp.it.versions",
            role=User.Role.EMPLOYEE,
            department=self.dep_it,
            email="emp-it@example.com",
        )
        self.employee_finance = User.objects.create_user(
            portal_login="emp.fin.versions",
            role=User.Role.EMPLOYEE,
            department=self.dep_finance,
            email="emp-fin@example.com",
        )
        self.service = Service.objects.create(
            name="Repo",
            url="https://repo.local",
            department=self.dep_it,
        )
        self.foreign_service = Service.objects.create(
            name="Finance BI",
            url="https://bi.local",
            department=self.dep_finance,
        )

    def _auth(self, user):
        self.client.force_authenticate(user=user)

    def test_create_and_update_generate_visible_credential_versions(self):
        self._auth(self.head_it)
        create_response = self.client.post(
            "/api/credentials/",
            {
                "user": self.employee_it.id,
                "service": self.service.id,
                "login": "emp.it@login",
                "password": "initial-secret",
                "notes": "initial",
            },
            format="json",
        )
        self.assertEqual(create_response.status_code, 201)
        credential_id = create_response.json()["id"]

        update_response = self.client.patch(
            f"/api/credentials/{credential_id}/",
            {
                "login": "emp.it.updated@login",
                "password": "rotated-secret",
                "notes": "rotated",
            },
            format="json",
        )
        self.assertEqual(update_response.status_code, 200)

        versions_response = self.client.get(f"/api/credentials/{credential_id}/versions/")
        self.assertEqual(versions_response.status_code, 200)
        payload = versions_response.json()
        self.assertEqual(len(payload), 2)
        self.assertEqual(payload[0]["change_type"], "update")
        self.assertEqual(payload[0]["changed_by"]["portal_login"], self.head_it.portal_login)
        self.assertEqual(payload[0]["login"], "emp.it.updated@login")
        self.assertEqual(payload[0]["notes"], "rotated")
        self.assertEqual(payload[1]["change_type"], "create")

    def test_employee_cannot_view_foreign_credential_versions(self):
        credential = Credential.objects.create(
            user=self.employee_finance,
            service=self.foreign_service,
            login="emp.fin@login",
            password="secret",
            notes="finance",
        )

        self._auth(self.employee_it)
        response = self.client.get(f"/api/credentials/{credential.id}/versions/")
        self.assertEqual(response.status_code, 404)

    def test_employee_cannot_list_department_shares(self):
        DepartmentShare.objects.create(
            department=self.dep_it,
            grantor=self.head_it,
            grantee=self.head_it,
            expires_at=timezone.now() + timedelta(days=30),
            is_active=True,
        )

        self._auth(self.employee_it)
        response = self.client.get("/api/department-shares/")
        self.assertEqual(response.status_code, 403)
