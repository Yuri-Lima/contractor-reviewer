# ContractAI Review MVP+

> **Assistente jurídico baseado em provas** — Análise inteligente de contratos com citações de fontes legais

ContractAI Review é uma plataforma completa para análise e revisão de contratos jurídicos, utilizando inteligência artificial para fornecer respostas baseadas em evidências extraídas dos próprios documentos e de fontes legais oficiais.

## O que é ContractAI Review?

ContractAI Review é um **assistente jurídico baseado em evidências** (não apenas um chatbot). A plataforma permite que equipes jurídicas:

- **Façam upload de contratos** em múltiplos formatos (PDF, DOCX, TXT, imagens)
- **Façam perguntas** sobre os contratos e recebam respostas com **citações precisas** dos documentos
- **Gerem redlines** (sugestões de alteração) com diferentes estratégias (equilibrada, conservadora, favorável ao cliente)
- **Acompanhem versões** de documentos com visualização de diferenças
- **Colaborem** em workspaces multi-tenant com controle de acesso baseado em roles

A plataforma utiliza **RAG (Retrieval-Augmented Generation)** para garantir que todas as respostas sejam fundamentadas em evidências extraídas dos contratos e de fontes legais oficiais por país/jurisdição.

## Principais Funcionalidades

### 📄 Gestão de Documentos
- Upload e visualização de contratos (PDF, DOCX, TXT, PNG, JPG)
- **OCR automático** para PDFs escaneados usando Tesseract.js
- Processamento assíncrono com filas (parsing, OCR, chunking, embeddings)
- Visualização de documentos com suporte a PDF, imagens e texto

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
- **Página de configurações** com abas: General, Retention, Document Processing
- **Retenção de dados**: políticas configuráveis por workspace
  - Retenção padrão: arquivos (30 dias), textos/embeddings (90 dias)
  - Purge automático via job agendado (diário)
  - Hard delete completo de documentos e dados associados
- **Estratégia de chunking**: configurável (paragraph, sentence, fixed_size)
  - Define como o texto é dividido para RAG; paragraph-based recomendado para contratos

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

## Como Funciona

### 1. Upload e Processamento
```
Upload de Contrato
  ↓
Validação (tamanho, tipo, malware scan)
  ↓
Parsing (extração de texto) ou OCR (se PDF escaneado)
  ↓
Chunking (divisão em partes menores; estratégia configurável por workspace)
  ↓
Geração de Embeddings (vetores para busca semântica)
  ↓
Documento Disponível para Consulta
```

**Chunking strategies** (configurável em Workspace Settings > Document Processing):
- **Paragraph-based** (recomendado): preserva limites de parágrafos/cláusulas
- **Sentence-based**: divide por sentenças
- **Fixed-size**: divisão por tamanho fixo de caracteres
- *Semantic e Agentic*: planejado para versões futuras

### 2. Chat com RAG
```
Pergunta do Usuário
  ↓
Geração de Embedding da Pergunta
  ↓
Busca Similaridade (top-k chunks do contrato + fontes legais)
  ↓
Montagem de Contexto com Citações
  ↓
Geração de Resposta (OpenAI) com Citações
  ↓
Resposta com Confiança e Evidências
```

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
├── docker-compose.yml
└── pnpm-workspace.yaml
```

### Backend (`apps/api`)
- **Framework**: NestJS
- **ORM**: TypeORM
- **Database**: PostgreSQL + pgvector (para busca vetorial)
- **Queue**: BullMQ + Redis (processamento assíncrono)
- **Storage**: Interface S3/R2 compatível (implementação local para dev)
- **Workers**: Processamento de OCR, parsing, chunking, embeddings

### Frontend (`apps/web`)
- **Framework**: Angular (última LTS)
- **Mobile**: Capacitor (iOS/Android)
- **UI Components**: PrimeNG
- **i18n**: ngx-translate (EN, ES, PT-BR, DE)

### AI/ML
- **Embeddings**: OpenAI `text-embedding-3-small` (1536 dimensões)
- **Chat**: OpenAI Responses API
- **OCR**: Tesseract.js (para PDFs escaneados)

## Quick Start

Para começar a usar o ContractAI Review localmente, consulte o guia completo de instalação em [SETUP.md](SETUP.md).

**Resumo rápido:**
1. Instalar dependências: `pnpm install`
2. Configurar `.env` a partir de `.env.example`
3. Subir Postgres e Redis: `docker-compose up -d`
4. Rodar migrações: `pnpm --filter api migration:run`
5. Iniciar API: `pnpm --filter api start:dev`
6. Iniciar Worker: `pnpm --filter api start:worker`
7. Iniciar Web: `pnpm --filter web start`

### Testes E2E (Playwright)

Pré-requisitos: API rodando, `docker-compose up` (Postgres + Redis).

```bash
# Com API rodando em outro terminal
pnpm e2e

# Ou com script que inicia API automaticamente
E2E_WITH_API=1 ./scripts/e2e.sh
```

Ver [apps/web/e2e/](apps/web/e2e/) para estrutura dos testes.

## Stack Tecnológica

### Backend
- **NestJS** - Framework Node.js
- **TypeORM** - ORM para PostgreSQL
- **PostgreSQL** - Banco de dados relacional
- **pgvector** - Extensão para busca vetorial
- **BullMQ** - Sistema de filas
- **Redis** - Cache e broker de mensagens
- **Tesseract.js** - OCR para PDFs escaneados
- **pdf-parse** - Parsing de PDFs
- **pdf2pic** - Conversão PDF para imagens

### Frontend
- **Angular** - Framework web
- **Capacitor** - Runtime para mobile (iOS/Android)
- **PrimeNG** - Componentes UI
- **Tailwind CSS** - Estilização
- **RxJS** - Programação reativa

### AI/ML
- **OpenAI API** - Embeddings e geração de texto
- **Tesseract.js** - OCR

### Infraestrutura
- **Docker Compose** - Orquestração local (Postgres, Redis)
- **S3/R2** - Armazenamento de arquivos (compatível)

## Status do Projeto

**MVP+** - Funcionalidades principais implementadas e funcionais:

- ✅ Multi-tenant com workspaces e RBAC
- ✅ Upload e processamento de documentos
- ✅ Chat com RAG e citações
- ✅ Geração de redlines com playbooks
- ✅ Versionamento de documentos
- ✅ OCR para PDFs escaneados
- ✅ Painel de privacidade e export DSAR-lite
- ✅ Políticas de retenção e purge automático
- ✅ Trilha de auditoria completa
- ✅ Página de Workspace Settings (Retention, Document Processing, chunking strategy)
- ✅ Suporte multilíngue

## Documentação

- **[SETUP.md](SETUP.md)** - Guia completo de instalação e configuração local
- **[planejamento-execucao-contractai.md](planejamento-execucao-contractai.md)** - Planejamento detalhado das fases de implementação

## Licença

[Adicionar informação de licença se aplicável]

## Contribuindo

[Adicionar diretrizes de contribuição se aplicável]
