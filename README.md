# Phoenix Vault

Phoenix Vault is an internal access-management and credential-vault product built with Django, Django REST Framework, PostgreSQL, and React/Vite.

It is designed for organizations that need:
- department-scoped visibility;
- controlled credential distribution;
- approval-based access requests;
- auditability for sensitive actions;
- secure secret storage with encryption and history.

## Product Overview

Phoenix Vault supports three practical operating roles:
- `employee`: sees only their own assigned services and secrets;
- `head`: manages employees in their department, reviews access requests, manages department credentials, and can receive read-only access to other departments via `DepartmentShare`;
- `is_superuser`: full system visibility and control through Django admin and API.

Core product capabilities:
- credential storage with encrypted secret values;
- audit log with actor, IP, user agent, object, and action;
- access request workflow: create / approve / reject / cancel;
- credential version history;
- optional login challenge using one-time code or magic token;
- cross-department read-only visibility via department shares;
- API schema and Swagger docs;
- health endpoints for runtime checks.

## Architecture Summary

### Backend
- Django 4.2
- Django REST Framework
- PostgreSQL 16
- DRF token authentication
- department-aware visibility and permission rules
- encrypted secret storage using RSA envelope encryption with Fernet fallback

### Frontend
- React 18
- Vite
- React Router
- auth context + route guards
- manager/admin workflows for users, shares, requests, credentials, and audit

### Runtime
- Development:
  - Django `runserver`
  - local Postgres in Docker Compose
- Production-like Docker:
  - Gunicorn
  - WhiteNoise
  - Caddy reverse proxy

## Main Features

### Identity and access model
- custom user identity based on `portal_login`;
- department-scoped RBAC;
- read-only department sharing for cross-functional visibility.

### Secrets and credentials
- per-user per-service credentials;
- secret types:
  - password
  - SSH private key
  - API token
- SSH secret download support;
- credential version history for create/update/disable events.

### Request and review flow
- employees can request access to available services;
- department heads and superusers can approve or reject;
- approved requests create active service access;
- rejected requests keep review comments for user-facing visibility.

### Audit and compliance
- audit log endpoint and manager UI;
- filtering by actor, action, object type, and date range;
- CSV export for audit logs and access requests.

## Repository Layout

```text
Phoenix/
├─ phoenix/
│  ├─ manage.py
│  ├─ phoenix/                 # settings, urls, wsgi, asgi
│  └─ vault/                   # domain app
│     ├─ models.py
│     ├─ views.py
│     ├─ serializers.py
│     ├─ auth_backends.py
│     ├─ encryption.py
│     ├─ middleware.py
│     ├─ tests/
│     └─ management/commands/
├─ frontend/
│  ├─ src/
│  │  ├─ components/
│  │  ├─ context/
│  │  ├─ hooks/
│  │  └─ test/
├─ scripts/
├─ deploy/
├─ docker-compose.yml         # development flow
├─ docker-compose.prod.yml    # production-like local flow
├─ Dockerfile
├─ README.md
├─ BACKEND_ARCHITECTURE.md
├─ PROJECT_DOCUMENTATION.md
└─ er_diagram.md
```

## Documentation

- architecture notes: `BACKEND_ARCHITECTURE.md`
- broader project documentation: `PROJECT_DOCUMENTATION.md`
- ER diagram: `er_diagram.md`
- Codex/agent guidance: `AGENTS.md`

## Local Development

### 1. Prepare env files
```bash
cp .env.example .env
cp frontend/.env.example frontend/.env
```

### 2. Generate RSA keypair
```bash
docker compose run --rm web python manage.py generate_rsa_keypair
```

### 3. Start backend stack
```bash
docker compose up -d --build
```

### 4. Create superuser
```bash
docker compose exec web python manage.py createsuperuser
```

### 5. Start frontend
```bash
cd frontend
npm install
npm run dev
```

Useful local URLs:
- API: `http://localhost:8000/api/`
- Swagger: `http://localhost:8000/api/docs/`
- Django admin: `http://localhost:8000/admin/`
- Company admin: `http://localhost:8000/company-admin/`
- Frontend: `http://localhost:5173/`

## Production-Like Docker

Use this mode to verify a production-credible runtime locally.

### 1. Set production-oriented env values
Recommended minimum:

```env
DJANGO_DEBUG=False
ALLOW_PASSWORDLESS_LOGIN=False
PASSWORDLESS_ROLES=employee
LOGIN_CHALLENGE_ENABLED=True
COLLECT_STATIC=1
WEB_CONCURRENCY=2
```

### 2. Start the stack
```bash
docker compose -f docker-compose.prod.yml up -d --build
```

### 3. Check health
```bash
curl http://localhost/api/health/live/
curl http://localhost/api/health/ready/
```

