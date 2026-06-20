from __future__ import annotations

import os
from pathlib import Path
import re


class OcrResult(dict):
    text: str
    provider: str


def extract_text(
    image_path: Path,
    provider_override: str | None = None,
    subject: str = "general",
    context_text: str = "",
) -> OcrResult:
    provider = (provider_override or os.getenv("OCR_PROVIDER", "mock")).lower()
    if provider in {"aws", "textract"}:
        return _extract_with_textract(image_path, subject, context_text)

    return {
        "provider": "mock",
        "text": (
            "OCR provider is running in development mode.\n\n"
            "Set OCR_PROVIDER=textract and AWS credentials to extract text "
            "with Amazon Textract."
        ),
    }


def _extract_with_textract(image_path: Path, subject: str, context_text: str = "") -> OcrResult:
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
    enhanced_text, cleanup_provider = enhance_with_ai(cleaned_text, subject, context_text, image_path)
    provider = "textract" if cleanup_provider == "rules" else f"textract+{cleanup_provider}"
    return {"provider": provider, "text": enhanced_text}


def enhance_with_ai(
    text: str,
    subject: str = "general",
    context_text: str = "",
    image_path: Path | None = None,
) -> tuple[str, str]:
    cleanup_provider = os.getenv("AI_CLEANUP_PROVIDER", "rules").lower()
    has_image = image_path is not None and image_path.exists()
    vision_enabled = os.getenv("AI_VISION_REVIEW", "true").lower() in {"1", "true", "yes", "on"}
    if cleanup_provider not in {"bedrock", "aws"} or (
        not text.strip() and not (has_image and vision_enabled)
    ):
        return text, "rules"

    try:
        return enhance_with_bedrock(text, subject, context_text, image_path), "bedrock"
    except Exception:
        if os.getenv("AI_CLEANUP_STRICT", "false").lower() == "true":
            raise
        return text, "rules"


def enhance_with_bedrock(
    text: str,
    subject: str,
    context_text: str = "",
    image_path: Path | None = None,
) -> str:
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
    subject_hint = normalize_subject(subject)
    context_hint = normalize_context(context_text)
    system = _bedrock_system_prompt()
    user_text = _bedrock_user_prompt(text, subject_hint, context_hint)
    image_block = _bedrock_image_block(image_path)

    try:
        response = _converse_cleanup(client, model_id, max_tokens, system, user_text, image_block)
    except Exception:
        if image_block is None or os.getenv("AI_CLEANUP_STRICT", "false").lower() == "true":
            raise
        response = _converse_cleanup(client, model_id, max_tokens, system, user_text, None)

    content = response.get("output", {}).get("message", {}).get("content", [])
    enhanced = "".join(block.get("text", "") for block in content).strip()
    return enhanced or text


def _converse_cleanup(
    client,
    model_id: str,
    max_tokens: int,
    system_text: str,
    user_text: str,
    image_block: dict[str, object] | None,
) -> dict:
    content: list[dict[str, object]] = []
    if image_block is not None:
        content.append(image_block)
    content.append({"text": user_text})

    return client.converse(
        modelId=model_id,
        system=[{"text": system_text}],
        messages=[{"role": "user", "content": content}],
        inferenceConfig={
            "maxTokens": max_tokens,
            "temperature": 0,
        },
    )


def _bedrock_system_prompt() -> str:
    return (
        "You clean OCR text from student handwritten notes. "
        "Correct obvious OCR/spelling mistakes, preserve meaning, "
        "turn headings and bullet-like lines into clean structure, "
        "preserve equations, units, symbols, names, and technical terms, "
        "use optional user context only to resolve likely OCR mistakes, "
        "perform a second-pass consistency check across the whole page, "
        "and do not add facts that are not present in the OCR text. "
        "If an image is provided, use it to verify layout, diagrams, arrows, tables, "
        "equations, visual grouping, and ambiguous handwritten symbols. "
        "Never invent missing definitions, examples, equations, values, or explanations. "
        "If handwriting is unclear, mark it as [unclear] instead of guessing. "
        "Return only the cleaned notes using clear headings and bullets."
    )


