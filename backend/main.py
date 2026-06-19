from __future__ import annotations

import shutil
import tempfile
import os
from pathlib import Path

import cv2
from docx import Document
from fastapi import FastAPI, File, Form, Header, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
import numpy as np
from pydantic import BaseModel

from image_preprocess import preprocess_image
from beta_service import request_beta_access, verify_beta_token
from note_service import save_note, search_notes
from ocr_service import extract_text
from payment_service import (
    construct_webhook_event,
    create_checkout_session,
    create_payment_link,
    handle_stripe_event,
    revenue_summary,
    validate_admin_token,
)
from scan_event_service import record_scan_event, scan_summary


OUTPUTS_DIR = Path(__file__).resolve().parent.parent / "outputs"
DEFAULT_FRONTEND_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://main.d3vhgcrptn13ws.amplifyapp.com",
    "https://mockocr.com",
    "https://www.mockocr.com",
    "https://cleanote.in",
    "https://www.cleanote.in",
]


def _frontend_origins() -> list[str]:
    configured_origins = os.getenv("FRONTEND_ORIGINS", "")
    origins = DEFAULT_FRONTEND_ORIGINS + [
        origin.strip() for origin in configured_origins.split(",") if origin.strip()
    ]
    return list(dict.fromkeys(origins))

app = FastAPI(title="Cleanote API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=_frontend_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ExportRequest(BaseModel):
    text: str


class BetaRequest(BaseModel):
    name: str
    email: str
    role: str


class NoteRequest(BaseModel):
    id: str
    email: str
    createdAt: str
    filename: str
    provider: str
    subject: str
    text: str
    contextText: str = ""


class CheckoutRequest(BaseModel):
    product_key: str
    customer_email: str | None = None
    success_url: str
    cancel_url: str


class PaymentLinkRequest(BaseModel):
    product_key: str


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/")
def root() -> dict[str, str]:
    return {"status": "ok", "service": "cleanote-backend"}


@app.post("/api/beta/request")
def request_beta(payload: BetaRequest) -> dict[str, object]:
    try:
        return request_beta_access(payload.name, payload.email, payload.role)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.get("/api/beta/verify")
def verify_beta(token: str) -> dict[str, object]:
    try:
        return verify_beta_token(token)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except TimeoutError as exc:
        raise HTTPException(status_code=410, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.post("/api/notes")
def save_user_note(payload: NoteRequest) -> dict[str, str]:
    try:
        return save_note(payload.model_dump())
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.get("/api/notes/search")
def search_user_notes(email: str, q: str = "", limit: int = 30) -> dict[str, object]:
    try:
        return search_notes(email, q, limit)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.post("/api/stripe/checkout-session")
def create_stripe_checkout_session(payload: CheckoutRequest) -> dict[str, str]:
    try:
        return create_checkout_session(
            payload.product_key,
            payload.customer_email,
            payload.success_url,
            payload.cancel_url,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.post("/api/stripe/payment-link")
def create_stripe_payment_link(
    payload: PaymentLinkRequest,
    x_admin_token: str | None = Header(default=None),
) -> dict[str, str]:
    try:
        validate_admin_token(x_admin_token)
        return create_payment_link(payload.product_key)
    except PermissionError as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.post("/api/stripe/webhook")
async def stripe_webhook(request: Request, stripe_signature: str | None = Header(default=None)):
    payload = await request.body()
    try:
        event = construct_webhook_event(payload, stripe_signature)
        return handle_stripe_event(event)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.get("/api/admin/revenue")
def admin_revenue(x_admin_token: str | None = Header(default=None)) -> dict[str, object]:
    try:
        validate_admin_token(x_admin_token)
        return {**revenue_summary(), "scan_summary": scan_summary()}
    except PermissionError as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.post("/api/ocr")
async def run_ocr(
    file: UploadFile = File(...),
    provider: str | None = Form(default=None),
    subject: str = Form(default="general"),
    context_text: str = Form(default=""),
) -> dict[str, str]:
    filename = file.filename or "upload"
    suffix = Path(filename).suffix.lower()
    if suffix not in {".jpg", ".jpeg", ".png", ".webp", ".bmp", ".tif", ".tiff", ".pdf"}:
        record_scan_event(
            {
                "filename": filename,
                "file_type": suffix.lstrip("."),
                "provider": provider or "",
                "subject": subject,
                "status": "rejected",
                "error_message": "Unsupported file type",
            }
        )
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
            file_size_bytes = uploaded_path.stat().st_size

            if suffix == ".pdf":
                original_path = _render_pdf_first_page(uploaded_path, original_path)

            preprocess_image(original_path, processed_path)
            result = extract_text(processed_path, provider, subject, context_text)
            record_scan_event(
                {
                    "filename": filename,
                    "file_type": suffix.lstrip("."),
                    "file_size_bytes": file_size_bytes,
                    "provider": result["provider"],
                    "subject": subject,
                    "status": "success",
                    "page_count": 1,
                    "text_length": len(result["text"]),
                }
            )

            return {
                "text": result["text"],
                "provider": result["provider"],
                "filename": filename,
                "subject": subject,
                "context_text": context_text,
            }
    except ValueError as exc:
        record_scan_event(
            {
                "filename": filename,
                "file_type": suffix.lstrip("."),
                "provider": provider or "",
                "subject": subject,
                "status": "failed",
                "error_message": str(exc),
            }
        )
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        record_scan_event(
            {
                "filename": filename,
                "file_type": suffix.lstrip("."),
                "provider": provider or "",
                "subject": subject,
                "status": "failed",
                "error_message": str(exc),
            }
        )
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
    output_path = OUTPUTS_DIR / "cleanote-output.txt"
    output_path.write_text(payload.text, encoding="utf-8")
    return FileResponse(
        output_path,
        media_type="text/plain",
        filename="cleanote-output.txt",
    )


@app.post("/api/export/docx")
def export_docx(payload: ExportRequest) -> FileResponse:
    OUTPUTS_DIR.mkdir(parents=True, exist_ok=True)
    output_path = OUTPUTS_DIR / "cleanote-output.docx"

    document = Document()
    for paragraph in payload.text.splitlines() or [""]:
        document.add_paragraph(paragraph)
    document.save(output_path)

    return FileResponse(
        output_path,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        filename="cleanote-output.docx",
    )
