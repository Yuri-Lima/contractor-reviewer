# Planejamento de execução — ContractAI Review MVP+

**Projeto:** ContractAI Review MVP+ (assistente jurídico baseado em provas, multi-tenant RBAC, retention, privacy, audit, RAG citations, queues)

**Monorepo:** `apps/api` (NestJS API + workers) | `apps/web` (Angular + Capacitor)

**Stack:** NestJS, Angular, Capacitor, TypeORM, Postgres + pgvector, BullMQ + Redis, S3/R2, OpenAI

**Referência:** plano-1.mdc, stack NestJS/Angular/TypeORM

**Data:** 2025

---

## Fase 0 — Atualizar documento de regras

- [x] Substituir seção STACK no plano-1.mdc por NestJS, Angular, Capacitor, TypeORM, pgvector (sem Next.js/Prisma).
- [x] Na seção ARQUITETURA, explicitar backend NestJS (API + workers) e frontend Angular (SPA + Capacitor).
- [x] Em ENTREGÁVEIS: trocar "Prisma schema + migrações" por "TypeORM entities + migrações"; ajustar comandos (TypeORM, NestJS, Angular).
- [x] Adicionar subseção API: REST como principal; GraphQL opcional (backlog).
- [x] Ajustar comandos finais: remover `pnpm prisma migrate dev`; incluir comandos para migrations TypeORM, API NestJS, worker e app Angular.

---

## Fase 1 — Monorepo e infraestrutura local

