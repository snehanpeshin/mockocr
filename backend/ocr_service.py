from __future__ import annotations

import os
from pathlib import Path
import re


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

    return {"provider": "textract", "text": clean_ocr_text("\n".join(lines))}


def clean_ocr_text(text: str) -> str:
    lines = [clean_ocr_line(line) for line in text.splitlines()]
    cleaned_lines: list[str] = []

    for line in lines:
        if not line:
            if cleaned_lines and cleaned_lines[-1]:
                cleaned_lines.append("")
            continue

        if cleaned_lines and _should_join_lines(cleaned_lines[-1], line):
            cleaned_lines[-1] = f"{cleaned_lines[-1]} {line}"
        else:
            cleaned_lines.append(line)

    cleaned = "\n".join(cleaned_lines).strip()
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)
    return apply_student_dictionary(cleaned)


def clean_ocr_line(line: str) -> str:
    line = line.strip()
    line = line.replace("“", '"').replace("”", '"').replace("’", "'")
    line = re.sub(r"[ \t]+", " ", line)
    line = re.sub(r"\s+([,.;:!?])", r"\1", line)
    line = re.sub(r"([([{])\s+", r"\1", line)
    line = re.sub(r"\s+([)\]}])", r"\1", line)
    line = re.sub(r"^[•·]\s*", "- ", line)
    return line


def _should_join_lines(previous: str, current: str) -> bool:
    if not previous or not current:
        return False
    if previous.endswith((".", "?", "!", ":", ";")):
        return False
    if current.startswith(("-", "•")):
        return False
    return previous[-1].islower() and current[0].islower()


def apply_student_dictionary(text: str) -> str:
    corrections = {
        "mitocondria": "mitochondria",
        "mitochondrail": "mitochondrial",
        "celluar": "cellular",
        "protien": "protein",
        "protins": "proteins",
        "neucleus": "nucleus",
        "nucelus": "nucleus",
        "photosynthisis": "photosynthesis",
        "chromasome": "chromosome",
        "chromasomes": "chromosomes",
        "homeostatis": "homeostasis",
        "equlibrium": "equilibrium",
        "diffussion": "diffusion",
        "osmmosis": "osmosis",
    }

    for wrong, right in corrections.items():
        text = re.sub(rf"\b{wrong}\b", right, text, flags=re.IGNORECASE)
    return text
