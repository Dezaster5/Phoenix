from datetime import timedelta

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from vault.models import AccessRequest, Department, Service, ServiceAccess

User = get_user_model()


class AccessRequestFlowTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.department = Department.objects.create(name="IT")
        self.head = User.objects.create_user(
            portal_login="head.it",
            role=User.Role.HEAD,
            department=self.department,
            email="head@example.com",
        )
        self.employee = User.objects.create_user(
            portal_login="emp.it",
            role=User.Role.EMPLOYEE,
            department=self.department,
            email="emp@example.com",
        )
        self.other_employee = User.objects.create_user(
            portal_login="emp.other",
            role=User.Role.EMPLOYEE,
            email="other@example.com",
        )
        self.service = Service.objects.create(
            name="Repo",
            url="https://repo.local",
            department=self.department,
        )

    def _auth(self, user):
        self.client.force_authenticate(user=user)

    def test_employee_creates_request_and_head_approves(self):
        self._auth(self.employee)
        create_response = self.client.post(
            "/api/access-requests/",
            {"service_id": self.service.id, "justification": "Need for work"},
            format="json",
        )
        self.assertEqual(create_response.status_code, 201)
        request_id = create_response.json()["id"]

        self._auth(self.head)
        approve_response = self.client.post(
            f"/api/access-requests/{request_id}/approve/",
            {"review_comment": "approved"},
            format="json",
        )
        self.assertEqual(approve_response.status_code, 200)
        self.assertEqual(approve_response.json()["status"], AccessRequest.Status.APPROVED)
        self.assertTrue(
            ServiceAccess.objects.filter(
                user=self.employee,
                service=self.service,
                is_active=True,
            ).exists()
        )

    def test_employee_cannot_approve_other_employee_request(self):
        access_request = AccessRequest.objects.create(
            requester=self.employee,
            service=self.service,
            status=AccessRequest.Status.PENDING,
            requested_at=timezone.now() - timedelta(minutes=1),
        )
        self._auth(self.other_employee)
        response = self.client.post(f"/api/access-requests/{access_request.id}/approve/", format="json")
        self.assertEqual(response.status_code, 403)

    def test_employee_can_cancel_own_pending_request(self):
        self._auth(self.employee)
        create_response = self.client.post(
            "/api/access-requests/",
            {"service_id": self.service.id, "justification": "Need for reporting"},
            format="json",
        )
        request_id = create_response.json()["id"]

        cancel_response = self.client.post(
            f"/api/access-requests/{request_id}/cancel/",
            {"review_comment": "No longer needed"},
            format="json",
        )
        self.assertEqual(cancel_response.status_code, 200)
        self.assertEqual(cancel_response.json()["status"], AccessRequest.Status.CANCELED)
