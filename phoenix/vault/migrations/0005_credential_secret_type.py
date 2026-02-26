from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("vault", "0004_security_hardening"),
    ]

    operations = [
        migrations.AddField(
            model_name="credential",
            name="secret_type",
            field=models.CharField(
                choices=[("password", "Password"), ("ssh_key", "SSH Key")],
                default="password",
                max_length=16,
            ),
        ),
        migrations.AddField(
            model_name="credentialversion",
            name="secret_type",
            field=models.CharField(
                choices=[("password", "Password"), ("ssh_key", "SSH Key")],
                default="password",
                max_length=16,
            ),
        ),
    ]
