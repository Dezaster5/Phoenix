# Phoenix Backend Architecture

> Note (2026-02-10): Roles and data model were updated.
> Current production logic uses `Department`, role `head` / `employee`, super-admin as Django `is_superuser`, and `DepartmentShare` for cross-department read-only visibility.
> If this document conflicts with code, trust current code in `phoenix/vault/models.py`, `phoenix/vault/views.py`, and `phoenix/vault/serializers.py`.

## Update 2026-02-19 (Security and Ops)
- Added `AccessRequest` workflow (employee request -> head/superuser approve/reject).
- Added `CredentialVersion` for history and rollback visibility.
- Added `LoginChallenge` for optional 2-step authentication (OTP / magic token).
- Extended `AuditLog` with `ip_address` and `user_agent`.
- Added API health endpoints: `/api/health/live/`, `/api/health/ready/`.
- Added OpenAPI + Swagger: `/api/schema/`, `/api/docs/`.
- Added key rotation command: `rotate_credential_encryption`.
- Added cleanup command: `cleanup_expired_security_data`.
- Added backup/restore scripts in `scripts/`.
- Added CI pipeline in `.github/workflows/ci.yml`.

## 1. Purpose
Phoenix backend is a Django + DRF service for:
- managing employee access to company services;
- storing per-user service credentials (login/password);
- enforcing visibility rules (user sees only own services/credentials);
- logging sensitive actions.

Core business roles:
- `admin`: creates users, assigns accesses, manages credentials.
- `employee`: read-only access to own data.

---

## 2. Runtime Stack
- Python `3.11`
- Django `4.2.28`
- Django REST Framework `3.15.1`
- PostgreSQL `16`
- Cryptography library for secret encryption
- Docker + docker-compose

Files:
- `Dockerfile`
- `docker-compose.yml`
- `requirements.txt`

---

## 3. Boot Flow (Docker)
`web` container command:
1. `python manage.py wait_for_db`
2. `python manage.py makemigrations --noinput`
3. `python manage.py migrate`
4. `python manage.py runserver 0.0.0.0:8000`

`db` container:
- PostgreSQL with persistent volume `postgres_data`.

Important note:
- running `makemigrations` on every boot is convenient for dev, but risky for production.

---

## 4. Django Settings (Key Points)
Main file: `phoenix/phoenix/settings.py`

- Custom user model: `AUTH_USER_MODEL = "vault.User"`
- Database: PostgreSQL via `POSTGRES_*` env vars
- REST auth: token-based (`TokenAuthentication`)
- Default permission: authenticated users only
- Custom auth backend:
  - `vault.auth_backends.PortalLoginBackend`
  - fallback `ModelBackend`
- CSRF trusted origins for frontend dev host
- Passwordless mode controlled by:
  - `ALLOW_PASSWORDLESS_LOGIN`
  - `PASSWORDLESS_ROLES`

Encryption-related env settings:
- symmetric fallback:
  - `FERNET_KEY`
- asymmetric envelope encryption:
  - `ASYMMETRIC_PUBLIC_KEY`
  - `ASYMMETRIC_PRIVATE_KEY`
  - `ASYMMETRIC_PUBLIC_KEY_PATH`
  - `ASYMMETRIC_PRIVATE_KEY_PATH`

---

## 5. Domain Model and Tables
Main file: `phoenix/vault/models.py`

### 5.1 `User` (`vault_user`)
Custom auth entity.

Fields:
- `portal_login` (unique)
- `email`
- `full_name`
- `role` (`admin` / `employee`)
- `is_active`
- `is_staff`
- `date_joined`
- inherited auth fields: `password`, `last_login`, permissions relations

Rules:
- login identity is `portal_login`.

### 5.2 `Category` (`vault_category`)
Service grouping.

Fields:
- `name` (unique)
- `sort_order`
- `is_active`
- `created_at`

### 5.3 `Service` (`vault_service`)
External/internal service descriptor.

Fields:
- `name`
- `url`
- `category_id` (nullable FK to `Category`)
- `is_active`
- `created_at`

Constraints:
- unique `(name, url)`.

### 5.4 `ServiceAccess` (`vault_serviceaccess`)
Explicit access mapping: user to service.

Fields:
- `user_id` FK -> `vault_user`
- `service_id` FK -> `vault_service`
- `is_active`
- `created_at`
- `updated_at`

Constraints:
- unique `(user_id, service_id)`.

### 5.5 `Credential` (`vault_credential`)
Per-user per-service credential pair.

Fields:
- `user_id` FK -> `vault_user`
- `service_id` FK -> `vault_service`
- `login`
- `password` (`EncryptedTextField`)
- `notes`
- `is_active`
- `created_at`
- `updated_at`

Constraints:
- unique `(user_id, service_id)`.

