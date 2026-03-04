# Guia de Testes — Fase 8: Privacy e Audit

Este documento descreve como testar todas as funcionalidades implementadas na Fase 8.

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

2. **Migration rodada:**
   ```bash
   cd apps/api && pnpm migration:run
   ```
   Isso cria as tabelas `chat_messages` e `document_versions`.

3. **Variáveis de ambiente configuradas:**
   - Verificar que `.env` está configurado corretamente

## Teste Automatizado

Execute o script de teste completo:

```bash
./test-fase8.sh
```

Este script testa todas as funcionalidades da Fase 8 em sequência.

## Teste Manual Passo a Passo

### 1. Autenticação e Setup

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

# Criar workspace
curl -X POST http://localhost:3000/api/workspaces \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name": "Test Workspace"}'

# Salvar workspace ID
export WORKSPACE_ID="workspace-id-retornado"

# Criar documento
curl -X POST "http://localhost:3000/api/workspaces/$WORKSPACE_ID/documents" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"title": "Test Document", "description": "For testing"}'

# Salvar document ID
export DOCUMENT_ID="document-id-retornado"
```

### 2. Testar Chat Messages (Salvamento Automático)

**Endpoint:** `POST /api/workspaces/:workspaceId/documents/:documentId/chat`

```bash
# Fazer pergunta no chat (salva automaticamente)
curl -X POST "http://localhost:3000/api/workspaces/$WORKSPACE_ID/documents/$DOCUMENT_ID/chat" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "question": "What is the governing law of this contract?"
  }' | jq .

# Fazer outra pergunta
curl -X POST "http://localhost:3000/api/workspaces/$WORKSPACE_ID/documents/$DOCUMENT_ID/chat" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "question": "What are the key terms?"
  }' | jq .
```

**Resposta esperada:**
```json
{
  "answerText": "...",
  "confidence": "high|medium|low",
  "citations": [...],
  "notFound": false
}
```

**Verificação:** Chat messages são salvos automaticamente na tabela `chat_messages`.

### 3. Testar Versions (Criação via Redline)

**Endpoint:** `POST /api/workspaces/:workspaceId/documents/:documentId/redline`

```bash
# Gerar redline (cria version automaticamente)
curl -X POST "http://localhost:3000/api/workspaces/$WORKSPACE_ID/documents/$DOCUMENT_ID/redline" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "playbook": "balanced"
  }' | jq .

# Gerar outro redline (cria nova version)
curl -X POST "http://localhost:3000/api/workspaces/$WORKSPACE_ID/documents/$DOCUMENT_ID/redline" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "playbook": "conservative"
  }' | jq .
```

**Resposta esperada:**
```json
{
  "versionId": "uuid",
  "changes": [],
  "playbook": "balanced",
  "createdAt": "2026-02-04T23:00:00.000Z"
}
```

**Verificação:** Versions são criadas automaticamente na tabela `document_versions`.

### 4. Testar No-Logs Configurável

**Endpoint:** `POST /api/workspaces/:workspaceId/privacy/no-logs`

#### 4.1. Habilitar No-Logs com Configuração Padrão

```bash
curl -X POST "http://localhost:3000/api/workspaces/$WORKSPACE_ID/privacy/no-logs" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "enabled": true
  }' | jq .
```

#### 4.2. Habilitar No-Logs com Configuração Granular

```bash
curl -X POST "http://localhost:3000/api/workspaces/$WORKSPACE_ID/privacy/no-logs" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "enabled": true,
    "config": {
      "skipDocumentContent": false,
      "skipChatMessages": true,
      "skipVersions": true,
      "acceleratedPurgeDays": 1
    }
  }' | jq .
