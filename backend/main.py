from __future__ import annotations

import shutil
import tempfile
import os
from pathlib import Path

import cv2
from docx import Document
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
import numpy as np
from pydantic import BaseModel

from image_preprocess import preprocess_image
from ocr_service import extract_text


OUTPUTS_DIR = Path(__file__).resolve().parent.parent / "outputs"
DEFAULT_FRONTEND_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://main.d3vhgcrptn13ws.amplifyapp.com",
    "https://mockocr.com",
    "https://www.mockocr.com",
]


def _frontend_origins() -> list[str]:
    configured_origins = os.getenv("FRONTEND_ORIGINS", "")
    origins = DEFAULT_FRONTEND_ORIGINS + [
        origin.strip() for origin in configured_origins.split(",") if origin.strip()
    ]
    return list(dict.fromkeys(origins))

app = FastAPI(title="Handwriting OCR API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=_frontend_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ExportRequest(BaseModel):
    text: str


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/")
def root() -> dict[str, str]:
    return {"status": "ok", "service": "mockocr-backend"}


@app.post("/api/ocr")
async def run_ocr(
    file: UploadFile = File(...),
    provider: str | None = Form(default=None),
) -> dict[str, str]:
    suffix = Path(file.filename or "upload").suffix.lower()
    if suffix not in {".jpg", ".jpeg", ".png", ".webp", ".bmp", ".tif", ".tiff", ".pdf"}:
        raise HTTPException(
            status_code=400,
            detail="Upload an image or PDF file.",
        )

    try:
        with tempfile.TemporaryDirectory() as temp_dir:
            temp_path = Path(temp_dir)
            uploaded_path = temp_path / f"upload{suffix}"
            original_path = temp_path / "original.png" if suffix == ".pdf" else uploaded_path
            processed_path = temp_path / "processed.png"

            with uploaded_path.open("wb") as buffer:
                shutil.copyfileobj(file.file, buffer)

            if suffix == ".pdf":
                original_path = _render_pdf_first_page(uploaded_path, original_path)

            preprocess_image(original_path, processed_path)
            result = extract_text(processed_path, provider)

            return {
                "text": result["text"],
                "provider": result["provider"],
                "filename": file.filename or "upload",
            }
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


def _render_pdf_first_page(pdf_path: Path, output_path: Path) -> Path:
    try:
        import pypdfium2 as pdfium
    except ImportError as exc:
        raise RuntimeError("Install pypdfium2 to upload PDF files.") from exc

    document = pdfium.PdfDocument(pdf_path)
    if len(document) == 0:
        raise ValueError("The uploaded PDF has no pages.")

    page = document[0]
    bitmap = page.render(scale=2.5)
    image = np.asarray(bitmap.to_numpy())
    if image.shape[-1] == 4:
        image = cv2.cvtColor(image, cv2.COLOR_RGBA2BGR)
    else:
        image = cv2.cvtColor(image, cv2.COLOR_RGB2BGR)
    cv2.imwrite(str(output_path), image)
    return output_path


@app.post("/api/export/txt")
def export_txt(payload: ExportRequest) -> FileResponse:
    OUTPUTS_DIR.mkdir(parents=True, exist_ok=True)
    output_path = OUTPUTS_DIR / "handwriting-ocr-output.txt"
    output_path.write_text(payload.text, encoding="utf-8")
    return FileResponse(
        output_path,
        media_type="text/plain",
        filename="handwriting-ocr-output.txt",
    )


@app.post("/api/export/docx")
def export_docx(payload: ExportRequest) -> FileResponse:
    OUTPUTS_DIR.mkdir(parents=True, exist_ok=True)
    output_path = OUTPUTS_DIR / "handwriting-ocr-output.docx"

    document = Document()
    for paragraph in payload.text.splitlines() or [""]:
        document.add_paragraph(paragraph)
    document.save(output_path)

    return FileResponse(
        output_path,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        filename="handwriting-ocr-output.docx",
    )
