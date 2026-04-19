# Getting Started

## Summary

This topic covers the first-time setup for ContractAI Review: creating an account, your first workspace, your first document, and uploading your first file. After completing these steps, you can start asking questions about contracts and generating redline suggestions.

## When to Use

- You are new to ContractAI Review
- You want to understand the basic flow: workspace → document → file → chat/redline

## Prerequisites

- A web browser (Chrome, Firefox, Safari, or Edge recommended)
- For voice input: microphone access and a modern browser that supports the Web Speech API

## Steps

### 1. Register or Log In

1. Open the ContractAI Review app in your browser.
2. If you do not have an account, click **Register** and provide your email and password.
3. If you already have an account, click **Login** and enter your credentials.
4. After logging in, you are taken to the Workspaces list.

### 2. Create Your First Workspace

1. On the Workspaces page, click **Create workspace** (or the plus icon).
2. Enter a name for your workspace (e.g., "Acme Corp Contracts").
3. Click **Create** (or equivalent button).
4. The new workspace appears in the list. Click it to open it.

*Tip:* A workspace groups documents and team members. You can create multiple workspaces for different clients or projects.

### 3. Create Your First Document

1. Inside the workspace, you will see a list of documents (or an empty state).
2. Click **Create Document** (or the create button).
3. Enter a **title** for the document (e.g., "NDA - Partner X").
4. Optionally add a **description** to help the AI understand the context.
5. Optionally click **Generate AI prompt** to have the AI create document-specific instructions from the title and description.
6. Click **Create** to create the document.
7. The document opens in the document view.

### 4. Upload Your First File

1. With the document open, go to the **Files** tab (or the upload area).
2. Click **Upload File** or **Upload Files**.
3. Select one or more files from your computer. Supported formats include:
   - **PDF** — contracts, agreements, scanned documents
   - **DOC, DOCX** — Microsoft Word documents
   - **PPTX, XLSX** — PowerPoint and Excel
   - **TXT, MD** — plain text and Markdown
   - **Images** — PNG, JPG, TIFF, BMP, WEBP (Docling extracts text via OCR)
4. If prompted, choose a **parser** for the file(s). The default is Docling, which handles all of the above; you can override per upload.
5. Confirm the upload. Files are processed in the background (parsing — including OCR for scans/images — then chunking and embeddings).
6. Wait for processing to complete. The file status changes from "Processing" to "Available".
7. Once available, you can view the file and use Chat or Redline.

## Options / Variations

- **Multiple files per document**: You can upload several files to one document. The AI will use all files when answering questions.
- **Parser selection**: Docling (the default) performs OCR internally for scanned PDFs and images, so you do not need to choose a separate OCR parser. You can override the parser per upload (e.g. PDFPlumber, DPT-2, LlamaParse, Unstructured) if a key is configured.
- **Generate AI prompt**: When creating a document, generating an AI prompt helps the assistant give more relevant answers. You can add or edit it later in Document Settings.

## Related Topics

- [Workspaces](workspaces.md) — Create workspaces, add members, switch workspaces
- [Documents](documents.md) — More details on documents, formats, and viewing
- [Chat](chat.md) — Ask questions about your contract once files are uploaded