### 5.6 `AuditLog` (`vault_auditlog`)
Action tracking.

Fields:
- `actor_id` FK -> `vault_user` (nullable, `SET_NULL`)
- `action` (`create`, `update`, `view`, `disable`, `enable`, `login`)
- `object_type`
- `object_id`
- `metadata` (JSON)
- `created_at`

### 5.7 DRF Token (`authtoken_token`)
One token per user for API auth.

---

## 6. ER Model
See:
- `er_diagram.md`

Core relationships:
- `Category 1 -> * Service`
- `User 1 -> * ServiceAccess * -> 1 Service`
- `User 1 -> * Credential * -> 1 Service`
- `User 0..1 -> * AuditLog`

---

## 7. Encryption Design
Main file: `phoenix/vault/encryption.py`

### 7.1 Data Path
Credential secret field (`password`) uses `EncryptedTextField`:
- write path: `get_prep_value()` -> `encrypt_value()`
- read path: `from_db_value()/to_python()` -> `decrypt_value()`

### 7.2 Asymmetric Envelope Mode
Prefix marker:
- `ASYM_V1_PREFIX = "asym:v1:"`

Encryption flow:
1. generate random data key (32 bytes);
2. encrypt plaintext with `AES-256-GCM`;
3. encrypt data key with RSA public key (`OAEP-SHA256`);
4. store serialized payload as `asym:v1:<base64-json>`.

Payload keys:
- `alg`
- `ek` (encrypted data key)
- `n` (nonce)
- `ct` (ciphertext)

### 7.3 Backward Compatibility
If asymmetric keys are unavailable:
- fallback to Fernet encryption.

If stored value starts with `asym:v1:`:
- decrypt via private key.
- if private key missing, value cannot be decrypted.

If value is Fernet token (`gAAAAA...`):
- decrypt via Fernet.

### 7.4 Operational Implication
- losing `private_key.pem` means loss of ability to decrypt `asym:v1` records.
- keep secure backup outside runtime host.

---

## 8. Authentication and Authorization

### 8.1 Login Backend
File: `phoenix/vault/auth_backends.py`

`PortalLoginBackend` behavior:
- if `ALLOW_PASSWORDLESS_LOGIN=False`: returns no auth;
- accepts `portal_login` (also `username` or `login`);
- fetches active user by login;
- allows auth only if user role is in `PASSWORDLESS_ROLES`.

### 8.2 API Authentication
DRF uses:
- `TokenAuthentication`

Frontend calls:
- `POST /api/auth/login/`
- gets token
- passes `Authorization: Token <key>` in subsequent requests.

### 8.3 Permissions
File: `phoenix/vault/permissions.py`

- `IsCompanyAdmin`: authenticated admin only.
- `IsCompanyAdminOrReadOnly`:
  - safe methods (`GET/HEAD/OPTIONS`) for any authenticated user;
  - write methods only for admin.

---

## 9. API Endpoints
Routes file: `phoenix/vault/urls.py`
Project URL mount: `phoenix/phoenix/urls.py` -> `/api/`

### 9.1 Auth
- `POST /api/auth/login/`
  - request: `portal_login` (required), `password` (optional)
  - response: `token`, `portal_login`, `role`

- `GET /api/me/`
  - authenticated current user profile

### 9.2 Users
- `/api/users/` (`ModelViewSet`)
  - admin-only
  - `DELETE` = soft disable (`is_active=False`)

### 9.3 Categories
- `/api/categories/`
  - admin: full CRUD and full queryset
  - employee: read-only, filtered by accessible services

### 9.4 Services
- `/api/services/`
  - admin: full CRUD
  - employee: read-only, filtered by active `ServiceAccess`

### 9.5 Access Links
- `/api/accesses/`
  - admin: full CRUD
  - employee: reads own active entries
  - `DELETE` = soft disable

### 9.6 Credentials
- `/api/credentials/`
  - admin: full CRUD
  - employee: read-only own active credentials and active service access
  - `DELETE` = soft disable

---

## 10. View Layer and Filtering Rules
File: `phoenix/vault/views.py`

Implemented business filtering:
- employee can only list services with active `ServiceAccess`.
- employee can only list credentials where:
  - `Credential.user == request.user`
  - credential active
  - service active
  - category active or null
  - matching active `ServiceAccess`.

Audit logging in views:
- create/update/disable for major entities
- login events
- credential list view count.

---

## 11. Serializers
File: `phoenix/vault/serializers.py`

- `UserSerializer` (read)
- `UserWriteSerializer` (write, optional password)
- `CategorySerializer`
- `ServiceSerializer` (`category` read, `category_id` write)
- `CredentialReadSerializer` (nested `user` and `service`)
- `CredentialWriteSerializer`
- `ServiceAccessSerializer` (`user/service` read + `user_id/service_id` write)

