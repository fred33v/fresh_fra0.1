#!/bin/bash
# Starts the API with its configuration from SSM Parameter Store.
#   ./start.sh           start the server
#   ./start.sh migrate   apply pending database migrations, then exit
set -euo pipefail

cd "$(dirname "$0")"
AWS_REGION="${AWS_REGION:-eu-west-2}"

# Load every parameter under /fra/backend/ (the CLI pages through them all), so a new
# setting only has to be added to Parameter Store. The server refuses to start in
# production if a required one is missing (see validateProductionEnv in src/index.ts).
PARAMS=$(aws ssm get-parameters-by-path --path /fra/backend/ --recursive --with-decryption \
  --query "Parameters[*].[Name,Value]" --output text --region "$AWS_REGION")

if [ -z "$PARAMS" ]; then
  echo "No parameters found under /fra/backend/ in $AWS_REGION" >&2
  exit 1
fi

while IFS=$'\t' read -r name value; do
  if [ -n "$name" ]; then export "$(basename "$name")=$value"; fi
done <<< "$PARAMS"

export NODE_ENV="${NODE_ENV:-production}"
# The load balancer connects to this instance directly on PORT; the security group only
# lets the load balancer in
export HOST="${HOST:-0.0.0.0}"

if [ "${1:-}" = "migrate" ]; then
  exec /usr/bin/node dist/migrate.js
fi

exec /usr/bin/node dist/index.js
