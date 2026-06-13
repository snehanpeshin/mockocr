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

    cleaned_text = clean_ocr_text("\n".join(lines))
    enhanced_text, cleanup_provider = enhance_with_ai(cleaned_text)
    provider = "textract" if cleanup_provider == "rules" else f"textract+{cleanup_provider}"
    return {"provider": provider, "text": enhanced_text}


def enhance_with_ai(text: str) -> tuple[str, str]:
    cleanup_provider = os.getenv("AI_CLEANUP_PROVIDER", "rules").lower()
    if cleanup_provider not in {"bedrock", "aws"} or not text.strip():
        return text, "rules"

    try:
        return enhance_with_bedrock(text), "bedrock"
    except Exception:
        if os.getenv("AI_CLEANUP_STRICT", "false").lower() == "true":
            raise
        return text, "rules"


def enhance_with_bedrock(text: str) -> str:
    try:
        import boto3
    except ImportError as exc:
        raise RuntimeError(
            "Install AWS Bedrock support with: python -m pip install -r requirements-aws.txt"
        ) from exc

    model_id = os.getenv("BEDROCK_MODEL_ID", "amazon.nova-lite-v1:0")
    region = os.getenv("BEDROCK_REGION") or os.getenv("AWS_REGION")
    max_tokens = int(os.getenv("AI_CLEANUP_MAX_TOKENS", "1800"))

    client = boto3.client("bedrock-runtime", region_name=region)
    response = client.converse(
        modelId=model_id,
        system=[
            {
                "text": (
                    "You clean OCR text from student handwritten notes. "
                    "Correct obvious OCR/spelling mistakes, preserve meaning, "
                    "turn headings and bullet-like lines into clean structure, "
                    "and do not add facts that are not present. "
                    "Return only the cleaned notes."
                )
            }
        ],
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "text": (
                            "Clean and structure these OCR notes for a student.\n\n"
                            f"{text}"
                        )
                    }
                ],
            }
        ],
        inferenceConfig={
            "maxTokens": max_tokens,
            "temperature": 0.1,
        },
    )

    content = response.get("output", {}).get("message", {}).get("content", [])
    enhanced = "".join(block.get("text", "") for block in content).strip()
    return enhanced or text


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
