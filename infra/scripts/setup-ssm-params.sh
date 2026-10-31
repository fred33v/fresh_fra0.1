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

AWS_REGION="eu-north-1"

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

# DATABASE_URL, the JWT secrets, Redis and S3 are written by Terraform from terraform.tfvars.
# Enter skips a value and keeps what is already stored; only override them here on purpose,
# because the next terraform apply puts the tfvars values back.
read -rp "DATABASE_URL (Enter to keep the current value): " DATABASE_URL
read -rp "JWT_SECRET (Enter to keep the current value): " JWT_SECRET
read -rp "JWT_REFRESH_SECRET (Enter to keep the current value): " JWT_REFRESH_SECRET
read -rsp "STRIPE_SECRET_KEY (sk_live_...): " STRIPE_SECRET_KEY; echo
read -rsp "STRIPE_WEBHOOK_SECRET (whsec_...): " STRIPE_WEBHOOK_SECRET; echo
read -rp "STRIPE_VAT_TAX_RATE_ID (txr_..., optional: 20% UK VAT rate; Enter to skip, VAT is then a separate line item): " STRIPE_VAT_TAX_RATE_ID
# SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS and EMAIL_FROM are written by Terraform
# (Amazon SES, infra/terraform/main.tf), so they are not asked for here
read -rp "CORS_ORIGINS [https://app.fraud-risk.co.uk]: " CORS_ORIGINS
CORS_ORIGINS=${CORS_ORIGINS:-https://app.fraud-risk.co.uk}
read -rp "WEB_APP_URL [https://app.fraud-risk.co.uk]: " WEB_APP_URL
WEB_APP_URL=${WEB_APP_URL:-https://app.fraud-risk.co.uk}
read -rp "INBOUND_WEBHOOK_SECRET (for n8n calls to /webhooks/assessment-submitted; Enter to keep it, or generate one the first time): " INBOUND_WEBHOOK_SECRET
if [ -z "$INBOUND_WEBHOOK_SECRET" ] && ! aws ssm get-parameter --name /fra/backend/INBOUND_WEBHOOK_SECRET --region "$AWS_REGION" >/dev/null 2>&1; then
  INBOUND_WEBHOOK_SECRET=$(openssl rand -hex 32)
fi
read -rp "UPSTASH_REDIS_REST_URL (Enter to keep the current value): " REDIS_URL
read -rp "UPSTASH_REDIS_REST_TOKEN (Enter to keep the current value): " REDIS_TOKEN
read -rp "S3_BUCKET (Enter to keep the current value): " S3_BUCKET
read -rp "S3_REGION [eu-north-1]: " S3_REGION
S3_REGION=${S3_REGION:-eu-north-1}
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
[ -n "$INBOUND_WEBHOOK_SECRET" ] && put_param "/fra/backend/INBOUND_WEBHOOK_SECRET" "$INBOUND_WEBHOOK_SECRET"
[ -n "$REDIS_URL" ] && put_param "/fra/backend/UPSTASH_REDIS_REST_URL" "$REDIS_URL"
[ -n "$REDIS_TOKEN" ] && put_param "/fra/backend/UPSTASH_REDIS_REST_TOKEN" "$REDIS_TOKEN"

# Non-secret configuration (String)
put_param "/fra/backend/CORS_ORIGINS" "$CORS_ORIGINS" "String"
put_param "/fra/backend/WEB_APP_URL" "$WEB_APP_URL" "String"
[ -n "$STRIPE_VAT_TAX_RATE_ID" ] && put_param "/fra/backend/STRIPE_VAT_TAX_RATE_ID" "$STRIPE_VAT_TAX_RATE_ID" "String"
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
