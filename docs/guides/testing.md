# Guia de Testes — ContractAI Review MVP+

Este guia descreve como testar as funcionalidades da plataforma.

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
pnpm migration:run
# ou: cd apps/api && pnpm migration:run
```

### 4. Iniciar a API

```bash
pnpm start:api
# ou: cd apps/api && pnpm start:dev
```

A API estará disponível em `http://localhost:3000/api`

### 5. Iniciar Worker (para upload/parsing)

```bash
pnpm start:worker
```

## Testes Manuais com cURL

### Health Check

```bash
curl http://localhost:3000/api/health
```

**Resposta esperada:** `{"status":"ok"}`

### Registrar Usuário

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "name": "Test User"
  }'
```

Salve o `accessToken` e o `user.id` para os próximos testes.

### Login

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'
```

### Criar Workspace

```bash
curl -X POST http://localhost:3000/api/workspaces \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"name": "My First Workspace"}'
```

Salve o `workspace.id`.

### Buscar Workspace (verifica WorkspaceGuard)

```bash
curl -X GET http://localhost:3000/api/workspaces/WORKSPACE_ID \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Adicionar membro ao workspace

```bash
curl -X POST http://localhost:3000/api/workspaces/WORKSPACE_ID/members \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer OWNER_TOKEN" \
  -d '{"userId": "USER_ID", "role": "MEMBER"}'
```

## Testes de Document Parsers e Upload

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

4. **Parser indisponível:** Se Docling/PDFPlumber não estiverem rodando, o job falhará e a UI exibirá a mensagem em "Failed Jobs".

Ver [document-parsers](../architecture/document-parsers.md) para referência dos parsers.

## Testes E2E — Playwright

**Requisitos:** API rodando, `docker-compose up` (Postgres + Redis).

```bash
# Com API rodando em outro terminal
pnpm e2e

# Ou com script que inicia API automaticamente
E2E_WITH_API=1 ./scripts/e2e.sh
```

Testes E2E estão em `apps/web/e2e/` (auth, workspaces, documents, settings, onboarding).

## Checklist de Testes

- [ ] Health check funciona
- [ ] Registro de usuário e login retornam token JWT válido
- [ ] Criar workspace funciona e cria OWNER automaticamente
- [ ] WorkspaceGuard bloqueia acesso sem autenticação (401)
- [ ] WorkspaceGuard bloqueia acesso de não-membros (403)
- [ ] RolesGuard bloqueia ações sem role suficiente (403)
- [ ] Upload de documento com parser
- [ ] Chat com citações
- [ ] Export privacidade (DSAR-lite)
- [ ] Onboarding: checklist, tour, reset

## Troubleshooting

### Erro: "Cannot connect to database"
- Verifique se o Postgres está rodando: `docker-compose ps`
- Verifique as variáveis de ambiente no `.env`

### Erro: "Port 3000 already in use"
- Use `pnpm kill:port` ou mude a porta no `.env`: `PORT=3001`

### Token expirado
- Tokens têm validade de 7 dias por padrão. Faça login novamente.
