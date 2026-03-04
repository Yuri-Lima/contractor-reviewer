# Guia de Testes — Fase 5: RAG e Citações

Este documento descreve como testar a implementação completa da Fase 5 — RAG e citações.

## Pré-requisitos

1. **Serviços rodando:**
   ```bash
   # Terminal 1: API
   cd apps/api && pnpm start:dev
   
   # Terminal 2: Worker (BullMQ)
   cd apps/api && pnpm start:worker
   
   # Terminal 3: Docker (Postgres + Redis)
   docker-compose up
   ```

2. **Variáveis de ambiente configuradas:**
   - `OPENAI_API_KEY` deve estar configurada no `.env`
   - Verificar que `DATABASE_URL` e `REDIS_URL` estão corretos

3. **Extensão pgvector instalada no PostgreSQL:**
   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   ```

## Fluxo de Teste Completo

### 1. Teste Automatizado (Script)

Execute o script de teste completo:

```bash
./test-rag.sh
```

Este script:
- ✅ Faz login/registro
- ✅ Cria workspace e documento
- ✅ Faz upload de arquivo (PDF ou texto)
- ✅ Aguarda processamento completo (parsing → chunking → embeddings)
- ✅ Verifica resolução de jurisdição
- ✅ Testa múltiplas perguntas no chat com RAG
- ✅ Valida citações retornadas

### 2. Teste Manual Passo a Passo

#### 2.1. Autenticação

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

#### 2.2. Criar Workspace e Documento

```bash
# Criar workspace
curl -X POST http://localhost:3000/api/workspaces \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name": "RAG Test Workspace"}'

# Salvar workspace ID
export WORKSPACE_ID="workspace-id-retornado"

# Criar documento
curl -X POST http://localhost:3000/api/workspaces/$WORKSPACE_ID/documents \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "title": "Sample Contract",
    "description": "Test contract for RAG"
  }'

# Salvar document ID
export DOCUMENT_ID="document-id-retornado"
```

#### 2.3. Upload de Arquivo

**Opção A: PDF de teste**

Crie um PDF com conteúdo de contrato (exemplo com texto simples primeiro):

```bash
# Criar arquivo texto de teste
cat > test-contract.txt << 'EOF'
SERVICE AGREEMENT

This Service Agreement ("Agreement") is entered into on January 1, 2024, between 
ACME Corporation ("Client") and Service Provider Inc. ("Provider").

1. GOVERNING LAW
This Agreement shall be governed by and construed in accordance with the laws of 
the State of California, United States of America.

2. TERM
The initial term of this Agreement shall be twelve (12) months, commencing on 
the Effective Date and ending on December 31, 2024.

3. PAYMENT TERMS
Client agrees to pay Provider $10,000 per month for services rendered. Payment 
shall be due within 30 days of invoice date.

4. TERMINATION
Either party may terminate this Agreement with 30 days written notice.

5. CONFIDENTIALITY
Both parties agree to maintain confidentiality of all proprietary information 
disclosed during the term of this Agreement.
EOF

# Upload
curl -X POST http://localhost:3000/api/workspaces/$WORKSPACE_ID/documents/$DOCUMENT_ID/files \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@test-contract.txt"
```

**Opção B: Usar PDF real**

Se você tiver um PDF de contrato real:

```bash
curl -X POST http://localhost:3000/api/workspaces/$WORKSPACE_ID/documents/$DOCUMENT_ID/files \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@seu-contrato.pdf"
```

#### 2.4. Monitorar Processamento

```bash
# Verificar status do documento
curl http://localhost:3000/api/workspaces/$WORKSPACE_ID/documents/$DOCUMENT_ID \
  -H "Authorization: Bearer $TOKEN" | jq .

# Verificar jobs no banco
docker exec -it contractai-postgres psql -U contractai -d contractai \
  -c "SELECT type, status, progress, \"lastError\" FROM document_jobs WHERE \"documentId\" = '$DOCUMENT_ID' ORDER BY \"createdAt\" DESC;"
```

**Estados esperados:**
1. `PARSING` → `completed` (extrai texto e resolve jurisdição)
2. `CHUNKING` → `completed` (divide em chunks)
3. `EMBEDDING` → `completed` (gera embeddings)
4. Document status: `processing` → `available`

**Aguardar até status = "available"** (pode levar 30-60 segundos dependendo do tamanho do arquivo)

#### 2.5. Verificar Resolução de Jurisdição

```bash
curl http://localhost:3000/api/workspaces/$WORKSPACE_ID/documents/$DOCUMENT_ID \
  -H "Authorization: Bearer $TOKEN" | jq '{resolvedJurisdiction, jurisdictionStatus}'
```

**Resultados esperados:**
- `resolvedJurisdiction`: "US-CA" (ou outro código de jurisdição)
- `jurisdictionStatus`: "explicit", "inferred", ou "unknown"

#### 2.6. Verificar Chunks e Embeddings

```bash
# Contar chunks criados
docker exec -it contractai-postgres psql -U contractai -d contractai \
  -c "SELECT COUNT(*) FROM chunks WHERE \"documentId\" = '$DOCUMENT_ID';"

