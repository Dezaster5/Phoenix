from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("vault", "0006_credential_ssh_metadata"),
    ]

    operations = [
        migrations.AlterField(
            model_name="credential",
            name="secret_type",
            field=models.CharField(
                choices=[
                    ("password", "Password"),
                    ("ssh_key", "SSH Key"),
                    ("api_token", "API Token"),
                    ("oauth_client_secret", "OAuth Client Secret"),
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
                    ("oauth_client_secret", "OAuth Client Secret"),
                ],
                default="password",
                max_length=32,
            ),
        ),
        migrations.AddField(
            model_name="credential",
            name="oauth_client_id",
            field=models.CharField(blank=True, default="", max_length=255),
        ),
        migrations.AddField(
            model_name="credential",
            name="oauth_scopes",
            field=models.TextField(blank=True, default=""),
        ),
        migrations.AddField(
            model_name="credential",
            name="oauth_token_url",
            field=models.URLField(blank=True, default="", max_length=500),
        ),
        migrations.AddField(
            model_name="credentialversion",
            name="oauth_client_id",
            field=models.CharField(blank=True, default="", max_length=255),
        ),
        migrations.AddField(
            model_name="credentialversion",
            name="oauth_scopes",
            field=models.TextField(blank=True, default=""),
        ),
        migrations.AddField(
            model_name="credentialversion",
            name="oauth_token_url",
            field=models.URLField(blank=True, default="", max_length=500),
        ),
    ]
