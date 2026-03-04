# Guia de Testes — Fase 4: Upload e Pipeline em Fila

Este guia mostra como testar o upload de documentos e o pipeline de processamento em fila.

## Pré-requisitos

1. **API rodando:** `cd apps/api && pnpm start:dev`
2. **Worker rodando:** `cd apps/api && pnpm start:worker` (em terminal separado)
3. **Redis rodando:** `docker-compose up redis` (ou já rodando)
4. **Postgres rodando:** `docker-compose up postgres` (ou já rodando)

## Setup Inicial

### 1. Obter token de autenticação

```bash
# Registrar usuário (se ainda não tiver)
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "name": "Test User"
  }' | jq -r '.accessToken'

# OU fazer login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }' | jq -r '.accessToken'
```

**Salve o token!** Exemplo: `TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."`

### 2. Criar um workspace

```bash
WORKSPACE_RESPONSE=$(curl -s -X POST http://localhost:3000/api/workspaces \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name":"Test Workspace"}')

WORKSPACE_ID=$(echo $WORKSPACE_RESPONSE | jq -r '.id')
echo "Workspace ID: $WORKSPACE_ID"
```

## Testes de Upload

### 1. Criar um documento

```bash
DOCUMENT_RESPONSE=$(curl -s -X POST http://localhost:3000/api/workspaces/$WORKSPACE_ID/documents \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "title": "Test Contract",
    "description": "A test contract document"
  }')

DOCUMENT_ID=$(echo $DOCUMENT_RESPONSE | jq -r '.id')
echo "Document ID: $DOCUMENT_ID"
echo $DOCUMENT_RESPONSE | jq .
```

**Resposta esperada:**
```json
{
  "id": "document-uuid",
  "workspaceId": "workspace-uuid",
  "title": "Test Contract",
  "description": "A test contract document",
  "status": "processing",
  "createdAt": "2026-02-04T...",
  "updatedAt": "2026-02-04T..."
}
```

### 2. Upload de arquivo PDF

```bash
# Criar um arquivo de teste (ou usar um PDF existente)
echo "This is a test PDF content" > test-document.txt

curl -X POST http://localhost:3000/api/workspaces/$WORKSPACE_ID/documents/$DOCUMENT_ID/files \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@test-document.txt" | jq .
```

**Resposta esperada:**
```json
{
  "id": "file-uuid",
  "documentId": "document-uuid",
  "fileName": "test-document.txt",
  "mimeType": "text/plain",
  "sizeBytes": 28,
  "storageKey": "workspace-id/document-id/test-document.txt",
  "status": "processing",
  "createdAt": "2026-02-04T...",
  "updatedAt": "2026-02-04T..."
}
```

### 3. Verificar status do documento

```bash
curl -s http://localhost:3000/api/workspaces/$WORKSPACE_ID/documents/$DOCUMENT_ID \
  -H "Authorization: Bearer $TOKEN" | jq .
```

**Status inicial:** `"status": "processing"`

**Após processamento pelo worker:** `"status": "available"`

### 4. Verificar jobs de processamento

```bash
# Conectar ao banco e verificar jobs
docker exec -it contractai-postgres psql -U contractai -d contractai -c "
SELECT 
  dj.id,
  dj.type,
  dj.status,
  dj.progress,
  dj.attempts,
  dj.\"lastError\",
  dj.\"createdAt\",
  dj.\"updatedAt\"
FROM document_jobs dj
WHERE dj.\"documentId\" = '$DOCUMENT_ID'
ORDER BY dj.\"createdAt\" DESC;
"
```

### 5. Verificar arquivo após processamento

```bash
# Aguardar alguns segundos para o worker processar, depois verificar
sleep 5

curl -s http://localhost:3000/api/workspaces/$WORKSPACE_ID/documents/$DOCUMENT_ID \
  -H "Authorization: Bearer $TOKEN" | jq '.files[0]'
```

**Status esperado após processamento:** `"status": "available"`

## Testes de Validação

### 1. Testar arquivo muito grande (deve falhar)

```bash
# Criar arquivo maior que 25MB
dd if=/dev/zero of=large-file.bin bs=1M count=26

curl -X POST http://localhost:3000/api/workspaces/$WORKSPACE_ID/documents/$DOCUMENT_ID/files \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@large-file.bin" | jq .
```

**Resposta esperada:** `400 Bad Request` - "File size exceeds maximum allowed size"

### 2. Testar extensão não permitida (deve falhar)

```bash
# Criar arquivo com extensão não permitida
echo "test" > test.exe

curl -X POST http://localhost:3000/api/workspaces/$WORKSPACE_ID/documents/$DOCUMENT_ID/files \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@test.exe" | jq .
```

**Resposta esperada:** `400 Bad Request` - "File extension .exe is not allowed"

### 3. Testar upload sem autenticação (deve falhar)

```bash
curl -X POST http://localhost:3000/api/workspaces/$WORKSPACE_ID/documents/$DOCUMENT_ID/files \
  -F "file=@test-document.txt" | jq .
```

**Resposta esperada:** `401 Unauthorized`

### 4. Testar upload em workspace diferente (deve falhar)

