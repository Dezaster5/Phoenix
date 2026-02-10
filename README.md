# Phoenix

Credential vault service for company employees (Django + PostgreSQL + React).

## Documentation
- Full project documentation (RU): `PROJECT_DOCUMENTATION.md`
- Backend architecture details: `BACKEND_ARCHITECTURE.md`
- ER diagram: `er_diagram.md`

## Stack
- Django 4.2 + DRF
- PostgreSQL 16
- React + Vite
- Docker Compose

## 1) Local Start (Backend in Docker)
1. Create env files from templates:
```bash
cp .env.example .env
cp frontend/.env.example frontend/.env
```

2. Generate RSA key pair (for asymmetric encryption of credentials):
```bash
docker compose run --rm web python manage.py generate_rsa_keypair
```

3. Start containers:
```bash
docker compose up -d --build
```

4. Create superuser:
```bash
docker compose exec web python manage.py createsuperuser
```

5. Open backend endpoints:
- API root: `http://localhost:8000/api/`
- Django admin: `http://localhost:8000/admin/`
- Company admin: `http://localhost:8000/company-admin/`

## 2) Frontend Start (Local Dev)
Frontend runs separately from Docker in this repo:
```bash
cd frontend
npm install
npm run dev
```
Open: `http://localhost:5173/`

## 3) Deploy Smoke Check
Run and verify:
```bash
docker compose up -d --build
docker compose ps
docker compose exec db pg_isready -U phoenix -d phoenix
docker compose exec web python manage.py check
docker compose exec db psql -U phoenix -d phoenix -c "SELECT now();"
```

Check encrypted credential values in DB:
```bash
docker compose exec db psql -U phoenix -d phoenix -c "SELECT id, LEFT(password, 20) AS pass_prefix FROM vault_credential ORDER BY id DESC LIMIT 20;"
```

Expected:
- New records: prefix `asym:v1:`
- Legacy records: may start with `gAAAAA...` (Fernet fallback compatibility)

## 4) GitHub Push Checklist
1. Ensure secrets are not tracked:
```bash
git status --short
```

2. Commit:
```bash
git add .
git commit -m "Prepare project for GitHub and deploy smoke check"
```

3. Push:
```bash
git branch -M main
git remote add origin <YOUR_GITHUB_REPO_URL>
git push -u origin main
```

## Security Notes
- Never commit `.env` and PEM keys from `phoenix/keys/`.
- Keep `private_key.pem` in a secure backup location.
- For real production: set `DJANGO_DEBUG=False`, strict `DJANGO_ALLOWED_HOSTS`, HTTPS, and secure cookies.
