# ContractAI Review — Production Deployment

Guide for deploying ContractAI Review to a remote server using Docker Compose.

## Architecture

```
                    ┌─────────────┐
                    │   Browser   │
                    └──────┬──────┘
                           │ HTTP/HTTPS
                    ┌──────▼──────┐
                    │   Traefik   │  TLS, Let's Encrypt, HTTP→HTTPS redirect
                    │  :80, :443  │
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │  web :80    │  Nginx (Angular SPA + /api proxy)
                    └──────┬──────┘
                           │ /api
                    ┌──────▼──────┐
                    │  api :3000  │  NestJS API
                    └──────┬──────┘
           ┌──────────────┼──────────────┐
           │              │              │
    ┌──────▼──────┐ ┌─────▼─────┐ ┌─────▼─────┐
    │  postgres   │ │   redis   │ │ docling   │
    │   :5432     │ │   :6379   │ │ pdfplumber│
    └─────────────┘ └─────┬─────┘ └───────────┘
                          │
                    ┌─────▼─────┐
                    │  worker   │  BullMQ processors
                    └───────────┘
```

## Prerequisites

- Docker and Docker Compose v2+
- Server with at least 2GB RAM
- Required secrets: `POSTGRES_PASSWORD`, `JWT_SECRET`, `OPENAI_API_KEY`, `SUPERADMIN_PASSWORD`
- For HTTPS: Domain name with A/AAAA records pointing to your server

## Build and Push to Docker Hub

Build all custom images and push to Docker Hub for VPS deployment. Run from the repository root.

**Important**: If you see "Welcome to nginx!" instead of the app, the `contractai-web` image needs to be rebuilt and pushed (Angular 17+ outputs to a `browser` subdirectory). Rebuild and push:

```bash
pnpm docker:push
# Or to rebuild only web: docker build -f apps/web/Dockerfile -t yurimatoslima/contractai-web:latest . && docker push yurimatoslima/contractai-web:latest
```

**Prerequisites**: `docker login` (authenticate to Docker Hub)

```bash
# Default: yurimatoslima (override with DOCKERHUB_USERNAME=otheruser)
pnpm docker:push

# Optional: versioned tag (default: latest)
IMAGE_TAG=v1.0.0 pnpm docker:push
```

Pushes: `contractai-api`, `contractai-web`, `contractai-docling`, `contractai-pdfplumber`

## VPS Deployment (Pull from Docker Hub)

Deploy on a VPS without source code. Uses pre-built images from Docker Hub.

### 1. Copy deployment files to VPS

Copy the `deploy/` folder to your server (or copy `deploy/docker-compose.yml` and `deploy/.env.example` into a directory).

### 2. Create .env

```bash
cd deploy   # or cd into the directory containing the copied files
cp .env.example .env
```

Edit `.env` and set:

- `DOCKERHUB_USERNAME` — Docker Hub username (default: `yurimatoslima`)
- `IMAGE_TAG` — Tag to pull (default: `latest`, or e.g. `v1.0.0`)
- `POSTGRES_PASSWORD`, `JWT_SECRET`, `OPENAI_API_KEY`, `SUPERADMIN_PASSWORD` — Required secrets
- `SITE_DOMAIN` — Domain pointing to your VPS (e.g. `app.example.com`)
- `SITE_DOMAIN_ROOT` — (Optional) Root domain (e.g. `example.com`) to also serve via HTTPS
- `ACME_EMAIL` — Email for Let's Encrypt certificate notifications

### 3. Run

```bash
# From the deploy directory
docker compose up -d
```

### 4. Access the app

- **Web UI**: https://your-domain (when `SITE_DOMAIN` is your domain)
- **Web UI (IP only)**: http://your-server-ip — set `SITE_DOMAIN` to your server IP in `.env` (Let's Encrypt will not work for IPs)
- **Superadmin login**: Use `SUPERADMIN_EMAIL` and `SUPERADMIN_PASSWORD` from `.env`

**Note**: `SITE_DOMAIN` must match the Host header used to access the app (your domain or server IP). Traefik routes requests by Host.

**HTTPS** (when using a domain): Traefik obtains Let's Encrypt certificates automatically. Ensure:
- DNS A/AAAA records for `SITE_DOMAIN` point to your server
- Ports 80 and 443 are open. Use `ACME_STAGING=true` initially to test, then switch to production.

## Quick Start (Local Build)

For local development or when building images on the same machine as deployment:

### 1. Clone and configure

```bash
git clone <repo-url> contractor-reviewer
cd contractor-reviewer
```

### 2. Create production env file

```bash
cp .env.production.example .env
```

Edit `.env` and set **required** values:

