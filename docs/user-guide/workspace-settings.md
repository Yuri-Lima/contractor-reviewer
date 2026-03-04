# Workspace Settings

## Summary

Workspace Settings let you configure retention (how long files and indexed content are kept), document processing (chunking strategy), parsers (which tools extract text from files), voice (speech-to-text and text-to-speech), and AI prompts. Only OWNER and ADMIN can change most of these settings.

## When to Use

- You want to control how long documents and their data are retained
- You need to add API keys for parsers or voice services
- You want to customize AI behavior with workspace-level prompts
- You need to choose a default parser for uploads

## Prerequisites

- You must be OWNER or ADMIN in the workspace to edit settings.
- Some settings (e.g., API keys) may require OWNER role depending on configuration.

## Steps

### Open Workspace Settings

1. Open the workspace.
2. Go to **Workspace Settings** (from the sidebar, workspace menu, or settings icon).
3. Use the tabs to navigate: General, Retention, Document Processing, Parsers, Voice, Prompts.

### Configure Retention

1. Go to the **Retention** tab.
2. **File Retention**: Set the number of days (1–365) after which uploaded files (PDF, DOCX, etc.) are permanently deleted. A daily purge job applies this.
3. **Text and Embeddings Retention**: Set the number of days (1–730) after which extracted text and RAG embeddings are deleted. This affects search and chat.
4. **Fuzzy Match Threshold**: Set a percentage (0–100) for how closely contract text must match when applying redlines. Higher = stricter match.
5. Click **Save Settings**.

*Important*: Deletions are permanent. Retention is calculated from the file/document creation date. The purge runs daily.

### Configure Document Processing (Chunking)

1. Go to the **Document Processing** tab.
2. Choose a **Chunking Strategy**: Paragraph, Sentence, or Fixed Size. This controls how documents are split for RAG (retrieval and chat).
3. Click **Save**.

### Configure Parsers

1. Go to the **Parsers** tab.
2. Select the **Default parser** used when uploading files if none is chosen (e.g., Docling, PDFPlumber, LlamaParse, Unstructured).
3. Add **API Keys** for parsers that require them (e.g., LlamaParse, Unstructured). Keys are stored securely and masked when displayed.
4. Save. Parsers without keys may be unavailable.

### Configure Voice

1. Go to the **Voice** tab.
2. **Chat response mode**: Choose how assistant responses are shown (Text only, Audio only, or Audio and text).
3. **Transcription provider**: Choose the service for converting speech to text (e.g., Hugging Face Whisper, OpenAI Whisper).
4. Add **API Keys** for the chosen provider if required.
5. Save.

### Configure Prompts

1. Go to the **Prompts** tab.
2. Toggles: **Include global prompts** and **Include workspace prompts** — control whether the global system prompt (Account Settings) and this workspace system prompt are merged into the AI context.
3. Edit the **Workspace system prompt** (`workspace.system`). This single prompt applies to all documents in this workspace and is merged below the global prompt.
4. Save.

**Prompt hierarchy:** Global system prompt (`global.system`) → Workspace system prompt (`workspace.system`) → Document prompts (7 keys: chat, redline, playbooks). Document prompts live only in Document Settings.

## Options / Variations

- **General tab**: Placeholder for workspace name and other general options.
- **Chunking strategies**: Paragraph and Sentence are semantic; Fixed Size splits by character count. Semantic and Agentic may be coming soon.
- **Self-hosted parsers** (e.g., Docling, PDFPlumber): Do not need API keys; they run locally or in your infrastructure.

## Related Topics

- [Workspaces](workspaces.md) — Create and manage workspaces
- [Documents](documents.md) — Document creation and parsers
- [Privacy](privacy.md) — No-logs and DSAR export (per workspace)
- [Account Settings](account-settings.md) — Profile and chat preferences
