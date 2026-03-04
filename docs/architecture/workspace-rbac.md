# Workspace & RBAC Module

This module implements multi-tenant isolation and role-based access control (RBAC) for ContractAI Review.

## Components

### Controllers

- **`WorkspaceController`**: CRUD for workspaces, members
- **`WorkspaceSettingsController`**: Unified workspace settings
  - **GET** `/api/workspaces/:workspaceId/settings` — Returns `{ retention, general, documentProcessing }`
  - **PUT** `/api/workspaces/:workspaceId/settings` — Partial update (retention, documentProcessing)
  - Requires OWNER or ADMIN
- **`WorkspaceParsersController`**: Lists available parsers
  - **GET** `/api/workspaces/:workspaceId/document-parsers` — Returns `ParserInfo[]` (id, name, requiresApiKey, hasApiKey)
  - Requires VIEWER, MEMBER, ADMIN or OWNER

### Services

- **`WorkspaceService`**: Manages membership, role verification, hierarchy
- **`WorkspaceSettingsService`**: Manages settings (retention, documentProcessing)
  - **Retention:** file retention days, text/embeddings retention, fuzzy match threshold
  - **Document Processing:**
    - `chunkingStrategy`: paragraph | sentence | fixed_size
    - `defaultDocumentParser`: docling | pdfplumber | dpt2 | llamaparse | unstructured
    - `parserApiKeys`: object with masks (hasApiKey: boolean) per parser
  - Parser API keys (DPT-2, LlamaParse, Unstructured) are encrypted via `EncryptionService` and stored in `WorkspaceSettings.parserApiKeys`

### Guards

- **`WorkspaceGuard`**: Verifies user is a member of the workspace extracted from the route
- **`RolesGuard`**: Verifies user has the required role in the workspace

### Decorators

- **`@WorkspaceId()`**: Extracts `workspaceId` from route params
- **`@CurrentUser()`**: Extracts current user from request (set by `JwtAuthGuard`)
- **`@Roles(...roles)`**: Specifies roles required to access the endpoint

## Usage in Controllers

```typescript
import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { WorkspaceGuard, RolesGuard } from './guards';
import { Roles } from './decorators/roles.decorator';
import { WorkspaceRole } from '../entities/workspace-member.entity';
import { WorkspaceId, CurrentUser } from './decorators';

@Controller('workspaces/:workspaceId/documents')
@UseGuards(JwtAuthGuard, WorkspaceGuard) // WorkspaceGuard verifies membership
export class DocumentController {
  @Get()
  async listDocuments(@WorkspaceId() workspaceId: string) {
    // workspaceId already validated by guard
    // All queries must filter by workspaceId
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(WorkspaceRole.MEMBER, WorkspaceRole.ADMIN, WorkspaceRole.OWNER)
  async createDocument(
    @WorkspaceId() workspaceId: string,
    @CurrentUser() user: { id: string },
  ) {
    // Only MEMBER, ADMIN or OWNER can create documents
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(WorkspaceRole.ADMIN, WorkspaceRole.OWNER)
  async deleteDocument(@WorkspaceId() workspaceId: string) {
    // Only ADMIN or OWNER can delete
  }
}
```

## Role Hierarchy

1. **OWNER**: Full access (future billing, delete workspace, retention settings)
2. **ADMIN**: Manage members, see all, delete docs
3. **MEMBER**: Upload, chat, redline, download own + shared docs
4. **VIEWER**: View/download only (no redline)

## Filtering by WorkspaceId

**IMPORTANT**: All resource queries must filter by `workspaceId`:

```typescript
// CORRECT
const documents = await this.documentRepository.find({
  where: { workspaceId, status: DocumentStatus.AVAILABLE },
});

// WRONG - no workspace filter
const documents = await this.documentRepository.find({
  where: { status: DocumentStatus.AVAILABLE },
});
```

Use the `addWorkspaceFilter` helper for complex queries:

```typescript
import { addWorkspaceFilter } from '../workspace/helpers/query-builder.helper';

const qb = this.documentRepository.createQueryBuilder('document');
addWorkspaceFilter(qb, workspaceId, 'document');
return qb.getMany();
```

## Guard Order

The order of guards matters:

1. `JwtAuthGuard` — Authenticates user
2. `WorkspaceGuard` — Verifies workspace membership
3. `RolesGuard` — Verifies specific role (if needed)

```typescript
@UseGuards(JwtAuthGuard, WorkspaceGuard, RolesGuard)
@Roles(WorkspaceRole.ADMIN)
```

## Location

- **Implementation:** `apps/api/src/workspace/`
- **README:** `apps/api/src/workspace/README.md` (links here)
