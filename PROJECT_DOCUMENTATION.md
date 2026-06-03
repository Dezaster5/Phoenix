# Phoenix: Полная документация проекта

> Важно (2026-02-10): модель ролей и отделов обновлена.
> Текущая схема: `Department`, роли `head` и `employee`, супер-админ как Django `is_superuser`, межотдельский read-only через `DepartmentShare`.
> Если где-то в документе остались старые упоминания `admin`/`Category`, ориентируйся на актуальный код в `phoenix/vault/`.

## Обновление 2026-02-19
- Добавлен workflow заявок на доступ: `AccessRequest`.
- Добавлено версионирование кредов: `CredentialVersion`.
- Добавлена опциональная 2FA-авторизация через одноразовый код/магическую ссылку: `LoginChallenge`.
- Расширен аудит: IP и User-Agent в `AuditLog`.
- Добавлены health endpoints: `/api/health/live/` и `/api/health/ready/`.
- Добавлены API schema/docs: `/api/schema/`, `/api/docs/`.
- Добавлены команды:
  - `python manage.py rotate_credential_encryption`
  - `python manage.py cleanup_expired_security_data`
- Добавлены скрипты backup/restore БД (`scripts/backup_db.sh`, `scripts/restore_db.sh`).
- Добавлен CI workflow (`.github/workflows/ci.yml`).

## Обновление 2026-06-03 (Email-аутентификация)
- Основной вход теперь по **email + паролю**. Поле `User.email` уникальное и nullable (пустая строка нормализуется в `NULL`).
- **Регистрация в два шага**:
  1. `POST /api/auth/register/` — форма `email + ИИН + отдел + пароль + подтверждение`. Бэкенд проверяет сотрудника в Avatracker (`active=true`) и отправляет 6-значный код на почту. Данные будущего аккаунта хранятся в `EmailVerificationChallenge.payload`, сам пользователь ещё не создаётся.
  2. `POST /api/auth/register/verify/` — подтверждение кода и создание активного аккаунта роли `employee`. `portal_login` генерируется из части email до `@`.
- **Проверка активности при входе**: при входе по email+паролю бэкенд повторно запрашивает Avatracker по ИИН. Если `active=false` → `403`, если реестр недоступен → `503`.
- **Сброс пароля** по коду из почты: `POST /api/auth/password-reset/request/` → `POST /api/auth/password-reset/confirm/`.
- **Смена пароля** для авторизованного пользователя с обязательным вводом текущего пароля: `POST /api/auth/password/change/`.
- Новая модель `EmailVerificationChallenge` (purpose `registration` / `password_reset`), код хранится как salted SHA-256, с лимитом попыток и TTL (`VERIFICATION_CHALLENGE_TTL_MINUTES`, по умолчанию 15).
- Новый модуль-помощник `phoenix/vault/auth_helpers.py`.
- `AVATRACKER_AUTH_SCHEME` по умолчанию теперь `Bearer` (Avatracker отклоняет схему `Token` с ошибкой `401`).
- Старый endpoint `/api/auth/register-iin/` оставлен для обратной совместимости.

## 1. Назначение проекта

`Phoenix Vault` - внутренний сервис хранения доступов сотрудников к рабочим системам компании.

Основная идея:
- сотрудник регистрируется по email + ИИН (с проверкой в Avatracker) и входит по email + паролю;
- видит только свои сервисы;
- по каждому сервису видит свои учетные данные (`login` + секрет);
- секреты в БД хранятся в зашифрованном виде.

Роли пользователей:
- `is_superuser`: полный доступ ко всей системе (Django admin + API);
- `head`: управляет сотрудниками своего отдела, разбирает заявки на доступ, ведёт креды отдела, может получать межотдельский read-only через `DepartmentShare`;
- `employee`: чтение своих назначенных сервисов и кредов, самостоятельная регистрация и заявки на доступ.

> Отдельной бизнес-роли `admin` нет; где строка `admin` ещё встречается, она трактуется как `head`.

---

## 2. Технологический стек

- Backend: `Django 4.2`, `Django REST Framework`
- DB: `PostgreSQL 16`
- Шифрование: `cryptography` (RSA-OAEP + AES-GCM, fallback Fernet)
- Frontend: `React + Vite`
- Контейнеризация: `Docker`, `docker compose`

Основные зависимости: `requirements.txt`.

---

## 3. Структура репозитория

