#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EXPO_DIR="${ROOT_DIR}/../rork-fraud-risk-workshop"

if [ ! -d "${EXPO_DIR}" ]; then
  echo "Missing Expo project at: ${EXPO_DIR}" >&2
  exit 1
fi

pids=()
cleanup() {
  for pid in "${pids[@]:-}"; do
    if kill -0 "${pid}" 2>/dev/null; then
      kill "${pid}" 2>/dev/null || true
    fi
  done
}
trap cleanup EXIT INT TERM

echo "==> Starting web app (risk_awe_gov)"
( cd "${ROOT_DIR}" && npm run dev ) &
pids+=("$!")

echo "==> Starting Expo app (rork-fraud-risk-workshop)"
( cd "${EXPO_DIR}" && npm run start-web ) &
pids+=("$!")

wait
