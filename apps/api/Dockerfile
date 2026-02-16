# ContractAI Review API — multi-stage production build
# Build context: repository root (docker build -f apps/api/Dockerfile .)

# -----------------------------------------------------------------------------
# Stage 1: Builder
# -----------------------------------------------------------------------------
FROM node:20-alpine AS builder

RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
RUN apk add --no-cache libc6-compat

WORKDIR /app

# Copy workspace config
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Copy packages and apps
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api

# Install dependencies (includes shared via workspace)
RUN pnpm install --frozen-lockfile

# Build shared first, then api
RUN pnpm --filter @contractai-review/shared build
RUN pnpm --filter api build

# -----------------------------------------------------------------------------
# Stage 2: Production
# -----------------------------------------------------------------------------
FROM node:20-alpine AS production

RUN apk add --no-cache dumb-init wget

WORKDIR /app

# Copy built artifacts preserving monorepo structure (for shared package resolution)
COPY --from=builder /app/apps/api ./apps/api
COPY --from=builder /app/packages/shared ./packages/shared

WORKDIR /app/apps/api

# Copy entrypoint script
COPY apps/api/scripts/migrate-and-start.sh /usr/local/bin/migrate-and-start.sh
RUN chmod +x /usr/local/bin/migrate-and-start.sh

# Create storage dir for volume mount (writable by process)
RUN mkdir -p /app/apps/api/storage

EXPOSE 3000

# Default: run migrations then start API server.
# Override with: command: ["node", "dist/worker.js"] for worker service.
ENTRYPOINT ["dumb-init", "--"]
CMD ["/usr/local/bin/migrate-and-start.sh"]
