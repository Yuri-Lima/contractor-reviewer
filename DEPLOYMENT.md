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

## Quick Start

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

```bash
# Logs
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs -f api
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs -f worker

# Restart a service
docker compose -f docker-compose.yml -f docker-compose.prod.yml restart api

# Stop all
docker compose -f docker-compose.yml -f docker-compose.prod.yml down

# Stop and remove volumes (destructive)
docker compose -f docker-compose.yml -f docker-compose.prod.yml down -v
```

## Troubleshooting

### API fails to start

- Ensure Postgres and Redis are healthy: `docker compose ps`
- Check API logs: `docker compose -f docker-compose.yml -f docker-compose.prod.yml logs api`
- Verify `DATABASE_URL` and `REDIS_URL` point to `postgres` and `redis` (Docker internal hostnames)

### Worker not processing jobs

- Worker must connect to same Redis as API
- Check worker logs: `docker compose -f docker-compose.yml -f docker-compose.prod.yml logs worker`

### Docling/PDFPlumber unavailable

- Parsers run in separate containers. Ensure `docker-compose.yml` services (docling, pdfplumber) are up.
- API and Worker use `DOCLING_URL=http://docling:8000` and `PDFPLUMBER_URL=http://pdfplumber:8001`
