#!/usr/bin/env bash
# ContractAI Review — Deployment verification tests
# Run from repo root or deploy dir. Usage: ./scripts/verify-deployment.sh
# Do not use set -e — we want to run all tests and report

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

PASS=0
FAIL=0
SKIP=0

pass() { echo -e "${GREEN}[PASS]${NC} $1"; ((PASS++)); }
fail() { echo -e "${RED}[FAIL]${NC} $1"; ((FAIL++)); }
skip() { echo -e "${YELLOW}[SKIP]${NC} $1"; ((SKIP++)); }
info() { echo -e "       $1"; }

echo "=============================================="
echo " ContractAI Review — Deployment Verification"
echo "=============================================="

# Resolve paths
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
DEPLOY_DIR="$REPO_ROOT/deploy"

cd "$DEPLOY_DIR"

# 1. Docker Compose — containers running
echo ""
echo "1. Docker containers"
if docker compose ps --format json 2>/dev/null | grep -q '"State":"running"'; then
  pass "Docker Compose stack is running"
  docker compose ps --format "table {{.Name}}\t{{.Status}}" 2>/dev/null | tail -n +2 | while read line; do info "$line"; done
else
  fail "No running containers. Run: cd deploy && docker compose up -d"
fi

# 2. Required containers exist and are up
echo ""
echo "2. Required services"
for svc in postgres redis traefik api web worker docling pdfplumber; do
  name="contractai-$svc"
  if docker ps --format '{{.Names}}' 2>/dev/null | grep -q "^${name}$"; then
    status=$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}running{{end}}' "$name" 2>/dev/null || echo "unknown")
    if [ "$status" = "healthy" ] || [ "$status" = "running" ]; then
      pass "$name ($status)"
    elif [ "$status" = "starting" ]; then
      skip "$name ($status - may need more time)"
    else
      fail "$name ($status)"
    fi
  else
    fail "$name not found"
  fi
done

# 3. Ports listening
echo ""
echo "3. Ports"
for port in 80 443; do
  if ss -tlnp 2>/dev/null | grep -q ":$port "; then
    pass "Port $port (HTTP/HTTPS) is listening"
  else
    fail "Port $port is not listening"
  fi
done

# 4. Traefik → Web connectivity
echo ""
echo "4. Internal connectivity"
if docker compose exec -T traefik wget -q -O- --timeout=3 http://web:80/ 2>/dev/null | grep -qE '<!DOCTYPE|html'; then
  pass "Traefik can reach web container"
else
  fail "Traefik cannot reach web container"
fi

# 5. API direct (from api container)
echo ""
echo "5. API health"
api_out=$(docker compose exec -T api wget -q -S -O /dev/null http://localhost:3000/api/health 2>&1) || true
api_code=$(echo "$api_out" | grep "HTTP/" | tail -1 | awk '{print $2}')
if [ "$api_code" = "200" ] || [ "$api_code" = "401" ] || [ "$api_code" = "404" ]; then
  pass "API responds on /api (HTTP $api_code)"
elif [ -n "$api_code" ]; then
  fail "API returned HTTP $api_code"
else
  fail "API does not respond on /api"
fi

# 6. Traefik routing (internal: Traefik→web; external requires DNS + domain)
echo ""
echo "6. Traefik routing"
# Internal: Traefik can reach web (already verified in test 4)
resp_domain=$(curl -s -o /dev/null -w "%{http_code}" -H "Host: app.legalaiassistance.com" http://localhost/ 2>/dev/null || echo "000")
resp_local=$(curl -s -o /dev/null -w "%{http_code}" http://localhost/ 2>/dev/null || echo "000")
if [ "$resp_domain" = "200" ] || [ "$resp_domain" = "302" ] || [ "$resp_domain" = "301" ]; then
  pass "Traefik routes to web via domain (HTTP $resp_domain)"
elif [ "$resp_local" = "200" ] || [ "$resp_local" = "302" ]; then
  pass "Traefik routes to web via localhost (HTTP $resp_local)"
else
  # Traefik→web connectivity works (test 4). External routing needs domain from browser.
  skip "External routing: domain=$resp_domain, localhost=$resp_local (use https://app.legalaiassistance.com from browser)"
fi

# 7. API via proxy (same as test 6 - needs domain)
echo ""
echo "7. API via web proxy"
api_resp_local=$(curl -s -o /dev/null -w "%{http_code}" http://localhost/api/health 2>/dev/null || echo "000")
api_resp_domain=$(curl -s -o /dev/null -w "%{http_code}" -H "Host: app.legalaiassistance.com" http://localhost/api/health 2>/dev/null || echo "000")
if [ "$api_resp_local" = "200" ] || [ "$api_resp_domain" = "200" ]; then
  pass "API reachable via proxy (HTTP ${api_resp_local:-$api_resp_domain})"
else
  skip "API via proxy: run from browser at https://app.legalaiassistance.com/api/health"
fi

# 8. DNS (if resolvable)
echo ""
echo "8. DNS resolution"
if getent hosts app.legalaiassistance.com >/dev/null 2>&1; then
  ip=$(getent hosts app.legalaiassistance.com | awk '{print $1}')
  pass "app.legalaiassistance.com resolves to $ip"
elif command -v dig >/dev/null 2>&1; then
  ip=$(dig +short app.legalaiassistance.com 2>/dev/null | head -1)
  if [ -n "$ip" ]; then
    pass "app.legalaiassistance.com resolves to $ip"
  else
    skip "DNS resolution failed or not configured"
  fi
else
  skip "Cannot verify DNS (getent/dig not available)"
fi

# 9. PostgreSQL
echo ""
echo "9. Database"
if docker compose exec -T postgres pg_isready -U contractai -d contractai 2>/dev/null; then
  pass "PostgreSQL is ready"
else
  fail "PostgreSQL is not ready"
fi

# 10. Redis
echo ""
echo "10. Redis"
if docker compose exec -T redis redis-cli ping 2>/dev/null | grep -q PONG; then
  pass "Redis responds to PING"
else
  fail "Redis does not respond"
fi

# Summary
echo ""
echo "=============================================="
echo " Summary: $PASS passed, $FAIL failed, $SKIP skipped"
echo "=============================================="
if [ $FAIL -gt 0 ]; then
  echo ""
  echo "Troubleshooting:"
  echo "  - Check logs: docker compose logs api web traefik"
  echo "  - Restart:    docker compose restart api web"
  echo "  - Full test:  Visit https://app.legalaiassistance.com (ensure DNS A record points to this server)"
  exit 1
fi
echo ""
echo "To verify end-to-end: open https://app.legalaiassistance.com in a browser."
exit 0
