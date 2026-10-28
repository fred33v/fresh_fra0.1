#!/bin/bash
# ============================================================
# Stop FRA - Restore a database backup from S3
#
# Run from an operator machine whose AWS credentials can read the backups bucket
# (the EC2 instance itself can only write backups).
#
# Usage:
#   ./infra/scripts/restore-database.sh --list
#   ./infra/scripts/restore-database.sh <backup|latest> <TARGET_DATABASE_URL>
#
# Restore into a fresh database first (for example a Neon branch), check it, then
# point DATABASE_URL at it. The dump drops and recreates every object it contains,
# so restoring over a live database replaces its data.
# ============================================================
set -euo pipefail

AWS_REGION="eu-west-2"
BACKUP_BUCKET="${BACKUP_BUCKET:-stopfra-backups-production}"

list_backups() {
  aws s3 ls "s3://${BACKUP_BUCKET}/database/" --region "$AWS_REGION" | awk '{print $NF}' | sort
}

if [ "${1:-}" = "--list" ]; then
  list_backups
  exit 0
fi

if [ $# -ne 2 ]; then
  sed -n '7,10p' "$0"
  exit 1
fi

BACKUP="$1"
TARGET_DATABASE_URL="$2"

if [ "$BACKUP" = "latest" ]; then
  BACKUP=$(list_backups | tail -n 1)
  if [ -z "$BACKUP" ]; then
    echo "ERROR: No backups found in s3://${BACKUP_BUCKET}/database/" >&2
    exit 1
  fi
fi

echo "Backup:  s3://${BACKUP_BUCKET}/database/${BACKUP}"
echo "Target:  ${TARGET_DATABASE_URL%%@*}@***"
read -rp "This replaces the target database's data. Type 'restore' to continue: " CONFIRM
if [ "$CONFIRM" != "restore" ]; then
  echo "Cancelled."
  exit 1
fi

WORK_DIR=$(mktemp -d)
trap 'rm -rf "$WORK_DIR"' EXIT

aws s3 cp "s3://${BACKUP_BUCKET}/database/${BACKUP}" "$WORK_DIR/backup.sql.gz" --region "$AWS_REGION"
gunzip -c "$WORK_DIR/backup.sql.gz" | psql "$TARGET_DATABASE_URL" --set ON_ERROR_STOP=1 --single-transaction --quiet

echo "Restore complete. Applied migrations on the target:"
psql "$TARGET_DATABASE_URL" -At -c "SELECT count(*) FROM public.schema_migrations"
