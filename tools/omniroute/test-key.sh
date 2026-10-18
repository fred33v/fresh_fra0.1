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
# Show only the length and the public prefix (as listed in the dashboard), never the whole key
LEN=$(printf %s "$KEY" | wc -c | tr -d ' ')
case "$KEY" in
  sk-*) echo "You entered $LEN characters, starting $(printf %s "$KEY" | cut -c1-12)…" ;;
  *) echo "You entered $LEN characters, but OmniRoute keys start with \"sk-\". Did you paste something else?" ;;
esac
CODE=$(curl -s -o /tmp/omniroute-test.$$ -w '%{http_code}' "$URL/v1/models" -H "Authorization: Bearer $KEY" || echo 000)
case "$CODE" in
  200) echo "✔ The key works. Models available: $(grep -o '"id"' /tmp/omniroute-test.$$ | wc -l | tr -d ' ') (add a provider in the dashboard if this is 0)." ;;
  401|403)
    echo "✘ The gateway refused this key (HTTP $CODE): $(grep -o '"message":"[^"]*"' /tmp/omniroute-test.$$ | head -1 | cut -d'"' -f4)"
    echo "  Make sure you copied the full key when it was created (not the masked one from the list),"
    echo "  or create a new key under API Keys and copy it straight away." ;;
  000) echo "✘ Could not reach the gateway at $URL. Start it with: pnpm ai-gateway" ;;
  *) echo "Unexpected answer from the gateway (HTTP $CODE)." ;;
esac
rm -f /tmp/omniroute-test.$$
