#!/bin/bash
# ============================================================
# Stop FRA - Backend Deployment Script
# Builds, packages, and deploys the backend to EC2.
#
# Usage: ./infra/scripts/deploy-backend.sh [EC2_HOST]
# Example: ./infra/scripts/deploy-backend.sh ec2-user@3.10.x.x
# ============================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
BACKEND_DIR="$PROJECT_ROOT/apps/fra-backend/backend"
DEPLOY_USER="${1:-ec2-user@$(terraform -chdir="$SCRIPT_DIR/../terraform" output -raw ec2_public_ip 2>/dev/null || echo 'UNKNOWN')}"
REMOTE_DIR="/opt/stopfra/backend"

echo "=== Stop FRA Backend Deployment ==="
echo "Target: $DEPLOY_USER:$REMOTE_DIR"
echo ""

# --- Step 1: Build ---
echo "[1/5] Building backend..."
cd "$BACKEND_DIR"
npm run build
echo "  Build complete."

# --- Step 2: Package ---
echo "[2/5] Packaging deployment..."
DEPLOY_PKG=$(mktemp -d)/stopfra-backend.tar.gz
tar -czf "$DEPLOY_PKG" \
  -C "$BACKEND_DIR" \
  dist/ \
  migrations/ \
  package.json \
  package-lock.json \
  start.sh \
  node_modules/ \
  --exclude='node_modules/.cache'

echo "  Package: $(du -h "$DEPLOY_PKG" | cut -f1)"

# --- Step 3: Upload ---
echo "[3/5] Uploading to EC2..."
scp -o StrictHostKeyChecking=no "$DEPLOY_PKG" "$DEPLOY_USER:/tmp/stopfra-backend.tar.gz"

# --- Step 4: Deploy ---
echo "[4/5] Deploying on EC2..."
ssh -o StrictHostKeyChecking=no "$DEPLOY_USER" << 'REMOTE_SCRIPT'
set -euo pipefail

REMOTE_DIR="/opt/stopfra/backend"
BACKUP_DIR="/opt/stopfra/backup-$(date +%Y%m%d-%H%M%S)"

# Backup current deployment
if [ -d "$REMOTE_DIR/dist" ]; then
  echo "  Backing up current deployment to $BACKUP_DIR..."
  sudo mkdir -p "$BACKUP_DIR"
  sudo cp -r "$REMOTE_DIR/dist" "$BACKUP_DIR/" 2>/dev/null || true
  sudo cp "$REMOTE_DIR/package.json" "$BACKUP_DIR/" 2>/dev/null || true
fi

# Extract new deployment
echo "  Extracting new deployment..."
sudo tar -xzf /tmp/stopfra-backend.tar.gz -C "$REMOTE_DIR"
sudo chown -R stopfra:stopfra "$REMOTE_DIR"
sudo chmod +x "$REMOTE_DIR/start.sh"

# Restart service
echo "  Restarting backend service..."
sudo systemctl restart stopfra-backend

# Wait for health check
echo "  Waiting for health check..."
sleep 3
for i in $(seq 1 10); do
  if curl -sf http://localhost:3001/api/v1/health > /dev/null 2>&1; then
    echo "  Health check passed!"
    break
  fi
  if [ "$i" -eq 10 ]; then
    echo "  ERROR: Health check failed after 10 attempts!"
    echo "  Rolling back..."
    if [ -d "$BACKUP_DIR/dist" ]; then
      sudo cp -r "$BACKUP_DIR/dist" "$REMOTE_DIR/"
      sudo chown -R stopfra:stopfra "$REMOTE_DIR"
      sudo systemctl restart stopfra-backend
      echo "  Rollback complete."
    fi
    exit 1
  fi
  echo "  Attempt $i/10 - waiting..."
  sleep 2
done

# Clean up old backups (keep last 3)
ls -dt /opt/stopfra/backup-* 2>/dev/null | tail -n +4 | xargs sudo rm -rf 2>/dev/null || true

# Clean up
rm -f /tmp/stopfra-backend.tar.gz
REMOTE_SCRIPT

# --- Step 5: Verify ---
echo "[5/5] Verifying deployment..."
API_URL="https://api.fraud-risk.co.uk/api/v1/health"
if curl -sf "$API_URL" > /dev/null 2>&1; then
  echo "  Production health check: OK"
else
  echo "  NOTE: Could not reach $API_URL (DNS/ALB may not be configured yet)"
  echo "  Direct health check via EC2 succeeded."
fi

echo ""
echo "=== Deployment Complete ==="

# Cleanup temp file
rm -f "$DEPLOY_PKG"
