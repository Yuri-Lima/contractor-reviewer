# Setup Local - ContractAI Review MVP+

Guia de instalação e configuração para desenvolvimento local.

**Monorepo:** `apps/api` (NestJS + workers) | `apps/web` (Angular + Capacitor)

## Stack

- **Backend:** NestJS, TypeORM, Postgres + pgvector, BullMQ + Redis
- **Frontend:** Angular, Capacitor (web + iOS/Android)
- **Storage:** S3/R2 compatível (local em dev)
- **IA:** OpenAI (RAG + citações)
- **Parsers:** Docling e PDFPlumber (Python microservices), DPT-2/LlamaParse/Unstructured (APIs cloud)

## Pré-requisitos

- Node.js >= 18
- pnpm >= 9
- Docker e Docker Compose (para Postgres, Redis, Docling, PDFPlumber)

## Setup local

### 1. Instalar dependências (raiz do monorepo)

```bash
pnpm install
```

### 2. Configurar variáveis de ambiente

```bash
cp .env.example .env
```

Editar `.env` e preencher:

- `DATABASE_URL` — URL do Postgres (ex: `postgresql://contractai:contractai@localhost:5432/contractai`)
- `REDIS_URL` — URL do Redis (ex: `redis://localhost:6379`)
- `OPENAI_API_KEY` — Obrigatório para RAG (obter em https://platform.openai.com/api-keys)
- `JWT_SECRET` — Mínimo 32 caracteres (produção)
- `PARSER_KEYS_ENCRYPTION_KEY` — **Obrigatório se usar DPT-2, LlamaParse ou Unstructured**. Gerar com: `openssl rand -hex 32`

### 3. Subir serviços Docker

Na raiz do projeto:

```bash
docker-compose up -d
```

Isso sobe:

| Serviço     | Porta padrão | Uso                                   |
|-------------|--------------|----------------------------------------|
| postgres    | 5432         | Banco de dados + pgvector              |
| redis       | 6379         | BullMQ (filas de parsing, chunking, embeddings) |
| docling     | 8000         | Parser Python (PDF, DOCX, imagens)    |
| pdfplumber  | 8001         | Parser Python (PDF)                   |

Se Docling ou PDFPlumber não subir, a API continuará funcionando, mas o parsing falhará com mensagem amigável (ex: "Docling service is unavailable. Start it with docker-compose up docling").

### 4. Rodar migrações

```bash
pnpm migration:run
# ou: pnpm --filter api migration:run
```

### 5. Iniciar API e Worker

Em terminais separados:

```bash
# Terminal 1: API
pnpm start:api
# ou: pnpm --filter api start:dev

# Terminal 2: Worker (processamento de parsing, chunking, embeddings)
pnpm start:worker
```

A API escuta em http://localhost:3000/api.

### 6. Iniciar frontend

```bash
pnpm dev:web
# ou: pnpm --filter web start
```

Abre em http://localhost:4200.

## Variáveis de ambiente (referência completa)

| Variável | Obrigatório | Descrição |
|----------|-------------|-----------|
| `DATABASE_URL` | Sim | URL do Postgres (ex: `postgresql://user:pass@host:5432/db`) |
| `REDIS_URL` | Sim | URL do Redis (ex: `redis://localhost:6379`) |
| `JWT_SECRET` | Sim | Segredo para tokens JWT (mín. 32 caracteres em produção) |
| `OPENAI_API_KEY` | Sim* | Chave OpenAI para RAG (*obrigatório para chat/embeddings) |
| `PARSER_KEYS_ENCRYPTION_KEY` | Se usar parsers pagos | 32 bytes hex. Gerar: `openssl rand -hex 32`. Criptografa API keys de DPT-2, LlamaParse, Unstructured |
| `DOCLING_URL` | Não | URL do Docling (padrão: `http://localhost:8000`) |
| `PDFPLUMBER_URL` | Não | URL do PDFPlumber (padrão: `http://localhost:8001`) |
| `STORAGE_TYPE` | Não | `local` (dev) ou `s3` |
| `STORAGE_PATH` | Não | Caminho para storage local (padrão: `./storage`) |
| `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, etc. | Se S3 | Configuração S3/R2 |
| `VITE_API_URL` | Não | URL da API para o frontend (padrão: `http://localhost:3000`) |
| `SUPERADMIN_EMAIL`, `SUPERADMIN_PASSWORD` | Não | Credenciais do superadmin criado na inicialização |

## Estrutura do monorepo

```
.
├── apps/
│   ├── api/              # NestJS (API REST + workers BullMQ)
│   └── web/              # Angular + Capacitor
├── packages/
│   └── shared/           # Tipos, enums compartilhados
├── services/
│   ├── docling/         # Python microservice (FastAPI)
│   └── pdfplumber/      # Python microservice (FastAPI)
├── docker-compose.yml
├── .env.example
└── README.md
```

## Parsers de documentos

- **Docling** e **PDFPlumber** são serviços Python em Docker. Inicie com `docker-compose up -d`.
- **DPT-2, LlamaParse, Unstructured** são APIs cloud. Configure a API key em Workspace Settings > Document Parsers.
- Defina o parser padrão em Workspace Settings > Document Parsers.
- No upload, o usuário pode escolher outro parser via diálogo.

Ver [DOCUMENT-PARSERS.md](DOCUMENT-PARSERS.md) para detalhes.

## Fluxo de teste completo

1. Criar workspace
2. Criar documento
3. Upload de arquivo (escolher parser ou usar padrão)
4. Chat com citações
5. Gerar redline com playbook
6. Visualizar versões e diff
7. Export privacidade (DSAR-lite)
8. Verificar purge de retenção

## Troubleshooting

### Port already in use (EADDRINUSE)

**Option 1:** Encontrar e matar o processo:
```bash
lsof -i :3000   # ou :4200
kill -9 <PID>
```

**Option 2:** Script de conveniência (mata processos nas portas 3000 e 4200):
```bash
pnpm kill:port
# ou: ./scripts/kill-port.sh 3000 4200
```

### Parser "fetch failed" / service unavailable

Se o Docling ou PDFPlumber estiver parado, o parsing falhará. O usuário verá uma mensagem clara: *"Docling service is unavailable. Start it with 'docker-compose up docling' or try a different parser."*

**Solução:** Subir os serviços:

```bash
docker-compose up -d docling pdfplumber
# ou: docker-compose up -d
```

Verificar saúde:

```bash
curl http://localhost:8000/health   # Docling
curl http://localhost:8001/health  # PDFPlumber
```

### Migrations pendentes

```bash
pnpm migration:run
```

### Configurações do workspace

Acesse **Settings** no sidebar do workspace para:

- **Retention:** dias de retenção de arquivos e textos/embeddings
- **Document Processing:** estratégia de chunking (paragraph, sentence, fixed_size)
- **Document Parsers:** parser padrão e API keys (DPT-2, LlamaParse, Unstructured)
- **AI Prompts:** override de prompts de chat e redline por workspace
