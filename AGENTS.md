# AGENTS.md

Repo-specific guidance for future Codex runs in `Dezaster5/Phoenix`.

## Product Context

Phoenix Vault is an internal security/access-management product:
- Django + DRF backend
- React + Vite frontend
- PostgreSQL
- department-aware RBAC
- credential storage and encrypted secrets
- access requests
- audit logging
- credential history

The current product identity is **Phoenix Vault**.
Avoid reintroducing mixed visible branding such as `Avatariya Vault Access` unless it is explicitly tenant/company context.

## Ground Rules

1. Preserve the domain model and permission semantics unless there is a strong reason to refactor.
2. Do not break:
- employee self-service access request flow
- manager approve/reject flow
- department-share read-only visibility
- SSH key download flow
- audit logging
3. Prefer small, testable changes over large rewrites.
4. Keep Russian UI copy unless a file is clearly documentation for developers.
5. Treat security-sensitive UX carefully:
- secrets stay masked by default
- reveal must be explicit
- avoid accidental secret leakage in logs/errors/tests

## Backend Notes

Important files:
- `phoenix/vault/models.py`
- `phoenix/vault/views.py`
- `phoenix/vault/serializers.py`
- `phoenix/vault/permissions.py`
- `phoenix/vault/encryption.py`
- `phoenix/vault/security.py`

Current runtime split:
- dev: `docker-compose.yml` + Django `runserver`
- production-like: `docker-compose.prod.yml` + Gunicorn + WhiteNoise + Caddy

Prefer:
- `DATABASE_URL` in hosted deployments
- `POSTGRES_*` fallback for local/dev

When changing auth:
- review `PortalLoginView`
- review `PortalLoginBackend`
- keep superuser handling explicit
- keep challenge flow test-covered

## Frontend Notes

Important files:
- `frontend/src/App.jsx`
- `frontend/src/context/AuthContext.jsx`
- `frontend/src/hooks/usePhoenixAppState.js`
- `frontend/src/components/AdminPanel.jsx`
- `frontend/src/components/VaultPage.jsx`
- `frontend/src/components/ServicesPage.jsx`

Architecture direction:
- routing in `App.jsx`
- auth/session in `AuthContext`
- app data orchestration in `usePhoenixAppState`
- page-level UI in components

When adding new UI:
- prefer compact tables over large cards for admin/operator flows
- keep interactions explicit and scannable
- use existing CSS system in `frontend/src/styles.css`
- avoid adding heavy UI libraries unless the value is clear

## Testing

Backend tests live in:
- `phoenix/vault/tests/`

Frontend tests live in:
- `frontend/src/**/*.test.jsx`

Before finishing significant work:
- run backend tests:
  - `docker compose run --rm -e COLLECT_STATIC=0 web python manage.py test vault.tests`
- run frontend tests/build when Node runtime is available:
  - `cd frontend && npm run test -- --run`
  - `cd frontend && npm run build`

## Documentation

When behavior changes materially, update:
- `README.md`
- `BACKEND_ARCHITECTURE.md` if backend semantics changed
- `.env.example` / `frontend/.env.example` / `scripts/.env.for_render.example`

## Known Operational Caveat

In this environment, frontend package lock regeneration may be blocked by missing local Node runtime / WSL constraints. If frontend dependencies change and `package-lock.json` cannot be regenerated locally:
- keep CI using `npm install` temporarily
- document the tradeoff in `README.md`
- refresh `package-lock.json` later from a full Node environment