```

**Resposta esperada:**
```json
{
  "enabled": true,
  "config": {
    "skipChatMessages": true,
    "skipVersions": true,
    "acceleratedPurgeDays": 1
  }
}
```

**RBAC:** Apenas OWNER e ADMIN podem alterar no-logs.

#### 4.3. Testar Comportamento com No-Logs Habilitado

Após habilitar no-logs com `skipChatMessages: true`:

1. **Fazer nova pergunta no chat:**
   ```bash
   curl -X POST "http://localhost:3000/api/workspaces/$WORKSPACE_ID/documents/$DOCUMENT_ID/chat" \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer $TOKEN" \
     -d '{"question": "Test question with no-logs"}'
   ```

2. **Verificar no banco:**
   ```sql
   SELECT question, "answerText", citations FROM chat_messages 
   WHERE "workspaceId" = 'WORKSPACE_ID' 
   ORDER BY "createdAt" DESC LIMIT 1;
   ```
   
   **Esperado:** `question` deve ser `[REDACTED]`, `answerText` e `citations` devem ser `null`.

### 5. Testar DSAR Export Completo

**Endpoint:** `GET /api/workspaces/:workspaceId/privacy/export`

```bash
curl -X GET "http://localhost:3000/api/workspaces/$WORKSPACE_ID/privacy/export" \
  -H "Authorization: Bearer $TOKEN" \
  -o privacy-export-fase8.json

