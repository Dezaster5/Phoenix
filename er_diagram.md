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
        inet ip_address
        varchar user_agent
        json metadata
        datetime created_at
    }

    ACCESS_REQUEST {
        bigint id PK
        bigint requester_id FK
        bigint service_id FK
        varchar status
        text justification
        bigint reviewer_id FK
        text review_comment
        datetime requested_at
        datetime reviewed_at
    }

    CREDENTIAL_VERSION {
        bigint id PK
        bigint credential_id FK
        int version
        varchar login
        text password_encrypted
        text notes
        bool is_active
        varchar change_type
        bigint changed_by_id FK
        datetime created_at
    }

    LOGIN_CHALLENGE {
        bigint id PK
        bigint user_id FK
        varchar channel
        varchar code_digest
        varchar magic_token_digest
        varchar salt
        datetime expires_at
        datetime consumed_at
        int attempts
        int max_attempts
        inet ip_address
        varchar user_agent
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

    USER ||--o{ ACCESS_REQUEST : requester
    USER o|--o{ ACCESS_REQUEST : reviewer
    SERVICE ||--o{ ACCESS_REQUEST : target

    CREDENTIAL ||--o{ CREDENTIAL_VERSION : versions
    USER o|--o{ CREDENTIAL_VERSION : changed_by

    USER o|--o{ AUDIT_LOG : acts_as_actor
    USER ||--o{ LOGIN_CHALLENGE : login_challenges
    USER ||--|| AUTH_TOKEN : authenticates
```

Notes:
- `SERVICE_ACCESS` and `CREDENTIAL` enforce unique `(user_id, service_id)`.
- `DEPARTMENT_SHARE` enforces unique `(department_id, grantor_id, grantee_id)`.
- `CREDENTIAL_VERSION` enforces unique `(credential_id, version)`.
- `CREDENTIAL.password_encrypted` stored via `EncryptedTextField` (asymmetric envelope encryption if configured).
