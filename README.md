# ContractAI Review MVP+

Assistente jurídico baseado em provas: upload/visualização de contratos, chat com RAG (contrato + fontes legais), redlines e versionamento. Multi-tenant (workspace), privacidade, retenção e auditoria.

**Monorepo:** `apps/api` (NestJS + workers) | `apps/web` (Angular + Capacitor)

## Stack

- **Backend:** NestJS, TypeORM, Postgres + pgvector, BullMQ + Redis
- **Frontend:** Angular, Capacitor (web + iOS/Android)
- **Storage:** S3/R2 compatível
- **IA:** OpenAI (RAG + citações)

## Pré-requisitos

- Node.js >= 18
- pnpm >= 9
- Docker e Docker Compose (para Postgres e Redis)

## Setup local

### 1. Instalar dependências (raiz do monorepo)

```bash
pnpm install
```

### 2. Subir Postgres e Redis

Na raiz do projeto:

```bash
cp .env.example .env
# Editar .env com senhas e chaves conforme necessário

docker-compose up -d
```

### 3. API (apps/api)

A aplicação NestJS será criada na Fase 2. Quando estiver pronta:

```bash
# Rodar migrações TypeORM (primeira vez)
pnpm --filter api migration:run

# Desenvolvimento
pnpm --filter api start:dev

# Worker (processamento OCR/embeddings)
pnpm --filter api start:worker
```

Ou a partir da raiz:

```bash
pnpm start:api      # API
pnpm start:worker    # Worker
pnpm migration:run   # Migrações
```

### 4. Web (apps/web)

A aplicação Angular será criada na Fase 9. Quando estiver pronta:

```bash
pnpm --filter web start
# ou: pnpm dev:web
```

Abre em http://localhost:4200 (ou a porta configurada no Angular).

## Variáveis de ambiente

Ver `.env.example`. Principais:

| Variável | Descrição |
|----------|-----------|
| `DATABASE_URL` | URL do Postgres (compatível com TypeORM) |
| `REDIS_URL` | URL do Redis (BullMQ) |
| `JWT_SECRET` | Segredo para tokens JWT |
| `OPENAI_API_KEY` | Chave OpenAI (RAG) |
| `S3_*` ou equivalente | Storage (opcional em dev com implementação local) |

## Estrutura do monorepo

```
.
├── apps/
│   ├── api/          # NestJS (API REST + workers BullMQ)
│   └── web/          # Angular + Capacitor
├── packages/         # (opcional) código compartilhado
├── docker-compose.yml
├── pnpm-workspace.yaml
├── .env.example
└── README.md
```

## Fluxo de teste completo (após implementação)

Workspace → upload → chat com citações → redline com playbook → versões → export privacidade → purge.
