# Fase 7 — Retention, Purge e Hard Delete — Implementação

Este documento descreve a implementação completa da Fase 7.

## Resumo

A Fase 7 implementa políticas de retenção de dados, purge automático de dados expirados e hard delete idempotente para documentos e contas.

## Componentes Implementados

### 1. RetentionService (`apps/api/src/retention/retention.service.ts`)

Gerencia configurações de retenção por workspace:

- **Limites configuráveis:**
  - File retention: 1-365 dias (padrão: 30)
  - Text/embeddings retention: 1-730 dias (padrão: 90)
  - Overrides por tipo de documento (via `retentionOverrides`)

- **Métodos principais:**
  - `getRetentionConfig(workspaceId)`: Obtém ou cria configuração padrão
  - `updateRetentionConfig(workspaceId, config)`: Atualiza configuração (com validação de limites)
  - `calculateFileExpirationDate(workspaceId, createdAt)`: Calcula data de expiração para arquivos
  - `calculateTextExpirationDate(workspaceId, createdAt)`: Calcula data de expiração para texto/embeddings
  - `isFileExpired(workspaceId, createdAt)`: Verifica se arquivo está expirado
  - `isTextExpired(workspaceId, createdAt)`: Verifica se texto/embeddings está expirado

### 2. PurgeService (`apps/api/src/retention/purge.service.ts`)

Executa purge de dados expirados:

- **Métodos:**
  - `purgeExpiredFiles()`: Remove arquivos expirados (hard delete no storage + database)
  - `purgeExpiredTextAndEmbeddings()`: Remove chunks/embeddings expirados
  - `runFullPurge()`: Executa purge completo (arquivos + texto/embeddings)

- **Comportamento:**
  - Hard delete no storage antes de deletar do banco
  - Logs detalhados de operações
  - Tratamento de erros (continua mesmo se algum arquivo falhar)

### 3. PurgeScheduler (`apps/api/src/retention/purge.scheduler.ts`)

Scheduled job usando `@nestjs/schedule`:

- **Agendamento:**
  - Executa diariamente às 2:00 AM (`CronExpression.EVERY_DAY_AT_2AM`)
  - Chama `PurgeService.runFullPurge()`
  - Logs de início e conclusão

### 4. RetentionController (`apps/api/src/retention/retention.controller.ts`)

Endpoints REST para gerenciar retention:

- **GET `/api/workspaces/:workspaceId/retention`**
  - Obtém configuração de retention do workspace
  - RBAC: OWNER, ADMIN

- **PUT `/api/workspaces/:workspaceId/retention`**
  - Atualiza configuração de retention
  - Valida limites antes de salvar
  - RBAC: OWNER, ADMIN

### 4b. WorkspaceSettingsController (`apps/api/src/workspace/workspace-settings.controller.ts`)

Endpoint unificado para configurações do workspace (inclui retention e document processing):

- **GET `/api/workspaces/:workspaceId/settings`**
  - Retorna `{ retention, general, documentProcessing: { chunkingStrategy } }`
  - RBAC: OWNER, ADMIN

- **PUT `/api/workspaces/:id/settings`**
  - Atualiza parcialmente (retention e/ou documentProcessing)
  - Chunking strategy: paragraph, sentence, fixed_size (semantic e agentic planejados para versões futuras)
  - RBAC: OWNER, ADMIN

A UI de Workspace Settings usa este endpoint e exibe abas: General, Retention, Document Processing (chunking).

### 5. Hard Delete Melhorado

#### DocumentsService.delete()

- **Idempotente:** Retorna `false` se documento não existe (já deletado)
- **Hard delete completo:**
  - Deleta arquivos do storage
  - Deleta chunks (embeddings)
  - Deleta documento do banco (CASCADE remove files e jobs)
- **Retorna:** `true` se deletado, `false` se não existia

#### AuthService.deleteAccount()