# Verificar embeddings
docker exec -it contractai-postgres psql -U contractai -d contractai \
  -c "SELECT COUNT(*) FROM embeddings WHERE \"chunkId\" IN (SELECT id FROM chunks WHERE \"documentId\" = '$DOCUMENT_ID');"

# Ver um chunk de exemplo
docker exec -it contractai-postgres psql -U contractai -d contractai \
  -c "SELECT id, \"pageNumber\", LEFT(text, 100) as text_preview FROM chunks WHERE \"documentId\" = '$DOCUMENT_ID' LIMIT 1;"
```

#### 2.7. Testar Chat com RAG

**Pergunta 1: Sobre a lei aplicável**

```bash
curl -X POST http://localhost:3000/api/workspaces/$WORKSPACE_ID/documents/$DOCUMENT_ID/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"question": "What is the governing law of this contract?"}' | jq .
```

**Resposta esperada:**
```json
{
  "answerText": "The governing law is California, United States...",
  "confidence": "high",
  "citations": [
    {
      "type": "contract",
      "fileName": "Sample Contract",
      "pageNumber": 1,
      "quoteSnippet": "This Agreement shall be governed by and construed..."
    }
  ],
  "notFound": false
}
```

**Pergunta 2: Sobre valores/pagamento**

```bash
curl -X POST http://localhost:3000/api/workspaces/$WORKSPACE_ID/documents/$DOCUMENT_ID/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"question": "What is the payment amount per month?"}' | jq .
```

**Pergunta 3: Sobre prazo/termo**

```bash
curl -X POST http://localhost:3000/api/workspaces/$WORKSPACE_ID/documents/$DOCUMENT_ID/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"question": "How long is the initial term?"}' | jq .
```

**Pergunta 4: Sobre rescisão**

```bash
curl -X POST http://localhost:3000/api/workspaces/$WORKSPACE_ID/documents/$DOCUMENT_ID/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"question": "What are the termination conditions?"}' | jq .
```

**Pergunta 5: Pergunta sem resposta (teste de NOT FOUND)**

```bash
curl -X POST http://localhost:3000/api/workspaces/$WORKSPACE_ID/documents/$DOCUMENT_ID/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"question": "What is the weather today?"}' | jq .
```

**Resposta esperada:**
```json
{
  "answerText": "...",
  "confidence": "low",
  "citations": [],
  "notFound": true
}
```

## Validações Esperadas

### ✅ Processamento
- [ ] Arquivo é enviado com sucesso
- [ ] Job de PARSING é criado e completa
- [ ] Job de CHUNKING é criado e completa
- [ ] Job de EMBEDDING é criado e completa
- [ ] Document status muda para "available"
- [ ] Chunks são criados no banco
- [ ] Embeddings são gerados e salvos

### ✅ Jurisdição
- [ ] Jurisdição é detectada (explicit ou inferred)
- [ ] Campo `resolvedJurisdiction` é preenchido (ex: "US-CA")
- [ ] Campo `jurisdictionStatus` é preenchido

### ✅ RAG e Citações
- [ ] Perguntas retornam respostas relevantes
- [ ] Respostas incluem citações do contrato
- [ ] Campo `confidence` é preenchido (high/medium/low)
- [ ] Campo `notFound` é `false` para perguntas relevantes
- [ ] Citações incluem `fileName`, `pageNumber`, `quoteSnippet`
- [ ] Perguntas irrelevantes retornam `notFound: true`

### ✅ Legal RAG (se implementado)
- [ ] Quando jurisdição está disponível, busca em fontes legais
- [ ] Citações legais incluem `sourceName`, `section`, `url`
- [ ] Respostas combinam informações do contrato + fontes legais

## Troubleshooting

### Erro: "OPENAI_API_KEY not set"
- Verificar que `OPENAI_API_KEY` está no `.env`
- Reiniciar a API após adicionar a variável

### Erro: "Document not found"
- Verificar que o `documentId` está correto
- Verificar que o documento pertence ao workspace correto

### Processamento não completa
- Verificar logs do worker: `cd apps/api && pnpm start:worker`
- Verificar jobs no banco com `lastError`
- Verificar que Redis está rodando

### Chunks não são criados
- Verificar logs do `ChunkingProcessor`
- Verificar que o texto foi extraído corretamente (ver `ocrText` no `DocumentFile`)

### Embeddings não são gerados
- Verificar `OPENAI_API_KEY` está válida
- Verificar logs do `EmbeddingsProcessor`
- Verificar rate limits da OpenAI

### Citações vazias
- Verificar que embeddings foram gerados
- Verificar que a busca vetorial está funcionando (distâncias < 0.6)
- Verificar que o texto da pergunta gera embedding válido

### Jurisdição não resolvida
- Verificar que o texto do contrato contém palavras-chave (ex: "governed by", "California")
- Verificar logs do `JurisdictionResolverService`
- Testar com contrato que tenha cláusula explícita de "Governing Law"

## Próximos Passos

Após validar a Fase 5:
1. Implementar Legal RAG (fontes legais por jurisdição)
2. Melhorar heurísticas de resolução de jurisdição
3. Adicionar testes unitários para serviços RAG
4. Implementar Fase 6 (endpoints REST restantes)
5. Implementar Fase 7 (retention e purge)
6. Implementar Fase 8 (privacy e audit)
