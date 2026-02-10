from pathlib import Path

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from django.core.management.base import BaseCommand, CommandError


class Command(BaseCommand):
    help = "Generate RSA key pair for asymmetric envelope encryption."

    def add_arguments(self, parser):
        parser.add_argument(
            "--private-out",
            type=str,
            default="keys/private_key.pem",
            help="Path to write private key PEM.",
        )
        parser.add_argument(
            "--public-out",
            type=str,
            default="keys/public_key.pem",
            help="Path to write public key PEM.",
        )
        parser.add_argument(
            "--overwrite",
            action="store_true",
            help="Overwrite existing key files.",
        )

    def handle(self, *args, **options):
        private_out = Path(options["private_out"])
        public_out = Path(options["public_out"])
        overwrite = options["overwrite"]

        if (private_out.exists() or public_out.exists()) and not overwrite:
            raise CommandError(
                "Key file already exists. Use --overwrite to replace existing files."
            )

        private_out.parent.mkdir(parents=True, exist_ok=True)
        public_out.parent.mkdir(parents=True, exist_ok=True)

        private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
        public_key = private_key.public_key()

        private_pem = private_key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.PKCS8,
            encryption_algorithm=serialization.NoEncryption(),
        )
        public_pem = public_key.public_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PublicFormat.SubjectPublicKeyInfo,
        )

        private_out.write_bytes(private_pem)
        public_out.write_bytes(public_pem)

        self.stdout.write(self.style.SUCCESS(f"Private key written: {private_out}"))
        self.stdout.write(self.style.SUCCESS(f"Public key written: {public_out}"))
        self.stdout.write(
            "Set ASYMMETRIC_PUBLIC_KEY_PATH and ASYMMETRIC_PRIVATE_KEY_PATH in .env"
        )
