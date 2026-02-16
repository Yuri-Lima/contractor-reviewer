# Workspace & RBAC Module

Este módulo implementa isolamento multi-tenant e controle de acesso baseado em roles (RBAC) para o ContractAI Review.

## Componentes

### Controllers

- **`WorkspaceController`**: CRUD de workspaces, membros
- **`WorkspaceSettingsController`**: Configurações unificadas do workspace
  - **GET** `/api/workspaces/:workspaceId/settings` — Retorna `{ retention, general, documentProcessing: { chunkingStrategy } }`
  - **PUT** `/api/workspaces/:workspaceId/settings` — Atualiza parcialmente (retention e/ou documentProcessing)
  - Requer OWNER ou ADMIN

### Services

- **`WorkspaceService`**: Gerencia membership, verificação de roles e hierarquia
- **`WorkspaceSettingsService`**: Gerencia configurações (retention, chunking strategy)
  - Retention: file retention days, text/embeddings retention, fuzzy match threshold
  - Document Processing: chunking strategy (paragraph, sentence, fixed_size)

### Guards

- **`WorkspaceGuard`**: Verifica se o usuário é membro do workspace extraído da rota
- **`RolesGuard`**: Verifica se o usuário tem a role necessária no workspace

### Decorators

- **`@WorkspaceId()`**: Extrai `workspaceId` dos parâmetros da rota
- **`@CurrentUser()`**: Extrai o usuário atual da requisição (setado pelo `JwtAuthGuard`)
- **`@Roles(...roles)`**: Especifica roles necessárias para acessar o endpoint

### Service

- **`WorkspaceService`**: Gerencia membership, verificação de roles e hierarquia

## Uso em Controllers

```typescript
import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { WorkspaceGuard, RolesGuard } from './guards';
import { Roles } from './decorators/roles.decorator';
import { WorkspaceRole } from '../entities/workspace-member.entity';
import { WorkspaceId, CurrentUser } from './decorators';

@Controller('workspaces/:workspaceId/documents')
@UseGuards(JwtAuthGuard, WorkspaceGuard) // WorkspaceGuard verifica membership
export class DocumentController {
  @Get()
  async listDocuments(@WorkspaceId() workspaceId: string) {
    // workspaceId já foi validado pelo guard
    // Todas as queries devem filtrar por workspaceId
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(WorkspaceRole.MEMBER, WorkspaceRole.ADMIN, WorkspaceRole.OWNER)
  async createDocument(
    @WorkspaceId() workspaceId: string,
    @CurrentUser() user: { id: string },
  ) {
    // Apenas MEMBER, ADMIN ou OWNER podem criar documentos
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(WorkspaceRole.ADMIN, WorkspaceRole.OWNER)
  async deleteDocument(@WorkspaceId() workspaceId: string) {
    // Apenas ADMIN ou OWNER podem deletar
  }
}
```

## Hierarquia de Roles

1. **OWNER**: Acesso total (billing futuro, delete workspace, retention settings)
2. **ADMIN**: Gerenciar membros, ver tudo, deletar docs
3. **MEMBER**: Upload, chat, redline, download próprios + docs compartilhados
4. **VIEWER**: Somente view/download (sem redline)

## Filtragem por WorkspaceId

**IMPORTANTE**: Todas as queries de recursos devem filtrar por `workspaceId`:

```typescript
// ✅ CORRETO
const documents = await this.documentRepository.find({
  where: { workspaceId, status: DocumentStatus.AVAILABLE },
});

// ❌ ERRADO - sem filtro de workspace
const documents = await this.documentRepository.find({
  where: { status: DocumentStatus.AVAILABLE },
});
```

Use o helper `addWorkspaceFilter` para queries complexas:

```typescript
import { addWorkspaceFilter } from '../workspace/helpers/query-builder.helper';

const qb = this.documentRepository.createQueryBuilder('document');
addWorkspaceFilter(qb, workspaceId, 'document');
return qb.getMany();
```

## Ordem dos Guards

A ordem dos guards importa:

1. `JwtAuthGuard` - Autentica o usuário
2. `WorkspaceGuard` - Verifica membership no workspace
3. `RolesGuard` - Verifica role específica (se necessário)

```typescript
@UseGuards(JwtAuthGuard, WorkspaceGuard, RolesGuard)
@Roles(WorkspaceRole.ADMIN)
```
