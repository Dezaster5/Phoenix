#!/usr/bin/env bash
set -euo pipefail

BACKUP_FILE="${1:-}"
if [[ -z "${BACKUP_FILE}" ]]; then
  echo "Usage: $0 <backup_file.dump>"
  exit 1
fi

if [[ ! -f "${BACKUP_FILE}" ]]; then
  echo "Backup file not found: ${BACKUP_FILE}"
  exit 1
fi

docker compose exec -T db dropdb --if-exists -U "${POSTGRES_USER:-phoenix}" "${POSTGRES_DB:-phoenix}"
docker compose exec -T db createdb -U "${POSTGRES_USER:-phoenix}" "${POSTGRES_DB:-phoenix}"

cat "${BACKUP_FILE}" | docker compose exec -T db pg_restore \
  -U "${POSTGRES_USER:-phoenix}" \
  -d "${POSTGRES_DB:-phoenix}" \
  --clean \
  --if-exists \
  --no-owner \
  --no-privileges

echo "Restore completed from: ${BACKUP_FILE}"
