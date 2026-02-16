# Guia de Testes — ContractAI Review MVP+

Este guia descreve como testar as funcionalidades implementadas até agora (Fases 1-4).

**Para testes específicos da Fase 4 (Upload e Pipeline), veja [TESTING-PHASE4.md](./TESTING-PHASE4.md)**

## Pré-requisitos

1. **Docker e Docker Compose** instalados
2. **Node.js** (v18+) e **pnpm** instalados
3. Variáveis de ambiente configuradas (copiar `.env.example` para `.env`)

## Setup Inicial

### 1. Subir infraestrutura (Postgres + Redis + Docling + PDFPlumber)

```bash
# Na raiz do projeto
docker-compose up -d

# Verificar se os containers estão rodando
docker-compose ps

# Serviços disponíveis:
# - postgres (5432)
# - redis (6379)
# - docling (8000) — parser de documentos (PDF, DOC, DOCX, imagens)
# - pdfplumber (8001) — parser PDF

# Verificar saúde dos parsers (opcional, para testes de upload)
curl http://localhost:8000/health   # Docling
curl http://localhost:8001/health   # PDFPlumber
```

### 2. Instalar dependências

```bash
# Na raiz do projeto
pnpm install
```

### 3. Rodar migrações do banco

```bash
cd apps/api
pnpm migration:run
```

**Verificar se as migrações rodaram:**
```bash
# Conectar ao banco e verificar tabelas
docker exec -it contractai-postgres psql -U contractai -d contractai -c "\dt"
```

### 4. Iniciar a API

```bash
cd apps/api
pnpm start:dev
```

A API estará disponível em `http://localhost:3000/api`

## Testes Manuais com cURL

### 1. Health Check

```bash
curl http://localhost:3000/api/health
```

**Resposta esperada:**
```json
{"status":"ok"}
```

### 2. Registrar Usuário

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "name": "Test User"
  }'
```

**Resposta esperada:**
```json
{
  "user": {
    "id": "uuid-here",
    "email": "test@example.com",
    "name": "Test User",
    "role": "user",
    "isActive": true,
    "createdAt": "2025-02-04T...",
    "updatedAt": "2025-02-04T..."
  },
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**⚠️ IMPORTANTE:** Salve o `accessToken` e o `user.id` para os próximos testes!

### 3. Login

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'
```

**Resposta esperada:** Mesmo formato do registro, com novo `accessToken`

### 4. Criar Workspace

```bash
# Substitua YOUR_TOKEN pelo accessToken obtido no login
curl -X POST http://localhost:3000/api/workspaces \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "name": "My First Workspace"
  }'
```

**Resposta esperada:**
```json
{
  "id": "workspace-uuid",
  "name": "My First Workspace",
  "createdAt": "2025-02-04T...",
  "updatedAt": "2025-02-04T..."
}
```

**⚠️ IMPORTANTE:** Salve o `workspace.id` para os próximos testes!

### 5. Buscar Workspace (verifica WorkspaceGuard)

```bash
# Substitua YOUR_TOKEN e WORKSPACE_ID
curl -X GET http://localhost:3000/api/workspaces/WORKSPACE_ID \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Resposta esperada:** Workspace object completo

### 6. Tentar acessar workspace sem autenticação (deve falhar)

```bash
curl -X GET http://localhost:3000/api/workspaces/WORKSPACE_ID
```

**Resposta esperada:** 
```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```

### 7. Criar segundo usuário para testar isolamento

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "other@example.com",
    "password": "password123",
    "name": "Other User"
  }'
```

**Salve o `user.id` do segundo usuário!**

### 8. Tentar acessar workspace de outro usuário (deve falhar)

```bash
# Login do segundo usuário
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "other@example.com",
    "password": "password123"
  }'

# Tentar acessar workspace do primeiro usuário (deve falhar)
curl -X GET http://localhost:3000/api/workspaces/WORKSPACE_ID \
  -H "Authorization: Bearer OTHER_USER_TOKEN"
```

**Resposta esperada:** 
```json
{
  "statusCode": 403,
  "message": "User ... is not a member of workspace ..."
}
```

### 9. Adicionar membro ao workspace (RBAC - requer ADMIN ou OWNER)

```bash
# Use o token do primeiro usuário (OWNER) e o user.id do segundo usuário
curl -X POST http://localhost:3000/api/workspaces/WORKSPACE_ID/members \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer OWNER_TOKEN" \
  -d '{
    "userId": "SECOND_USER_ID",
    "role": "MEMBER"
  }'