---

## 12. Signals
File: `phoenix/vault/signals.py`

- on user creation: create DRF token.
- on credential save: ensure related `ServiceAccess` exists.

Result:
- assigning credentials automatically establishes logical access record.

---

## 13. Admin Panels

### 13.1 Developer Admin
URL: `/admin/`
File: `phoenix/vault/admin.py`

Registered models:
- `User`, `Category`, `Service`, `ServiceAccess`, `Credential`, `AuditLog`

### 13.2 Company Admin
URL: `/company-admin/`
File: `phoenix/vault/company_admin.py`

Access gate:
- only active users with `role=admin`.

Includes:
- user/service/access/credential management
- read-only audit log controls (no add/delete)

---

## 14. Migrations and Schema Evolution
Files:
- `phoenix/vault/migrations/0001_initial.py`
- `phoenix/vault/migrations/0002_serviceaccess.py`

Current model evolution:
1. initial domain + custom user + credentials + audit.
2. explicit `ServiceAccess` bridge added.

---

## 15. Environment Variables
Main files:
- `.env`
- `.env.example`

Critical runtime vars:
- Django: `DJANGO_SECRET_KEY`, `DJANGO_DEBUG`, `DJANGO_ALLOWED_HOSTS`
- CSRF: `DJANGO_CSRF_TRUSTED_ORIGINS`
- DB: `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_HOST`, `POSTGRES_PORT`
- Auth mode: `ALLOW_PASSWORDLESS_LOGIN`, `PASSWORDLESS_ROLES`
- Encryption: `FERNET_KEY`, `ASYMMETRIC_*`

Recommended key setup:
- `ASYMMETRIC_PUBLIC_KEY_PATH=keys/public_key.pem`
- `ASYMMETRIC_PRIVATE_KEY_PATH=keys/private_key.pem`

---

## 16. Operational Commands

### 16.1 Start
```bash
docker compose up -d --build
```

### 16.2 Generate RSA keypair
```bash
docker compose run --rm web python manage.py generate_rsa_keypair
```

### 16.3 Create superuser
```bash
docker compose exec web python manage.py createsuperuser
```

### 16.4 DB health
```bash
docker compose exec db pg_isready -U phoenix -d phoenix
```

### 16.5 Check credential encryption prefixes
```bash
docker compose exec db psql -U phoenix -d phoenix -c "SELECT id, LEFT(password, 20) FROM vault_credential ORDER BY id DESC LIMIT 20;"
```

Expected:
- new records: `asym:v1:...`
- old records: `gAAAAA...`

---

## 17. Security and Hardening Notes

Current design strengths:
- per-user credential isolation by queryset filtering;
- token auth (stateless API usage);
- encrypted credential storage with asymmetric option;
- action auditing.

Current risks and improvements:
- passwordless login for admins is enabled by default in `.env`.
- `makemigrations` in container startup is dev-only practice.
- private key file lifecycle needs strict secret management.
- project currently runs Django dev server in container.

Production recommendations:
- disable passwordless for admins.
- move to WSGI/ASGI server (`gunicorn`/`uvicorn`).
- run only `migrate` at startup.
- store private key in managed secret store, not repo path.
- enable HTTPS termination and strict host settings.

---

## 18. Known Behavioral Nuance
`PortalLoginBackend` accepts `username` alias in addition to `portal_login`.
This means calls that pass `username` can still authenticate passwordless if role is allowed.

If strict behavior is required:
- enforce only `portal_login` path;
- separate admin password auth from employee passwordless auth.

---

## 19. Frontend Interaction (Backend View)
Frontend uses:
- `POST /api/auth/login/`
- then token for all other calls.

Admin UI currently calls:
- users CRUD
- services list
- accesses CRUD
- credentials CRUD

Employee UI calls:
- credentials list (filtered by backend security rules).

---

## 20. Reference Files
- `phoenix/phoenix/settings.py`
- `phoenix/phoenix/urls.py`
- `phoenix/vault/models.py`
- `phoenix/vault/encryption.py`
- `phoenix/vault/auth_backends.py`
- `phoenix/vault/permissions.py`
- `phoenix/vault/serializers.py`
- `phoenix/vault/views.py`
- `phoenix/vault/urls.py`
- `phoenix/vault/signals.py`
- `phoenix/vault/admin.py`
- `phoenix/vault/company_admin.py`
- `phoenix/vault/forms.py`
- `phoenix/vault/migrations/0001_initial.py`
- `phoenix/vault/migrations/0002_serviceaccess.py`
- `phoenix/vault/management/commands/wait_for_db.py`
- `phoenix/vault/management/commands/generate_rsa_keypair.py`
- `docker-compose.yml`
- `Dockerfile`
- `er_diagram.md`
