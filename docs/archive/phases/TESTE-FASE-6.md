# Guia de Testes — Fase 6: Endpoints REST (mínimo)

Este documento descreve como testar todos os endpoints REST implementados na Fase 6.

## Pré-requisitos

1. **Serviços rodando:**
   ```bash
   # Terminal 1: API
   cd apps/api && pnpm start:dev
   
   # Terminal 2: Worker (opcional, apenas se testar upload)
   cd apps/api && pnpm start:worker
   
   # Terminal 3: Docker (Postgres + Redis)
   docker-compose up
   ```

2. **Variáveis de ambiente configuradas:**
   - Verificar que `.env` está configurado corretamente

## Teste Automatizado

Execute o script de teste completo:

```bash
./test-fase6.sh
```

Este script testa todos os endpoints da Fase 6 em sequência.

## Teste Manual Passo a Passo

### 1. Autenticação

```bash
# Registrar usuário (se necessário)
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "name": "Test User"
  }'

# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'

# Salvar o token retornado
export TOKEN="seu-token-aqui"
```

### 2. Criar Workspace e Documento

```bash
# Criar workspace
curl -X POST http://localhost:3000/api/workspaces \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name": "Test Workspace"}'

# Salvar workspace ID
export WORKSPACE_ID="workspace-id-retornado"

# Criar documento
curl -X POST http://localhost:3000/api/workspaces/$WORKSPACE_ID/documents \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "title": "Test Document",
    "description": "Document for testing"
  }'

# Salvar document ID
export DOCUMENT_ID="document-id-retornado"
```

### 3. Testar Redline

**Endpoint:** `POST /api/workspaces/:workspaceId/documents/:documentId/redline`

```bash
# Gerar redline com playbook balanced
curl -X POST "http://localhost:3000/api/workspaces/$WORKSPACE_ID/documents/$DOCUMENT_ID/redline" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "playbook": "balanced"
  }' | jq .

# Testar outros playbooks
curl -X POST "http://localhost:3000/api/workspaces/$WORKSPACE_ID/documents/$DOCUMENT_ID/redline" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "playbook": "conservative"
  }' | jq .

curl -X POST "http://localhost:3000/api/workspaces/$WORKSPACE_ID/documents/$DOCUMENT_ID/redline" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "playbook": "client-friendly"
  }' | jq .
```

**Resposta esperada:**
```json
{
  "versionId": "placeholder-version-id",
  "changes": [],
  "playbook": "balanced",
  "createdAt": "2026-02-04T23:30:00.000Z"
}
```

**Nota:** A lógica completa de redline será implementada na Fase 10. Por enquanto, retorna uma resposta placeholder.

### 4. Testar Privacy - Toggle No-Logs

**Endpoint:** `POST /api/workspaces/:workspaceId/privacy/no-logs`

```bash
# Habilitar no-logs
curl -X POST "http://localhost:3000/api/workspaces/$WORKSPACE_ID/privacy/no-logs" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "enabled": true
  }' | jq .

# Desabilitar no-logs
curl -X POST "http://localhost:3000/api/workspaces/$WORKSPACE_ID/privacy/no-logs" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "enabled": false
  }' | jq .
```

**Resposta esperada:**
```json
{
  "enabled": true
}
```

**RBAC:** Apenas OWNER e ADMIN podem alterar esta configuração.

### 5. Testar Privacy - Export DSAR-lite

**Endpoint:** `GET /api/workspaces/:workspaceId/privacy/export`

```bash
# Exportar dados de privacidade
curl -X GET "http://localhost:3000/api/workspaces/$WORKSPACE_ID/privacy/export" \
  -H "Authorization: Bearer $TOKEN" \
  -o privacy-export.json

# Ver conteúdo
cat privacy-export.json | jq .
```

**Resposta esperada:**
```json
{
  "workspaceId": "uuid",
  "exportedAt": "2026-02-04T23:30:00.000Z",
  "chatMessages": [],
  "versions": [],
  "redlinePrompts": [],
  "auditLogs": [
    {
      "action": "upload",
      "targetType": "document",
      "createdAt": "2026-02-04T23:25:00.000Z"
    }
  ]
}
```

**Nota:** `chatMessages`, `versions` e `redlinePrompts` estarão vazios até que essas funcionalidades sejam totalmente implementadas. Os `auditLogs` serão preenchidos conforme ações são registradas.

### 6. Testar Audit Logs

**Endpoint:** `GET /api/workspaces/:workspaceId/audit`

#### 6.1. Listar todos os logs

```bash
curl -X GET "http://localhost:3000/api/workspaces/$WORKSPACE_ID/audit" \
  -H "Authorization: Bearer $TOKEN" | jq .
```

#### 6.2. Filtrar por ação

