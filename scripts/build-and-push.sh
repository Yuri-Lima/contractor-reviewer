#!/bin/sh
# Build and push all ContractAI Review images to Docker Hub.
# Usage: [DOCKERHUB_USERNAME=yurimatoslima] [IMAGE_TAG=auto] [BUILD_PLATFORM=linux/amd64] ./scripts/build-and-push.sh
# IMAGE_TAG: auto-bumped as <version>-<YYYYMMDD-HHMMSS> when not provided.
# Prerequisites: docker login
# BUILD_PLATFORM: Target platform (default linux/amd64 for VPS). Use linux/arm64 for Apple Silicon local dev.
# BUILD_DOCLING, BUILD_PDFPLUMBER: auto|true|false. auto = build only if services/<name> has changes (default).

set -e

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

# Returns 0 (build) if services/$name has changes vs origin/main or uncommitted changes.
# Returns 1 (skip) if no changes. Respects BUILD_<SERVICE>=true|false override.
should_build_parser() {
  local name="$1"
  local val="auto"
  case "$name" in
    docling) val="${BUILD_DOCLING:-auto}" ;;
    pdfplumber) val="${BUILD_PDFPLUMBER:-auto}" ;;
  esac
  if [ "$val" = "false" ]; then return 1; fi
  if [ "$val" = "true" ]; then return 0; fi
  # auto: check git
  local dir="services/$name"
  if ! git diff --quiet -- "$dir" 2>/dev/null || ! git diff --quiet --cached -- "$dir" 2>/dev/null; then
    return 0
  fi
  if git rev-parse -q --verify origin/main >/dev/null 2>&1; then
    if [ -n "$(git diff --name-only origin/main...HEAD -- "$dir" 2>/dev/null)" ]; then
      return 0
    fi
  else
    # No origin/main: conservative, build to be safe
    return 0
  fi
  return 1
}

DOCKERHUB_USERNAME="${DOCKERHUB_USERNAME:-yurimatoslima}"
BUILD_PLATFORM="${BUILD_PLATFORM:-linux/amd64}"
export BUILD_PLATFORM

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
docker tag "apps-api:$IMAGE_TAG" "$DOCKERHUB_USERNAME/contractai-api:latest"
docker push "$DOCKERHUB_USERNAME/contractai-api:latest"

# Web — build via Nx
echo "--- Building contractai-web ---"
DOCKER_BUILDKIT=1 pnpm nx run web:docker:build
docker tag "apps-web:$IMAGE_TAG" "$DOCKERHUB_USERNAME/contractai-web:$IMAGE_TAG"
docker push "$DOCKERHUB_USERNAME/contractai-web:$IMAGE_TAG"
docker tag "apps-web:$IMAGE_TAG" "$DOCKERHUB_USERNAME/contractai-web:latest"
docker push "$DOCKERHUB_USERNAME/contractai-web:latest"

# Docling — build from service dir (only when services/docling has changes)
if should_build_parser docling; then
  echo "--- Building contractai-docling ---"
  docker build --platform "$BUILD_PLATFORM" -f services/docling/Dockerfile -t "$DOCKERHUB_USERNAME/contractai-docling:$IMAGE_TAG" ./services/docling
  docker push "$DOCKERHUB_USERNAME/contractai-docling:$IMAGE_TAG"
  docker tag "$DOCKERHUB_USERNAME/contractai-docling:$IMAGE_TAG" "$DOCKERHUB_USERNAME/contractai-docling:latest"
  docker push "$DOCKERHUB_USERNAME/contractai-docling:latest"
else
  echo "--- Skipping contractai-docling (no changes in services/docling) ---"
fi

# PDFPlumber — build from service dir (only when services/pdfplumber has changes)
if should_build_parser pdfplumber; then
  echo "--- Building contractai-pdfplumber ---"
  docker build --platform "$BUILD_PLATFORM" -f services/pdfplumber/Dockerfile -t "$DOCKERHUB_USERNAME/contractai-pdfplumber:$IMAGE_TAG" ./services/pdfplumber
  docker push "$DOCKERHUB_USERNAME/contractai-pdfplumber:$IMAGE_TAG"
  docker tag "$DOCKERHUB_USERNAME/contractai-pdfplumber:$IMAGE_TAG" "$DOCKERHUB_USERNAME/contractai-pdfplumber:latest"
  docker push "$DOCKERHUB_USERNAME/contractai-pdfplumber:latest"
else
  echo "--- Skipping contractai-pdfplumber (no changes in services/pdfplumber) ---"
fi

echo "Done. All images pushed to $DOCKERHUB_USERNAME with tags $IMAGE_TAG and latest"

# Clean up build artifacts and cache to free disk space
echo "--- Cleaning up ---"
docker image prune -f
docker builder prune -f
echo "Cleanup complete."
