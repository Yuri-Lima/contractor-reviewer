#!/bin/sh
# Build and push all ContractAI Review images to Docker Hub.
# Usage: [DOCKERHUB_USERNAME=yurimatoslima] [IMAGE_TAG=latest] ./scripts/build-and-push.sh
# Prerequisites: docker login

set -e

DOCKERHUB_USERNAME="${DOCKERHUB_USERNAME:-yurimatoslima}"
IMAGE_TAG="${IMAGE_TAG:-latest}"
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

echo "Building and pushing images to $DOCKERHUB_USERNAME (tag: $IMAGE_TAG)"

# API — build from repo root
echo "--- Building contractai-api ---"
docker build -f apps/api/Dockerfile -t "$DOCKERHUB_USERNAME/contractai-api:$IMAGE_TAG" .
docker push "$DOCKERHUB_USERNAME/contractai-api:$IMAGE_TAG"

# Web — build from repo root
echo "--- Building contractai-web ---"
docker build -f apps/web/Dockerfile -t "$DOCKERHUB_USERNAME/contractai-web:$IMAGE_TAG" .
docker push "$DOCKERHUB_USERNAME/contractai-web:$IMAGE_TAG"

# Docling — build from service dir
echo "--- Building contractai-docling ---"
docker build -f services/docling/Dockerfile -t "$DOCKERHUB_USERNAME/contractai-docling:$IMAGE_TAG" ./services/docling
docker push "$DOCKERHUB_USERNAME/contractai-docling:$IMAGE_TAG"

# PDFPlumber — build from service dir
echo "--- Building contractai-pdfplumber ---"
docker build -f services/pdfplumber/Dockerfile -t "$DOCKERHUB_USERNAME/contractai-pdfplumber:$IMAGE_TAG" ./services/pdfplumber
docker push "$DOCKERHUB_USERNAME/contractai-pdfplumber:$IMAGE_TAG"

echo "Done. All images pushed to $DOCKERHUB_USERNAME with tag $IMAGE_TAG"
