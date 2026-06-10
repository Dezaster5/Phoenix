from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from datetime import timedelta
from rest_framework.test import APIClient

from vault.models import AccessRequest, AuditLog, Credential, Department, DepartmentShare, Service

User = get_user_model()


class PermissionMatrixTests(TestCase):
    def setUp(self):
        self.client = APIClient()

        self.dep_it = Department.objects.create(name="IT")
        self.dep_mkt = Department.objects.create(name="Marketing")

        self.superuser = User.objects.create_superuser(
            portal_login="root",
            password="root-pass-123",
            full_name="Super User",
            email="root@example.com",
        )

        self.head_it = User.objects.create_user(
            portal_login="head.it",
            full_name="Head IT",
            role=User.Role.HEAD,
            department=self.dep_it,
        )
        self.head_mkt = User.objects.create_user(
            portal_login="head.mkt",
            full_name="Head MKT",
            role=User.Role.HEAD,
            department=self.dep_mkt,
        )
        self.emp_it = User.objects.create_user(
            portal_login="emp.it",
            full_name="Employee IT",
            role=User.Role.EMPLOYEE,
            department=self.dep_it,
        )
        self.emp_mkt = User.objects.create_user(
            portal_login="emp.mkt",
            full_name="Employee MKT",
            role=User.Role.EMPLOYEE,
            department=self.dep_mkt,
        )

        self.service_it = Service.objects.create(name="Infra", url="https://infra.local", department=self.dep_it)
        self.service_mkt = Service.objects.create(
            name="Ads", url="https://ads.local", department=self.dep_mkt
        )

        self.cred_it = Credential.objects.create(
            user=self.emp_it,
            service=self.service_it,
            login="it@login",
            password="it-pass",
            notes="it",
        )
        self.cred_mkt = Credential.objects.create(
            user=self.emp_mkt,
            service=self.service_mkt,
            login="mkt@login",
            password="mkt-pass",
            notes="mkt",
        )

        DepartmentShare.objects.create(
            department=self.dep_it,
            grantor=self.head_it,
            grantee=self.head_mkt,
            expires_at=timezone.now() + timedelta(days=365),
            is_active=True,
        )

    def _auth(self, user):
        self.client.force_authenticate(user=user)

    def test_employee_sees_only_own_credentials(self):
        self._auth(self.emp_it)
        response = self.client.get("/api/credentials/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()), 1)
        self.assertEqual(response.json()[0]["user"]["portal_login"], self.emp_it.portal_login)

    def test_credential_list_view_does_not_fill_audit_log(self):
        self._auth(self.emp_it)
        before_count = AuditLog.objects.count()

        response = self.client.get("/api/credentials/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(AuditLog.objects.count(), before_count)

    def test_department_head_with_share_can_read_but_not_write_other_department(self):
        self._auth(self.head_mkt)

        list_response = self.client.get("/api/credentials/")
        self.assertEqual(list_response.status_code, 200)
        payload = list_response.json()
        logins = {item["user"]["portal_login"] for item in payload}
        self.assertIn(self.emp_it.portal_login, logins)
        self.assertIn(self.emp_mkt.portal_login, logins)

        patch_response = self.client.patch(
            f"/api/credentials/{self.cred_it.id}/",
            {"notes": "hacked"},
            format="json",
        )
        self.assertEqual(patch_response.status_code, 403)

    def test_department_head_with_share_can_view_shared_department_requests(self):
        AccessRequest.objects.create(
            requester=self.emp_it,
            service=self.service_it,
            status=AccessRequest.Status.PENDING,
        )
        AccessRequest.objects.create(
            requester=self.emp_mkt,
            service=self.service_mkt,
            status=AccessRequest.Status.PENDING,
        )
        self._auth(self.head_mkt)
        response = self.client.get("/api/access-requests/")
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        requester_logins = {item["requester"]["portal_login"] for item in payload}
        self.assertIn(self.emp_it.portal_login, requester_logins)
        self.assertIn(self.emp_mkt.portal_login, requester_logins)

    def test_superuser_can_update_any_credential(self):
        self._auth(self.superuser)
        patch_response = self.client.patch(
            f"/api/credentials/{self.cred_it.id}/",
            {"notes": "updated-by-superuser"},
            format="json",
        )
        self.assertEqual(patch_response.status_code, 200)
        self.cred_it.refresh_from_db()
        self.assertEqual(self.cred_it.notes, "updated-by-superuser")

    def test_department_head_cannot_review_shared_department_requests(self):
        access_request = AccessRequest.objects.create(
            requester=self.emp_it,
            service=self.service_it,
            status=AccessRequest.Status.PENDING,
        )
        self._auth(self.head_mkt)
        response = self.client.post(
            f"/api/access-requests/{access_request.id}/approve/",
            {"review_comment": "try"},
            format="json",
        )
        self.assertEqual(response.status_code, 403)

    def test_employee_sees_all_active_services_for_request_flow(self):
        inactive = Service.objects.create(
            name="Old Tool",
            url="https://old.local",
            department=self.dep_mkt,
            is_active=False,
        )
        self._auth(self.emp_it)
        response = self.client.get("/api/services/")
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        service_names = {item["name"] for item in payload}
        self.assertIn(self.service_it.name, service_names)
        self.assertIn(self.service_mkt.name, service_names)
        self.assertNotIn(inactive.name, service_names)

    def test_audit_logs_visible_for_superuser(self):
        self._auth(self.superuser)
        response = self.client.get("/api/audit-logs/")
        self.assertEqual(response.status_code, 200)

    def test_employee_can_create_credential_for_self(self):
        self._auth(self.emp_it)
        response = self.client.post(
            "/api/credentials/",
            {
                "service": self.service_mkt.id,
                "login": "personal@login",
                "password": "personal-pass",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.content)
        credential = Credential.objects.get(user=self.emp_it, service=self.service_mkt)
        self.assertEqual(credential.login, "personal@login")

        list_response = self.client.get("/api/credentials/")
        ids = {item["id"] for item in list_response.json()}
        self.assertIn(credential.id, ids)

    def test_employee_cannot_create_credential_for_other_user(self):
        self._auth(self.emp_it)
        response = self.client.post(
            "/api/credentials/",
            {
                "user": self.emp_mkt.id,
                "service": self.service_mkt.id,
                "login": "foreign@login",
                "password": "foreign-pass",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertFalse(
            Credential.objects.filter(user=self.emp_mkt, service=self.service_mkt, login="foreign@login").exists()
        )

    def test_employee_can_update_own_credential(self):
        self._auth(self.emp_it)
        response = self.client.patch(
            f"/api/credentials/{self.cred_it.id}/",
            {"notes": "self-edited"},
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.content)
        self.cred_it.refresh_from_db()
        self.assertEqual(self.cred_it.notes, "self-edited")

    def test_employee_cannot_reassign_own_credential_to_other_user(self):
        self._auth(self.emp_it)
        response = self.client.patch(
            f"/api/credentials/{self.cred_it.id}/",
            {"user": self.emp_mkt.id},
            format="json",
        )
        self.assertEqual(response.status_code, 400)
        self.cred_it.refresh_from_db()
        self.assertEqual(self.cred_it.user_id, self.emp_it.id)

    def test_employee_cannot_touch_foreign_credential(self):
        self._auth(self.emp_it)
        response = self.client.patch(
            f"/api/credentials/{self.cred_mkt.id}/",
            {"notes": "hacked"},
            format="json",
        )
        # Foreign credential is not even visible to the employee queryset.
        self.assertEqual(response.status_code, 404)

    def test_employee_can_disable_own_credential(self):
        self._auth(self.emp_it)
        response = self.client.delete(f"/api/credentials/{self.cred_it.id}/")
        self.assertEqual(response.status_code, 204)
        self.cred_it.refresh_from_db()
        self.assertFalse(self.cred_it.is_active)
