#!/bin/sh
# Checks an OmniRoute API key against the local gateway without showing or storing it.
#   pnpm ai-gateway:test
set -eu
URL=${OMNIROUTE_BASE_URL:-http://127.0.0.1:20128}
printf 'Paste your OmniRoute API key, then press Enter (it will not be shown): '
stty -echo 2>/dev/null || true
read -r KEY
stty echo 2>/dev/null || true
echo
[ -n "$KEY" ] || { echo "No key entered."; exit 1; }
CODE=$(curl -s -o /tmp/omniroute-test.$$ -w '%{http_code}' "$URL/v1/models" -H "Authorization: Bearer $KEY" || echo 000)
case "$CODE" in
  200) echo "✔ The key works. Models available: $(grep -o '"id"' /tmp/omniroute-test.$$ | wc -l | tr -d ' ') (add a provider in the dashboard if this is 0)." ;;
  401|403) echo "✘ The gateway refused this key (HTTP $CODE). Check you copied all of it, or create a new one under API Keys." ;;
  000) echo "✘ Could not reach the gateway at $URL. Start it with: pnpm ai-gateway" ;;
  *) echo "Unexpected answer from the gateway (HTTP $CODE)." ;;
esac
rm -f /tmp/omniroute-test.$$
