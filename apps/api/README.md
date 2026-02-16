# ContractAI Review — API (NestJS)

Backend da plataforma ContractAI Review: API REST, workers BullMQ e integrações (RAG, parsers, storage).

## Stack

- **Framework:** NestJS
- **ORM:** TypeORM
- **Database:** PostgreSQL + pgvector
- **Queue:** BullMQ + Redis
- **Storage:** S3/R2 compatível (local em dev)
- **AI:** OpenAI (embeddings, chat RAG)
- **Parsers:** Docling, PDFPlumber (Python microservices), DPT-2, LlamaParse, Unstructured (cloud APIs)

## Estrutura Principal

```
src/
├── main.ts                 # Bootstrap
├── app.module.ts
├── auth/                   # Autenticação JWT, registro
├── workspace/              # Workspaces, membros, settings, document-parsers
├── documents/              # CRUD de documentos
├── parsers/                # Adapters de parsers (Docling, PDFPlumber, DPT-2, etc.)
├── rag/                    # RAG service, chat, citações
├── storage/                # Interface S3/local
├── common/                 # EncryptionService, pipes, guards
├── entities/               # TypeORM entities
├── workers/                # BullMQ processors (parsing, chunking, embeddings)
└── migrations/
```

## Document Parsers

- **Docling** e **PDFPlumber:** serviços Python em Docker (`services/docling`, `services/pdfplumber`). URLs via `DOCLING_URL`, `PDFPLUMBER_URL`.
- **DPT-2, LlamaParse, Unstructured:** APIs cloud. API keys armazenadas por workspace (criptografadas). Configurar em Workspace Settings > Document Parsers.

Endpoints:

- `GET /api/workspaces/:workspaceId/document-parsers` — lista parsers com `hasApiKey`
- Upload aceita parâmetro `parser` opcional (docling | pdfplumber | dpt2 | llamaparse | unstructured)

Ver [DOCUMENT-PARSERS.md](../../DOCUMENT-PARSERS.md) no root do monorepo.

## Comandos

```bash
# Desenvolvimento
pnpm start:dev

# Worker (parsing, chunking, embeddings)
pnpm start:worker

# Migrações
pnpm migration:run
pnpm migration:generate -- src/migrations/MigrationName
```

## Variáveis de Ambiente

Ver `.env.example` no root. Principais para a API:

- `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `OPENAI_API_KEY`
- `PARSER_KEYS_ENCRYPTION_KEY` — obrigatório se usar DPT-2, LlamaParse ou Unstructured
- `DOCLING_URL`, `PDFPLUMBER_URL`
- `STORAGE_TYPE`, `STORAGE_PATH` ou `S3_*`

## Módulos Documentados

- [workspace/README.md](src/workspace/README.md) — Workspaces, RBAC, settings, document-parsers
- [storage/README.md](src/storage/README.md) — Storage S3/local, validações
