# ContractAI Review MVP+

> **Assistente jurídico baseado em provas** — Análise inteligente de contratos com citações de fontes legais

ContractAI Review é uma plataforma completa para análise e revisão de contratos jurídicos, utilizando inteligência artificial para fornecer respostas baseadas em evidências extraídas dos próprios documentos e de fontes legais oficiais.

## O que é ContractAI Review?

ContractAI Review é um **assistente jurídico baseado em evidências** (não apenas um chatbot). A plataforma permite que equipes jurídicas:

- **Façam upload de contratos** em múltiplos formatos (PDF, DOC, DOCX, TXT, imagens)
- **Façam perguntas** sobre os contratos e recebam respostas com **citações precisas** dos documentos
- **Gerem redlines** (sugestões de alteração) com diferentes estratégias (equilibrada, conservadora, favorável ao cliente)
- **Acompanhem versões** de documentos com visualização de diferenças
- **Colaborem** em workspaces multi-tenant com controle de acesso baseado em roles

A plataforma utiliza **RAG (Retrieval-Augmented Generation)** para garantir que todas as respostas sejam fundamentadas em evidências extraídas dos contratos e de fontes legais oficiais por país/jurisdição.

## Principais Funcionalidades

### 📄 Gestão de Documentos
- Upload e visualização de contratos (PDF, DOC, DOCX, TXT, PNG, JPG)
- **Parsers de documentos opcionais** — escolha o parser no upload ou configure o padrão no workspace:
  - **Docling** (IBM) — self-hosted, sem API key. PDF, DOC, DOCX, imagens. Suporta OCR interno.
  - **PDFPlumber** — self-hosted, PDF apenas. Abordagem clássica.
  - **DPT-2 (LandingAI)** — Document Pre-trained Transformer. Requer API key. Alta qualidade.
  - **LlamaParse** (LlamaIndex) — Requer API key. PDF, DOCX.
  - **Unstructured.io** — Requer API key. Muitos formatos.
- Processamento assíncrono com filas (parsing, chunking, embeddings)
- Visualização de documentos com suporte a PDF, imagens e texto
- Mensagens amigáveis quando o parser está indisponível (ex.: "Docling service is unavailable. Start it with docker-compose up docling")

### 🤖 Chat Jurídico com RAG
- Perguntas sobre contratos com respostas baseadas em evidências
- **Citações automáticas** indicando exatamente onde a informação foi encontrada (arquivo, página, parágrafo)
- Integração com fontes legais oficiais por país/jurisdição
- Níveis de confiança (high, medium, low) para cada resposta
- Respostas "NOT FOUND" quando não há evidência suficiente

### ✏️ Redlines Inteligentes
- Geração automática de sugestões de alteração contratual
- **Playbooks configuráveis**:
  - **Balanced**: Equilibrado entre partes
  - **Conservative**: Minimiza mudanças, linguagem neutra
  - **Client-friendly**: Mais favorável ao cliente
- Visualização side-by-side de diferenças
- Aceitar/rejeitar mudanças granularmente por bloco
- Histórico completo de versões

### 👥 Multi-tenant e RBAC
- **Workspaces** para isolamento completo de dados entre equipes/clientes
- **Controle de acesso baseado em roles**:
  - **OWNER**: Controle total (billing, deletar workspace, configurações de retenção)
  - **ADMIN**: Gerenciar membros, ver tudo, deletar documentos
  - **MEMBER**: Upload, chat, redline, download próprios + documentos compartilhados
  - **VIEWER**: Apenas visualização/download (sem redline)
- Isolamento estrito: todos os recursos filtrados por workspace

### 🔒 Privacidade e Conformidade
- **Painel de Privacidade** por workspace e por usuário
- **Export DSAR-lite**: Download de dados pessoais em JSON/ZIP
  - Mensagens de chat
  - Metadados de versões
  - Prompts de redline (sem conteúdo do contrato se no-logs)
