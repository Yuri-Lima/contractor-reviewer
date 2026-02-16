"""
PDFPlumber extraction microservice.
Extracts text from PDF files using classic PDF parsing.
"""
import tempfile
from pathlib import Path

import pdfplumber
from fastapi import FastAPI, File, HTTPException, UploadFile

app = FastAPI(title="PDFPlumber Extractor")


@app.get("/health")
async def health():
    """Health check endpoint."""
    return {"status": "ok"}


@app.post("/extract")
async def extract(file: UploadFile = File(...)):
    """
    Extract text from uploaded PDF.
    Returns markdown-compatible plain text (pdfplumber outputs text).
    """
    suffix = Path(file.filename or "file").suffix.lower()
    if suffix != ".pdf":
        raise HTTPException(
            status_code=400,
            detail="PDF only. Supported: pdf",
        )

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Empty file")

    fd, path = tempfile.mkstemp(suffix=".pdf")
    try:
        with open(fd, "wb") as f:
            f.write(content)
        with pdfplumber.open(path) as pdf:
            pages = pdf.pages
            page_count = len(pages)
            text_parts = []
            for page in pages:
                page_text = page.extract_text()
                if page_text:
                    text_parts.append(page_text)
            full_text = "\n\n".join(text_parts) if text_parts else ""
        return {
            "markdown": full_text,
            "page_count": page_count,
            "metadata": {"filename": file.filename},
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        Path(path).unlink(missing_ok=True)
