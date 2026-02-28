#!/usr/bin/env bash
# Verify Docling and PDFPlumber parser services are reachable.
# Usage: pnpm run verify:parsers

set -e

DOCLING_URL="${DOCLING_URL:-http://localhost:8000}"
PDFPLUMBER_URL="${PDFPLUMBER_URL:-http://localhost:8001}"

echo "Verifying parser services..."
echo ""

check_service() {
  local name=$1
  local docker_service=$2
  local url=$3
  local health_url="${url}/health"
  if curl -sf --connect-timeout 3 "$health_url" > /dev/null 2>&1; then
    echo "  $name: OK ($health_url)"
    return 0
  else
    echo "  $name: FAILED ($health_url)"
    echo "    Start with: docker-compose up -d $docker_service"
    return 1
  fi
}

failed=0
check_service "Docling" "docling" "$DOCLING_URL" || failed=1
check_service "PDFPlumber" "pdfplumber" "$PDFPLUMBER_URL" || failed=1

echo ""
if [ $failed -eq 0 ]; then
  echo "All parser services are running."
  exit 0
else
  echo "Some parser services are not running. Start them with:"
  echo "  docker-compose up -d docling pdfplumber"
  exit 1
fi