- **Modo no-logs**: Opção para não persistir conteúdos sensíveis
- Transparência sobre o que é armazenado e por quanto tempo

### ⚙️ Workspace Settings
- **Página de configurações** com abas: General, Retention, Document Processing, Document Parsers, AI Prompts
- **Retenção de dados**: políticas configuráveis por workspace
  - Retenção padrão: arquivos (30 dias), textos/embeddings (90 dias)
  - Purge automático via job agendado (diário)
  - Hard delete completo de documentos e dados associados
- **Estratégia de chunking**: configurável (paragraph, sentence, fixed_size)
  - Define como o texto é dividido para RAG; paragraph-based recomendado para contratos
- **Document Parsers**: parser padrão + API keys por workspace (DPT-2, LlamaParse, Unstructured)
  - API keys criptografadas com AES-256-GCM
- **AI Prompts**: override de prompts de chat/redline por workspace (DB-backed, runtime tuning)

### 📊 Auditoria Completa
- Trilha de auditoria para todas as ações importantes:
  - Visualização/download de documentos
  - Queries de chat
  - Geração de redlines
  - Deletar documentos
  - Export de dados de privacidade
- Logs incluem: usuário, ação, tipo de alvo, IP, user agent, metadados seguros
- Interface para filtrar logs por ação/usuário/data

### 🌍 Multilíngue
- Suporte a múltiplos idiomas (EN, ES, PT-BR, DE)
- Detecção automática do idioma do contrato e do usuário
- Respostas no idioma do usuário
- Redlines no idioma original do contrato
- Citações legais mantêm idioma original + explicação traduzida

### 🔍 Resolução de Jurisdição
- Detecção automática da jurisdição aplicável ao contrato
- Busca em fontes legais específicas por país/jurisdição
- Status: explicit (encontrado no contrato), inferred (inferido), unknown (solicita ao usuário)

### 🎯 Onboarding (SaaS)
- **Tour guiado** (Shepherd.js): tour principal mostrando workspaces, documentos, chat, redline e configurações
- **Checklist de primeiros passos**: criar workspace, upload, primeira revisão, redline, export
- **Auto-tracking**: checklist atualizada automaticamente ao completar cada tarefa
- **Ícones de ajuda**: tooltips e painéis "Learn more" para conceitos (ex.: confidence score, citações)
- **Reset**: reiniciar onboarding a qualquer momento em Account Settings > Help & Onboarding

## Como Funciona

### 1. Upload e Processamento
```
Upload de Contrato (usuário escolhe parser ou usa padrão)
  ↓
Validação (tamanho, tipo, malware scan)
  ↓
Parsing (Docling, PDFPlumber, DPT-2, LlamaParse ou Unstructured — extração para markdown)
  ↓
Chunking (divisão em partes menores; estratégia configurável por workspace)
  ↓
Geração de Embeddings (vetores para busca semântica)
  ↓
Documento Disponível para Consulta
```

**Parsers** (configurável em Workspace Settings > Document Parsers):
- **Docling** (default): self-hosted, suporta PDF escaneados com OCR interno
- **PDFPlumber**: self-hosted, PDF apenas
- **DPT-2, LlamaParse, Unstructured**: cloud, exigem API key no workspace

**Chunking strategies** (configurável em Workspace Settings > Document Processing):
- **Paragraph-based** (recomendado): preserva limites de parágrafos/cláusulas
- **Sentence-based**: divide por sentenças
- **Fixed-size**: divisão por tamanho fixo de caracteres
- *Semantic e Agentic*: planejado para versões futuras

### 2. Chat com RAG
```
Pergunta do Usuário
  ↓
Cache Semântico? (forceFresh=false) → Se similar ≥ threshold: retorna cached (fromCache: true)
  ↓ (senão)
Geração de Embedding da Pergunta
  ↓
Busca Similaridade (top-k chunks do contrato + fontes legais)
  ↓
Montagem de Contexto com Citações
  ↓
Geração de Resposta (OpenAI) com Citações
  ↓
Armazena em Cache (Redis) → Resposta com Confiança e Evidências (fromCache: false)
```

