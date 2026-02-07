# Fase 8 — Privacy e Audit — Implementação Completa

Este documento descreve a implementação completa da Fase 8.

## Resumo

A Fase 8 implementa funcionalidades avançadas de privacidade (DSAR-lite export completo, no-logs configurável), purge acelerado para no-logs, e garante que todos os audit logs estão sendo registrados e que nenhum conteúdo sensível é logado em plaintext.

## Componentes Implementados

### 1. Entities Criadas

#### ChatMessage (`apps/api/src/entities/chat-message.entity.ts`)

Armazena histórico de chat respeitando no-logs:

- `question`: Pergunta do usuário (redacted se no-logs)
- `answerText`: Resposta da IA (null se no-logs)
- `citations`: Citações (null se no-logs)
- `confidence`: Nível de confiança
- `notFound`: Flag se resposta foi "NOT FOUND"
- `jurisdiction`: Jurisdição usada para legal RAG

#### DocumentVersion (`apps/api/src/entities/document-version.entity.ts`)

Armazena versões de documentos com redline:

- `versionNumber`: Número sequencial da versão
- `playbook`: Playbook usado (balanced, conservative, client-friendly)
- `changes`: Mudanças sugeridas (null se no-logs)
- `prompt`: Prompt usado para gerar redline (null se no-logs)
- `instructions`: Instruções customizadas (null se no-logs)

### 2. Services Criados

#### ChatMessageService (`apps/api/src/documents/chat-message.service.ts`)

Gerencia salvamento de mensagens de chat:

- `saveChatMessage()`: Salva mensagem respeitando no-logs config
- Redacta `question` para `[REDACTED]` se no-logs habilitado
- Define `answerText` e `citations` como `null` se `skipChatMessages` habilitado

#### VersionService (`apps/api/src/documents/version.service.ts`)

Gerencia versões de documentos:

- `createVersion()`: Cria nova versão respeitando no-logs config
- `getVersions()`: Lista versões de um documento
- Define `changes`, `prompt`, `instructions` como `null` se `skipVersions` habilitado

### 3. PrivacyService Melhorado

#### DSAR Export Completo

Agora inclui dados reais:

- **Chat Messages**: Todas as mensagens do usuário no workspace
  - Pode conter `[REDACTED]` se no-logs habilitado
  - `answerText` e `citations` podem ser `null` se no-logs habilitado

- **Versions**: Todas as versões criadas pelo usuário
  - `changes` e `prompt` podem ser `null` se no-logs habilitado

- **Redline Prompts**: Extraídos das versions (apenas se `prompt` não for null)

- **Audit Logs**: Já estava implementado

#### No-Logs Configurável

Configuração granular via `noLogsConfig`:

```typescript
{
  skipDocumentContent?: boolean;  // Não persistir texto/chunks após processamento
  skipChatMessages?: boolean;      // Não persistir chat questions/answers
  skipVersions?: boolean;          // Não persistir version changes/prompts
  acceleratedPurgeDays?: number;   // Purge após N dias (padrão: 1 dia)
}
```

**Comportamento:**
- Se `noLogsEnabled = true` e `skipChatMessages = true`: question vira `[REDACTED]`, answerText e citations são `null`
- Se `noLogsEnabled = true` e `skipVersions = true`: changes, prompt e instructions são `null`
- Purge acelerado remove dados após `acceleratedPurgeDays` (padrão: 1 dia)

### 4. PurgeService Melhorado

#### Purge Acelerado

Novo método `purgeExpiredChatAndVersions()`:

- Executa apenas para workspaces com `noLogsEnabled = true`
- Remove chat messages expiradas se `skipChatMessages = true`
- Remove versions expiradas se `skipVersions = true`
- Usa `acceleratedPurgeDays` para calcular cutoff date
- Integrado no `runFullPurge()` que roda diariamente

### 5. Audit Logs Completos

Todos os eventos estão sendo registrados:

- ✅ `open_view` - GET documento (DocumentsController)
- ✅ `download` - GET download arquivo (DocumentsController) - **NOVO**
- ✅ `upload` - POST upload arquivo (DocumentsController)
- ✅ `chat_query` - POST chat (ChatController)
- ✅ `redline_generate` - POST redline (RedlineController)
- ✅ `delete` - DELETE documento (DocumentsController)
- ✅ `export_privacy` - GET export (PrivacyController)

**Metadata segura apenas:**
- IDs, tamanhos, contagens, timestamps
- NUNCA conteúdo de contratos, chunks ou mensagens

### 6. Segurança de Logs

Todos os `console.log/error/warn` foram auditados:

- ✅ `chat.controller.ts`: Não loga question content
- ✅ `documents.service.ts`: Não loga storage keys ou conteúdo
- ✅ `rag.service.ts`: Não loga question ou answer text
- ✅ Logs apenas metadados (ids, tamanhos, erros genéricos)

### 7. Endpoint de Download

**NOVO:** `GET /api/workspaces/:workspaceId/documents/:documentId/files/:fileId/download`

- Retorna URL de download (presigned para S3, path para local)
- Registra no audit log com metadata segura
- RBAC: MEMBER, ADMIN, OWNER, VIEWER

## Migration

### `1700000001000-AddChatMessagesAndVersions.ts`

