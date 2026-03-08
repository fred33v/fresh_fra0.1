#!/bin/bash
set -e

# Fetch parameters from SSM (max 10 per call, so split into two)
PARAMS1=$(aws ssm get-parameters --with-decryption \
  --names \
    /fra/backend/UPSTASH_REDIS_REST_URL \
    /fra/backend/UPSTASH_REDIS_REST_TOKEN \
    /fra/backend/DATABASE_URL \
    /fra/backend/JWT_SECRET \
    /fra/backend/JWT_REFRESH_SECRET \
    /fra/backend/S3_BUCKET \
    /fra/backend/S3_REGION \
    /fra/backend/S3_UPLOAD_PREFIX \
    /fra/backend/S3_DOWNLOAD_PREFIX \
    /fra/backend/S3_URL_EXPIRES_SECONDS \
  --query "Parameters[*].[Name,Value]" --output text --region eu-west-2)

PARAMS2=$(aws ssm get-parameters --with-decryption \
  --names \
    /fra/backend/S3_MAX_UPLOAD_BYTES \
    /fra/backend/S3_ALLOWED_CONTENT_TYPES \
  --query "Parameters[*].[Name,Value]" --output text --region eu-west-2)

# Parse and export first batch
while read -r name value; do
  varname=$(basename "$name")
  export "$varname=$value"
done <<< "$PARAMS1"

# Parse and export second batch
while read -r name value; do
  varname=$(basename "$name")
  export "$varname=$value"
done <<< "$PARAMS2"

# Start the app
exec /usr/bin/node dist/index.js
