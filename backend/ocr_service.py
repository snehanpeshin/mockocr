from __future__ import annotations
import os
from pathlib import Path
from openai_ocr import transcribe_page

class OcrResult(dict):
    text: str
    provider: str

def resolve_provider(requested: str | None = None) -> str:
    configured = os.getenv("OCR_PROVIDER", "openai").lower()
    provider = (requested or configured).lower()
    # Old installed clients still send textract/aws. They use OpenAI after migration.
    if provider in {"openai", "textract", "aws"}:
        return "openai"
    if provider == "mock" and configured == "mock":
        return "mock"
    raise ValueError("Unsupported OCR provider.")

def extract_text(image_path: Path | list[Path], provider_override: str | None = None,
                 subject: str = "general", context_text: str = "", fast_mode: bool = False,
                 cleanup_mode: str | None = None, original_image_path: Path | None = None) -> OcrResult:
    provider = resolve_provider(provider_override)
    if provider == "mock":
        return {"provider": "mock", "text": "OCR is in development mode. Configure OPENAI_API_KEY."}
    paths = image_path if isinstance(image_path, list) else [image_path]
    source = original_image_path or (paths[0] if paths else None)
    if source is None:
        raise ValueError("No page image was supplied.")
    # Multi-page uploads use the same pipeline; fast_mode never bypasses review.
    return transcribe_page(source, subject, context_text,
                           verify=cleanup_mode in {"openai", "bedrock", "ai", "enhanced", "aws"})

def clean_ocr_text(text: str) -> str:
    # Preserve source spelling, math symbols, line breaks, and repetitions.
    return "\n".join(line.rstrip() for line in text.splitlines()).strip()
