**English** · [Português (Brasil)](README.pt-BR.md)

# ContractAI Review

> **Evidence-based legal assistant** — analyze and review contracts with answers grounded in citations from the source documents.

ContractAI Review is a multi-tenant platform for analyzing and reviewing legal contracts. It uses a **Retrieval-Augmented Generation (RAG)** pipeline so every answer is grounded in evidence extracted from the contracts themselves — not a chatbot guessing.

> **Status:** Portfolio / MVP+ project, built to demonstrate production-grade architecture. Not deployed with real clients.

## What it does

- **Upload contracts** in multiple formats (PDF, DOC, DOCX, TXT, images).
- **Ask questions** and get answers with **precise citations** (file, page, paragraph) and confidence levels.
- **Collaborate** in multi-tenant workspaces with role-based access control (OWNER / ADMIN / MEMBER / VIEWER).
- Returns **"NOT FOUND"** when there isn't enough evidence, instead of hallucinating.

## Key capabilities

- **RAG chat with citations** — semantic search over contract chunks plus official legal sources; answers in the user's language.
- **Pluggable document parsers** — Docling (self-hosted, OCR) and PDFPlumber, plus cloud parsers (LandingAI DPT-2, LlamaParse, Unstructured) with per-workspace, AES-256-GCM-encrypted API keys.
- **Async processing** — parsing, chunking and embedding via BullMQ + Redis queues, with real-time progress over WebSocket.
- **Semantic response cache** (Redis, 24h TTL) to cut cost and latency on repeated questions.
- **Privacy & compliance** — per-workspace privacy panel, DSAR-lite export (JSON/ZIP), configurable retention with automatic purge, and a full audit trail.
- **Rate limiting & token budgets** per user and per workspace.
- **Multilingual** — EN, ES, PT-BR, DE, with automatic contract/jurisdiction detection.

## Architecture

Nx monorepo:

```
apps/
  api/         NestJS REST API + BullMQ workers
  web/         Angular SPA + Capacitor (web / iOS / Android)
packages/
  shared/      Shared types, enums, interfaces
services/
  docling/     Python (FastAPI) parser — PDF, DOCX, images -> markdown
  pdfplumber/  Python (FastAPI) parser — PDF -> markdown
```

**Pipeline:** upload -> validate -> parse -> chunk -> embed (OpenAI `text-embedding-3-small`, 1536-dim, stored in pgvector) -> retrieve top-k similar chunks -> answer with citations.

## Tech stack

| Layer | Tech |
|-------|------|
| Backend | NestJS, TypeORM, PostgreSQL + pgvector, BullMQ, Redis |
| Frontend | Angular, Capacitor, PrimeNG, Tailwind, RxJS |
| AI / ML | OpenAI (embeddings + chat), DB-backed configurable prompts |
| Parsers | Docling, PDFPlumber (self-hosted); DPT-2, LlamaParse, Unstructured (cloud) |
| Infra | Nx, Docker Compose, S3/R2-compatible storage |

## Quick start

```bash
pnpm install
cp .env.example .env          # set OPENAI_API_KEY, etc.
docker-compose up -d          # Postgres, Redis, Docling, PDFPlumber
pnpm migration:run
pnpm start:api                # API
pnpm start:worker             # background worker
pnpm dev:web                  # Angular web app
```

Full setup guide: [docs/guides/setup.md](docs/guides/setup.md) · Architecture docs: [docs/architecture/](docs/architecture/).

---

*Documentação completa em português: [README.pt-BR.md](README.pt-BR.md).*
