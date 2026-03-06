# Documents

## Summary

A document is a container for one or more uploaded files (e.g., a contract and its annexes). Each document has a title, optional description, and optional AI prompt to guide the assistant. You can upload PDFs, Word documents, images, and text files, then use Chat and Redline on the content.

## When to Use

- You need to store and analyze a contract or agreement
- You want to upload multiple related files (e.g., main contract + annexes)
- You need to choose a parser for scanned documents or images

## Prerequisites

- You must be in a workspace where you have at least MEMBER role.
- The workspace must allow document creation.

## Steps

### Create a Document

1. Open the workspace (see [Workspaces](workspaces.md)).
2. Click **Create Document** or the create button.
3. Enter a **title** (required).
4. Optionally enter a **description** (helps the AI understand context).
5. Choose how to set document prompts:
   - **Prompt category** (optional): Select a category from the searchable dropdown (e.g., General, Real Estate, NDA, Legal/Law) to apply pre-built prompts for all 7 document keys. When a category is selected, a **prompt preview** tab appears showing the prompts that will be applied. Good for common contract types.
   - **Generate AI prompt** (optional): Click to create custom instructions from the title and description. Review, edit if needed, then click **Approve and Create** or **Create without prompt**.
6. The document is created and opens in the document view.

You can use a prompt category, generate a custom prompt, or neither. Document prompts can be edited later in Document Settings.

### Upload Files

1. Open the document.
2. Go to the **Files** tab (or the upload area).
3. Click **Upload File** or **Upload Files**.
4. Select files from your computer. Supported formats:
   - **PDF** — contracts, scanned documents
   - **DOCX** — Microsoft Word
   - **TXT** — plain text
   - **PNG, JPG** — images (processed with OCR)
5. If prompted, **select a parser** for the files (e.g., PDF parser, DOCX parser, OCR).
6. Confirm the upload. Files are processed in the background.
7. Wait until status changes from "Processing" to "Available".

### Jurisdiction

When a document has multiple jurisdiction candidates (e.g., governing law clauses from different files), the document view shows a **jurisdiction dropdown** so you can choose or override the AI-selected jurisdiction. Use the **Re-evaluate** button to re-run the jurisdiction analysis from all files. Jurisdiction affects which legal sources are used in Chat and Redline. See [Chat](chat.md) for how legal context is applied.

### View File Content

1. In the document view, select the **View** tab (or equivalent).
2. Select a file from the list.
3. The file content is displayed (PDF viewer, text view, or image view).
4. Use the viewer to read the contract and select text for Redline.

## Supported Formats and Limits

- **Formats**: PDF, DOCX, TXT, PNG, JPG
- **Size limits**: Typically up to 50MB per file; total batch size may be limited (e.g., 100MB).
- **Batch limits**: Up to a certain number of files per upload (e.g., 20).

If a file exceeds limits or is in an unsupported format, the upload will fail with an error message.

## File Status

| Status | Meaning |
|--------|---------|
| **Uploading** | File is being transferred. |
| **Processing** | Parser, OCR, chunking, or embeddings are running. |
| **Available** | Ready for Chat and Redline. |
| **Error** | Processing failed. Check the error message; you may need to retry or choose a different parser. |
| **Quarantined** | File was flagged (e.g., security check) and is not available. |

## Parser Selection

When uploading files, you may be asked to select a parser:

- **PDF parser** — Extracts text from PDFs. Use for native PDFs.
- **OCR parser** — Extracts text from images or scanned PDFs using OCR.
- **DOCX parser** — Extracts text from Word documents.

Select the parser that matches your file type. For scanned documents or images, choose OCR.

## Options / Variations

- **Add context (temporary)**: You can add temporary Markdown context for a chat session. This is not saved with the document.
- **Delete files**: From the Files tab, you can delete individual files. This is permanent.
- **Delete document**: From document settings or context menu, you can delete the entire document. This is a hard delete and cannot be undone.

## Related Topics

- [Getting Started](getting-started.md) — Create first document and upload
- [Chat](chat.md) — Ask questions about the contract
- [Redline](redline.md) — Generate and apply suggested changes
- [Workspace Settings](workspace-settings.md) — Default parsers, retention
