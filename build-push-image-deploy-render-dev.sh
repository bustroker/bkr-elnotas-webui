#!/bin/bash
set -e

# Check headers in build-push-image.sh and deploy-render.sh for env var requirements.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Building and pushing image..."
bash "${SCRIPT_DIR}/build-push-image.sh"

echo "Triggering Render deploy (development)..."
bash "${SCRIPT_DIR}/deploy-render.sh" --env development

echo "✓ Done"
