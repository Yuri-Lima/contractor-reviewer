#!/bin/sh
# Build production Docker images for api and web with auto-bumped tag.
# Usage: [IMAGE_TAG=override] ./scripts/docker-build.sh
# Default IMAGE_TAG: <package.version>-<YYYYMMDD-HHMMSS> (e.g. 0.1.0-20250303143200)

set -e

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

# Auto-bump: version + timestamp if IMAGE_TAG not provided
if [ -z "${IMAGE_TAG}" ]; then
  VERSION="$(node -p "require('./package.json').version")"
  IMAGE_TAG="${VERSION}-$(date +%Y%m%d-%H%M%S)"
fi

export IMAGE_TAG
echo "Building with IMAGE_TAG=$IMAGE_TAG"

DOCKER_BUILDKIT=1 pnpm nx run-many -t docker:build -p api,web
