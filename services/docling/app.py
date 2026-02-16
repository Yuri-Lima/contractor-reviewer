"""
Docling conversion microservice.
Converts PDF, DOCX, images to markdown.
"""
import os
import tempfile
from pathlib import Path

from fastapi import FastAPI, File, HTTPException, UploadFile
from docling.document_converter import DocumentConverter

app = FastAPI(title="Docling Converter")
converter = DocumentConverter()


@app.get("/health")
async def health():
    """Health check endpoint."""
    return {"status": "ok"}


@app.post("/convert")
async def convert(file: UploadFile = File(...)):
    """
    Convert uploaded document to markdown.
    Supports: PDF, DOCX, PNG, JPG, JPEG.
    """
    suffix = Path(file.filename or "file").suffix.lower()
    if suffix not in (".pdf", ".docx", ".doc", ".png", ".jpg", ".jpeg"):
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported format: {suffix}. Supported: pdf, docx, png, jpg",
        )

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Empty file")

    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        try:
            tmp.write(content)
            tmp.flush()
            result = converter.convert(tmp.name)
            markdown = result.document.export_to_markdown()
            page_count = len(result.document.pages) if result.document.pages else None
            return {
                "markdown": markdown,
                "page_count": page_count,
                "metadata": {"filename": file.filename},
            }
        finally:
            os.unlink(tmp.name)
