#!/bin/bash
set -e

# Usage:
#   bash deploy-render.sh --env development|staging|production

# ===========================================================
# Trigger a Render.com deployment (pull latest image).
# ===========================================================
#
# Reads from `.env` file:
#   RENDER_DEPLOY_HOOK_URL_DEV   Required. Render deploy hook URL for development
#   RENDER_DEPLOY_HOOK_URL_STG   Required. Render deploy hook URL for staging
#   RENDER_DEPLOY_HOOK_URL_PROD  Required. Render deploy hook URL for production
#


ENVIRONMENT=""

if [ $# -eq 0 ]; then
  echo "Missing --env value. Expected development|staging|production."
  exit 1
fi

while [ $# -gt 0 ]; do
  case "$1" in
    --env)
      if [ -z "${2:-}" ]; then
        echo "Missing --env value. Expected development|staging|production."
        exit 1
      fi
      ENVIRONMENT="$2"
      shift 2
      ;;
    -h|--help)
      echo "Usage: bash deploy-render.sh --env <development|staging|production>"
      exit 0
      ;;
    *)
      echo "Unknown arg: $1"
      echo "Usage: bash deploy-render.sh --env <development|staging|production>"
      exit 1
      ;;
  esac
done

case "$ENVIRONMENT" in
  development|dev)
    SUFFIX="DEV"
    ;;
  staging|stg)
    SUFFIX="STG"
    ;;
  production|prod)
    SUFFIX="PROD"
    ;;
  *)
    echo "Invalid --env value \"$ENVIRONMENT\". Expected development|staging|production."
    exit 1
    ;;
esac

if [ -f .env ]; then
  echo "Loading .env..."
  set -a
  source .env
  set +a
fi

deploy_hook_var="RENDER_DEPLOY_HOOK_URL_${SUFFIX}"
url="${!deploy_hook_var}"

if [ -z "$url" ]; then
  echo "Missing ${deploy_hook_var}."
  exit 1
fi

echo "Triggering Render deploy (${ENVIRONMENT})..."
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