```

**Resposta esperada:**
```json
{
  "id": "membership-uuid",
  "workspaceId": "workspace-uuid",
  "userId": "second-user-uuid",
  "role": "MEMBER",
  "joinedAt": "2025-02-04T..."
}
```

### 10. Tentar adicionar membro sem permissão (deve falhar)

```bash
# Usar token do segundo usuário (que é MEMBER, não ADMIN/OWNER)
curl -X POST http://localhost:3000/api/workspaces/WORKSPACE_ID/members \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer MEMBER_TOKEN" \
  -d '{
    "userId": "some-user-id",
    "role": "MEMBER"
  }'
```

**Resposta esperada:** 
```json
{
  "statusCode": 403,
  "message": "Required role: OWNER or ADMIN, but user has role: MEMBER"
}
```

### 11. Agora o segundo usuário pode acessar o workspace

```bash
# Usar token do segundo usuário (agora é MEMBER)
curl -X GET http://localhost:3000/api/workspaces/WORKSPACE_ID \
  -H "Authorization: Bearer MEMBER_TOKEN"
```

**Resposta esperada:** Workspace object (sucesso!)

## Testes com Script Automatizado

Crie um arquivo `test-api.sh` na raiz do projeto:

```bash
#!/bin/bash

API_URL="http://localhost:3000/api"

echo "=== 1. Health Check ==="
curl -s "$API_URL/health" | jq .

