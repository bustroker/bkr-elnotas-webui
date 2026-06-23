#!/bin/bash
set -e

# Usage:
#   bash deploy-render.sh

# ===========================================================
# Trigger a Render.com deployment (pull latest image).
# ===========================================================
#
# Reads from `.env` file:
#   RENDER_DEPLOY_HOOK_URL Required. Render deploy hook URL.
#

while [ $# -gt 0 ]; do
  case "$1" in
    -h|--help)
      echo "Usage: bash deploy-render.sh"
      exit 0
      ;;
    *)
      echo "Unknown arg: $1"
      echo "Usage: bash deploy-render.sh"
      exit 1
      ;;
  esac
done

if [ -f .env ]; then
  echo "Loading .env..."
  set -a
  source .env
  set +a
fi

url="${RENDER_DEPLOY_HOOK_URL:-}"

if [ -z "$url" ]; then
  echo "Missing RENDER_DEPLOY_HOOK_URL."
  exit 1
fi

echo "Triggering Render deploy..."
response=$(curl -s -w "\n%{http_code}" -X POST "$url")

http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | sed '$d')

if [ "$http_code" -ge 200 ] && [ "$http_code" -lt 300 ]; then
  echo "✓ Done"
else
  echo "✗ Deploy failed (HTTP $http_code)"
  echo "$body"
  exit 1
fi
