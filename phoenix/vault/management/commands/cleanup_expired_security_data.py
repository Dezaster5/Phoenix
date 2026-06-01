from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from vault.models import AuditLog, LoginChallenge


class Command(BaseCommand):
    help = "Cleanup expired login challenges and old audit logs."

    def add_arguments(self, parser):
        parser.add_argument(
            "--audit-days",
            type=int,
            default=180,
            help="Delete audit logs older than this number of days. Use 0 to skip.",
        )
        parser.add_argument(
            "--purge-credential-list-views",
            action="store_true",
            help="Delete noisy audit rows created by credential list page loads.",
        )

    def handle(self, *args, **options):
        now = timezone.now()
        expired_qs = LoginChallenge.objects.filter(
            expires_at__lt=now - timedelta(days=1),
        )
        expired_deleted, _ = expired_qs.delete()
        self.stdout.write(f"Deleted login challenge rows: {expired_deleted}")

        audit_days = int(options["audit_days"])
        if audit_days > 0:
            cutoff = now - timedelta(days=audit_days)
            audit_qs = AuditLog.objects.filter(created_at__lt=cutoff)
            audit_deleted, _ = audit_qs.delete()
            self.stdout.write(f"Deleted audit rows: {audit_deleted}")
        else:
            self.stdout.write("Audit cleanup skipped.")

        if options["purge_credential_list_views"]:
            deleted, _ = AuditLog.objects.filter(
                action=AuditLog.Action.VIEW,
                object_type="Credential",
                object_id="list",
            ).delete()
            self.stdout.write(f"Deleted credential list view audit rows: {deleted}")