- `POSTGRES_PASSWORD` — Strong password for Postgres
- `JWT_SECRET` — Generate with: `openssl rand -hex 32`
- `OPENAI_API_KEY` — From [OpenAI API Keys](https://platform.openai.com/api-keys)
- `SUPERADMIN_PASSWORD` — Password for the initial admin user

### 3. Build and run

```bash
# Build images and start all services
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build

# Check status
docker compose -f docker-compose.yml -f docker-compose.prod.yml ps
```

### 4. Access the app

- **Web UI**: http://localhost (or your server IP)
- **Superadmin login**: Use `SUPERADMIN_EMAIL` and `SUPERADMIN_PASSWORD` from `.env`

## Environment Variables

See [.env.production.example](.env.production.example) for the full list. Summary:

| Variable | Required | Description |
|----------|----------|-------------|
| `POSTGRES_PASSWORD` | Yes | Postgres password |
| `JWT_SECRET` | Yes | JWT signing key (min 32 chars) |
| `OPENAI_API_KEY` | Yes | OpenAI API key for RAG |
| `SUPERADMIN_PASSWORD` | Yes | Initial admin password |
| `SITE_DOMAIN` | Yes for HTTPS | Domain pointing to VPS |
| `ACME_EMAIL` | Yes for HTTPS | Let's Encrypt notification email |
| `ACME_STAGING` | Optional | Set `true` for staging certs during testing |
| `ACME_CASERVER` | When staging | Staging CA URL when `ACME_STAGING=true` |
| `FRONTEND_URL` | For HTTPS | `https://your-domain.com` for CORS/redirects |
| `PARSER_KEYS_ENCRYPTION_KEY` | If using DPT-2/LlamaParse/Unstructured | 32-byte hex key |
| `S3_*` | If using S3/R2 | Storage credentials |
| `EVENTHOG_*`, `SENTRY_DSN` | Optional | Observability |

## Storage

- **Local (default)**: Files stored in Docker volume `api_storage`. Persists across restarts.
- **S3/R2**: Set `STORAGE_TYPE=s3` and `S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_BUCKET`.

## TLS / HTTPS

The deploy stack includes **Traefik** for automatic TLS termination and Let's Encrypt certificate management.

### Configuration

Set in `.env`:

| Variable | Description |
|----------|-------------|
| `SITE_DOMAIN` | Domain pointing to your VPS (e.g. `app.example.com`) |
| `SITE_DOMAIN_ROOT` | Optional: root domain (e.g. `example.com`) for `https://example.com` |
| `ACME_EMAIL` | Email for Let's Encrypt notifications |
| `ACME_STAGING` | Set to `true` for testing; uses staging certificates to avoid rate limits |
| `ACME_CASERVER` | When `ACME_STAGING=true`, set to `https://acme-staging-v02.api.letsencrypt.org/directory` |
| `FRONTEND_URL` | Set to `https://your-domain.com` so CORS and redirects work correctly |

### DNS

Point your domain's A/AAAA records to the server IP. Traefik uses HTTP-01 challenge; port 80 must be reachable for certificate issuance.

### Staging first

Use `ACME_STAGING=true` and `ACME_CASERVER=https://acme-staging-v02.api.letsencrypt.org/directory` until everything works. Then switch to production (remove or set `ACME_STAGING=false`, remove `ACME_CASERVER` or use production default) and restart.

### Traefik dashboard (optional, dev only)

To enable the dashboard on port 8080 for debugging, add to the Traefik service in `docker-compose.yml`:

- Port: `8080:8080`
- Command: `--api.insecure=true`

**Warning**: Do not expose the dashboard in production without authentication.

## Verify deployment

Run the verification script after `docker compose up -d`:

```bash
pnpm verify:deploy
# or
./scripts/verify-deployment.sh
```

This checks: containers, ports, API health, DB/Redis, and Traefik→web connectivity. Full end-to-end: open https://app.legalaiassistance.com in a browser (ensure DNS A record for `app` points to your VPS).

## Commands

**VPS (from `deploy/` directory):**

```bash
docker compose logs -f api
docker compose restart api
docker compose down
```

**Local build (docker-compose.yml + docker-compose.prod.yml):**

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs -f api
docker compose -f docker-compose.yml -f docker-compose.prod.yml restart api
docker compose -f docker-compose.yml -f docker-compose.prod.yml down
```

## Troubleshooting

### API fails to start

- Ensure Postgres and Redis are healthy: `docker compose ps`
- Check API logs: `docker compose logs api` (VPS) or `docker compose -f docker-compose.yml -f docker-compose.prod.yml logs api` (local)
- Verify `DATABASE_URL` and `REDIS_URL` point to `postgres` and `redis` (Docker internal hostnames)

### Worker not processing jobs

- Worker must connect to same Redis as API
- Check worker logs: `docker compose logs worker` (VPS) or `docker compose -f docker-compose.yml -f docker-compose.prod.yml logs worker` (local)

### Docling/PDFPlumber unavailable

- Parsers run in separate containers. Ensure `docker-compose.yml` services (docling, pdfplumber) are up.
- API and Worker use `DOCLING_URL=http://docling:8000` and `PDFPLUMBER_URL=http://pdfplumber:8001`

### Redis "READONLY You can't write against a read only replica"

- Redis was running as a **replica** (read-only) instead of master. BullMQ requires writes.
- **Fix**: Remove the Redis volume and restart so Redis starts fresh as master:
  ```bash
  docker compose stop redis
  docker volume rm deploy_redis_data   # or the redis_data volume name
  docker compose up -d redis
  docker compose restart api worker
  ```
