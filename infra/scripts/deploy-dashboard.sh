#!/bin/bash
# ============================================================
# Stop FRA - Web Dashboard Deployment Script
# Builds the Vite app and deploys to S3 + CloudFront (7.10)
#
# Usage: ./infra/scripts/deploy-dashboard.sh
# ============================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
DASHBOARD_DIR="$PROJECT_ROOT/apps/fra-web-dashboard"
AWS_REGION="eu-west-2"

# Get bucket and distribution from Terraform outputs
S3_BUCKET=$(terraform -chdir="$SCRIPT_DIR/../terraform" output -raw s3_dashboard_bucket 2>/dev/null || echo "stopfra-dashboard-production")
CF_DISTRIBUTION=$(terraform -chdir="$SCRIPT_DIR/../terraform" output -raw cloudfront_distribution_id 2>/dev/null || echo "")

echo "=== Stop FRA Dashboard Deployment ==="
echo "S3 Bucket: $S3_BUCKET"
echo "CloudFront: $CF_DISTRIBUTION"
echo ""

# --- Step 1: Build ---
echo "[1/4] Building dashboard..."
cd "$DASHBOARD_DIR"
npm run build
echo "  Build complete: $(du -sh dist | cut -f1)"

# --- Step 2: Upload to S3 ---
echo "[2/4] Uploading to S3..."

# Upload assets with long cache headers
aws s3 sync dist/assets/ "s3://$S3_BUCKET/assets/" \
  --cache-control "public, max-age=31536000, immutable" \
  --region "$AWS_REGION" \
  --delete

# Upload HTML with no-cache headers
aws s3 cp dist/index.html "s3://$S3_BUCKET/index.html" \
  --cache-control "no-cache, no-store, must-revalidate" \
  --content-type "text/html" \
  --region "$AWS_REGION"

# Upload any other root files
for file in dist/*; do
  if [ -f "$file" ] && [ "$(basename "$file")" != "index.html" ]; then
    aws s3 cp "$file" "s3://$S3_BUCKET/$(basename "$file")" \
      --cache-control "public, max-age=3600" \
      --region "$AWS_REGION"
  fi
done

echo "  Upload complete."

# --- Step 3: Invalidate CloudFront ---
if [ -n "$CF_DISTRIBUTION" ]; then
  echo "[3/4] Invalidating CloudFront cache..."
  INVALIDATION_ID=$(aws cloudfront create-invalidation \
    --distribution-id "$CF_DISTRIBUTION" \
    --paths "/index.html" "/*" \
    --query "Invalidation.Id" \
    --output text)
  echo "  Invalidation: $INVALIDATION_ID"
else
  echo "[3/4] Skipping CloudFront invalidation (no distribution ID)"
fi

# --- Step 4: Verify ---
echo "[4/4] Verifying deployment..."
DASHBOARD_URL="https://app.fraud-risk.co.uk"
if curl -sf "$DASHBOARD_URL" > /dev/null 2>&1; then
  echo "  Dashboard reachable at $DASHBOARD_URL"
else
  echo "  NOTE: $DASHBOARD_URL not reachable yet (DNS/CloudFront may not be configured)"
fi

echo ""
echo "=== Dashboard Deployment Complete ==="
