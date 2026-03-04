# @contractai-review/shared

Shared types, interfaces, enums, utilities, and constants for ContractAI Review (API and Web).

## Structure

- **`src/enums`** — Enums (DocumentStatus, WorkspaceRole, JobType, etc.)
- **`src/types`** — TypeScript interfaces (Document, CreateDocumentRequest, ChatResponse, etc.)
- **`src/utils`** — Utility functions (e.g., `mapI18nToMlLang`, `getViewerFormat`)
- **`src/constants`** — Constants (prompts, prompt-categories, upload limits, etc.)

## Import Paths

### Main entry point

```typescript
import { Document, CreateDocumentRequest } from '@contractai-review/shared';
import { DocumentStatus } from '@contractai-review/shared';
```

### Subpath imports (recommended for constants in web app)

When importing **constants** (e.g., `PROMPT_CATEGORIES`, `PROMPT_KEYS`, `PROMPT_LABEL_KEYS`, `getPromptCategoryById`) in the **web app**, use the `/constants` subpath:

```typescript
import {
  PROMPT_CATEGORIES,
  getPromptCategoryById,
  PROMPT_KEYS,
  PROMPT_LABEL_KEYS,
} from '@contractai-review/shared/constants';
```

**Reason:** The web app uses Vite, which pre-bundles dependencies. The main barrel (`@contractai-review/shared`) can fail to resolve nested re-exports (e.g., from constants) in the pre-bundled ESM output, leading to `does not provide an export named 'PROMPT_CATEGORIES'` errors. The subpath `@contractai-review/shared/constants` is mapped in `apps/web/tsconfig.json` to the source and bypasses this issue.

In the **API** (Node/NestJS), importing from the main entry point works fine.

## Build

```bash
pnpm nx run @contractai-review/shared:build
```

Builds CommonJS (`dist/`) and ESM (`dist/esm/`) outputs. The API uses CommonJS; the web app can use either depending on resolution.