def _bedrock_user_prompt(text: str, subject_hint: str, context_hint: str) -> str:
    return (
        f"Subject mode: {subject_hint}.\n"
        f"Optional user context: {context_hint or 'none provided'}.\n"
        "Clean and structure these OCR notes for a student. "
        "Use the context only for terminology, abbreviations, and likely corrections. "
        "Do not add facts from the context unless they are supported by the OCR text. "
        "Do not complete partial math/science content from memory. "
        "Do not add generated explanations, extra formulas, or new examples. "
        "Treat OCR as a draft, not final truth. If an image is attached, compare the OCR "
        "draft against the visual page before finalizing. Build a page-level symbol inventory, "
        "then fix likely character substitutions using neighboring lines, repeated usage, "
        "grammar, the image, and domain conventions. For math, verify common identities and "
        "variable consistency before final output; for example, if OCR reads 6 but nearby "
        "equations consistently use b and the formula only works with b, correct 6 to b. "
        "For visual notes, preserve arrow relationships, diagram labels, table rows, and "
        "flowchart-style structure when visible. Watch for b/6, O/0, l/1, x/multiplication "
        "sign, z/2, and similar handwritten ambiguities. If an ambiguity remains genuinely "
        "uncertain, preserve the most likely reading and add a short 'Possible OCR Ambiguities' "
        "note at the end. Use [unclear] for words, symbols, or equations that cannot be safely "
        "reconstructed from the OCR text and image. Use markdown-style headings and bullet lists "
        "when helpful. If the content contains equations or technical notation, keep it intact.\n\n"
        f"OCR draft:\n{text}"
    )


def _bedrock_image_block(image_path: Path | None) -> dict[str, object] | None:
    if os.getenv("AI_VISION_REVIEW", "true").lower() not in {"1", "true", "yes", "on"}:
        return None
    if image_path is None or not image_path.exists():
        return None

    image_bytes = _image_bytes_for_bedrock(image_path)
    if image_bytes is None:
        return None

    return {
        "image": {
            "format": "png",
            "source": {"bytes": image_bytes},
        }
    }


def _image_bytes_for_bedrock(image_path: Path) -> bytes | None:
    max_bytes = int(os.getenv("AI_VISION_MAX_IMAGE_BYTES", "3500000"))
    image_bytes = image_path.read_bytes()
    if len(image_bytes) <= max_bytes:
        return image_bytes

    try:
        import cv2
        import numpy as np
    except ImportError:
        return None

    array = np.frombuffer(image_bytes, dtype=np.uint8)
    image = cv2.imdecode(array, cv2.IMREAD_GRAYSCALE)
    if image is None:
        return None

    height, width = image.shape[:2]
    scale = min(1.0, 1600 / max(height, width))
    if scale < 1.0:
        image = cv2.resize(image, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA)

    ok, encoded = cv2.imencode(".png", image, [cv2.IMWRITE_PNG_COMPRESSION, 9])
    if not ok:
        return None
    compressed = encoded.tobytes()
    return compressed if len(compressed) <= max_bytes else None


def normalize_subject(subject: str) -> str:
    allowed_subjects = {
        "general": "general notes",
        "biology": "biology",
        "chemistry": "chemistry",
        "math": "mathematics",
        "engineering": "engineering",
        "medicine": "medicine",
        "research": "research notes",
    }
    return allowed_subjects.get(subject.lower().strip(), "general notes")


def normalize_context(context_text: str) -> str:
    context = re.sub(r"\s+", " ", context_text.strip())
    return context[:600]


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
    return standardize_math_notation(apply_student_dictionary(cleaned))


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


def standardize_math_notation(text: str) -> str:
    replacements = {
        "−": "-",
        "–": "-",
    }
    for wrong, right in replacements.items():
        text = text.replace(wrong, right)

    text = re.sub(r"<\s*=", "≤", text)
    text = re.sub(r">\s*=", "≥", text)
    text = re.sub(r"!\s*=", "≠", text)
    text = re.sub(r"\b([A-Za-z0-9])\s*\*\s*([A-Za-z0-9])\b", r"\1 × \2", text)
    text = re.sub(r"\b([A-Za-z0-9])\s*\^\s*([A-Za-z0-9])\b", r"\1^\2", text)
    text = re.sub(r"\b([A-Za-z])\s*_\s*([A-Za-z0-9])\b", r"\1_\2", text)
    text = re.sub(r"\s+([+\-*/=<>])\s+", r" \1 ", text)
    text = re.sub(r"\s{2,}", " ", text)
    return text
