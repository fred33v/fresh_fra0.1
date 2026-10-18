#!/bin/sh
# Starts OmniRoute, a local AI gateway, for this project.
#
# OmniRoute needs Node 22.22.2+; the project itself stays on Node 20. This script
# uses a separate Node 22 (by default ~/.local/node22, or OMNIROUTE_NODE_DIR) and the
# OmniRoute installed into it, so nothing about the project's Node changes.
#
#   pnpm ai-gateway          start (dashboard: http://127.0.0.1:20128)
#   pnpm ai-gateway:stop     stop
set -eu

HERE=$(cd "$(dirname "$0")" && pwd)
NODE_DIR=${OMNIROUTE_NODE_DIR:-$HOME/.local/node22}
OMNIROUTE_VERSION=3.8.51

if [ ! -x "$NODE_DIR/bin/node" ]; then
  echo "OmniRoute needs Node 22.22.2 or newer, installed separately from the project's Node 20."
  echo "Expected it in $NODE_DIR (set OMNIROUTE_NODE_DIR to use another folder)."
  exit 1
fi
PATH="$NODE_DIR/bin:$PATH"
export PATH

if [ ! -x "$NODE_DIR/bin/omniroute" ]; then
  echo "OmniRoute is not installed in $NODE_DIR. Install it with:"
  echo "  $NODE_DIR/bin/npm install -g omniroute@$OMNIROUTE_VERSION"
  exit 1
fi

# Local settings with secrets: created on first run, ignored by git, never committed
ENV_FILE="$HERE/.env"
if [ ! -f "$ENV_FILE" ]; then
  umask 077
  sed \
    -e "s|^JWT_SECRET=.*|JWT_SECRET=$(openssl rand -base64 48 | tr -d '\n')|" \
    -e "s|^API_KEY_SECRET=.*|API_KEY_SECRET=$(openssl rand -hex 32)|" \
    -e "s|^STORAGE_ENCRYPTION_KEY=.*|STORAGE_ENCRYPTION_KEY=$(openssl rand -hex 32)|" \
    -e "s|^INITIAL_PASSWORD=.*|INITIAL_PASSWORD=$(openssl rand -base64 18 | tr -d '/+=\n')|" \
    -e "s|^DATA_DIR=.*|DATA_DIR=$HOME/.omniroute-fresh-fra|" \
    "$HERE/.env.example" > "$ENV_FILE"
  echo "Created $ENV_FILE with new random secrets."
  echo "Your first dashboard password is the INITIAL_PASSWORD line in that file; change it after signing in."
fi

# Load the settings for OmniRoute
set -a
. "$ENV_FILE"
set +a
mkdir -p "$DATA_DIR"

if [ "${1:-}" = "stop" ]; then
  exec omniroute stop
fi

echo "Starting OmniRoute $(omniroute --version 2>/dev/null | tail -1) on http://$OMNIROUTE_SERVER_HOST:$PORT (Node $(node -v))"
exec omniroute serve --no-open --no-tray "$@"
