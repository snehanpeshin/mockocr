from __future__ import annotations

import os
from pathlib import Path


class OcrResult(dict):
    text: str
    provider: str


def extract_text(image_path: Path, provider_override: str | None = None) -> OcrResult:
    provider = (provider_override or os.getenv("OCR_PROVIDER", "mock")).lower()
    if provider in {"aws", "textract"}:
        return _extract_with_textract(image_path)

    return {
        "provider": "mock",
        "text": (
            "OCR provider is running in development mode.\n\n"
            "Set OCR_PROVIDER=textract and AWS credentials to extract text "
            "with Amazon Textract."
        ),
    }


def _extract_with_textract(image_path: Path) -> OcrResult:
    try:
        import boto3
    except ImportError as exc:
        raise RuntimeError(
            "Install AWS Textract support with: python -m pip install -r requirements-aws.txt"
        ) from exc

    client = boto3.client("textract", region_name=os.getenv("AWS_REGION"))
    response = client.detect_document_text(
        Document={"Bytes": image_path.read_bytes()},
    )

    lines = [
        block["Text"]
        for block in response.get("Blocks", [])
        if block.get("BlockType") == "LINE" and block.get("Text")
    ]

    return {"provider": "textract", "text": "\n".join(lines).strip()}