echo -e "\n=== 2. Register User 1 ==="
RESPONSE1=$(curl -s -X POST "$API_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"email":"test1@example.com","password":"password123","name":"Test User 1"}')
echo $RESPONSE1 | jq .

TOKEN1=$(echo $RESPONSE1 | jq -r '.accessToken')
USER1_ID=$(echo $RESPONSE1 | jq -r '.user.id')

echo -e "\n=== 3. Create Workspace ==="
WORKSPACE_RESPONSE=$(curl -s -X POST "$API_URL/workspaces" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN1" \
  -d '{"name":"Test Workspace"}')
echo $WORKSPACE_RESPONSE | jq .

WORKSPACE_ID=$(echo $WORKSPACE_RESPONSE | jq -r '.id')

echo -e "\n=== 4. Get Workspace ==="
curl -s -X GET "$API_URL/workspaces/$WORKSPACE_ID" \
  -H "Authorization: Bearer $TOKEN1" | jq .

echo -e "\n=== 5. Register User 2 ==="
RESPONSE2=$(curl -s -X POST "$API_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"email":"test2@example.com","password":"password123","name":"Test User 2"}')
echo $RESPONSE2 | jq .

TOKEN2=$(echo $RESPONSE2 | jq -r '.accessToken')
USER2_ID=$(echo $RESPONSE2 | jq -r '.user.id')

echo -e "\n=== 6. Try to access workspace as User 2 (should fail) ==="
curl -s -X GET "$API_URL/workspaces/$WORKSPACE_ID" \
  -H "Authorization: Bearer $TOKEN2" | jq .

echo -e "\n=== 7. Add User 2 as MEMBER ==="
curl -s -X POST "$API_URL/workspaces/$WORKSPACE_ID/members" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN1" \
  -d "{\"userId\":\"$USER2_ID\",\"role\":\"MEMBER\"}" | jq .

echo -e "\n=== 8. Now User 2 can access workspace ==="
curl -s -X GET "$API_URL/workspaces/$WORKSPACE_ID" \
  -H "Authorization: Bearer $TOKEN2" | jq .

echo -e "\n=== Tests completed! ==="
```

**Para executar:**
```bash
chmod +x test-api.sh
./test-api.sh
```

## Verificações no Banco de Dados

Você pode conectar ao Postgres para verificar os dados:

```bash
# Conectar ao banco
docker exec -it contractai-postgres psql -U contractai -d contractai

# Ver usuários
SELECT id, email, name, role, "isActive" FROM users;

# Ver workspaces
SELECT id, name, "createdAt" FROM workspaces;

# Ver membros do workspace com detalhes
SELECT 
  wm.id,
  w.name as workspace_name,
  u.email as user_email,
  wm.role,
  wm."joinedAt"
FROM workspace_members wm
JOIN workspaces w ON wm."workspaceId" = w.id
JOIN users u ON wm."userId" = u.id;

# Ver settings do workspace
SELECT ws.id, w.name as workspace_name, ws."defaultFileRetentionDays", ws."noLogsEnabled"
FROM workspace_settings ws
JOIN workspaces w ON ws."workspaceId" = w.id;
```

## Checklist de Testes

- [ ] Health check funciona
- [ ] Registro de usuário funciona e retorna token
- [ ] Login retorna token JWT válido
- [ ] Criar workspace funciona e cria OWNER automaticamente
- [ ] WorkspaceGuard bloqueia acesso sem autenticação (401)
- [ ] WorkspaceGuard bloqueia acesso de não-membros (403)
- [ ] RolesGuard bloqueia ações sem role suficiente (403)
- [ ] Adicionar membro funciona para OWNER/ADMIN
- [ ] Adicionar membro falha para MEMBER/VIEWER
- [ ] Após adicionar membro, novo membro pode acessar workspace
- [ ] Dados são persistidos corretamente no banco
- [ ] WorkspaceSettings são criados automaticamente

## Troubleshooting

### Erro: "Cannot connect to database"
- Verifique se o Postgres está rodando: `docker-compose ps`
- Verifique as variáveis de ambiente no `.env`
- Teste conexão: `docker exec -it contractai-postgres psql -U contractai -d contractai`

### Erro: "Migration failed"
- Verifique se o pgvector extension está habilitada:
  ```sql
  CREATE EXTENSION IF NOT EXISTS vector;
  ```

### Erro: "Port 3000 already in use"
- Mude a porta no `.env`: `PORT=3001`
- Ou pare o processo usando a porta 3000

### Token expirado
- Tokens têm validade de 7 dias por padrão
- Faça login novamente para obter novo token

## Testes de Document Parsers e Upload

Para testar upload de documentos com parser:

1. **Garantir que Docling e PDFPlumber estão rodando:**
   ```bash
   docker-compose up -d docling pdfplumber
   curl http://localhost:8000/health
   curl http://localhost:8001/health
   ```

2. **Iniciar o Worker** (processa parsing, chunking, embeddings):
   ```bash
   pnpm start:worker
   ```

3. **Criar documento e fazer upload via UI** ou API:
   - `POST /api/workspaces/:workspaceId/documents` — criar documento
   - `POST /api/workspaces/:workspaceId/documents/:docId/files` — upload com `file` + opcional `parser` (docling | pdfplumber | dpt2 | llamaparse | unstructured)

4. **Parser indisponível:** Se Docling/PDFPlumber não estiverem rodando, o job falhará e a UI exibirá a mensagem em "Failed Jobs" (ex.: "Docling service is unavailable. Start it with 'docker-compose up docling' or try a different parser.").

Ver [DOCUMENT-PARSERS.md](./DOCUMENT-PARSERS.md) para referência dos parsers.

## Testes E2E — Onboarding (Playwright)

O projeto inclui testes E2E Playwright para onboarding em `apps/web/e2e/src/onboarding.spec.ts`:

**Requisitos:** Usuário autenticado (projeto `chromium-authenticated`).

**Testes:**
- Account Settings exibe a seção "Help & Onboarding" com botões Reset e Start Tour
- Reset onboarding: clicar em Reset, confirmar no diálogo, verificar toast de sucesso
- Checklist reaparece após reset e reload da página
- Tour pode ser iniciado e percorrido

**Execução:**
```bash
# Com API e web rodando
pnpm e2e
# ou: pnpm --filter web e2e:run

# Com script que inicia API automaticamente
E2E_WITH_API=1 ./scripts/e2e.sh
```

**Data-testid** usados nos testes:
- `onboarding-help-card` — card Help & Onboarding em Account Settings
- `onboarding-reset-btn` — botão Reset Onboarding
- `onboarding-start-tour-btn` — botão Start Tour
- `onboarding-checklist` — checklist flutuante
- `tour-step-{id}` — etapas do tour (welcome, workspaces, etc.)

## Próximos Passos

Após validar estes testes, podemos prosseguir para:
- **Fase 4**: Upload e pipeline em fila
- **Fase 5**: RAG e citações
- **Fase 6**: Endpoints REST completos (Documents, Chat, Redline, etc.)