# Ver conteúdo
cat privacy-export-fase8.json | jq .
```

**Resposta esperada:**
```json
{
  "workspaceId": "uuid",
  "exportedAt": "2026-02-04T23:00:00.000Z",
  "chatMessages": [
    {
      "id": "uuid",
      "documentId": "uuid",
      "question": "What is the governing law?",
      "answerText": "...",
      "confidence": "high",
      "citations": [...],
      "notFound": false,
      "createdAt": "2026-02-04T22:00:00.000Z"
    }
  ],
  "versions": [
    {
      "id": "uuid",
      "documentId": "uuid",
      "versionNumber": 1,
      "playbook": "balanced",
      "changes": [...],
      "createdAt": "2026-02-04T22:30:00.000Z"
    }
  ],
  "redlinePrompts": [
    {
      "id": "uuid",
      "documentId": "uuid",
      "playbook": "balanced",
      "prompt": "...",
      "createdAt": "2026-02-04T22:30:00.000Z"
    }
  ],
  "auditLogs": [...]
}
```

**Com No-Logs Habilitado:**
- `question` pode ser `[REDACTED]`
- `answerText` e `citations` podem ser `null`
- `changes` e `prompt` podem ser `null`

### 6. Testar Download Endpoint

**Endpoint:** `GET /api/workspaces/:workspaceId/documents/:documentId/files/:fileId/download`

```bash
# Primeiro, fazer upload de um arquivo
UPLOAD_RESPONSE=$(curl -s -X POST "http://localhost:3000/api/workspaces/$WORKSPACE_ID/documents/$DOCUMENT_ID/files" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@test-contract-naira.txt")
FILE_ID=$(echo $UPLOAD_RESPONSE | jq -r '.id')

# Aguardar processamento
sleep 10

# Fazer download
curl -L "http://localhost:3000/api/workspaces/$WORKSPACE_ID/documents/$DOCUMENT_ID/files/$FILE_ID/download" \
  -H "Authorization: Bearer $TOKEN" \
  -o downloaded-file.txt
```

**Resposta esperada:**
- HTTP 302/301 (redirect) ou 200 (stream)
- Arquivo baixado

**Verificação:** Audit log de `download` deve ser criado.

### 7. Verificar Audit Logs Completos

**Endpoint:** `GET /api/workspaces/:workspaceId/audit`

```bash
# Listar todos os logs
curl -X GET "http://localhost:3000/api/workspaces/$WORKSPACE_ID/audit?limit=20" \
  -H "Authorization: Bearer $TOKEN" | jq .

# Filtrar por ação específica
curl -X GET "http://localhost:3000/api/workspaces/$WORKSPACE_ID/audit?action=chat_query&limit=10" \
  -H "Authorization: Bearer $TOKEN" | jq .

curl -X GET "http://localhost:3000/api/workspaces/$WORKSPACE_ID/audit?action=download&limit=10" \
  -H "Authorization: Bearer $TOKEN" | jq .
```

**Ações esperadas:**
- `open_view` - Visualização de documento
- `download` - Download de arquivo
- `upload` - Upload de arquivo
- `chat_query` - Pergunta no chat
- `redline_generate` - Geração de redline
- `export_privacy` - Export de privacidade

### 8. Verificar Segurança de Logs

Verificar que nenhum console.log está logando conteúdo sensível:

```bash
# Verificar logs da API (não deve conter conteúdo de contratos ou mensagens)
# Os logs devem conter apenas IDs, tamanhos, contagens, etc.
```

**Regras:**
- ❌ NUNCA logar: conteúdo de contratos, chunks completos, perguntas do usuário, respostas da IA
- ✅ Apenas logar: IDs, tamanhos, contagens, timestamps, erros genéricos

## Validações Esperadas

### ✅ Chat Messages
- [ ] Mensagens são salvas automaticamente após cada pergunta
- [ ] Com no-logs habilitado, `question` vira `[REDACTED]`
- [ ] Com no-logs habilitado, `answerText` e `citations` são `null`
- [ ] Mensagens aparecem no DSAR export

### ✅ Versions
- [ ] Versions são criadas automaticamente após cada redline
- [ ] Com no-logs habilitado, `changes` e `prompt` são `null`
- [ ] Versions aparecem no DSAR export
- [ ] Redline prompts são extraídos das versions no export

### ✅ No-Logs Configurável
- [ ] Configuração granular funciona (`skipChatMessages`, `skipVersions`, etc.)
- [ ] Dados são redacted conforme configuração
- [ ] Dados antigos não são alterados (apenas novos dados respeitam no-logs)

### ✅ DSAR Export
- [ ] Inclui chat messages reais
- [ ] Inclui versions reais
- [ ] Inclui redline prompts extraídos
- [ ] Inclui audit logs
- [ ] Respeita no-logs (mostra `[REDACTED]` ou `null` quando aplicável)

### ✅ Download
- [ ] Endpoint funciona corretamente
- [ ] Retorna URL de download (redirect)
- [ ] Registra no audit log

### ✅ Audit Logs
- [ ] Todos os eventos estão sendo registrados
- [ ] Metadata contém apenas informações seguras
- [ ] Filtros funcionam corretamente

### ✅ Segurança de Logs
- [ ] Nenhum console.log contém conteúdo sensível
- [ ] Apenas metadados são logados

## Troubleshooting

### Chat messages não aparecem no export
- Verificar que migration foi rodada (`chat_messages` table existe)
- Verificar que chat foi executado após criar documento
- Verificar que no-logs não está bloqueando salvamento

### Versions não aparecem no export
- Verificar que migration foi rodada (`document_versions` table existe)
- Verificar que redline foi gerado
- Verificar que no-logs não está bloqueando salvamento

### No-logs não funciona
- Verificar que usuário tem role OWNER ou ADMIN
- Verificar que configuração foi salva corretamente
- Verificar que novos dados respeitam a configuração (dados antigos não são alterados)

### Download não funciona
- Verificar que arquivo foi enviado e processado
- Verificar que `FILE_ID` está correto
- Verificar que storage service está configurado corretamente

### Audit logs vazios
- Verificar que ações foram executadas
- Verificar que usuário tem role ADMIN ou OWNER para visualizar logs
- Aguardar alguns segundos após ações (logs são criados assincronamente)

## Próximos Passos

Após validar a Fase 8:
1. Monitorar purge acelerado (executa automaticamente no purge job diário)
2. Testar export com diferentes configurações de no-logs
3. Verificar que dados são purgados corretamente após `acceleratedPurgeDays`
4. Implementar UI para configurar no-logs (Fase 9)
