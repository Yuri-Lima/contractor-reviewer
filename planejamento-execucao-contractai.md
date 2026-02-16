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

- [x] Criar aplicação NestJS em `apps/api`.
- [x] Configurar TypeORM com Postgres; habilitar extensão pgvector no banco (migration ou script).
- [x] Integrar suporte a tipo `vector` (typeorm-pgvector ou coluna raw).
- [x] Definir entities: User, Workspace, WorkspaceMember, Document, DocumentFile, Chunk, Embedding, LegalSource, DocumentJob, AuditLog, WorkspaceSettings (retention/no-logs), etc., com `workspaceId` onde aplicável.
- [x] Gerar e rodar migrações TypeORM iniciais.
- [x] Configurar módulo de autenticação (JWT ou sessão) e guard de autenticação.

---

## Fase 3 — Multi-tenant e RBAC

- [x] Guard/middleware que resolve workspace a partir da rota e verifica membership.
- [x] Implementar RBAC (OWNER, ADMIN, MEMBER, VIEWER) e aplicar em todos os endpoints por recurso.
- [x] Garantir que todas as queries de recursos filtrem por `workspaceId` e role.

---

## Fase 4 — Upload e pipeline em fila

- [x] Módulo de storage (interface S3/R2; implementação local opcional para dev).
- [x] Validações de upload: tamanho (ex.: 25MB), mime sniffing, extensões permitidas (pdf, docx, txt, png, jpg).
- [x] Integrar BullMQ + Redis no NestJS; criar filas para OCR, parsing, chunking+embeddings.
- [x] Entity e atualização de DocumentJob (status, progress, attempts, lastError).
- [x] Worker process: jobs de OCR (Tesseract), parsing (pdf.js, etc.), chunking e geração de embeddings; atualizar DocumentJob e marcar arquivo como "available" após sucesso.
- [x] Interface `scanFile(file)` noop (flag para futuro ClamAV).
- [x] Quarentena: recurso só disponível após validação e processamento.

---

## Fase 5 — RAG e citações

- [x] Contract RAG: persistir chunks com embeddings (pgvector); implementar retrieval top-k por documento/workspace.
- [x] Legal RAG: modelo LegalSource com metadados (country, jurisdiction, source_type, language, url); chunks/embeddings para fontes legais.
- [x] Integração OpenAI (Responses API ou equivalente): receber pergunta, buscar chunks (contrato + legal), montar contexto, gerar resposta com citações.
- [x] Formato de resposta: answerText, confidence (high/medium/low), citations[] (contrato e legal), notFound quando aplicável.
- [x] Jurisdiction resolver: heurística + patterns no documento; persistir resolvedJurisdiction no Document (explicit|inferred|unknown); perguntar ao usuário se incerto.

---

## Fase 6 — Endpoints REST (mínimo)

- [x] Workspaces: POST /api/workspaces, POST /api/workspaces/:id/members.
- [x] Documents: POST/GET/DELETE conforme plano; upload de arquivos em POST .../documents/:docId/files.
- [x] Chat: POST /api/workspaces/:id/documents/:docId/chat.
- [x] Redline: POST /api/workspaces/:id/documents/:docId/redline (playbook param) - placeholder implementado (lógica completa em Fase 10).
- [x] Privacy: GET .../privacy/export (DSAR-lite), POST .../privacy/no-logs (toggle setting), DELETE /api/account (hard delete usuário).
- [x] Audit: GET /api/workspaces/:id/audit (filtros por ação, usuário, data).
- [x] Rate limits e token budgets por usuário/workspace; resposta clara em caso de bloqueio (guard implementado, aplicar nos endpoints conforme necessário).

---

## Fase 7 — Retention, purge e hard delete