Cria tabelas:
- `chat_messages` com índices e foreign keys
- `document_versions` com índices e foreign keys
- Adiciona coluna `noLogsConfig` em `workspace_settings`

## Endpoints REST

### Privacy (Melhorados)

- **GET `/api/workspaces/:id/privacy/export`**
  - Agora inclui chat messages e versions reais
  - Respeita no-logs (mostra `[REDACTED]` ou `null` quando aplicável)

- **PUT `/api/workspaces/:id/privacy/no-logs`** (Melhorado)
  ```json
  {
    "enabled": true,
    "config": {
      "skipDocumentContent": false,
      "skipChatMessages": true,
      "skipVersions": true,
      "acceleratedPurgeDays": 1
    }
  }
  ```

### Download (Novo)

- **GET `/api/workspaces/:id/documents/:docId/files/:fileId/download`**
  - Retorna redirect para URL de download
  - Registra no audit log

## Comportamento No-Logs

### Quando `noLogsEnabled = true`:

1. **Chat Messages:**
   - Se `skipChatMessages = true`:
     - `question` → `[REDACTED]`
     - `answerText` → `null`
     - `citations` → `null`
   - Se `skipChatMessages = false`:
     - Dados são salvos normalmente

2. **Versions:**
   - Se `skipVersions = true`:
     - `changes` → `null`
     - `prompt` → `null`
     - `instructions` → `null`
   - Se `skipVersions = false`:
     - Dados são salvos normalmente

3. **Purge Acelerado:**
   - Remove chat messages e versions após `acceleratedPurgeDays` (padrão: 1 dia)
   - Executa automaticamente no purge job diário

## Segurança de Logs

### Regras Implementadas:

1. **Nunca logar:**
   - Conteúdo de contratos
   - Chunks completos
   - Perguntas do usuário
   - Respostas da IA
   - Storage keys com dados sensíveis

2. **Apenas logar:**
   - IDs (documentId, fileId, etc.)
   - Tamanhos (bytes)
   - Contagens (chunks, citations)
   - Timestamps
   - Status/erros genéricos

### Exemplos:

```typescript
// ❌ ERRADO (não fazer)
console.log('Question:', question);
console.log('Answer:', answerText);
console.log('Chunk text:', chunk.text);

// ✅ CORRETO
console.log('Chat error (documentId, workspaceId):', documentId, workspaceId, errorMessage);
console.log('Failed to delete file (id: ${file.id}):', errorMessage);
```

## Arquivos Criados

- `apps/api/src/entities/chat-message.entity.ts`
- `apps/api/src/entities/document-version.entity.ts`
- `apps/api/src/documents/chat-message.service.ts`
- `apps/api/src/documents/version.service.ts`
- `apps/api/src/migrations/1700000001000-AddChatMessagesAndVersions.ts`

## Arquivos Modificados

- `apps/api/src/entities/workspace-settings.entity.ts` - Adicionado `noLogsConfig`
- `apps/api/src/entities/document.entity.ts` - Adicionado relações para ChatMessage e DocumentVersion
- `apps/api/src/documents/chat.controller.ts` - Salva mensagens via ChatMessageService
- `apps/api/src/documents/redline.controller.ts` - Cria versions via VersionService
- `apps/api/src/documents/documents.controller.ts` - Adicionado endpoint de download
- `apps/api/src/documents/documents.service.ts` - Adicionado métodos `getFile()` e `getFileDownloadUrl()`
- `apps/api/src/documents/documents.module.ts` - Adicionado ChatMessageService e VersionService
- `apps/api/src/privacy/privacy.service.ts` - Export completo com chat messages e versions
- `apps/api/src/privacy/privacy.controller.ts` - No-logs com configuração granular
- `apps/api/src/privacy/privacy.module.ts` - Adicionado ChatMessage e DocumentVersion repositories
- `apps/api/src/retention/purge.service.ts` - Adicionado purge acelerado
- `apps/api/src/retention/retention.module.ts` - Adicionado ChatMessage e DocumentVersion repositories
- `apps/api/src/documents/documents.service.ts` - Corrigido console.error para não logar conteúdo
- `apps/api/src/documents/chat.controller.ts` - Corrigido console.error para não logar conteúdo
- `apps/api/src/rag/rag.service.ts` - Corrigido console.error para não logar conteúdo

## Próximos Passos

1. ✅ DSAR export completo implementado
2. ✅ No-logs configurável implementado
3. ✅ Purge acelerado implementado
4. ✅ Audit logs completos
5. ✅ Segurança de logs garantida
6. ⏳ Rodar migration para criar tabelas
7. ⏳ Testar export com dados reais
8. ⏳ Testar no-logs e purge acelerado
9. ⏳ UI para configurar no-logs (Fase 9)

## Notas de Implementação

- Chat messages são salvas automaticamente após cada pergunta no chat
- Versions são criadas automaticamente após cada redline gerado
- No-logs é retroativo: dados já salvos não são alterados, apenas novos dados respeitam a configuração
- Purge acelerado roda automaticamente no purge job diário
- Download endpoint retorna redirect (presigned URL para S3, path para local)
- Todos os console.logs foram auditados e corrigidos para não logar conteúdo sensível
