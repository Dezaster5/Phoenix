from django.db import migrations, models


def convert_oauth_secret_type_to_api_token(apps, schema_editor):
    Credential = apps.get_model("vault", "Credential")
    CredentialVersion = apps.get_model("vault", "CredentialVersion")

    Credential.objects.filter(secret_type="oauth_client_secret").update(
        secret_type="api_token",
        login="api-token",
    )
    CredentialVersion.objects.filter(secret_type="oauth_client_secret").update(
        secret_type="api_token",
        login="api-token",
    )


class Migration(migrations.Migration):
    dependencies = [
        ("vault", "0007_credential_api_oauth_types"),
    ]

    operations = [
        migrations.RunPython(convert_oauth_secret_type_to_api_token, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="credential",
            name="secret_type",
            field=models.CharField(
                choices=[
                    ("password", "Password"),
                    ("ssh_key", "SSH Key"),
                    ("api_token", "API Token"),
                ],
                default="password",
                max_length=32,
            ),
        ),
        migrations.AlterField(
            model_name="credentialversion",
            name="secret_type",
            field=models.CharField(
                choices=[
                    ("password", "Password"),
                    ("ssh_key", "SSH Key"),
                    ("api_token", "API Token"),
                ],
                default="password",
                max_length=32,
            ),
        ),
        migrations.RemoveField(
            model_name="credential",
            name="oauth_client_id",
        ),
        migrations.RemoveField(
            model_name="credential",
            name="oauth_scopes",
        ),
        migrations.RemoveField(
            model_name="credential",
            name="oauth_token_url",
        ),
        migrations.RemoveField(
            model_name="credentialversion",
            name="oauth_client_id",
        ),
        migrations.RemoveField(
            model_name="credentialversion",
            name="oauth_scopes",
        ),
        migrations.RemoveField(
            model_name="credentialversion",
            name="oauth_token_url",
        ),
    ]