- [x] Configuração de retention por workspace (file retention, text/embeddings retention, overrides dentro de limites).
- [x] Página Workspace Settings com abas: General, Retention, Document Processing (chunking strategy).
- [x] Scheduled job diário: purge de arquivos expirados (hard delete no storage), textos/chunks/embeddings expirados, mensagens/versões conforme política.
- [x] Endpoints de hard delete idempotentes; registrar evento de delete no audit log.

---

## Fase 8 — Privacy e audit

- [x] DSAR-lite: export JSON/ZIP (chat messages, versions metadata, prompts redline conforme no-logs).
- [x] No-logs option: toggle por workspace; comportamento configurável (não persistir conteúdo doc e/ou chat/versões); purge acelerado quando aplicável.
- [x] AuditLog: registrar open/view, download, chat_query, redline_generate, delete, export_privacy (workspaceId, actorUserId, action, targetType, targetId, ip, userAgent, metadata segura).
- [x] Garantir que logs/console nunca persistam conteúdo de contrato, chunks ou mensagens em plaintext.
- [x] **Testado:** Script `test-fase8.sh` valida todas as funcionalidades. Ver `TESTE-FASE-8.md` para guia completo.

---

## Fase 9 — Frontend Angular + Capacitor

- [x] Criar app Angular em `apps/web`; configurar Capacitor para web + iOS/Android.
- [x] UI: workspace switcher, listagem de documentos, upload.
- [x] Viewer de contrato (pdf.js) — **Implementado:** PDF viewer component com suporte a visualização de arquivos.
- [x] Chat com exibição de citações e confidence.
- [x] Versões e redline: side-by-side diff, accept/reject por bloco, gerar nova versão (vN+1) — **Implementado:** Versions component criado, redline component com template HTML completo, diff service no backend.
- [x] Privacy panel: export DSAR-lite, toggle no-logs, explicar o que é armazenado e por quanto tempo.
- [x] Tela de audit log com filtros (ação, usuário, data).
- [x] Exibir progresso de DocumentJob no documento (OCR/embeddings) — **Implementado:** Progress bar com polling agressivo, localStorage cache, atualização em tempo real de jobs (pending/processing/completed/failed).
- [x] Mobile development setup: Capacitor config, scripts de setup, documentação (MOBILE-DEV.md, QUICK-START-MOBILE.md).
- [x] UI/UX improvements: Header com menu dropdown de usuário, templates separados para login/register, guest guard.
- [x] Document content component: Visualização de conteúdo do documento com seleção de texto.

---

## Fase 10 — Redline playbooks e diff

- [x] Implementar playbooks: Balanced, Conservative, Client-friendly (backend + parâmetro no endpoint) — **Implementado:** Redline service com suporte a playbooks, redline controller atualizado.
- [x] Persistir versões e histórico; diff entre versões — **Implementado:** Version service aprimorado, diff service criado, migrations para campos de redline.
- [x] Aceitar/rejeitar granular e gerar nova versão — **Implementado:** Redline component com UI completa, versões component para visualização e gerenciamento.
- [x] Backend: Redline service completo com lógica de geração de mudanças, diff service para comparação de versões.
- [x] Frontend: Redline component com template HTML, integração com API, UI para aceitar/rejeitar mudanças.

---

## Fase 11 — Dados de exemplo e fechamento

- [ ] Inserir exemplos de Legal Sources (pelo menos 1 país EU + 1 nacional); indexar embeddings.
- [x] Revisar console/loggers para "no plaintext content logging" — **Implementado:** Workers atualizados com logging seguro, apenas metadados são logados.
- [x] README final na raiz do monorepo — **Parcialmente implementado:** README atualizado, documentação mobile adicionada, scripts de setup criados.
- [x] Testar fluxo completo: workspace, upload, chat com citações, redline com playbook, versões, export privacidade, purge — **Em progresso:** Componentes principais implementados, testes end-to-end pendentes.

---

## Fase 12 — Melhorias e refinamentos (Nova)

