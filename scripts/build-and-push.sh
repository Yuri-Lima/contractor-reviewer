#!/bin/sh
# Build and push all ContractAI Review images to Docker Hub.
# Usage: [DOCKERHUB_USERNAME=yurimatoslima] [IMAGE_TAG=latest] [BUILD_PLATFORM=linux/amd64] ./scripts/build-and-push.sh
# Prerequisites: docker login
# BUILD_PLATFORM: Target platform (default linux/amd64 for VPS). Use linux/arm64 for Apple Silicon local dev.

set -e

DOCKERHUB_USERNAME="${DOCKERHUB_USERNAME:-yurimatoslima}"
IMAGE_TAG="${IMAGE_TAG:-latest}"
BUILD_PLATFORM="${BUILD_PLATFORM:-linux/amd64}"
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

echo "Building and pushing images to $DOCKERHUB_USERNAME (tag: $IMAGE_TAG, platform: $BUILD_PLATFORM)"

# API — build from repo root
echo "--- Building contractai-api ---"
docker build --platform "$BUILD_PLATFORM" -f apps/api/Dockerfile -t "$DOCKERHUB_USERNAME/contractai-api:$IMAGE_TAG" .
docker push "$DOCKERHUB_USERNAME/contractai-api:$IMAGE_TAG"

# Web — build from repo root
echo "--- Building contractai-web ---"
docker build --platform "$BUILD_PLATFORM" -f apps/web/Dockerfile -t "$DOCKERHUB_USERNAME/contractai-web:$IMAGE_TAG" .
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