```text
Phoenix/
├─ phoenix/                      # Django project root
│  ├─ manage.py
│  ├─ phoenix/                   # Django settings/urls/wsgi/asgi
│  └─ vault/                     # Главный доменный app
│     ├─ models.py
│     ├─ views.py
│     ├─ serializers.py
│     ├─ permissions.py
│     ├─ auth_backends.py
│     ├─ encryption.py
│     ├─ signals.py
│     ├─ admin.py               # dev/admin для разработчиков
│     ├─ company_admin.py       # отдельная админка компании
│     ├─ forms.py
│     ├─ urls.py
│     ├─ migrations/
│     └─ management/commands/
├─ frontend/                     # React UI
├─ docker-compose.yml
├─ Dockerfile
├─ .env.example
├─ README.md
├─ BACKEND_ARCHITECTURE.md
└─ er_diagram.md
```

---

## 4. Backend архитектура

### 4.1 Конфигурация Django

Файл: `phoenix/phoenix/settings.py`

Ключевые точки:
- кастомный пользователь: `AUTH_USER_MODEL = "vault.User"`;
- DRF auth: `TokenAuthentication`;
- default permission: `IsAuthenticated`;
- auth backends:
  - `vault.auth_backends.PortalLoginBackend`
  - `django.contrib.auth.backends.ModelBackend`;
- Postgres берется из `POSTGRES_*` переменных;
- поддержка SSL mode для внешнего Postgres: `POSTGRES_SSLMODE`;
- CSRF trusted origins читается из `DJANGO_CSRF_TRUSTED_ORIGINS`.

### 4.2 Аутентификация

Файлы:
- `phoenix/vault/views.py` (`PortalLoginView`, `RegistrationRequestView`, `RegistrationVerifyView`, `PasswordReset*`, `PasswordChangeView`)
- `phoenix/vault/auth_helpers.py`
- `phoenix/vault/security.py`
- `phoenix/vault/auth_backends.py` (passwordless / challenge режим)

Основная логика входа (`POST /api/auth/login/`, email + пароль):
1. поиск активного пользователя по email;
2. проверка пароля (`User.check_password`);
3. повторная проверка сотрудника в Avatracker по `iin`:
   - `active=false` → `403`;
   - реестр недоступен → `503`;
4. выдача DRF-токена и запись события `LOGIN` в аудит.

Регистрация, сброс и смена пароля идут через коды на почту (см. обновление 2026-06-03). Смена пароля дополнительно требует текущий пароль.

Доставка кодов:
- письма уходят только при `EMAIL_NOTIFICATIONS_ENABLED=True`;
- иначе сообщение пишется в лог, а в `DEBUG` код возвращается в ответе API как `debug_code`.

Passwordless / challenge режим (`PortalLoginBackend`) остаётся доступным через `ALLOW_PASSWORDLESS_LOGIN` / `LOGIN_CHALLENGE_ENABLED` и в проде должен быть отключён.

### 4.3 Авторизация (permissions)

Файл: `phoenix/vault/permissions.py`

- доступ ограничен по отделам: `head` управляет сотрудниками своего отдела, `employee` — read-only по своим данным;
- `is_superuser` имеет полный доступ;
- межотдельский read-only выдаётся через активные непросроченные `DepartmentShare`.

### 4.4 Модели и таблицы БД

Файл: `phoenix/vault/models.py`

#### `User` -> таблица `vault_user`
- поля: `portal_login` (unique), `iin` (unique, nullable), `email` (unique, nullable), `full_name`, `role` (`head`/`employee`), `department_id` (nullable FK), `is_active`, `is_staff`, `is_superuser`, `date_joined`, `password`, `last_login`
- `USERNAME_FIELD = "portal_login"`, но фактический вход — по email + паролю

#### `Department` -> `vault_department`
- `name` (unique), `sort_order`, `is_active`, `created_at`

#### `Service` -> `vault_service`
- `name`, `url`, `department_id` (nullable FK), `is_active`, `created_at`
- уникальность: `(name, url)`

#### `ServiceAccess` -> `vault_serviceaccess`
- связь пользователя и сервиса
- `user_id`, `service_id`, `is_active`, `created_at`, `updated_at`
- уникальность: `(user_id, service_id)`

#### `Credential` -> `vault_credential`
- креды пользователя в конкретном сервисе
- `user_id`, `service_id`, `login`, `secret_type` (`password`/`ssh_key`/`api_token`), SSH-поля, `password` (EncryptedTextField — зашифрованный секрет), `notes`, `is_active`, `created_at`, `updated_at`
- уникальность: `(user_id, service_id)`