- [x] Criar estrutura do monorepo: `apps/api`, `apps/web`, raiz com `pnpm-workspace.yaml` e `package.json` raiz.
- [x] Configurar pnpm workspace; definir workspaces em `pnpm-workspace.yaml` (apps/*, packages/* se usar).
- [x] Criar `docker-compose.yml` na raiz com Postgres (imagem com pgvector) e Redis.
- [x] Documentar variáveis de ambiente em `.env.example` (e por app se necessário) e README (DATABASE_URL, REDIS_URL, S3/R2, OPENAI_API_KEY, JWT_SECRET, etc.).
- [x] README raiz com instruções de setup local e comandos por app (api, web, worker).

---

## Fase 2 — Backend NestJS: base e banco

- [ ] Criar aplicação NestJS em `apps/api`.
- [ ] Configurar TypeORM com Postgres; habilitar extensão pgvector no banco (migration ou script).
- [ ] Integrar suporte a tipo `vector` (typeorm-pgvector ou coluna raw).
- [ ] Definir entities: User, Workspace, WorkspaceMember, Document, DocumentFile, Chunk, Embedding, LegalSource, DocumentJob, AuditLog, WorkspaceSettings (retention/no-logs), etc., com `workspaceId` onde aplicável.
- [ ] Gerar e rodar migrações TypeORM iniciais.
- [ ] Configurar módulo de autenticação (JWT ou sessão) e guard de autenticação.

---

## Fase 3 — Multi-tenant e RBAC

- [ ] Guard/middleware que resolve workspace a partir da rota e verifica membership.
- [ ] Implementar RBAC (OWNER, ADMIN, MEMBER, VIEWER) e aplicar em todos os endpoints por recurso.
- [ ] Garantir que todas as queries de recursos filtrem por `workspaceId` e role.

---

## Fase 4 — Upload e pipeline em fila

- [ ] Módulo de storage (interface S3/R2; implementação local opcional para dev).
- [ ] Validações de upload: tamanho (ex.: 25MB), mime sniffing, extensões permitidas (pdf, docx, txt, png, jpg).
- [ ] Integrar BullMQ + Redis no NestJS; criar filas para OCR, parsing, chunking+embeddings.
- [ ] Entity e atualização de DocumentJob (status, progress, attempts, lastError).
- [ ] Worker process: jobs de OCR (Tesseract), parsing (pdf.js, etc.), chunking e geração de embeddings; atualizar DocumentJob e marcar arquivo como "available" após sucesso.
- [ ] Interface `scanFile(file)` noop (flag para futuro ClamAV).
- [ ] Quarentena: recurso só disponível após validação e processamento.

---

## Fase 5 — RAG e citações

- [ ] Contract RAG: persistir chunks com embeddings (pgvector); implementar retrieval top-k por documento/workspace.
- [ ] Legal RAG: modelo LegalSource com metadados (country, jurisdiction, source_type, language, url); chunks/embeddings para fontes legais.
- [ ] Integração OpenAI (Responses API ou equivalente): receber pergunta, buscar chunks (contrato + legal), montar contexto, gerar resposta com citações.
- [ ] Formato de resposta: answerText, confidence (high/medium/low), citations[] (contrato e legal), notFound quando aplicável.
- [ ] Jurisdiction resolver: heurística + patterns no documento; persistir resolvedJurisdiction no Document (explicit|inferred|unknown); perguntar ao usuário se incerto.

---

## Fase 6 — Endpoints REST (mínimo)

- [ ] Workspaces: POST /api/workspaces, POST /api/workspaces/:id/members.
- [ ] Documents: POST/GET/DELETE conforme plano; upload de arquivos em POST .../documents/:docId/files.
- [ ] Chat: POST /api/workspaces/:id/documents/:docId/chat.
- [ ] Redline: POST /api/workspaces/:id/documents/:docId/redline (playbook param).
- [ ] Privacy: GET .../privacy/export, POST .../privacy/no-logs, DELETE /api/account.
- [ ] Audit: GET /api/workspaces/:id/audit (filtros por ação, usuário, data).
- [ ] Rate limits e token budgets por usuário/workspace; resposta clara em caso de bloqueio.

---

## Fase 7 — Retention, purge e hard delete

- [ ] Configuração de retention por workspace (file retention, text/embeddings retention, overrides dentro de limites).
- [ ] Scheduled job diário: purge de arquivos expirados (hard delete no storage), textos/chunks/embeddings expirados, mensagens/versões conforme política.
- [ ] Endpoints de hard delete idempotentes; registrar evento de delete no audit log.

---

## Fase 8 — Privacy e audit

- [ ] DSAR-lite: export JSON/ZIP (chat messages, versions metadata, prompts redline conforme no-logs).
- [ ] No-logs option: toggle por workspace; comportamento configurável (não persistir conteúdo doc e/ou chat/versões); purge acelerado quando aplicável.
- [ ] AuditLog: registrar open/view, download, chat_query, redline_generate, delete, export_privacy (workspaceId, actorUserId, action, targetType, targetId, ip, userAgent, metadata segura).
- [ ] Garantir que logs/console nunca persistam conteúdo de contrato, chunks ou mensagens em plaintext.

---

## Fase 9 — Frontend Angular + Capacitor

- [ ] Criar app Angular em `apps/web`; configurar Capacitor para web + iOS/Android.
- [ ] UI: workspace switcher, listagem de documentos, upload.
- [ ] Viewer de contrato (pdf.js ou equivalente).
- [ ] Chat com exibição de citações e confidence.
- [ ] Versões e redline: side-by-side diff, accept/reject por bloco, gerar nova versão (vN+1).
- [ ] Privacy panel: export DSAR-lite, toggle no-logs, explicar o que é armazenado e por quanto tempo.
- [ ] Tela de audit log com filtros (ação, usuário, data).
- [ ] Exibir progresso de DocumentJob no documento (OCR/embeddings).

---

## Fase 10 — Redline playbooks e diff

- [ ] Implementar playbooks: Balanced, Conservative, Client-friendly (backend + parâmetro no endpoint).
- [ ] Persistir versões e histórico; diff entre versões; aceitar/rejeitar granular e gerar nova versão.

---

## Fase 11 — Dados de exemplo e fechamento

- [ ] Inserir exemplos de Legal Sources (pelo menos 1 país EU + 1 nacional); indexar embeddings.
- [ ] Revisar console/loggers para "no plaintext content logging".
- [ ] README final na raiz do monorepo: `pnpm install`, migrations em `apps/api`, `pnpm dev` em `apps/web`, comandos para API e worker em `apps/api`; docker-compose para Postgres + Redis.
- [ ] Testar fluxo completo: workspace, upload, chat com citações, redline com playbook, versões, export privacidade, purge.

---

## Notas por fase

| Fase | Notas |
| ---- | ----- |
| 0 | Atualizar .cursor/rules/plano-1.mdc antes de codar. |
| 1 | Raiz: apenas workspace e infra; apps vazios ou stubs. |
| 2 | API sobe em apps/api; worker pode ser mesmo processo ou script separado. |
| 3-8 | Backend completo antes de integrar frontend. |
| 9 | Apontar apps/web para API (env). |
| 10-11 | Refinar redline e validar E2E. |