```bash
# Criar segundo workspace
WORKSPACE2_RESPONSE=$(curl -s -X POST http://localhost:3000/api/workspaces \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name":"Other Workspace"}')
WORKSPACE2_ID=$(echo $WORKSPACE2_RESPONSE | jq -r '.id')

# Tentar upload no workspace errado
curl -X POST http://localhost:3000/api/workspaces/$WORKSPACE2_ID/documents/$DOCUMENT_ID/files \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@test-document.txt" | jq .
```

**Resposta esperada:** `404 Not Found` - "Document ... not found" (documento não pertence ao workspace)

## Monitorar Worker

### Ver logs do worker

O worker deve mostrar logs quando processa jobs:

```
[ParsingProcessor] Processing job: { jobId: '...', fileId: '...' }
[ParsingProcessor] Job completed successfully
```

### Verificar filas no Redis

```bash
# Conectar ao Redis
docker exec -it contractai-redis redis-cli

# Ver jobs na fila de parsing
KEYS bull:parsing:*

# Ver jobs pendentes
LLEN bull:parsing:wait

# Ver jobs em processamento
LLEN bull:parsing:active
```

## Script de Teste Automatizado

Crie um arquivo `test-upload.sh`:

```bash
#!/bin/bash

API_URL="http://localhost:3000/api"

echo "=== 1. Login ==="
TOKEN=$(curl -s -X POST "$API_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}' | jq -r '.accessToken')

if [ "$TOKEN" == "null" ] || [ -z "$TOKEN" ]; then
  echo "❌ Login failed. Registering user..."
  TOKEN=$(curl -s -X POST "$API_URL/auth/register" \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com","password":"password123","name":"Test User"}' | jq -r '.accessToken')
fi

echo "Token: ${TOKEN:0:20}..."

echo -e "\n=== 2. Create Workspace ==="
WORKSPACE_ID=$(curl -s -X POST "$API_URL/workspaces" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name":"Test Workspace"}' | jq -r '.id')
echo "Workspace ID: $WORKSPACE_ID"

echo -e "\n=== 3. Create Document ==="
DOCUMENT_ID=$(curl -s -X POST "$API_URL/workspaces/$WORKSPACE_ID/documents" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"title":"Test Contract","description":"Test upload"}' | jq -r '.id')
echo "Document ID: $DOCUMENT_ID"

echo -e "\n=== 4. Create Test File ==="
echo "This is a test document content for upload testing." > test-upload.txt

echo -e "\n=== 5. Upload File ==="
UPLOAD_RESPONSE=$(curl -s -X POST "$API_URL/workspaces/$WORKSPACE_ID/documents/$DOCUMENT_ID/files" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@test-upload.txt")
echo $UPLOAD_RESPONSE | jq .

FILE_ID=$(echo $UPLOAD_RESPONSE | jq -r '.id')
FILE_STATUS=$(echo $UPLOAD_RESPONSE | jq -r '.status')
echo "File ID: $FILE_ID"
echo "Initial Status: $FILE_STATUS"

echo -e "\n=== 6. Wait for Processing (10 seconds) ==="
sleep 10

echo -e "\n=== 7. Check Document Status ==="
FINAL_STATUS=$(curl -s "$API_URL/workspaces/$WORKSPACE_ID/documents/$DOCUMENT_ID" \
  -H "Authorization: Bearer $TOKEN" | jq -r '.status')
echo "Final Document Status: $FINAL_STATUS"

if [ "$FINAL_STATUS" == "available" ]; then
  echo "✅ Document processed successfully!"
else
  echo "⏳ Document still processing or error occurred"
fi

echo -e "\n=== 8. Check File Status ==="
FILE_FINAL=$(curl -s "$API_URL/workspaces/$WORKSPACE_ID/documents/$DOCUMENT_ID" \
  -H "Authorization: Bearer $TOKEN" | jq '.files[0]')
echo $FILE_FINAL | jq .

echo -e "\n=== Tests completed! ==="
```

**Para executar:**
```bash
chmod +x test-upload.sh
./test-upload.sh
```

## Checklist de Testes

- [ ] Criar documento funciona
- [ ] Upload de arquivo válido funciona
- [ ] Arquivo é salvo no storage (local ou S3)
- [ ] Job de parsing é criado na fila
- [ ] Worker processa o job
- [ ] Status do arquivo muda para "available"
- [ ] Status do documento muda para "available"
- [ ] Upload de arquivo muito grande é rejeitado
- [ ] Upload de extensão não permitida é rejeitado
- [ ] Upload sem autenticação é rejeitado
- [ ] Upload em workspace errado é rejeitado
- [ ] Jobs são rastreados corretamente (progress, status)

## Troubleshooting

### Worker não processa jobs

1. Verificar se Redis está rodando: `docker-compose ps redis`
2. Verificar logs do worker para erros
3. Verificar conexão Redis no worker
4. Verificar se jobs estão na fila: `redis-cli KEYS bull:*`

### Arquivo não fica "available"

1. Verificar logs do worker para erros de processamento
2. Verificar `document_jobs` table para status do job
3. Verificar `lastError` no job para mensagens de erro

### Upload falha com erro de validação

1. Verificar tamanho do arquivo (< 25MB)
2. Verificar extensão do arquivo (pdf, doc, docx, txt, png, jpg)
3. Verificar MIME type do arquivo

## Próximos Passos

Após validar estes testes, podemos prosseguir para:
- **Fase 5**: RAG e citações (parsing real de PDFs, chunking, embeddings)
- **Fase 6**: Endpoints REST completos (Chat, Redline, etc.)