### Backend
- [x] Worker improvements: Progress tracking aprimorado com updatedAt explícito, logging detalhado de progresso.
- [x] Queue module: Configurações melhoradas, retry logic aprimorada.
- [x] Migrations: Novos campos para redline (1700000002000-AddRedlineFields.ts), fuzzy match threshold (1700000003000-AddFuzzyMatchThreshold.ts).
- [x] RAG service: Melhorias na geração de embeddings e retrieval.

### Frontend
- [x] Progress bar fix: Correção de race conditions, polling agressivo, localStorage cache, signal updates corretos.
- [x] Header menu: Menu dropdown de usuário implementado (desktop), logout button mobile mantido.
- [x] Auth improvements: Templates separados (login.html, register.html), guest guard implementado.
- [x] i18n: Traduções atualizadas em todos os idiomas (en, es, de, pt-BR).
- [x] TypeScript best practices: Regra adicionada (.cursor/rules/typescript-best-practices.mdc).

### Mobile
- [x] Capacitor configuration: Config atualizado para iOS/Android.
- [x] Mobile scripts: install-prerequisites.sh, setup-mobile.sh, mobile-dev.sh criados.
- [x] Mobile documentation: MOBILE-DEV.md e QUICK-START-MOBILE.md criados.

---

## Notas por fase

| Fase | Notas |
| ---- | ----- |
| 0 | Atualizar .cursor/rules/plano-1.mdc antes de codar. |
| 1 | Raiz: apenas workspace e infra; apps vazios ou stubs. |
| 2 | API sobe em apps/api; worker pode ser mesmo processo ou script separado. |
| 3 | **Testável:** Endpoints básicos de workspace implementados. Ver TESTING.md para guia completo. |
| 4 | **Testável:** Upload de documentos funcional. Storage local/S3, validações, BullMQ integrado. Worker: `pnpm start:worker`. |
| 3-8 | Backend completo antes de integrar frontend. Fase 8 testada e validada. |
| 9 | Apontar apps/web para API (env). |
| 10-11 | Refinar redline e validar E2E. |

## Testes

Após Fase 3, os seguintes endpoints estão prontos para teste:
- ✅ `POST /api/auth/register` - Registrar usuário
- ✅ `POST /api/auth/login` - Login e obter token JWT
- ✅ `POST /api/workspaces` - Criar workspace (criador vira OWNER)
- ✅ `GET /api/workspaces/:id` - Buscar workspace (WorkspaceGuard)
- ✅ `POST /api/workspaces/:id/members` - Adicionar membro (RBAC: OWNER/ADMIN)

**Guias de testes por fase:**
- Fase 3-6: Ver `TESTING.md` na raiz do projeto.
- Fase 5: Ver `TESTE-FASE-5.md` e script `test-rag.sh`.
- Fase 6: Ver `FASE-6-IMPLEMENTACAO.md` e script `test-fase6.sh`.
- Fase 7: Ver `TESTE-FASE-7.md` e script `test-fase7.sh`.
- Fase 8: Ver `TESTE-FASE-8.md` e script `test-fase8.sh`.
- Fase 9-10: Componentes frontend implementados, testes manuais recomendados via UI.
- Fase 12: Progress bar fix testado, menu dropdown funcional, mobile setup documentado.

---

## Status Atual do Projeto (Última Atualização: 2025)

### ✅ Completado
- **Backend:** API REST completa, workers BullMQ, RAG com citações, redline service, version service, diff service
- **Frontend:** UI completa, progress tracking, versions component, redline component, mobile setup
- **Infraestrutura:** Docker compose, TypeORM migrations, queue system
- **Segurança:** Multi-tenant RBAC, audit logs, privacy controls, retention policies

### 🔄 Em Progresso
- Testes end-to-end completos
- Legal Sources de exemplo
- Refinamentos de UI/UX

### 📋 Próximos Passos
1. Adicionar Legal Sources de exemplo (EU + nacional)
2. Testes end-to-end completos do fluxo
3. Otimizações de performance
4. Documentação final de deploy
