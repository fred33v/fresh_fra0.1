#!/bin/bash
# ============================================================
# Stop FRA - Run Database Migrations on Production (7.7)
#
# Usage: ./infra/scripts/run-migrations.sh [DATABASE_URL]
# Deploys run migrations automatically (deploy-backend.sh); this is for manual runs.
# If no DATABASE_URL, fetches from AWS SSM Parameter Store.
# ============================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
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
echo ""

# Use the app's own runner: it records applied migrations in schema_migrations and
# applies each pending one exactly once
cd "$PROJECT_ROOT/apps/fra-backend/backend"
DATABASE_URL="$DATABASE_URL" pnpm migrate
