```mermaid
erDiagram
    USER {
        bigint id PK
        varchar portal_login UK
        varchar email
        varchar full_name
        varchar role
        bool is_active
        bool is_staff
        datetime date_joined
    }

    CATEGORY {
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
        bigint category_id FK
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

    USER ||--o{ SERVICE_ACCESS : has
    SERVICE ||--o{ SERVICE_ACCESS : grants

    USER ||--o{ CREDENTIAL : owns
    SERVICE ||--o{ CREDENTIAL : has

    CATEGORY ||--o{ SERVICE : groups

    USER o|--o{ AUDIT_LOG : acts_as_actor

    USER ||--|| AUTH_TOKEN : authenticates
```

Notes:
- `SERVICE_ACCESS` and `CREDENTIAL` both enforce unique `(user_id, service_id)`.
- `AUDIT_LOG.actor_id` is nullable (`SET_NULL`), so logs survive user deletion.
- `CREDENTIAL.password_encrypted` is stored encrypted via custom `EncryptedTextField`.
