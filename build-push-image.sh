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
#   IMAGE_NAME              Required. Image name/repo
#   IMAGE_TAG               Required. Tag to publish
#   DOCKER_DEFAULT_PLATFORM Optional. Docker target platform, e.g. linux/amd64
#
# Full image ref:
#   <REGISTRY_PREFIX>/<IMAGE_NAME>:<IMAGE_TAG>

# Example (GHCR):
#   REGISTRY_PREFIX=ghcr.io/quintolabs-es
#   REGISTRY_USERNAME=your-github-username
#   REGISTRY_TOKEN=ghp_xxx
#   IMAGE_NAME=bkr-elnotas-webui
#   IMAGE_TAG=1.0.0
#
# Final image refs:
#   ghcr.io/quintolabs-es/bkr-elnotas-webui:1.0.0
#   ghcr.io/quintolabs-es/bkr-elnotas-webui:latest
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
export DOCKER_DEFAULT_PLATFORM="${DOCKER_DEFAULT_PLATFORM:-linux/amd64}"

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

if [ -z "$IMAGE_NAME" ]; then
  echo "Missing IMAGE_NAME."
  exit 1
fi

if [ -z "$IMAGE_TAG" ]; then
  echo "Missing IMAGE_TAG."
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
