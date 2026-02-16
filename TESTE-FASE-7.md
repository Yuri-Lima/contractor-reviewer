# Guia de Testes — Fase 7: Retention, Purge e Hard Delete

Este documento descreve como testar todas as funcionalidades implementadas na Fase 7.

## Pré-requisitos

1. **Serviços rodando:**
   ```bash
   # Terminal 1: API
   cd apps/api && pnpm start:dev
   
   # Terminal 2: Docker (Postgres + Redis)
   docker-compose up
   ```

2. **Variáveis de ambiente configuradas:**
   - Verificar que `.env` está configurado corretamente

## Teste Automatizado

Execute o script de teste completo:

```bash
./test-fase7.sh
```

Este script testa todas as funcionalidades da Fase 7 em sequência.

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

### 2. Criar Workspace

```bash
curl -X POST http://localhost:3000/api/workspaces \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name": "Test Workspace"}'

# Salvar workspace ID
export WORKSPACE_ID="workspace-id-retornado"
```

### 3. Testar Retention - Obter Configuração

**Endpoint:** `GET /api/workspaces/:workspaceId/retention`

```bash
curl -X GET "http://localhost:3000/api/workspaces/$WORKSPACE_ID/retention" \
  -H "Authorization: Bearer $TOKEN" | jq .
```

**Resposta esperada:**
```json
{
  "defaultFileRetentionDays": 30,
  "defaultTextEmbeddingsRetentionDays": 90,
  "retentionOverrides": {}
}
```

### 4. Testar Retention - Atualizar Configuração

**Endpoint:** `PUT /api/workspaces/:workspaceId/retention`

```bash
# Atualizar retention
curl -X PUT "http://localhost:3000/api/workspaces/$WORKSPACE_ID/retention" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "defaultFileRetentionDays": 15,
    "defaultTextEmbeddingsRetentionDays": 45
  }' | jq .

# Com overrides
curl -X PUT "http://localhost:3000/api/workspaces/$WORKSPACE_ID/retention" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "defaultFileRetentionDays": 30,
    "defaultTextEmbeddingsRetentionDays": 90,
    "retentionOverrides": {
      "file": 45,
      "text": 120
    }
  }' | jq .
```

**Resposta esperada:**
```json
{
  "defaultFileRetentionDays": 15,
  "defaultTextEmbeddingsRetentionDays": 45,
  "retentionOverrides": {}
}
```

**RBAC:** Apenas OWNER e ADMIN podem atualizar retention.

**Nota:** O endpoint unificado `GET/PUT /api/workspaces/:workspaceId/settings` também expõe retention e document processing (chunking strategy). O endpoint `/retention` permanece disponível para compatibilidade.

### 5. Testar Validação de Limites

```bash
# Tentar definir file retention > 365 dias (deve falhar)
curl -X PUT "http://localhost:3000/api/workspaces/$WORKSPACE_ID/retention" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "defaultFileRetentionDays": 500
  }' | jq .

# Tentar definir text retention > 730 dias (deve falhar)
curl -X PUT "http://localhost:3000/api/workspaces/$WORKSPACE_ID/retention" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "defaultTextEmbeddingsRetentionDays": 1000
  }' | jq .
```

**Resposta esperada:** HTTP 400 com mensagem de erro.

### 6. Testar Hard Delete de Documento

**Endpoint:** `DELETE /api/workspaces/:workspaceId/documents/:documentId`

```bash
# Criar documento primeiro
DOCUMENT_RESPONSE=$(curl -s -X POST "http://localhost:3000/api/workspaces/$WORKSPACE_ID/documents" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"title": "Test Document", "description": "For deletion test"}')
DOCUMENT_ID=$(echo $DOCUMENT_RESPONSE | jq -r '.id')

# Deletar documento
curl -X DELETE "http://localhost:3000/api/workspaces/$WORKSPACE_ID/documents/$DOCUMENT_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -v
```

**Resposta esperada:**
- HTTP 204 No Content (sucesso)

