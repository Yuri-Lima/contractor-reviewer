#!/usr/bin/env bash
# Open the pipeline health dashboard in the default browser.
# Serves ui/ on a local port when possible so Chart.js CDN + ES modules work offline-friendly.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
UI_DIR="${ROOT}/ui"
PORT="${UI_PORT:-8765}"

if [[ ! -d "$UI_DIR" ]]; then
  echo "error: ui/ directory not found at $UI_DIR" >&2
  exit 1
fi

# Prefer a tiny static server so relative assets resolve correctly
if command -v python3 >/dev/null 2>&1; then
  # Kill any prior server on the port (best-effort)
  if command -v lsof >/dev/null 2>&1; then
    lsof -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null | xargs kill 2>/dev/null || true
  fi
  (cd "$UI_DIR" && python3 -m http.server "$PORT" >/tmp/contractai-ui-server.log 2>&1 &) 
  SERVER_PID=$!
  echo "Serving ui/ at http://127.0.0.1:${PORT}/ (pid ${SERVER_PID})"
  URL="http://127.0.0.1:${PORT}/index.html"
  # Give the server a moment to bind
  sleep 0.4
else
  URL="file://${UI_DIR}/index.html"
  echo "python3 not found — opening file URL: $URL"
fi

open_url() {
  local url="$1"
  if command -v open >/dev/null 2>&1; then
    open "$url"
  elif command -v xdg-open >/dev/null 2>&1; then
    xdg-open "$url"
  elif command -v wslview >/dev/null 2>&1; then
    wslview "$url"
  else
    echo "Open this URL in your browser: $url"
  fi
}

open_url "$URL"
echo "Dashboard opened."