Runtime details:
- `Dockerfile` uses `scripts/entrypoint.sh`;
- `entrypoint.sh` waits for DB, applies migrations, and runs `collectstatic` when enabled;
- Gunicorn serves Django;
- WhiteNoise serves static assets;
- Caddy proxies HTTP traffic to Django.

## Deployment

### Backend: Render
- point Render at the repo root `Dockerfile`;
- healthcheck path: `/api/health/live/`;
- use environment variables instead of committed env files;
- prefer `DATABASE_URL` when available.

### Database: Neon
You can configure either:
- `DATABASE_URL`
- or split `POSTGRES_*` variables.

### Frontend: Vercel
- set `Root Directory` to `frontend`;
- build command: `npm run build`;
- output directory: `dist`;
- set:

```env
VITE_API_URL=https://your-backend.example.com/api
```

## Environment Variables

### Required / important backend env
- `DJANGO_SECRET_KEY`
- `DJANGO_DEBUG`
- `DJANGO_ALLOWED_HOSTS`
- `DATABASE_URL` or `POSTGRES_*`
- `FRONTEND_BASE_URL`

### Auth and login flow
- `ALLOW_PASSWORDLESS_LOGIN`
- `PASSWORDLESS_ROLES`
- `LOGIN_CHALLENGE_ENABLED`
- `LOGIN_CHALLENGE_TTL_MINUTES`

Important auth behavior:
- direct login without challenge is restricted to configured `PASSWORDLESS_ROLES`;
- superusers are not allowed to bypass challenge through the direct passwordless path;
- when challenge mode is enabled, active users authenticate through one-time code / magic token flow.

### Public operational config exposed to frontend
- `PUBLIC_SUPPORT_EMAIL`
- `PUBLIC_LOGIN_REQUEST_SUBJECT`
- `PUBLIC_LOGIN_REQUEST_TEMPLATE`

### Security / transport
- `SECURE_HSTS_SECONDS`
- `SECURE_HSTS_INCLUDE_SUBDOMAINS`
- `SECURE_HSTS_PRELOAD`
- `SECURE_SSL_REDIRECT`
- `X_FRAME_OPTIONS`
- `SECURE_CONTENT_TYPE_NOSNIFF`
- `SECURE_REFERRER_POLICY`
- `SECURE_CROSS_ORIGIN_OPENER_POLICY`
- `CONTENT_SECURITY_POLICY`
- `PERMISSIONS_POLICY`

### Encryption
- `FERNET_KEY`
- `ASYMMETRIC_PUBLIC_KEY`
- `ASYMMETRIC_PRIVATE_KEY`
- `ASYMMETRIC_PUBLIC_KEY_PATH`
- `ASYMMETRIC_PRIVATE_KEY_PATH`

## Security Notes

- do not commit `.env` files or private keys;
- without the RSA private key, `asym:v1` secrets cannot be decrypted;
- in production, enable `LOGIN_CHALLENGE_ENABLED=True`;
- in production, keep `ALLOW_PASSWORDLESS_LOGIN=False` unless you intentionally allow direct non-challenge login for selected roles;
- configure SMTP if using email-based login challenge and notifications;
- review `CONTENT_SECURITY_POLICY` before enabling a strict CSP in front of Swagger/admin.

## Testing

### Backend
Run backend tests:
```bash
docker compose run --rm -e COLLECT_STATIC=0 web python manage.py test vault.tests
```

Current backend coverage includes:
- login challenge flow;
- direct login policy for privileged roles;
- access request workflow;
- department share permissions;
- audit visibility and export;
- credential history/version visibility;
- credential permission boundaries.

### Frontend
Frontend tests use Vitest + Testing Library:
```bash
cd frontend
npm install
npm run test -- --run
```

Frontend build:
```bash
cd frontend
npm run build
```

## CI

GitHub Actions currently run:
- backend migrations;
- backend test suite;
- OpenAPI schema validation;
- frontend tests;
- frontend build.

Workflow file:
- `.github/workflows/ci.yml`

## Operations

### Rotate encrypted credentials
```bash
docker compose exec web python manage.py rotate_credential_encryption
```

Dry run:
```bash
docker compose exec web python manage.py rotate_credential_encryption --dry-run
```

### Backup DB
```bash
./scripts/backup_db.sh ./backups
```

### Restore DB
```bash
./scripts/restore_db.sh ./backups/phoenix_YYYYMMDD_HHMMSS.dump
```

## Known Tradeoffs

- `CONTENT_SECURITY_POLICY` is env-driven but intentionally not forced to a strict default, because Swagger, Django admin, and reverse-proxy setups vary.
- frontend dependency lockfile regeneration could not be revalidated from this WSL environment; CI uses `npm install` rather than `npm ci` until lockfile is refreshed in a full Node environment.

## Product Identity

Selected product name:
- **Phoenix Vault**

`Avatariya` should be treated as organization context or tenant branding, not as the primary product name.
