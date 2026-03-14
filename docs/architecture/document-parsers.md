# Document Parsers — Reference

ContractAI Review supports multiple document parsers for extracting text from uploaded files (PDF, DOC, DOCX, PPTX, XLSX, TXT, images). **Docling** is the primary parser with fallback to other parsers when needed. Users can choose the parser at upload time or rely on the workspace default.

## Upload Validation

Before parsing, files are validated by the storage module. Allowed formats: `.pdf`, `.doc`, `.docx`, `.ppt`, `.pptx`, `.xls`, `.xlsx`, `.txt`, `.md`, `.png`, `.jpg`, `.jpeg`, `.tiff`, `.tif`, `.bmp`, `.webp` (max 25MB). MIME type is verified via file signature (magic numbers). See [storage.md](storage.md) for details.

## Overview

| Parser       | Type       | API Key | Formats                                       | Notes                                  |
|--------------|------------|---------|-----------------------------------------------|----------------------------------------|
| **Docling**  | Self-hosted| No      | PDF, DOC, DOCX, PPTX, XLSX, PNG, JPG, TIFF, BMP, WEBP | **Primary.** Supports scanned PDFs (internal OCR). |
| **PDFPlumber**| Self-hosted| No      | PDF                         | Fallback. Classic extraction, PDF only. |
| **DPT-2**    | Cloud      | Yes     | PDF, DOCX, PNG, JPG         | LandingAI. High quality.                |
| **LlamaParse**| Cloud     | Yes     | PDF, DOCX                   | LlamaIndex.                             |
| **Unstructured**| Cloud   | Yes     | PDF, DOCX, PNG, JPG, TXT    | Many formats.                          |

**Note:** The standalone Tesseract OCR path has been removed. OCR is now performed by Docling internally when processing scanned PDFs or images.

## Self-Hosted Parsers (Docling, PDFPlumber)

**Quick verification:** Before uploading, verify parser services are running:

1. Start services: `docker-compose up -d docling pdfplumber`
2. Run `pnpm run verify:parsers` — checks both Docling and PDFPlumber
3. Or call `GET /api/health/parsers` — returns `{ docling: { ok, url, error? }, pdfplumber: { ok, url, error? } }`
4. If upload fails with `ECONNREFUSED`, the service is not running — start it with `docker-compose up docling`

### Docling

- **Source:** [IBM Docling](https://github.com/DS4SD/docling) — Python microservice
- **Service:** `services/docling/` — FastAPI app
- **Default URL:** `http://localhost:8000`
- **Health:** `GET /health`

**Capabilities:**
- PDF (including scanned with internal OCR)
- DOC, DOCX (legacy Word / OLE)
- PPTX, XLSX (Office formats)
- PNG, JPG, TIFF, BMP, WEBP images

**Parsing context:** Each parsed file stores metadata (`parsingContext`) including parser ID, version, pipeline mode, whether OCR was used, page count, and export format. This is shown in the document files table in the UI.

**Setup:**
```bash
docker-compose up -d docling
# Verify: curl http://localhost:8000/health
```

### PDFPlumber

- **Source:** [PDFPlumber](https://github.com/jsvine/pdfplumber) — Python microservice
- **Service:** `services/pdfplumber/` — FastAPI app
- **Default URL:** `http://localhost:8001`
- **Health:** `GET /health`

**Capabilities:**
- PDF only (native text, not OCR)

**Setup:**
```bash
docker-compose up -d pdfplumber
# Verify: curl http://localhost:8001/health
```

## Cloud Parsers (DPT-2, LlamaParse, Unstructured)

These parsers require an API key stored per workspace (encrypted at rest).

### DPT-2 (LandingAI)

- **Provider:** [LandingAI](https://landing.ai/) — Document Pre-trained Transformer
- **API key:** Configure in Workspace Settings > Document Parsers
- **Formats:** PDF, DOCX, PNG, JPG

### LlamaParse (LlamaIndex)

- **Provider:** [LlamaIndex](https://www.llamaindex.ai/) — LlamaParse
- **API key:** Configure in Workspace Settings > Document Parsers
- **Formats:** PDF, DOCX

### Unstructured.io

- **Provider:** [Unstructured](https://unstructured.io/)
- **API key:** Configure in Workspace Settings > Document Parsers
- **Formats:** PDF, DOCX, PNG, JPG, TXT

## Configuration

### Workspace-Level Settings

1. **Default parser** — Used when no parser is chosen at upload.
2. **Parser API keys** — For DPT-2, LlamaParse, Unstructured. Stored encrypted (AES-256-GCM) and never returned in full.

Configuration is via:

- **API:** `PUT /api/workspaces/:workspaceId/settings` with body:
  ```json
  {
    "documentProcessing": {
      "defaultDocumentParser": "docling",
      "parserApiKeys": {
        "dpt2": "sk-...",
        "llamaparse": "...",
        "unstructured": "..."
      }
    }
  }
  ```
- **Frontend:** Workspace Settings > Document Parsers tab

### Primary Parser and Fallback

- **Primary parser:** Docling is the default for all formats it supports (PDF, DOC, DOCX, PPTX, XLSX, images).
- **Fallback:** If Docling is unavailable or the workspace explicitly uses a different parser (e.g. PDFPlumber), that parser is used. PDFPlumber is the fallback for PDF when Docling cannot process the file.

### Upload-Time Parser Selection

When uploading a file, the user can open a parser selection dialog and pick a different parser than the default. Parsers that require an API key but don't have one configured are shown as disabled.

### Environment Variables

| Variable                   | Description                                      |
|----------------------------|--------------------------------------------------|
| `DOCLING_URL`              | Docling service URL (default: `http://localhost:8000`) |
| `PDFPLUMBER_URL`           | PDFPlumber service URL (default: `http://localhost:8001`) |
| `PARSER_KEYS_ENCRYPTION_KEY` | 32 bytes hex for encrypting workspace parser API keys. Required when using DPT-2, LlamaParse, or Unstructured. Generate: `openssl rand -hex 32` |

## Error Handling

When a parser fails:

- **User-facing message:** Shown in the "Failed Jobs" block on the document view (e.g. "Docling service is unavailable. Start it with 'docker-compose up docling' or try a different parser.").
- **Developer logs:** Include parser name, error cause, and stack trace.

Common causes:
- Docling/PDFPlumber service not running → Start with `docker-compose up -d docling pdfplumber`
- Missing API key for cloud parser → Add in Workspace Settings > Document Parsers
- Invalid or expired API key → Update in workspace settings
- Timeout → Try a smaller file or a different parser

## API Reference

### List available parsers

```
GET /api/workspaces/:workspaceId/document-parsers
```

**Response:** `ParserInfo[]`

```json
[
  {
    "id": "docling",
    "name": "Docling",
    "description": "IBM Docling. Self-hosted, no API key. PDF, DOCX, images.",
    "requiresApiKey": false,
    "hasApiKey": true,
    "supportedFormats": ["pdf", "doc", "docx", "pptx", "xlsx", "png", "jpg", "tiff", "bmp", "webp"]
  }
]
```

- `hasApiKey` is `true` if the workspace has an API key stored for that parser (or if the parser doesn't require one).

### Upload with parser

```
POST /api/workspaces/:workspaceId/documents/:docId/files
Content-Type: multipart/form-data
```

**Body:**
- `file`: file
- `parser` (optional): `docling` | `pdfplumber` | `dpt2` | `llamaparse` | `unstructured`

If `parser` is omitted, the workspace default is used.
