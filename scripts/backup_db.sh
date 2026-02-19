#!/usr/bin/env bash
set -euo pipefail

OUTPUT_DIR="${1:-./backups}"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
mkdir -p "${OUTPUT_DIR}"

BACKUP_FILE="${OUTPUT_DIR}/phoenix_${TIMESTAMP}.dump"

docker compose exec -T db pg_dump \
  -U "${POSTGRES_USER:-phoenix}" \
  -d "${POSTGRES_DB:-phoenix}" \
  -Fc > "${BACKUP_FILE}"

echo "Backup created: ${BACKUP_FILE}"
