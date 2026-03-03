#!/bin/sh
# Build and push all ContractAI Review images to Docker Hub.
# Usage: [DOCKERHUB_USERNAME=yurimatoslima] [IMAGE_TAG=auto] [BUILD_PLATFORM=linux/amd64] ./scripts/build-and-push.sh
# IMAGE_TAG: auto-bumped as <version>-<YYYYMMDD-HHMMSS> when not provided.
# Prerequisites: docker login
# BUILD_PLATFORM: Target platform (default linux/amd64 for VPS). Use linux/arm64 for Apple Silicon local dev.

set -e

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

DOCKERHUB_USERNAME="${DOCKERHUB_USERNAME:-yurimatoslima}"
BUILD_PLATFORM="${BUILD_PLATFORM:-linux/amd64}"

# Auto-bump tag if not provided: <version>-<YYYYMMDD-HHMMSS>
if [ -z "${IMAGE_TAG}" ]; then
  VERSION="$(node -p "require('./package.json').version")"
  IMAGE_TAG="${VERSION}-$(date +%Y%m%d-%H%M%S)"
fi
export IMAGE_TAG

echo "Building and pushing images to $DOCKERHUB_USERNAME (tag: $IMAGE_TAG, platform: $BUILD_PLATFORM)"

# API — build via Nx (respects build order, cache)
echo "--- Building contractai-api ---"
DOCKER_BUILDKIT=1 pnpm nx run api:docker:build
docker tag "apps-api:$IMAGE_TAG" "$DOCKERHUB_USERNAME/contractai-api:$IMAGE_TAG"
docker push "$DOCKERHUB_USERNAME/contractai-api:$IMAGE_TAG"

# Web — build via Nx
echo "--- Building contractai-web ---"
DOCKER_BUILDKIT=1 pnpm nx run web:docker:build
docker tag "apps-web:$IMAGE_TAG" "$DOCKERHUB_USERNAME/contractai-web:$IMAGE_TAG"
docker push "$DOCKERHUB_USERNAME/contractai-web:$IMAGE_TAG"

# Docling — build from service dir
echo "--- Building contractai-docling ---"
docker build --platform "$BUILD_PLATFORM" -f services/docling/Dockerfile -t "$DOCKERHUB_USERNAME/contractai-docling:$IMAGE_TAG" ./services/docling
docker push "$DOCKERHUB_USERNAME/contractai-docling:$IMAGE_TAG"

# PDFPlumber — build from service dir
echo "--- Building contractai-pdfplumber ---"
docker build --platform "$BUILD_PLATFORM" -f services/pdfplumber/Dockerfile -t "$DOCKERHUB_USERNAME/contractai-pdfplumber:$IMAGE_TAG" ./services/pdfplumber
docker push "$DOCKERHUB_USERNAME/contractai-pdfplumber:$IMAGE_TAG"

echo "Done. All images pushed to $DOCKERHUB_USERNAME with tag $IMAGE_TAG"

# Clean up build artifacts and cache to free disk space
echo "--- Cleaning up ---"
docker image prune -f
docker builder prune -f
echo "Cleanup complete."
