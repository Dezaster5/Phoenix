import os
from pathlib import Path

import dj_database_url
from dotenv import load_dotenv
from corsheaders.defaults import default_headers

load_dotenv()

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent


def env_list(name, default=""):
    return [item.strip() for item in os.getenv(name, default).split(",") if item.strip()]


def env_bool(name, default=False):
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def env_int(name, default):
    value = os.getenv(name)
    if value is None or value == "":
        return default
    return int(value)


# Quick-start development settings - unsuitable for production
# See https://docs.djangoproject.com/en/4.2/howto/deployment/checklist/

# SECURITY WARNING: keep the secret key used in production secret!
SECRET_KEY = os.getenv(
    "DJANGO_SECRET_KEY",
    "django-insecure--eror00&0uw2ef2mj5r4p2d!45)hj0g7#+g-2de)_2z^$^tm=l",
)

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = env_bool("DJANGO_DEBUG", True)

ALLOWED_HOSTS = env_list("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1")

CSRF_TRUSTED_ORIGINS = env_list(
    "DJANGO_CSRF_TRUSTED_ORIGINS",
    "http://localhost:5173,http://127.0.0.1:5173",
)
CORS_ALLOWED_ORIGINS = env_list(
    "DJANGO_CORS_ALLOWED_ORIGINS",
    "http://localhost:5173,http://127.0.0.1:5173",
)
CORS_ALLOWED_ORIGIN_REGEXES = env_list("DJANGO_CORS_ALLOWED_ORIGIN_REGEXES")
CORS_ALLOW_CREDENTIALS = env_bool("DJANGO_CORS_ALLOW_CREDENTIALS", False)
CORS_EXPOSE_HEADERS = env_list("DJANGO_CORS_EXPOSE_HEADERS", "content-disposition")
CORS_ALLOW_HEADERS = list(default_headers) + env_list(
    "DJANGO_CORS_ALLOW_HEADERS_EXTRA",
    "ngrok-skip-browser-warning",
)


# Application definition

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'corsheaders',
    'rest_framework',
    'rest_framework.authtoken',
    'drf_spectacular',
    'vault.apps.VaultConfig',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    'vault.middleware.SecurityHeadersMiddleware',
]

ROOT_URLCONF = 'phoenix.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'phoenix.wsgi.application'


# Database
# https://docs.djangoproject.com/en/4.2/ref/settings/#databases

db_options = {}
postgres_sslmode = os.getenv("POSTGRES_SSLMODE")
if postgres_sslmode:
    db_options["sslmode"] = postgres_sslmode
database_url = os.getenv("DATABASE_URL", "").strip()
if database_url:
    DATABASES = {
        "default": dj_database_url.parse(
            database_url,
            conn_max_age=env_int("POSTGRES_CONN_MAX_AGE", 60),
            ssl_require=postgres_sslmode == "require",
        )
    }
else:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.postgresql",
            "NAME": os.getenv("POSTGRES_DB", "phoenix"),
            "USER": os.getenv("POSTGRES_USER", "phoenix"),
            "PASSWORD": os.getenv("POSTGRES_PASSWORD", "phoenix"),
            "HOST": os.getenv("POSTGRES_HOST", "db"),
            "PORT": os.getenv("POSTGRES_PORT", "5432"),
            "CONN_MAX_AGE": env_int("POSTGRES_CONN_MAX_AGE", 60),
            "OPTIONS": db_options,
        }
    }

AUTH_USER_MODEL = "vault.User"

AUTHENTICATION_BACKENDS = [
    "vault.auth_backends.PortalLoginBackend",
    "django.contrib.auth.backends.ModelBackend",
]

ALLOW_PASSWORDLESS_LOGIN = env_bool("ALLOW_PASSWORDLESS_LOGIN", DEBUG)
PASSWORDLESS_ROLES = []
for role in os.getenv("PASSWORDLESS_ROLES", "employee").split(","):
    role = role.strip()
    if not role:
        continue
    PASSWORDLESS_ROLES.append("head" if role == "admin" else role)

LOGIN_CHALLENGE_ENABLED = env_bool("LOGIN_CHALLENGE_ENABLED", not DEBUG)
LOGIN_CHALLENGE_TTL_MINUTES = env_int("LOGIN_CHALLENGE_TTL_MINUTES", 10)
FRONTEND_BASE_URL = os.getenv("FRONTEND_BASE_URL", "http://localhost:5173")
PUBLIC_SUPPORT_EMAIL = os.getenv("PUBLIC_SUPPORT_EMAIL", "")
PUBLIC_LOGIN_REQUEST_SUBJECT = os.getenv("PUBLIC_LOGIN_REQUEST_SUBJECT", "Запрос логина Phoenix Vault")
PUBLIC_LOGIN_REQUEST_TEMPLATE = os.getenv(
    "PUBLIC_LOGIN_REQUEST_TEMPLATE",
    "Здравствуйте!%0A%0AПрошу выдать логин для доступа в Phoenix Vault.%0AФИО: ____%0AОтдел: ____%0AДолжность: ____%0AКорпоративная почта: ____%0AНужные сервисы: ____%0A%0AСпасибо!",
).replace("%0A", "\n")

