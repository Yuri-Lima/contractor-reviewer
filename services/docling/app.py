"""
Docling conversion microservice.
Converts PDF, DOCX, PPTX, XLSX, images to markdown with pipeline options and metadata.
"""
from importlib.metadata import PackageNotFoundError, version
from io import BytesIO

from fastapi import FastAPI, File, HTTPException, Query, UploadFile
from docling.datamodel.base_models import DocumentStream, InputFormat
from docling.datamodel.pipeline_options import PdfPipelineOptions
from docling.document_converter import DocumentConverter, PdfFormatOption

try:
    DOCLING_VERSION: str | None = version("docling")
except PackageNotFoundError:
    DOCLING_VERSION = None

# Pipeline options for PDF (table structure, OCR enabled by default)
pipeline_options = PdfPipelineOptions(
    do_table_structure=True,
    do_ocr=True,
)
converter = DocumentConverter(
    format_options={
        InputFormat.PDF: PdfFormatOption(pipeline_options=pipeline_options),
    }
)

# Extended format support: PDF, DOCX, DOC, PPTX, XLSX, PNG, JPG, JPEG, TIFF, BMP, WEBP
SUPPORTED_SUFFIXES = {
    ".pdf",
    ".docx",
    ".doc",
    ".pptx",
    ".xlsx",
    ".png",
    ".jpg",
    ".jpeg",
    ".tiff",
    ".tif",
    ".bmp",
    ".webp",
}

app = FastAPI(title="Docling Converter")


def _contains_from_ocr_true(obj: dict) -> bool:
    """Recursively search for from_ocr: True in a dict (from model_dump)."""
    if isinstance(obj, dict):
        if obj.get("from_ocr") is True:
            return True
        for v in obj.values():
            if _contains_from_ocr_true(v):
                return True
    elif isinstance(obj, list):
        for item in obj:
            if _contains_from_ocr_true(item):
                return True
    return False


def _infer_used_ocr(result) -> bool | None:
    """
    Infer if OCR was used from ConversionResult.
    Docling does not expose top-level used_ocr; use from_ocr in cells or timings.
    """
    # Option 1: Check timings (if profiling enabled)
    if result.timings and any("ocr" in k.lower() for k in result.timings):
        return True
    # Option 2: Traverse document for from_ocr in cells
    try:
        doc = result.document
        # Tables contain cells (PdfTextCell/TextCell with from_ocr)
        for table in getattr(doc, "tables", []) or []:
            data = getattr(table, "data_table", None)
            if not data:
                continue
            for row in getattr(data, "rows", []) or []:
                for cell in getattr(row, "cells", []) or []:
                    if getattr(cell, "from_ocr", False):
                        return True
        # Alternative: model_dump and recursive search
        dumped = doc.model_dump() if hasattr(doc, "model_dump") else {}
        if _contains_from_ocr_true(dumped):
            return True
        return False
    except Exception:
        return None


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/convert")
async def convert(
    file: UploadFile = File(...),
    max_num_pages: int | None = Query(None),
    max_file_size: int | None = Query(None),
):
    """
    Convert uploaded document to markdown.
    Supports: PDF, DOCX, DOC, PPTX, XLSX, PNG, JPG, JPEG, TIFF, BMP, WEBP.
    """
    suffix = (file.filename or "file").lower()
    if "." in suffix:
        suffix = "." + suffix.rsplit(".", 1)[-1]
    else:
        suffix = ""

    if suffix not in SUPPORTED_SUFFIXES:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported format: {suffix}. Supported: pdf, docx, doc, pptx, xlsx, png, jpg, jpeg, tiff, bmp, webp",
        )

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Empty file")

    # Use DocumentStream for in-memory conversion (avoid temp files)
    source = DocumentStream(
        name=file.filename or "document",
        stream=BytesIO(content),
    )

    kwargs = {}
    if max_num_pages is not None:
        kwargs["max_num_pages"] = max_num_pages
    if max_file_size is not None:
        kwargs["max_file_size"] = max_file_size

    result = converter.convert(source, **kwargs)
    markdown = result.document.export_to_markdown()
    page_count = len(result.document.pages) if result.document.pages else None
    used_ocr = _infer_used_ocr(result)

    metadata = {
        "filename": file.filename,
        "parser": "docling",
        "parser_version": DOCLING_VERSION,
        "pipeline_mode": "default",
        "used_ocr": used_ocr,
    }
    if page_count is not None:
        metadata["page_count"] = page_count

    return {
        "markdown": markdown,
        "page_count": page_count,
        "metadata": metadata,
    }
