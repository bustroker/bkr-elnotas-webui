#!/bin/bash
set -e

# ===========================================================
# Build image and push it to a container registry.
# ===========================================================
#
# Reads from `.env` file if present:
#   REGISTRY_PREFIX         Required. Host + namespace, e.g. ghcr.io/quintolabs-es
#   REGISTRY_USERNAME       Required. Registry username used to login
#   REGISTRY_TOKEN          Required. Registry token/password used to login
#   IMAGE_NAME              Optional. Image name/repo (default "bkr-baby-webapi")
#   IMAGE_TAG               Optional. Tag to publish (default "0.0.1")
#   DOCKER_DEFAULT_PLATFORM Optional. (default "linux/amd64")
#
# Full image ref:
#   <REGISTRY_PREFIX>/<IMAGE_NAME>:<IMAGE_TAG>

# Example (GHCR):
#   REGISTRY_PREFIX=ghcr.io/quintolabs-es
#   REGISTRY_USERNAME=your-github-username
#   REGISTRY_TOKEN=ghp_xxx
#   IMAGE_NAME=org-appname-webapi
#   IMAGE_TAG=0.0.1
#
# Final image refs:
#   ghcr.io/quintolabs-es/org-appname-webapi:0.0.1
#   ghcr.io/quintolabs-es/org-appname-webapi:latest
if [ -f .env ]; then
  echo "Loading .env..."
  set -a
  source .env
  set +a
fi

REGISTRY_PREFIX="${REGISTRY_PREFIX:-}"
REGISTRY_USERNAME="${REGISTRY_USERNAME:-}"
REGISTRY_TOKEN="${REGISTRY_TOKEN:-}"
IMAGE_NAME="${IMAGE_NAME:-}"
IMAGE_TAG="${IMAGE_TAG:-}"
export DOCKER_DEFAULT_PLATFORM="${DOCKER_DEFAULT_PLATFORM:-}"

if [ -z "$REGISTRY_PREFIX" ]; then
  echo "Missing REGISTRY_PREFIX (example: ghcr.io/quintolabs-es)."
  exit 1
fi

if [ -z "$REGISTRY_USERNAME" ]; then
  echo "Missing REGISTRY_USERNAME."
  exit 1
fi

if [ -z "$REGISTRY_TOKEN" ]; then
  echo "Missing REGISTRY_TOKEN."
  exit 1
fi

REGISTRY_HOST="${REGISTRY_PREFIX%%/*}"
FULL_IMAGE_NAME="${REGISTRY_PREFIX}/${IMAGE_NAME}"

echo "Logging in to ${REGISTRY_HOST}..."
echo "$REGISTRY_TOKEN" | docker login "$REGISTRY_HOST" -u "$REGISTRY_USERNAME" --password-stdin

echo "Building image (${DOCKER_DEFAULT_PLATFORM})..."
docker build -t "${IMAGE_NAME}:${IMAGE_TAG}" .

echo "Tagging image..."
docker tag "${IMAGE_NAME}:${IMAGE_TAG}" "${FULL_IMAGE_NAME}:${IMAGE_TAG}"
docker tag "${IMAGE_NAME}:${IMAGE_TAG}" "${FULL_IMAGE_NAME}:latest"

echo "Pushing to registry..."
docker push "${FULL_IMAGE_NAME}:${IMAGE_TAG}"
docker push "${FULL_IMAGE_NAME}:latest"

echo "✓ Done"
