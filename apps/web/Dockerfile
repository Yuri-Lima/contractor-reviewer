# ContractAI Review Web — multi-stage production build
# Build context: repository root (docker build -f apps/web/Dockerfile .)

# -----------------------------------------------------------------------------
# Stage 1: Builder
# -----------------------------------------------------------------------------
FROM node:20-alpine AS builder

RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

WORKDIR /app

# Copy workspace config
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Copy packages and apps
COPY packages/shared ./packages/shared
COPY apps/web ./apps/web

# Install dependencies
RUN pnpm install --frozen-lockfile

# Build shared first, then web (production config)
RUN pnpm --filter @contractai-review/shared build
RUN pnpm --filter web build --configuration production

# -----------------------------------------------------------------------------
# Stage 2: Production (Nginx)
# -----------------------------------------------------------------------------
# Pin 1.27+ for upstream resolve (dynamic DNS with scaled API replicas)
FROM nginx:1.27-alpine AS production

# Remove default config
RUN rm /etc/nginx/conf.d/default.conf

# Copy built app
COPY --from=builder /app/apps/web/dist/contractai-web /usr/share/nginx/html

# Copy nginx configs — main for worker tuning, default.conf for server
COPY apps/web/nginx-main.conf /etc/nginx/nginx.conf
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf

# Non-root user (nginx:nginx already exists in image)
# Ensure nginx can read the files
RUN chown -R nginx:nginx /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
