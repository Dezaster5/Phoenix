from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("vault", "0005_credential_secret_type"),
    ]

    operations = [
        migrations.AddField(
            model_name="credential",
            name="secret_filename",
            field=models.CharField(blank=True, default="", max_length=255),
        ),
        migrations.AddField(
            model_name="credential",
            name="ssh_algorithm",
            field=models.CharField(
                blank=True,
                choices=[("ed25519", "Ed25519"), ("rsa", "RSA"), ("ecdsa", "ECDSA")],
                default="",
                max_length=16,
            ),
        ),
        migrations.AddField(
            model_name="credential",
            name="ssh_fingerprint",
            field=models.CharField(blank=True, default="", max_length=128),
        ),
        migrations.AddField(
            model_name="credential",
            name="ssh_host",
            field=models.CharField(blank=True, default="", max_length=255),
        ),
        migrations.AddField(
            model_name="credential",
            name="ssh_port",
            field=models.PositiveIntegerField(default=22),
        ),
        migrations.AddField(
            model_name="credential",
            name="ssh_public_key",
            field=models.TextField(blank=True, default=""),
        ),
        migrations.AddField(
            model_name="credentialversion",
            name="secret_filename",
            field=models.CharField(blank=True, default="", max_length=255),
        ),
        migrations.AddField(
            model_name="credentialversion",
            name="ssh_algorithm",
            field=models.CharField(
                blank=True,
                choices=[("ed25519", "Ed25519"), ("rsa", "RSA"), ("ecdsa", "ECDSA")],
                default="",
                max_length=16,
            ),
        ),
        migrations.AddField(
            model_name="credentialversion",
            name="ssh_fingerprint",
            field=models.CharField(blank=True, default="", max_length=128),
        ),
        migrations.AddField(
            model_name="credentialversion",
            name="ssh_host",
            field=models.CharField(blank=True, default="", max_length=255),
        ),
        migrations.AddField(
            model_name="credentialversion",
            name="ssh_port",
            field=models.PositiveIntegerField(default=22),
        ),
        migrations.AddField(
            model_name="credentialversion",
            name="ssh_public_key",
            field=models.TextField(blank=True, default=""),
        ),
    ]
