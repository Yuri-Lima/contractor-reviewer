# Prompt Generator — LLM-Assisted Document Prompt Generation

Canonical reference for the LLM-assisted prompt generation feature in ContractAI Review.

## Overview

During document creation, users can generate document-specific AI instructions from the document's title and description. An optional temporary .md context can be provided (paste or file upload) to give the LLM additional context. The generated content targets the `chat.system` document-level prompt and is combined with workspace/global prompts when the AI analyzes the document.

**Flow:** Create form → Generate AI prompt → Review/Edit → Approve (create + save) | Reject (create without) | Re-create (regenerate).

## API

### Endpoint

```
POST /workspaces/:workspaceId/documents/generate-prompt
```

### Request

| Field | Type | Required | Limits | Description |
|-------|------|----------|--------|-------------|
| `title` | string | yes | 1–500 chars | Document title |
| `description` | string | yes | 1–2000 chars | Document description |
| `contextMarkdown` | string | no | max 50KB | Temporary .md content for LLM context; **never persisted** |

### Response

```json
{
  "generatedPrompt": "string"
}
```

### Validation

- `title`: required, 1–500 characters
- `description`: required, 1–2000 characters
- `contextMarkdown`: optional, max 51200 bytes (~50KB) to avoid token overflow and abuse

### Guards

- `JwtAuthGuard`, `WorkspaceGuard`, `RolesGuard` (MEMBER+)
- `RateLimitGuard` with 15 requests/minute (same as chat)
- Abort signal support for client cancellation

### Audit

On success, an audit log is created with `AuditAction.PROMPT_GENERATE`, `TargetType.WORKSPACE`, metadata `{ target: 'document' }`. No content is logged.

## PromptGeneratorService

**File:** `apps/api/src/prompts/prompt-generator.service.ts`

Generic service that accepts a `target` (and optional `useCase`) for extensibility:

```typescript
type PromptGeneratorTarget = 'document' | 'workspace';

interface GeneratePromptParams {
  target: PromptGeneratorTarget;
  title: string;
  description: string;
  contextMarkdown?: string;
  useCase?: string;
}

generate(params: GeneratePromptParams, options?: { signal?: AbortSignal }): Promise<string>
```

### Target-Based Meta-Prompts

Each `target` maps to a base meta-prompt:

- **document**: Instructions for document-specific chat.system (legal assistant, document type, jurisdiction hints)
- **workspace**: (future) Instructions for workspace-level prompts

### Extensibility

- Adding `target: 'workspace'` requires only a new meta-prompt entry
- `useCase` (e.g. `'redline'`) can be used for future variants
- No service logic changes needed for new targets

## Temporary Context (.md)

- **Frontend:** Collapsible "Add context (temporary)" with file picker and textarea
- **50KB limit:** When exceeded, user sees a toast notification and the Generate button is disabled until content is within limit
- **Never persisted:** Context is sent only to the generate-prompt API; never stored in DB or logs
- **Discarded:** When the form is closed or dialog dismissed, context is cleared

## Create Document with Prompt

When the user approves the generated prompt:

```
POST /workspaces/:workspaceId/documents
Body: { title, description?, documentChatSystemPrompt? }
```

If `documentChatSystemPrompt` is provided and non-empty, the API creates the document and upserts the `chat.system` prompt for that document. On upsert failure, the document is still returned; the prompt can be added later in Settings.

## Security

- Auth: JWT + workspace + role (MEMBER+)
- Rate limit: 15 req/min
- No sensitive content in logs (contextMarkdown, generated prompt)
- Input validation and size limits via class-validator DTO

## File Map

| Component | File |
|-----------|------|
| PromptGeneratorService | `apps/api/src/prompts/prompt-generator.service.ts` |
| Generate-prompt route | `apps/api/src/documents/documents.controller.ts` |
| DTO | `apps/api/src/documents/dto/generate-prompt-request.dto.ts` |
| Shared types | `packages/shared/src/types/prompts.ts` |
| Frontend UI | `apps/web/src/app/documents/documents-list/documents-list.component.ts` |