#### `DepartmentShare` -> `vault_departmentshare`
- межотдельский read-only: `department_id`, `grantor_id`, `grantee_id`, `expires_at`, `is_active`
- уникальность: `(department_id, grantor_id, grantee_id)`

#### `AccessRequest` -> `vault_accessrequest`
- заявки на доступ: `requester_id`, `service_id`, `status` (`pending`/`approved`/`rejected`/`canceled`), `justification`, `reviewer_id`, `review_comment`, `requested_at`, `reviewed_at`

#### `CredentialVersion` -> `vault_credentialversion`
- история кредов: снимок полей + `change_type` (`create`/`update`/`disable`/`rotate`), `changed_by_id`, `version`
- уникальность: `(credential_id, version)`

#### `LoginChallenge` -> `vault_loginchallenge`
- опциональный вход по одноразовому коду/магической ссылке

#### `EmailVerificationChallenge` -> `vault_emailverificationchallenge`
- регистрация и сброс пароля: `purpose`, `email`, `user_id` (nullable), `payload` (данные будущего аккаунта), `code_digest`, `salt`, TTL и лимит попыток

#### DRF token table
- `authtoken_token` (one token per user)

### 4.5 ER-диаграмма

См. файл: [er_diagram.md](https://github.com/Dezaster5/Phoenix/blob/main/er_diagram.md)

Ключевые связи:
- `Department 1 -> * User`
- `Department 1 -> * Service`
- `User 1 -> * ServiceAccess * -> 1 Service`
- `User 1 -> * Credential * -> 1 Service`
- `Credential 1 -> * CredentialVersion`
- `User 1 -> * AccessRequest * -> 1 Service`
- `User 0..1 -> * AuditLog`
- `User 1 -> 1 Token`

### 4.6 Шифрование паролей

Файл: `phoenix/vault/encryption.py`

`Credential.password` использует `EncryptedTextField`.

#### Режим 1: асимметричное envelope encryption (предпочтительный)
- маркер префикса: `asym:v1:`
- шаги:
  1. генерируется случайный data key (32 байта),
  2. пароль шифруется `AES-256-GCM`,
  3. data key шифруется RSA public key (OAEP SHA-256),
  4. payload сериализуется в base64 JSON и пишется в БД.

Если видишь в БД `password` с префиксом `asym:v1:`, запись создана новым режимом.

#### Режим 2: fallback Fernet
- если RSA ключи недоступны, используется Fernet (токены вида `gAAAAA...`).
- старые Fernet записи по-прежнему читаются.

Критичный момент:
- потеря `private_key.pem` делает невозможной расшифровку `asym:v1:` записей.

### 4.7 Signals

Файл: `phoenix/vault/signals.py`

- при создании пользователя автоматически создается DRF token;
- при сохранении `Credential` автоматически создается `ServiceAccess`, если его нет.

### 4.8 Админ-панели

#### `/admin/` (developer admin)
Файл: `phoenix/vault/admin.py`

Полный доступ к моделям для staff/superuser.

#### `/company-admin/` (company admin)
Файл: `phoenix/vault/company_admin.py`

Доступ только для активных company-админов (`head` / `is_superuser`).

---

## 5. API документация (backend)

Базовый префикс: `/api/`  
Роутинг: `phoenix/vault/urls.py`

### 5.1 Аутентификация и аккаунт

#### `POST /api/auth/login/`
- `AllowAny`
- body:
```json
{
  "email": "ivan.ivanov@company.kz",
  "password": "StrongPass123!"
}
```
- response:
```json
{
  "token": "xxxxxxxxxxxxxxxx",
  "portal_login": "ivan.ivanov",
  "role": "employee",
  "is_superuser": false,
  "full_name": "Иван Иванов",
  "department": { "id": 1, "name": "IT" }
}
```
- `403`, если сотрудник неактивен в Avatracker; `503`, если реестр недоступен.

#### `POST /api/auth/register/`
- `AllowAny`; body: `email`, `iin`, `department_id`, `password`, `password_confirm`
- проверяет сотрудника в Avatracker и отправляет код на почту (`202`)

#### `POST /api/auth/register/verify/`
- `AllowAny`; body: `email`, `code`
- создаёт активный аккаунт `employee` (`201`)

#### `POST /api/auth/password-reset/request/` и `/confirm/`
- запрос кода по `email`, затем подтверждение `email` + `code` + новый пароль

#### `POST /api/auth/password/change/`
- авторизовано; body: `current_password`, `password`, `password_confirm`

#### `GET /api/me/`
- требует `Authorization: Token <token>`
- возвращает профиль текущего пользователя

#### Публичные данные для экрана входа
- `GET /api/config/public/`, `GET /api/public/departments/`

### 5.2 Users

`/api/users/` (`ModelViewSet`)
- доступ: `head` (свой отдел) / `is_superuser`
- `DELETE` реализован как soft-disable (`is_active=False`)

### 5.3 Departments

`/api/departments/`
- управление отделами (с учётом области видимости); `is_superuser` — полный CRUD

### 5.4 Services

`/api/services/`
- `head`/`is_superuser`: управление
- employee: только активные сервисы из активных `ServiceAccess`

### 5.5 ServiceAccess

`/api/accesses/`
- `head`/`is_superuser`: управление
- employee: читает только свои активные записи
- `DELETE`: soft-disable (`is_active=False`)

Формат создания:
```json
{
  "user_id": 3,
  "service_id": 8,
  "is_active": true
}
```

### 5.6 Credentials

`/api/credentials/`
- `head`/`is_superuser`: управление
- employee: только свои активные креды и только по активному доступу
- `DELETE`: soft-disable (`is_active=False`)
- `GET list` логируется в `AuditLog` с количеством записей
- поддержка скачивания SSH-секрета

### 5.7 Workflow и аудит

- `/api/access-requests/` — заявки: создание / approve / reject / cancel
- `/api/department-shares/` — межотдельский read-only
- `/api/audit-logs/` — аудит и CSV-экспорт
- `/api/health/live/`, `/api/health/ready/` — проверки рантайма

---

## 6. Переменные окружения

Источник: `.env` / `.env.example`

### Django
- `DJANGO_DEBUG`
- `DJANGO_SECRET_KEY`
- `DJANGO_ALLOWED_HOSTS`
- `DJANGO_CSRF_TRUSTED_ORIGINS`

### PostgreSQL
- `POSTGRES_DB`
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `POSTGRES_HOST`
- `POSTGRES_PORT`
- `POSTGRES_SSLMODE` (`require` для Neon)

### Auth mode
- `ALLOW_PASSWORDLESS_LOGIN`
- `PASSWORDLESS_ROLES`
- `LOGIN_CHALLENGE_ENABLED`
- `LOGIN_CHALLENGE_TTL_MINUTES`
- `VERIFICATION_CHALLENGE_TTL_MINUTES`

### Email / SMTP
- `EMAIL_NOTIFICATIONS_ENABLED` (если `False` — письма только пишутся в лог)
- `EMAIL_BACKEND`, `EMAIL_HOST`, `EMAIL_PORT`
- `EMAIL_HOST_USER`, `EMAIL_HOST_PASSWORD`
- `EMAIL_USE_TLS`, `EMAIL_USE_SSL`
- `DEFAULT_FROM_EMAIL`

### Employee registry (Avatracker)
- `AVATRACKER_EMPLOYEE_URL`
- `AVATRACKER_API_TOKEN`
- `AVATRACKER_AUTH_SCHEME` (по умолчанию `Bearer`)
- `AVATRACKER_TIMEOUT_SECONDS`

### Encryption
- `FERNET_KEY` (optional)
- `ASYMMETRIC_PUBLIC_KEY`
- `ASYMMETRIC_PRIVATE_KEY`
- `ASYMMETRIC_PUBLIC_KEY_PATH`
- `ASYMMETRIC_PRIVATE_KEY_PATH`

---

## 7. Локальный запуск (Docker)

1. Подготовка env:
```bash
cp .env.example .env
cp frontend/.env.example frontend/.env
```

2. Генерация RSA ключей:
```bash
docker compose run --rm web python manage.py generate_rsa_keypair
```

3. Запуск:
```bash
docker compose up -d --build
```

4. Создание суперпользователя:
```bash
docker compose exec web python manage.py createsuperuser
```

5. Проверка:
- API: `http://localhost:8000/api/`
- admin: `http://localhost:8000/admin/`
- company-admin: `http://localhost:8000/company-admin/`

---

## 8. Проверка БД и диагностика

### Подключиться к psql внутри контейнера
```bash
docker compose exec db psql -U phoenix -d phoenix
```

### Показать таблицы
```sql
\dt
```

### Проверить пользователей
```sql
SELECT id, portal_login, role, is_active
FROM vault_user
ORDER BY id DESC
LIMIT 50;
```

### Проверить доступы
```sql
SELECT id, user_id, service_id, is_active, created_at
FROM vault_serviceaccess
ORDER BY id DESC
LIMIT 50;
```

### Проверить креды и префиксы шифрования
```sql
SELECT id, user_id, service_id, login, LEFT(password, 20) AS pass_prefix, is_active
FROM vault_credential
ORDER BY id DESC
LIMIT 50;
```

Ожидаемо:
- `asym:v1:...` -> асимметричный режим,
- `gAAAAA...` -> Fernet legacy/fallback.

### Проверить аудит
```sql
SELECT id, actor_id, action, object_type, object_id, created_at
FROM vault_auditlog
ORDER BY id DESC
LIMIT 100;
```

---

## 9. Деплой для проверки (Render + Neon)

### 9.1 Neon
- создаешь базу;
- берешь connection details;
- раскладываешь в env:
  - `POSTGRES_DB`
  - `POSTGRES_USER`
  - `POSTGRES_PASSWORD`
  - `POSTGRES_HOST`
  - `POSTGRES_PORT=5432`
  - `POSTGRES_SSLMODE=require`

### 9.2 Render Web Service

Build command:
```bash
pip install -r requirements.txt
```

Start command:
```bash
python phoenix/manage.py migrate && python phoenix/manage.py runserver 0.0.0.0:$PORT
```

Обязательные env в Render:
- `DJANGO_DEBUG=False`
- `DJANGO_SECRET_KEY=<secure>`
- `DJANGO_ALLOWED_HOSTS=<service>.onrender.com`
- `DJANGO_CSRF_TRUSTED_ORIGINS=https://<service>.onrender.com`
- все `POSTGRES_*` под Neon

Ключи для асимметрии:
- лучше положить в Render Secret Files и указать
  - `ASYMMETRIC_PUBLIC_KEY_PATH=/etc/secrets/public_key.pem`
  - `ASYMMETRIC_PRIVATE_KEY_PATH=/etc/secrets/private_key.pem`

---

## 10. Безопасность: что важно держать под контролем

1. Не коммитить `.env` и PEM ключи.
2. Хранить `private_key.pem` в безопасном backup.
3. На проде:
   - `DJANGO_DEBUG=False`
   - ограниченный `DJANGO_ALLOWED_HOSTS`
   - HTTPS обязательно
4. Держать passwordless выключенным на проде: `ALLOW_PASSWORDLESS_LOGIN=False`.
5. Настроить реальный SMTP и `EMAIL_NOTIFICATIONS_ENABLED=True`, иначе коды регистрации/сброса не доставляются (видны только в логах / `debug_code` в DEBUG).
6. Текущий dev `docker-compose.yml` включает `makemigrations` на старте:
   - удобно в dev,
   - нежелательно в production (используйте `docker-compose.prod.yml`).

---

## 11. Известные нюансы текущей реализации

1. `PortalLoginBackend` стоит первым в `AUTHENTICATION_BACKENDS` и при включенном passwordless может авторизовать без проверки пароля для разрешенных ролей.
2. `User`, `ServiceAccess`, `Credential` при `DELETE` выключаются (soft-delete), а `Department` и `Service` удаляются стандартно (hard-delete).
3. Если private key недоступен, `asym:v1:` запись не расшифруется и вернется как есть.
4. `wait_for_db` бесконечно ждет БД (полезно для контейнера, но без лимита retry).
5. При входе по email+паролю выполняется внешний запрос в Avatracker; недоступность реестра блокирует вход (`503`).
6. `portal_login` генерируется из части email до `@` и остаётся `USERNAME_FIELD`, но в обычном входе не используется.

---

## 12. Полезные команды эксплуатации

```bash
# состояние контейнеров
docker compose ps

# live логи backend
docker compose logs -f web

# health check БД
docker compose exec db pg_isready -U phoenix -d phoenix

# проверки Django
docker compose exec web python manage.py check

# миграции вручную
docker compose exec web python manage.py migrate
```

---

## 13. Связанные документы

- Быстрый старт: [README.md](https://github.com/Dezaster5/Phoenix/blob/main/README.md)
- Техническая архитектура backend: [BACKEND_ARCHITECTURE.md](https://github.com/Dezaster5/Phoenix/blob/main/BACKEND_ARCHITECTURE.md)
- ER диаграмма: [er_diagram.md](https://github.com/Dezaster5/Phoenix/blob/main/er_diagram.md)
