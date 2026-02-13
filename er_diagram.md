```mermaid
erDiagram
    USER {
        bigint id PK
        varchar portal_login UK
        varchar email
        varchar full_name
        varchar role
        bigint department_id FK
        bool is_active
        bool is_staff
        bool is_superuser
        datetime date_joined
    }

    DEPARTMENT {
        bigint id PK
        varchar name UK
        int sort_order
        bool is_active
        datetime created_at
    }

    SERVICE {
        bigint id PK
        varchar name
        varchar url
        bigint department_id FK
        bool is_active
        datetime created_at
    }

    SERVICE_ACCESS {
        bigint id PK
        bigint user_id FK
        bigint service_id FK
        bool is_active
        datetime created_at
        datetime updated_at
    }

    CREDENTIAL {
        bigint id PK
        bigint user_id FK
        bigint service_id FK
        varchar login
        text password_encrypted
        text notes
        bool is_active
        datetime created_at
        datetime updated_at
    }

    DEPARTMENT_SHARE {
        bigint id PK
        bigint department_id FK
        bigint grantor_id FK
        bigint grantee_id FK
        datetime expires_at
        bool is_active
        datetime created_at
        datetime updated_at
    }

    AUDIT_LOG {
        bigint id PK
        bigint actor_id FK
        varchar action
        varchar object_type
        varchar object_id
        json metadata
        datetime created_at
    }

    AUTH_TOKEN {
        varchar key PK
        bigint user_id FK
        datetime created
    }

    DEPARTMENT ||--o{ USER : has
    DEPARTMENT ||--o{ SERVICE : owns

    USER ||--o{ SERVICE_ACCESS : has
    SERVICE ||--o{ SERVICE_ACCESS : grants

    USER ||--o{ CREDENTIAL : owns
    SERVICE ||--o{ CREDENTIAL : has

    USER ||--o{ DEPARTMENT_SHARE : grantor
    USER ||--o{ DEPARTMENT_SHARE : grantee
    DEPARTMENT ||--o{ DEPARTMENT_SHARE : shared

    USER o|--o{ AUDIT_LOG : acts_as_actor
    USER ||--|| AUTH_TOKEN : authenticates
```

Notes:
- `SERVICE_ACCESS` and `CREDENTIAL` enforce unique `(user_id, service_id)`.
- `DEPARTMENT_SHARE` enforces unique `(department_id, grantor_id, grantee_id)`.
- `CREDENTIAL.password_encrypted` stored via `EncryptedTextField` (asymmetric envelope encryption if configured).