**Cache semântico**: respostas similares são cacheadas em Redis (TTL 24h). Usuário vê indicador "cached" e pode forçar resposta nova com "Get fresh response". Ver [docs/architecture/rag-cache.md](docs/architecture/rag-cache.md).

### 3. Geração de Redlines
```
Solicitação de Redline + Playbook
  ↓
Análise do Contrato com IA
  ↓
Geração de Sugestões de Alteração
  ↓
Visualização Side-by-Side
  ↓
Aceitar/Rejeitar Mudanças
  ↓
Nova Versão Criada
```

## Arquitetura

### Monorepo Structure
```
contractor-reviwer/
├── apps/
│   ├── api/          # NestJS (API REST + Workers BullMQ)
│   └── web/          # Angular SPA + Capacitor (web/iOS/Android)
├── packages/
│   └── shared/       # Tipos, enums, interfaces compartilhados
├── services/
│   ├── docling/      # Python microservice (PDF, DOCX, imagens → markdown)
│   └── pdfplumber/   # Python microservice (PDF → markdown)
├── docker-compose.yml
└── pnpm-workspace.yaml
```

### Backend (`apps/api`)
- **Framework**: NestJS
- **ORM**: TypeORM
- **Database**: PostgreSQL + pgvector (para busca vetorial)
- **Queue**: BullMQ + Redis (processamento assíncrono)
- **Storage**: Interface S3/R2 compatível (implementação local para dev)
- **Workers**: Parsing (via adapters), chunking, embeddings
- **Parsers**: Adapters para Docling, PDFPlumber, DPT-2, LlamaParse, Unstructured (factory + API keys criptografadas)

### Frontend (`apps/web`)
- **Framework**: Angular 21
- **Mobile**: Capacitor (iOS/Android)
- **UI Components**: PrimeNG
- **i18n**: ngx-translate (EN, ES, PT-BR, DE)
- **Onboarding**: Shepherd.js (tour guiado)

### AI/ML
- **Embeddings**: OpenAI `text-embedding-3-small` (1536 dimensões)
- **Chat**: OpenAI Responses API
- **Prompts**: DB-backed, configuráveis por workspace (chat, redline, playbooks)

## Quick Start

Para começar a usar o ContractAI Review localmente, consulte o guia completo de instalação em [docs/guides/setup.md](docs/guides/setup.md).

**Resumo rápido:**
1. Instalar dependências: `pnpm install`
2. Configurar `.env` a partir de `.env.example` (inclui `OPENAI_API_KEY`, `PARSER_KEYS_ENCRYPTION_KEY` se usar parsers pagos)
3. Subir serviços: `docker-compose up -d` (Postgres, Redis, Docling, PDFPlumber)
4. Rodar migrações: `pnpm migration:run`
5. Iniciar API: `pnpm start:api` ou `pnpm dev:api` (modo watch)
6. Iniciar Worker: `pnpm start:worker`
7. Iniciar Web: `pnpm dev:web`

### Testes E2E (Playwright)

Pré-requisitos: API rodando, `docker-compose up` (Postgres + Redis).

```bash
# Com API rodando em outro terminal
pnpm e2e

# Ou com script que inicia API automaticamente
E2E_WITH_API=1 ./scripts/e2e.sh
```

Ver [docs/guides/testing.md](docs/guides/testing.md) para guia completo e [apps/web/e2e/](apps/web/e2e/) para estrutura dos testes (auth, workspaces, documents, settings, onboarding).

### Nx Commands

