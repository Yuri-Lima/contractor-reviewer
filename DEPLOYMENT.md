# ContractAI Review — Production Deployment

Guide for deploying ContractAI Review to a remote server using Docker Compose.

## Architecture

```
                    ┌─────────────┐
                    │   Browser   │
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

## Build and Push to Docker Hub

Build all custom images and push to Docker Hub for VPS deployment. Run from the repository root.

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

Copy `deploy/docker-compose.yml` and `deploy/.env.example` to your server.

### 2. Create .env

```bash
cp .env.example .env
```

Edit `.env` and set:

- `DOCKERHUB_USERNAME` — Docker Hub username (default: `yurimatoslima`)
- `IMAGE_TAG` — Tag to pull (default: `latest`, or e.g. `v1.0.0`)
- `POSTGRES_PASSWORD`, `JWT_SECRET`, `OPENAI_API_KEY`, `SUPERADMIN_PASSWORD` — Required secrets

### 3. Run

```bash
docker compose up -d
```

### 4. Access the app

- **Web UI**: http://your-server-ip (port 80)
- **Superadmin login**: Use `SUPERADMIN_EMAIL` and `SUPERADMIN_PASSWORD` from `.env`

## Quick Start (Local Build)

For local development or when building images on the same machine as deployment:

### 1. Clone and configure

```bash
git clone <repo-url> contractor-reviwer
cd contractor-reviwer
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
| `PARSER_KEYS_ENCRYPTION_KEY` | If using DPT-2/LlamaParse/Unstructured | 32-byte hex key |
| `S3_*` | If using S3/R2 | Storage credentials |
| `EVENTHOG_*`, `SENTRY_DSN` | Optional | Observability |

## Storage

- **Local (default)**: Files stored in Docker volume `api_storage`. Persists across restarts.
- **S3/R2**: Set `STORAGE_TYPE=s3` and `S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_BUCKET`.

## TLS / HTTPS

For production, place a reverse proxy (Caddy, Traefik, nginx) in front of the `web` container to handle TLS termination. The web container serves HTTP on port 80.

Example with Caddy (single domain):

```caddyfile
app.example.com {
    reverse_proxy localhost:80
}
```

## Commands

**VPS (deploy/):**

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
