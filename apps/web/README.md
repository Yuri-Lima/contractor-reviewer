# ContractAI Review — Frontend (Angular + Capacitor)

Frontend web e mobile do ContractAI Review, construído com Angular e Capacitor.

## Pré-requisitos

- Node.js >= 18
- pnpm >= 9.0.0
- Angular CLI (instalado globalmente ou via pnpm)

## Instalação

```bash
# Na raiz do monorepo
pnpm install

# Ou apenas para o frontend
cd apps/web
pnpm install
```

**Nota:** O projeto usa PrimeNG e Tailwind CSS. Após instalar, certifique-se de que os estilos do PrimeNG estão sendo carregados corretamente.

## Desenvolvimento

```bash
# Iniciar servidor de desenvolvimento
pnpm start
# ou
pnpm dev

# A aplicação estará disponível em http://localhost:4200
```

## Build

```bash
# Build de produção
pnpm build:prod

# Build de desenvolvimento
pnpm build
```

## Capacitor (Mobile)

### Quick Start

For a quick setup guide, see **[docs/guides/mobile/quick-start.md](../../docs/guides/mobile/quick-start.md)**

For comprehensive mobile development documentation, see **[docs/guides/mobile/development.md](../../docs/guides/mobile/development.md)**

### Initial Setup

**Step 1: Install Prerequisites** (if needed)

```bash
# Automated installation helper
./scripts/install-prerequisites.sh --all

# Or install individually
./scripts/install-prerequisites.sh --ios
./scripts/install-prerequisites.sh --android
```

**Step 2: Setup Platforms**

```bash
# Setup both platforms
./scripts/setup-mobile.sh --all

# Or specific platform
./scripts/setup-mobile.sh --ios
./scripts/setup-mobile.sh --android

# Continue even if prerequisites are missing
./scripts/setup-mobile.sh --all --force
```

**Quick Guide**: See [QUICK-START-MOBILE.md](./QUICK-START-MOBILE.md) for detailed instructions.

### Development Workflow

Use the helper script for automated workflow:

```bash
# iOS with live reload
./scripts/mobile-dev.sh --ios --local-ip

# Android with live reload
./scripts/mobile-dev.sh --android --local-ip
```

### Manual Commands

```bash
# Build and sync
pnpm cap:build:sync

# Sync only (faster)
pnpm cap:copy

# Open in IDE
pnpm cap:open:ios
pnpm cap:open:android

# Check setup
pnpm cap:doctor
```

## Estrutura do Projeto

```
src/
├── app/
│   ├── auth/              # Componentes de autenticação
│   ├── core/              # Serviços, guards, interceptors, modelos
│   ├── documents/         # Componentes de documentos
│   ├── layout/            # Header, Sidebar
│   ├── onboarding/       # Tour (Shepherd.js), checklist, info icons, reset
│   ├── privacy/           # Privacy panel
│   ├── audit/             # Audit logs
│   ├── workspaces/        # Workspaces, workspace-members, settings
│   │   └── settings/      # Workspace Settings (General, Retention, Document Processing, Document Parsers, AI Prompts)
│   ├── app.component.ts   # Componente raiz
│   └── app.routes.ts      # Rotas
├── assets/                # Assets estáticos
├── environments/          # Configurações de ambiente
└── styles.scss            # Estilos globais (PrimeNG + Tailwind)
```

## UI Libraries

### PrimeNG
- **Componentes:** Button, Card, InputText, Password, ConfirmDialog, Toast, Message, Avatar
- **Ícones:** PrimeIcons (`pi pi-*`)
- **Tema:** Lara Light Blue (configurado em `styles.scss`)

### Tailwind CSS
- **Configuração:** `tailwind.config.js`
- **Uso:** Classes utilitárias do Tailwind em todos os componentes
- **PostCSS:** Configurado em `postcss.config.js`

### Exemplo de Uso

```typescript
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';

@Component({
  imports: [ButtonModule, CardModule],
  template: `
    <p-card>
      <p-button label="Click" icon="pi pi-check"></p-button>
    </p-card>
  `,
})
```

```html
<!-- Tailwind classes -->
<div class="flex items-center gap-4 p-4 bg-white rounded-lg shadow-md">
  <i class="pi pi-user text-primary"></i>
  <span class="text-gray-700">User Name</span>
</div>
```

## Variáveis de Ambiente

Crie um arquivo `.env` na raiz do projeto ou configure:

- `NG_APP_API_URL`: URL da API backend (padrão: `http://localhost:3000/api`)

## Funcionalidades

- ✅ Autenticação (Login/Register)
- ✅ Workspace switcher
- ✅ Listagem de documentos
- ✅ Upload de arquivos com **seleção de parser** (Docling, PDFPlumber, DPT-2, LlamaParse, Unstructured)
- ✅ **Failed Jobs** — bloco no document view exibindo jobs falhos com `lastError` (mensagem amigável para o usuário)
- ✅ Chat com citações
- ✅ Privacy panel (DSAR export, no-logs toggle)
- ✅ Audit logs
- ✅ Workspace Settings:
  - **Retention** — política de retenção (arquivos, textos/embeddings)
  - **Document Processing** — chunking strategy (paragraph, sentence, fixed_size)
  - **Document Parsers** — parser padrão + API keys (DPT-2, LlamaParse, Unstructured)
  - **AI Prompts** — override de prompts de chat e redline por workspace
- ✅ Viewer de PDF
- ✅ Redline e versões (diff side-by-side)
- ✅ Progresso de jobs (parsing, chunking, embeddings)
- ✅ Suporte multilíngue (EN, ES, PT-BR, DE)
- ✅ **Onboarding** — tour guiado (Shepherd.js), checklist flutuante, ícones de ajuda (confidence, citações), reset em Account Settings

## Integração com API

O frontend consome a API REST em `http://localhost:3000/api` (configurável via `VITE_API_URL` ou `NG_APP_API_URL`).

Endpoints principais:
- `/api/auth/login` — Login
- `/api/auth/register` — Registro
- `/api/workspaces` — Workspaces
- `/api/workspaces/:id/documents` — Documentos
- `/api/workspaces/:id/documents/:docId/files` — Upload de arquivos (body: `file`, `parser` opcional)
- `/api/workspaces/:id/documents/:docId/chat` — Chat com RAG
- `/api/workspaces/:id/documents/:docId/redline` — Geração de redline (playbook)
- `/api/workspaces/:id/document-parsers` — Lista parsers disponíveis (`ParserInfo[]`)
- `/api/workspaces/:id/settings` — Configurações (retention, documentProcessing, prompts)
- `/api/workspaces/:id/privacy/export` — Export de privacidade
- `/api/workspaces/:id/audit` — Audit logs
- `/api/onboarding` — Estado de onboarding (GET, PATCH checklist, PATCH tour, POST complete/dismiss/reset)

## Parsers de Documentos

No upload, o usuário pode abrir o diálogo de seleção de parser e escolher Docling, PDFPlumber, DPT-2, LlamaParse ou Unstructured. Parsers que exigem API key mas não a possuem configurada aparecem desabilitados.

Configuração de parser padrão e API keys: **Workspace Settings > Document Parsers**.

Ver [DOCUMENT-PARSERS.md](../../DOCUMENT-PARSERS.md) no root do monorepo para referência completa.

## Próximos Passos

1. Melhorar responsividade mobile
2. Adicionar testes unitários e E2E