O monorepo usa [Nx](https://nx.dev) para cache de tarefas e execução eficiente:

| Comando | Descrição |
|---------|-----------|
| `pnpm build` | Build de shared, api e web (com ordem de dependências) |
| `nx run-many -t build -p shared,api,web` | Mesmo que acima |
| `nx affected -t build` | Build apenas dos projetos afetados pelas mudanças |
| `nx graph` | Visualiza grafo de dependências e tarefas |

Para **Nx Cloud** (cache remoto e distribuição de tarefas em CI), execute `npx nx connect` e siga as instruções em [cloud.nx.app](https://cloud.nx.app).

## Stack Tecnológica

### Backend
- **NestJS** - Framework Node.js
- **TypeORM** - ORM para PostgreSQL
- **PostgreSQL** - Banco de dados relacional
- **pgvector** - Extensão para busca vetorial
- **BullMQ** - Sistema de filas
- **Redis** - Cache e broker de mensagens
- **Docling** (Python/FastAPI) - Parser self-hosted para PDF, DOCX, imagens
- **PDFPlumber** (Python/FastAPI) - Parser self-hosted para PDF
- **LandingAI DPT-2** - API cloud para parsing de alta qualidade (requer API key)

### Frontend
- **Angular** - Framework web
- **Capacitor** - Runtime para mobile (iOS/Android)
- **PrimeNG** - Componentes UI
- **Tailwind CSS** - Estilização
- **RxJS** - Programação reativa

### AI/ML
- **OpenAI API** - Embeddings e geração de texto (RAG)
- **Prompts DB-backed** - Prompts de chat/redline configuráveis por workspace

### Infraestrutura
- **Nx** - Build system e cache de tarefas para o monorepo
- **Docker Compose** - Orquestração local (Postgres, Redis, Docling, PDFPlumber)
- **S3/R2** - Armazenamento de arquivos (compatível)

## Status do Projeto

**MVP+** - Funcionalidades principais implementadas e funcionais:

- ✅ Multi-tenant com workspaces e RBAC
- ✅ Upload e processamento de documentos
- ✅ Chat com RAG e citações
- ✅ Geração de redlines com playbooks
- ✅ Versionamento de documentos
- ✅ Parsers opcionais (Docling, PDFPlumber, DPT-2, LlamaParse, Unstructured) com suporte a PDFs escaneados
- ✅ Painel de privacidade e export DSAR-lite
- ✅ Políticas de retenção e purge automático
- ✅ Trilha de auditoria completa
- ✅ Página de Workspace Settings (Retention, Document Processing, Document Parsers, AI Prompts)
- ✅ Suporte multilíngue
- ✅ Onboarding (tour guiado, checklist, info icons, reset em Account Settings)

## Documentação

Documentação organizada em `docs/`:

### Arquitetura (`docs/architecture/`)
- **[overview.md](docs/architecture/overview.md)** — Visão geral do sistema, stack, diagrama de serviços
- **[deployment.md](docs/architecture/deployment.md)** — Deploy em produção com Docker Compose
- **[rag-pipeline.md](docs/architecture/rag-pipeline.md)** — Referência do pipeline RAG (arquivos, fluxo, tipos)
- **[vector-db-separation.md](docs/architecture/vector-db-separation.md)** — Migração futura para vector DB separado
- **[storage.md](docs/architecture/storage.md)** — Armazenamento S3/local, validações
- **[workspace-rbac.md](docs/architecture/workspace-rbac.md)** — Multi-tenant, RBAC
- **[document-parsers.md](docs/architecture/document-parsers.md)** — Referência dos parsers (Docling, PDFPlumber, DPT-2, etc.)

### Guias (`docs/guides/`)
- **[setup.md](docs/guides/setup.md)** — Instalação e configuração local
- **[testing.md](docs/guides/testing.md)** — Testes manuais e E2E (Playwright, onboarding)
- **[mobile/quick-start.md](docs/guides/mobile/quick-start.md)** — Quick start para desenvolvimento mobile
- **[mobile/development.md](docs/guides/mobile/development.md)** — Guia completo de desenvolvimento mobile

### Arquivo histórico
- **[docs/archive/phases/](docs/archive/phases/)** — Fases de implementação e testes históricos

## Licença

[Adicionar informação de licença se aplicável]

## Contribuindo

[Adicionar diretrizes de contribuição se aplicável]
