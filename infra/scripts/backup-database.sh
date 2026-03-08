#!/bin/bash
# ============================================================
# Stop FRA - Database Backup Script (7.12)
#
# Creates a pg_dump backup and uploads to S3.
# Designed to run via cron on the EC2 instance.
#
# NOTE: Neon (pg.neon.tech) provides built-in point-in-time
# recovery (PITR). This script provides an additional
# off-platform backup to S3 for disaster recovery.
#
# Crontab entry (daily at 2 AM):
#   0 2 * * * /opt/stopfra/scripts/backup-database.sh >> /var/log/stopfra-backup.log 2>&1
#
# Usage: ./infra/scripts/backup-database.sh
# ============================================================
set -euo pipefail

AWS_REGION="eu-west-2"
BACKUP_BUCKET="stopfra-backups-production"
RETENTION_DAYS=30
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_FILE="/tmp/stopfra-backup-${TIMESTAMP}.sql.gz"

echo "[$(date)] Starting database backup..."

# Fetch DATABASE_URL from SSM
DATABASE_URL=$(aws ssm get-parameter \
  --name "/fra/backend/DATABASE_URL" \
  --with-decryption \
  --query "Parameter.Value" \
  --output text \
  --region "$AWS_REGION" 2>/dev/null)

if [ -z "$DATABASE_URL" ]; then
  echo "ERROR: Could not fetch DATABASE_URL from SSM"
  exit 1
fi

# Create backup
echo "[$(date)] Running pg_dump..."
pg_dump "$DATABASE_URL" \
  --no-owner \
  --no-privileges \
  --clean \
  --if-exists \
  | gzip > "$BACKUP_FILE"

BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
echo "[$(date)] Backup created: $BACKUP_SIZE"

# Upload to S3
echo "[$(date)] Uploading to S3..."
aws s3 cp "$BACKUP_FILE" \
  "s3://${BACKUP_BUCKET}/database/${TIMESTAMP}.sql.gz" \
  --storage-class STANDARD_IA \
  --region "$AWS_REGION"

echo "[$(date)] Uploaded to s3://${BACKUP_BUCKET}/database/${TIMESTAMP}.sql.gz"

# Clean up local file
rm -f "$BACKUP_FILE"

# Remove old backups from S3 (keep last RETENTION_DAYS days)
echo "[$(date)] Cleaning up old backups (>${RETENTION_DAYS} days)..."
CUTOFF_DATE=$(date -d "-${RETENTION_DAYS} days" +%Y%m%d 2>/dev/null || date -v-${RETENTION_DAYS}d +%Y%m%d)

aws s3 ls "s3://${BACKUP_BUCKET}/database/" --region "$AWS_REGION" | while read -r line; do
  FILE_DATE=$(echo "$line" | awk '{print $NF}' | grep -oP '^\d{8}' || true)
  if [ -n "$FILE_DATE" ] && [ "$FILE_DATE" -lt "$CUTOFF_DATE" ]; then
    FILE_NAME=$(echo "$line" | awk '{print $NF}')
    echo "  Deleting old backup: $FILE_NAME"
    aws s3 rm "s3://${BACKUP_BUCKET}/database/${FILE_NAME}" --region "$AWS_REGION"
  fi
done

echo "[$(date)] Backup complete."
