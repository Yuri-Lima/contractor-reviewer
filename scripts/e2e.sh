#!/bin/bash

# E2E test runner - starts API (optional), ensures web is started by Playwright, runs e2e tests.
# Prerequisites: docker-compose up (Postgres + Redis)
#
# Usage:
#   ./scripts/e2e.sh              # Run e2e (API must be running separately)
#   E2E_WITH_API=1 ./scripts/e2e.sh  # Start API in background, run e2e, kill API on exit

set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

export CI="${CI:-false}"

echo "=== E2E Test Runner ==="
echo "Root: $ROOT"
echo "CI: $CI"
echo ""

# Kill process and its children (used on Ctrl+C / EXIT)
kill_tree() {
  local pid=$1
  [ -z "$pid" ] && return
  kill -TERM "$pid" 2>/dev/null || true
  for child in $(pgrep -P "$pid" 2>/dev/null); do
    kill_tree "$child"
  done
  sleep 2
  kill -9 "$pid" 2>/dev/null || true
  for child in $(pgrep -P "$pid" 2>/dev/null); do
    kill -9 "$child" 2>/dev/null || true
  done
}

cleanup_api() {
  [ -n "$CLEANUP_DONE" ] && return
  CLEANUP_DONE=1
  if [ -n "$API_PID" ]; then
    echo "Shutting down API (PID $API_PID)..."
    kill_tree "$API_PID"
    echo "API stopped."
  fi
}

# Optional: start API in background
if [ "${E2E_WITH_API}" = "1" ]; then
  echo "Starting API in background..."
  cd apps/api
  pnpm start:dev &
  API_PID=$!
  cd "$ROOT"
  trap cleanup_api EXIT
  trap 'cleanup_api; exit 130' INT
  trap 'cleanup_api; exit 143' TERM
  echo "Waiting for API to be ready..."
  for i in {1..30}; do
    if curl -s http://localhost:3000/api/health >/dev/null 2>&1; then
      echo "API is ready"
      break
    fi
    sleep 1
    if [ $i -eq 30 ]; then
      echo "API failed to start within 30s"
      exit 1
    fi
  done
  echo ""
fi

echo "Running E2E tests..."
cd apps/web
pnpm e2e
