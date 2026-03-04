#!/usr/bin/env bash
# Redis MCP wrapper: loads project .env (REDIS_URL or REDIS_HOST/REDIS_PORT) and runs redis-mcp-server.
# Same Redis config as apps/api (redis.provider.ts).
set -e
cd "$(dirname "$0")/.."

if [ -f .env ]; then
  set -a
  # shellcheck source=/dev/null
  . ./.env
  set +a
fi

# Build URL from REDIS_URL or REDIS_HOST/REDIS_PORT (matches redis.provider.ts)
if [ -n "$REDIS_URL" ]; then
  URL="$REDIS_URL"
else
  HOST="${REDIS_HOST:-localhost}"
  PORT="${REDIS_PORT:-6379}"
  URL="redis://${HOST}:${PORT}/0"
fi

exec uvx -qq --from redis-mcp-server@latest redis-mcp-server --url "$URL"
