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
- email-verified self-registration (email + IIN + department + password, confirmed by an emailed code), with Avatracker employee verification and duplicate protection;
- email + password login with a live Avatracker active-status check (inactive employees are blocked);
- password reset by emailed code and authenticated password change (current password required);
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
- custom user identity (`portal_login` derived from email), primary login by **email + password**;
- email-verified self-registration with employee validation against the Avatracker registry;
- live employee active-status enforcement on login;
- department-scoped RBAC (`employee` / `head` / superuser);
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

### 3. Start local stack
```bash
docker compose up -d --build
```

This starts backend, PostgreSQL, Adminer, and the Vite frontend. The frontend container proxies `/api` to `web:8000`.

### 4. Create superuser
```bash
docker compose exec web python manage.py createsuperuser
```

### 5. Optional: run frontend manually instead of Docker
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
EMAIL_NOTIFICATIONS_ENABLED=True
COLLECT_STATIC=1
WEB_CONCURRENCY=2
```

Email + password is the primary login path; `EMAIL_NOTIFICATIONS_ENABLED=True` plus real SMTP is required so registration and password-reset codes are actually delivered.

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

## SSH Server Deployment With Nginx

Use this path for a single Ubuntu server such as `rest-ubuntu@10.10.10.12`.
It runs PostgreSQL, Django/Gunicorn, React static files, and Nginx with Docker Compose.

### 1. Install Docker on the server
```bash
sudo apt update
sudo apt install -y ca-certificates curl git
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo ${UBUNTU_CODENAME:-$VERSION_CODENAME}) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker $USER
```

Log out and back in after `usermod`, or run:

```bash
newgrp docker
```

### 2. Upload or clone the project
Git clone option:

```bash
cd ~
git clone https://github.com/Dezaster5/Phoenix.git phoenix-vault
cd phoenix-vault
```

SCP option from your Windows machine:

```powershell
scp -r C:\Users\Мирас\Desktop\Программирование\Avataria\Phoenix rest-ubuntu@10.10.10.12:~/phoenix-vault
```

### 3. Create server env
```bash
cp scripts/.env.ssh.example .env
nano .env
```

Minimum values to change:
- `DJANGO_SECRET_KEY`
- `POSTGRES_PASSWORD`
- `DJANGO_ALLOWED_HOSTS` if the server IP/domain is not `10.10.10.12`
- `DJANGO_CSRF_TRUSTED_ORIGINS` if the server IP/domain is not `http://10.10.10.12`
- `FRONTEND_BASE_URL`

Generate a secret key:

```bash
openssl rand -base64 48
```

### 4. Start with Nginx
```bash
docker compose -f docker-compose.ssh.yml up -d --build
```

If port `80` is already used by system Nginx or another project, set this in `.env`:

```env
NGINX_HTTP_PORT=8088
DJANGO_CSRF_TRUSTED_ORIGINS=http://10.10.10.12:8088
DJANGO_CORS_ALLOWED_ORIGINS=http://10.10.10.12:8088
FRONTEND_BASE_URL=http://10.10.10.12:8088
```

Then start the stack and add a host Nginx reverse proxy:

```bash
sudo cp deploy/host-nginx-phoenix.conf /etc/nginx/sites-available/phoenix-vault
sudo ln -s /etc/nginx/sites-available/phoenix-vault /etc/nginx/sites-enabled/phoenix-vault
sudo nginx -t
sudo systemctl reload nginx
```

Open:
- Frontend: `http://10.10.10.12/`
- API health: `http://10.10.10.12/api/health/live/`
- Django admin: `http://10.10.10.12/admin/`
- Company admin: `http://10.10.10.12/company-admin/`

### 5. Generate encryption keys
The SSH compose file persists keys in the `phoenix_keys` Docker volume.

```bash
docker compose -f docker-compose.ssh.yml run --rm web python manage.py generate_rsa_keypair
docker compose -f docker-compose.ssh.yml restart web
```

### 6. Create superuser
```bash
docker compose -f docker-compose.ssh.yml exec web python manage.py createsuperuser
```

### Useful server commands
```bash
docker compose -f docker-compose.ssh.yml ps
docker compose -f docker-compose.ssh.yml logs -f web
docker compose -f docker-compose.ssh.yml logs -f nginx
docker compose -f docker-compose.ssh.yml restart web
docker compose -f docker-compose.ssh.yml down
```

For HTTPS later, put a domain on the server and replace the plain Nginx HTTP setup with TLS termination.

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
- `VERIFICATION_CHALLENGE_TTL_MINUTES` — TTL for registration / password-reset email codes (default `15`)

Primary auth behavior:
- login is **email + password**; on success the backend re-checks the employee in Avatracker by IIN and blocks inactive employees (`403`), or returns `503` if the registry is unavailable;
- registration is two-step: `POST /api/auth/register/` (sends an email code) then `POST /api/auth/register/verify/` (creates the account);
- password reset uses an emailed code; password change requires the current password;
- the passwordless / one-time-code login challenge remains available via `ALLOW_PASSWORDLESS_LOGIN` / `LOGIN_CHALLENGE_ENABLED` and should stay off in production.

### Email / SMTP
- `EMAIL_NOTIFICATIONS_ENABLED` — when `False`, emails (verification codes, notifications) are only logged, not sent;
- `EMAIL_BACKEND`, `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_HOST_USER`, `EMAIL_HOST_PASSWORD`, `EMAIL_USE_TLS`, `EMAIL_USE_SSL`, `DEFAULT_FROM_EMAIL`.

For Gmail SMTP: host `smtp.gmail.com`, port `587`, `EMAIL_USE_TLS=True`, and an **App Password** (not the account password) in `EMAIL_HOST_PASSWORD`. In `DEBUG` the code is also returned in the API response as `debug_code` for local testing.

### Employee registry / registration
- `AVATRACKER_EMPLOYEE_URL` — endpoint template, default: `https://avatracker.online/api/v1/employees/{iin}`
- `AVATRACKER_API_TOKEN` — token used by the backend to query the registry
- `AVATRACKER_AUTH_SCHEME` — authorization scheme, default: `Bearer` (Avatracker rejects `Token` with `401`)
- `AVATRACKER_TIMEOUT_SECONDS` — registry request timeout, default: `5`

Registration uses only the registry fields required by Phoenix:
- `iin`
- `full_name`
- `active`

If the IIN is not found, inactive, already registered, or the chosen email/login is already used, registration is rejected.

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
- configure real SMTP and set `EMAIL_NOTIFICATIONS_ENABLED=True` in production, otherwise registration and password-reset codes are never delivered;
- in production, keep `ALLOW_PASSWORDLESS_LOGIN=False` unless you intentionally allow direct non-challenge login for selected roles;
- review `CONTENT_SECURITY_POLICY` before enabling a strict CSP in front of Swagger/admin.

## Testing

### Backend
Run backend tests:
```bash
docker compose run --rm -e COLLECT_STATIC=0 web python manage.py test vault.tests
```

Current backend coverage includes:
- email registration + verification flow;
- email + password login with Avatracker active-status enforcement;
- password reset and password change flows;
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