- **Idempotente:** Retorna `false` se usuário não existe
- **Validações:**
  - Não permite delete se usuário é único OWNER de qualquer workspace
  - Nesse caso, marca como inativo (soft delete) e lança exceção
- **Hard delete:**
  - Remove de todos os workspace memberships
  - Deleta usuário do banco (CASCADE remove memberships)
- **Retorna:** `true` se deletado, `false` se não existia

#### DocumentsController.deleteDocument()

- **Audit log:** Registra ação de delete apenas se documento existia
- **Idempotente:** Não lança erro se documento já foi deletado

## Módulos e Dependências

### RetentionModule

- **Imports:**
  - `TypeOrmModule.forFeature([WorkspaceSettings, DocumentFile, Document, Chunk])`
  - `ScheduleModule.forRoot()` - Habilita scheduled jobs
  - `StorageModule` - Para deletar arquivos
  - `WorkspaceModule` - Para WorkspaceGuard

- **Providers:**
  - `RetentionService`
  - `PurgeService`
  - `PurgeScheduler`

- **Controllers:**
  - `RetentionController`

- **Exports:**
  - `RetentionService` - Para uso em outros módulos
  - `PurgeService` - Para execução manual de purge

### Dependências Adicionadas

- `@nestjs/schedule` - Para scheduled jobs

## Endpoints REST

### Retention

- **GET `/api/workspaces/:workspaceId/retention`**
  ```json
  {
    "defaultFileRetentionDays": 30,
    "defaultTextEmbeddingsRetentionDays": 90,
    "retentionOverrides": {}
  }
  ```

- **PUT `/api/workspaces/:workspaceId/retention`**
  ```json
  {
    "defaultFileRetentionDays": 60,
    "defaultTextEmbeddingsRetentionDays": 180,
    "retentionOverrides": {
      "file": 45,
      "text": 120
    }
  }
  ```

### Hard Delete (já existentes, melhorados)

- **DELETE `/api/workspaces/:workspaceId/documents/:documentId`**
  - Agora idempotente (não lança erro se já deletado)
  - Registra no audit log apenas se deletado

- **DELETE `/api/account`**
  - Agora idempotente
  - Valida ownership de workspaces antes de deletar
  - Hard delete completo

## Configuração

### WorkspaceSettings Entity

A entidade `WorkspaceSettings` já existia com os campos necessários:

- `defaultFileRetentionDays` (padrão: 30)
- `defaultTextEmbeddingsRetentionDays` (padrão: 90)
- `retentionOverrides` (JSONB para overrides por tipo)

## Scheduled Job

O purge job roda automaticamente todos os dias às 2:00 AM.

Para executar manualmente (útil para testes):

```typescript
// Em um controller ou service
constructor(private purgeService: PurgeService) {}

async manualPurge() {
  return await this.purgeService.runFullPurge();
}
```

## Validações e Limites

### Limites de Retention

- **File retention:** 1-365 dias
- **Text/embeddings retention:** 1-730 dias (2 anos)

### Validações de Delete

- **Document delete:** Idempotente (não falha se já deletado)
- **Account delete:** 
  - Não permite se usuário é único OWNER de workspace
  - Remove de memberships antes de deletar
  - Idempotente

## Audit Logging

- **Document delete:** Registrado no audit log com `hardDelete: true` no metadata
- **Account delete:** Não registrado (ação global, não específica de workspace)

## Próximos Passos

1. ✅ Retention configurado por workspace
2. ✅ Scheduled purge job implementado
3. ✅ Hard delete idempotente implementado
4. ⏳ Testes end-to-end do purge job
5. ⏳ UI para configurar retention (Fase 9)
6. ⏳ Monitoramento de purge jobs (logs, métricas)

## Notas de Implementação

- O purge job usa `@nestjs/schedule` que é mais simples que BullMQ para jobs agendados
- Hard delete de documentos remove chunks explicitamente (embeddings estão na tabela chunks)
- Account delete verifica ownership antes de deletar para evitar workspaces órfãos
- Todos os deletes são idempotentes para evitar erros em retries
