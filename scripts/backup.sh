#!/usr/bin/env bash
# Database backup for Auvren Till (PostgreSQL). Writes a compressed dump and removes dumps older than KEEP_DAYS.
#
#   DATABASE_NAME=till_pos DATABASE_USERNAME=postgres PGPASSWORD=... ./scripts/backup.sh
#
# Run it nightly from cron, e.g.:   0 2 * * *  cd /srv/till-backend && ./scripts/backup.sh >> backup.log 2>&1
# To restore:   gunzip -c backups/till_pos-YYYYmmdd-HHMMSS.sql.gz | psql -h HOST -U USER -d till_pos
# Keep copies OFF the server too (another machine or a cloud bucket): a backup on the same disk is not a backup.
set -euo pipefail

# Use the app's own .env when present, so cron and deploys need no extra setup.
if [ -f .env ]; then set -a; . ./.env; set +a; fi
export PGPASSWORD="${PGPASSWORD:-${DATABASE_PASSWORD:-}}"

HOST="${DATABASE_HOST:-localhost}"
PORT="${DATABASE_PORT:-5432}"
USER="${DATABASE_USERNAME:-postgres}"
NAME="${DATABASE_NAME:?Set DATABASE_NAME}"
DIR="${BACKUP_DIR:-./backups}"
KEEP_DAYS="${KEEP_DAYS:-14}"

command -v pg_dump >/dev/null || { echo "pg_dump not found. Install the PostgreSQL client tools." >&2; exit 1; }
mkdir -p "$DIR"
FILE="$DIR/${NAME}-$(date +%Y%m%d-%H%M%S).sql.gz"

pg_dump -h "$HOST" -p "$PORT" -U "$USER" --no-owner --clean --if-exists "$NAME" | gzip > "$FILE"
[ -s "$FILE" ] || { echo "Backup is empty, something went wrong" >&2; rm -f "$FILE"; exit 1; }
echo "Backup written: $FILE ($(du -h "$FILE" | cut -f1))"

find "$DIR" -name "${NAME}-*.sql.gz" -type f -mtime +"$KEEP_DAYS" -print -delete | sed 's/^/Removed old backup: /'
