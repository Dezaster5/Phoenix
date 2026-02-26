# Phoenix

Credential vault service for company employees (Django + PostgreSQL + React).

## What Is Implemented
- Department-based RBAC (`head`, `employee`, `is_superuser`)
- Cross-department read-only visibility (`DepartmentShare`)
- Credential storage with encryption (`EncryptedTextField`, RSA envelope encryption + Fernet fallback)
- Credential version history (`CredentialVersion`)
- Access request workflow (`AccessRequest`): create / approve / reject / cancel
- Audit logging (`AuditLog`) with IP and User-Agent
- Optional 2-step login challenge (one-time code / magic token)
- API schema and Swagger UI (`/api/schema/`, `/api/docs/`)
- Health endpoints (`/api/health/live/`, `/api/health/ready/`)
- CI pipeline for backend + frontend (`.github/workflows/ci.yml`)

## Documentation
- Full project documentation (RU): `PROJECT_DOCUMENTATION.md`
- Backend architecture details: `BACKEND_ARCHITECTURE.md`
- ER diagram: `er_diagram.md`

## Stack
- Django 4.2 + DRF
- DRF Spectacular (OpenAPI/Swagger)
- PostgreSQL 16
- React + Vite
- Docker Compose

## Local Start (Backend in Docker)
1. Create env files:
```bash
cp .env.example .env
cp frontend/.env.example frontend/.env
```

2. Generate RSA key pair:
```bash
docker compose run --rm web python manage.py generate_rsa_keypair
```

3. Start services:
```bash
docker compose up -d --build
```

4. Run migrations:
```bash
docker compose exec web python manage.py migrate
```

5. Create superuser:
```bash
docker compose exec web python manage.py createsuperuser
```

## Frontend Dev
```bash
cd frontend
npm install
npm run dev
```

If Vite reports `http proxy error` with `ECONNREFUSED`, ensure backend is running on `:8000`.
For custom dev environments (for example WSL/Windows networking), set `frontend/.env`:
```env
VITE_PROXY_TARGET=http://127.0.0.1:8000
```

## Test Deploy: Backend via ngrok + Frontend via Vercel
This is a quick test setup (not production).

1. Start backend in Docker:
```bash
docker compose up -d --build
```

2. Start tunnel to backend (choose one):
```bash
# local ngrok binary
ngrok http 8000
```
or
```bash
# dockerized ngrok (uses service from docker-compose.yml)
docker compose --profile tunnel up -d ngrok
docker compose logs -f ngrok
```
Before dockerized ngrok, set `NGROK_AUTHTOKEN` in `.env`.
Copy the HTTPS URL, for example: `https://abc123.ngrok-free.app`

3. Update backend env (`.env`) and restart backend:
```env
DJANGO_DEBUG=False
DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1,abc123.ngrok-free.app
DJANGO_CSRF_TRUSTED_ORIGINS=https://abc123.ngrok-free.app,https://your-vercel-domain.vercel.app
DJANGO_CORS_ALLOWED_ORIGINS=https://abc123.ngrok-free.app,https://your-vercel-domain.vercel.app
```
Optional for changing ngrok domains:
```env
DJANGO_CORS_ALLOWED_ORIGIN_REGEXES=https://.*\.ngrok-free\.app
```
Then restart:
```bash
docker compose up -d --build web
```

4. Deploy frontend to Vercel:
- Import this repo in Vercel.
- Set `Root Directory` to `frontend`.
- Build command: `npm run build`
- Output directory: `dist`
- Add env var:
```env
VITE_API_URL=https://abc123.ngrok-free.app/api
```
- Redeploy frontend.

5. Smoke check:
- Open Vercel URL.
- Login should call `https://abc123.ngrok-free.app/api/auth/login/`.
- Open browser devtools and confirm no CORS errors.

Note: with ngrok your laptop is the actual backend server. ngrok only forwards traffic. If laptop sleeps, turns off, or Docker stops, backend becomes unavailable.

## Important Endpoints
- API root: `http://localhost:8000/api/`
- Schema: `http://localhost:8000/api/schema/`
- Swagger UI: `http://localhost:8000/api/docs/`
- Health live: `http://localhost:8000/api/health/live/`
- Health ready: `http://localhost:8000/api/health/ready/`
- Django admin: `http://localhost:8000/admin/`
- Company admin: `http://localhost:8000/company-admin/`

## Security Settings (`.env`)
Minimal recommended:
```env
DJANGO_DEBUG=False
DJANGO_ALLOWED_HOSTS=your-domain.com
ALLOW_PASSWORDLESS_LOGIN=True
PASSWORDLESS_ROLES=employee,head
LOGIN_CHALLENGE_ENABLED=True
EMAIL_NOTIFICATIONS_ENABLED=True
```

If you enable login challenge, configure SMTP env variables too (`EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_HOST_USER`, `EMAIL_HOST_PASSWORD`, `DEFAULT_FROM_EMAIL`).

## Key Rotation
After updating encryption keys, rotate stored credential payloads:
```bash
docker compose exec web python manage.py rotate_credential_encryption
```
Dry run:
```bash
docker compose exec web python manage.py rotate_credential_encryption --dry-run
```

## DB Backup / Restore
Backup:
```bash
./scripts/backup_db.sh ./backups
```
Restore:
```bash
./scripts/restore_db.sh ./backups/phoenix_YYYYMMDD_HHMMSS.dump
```

## Test
Local (if DB is up):
```bash
docker compose exec web python manage.py test vault.tests
```

## Security Notes
- Never commit `.env` or private keys.
- Keep `phoenix/keys/private_key.pem` outside public repositories.
- Keep backup of private key; without it `asym:v1` payloads cannot be decrypted.