EMAIL_NOTIFICATIONS_ENABLED = env_bool("EMAIL_NOTIFICATIONS_ENABLED", False)
EMAIL_BACKEND = os.getenv(
    "EMAIL_BACKEND",
    "django.core.mail.backends.console.EmailBackend" if DEBUG else "django.core.mail.backends.smtp.EmailBackend",
)
EMAIL_HOST = os.getenv("EMAIL_HOST", "localhost")
EMAIL_PORT = env_int("EMAIL_PORT", 25)
EMAIL_HOST_USER = os.getenv("EMAIL_HOST_USER", "")
EMAIL_HOST_PASSWORD = os.getenv("EMAIL_HOST_PASSWORD", "")
EMAIL_USE_TLS = env_bool("EMAIL_USE_TLS", False)
EMAIL_USE_SSL = env_bool("EMAIL_USE_SSL", False)
DEFAULT_FROM_EMAIL = os.getenv("DEFAULT_FROM_EMAIL", "phoenix-vault@example.com")

FERNET_KEY = os.getenv("FERNET_KEY")
ASYMMETRIC_PUBLIC_KEY = os.getenv("ASYMMETRIC_PUBLIC_KEY")
ASYMMETRIC_PRIVATE_KEY = os.getenv("ASYMMETRIC_PRIVATE_KEY")
ASYMMETRIC_PUBLIC_KEY_PATH = os.getenv("ASYMMETRIC_PUBLIC_KEY_PATH")
ASYMMETRIC_PRIVATE_KEY_PATH = os.getenv("ASYMMETRIC_PRIVATE_KEY_PATH")

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework.authentication.TokenAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "DEFAULT_THROTTLE_RATES": {
        "login_burst": os.getenv("THROTTLE_LOGIN_BURST", "10/min"),
        "login_sustained": os.getenv("THROTTLE_LOGIN_SUSTAINED", "50/hour"),
        "access_request_create": os.getenv("THROTTLE_ACCESS_REQUEST_CREATE", "20/day"),
    },
}

SPECTACULAR_SETTINGS = {
    "TITLE": "Phoenix Vault API",
    "DESCRIPTION": "API для управления доступами, кредами, отделами и аудитом.",
    "VERSION": "1.0.0",
}

if not DEBUG:
    SECURE_HSTS_SECONDS = env_int("SECURE_HSTS_SECONDS", 3600)
    SECURE_HSTS_INCLUDE_SUBDOMAINS = env_bool("SECURE_HSTS_INCLUDE_SUBDOMAINS", True)
    SECURE_HSTS_PRELOAD = env_bool("SECURE_HSTS_PRELOAD", True)
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
    SECURE_SSL_REDIRECT = env_bool("SECURE_SSL_REDIRECT", False)

SESSION_COOKIE_HTTPONLY = True
CSRF_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = os.getenv("SESSION_COOKIE_SAMESITE", "Lax")
CSRF_COOKIE_SAMESITE = os.getenv("CSRF_COOKIE_SAMESITE", "Lax")
X_FRAME_OPTIONS = os.getenv("X_FRAME_OPTIONS", "DENY")
SECURE_CONTENT_TYPE_NOSNIFF = env_bool("SECURE_CONTENT_TYPE_NOSNIFF", True)
SECURE_REFERRER_POLICY = os.getenv("SECURE_REFERRER_POLICY", "same-origin")
SECURE_CROSS_ORIGIN_OPENER_POLICY = os.getenv("SECURE_CROSS_ORIGIN_OPENER_POLICY", "same-origin")
CONTENT_SECURITY_POLICY = os.getenv("CONTENT_SECURITY_POLICY", "").strip()
PERMISSIONS_POLICY = os.getenv("PERMISSIONS_POLICY", "camera=(), microphone=(), geolocation=()").strip()

LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "standard": {
            "format": "%(asctime)s %(levelname)s %(name)s %(message)s",
        }
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "standard",
        }
    },
    "loggers": {
        "django": {"handlers": ["console"], "level": LOG_LEVEL},
        "vault": {"handlers": ["console"], "level": LOG_LEVEL, "propagate": False},
    },
}


# Password validation
# https://docs.djangoproject.com/en/4.2/ref/settings/#auth-password-validators

AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]


# Internationalization
# https://docs.djangoproject.com/en/4.2/topics/i18n/

LANGUAGE_CODE = 'en-us'

TIME_ZONE = 'UTC'

USE_I18N = True

USE_TZ = True


# Static files (CSS, JavaScript, Images)
# https://docs.djangoproject.com/en/4.2/howto/static-files/

STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
STATICFILES_STORAGE = "whitenoise.storage.CompressedManifestStaticFilesStorage"

# Default primary key field type
# https://docs.djangoproject.com/en/4.2/ref/settings/#default-auto-field

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'
