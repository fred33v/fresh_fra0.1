#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EXPO_DIR="${ROOT_DIR}/../rork-fraud-risk-workshop"

if [ ! -d "${EXPO_DIR}" ]; then
  echo "Missing Expo project at: ${EXPO_DIR}" >&2
  echo "Clone it first: git clone https://github.com/deric7223r-tech/rork-fraud-risk-workshop.git" >&2
  exit 1
fi

echo "==> Installing web app dependencies (risk_awe_gov)"
( cd "${ROOT_DIR}" && npm install )

echo "==> Installing Expo app dependencies (rork-fraud-risk-workshop)"
( cd "${EXPO_DIR}" && npm install )

echo "Done." 
