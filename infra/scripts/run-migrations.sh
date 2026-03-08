#!/bin/bash
# ============================================================
# Stop FRA - Run Database Migrations on Production (7.7)
#
# Usage: ./infra/scripts/run-migrations.sh [DATABASE_URL]
# If no DATABASE_URL, fetches from AWS SSM Parameter Store.
# ============================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
MIGRATIONS_DIR="$PROJECT_ROOT/apps/fra-backend/backend/migrations"
AWS_REGION="eu-west-2"

# Get DATABASE_URL
if [ -n "${1:-}" ]; then
  DATABASE_URL="$1"
else
  echo "Fetching DATABASE_URL from SSM Parameter Store..."
  DATABASE_URL=$(aws ssm get-parameter \
    --name "/fra/backend/DATABASE_URL" \
    --with-decryption \
    --query "Parameter.Value" \
    --output text \
    --region "$AWS_REGION")
fi

echo "=== Stop FRA Database Migrations ==="
echo "Database: ${DATABASE_URL%%@*}@***"
echo "Migrations: $MIGRATIONS_DIR"
echo ""

# Verify migrations directory
if [ ! -d "$MIGRATIONS_DIR" ]; then
  echo "ERROR: Migrations directory not found: $MIGRATIONS_DIR"
  exit 1
fi

# Run each migration file in order
MIGRATION_COUNT=0
for migration in "$MIGRATIONS_DIR"/*.sql; do
  if [ -f "$migration" ]; then
    MIGRATION_NAME=$(basename "$migration")
    echo "Running: $MIGRATION_NAME..."

    if psql "$DATABASE_URL" -f "$migration" 2>&1; then
      echo "  OK"
      MIGRATION_COUNT=$((MIGRATION_COUNT + 1))
    else
      echo "  ERROR: Migration $MIGRATION_NAME failed!"
      echo "  Migrations are idempotent (IF NOT EXISTS), so partial runs are safe."
      exit 1
    fi
  fi
done

echo ""
echo "=== $MIGRATION_COUNT migration(s) applied successfully ==="
