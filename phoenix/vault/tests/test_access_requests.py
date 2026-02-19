from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.test.utils import override_settings
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
        # For regular employees queryset is scoped to own requests only, so foreign
        # request detail endpoints are hidden as not found.
        self.assertEqual(response.status_code, 404)

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

    def test_employee_cannot_create_duplicate_pending_request(self):
        self._auth(self.employee)
        first = self.client.post(
            "/api/access-requests/",
            {"service_id": self.service.id, "justification": "Need access"},
            format="json",
        )
        self.assertEqual(first.status_code, 201)

        second = self.client.post(
            "/api/access-requests/",
            {"service_id": self.service.id, "justification": "Still need access"},
            format="json",
        )
        self.assertEqual(second.status_code, 400)

    def test_request_cannot_be_canceled_after_approval(self):
        access_request = AccessRequest.objects.create(
            requester=self.employee,
            service=self.service,
            status=AccessRequest.Status.APPROVED,
            requested_at=timezone.now() - timedelta(minutes=2),
            reviewed_at=timezone.now() - timedelta(minutes=1),
        )
        self._auth(self.employee)
        response = self.client.post(
            f"/api/access-requests/{access_request.id}/cancel/",
            {"review_comment": "cancel"},
            format="json",
        )
        self.assertEqual(response.status_code, 400)

    def test_approve_saves_review_comment_and_reviewer(self):
        access_request = AccessRequest.objects.create(
            requester=self.employee,
            service=self.service,
            status=AccessRequest.Status.PENDING,
        )
        self._auth(self.head)
        response = self.client.post(
            f"/api/access-requests/{access_request.id}/approve/",
            {"review_comment": "OK for campaign"},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        access_request.refresh_from_db()
        self.assertEqual(access_request.status, AccessRequest.Status.APPROVED)
        self.assertEqual(access_request.reviewer_id, self.head.id)
        self.assertEqual(access_request.review_comment, "OK for campaign")
        self.assertIsNotNone(access_request.reviewed_at)

    def test_reject_saves_review_comment_and_reviewer(self):
        access_request = AccessRequest.objects.create(
            requester=self.employee,
            service=self.service,
            status=AccessRequest.Status.PENDING,
        )
        self._auth(self.head)
        response = self.client.post(
            f"/api/access-requests/{access_request.id}/reject/",
            {"review_comment": "Not needed now"},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        access_request.refresh_from_db()
        self.assertEqual(access_request.status, AccessRequest.Status.REJECTED)
        self.assertEqual(access_request.reviewer_id, self.head.id)
        self.assertEqual(access_request.review_comment, "Not needed now")
        self.assertIsNotNone(access_request.reviewed_at)

    @override_settings(EMAIL_NOTIFICATIONS_ENABLED=False)
    def test_create_request_does_not_send_email_when_notifications_disabled(self):
        self._auth(self.employee)
        with patch("vault.notifications.send_mail") as mocked_send_mail:
            response = self.client.post(
                "/api/access-requests/",
                {"service_id": self.service.id, "justification": "Need for work"},
                format="json",
            )
        self.assertEqual(response.status_code, 201)
        mocked_send_mail.assert_not_called()

    @override_settings(EMAIL_NOTIFICATIONS_ENABLED=True)
    def test_create_request_sends_email_when_notifications_enabled(self):
        self._auth(self.employee)
        with patch("vault.notifications.send_mail") as mocked_send_mail:
            response = self.client.post(
                "/api/access-requests/",
                {"service_id": self.service.id, "justification": "Need for work"},
                format="json",
            )
        self.assertEqual(response.status_code, 201)
        mocked_send_mail.assert_called_once()
