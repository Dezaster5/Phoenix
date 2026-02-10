# Phoenix: Полная документация проекта

## 1. Назначение проекта

`Phoenix` - внутренний сервис хранения доступов сотрудников к рабочим системам компании.

Основная идея:
- сотрудник входит в Phoenix по выданному админом `portal_login`;
- видит только свои сервисы;
- по каждому сервису видит свои учетные данные (`login` + `password`);
- данные паролей в БД хранятся в зашифрованном виде.

Роли пользователей:
- `admin`: управляет пользователями, доступами к сервисам, кредами;
- `employee`: только чтение своих назначенных сервисов и кредов.

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
- `phoenix/vault/auth_backends.py`
- `phoenix/vault/views.py` (`PortalLoginView`)

Логика входа:
1. `POST /api/auth/login/` принимает `portal_login` (и опционально `password`).
2. Если включен passwordless (`ALLOW_PASSWORDLESS_LOGIN=True`) и роль входит в `PASSWORDLESS_ROLES`, пользователь может войти без пароля.
3. После успешного входа возвращается DRF token.

Важно:
- по умолчанию в `.env.example` стоит `PASSWORDLESS_ROLES=employee,admin`.
- это означает, что и `admin`, и `employee` могут входить по логину без пароля.
- для более строгой безопасности рекомендуется:
  - `PASSWORDLESS_ROLES=employee`
  - для `admin` использовать парольный вход.

### 4.3 Авторизация (permissions)

Файл: `phoenix/vault/permissions.py`

- `IsCompanyAdmin`: доступ только для активного authenticated пользователя с `role=admin`.
- `IsCompanyAdminOrReadOnly`:
  - safe методы (`GET/HEAD/OPTIONS`) доступны любому authenticated;
  - запись (`POST/PATCH/DELETE`) только `admin`.

### 4.4 Модели и таблицы БД

Файл: `phoenix/vault/models.py`

#### `User` -> таблица `vault_user`
- поля: `portal_login` (unique), `email`, `full_name`, `role`, `is_active`, `is_staff`, `date_joined`, `password`, `last_login`
- `USERNAME_FIELD = "portal_login"`

#### `Category` -> `vault_category`
- `name` (unique), `sort_order`, `is_active`, `created_at`

#### `Service` -> `vault_service`
- `name`, `url`, `category_id` (nullable FK), `is_active`, `created_at`
- уникальность: `(name, url)`

#### `ServiceAccess` -> `vault_serviceaccess`
- связь пользователя и сервиса
- `user_id`, `service_id`, `is_active`, `created_at`, `updated_at`
- уникальность: `(user_id, service_id)`

#### `Credential` -> `vault_credential`
- креды пользователя в конкретном сервисе
- `user_id`, `service_id`, `login`, `password` (EncryptedTextField), `notes`, `is_active`, `created_at`, `updated_at`
- уникальность: `(user_id, service_id)`

#### `AuditLog` -> `vault_auditlog`
- `actor_id`, `action`, `object_type`, `object_id`, `metadata`, `created_at`
- хранит события входа, создания, обновления, выключения и просмотра

#### DRF token table
- `authtoken_token` (one token per user)

### 4.5 ER-диаграмма

См. файл: `er_diagram.md`

Ключевые связи:
- `Category 1 -> * Service`
- `User 1 -> * ServiceAccess * -> 1 Service`
- `User 1 -> * Credential * -> 1 Service`
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

Доступ только для активных пользователей с `role=admin`.

---

## 5. API документация (backend)

Базовый префикс: `/api/`  
Роутинг: `phoenix/vault/urls.py`

### 5.1 Аутентификация

#### `POST /api/auth/login/`
- `AllowAny`
- body:
```json
{
  "portal_login": "marketing.team"
}
```
- response:
```json
{
  "token": "xxxxxxxxxxxxxxxx",
  "portal_login": "marketing.team",
  "role": "employee"
}
```

#### `GET /api/me/`
- требует `Authorization: Token <token>`
- возвращает профиль текущего пользователя

### 5.2 Users

`/api/users/` (`ModelViewSet`)
- доступ: только `admin`
- `DELETE` реализован как soft-disable (`is_active=False`)

### 5.3 Categories

`/api/categories/`
- admin: полный CRUD
- employee: read-only, отфильтровано по сервисам, к которым есть доступ

### 5.4 Services

`/api/services/`
- admin: полный CRUD
- employee: только активные сервисы из активных `ServiceAccess`

### 5.5 ServiceAccess

`/api/accesses/`
- admin: полный CRUD
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
- admin: полный CRUD
- employee: только свои активные креды и только по активному доступу
- `DELETE`: soft-disable (`is_active=False`)
- `GET list` логируется в `AuditLog` с количеством записей

Формат создания:
```json
{
  "user": 3,
  "service": 8,
  "login": "user@example.com",
  "password": "secret",
  "notes": "read only",
  "is_active": true
}
```

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
4. Рекомендуется убрать `admin` из passwordless ролей:
   - `PASSWORDLESS_ROLES=employee`
5. Текущий `docker-compose.yml` включает `makemigrations` на старте:
   - удобно в dev,
   - нежелательно в production.

---

## 11. Известные нюансы текущей реализации

1. `PortalLoginBackend` стоит первым в `AUTHENTICATION_BACKENDS` и при включенном passwordless может авторизовать без проверки пароля для разрешенных ролей.
2. `User`, `ServiceAccess`, `Credential` при `DELETE` выключаются (soft-delete), а `Category` и `Service` удаляются стандартно (hard-delete).
3. Если private key недоступен, `asym:v1:` запись не расшифруется и вернется как есть.
4. `wait_for_db` бесконечно ждет БД (полезно для контейнера, но без лимита retry).

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

- Быстрый старт: `README.md`
- Техническая архитектура backend: `BACKEND_ARCHITECTURE.md`
- ER диаграмма: `er_diagram.md`

