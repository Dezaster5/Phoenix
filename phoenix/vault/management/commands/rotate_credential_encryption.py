from django.core.management.base import BaseCommand
from django.db import transaction

from vault.models import Credential, CredentialVersion


class Command(BaseCommand):
    help = "Re-encrypt all credential passwords using current encryption settings."

    def add_arguments(self, parser):
        parser.add_argument(
            "--batch-size",
            type=int,
            default=200,
            help="Database batch size for iterator.",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Show how many credentials would be rotated without saving.",
        )
        parser.add_argument(
            "--no-version",
            action="store_true",
            help="Do not create CredentialVersion entries for rotation.",
        )

    def handle(self, *args, **options):
        batch_size = max(1, int(options["batch_size"]))
        dry_run = bool(options["dry_run"])
        create_version = not bool(options["no_version"])

        qs = Credential.objects.select_related("user", "service").all().order_by("id")
        total = qs.count()
        rotated = 0

        self.stdout.write(f"Found credentials: {total}")
        if dry_run:
            self.stdout.write(self.style.WARNING("Dry-run mode enabled. No changes will be saved."))
            return

        for credential in qs.iterator(chunk_size=batch_size):
            with transaction.atomic():
                plaintext_password = credential.password
                credential.password = plaintext_password
                credential.save(update_fields=["password", "updated_at"])

                if create_version:
                    max_version = (
                        CredentialVersion.objects.filter(credential=credential).order_by("-version").values_list("version", flat=True).first()
                        or 0
                    )
                    CredentialVersion.objects.create(
                        credential=credential,
                        version=max_version + 1,
                        login=credential.login,
                        password=credential.password,
                        notes=credential.notes,
                        is_active=credential.is_active,
                        change_type=CredentialVersion.ChangeType.ROTATE,
                        changed_by=None,
                    )

                rotated += 1
                if rotated % batch_size == 0:
                    self.stdout.write(f"Rotated: {rotated}/{total}")

        self.stdout.write(self.style.SUCCESS(f"Rotation complete. Rotated {rotated} credentials."))
