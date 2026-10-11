#!/bin/bash
# ============================================================
# Stop FRA - SSM Parameter Store Setup (7.4)
#
# One-time script to populate AWS SSM Parameter Store.
# Uses the same parameter paths as start.sh expects.
#
# Usage: ./infra/scripts/setup-ssm-params.sh
# Requires: AWS CLI configured with appropriate permissions
# ============================================================
set -euo pipefail

AWS_REGION="eu-west-2"

echo "=== Stop FRA SSM Parameter Setup ==="
echo "Region: $AWS_REGION"
echo ""
echo "This will create/update SSM parameters."
echo "Press Ctrl+C to cancel, or Enter to continue."
read -r

# Helper function
put_param() {
  local name=$1
  local value=$2
  local type=${3:-SecureString}

  echo "  Setting $name ($type)..."
  aws ssm put-parameter \
    --name "$name" \
    --value "$value" \
    --type "$type" \
    --overwrite \
    --region "$AWS_REGION" \
    --no-cli-pager > /dev/null
}

# --- Prompt for values ---
echo ""
echo "Enter values for each parameter (or press Enter to skip):"
echo ""

read -rp "DATABASE_URL (Neon: postgresql://user:pass@ep-xxx.neon.tech/dbname?sslmode=require): " DATABASE_URL
read -rp "JWT_SECRET (at least 32 characters; Enter to generate): " JWT_SECRET
JWT_SECRET=${JWT_SECRET:-$(openssl rand -hex 32)}
read -rp "JWT_REFRESH_SECRET (at least 32 characters, different from JWT_SECRET; Enter to generate): " JWT_REFRESH_SECRET
JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET:-$(openssl rand -hex 32)}
read -rp "STRIPE_SECRET_KEY (sk_live_...): " STRIPE_SECRET_KEY
read -rp "STRIPE_WEBHOOK_SECRET (whsec_...): " STRIPE_WEBHOOK_SECRET
read -rp "SMTP_HOST: " SMTP_HOST
read -rp "SMTP_PORT [587]: " SMTP_PORT
SMTP_PORT=${SMTP_PORT:-587}
read -rp "SMTP_USER: " SMTP_USER
read -rp "SMTP_PASS: " SMTP_PASS
read -rp "EMAIL_FROM [FRAUD-RISK.CO.UK <no-reply@fraud-risk.co.uk>]: " EMAIL_FROM
EMAIL_FROM=${EMAIL_FROM:-FRAUD-RISK.CO.UK <no-reply@fraud-risk.co.uk>}
read -rp "CORS_ORIGINS [https://app.fraud-risk.co.uk]: " CORS_ORIGINS
CORS_ORIGINS=${CORS_ORIGINS:-https://app.fraud-risk.co.uk}
read -rp "WEB_APP_URL [https://app.fraud-risk.co.uk]: " WEB_APP_URL
WEB_APP_URL=${WEB_APP_URL:-https://app.fraud-risk.co.uk}
read -rp "INBOUND_WEBHOOK_SECRET (for n8n calls to /webhooks/assessment-submitted; Enter to generate): " INBOUND_WEBHOOK_SECRET
INBOUND_WEBHOOK_SECRET=${INBOUND_WEBHOOK_SECRET:-$(openssl rand -hex 32)}
read -rp "UPSTASH_REDIS_REST_URL: " REDIS_URL
read -rp "UPSTASH_REDIS_REST_TOKEN: " REDIS_TOKEN
read -rp "S3_BUCKET: " S3_BUCKET
read -rp "S3_REGION [eu-west-2]: " S3_REGION
S3_REGION=${S3_REGION:-eu-west-2}
read -rp "S3_UPLOAD_PREFIX [uploads/]: " S3_UPLOAD_PREFIX
S3_UPLOAD_PREFIX=${S3_UPLOAD_PREFIX:-uploads/}
read -rp "S3_DOWNLOAD_PREFIX [downloads/]: " S3_DOWNLOAD_PREFIX
S3_DOWNLOAD_PREFIX=${S3_DOWNLOAD_PREFIX:-downloads/}
read -rp "S3_URL_EXPIRES_SECONDS [3600]: " S3_URL_EXPIRES
S3_URL_EXPIRES=${S3_URL_EXPIRES:-3600}
read -rp "S3_MAX_UPLOAD_BYTES [10485760]: " S3_MAX_UPLOAD
S3_MAX_UPLOAD=${S3_MAX_UPLOAD:-10485760}
read -rp "S3_ALLOWED_CONTENT_TYPES [application/pdf,image/png,image/jpeg]: " S3_CONTENT_TYPES
S3_CONTENT_TYPES=${S3_CONTENT_TYPES:-application/pdf,image/png,image/jpeg}

echo ""
echo "Setting parameters..."

# Secrets (SecureString - encrypted with KMS)
[ -n "$DATABASE_URL" ] && put_param "/fra/backend/DATABASE_URL" "$DATABASE_URL"
[ -n "$JWT_SECRET" ] && put_param "/fra/backend/JWT_SECRET" "$JWT_SECRET"
[ -n "$JWT_REFRESH_SECRET" ] && put_param "/fra/backend/JWT_REFRESH_SECRET" "$JWT_REFRESH_SECRET"
[ -n "$STRIPE_SECRET_KEY" ] && put_param "/fra/backend/STRIPE_SECRET_KEY" "$STRIPE_SECRET_KEY"
[ -n "$STRIPE_WEBHOOK_SECRET" ] && put_param "/fra/backend/STRIPE_WEBHOOK_SECRET" "$STRIPE_WEBHOOK_SECRET"
[ -n "$SMTP_USER" ] && put_param "/fra/backend/SMTP_USER" "$SMTP_USER"
[ -n "$SMTP_PASS" ] && put_param "/fra/backend/SMTP_PASS" "$SMTP_PASS"
put_param "/fra/backend/INBOUND_WEBHOOK_SECRET" "$INBOUND_WEBHOOK_SECRET"
[ -n "$REDIS_URL" ] && put_param "/fra/backend/UPSTASH_REDIS_REST_URL" "$REDIS_URL"
[ -n "$REDIS_TOKEN" ] && put_param "/fra/backend/UPSTASH_REDIS_REST_TOKEN" "$REDIS_TOKEN"

# Non-secret configuration (String)
[ -n "$SMTP_HOST" ] && put_param "/fra/backend/SMTP_HOST" "$SMTP_HOST" "String"
put_param "/fra/backend/SMTP_PORT" "$SMTP_PORT" "String"
put_param "/fra/backend/EMAIL_FROM" "$EMAIL_FROM" "String"
put_param "/fra/backend/CORS_ORIGINS" "$CORS_ORIGINS" "String"
put_param "/fra/backend/WEB_APP_URL" "$WEB_APP_URL" "String"
[ -n "$S3_BUCKET" ] && put_param "/fra/backend/S3_BUCKET" "$S3_BUCKET" "String"
put_param "/fra/backend/S3_REGION" "$S3_REGION" "String"
put_param "/fra/backend/S3_UPLOAD_PREFIX" "$S3_UPLOAD_PREFIX" "String"
put_param "/fra/backend/S3_DOWNLOAD_PREFIX" "$S3_DOWNLOAD_PREFIX" "String"
put_param "/fra/backend/S3_URL_EXPIRES_SECONDS" "$S3_URL_EXPIRES" "String"
put_param "/fra/backend/S3_MAX_UPLOAD_BYTES" "$S3_MAX_UPLOAD" "String"
put_param "/fra/backend/S3_ALLOWED_CONTENT_TYPES" "$S3_CONTENT_TYPES" "String"

echo ""
echo "=== SSM Parameters Set Successfully ==="
echo ""
echo "Verify with:"
echo "  aws ssm get-parameters-by-path --path /fra/backend/ --region $AWS_REGION --query 'Parameters[].Name'"
