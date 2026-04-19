# Prompt Generator — LLM-Assisted Document Prompt Generation

Canonical reference for the LLM-assisted prompt generation feature in ContractAI Review.

## Overview

During document creation, users can either (1) select a **prompt category** (e.g., General, Real Estate, NDA) to apply pre-built prompts for all 7 document keys, or (2) **generate** document-specific AI instructions from the document's title and description via the LLM. An optional temporary .md context can be provided (paste or file upload) to give the LLM additional context. Generated content targets the `chat.system` document-level prompt. Document prompts are combined with workspace prompts and the global system prompt (`global.system`) when the AI analyzes the document.

**Flow:** Create form → **Prompt category** (optional, searchable dropdown) → When a category is selected, a collapsible preview tab shows the 7 prompts that will be applied → Generate AI prompt (optional) → Review/Edit → Approve (create + save) | Reject (create without) | Re-create (regenerate).

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
- `useCase` can be used for future variants
- No service logic changes needed for new targets

## Temporary Context (.md)

- **Frontend:** Collapsible "Add context (temporary)" with file picker and textarea
- **50KB limit:** When exceeded, user sees a toast notification and the Generate button is disabled until content is within limit
- **Never persisted:** Context is sent only to the generate-prompt API; never stored in DB or logs
- **Discarded:** When the form is closed or dialog dismissed, context is cleared

## Create Document with Prompts

When creating a document:

```
POST /workspaces/:workspaceId/documents
Body: { title, description?, documentChatSystemPrompt?, promptCategoryId? }
```

| Field | Description |
|-------|-------------|
| `title` | Required. Document title (1–500 chars). |
| `description` | Optional. Document description (max 2000 chars). |
| `documentChatSystemPrompt` | Optional (legacy). If provided, upserts only the `chat.system` document prompt. Use when the user approves an LLM-generated prompt. |
| `promptCategoryId` | Optional. One of `PROMPT_CATEGORY_IDS` (e.g., `general`, `legal-law`, `real-estate`, `nda`). If provided, upserts all 7 document prompts from the selected category. Ignored if `documentChatSystemPrompt` is provided. |

**Behavior:**

- If `documentChatSystemPrompt` is provided and non-empty: create document and upsert `chat.system` only. On upsert failure, the document is still returned; the prompt can be added later in Settings.
- If `promptCategoryId` is provided (and no `documentChatSystemPrompt`): create document and upsert all 7 document prompts from the category. Mutually exclusive with `documentChatSystemPrompt`.

## Security

- Auth: JWT + workspace + role (MEMBER+)
- Rate limit: 15 req/min
- No sensitive content in logs (contextMarkdown, generated prompt)
- Input validation and size limits via class-validator DTO

## Prompt Categories

Pre-built prompt sets by contract domain. Defined in `packages/shared/src/constants/prompt-categories.ts`. Examples:

| Category ID | Description |
|-------------|-------------|
| `general` | Base legal assistant defaults |
| `legal-law` | General legal practice, contract law |
| `real-estate` | Real estate, leases, property rights |
| `employment` | Employment contracts, non-compete |
| `nda` | NDAs, confidentiality agreements |
| `commercial` | Commercial contracts, vendor agreements |
| `it-software` | Software licenses, SaaS, SLAs |
| `insurance`, `banking`, `construction`, `healthcare`, `ma-corporate`, etc. | Domain-specific variants |

Each category provides prompts for the document keys: `chat.system`, `chat.user`. Use `promptCategoryId` in the create-document request to apply a full set.

**UI: Prompt preview tab** — When the user selects a prompt category from the dropdown, a collapsible accordion appears below showing a read-only preview of all 7 prompts. This lets users see what will be applied before creating the document. When "None" is selected, the preview is hidden.

## File Map

| Component | File |
|-----------|------|
| PromptGeneratorService | `apps/api/src/prompts/prompt-generator.service.ts` |
| Generate-prompt route | `apps/api/src/documents/documents.controller.ts` |
| Create-document DTO | `apps/api/src/documents/dto/create-document.dto.ts` |
| DTO (generate-prompt) | `apps/api/src/documents/dto/generate-prompt-request.dto.ts` |
| Prompt categories | `packages/shared/src/constants/prompt-categories.ts` |
| Shared types | `packages/shared/src/types/prompts.ts`, `packages/shared/src/types/documents.ts` |
| Frontend UI | `apps/web/src/app/documents/documents-list/documents-list.component.ts` |
