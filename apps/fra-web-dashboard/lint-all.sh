#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EXPO_DIR="${ROOT_DIR}/../rork-fraud-risk-workshop"

if [ ! -d "${EXPO_DIR}" ]; then
  echo "Missing Expo project at: ${EXPO_DIR}" >&2
  exit 1
fi

echo "==> Linting web app (risk_awe_gov)"
( cd "${ROOT_DIR}" && npm run lint )

echo "==> Linting Expo app (rork-fraud-risk-workshop)"
( cd "${EXPO_DIR}" && npm run lint )

echo "Done." 
