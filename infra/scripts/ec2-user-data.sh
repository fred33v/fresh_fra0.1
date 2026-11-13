#!/bin/bash
# ============================================================
# Stop FRA - EC2 Bootstrap Script (7.5)
# This runs once when the instance first launches.
# Amazon Linux 2023 user-data script.
# ============================================================
set -euo pipefail
exec > >(tee /var/log/stopfra-setup.log) 2>&1

echo "=== Stop FRA EC2 Setup Starting ==="

# --- System Updates ---
dnf update -y

# --- Install Node.js 22 ---
dnf install -y nodejs22 nodejs22-npm
node --version
npm --version

# --- Install Google Chrome (headless, for the PDF reports) ---
# Puppeteer's bundled Chrome is downloaded on the machine that runs the install,
# so it never reaches this server; the backend uses this one instead
dnf install -y https://dl.google.com/linux/direct/google-chrome-stable_current_x86_64.rpm
google-chrome-stable --version

# --- Database client and cron for nightly backups (backup-database.sh) ---
dnf install -y postgresql17 cronie
systemctl enable --now crond

# --- Install nginx ---
dnf install -y nginx
systemctl enable nginx

# --- Create service user ---
useradd --system --shell /sbin/nologin --home-dir /opt/stopfra stopfra || true

# --- Create app directory ---
mkdir -p /opt/stopfra/backend/logs
mkdir -p /opt/stopfra/backend/migrations
chown -R stopfra:stopfra /opt/stopfra

# --- Install AWS CLI (already on AL2023, but ensure latest) ---
dnf install -y aws-cli

# --- Install systemd service ---
# The service file will be deployed by the CI/CD pipeline or manually
cat > /etc/systemd/system/stopfra-backend.service << 'SERVICEEOF'
[Unit]
Description=Stop FRA Backend API
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=stopfra
Group=stopfra
WorkingDirectory=/opt/stopfra/backend
ExecStart=/opt/stopfra/backend/start.sh
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=stopfra-backend
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/opt/stopfra/backend/logs
PrivateTmp=true
Environment=NODE_ENV=production
Environment=PORT=3001
Environment=PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable
Environment=XDG_CONFIG_HOME=/tmp/.config
Environment=XDG_CACHE_HOME=/tmp/.cache
LimitNOFILE=65535

[Install]
WantedBy=multi-user.target
SERVICEEOF

systemctl daemon-reload
systemctl enable stopfra-backend

# --- Configure nginx ---
cat > /etc/nginx/conf.d/stopfra-api.conf << 'NGINXEOF'
upstream stopfra_backend {
    server 127.0.0.1:3001;
    keepalive 32;
}

server {
    listen 80;
    server_name api.fraud-risk.co.uk;

    location /api/ {
        proxy_pass http://stopfra_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Connection "";
        proxy_connect_timeout 10s;
        proxy_send_timeout 30s;
        proxy_read_timeout 30s;
        client_max_body_size 10M;
    }

    location /api/v1/health {
        proxy_pass http://stopfra_backend;
        proxy_set_header Host $host;
        access_log off;
    }

    location / {
        return 404;
    }
}
NGINXEOF

# Remove default nginx config
rm -f /etc/nginx/conf.d/default.conf

nginx -t && systemctl start nginx

# --- Configure log rotation ---
cat > /etc/logrotate.d/stopfra << 'LOGEOF'
/opt/stopfra/backend/logs/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 stopfra stopfra
}
LOGEOF

# --- CloudWatch agent for monitoring (optional) ---
dnf install -y amazon-cloudwatch-agent || true

echo "=== Stop FRA EC2 Setup Complete ==="
echo "Deploy the backend with: infra/scripts/deploy-backend.sh"