```bash
# Filtrar por ação específica
curl -X GET "http://localhost:3000/api/workspaces/$WORKSPACE_ID/audit?action=chat_query" \
  -H "Authorization: Bearer $TOKEN" | jq .

# Ações disponíveis:
# - open_view
# - download
# - chat_query
# - redline_generate
# - delete
# - export_privacy
# - upload
# - member_add
# - member_remove
# - settings_update
```

#### 6.3. Filtrar por usuário

```bash
curl -X GET "http://localhost:3000/api/workspaces/$WORKSPACE_ID/audit?userId=USER_ID" \
  -H "Authorization: Bearer $TOKEN" | jq .
```

#### 6.4. Filtrar por tipo de target

```bash
curl -X GET "http://localhost:3000/api/workspaces/$WORKSPACE_ID/audit?targetType=document" \
  -H "Authorization: Bearer $TOKEN" | jq .
```

#### 6.5. Filtrar por data

```bash
# Filtrar por período
curl -X GET "http://localhost:3000/api/workspaces/$WORKSPACE_ID/audit?startDate=2026-02-04T00:00:00Z&endDate=2026-02-05T00:00:00Z" \
  -H "Authorization: Bearer $TOKEN" | jq .
```

#### 6.6. Paginação

```bash
# Limitar resultados e usar offset
curl -X GET "http://localhost:3000/api/workspaces/$WORKSPACE_ID/audit?limit=20&offset=0" \
  -H "Authorization: Bearer $TOKEN" | jq .
```

**Resposta esperada:**
```json
{
  "logs": [
    {
      "id": "uuid",
      "workspaceId": "uuid",
      "actorUserId": "uuid",
      "action": "upload",
      "targetType": "document",
      "targetId": "uuid",
      "ip": "127.0.0.1",
      "userAgent": "curl/7.68.0",
      "metadata": {},
      "createdAt": "2026-02-04T23:25:00.000Z"
    }
  ],
  "total": 1,
  "limit": 50,
  "offset": 0
}
```

**RBAC:** Apenas ADMIN e OWNER podem visualizar audit logs.

### 7. Testar Account Delete

**Endpoint:** `DELETE /api/account`

⚠️ **ATENÇÃO:** Este endpoint desativa a conta do usuário. Use com cuidado!

```bash
curl -X DELETE "http://localhost:3000/api/account" \
  -H "Authorization: Bearer $TOKEN" \
  -v
```

**Resposta esperada:**
- HTTP 204 No Content (sucesso)

**Nota:** A implementação atual marca o usuário como inativo. A lógica completa de cascade delete será implementada posteriormente.

## Validações Esperadas

### ✅ Redline
- [ ] Endpoint responde com sucesso
- [ ] Playbooks aceitos: `balanced`, `conservative`, `client-friendly`
- [ ] Resposta inclui `versionId`, `changes`, `playbook`, `createdAt`

### ✅ Privacy - No-Logs
- [ ] OWNER/ADMIN pode habilitar/desabilitar
- [ ] VIEWER/MEMBER não pode alterar (deve retornar 403)
- [ ] Configuração é persistida no `WorkspaceSettings`

### ✅ Privacy - Export
- [ ] Export retorna JSON válido
- [ ] Inclui `workspaceId`, `exportedAt`
- [ ] Inclui arrays de `chatMessages`, `versions`, `redlinePrompts`, `auditLogs`
- [ ] Arquivo pode ser baixado

### ✅ Audit Logs
- [ ] ADMIN/OWNER pode visualizar logs
- [ ] VIEWER/MEMBER não pode visualizar (deve retornar 403)
- [ ] Filtros funcionam corretamente (ação, usuário, data, tipo)
- [ ] Paginação funciona (limit, offset)
- [ ] Resposta inclui `total`, `limit`, `offset`

### ✅ Account Delete
- [ ] Usuário autenticado pode deletar própria conta
- [ ] Retorna HTTP 204 em caso de sucesso
- [ ] Usuário fica inativo após delete

## Troubleshooting

### Erro: "WorkspaceGuard not found"
- Verificar que `WorkspaceModule` está importado nos módulos que usam `WorkspaceGuard`

### Erro: "403 Forbidden" em Privacy/Audit
- Verificar que o usuário tem role ADMIN ou OWNER
- Verificar que o usuário é membro do workspace

### Audit logs vazios
- Normal se não houver ações registradas ainda
- Fazer algumas ações (upload, chat, etc.) para gerar logs

### Export vazio
- Normal se não houver dados ainda
- `chatMessages`, `versions` e `redlinePrompts` estarão vazios até implementação completa

### Rate limiting
- Se receber HTTP 429, aguardar o tempo indicado em `retryAfter`
- Verificar limites configurados no `.env`

## Próximos Passos

Após validar a Fase 6:
1. Implementar lógica completa de redline (Fase 10)
2. Implementar chat history para export completo
3. Implementar versioning para export completo
4. Melhorar cascade delete em `deleteAccount`
5. Integrar audit logging nos endpoints existentes
6. Aplicar rate limiting nos endpoints críticos