**Comportamento idempotente:**
```bash
# Deletar novamente (deve retornar 204 também, não erro)
curl -X DELETE "http://localhost:3000/api/workspaces/$WORKSPACE_ID/documents/$DOCUMENT_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -v
```

### 7. Verificar Audit Logs

```bash
# Verificar logs de delete
curl -X GET "http://localhost:3000/api/workspaces/$WORKSPACE_ID/audit?action=delete&limit=10" \
  -H "Authorization: Bearer $TOKEN" | jq .
```

**Resposta esperada:**
```json
{
  "logs": [
    {
      "id": "uuid",
      "action": "delete",
      "targetType": "document",
      "targetId": "document-id",
      "metadata": {
        "hardDelete": true
      },
      "createdAt": "2026-02-04T23:00:00.000Z"
    }
  ],
  "total": 1,
  "limit": 10,
  "offset": 0
}
```

### 8. Testar Hard Delete de Conta

**Endpoint:** `DELETE /api/account`

⚠️ **ATENÇÃO:** Este endpoint deleta a conta do usuário. Use com cuidado!

```bash
curl -X DELETE "http://localhost:3000/api/account" \
  -H "Authorization: Bearer $TOKEN" \
  -v
```

**Resposta esperada:**
- HTTP 204 No Content (sucesso) - se usuário não é único OWNER
- HTTP 400 Bad Request - se usuário é único OWNER de workspace (conta é desativada em vez de deletada)

**Comportamento idempotente:**
```bash
# Tentar deletar novamente (deve retornar 204 ou 404)
curl -X DELETE "http://localhost:3000/api/account" \
  -H "Authorization: Bearer $TOKEN" \
  -v
```

### 9. Testar Purge Manual (Opcional)

O purge job roda automaticamente às 2:00 AM. Para testar manualmente, você pode criar um endpoint temporário ou usar o PurgeService diretamente.

**Nota:** O purge verifica arquivos e chunks expirados baseado na política de retention configurada.

## Validações Esperadas

### ✅ Retention
- [ ] Endpoint GET retorna configuração padrão (30 dias files, 90 dias text)
- [ ] Endpoint PUT atualiza configuração com sucesso
- [ ] Validação rejeita valores fora dos limites (1-365 para files, 1-730 para text)
- [ ] OWNER/ADMIN pode atualizar, outros roles não podem (403)

### ✅ Hard Delete Documento
- [ ] Delete remove arquivos do storage
- [ ] Delete remove chunks/embeddings do banco
- [ ] Delete remove documento do banco
- [ ] Delete é idempotente (não falha se já deletado)
- [ ] Delete registra no audit log

### ✅ Hard Delete Conta
- [ ] Delete remove usuário de workspace memberships
- [ ] Delete bloqueia se usuário é único OWNER de workspace
- [ ] Delete é idempotente
- [ ] Delete remove usuário do banco (se permitido)

### ✅ Purge Job
- [ ] Job roda automaticamente às 2:00 AM (verificar logs)
- [ ] Purge remove arquivos expirados do storage
- [ ] Purge remove chunks/embeddings expirados do banco
- [ ] Purge respeita política de retention configurada

## Troubleshooting

### Erro: "Cannot delete account: user is the only owner"
- **Causa:** Usuário é único OWNER de um workspace
- **Solução:** Adicionar outro OWNER ao workspace ou deletar o workspace primeiro

### Retention não atualiza
- Verificar que usuário tem role OWNER ou ADMIN
- Verificar que valores estão dentro dos limites (1-365 para files, 1-730 para text)

### Purge não executa
- Verificar logs da API para erros do scheduled job
- Verificar que `@nestjs/schedule` está configurado no `RetentionModule`
- Verificar que API está rodando (purge job roda no processo da API)

### Hard delete não remove arquivos
- Verificar que `StorageService` está injetado corretamente
- Verificar logs para erros de delete no storage
- Verificar que `storageKey` está correto no banco

## Próximos Passos

Após validar a Fase 7:
1. Monitorar logs do purge job diário
2. Configurar retention policies apropriadas por workspace
3. Implementar UI para configurar retention (Fase 9)
4. Adicionar métricas/monitoramento de purge jobs
