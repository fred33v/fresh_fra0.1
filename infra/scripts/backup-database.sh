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
# deploy-backend.sh installs it as /opt/stopfra/backend/backup-database.sh with a
# nightly cron entry (/etc/cron.d/stopfra-backup, 02:00, output to the system log).
# Backups older than backup_retention_days expire through the bucket's lifecycle rule;
# the instance can only add backups, never delete them.
# Restore with infra/scripts/restore-database.sh.
#
# Usage: ./infra/scripts/backup-database.sh
# ============================================================
set -euo pipefail

AWS_REGION="eu-west-2"
BACKUP_BUCKET="${BACKUP_BUCKET:-stopfra-backups-production}"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_FILE="$(mktemp -d)/stopfra-backup-${TIMESTAMP}.sql.gz"
trap 'rm -rf "$(dirname "$BACKUP_FILE")"' EXIT

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

# Feeds the backup_missing alarm; a failure here must not mark the backup itself as failed
aws cloudwatch put-metric-data --namespace StopFRA --metric-name DatabaseBackupSucceeded \
  --value 1 --unit Count --region "$AWS_REGION" \
  || echo "[$(date)] WARNING: could not report the backup to CloudWatch"

echo "[$(date)] Backup complete."
