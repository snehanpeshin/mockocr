from __future__ import annotations

from dataclasses import dataclass
import os
from pathlib import Path
import re


class OcrResult(dict):
    text: str
    provider: str


@dataclass
class TextractLine:
    text: str
    text_type: str
    confidence: float


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

    line_items = _extract_textract_lines(response.get("Blocks", []))
    lines = [line.text for line in line_items]
    mixed_document_context = _mixed_document_context(line_items)

    cleaned_text = clean_ocr_text("\n".join(lines))
    enhanced_text, cleanup_provider = enhance_with_ai(
        cleaned_text,
        subject,
        context_text,
        image_path,
        mixed_document_context,
    )
    provider = "textract" if cleanup_provider == "rules" else f"textract+{cleanup_provider}"
    return {"provider": provider, "text": enhanced_text}


def enhance_with_ai(
    text: str,
    subject: str = "general",
    context_text: str = "",
    image_path: Path | None = None,
    document_context: str = "",
) -> tuple[str, str]:
    cleanup_provider = os.getenv("AI_CLEANUP_PROVIDER", "rules").lower()
    has_image = image_path is not None and image_path.exists()
    vision_enabled = os.getenv("AI_VISION_REVIEW", "true").lower() in {"1", "true", "yes", "on"}
    if cleanup_provider not in {"bedrock", "aws"} or (
        not text.strip() and not (has_image and vision_enabled)
    ):
        return text, "rules"

    try:
        return enhance_with_bedrock(text, subject, context_text, image_path, document_context), "bedrock"
    except Exception:
        if os.getenv("AI_CLEANUP_STRICT", "false").lower() == "true":
            raise
        return text, "rules"


def enhance_with_bedrock(
    text: str,
    subject: str,
    context_text: str = "",
    image_path: Path | None = None,
    document_context: str = "",
) -> str:
    try:
        import boto3
    except ImportError as exc:
        raise RuntimeError(
            "Install AWS Bedrock support with: python -m pip install -r requirements-aws.txt"
        ) from exc

    model_id = os.getenv("BEDROCK_MODEL_ID", "amazon.nova-lite-v1:0")
    region = os.getenv("BEDROCK_REGION") or os.getenv("AWS_REGION")
    max_tokens = int(os.getenv("AI_CLEANUP_MAX_TOKENS", "3200"))

    client = boto3.client("bedrock-runtime", region_name=region)
    subject_hint = normalize_subject(subject)
    context_hint = normalize_context(context_text)
    system = _bedrock_system_prompt()
    image_block = _bedrock_image_block(image_path)
    user_text = _bedrock_user_prompt(
        text,
        subject_hint,
        context_hint,
        document_context,
        visual_notes_enabled=image_block is not None and _visual_notes_enabled(),
    )

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


def _extract_textract_lines(blocks: list[dict]) -> list[TextractLine]:
    word_by_id = {
        block.get("Id"): block
        for block in blocks
        if block.get("BlockType") == "WORD" and block.get("Id")
    }
    line_items: list[TextractLine] = []

    for block in blocks:
        text = block.get("Text", "")
        if block.get("BlockType") != "LINE" or not text:
            continue
        line_items.append(
            TextractLine(
                text=text,
                text_type=_classify_textract_line(block, word_by_id),
                confidence=float(block.get("Confidence") or 0),
            )
        )

    return line_items


def _classify_textract_line(block: dict, word_by_id: dict[str, dict]) -> str:
    word_types: list[str] = []
    child_ids: list[str] = []
    for relationship in block.get("Relationships", []):
        if relationship.get("Type") == "CHILD":
            child_ids.extend(relationship.get("Ids", []))

    for child_id in child_ids:
        word = word_by_id.get(child_id)
        if word and word.get("TextType"):
            word_types.append(str(word["TextType"]).upper())

    if any(text_type == "HANDWRITING" for text_type in word_types):
        return "handwritten annotation" if any(text_type == "PRINTED" for text_type in word_types) else "handwritten"
    if any(text_type == "PRINTED" for text_type in word_types):
        return "printed"

    return _infer_line_type(block.get("Text", ""), float(block.get("Confidence") or 0))


def _infer_line_type(text: str, confidence: float) -> str:
    stripped = text.strip()
    word_count = len(re.findall(r"[A-Za-z0-9]+", stripped))
    has_sentence_punctuation = bool(re.search(r"[.;:!?)]$", stripped))
    looks_like_annotation = (
        confidence < 88
        or stripped.startswith(("*", "-", "->", "=>"))
        or "?" in stripped
        or (
            word_count <= 4
            and bool(re.search(r"[+=×*/^_]|circle|star|note|fix|check|important", stripped, re.I))
        )
    )
    looks_printed = confidence >= 95 and word_count >= 5 and has_sentence_punctuation

    if looks_printed:
        return "printed"
    if looks_like_annotation:
        return "handwritten annotation"
    return "unknown"


def _mixed_document_context(lines: list[TextractLine]) -> str:
    if not lines:
        return ""

    printed = [line for line in lines if line.text_type == "printed"]
    handwritten = [
        line
        for line in lines
        if line.text_type in {"handwritten", "handwritten annotation"}
    ]
    unknown = [line for line in lines if line.text_type == "unknown"]

    if not printed and not handwritten:
        return ""

    summary = [
        "Textract line classification:",
        f"- Printed/typed lines: {len(printed)}",
        f"- Handwritten or annotation lines: {len(handwritten)}",
        f"- Unclassified lines: {len(unknown)}",
        "Use this classification as guidance, not as absolute truth.",
        "Treat printed/typed text as high-confidence source text and preserve it closely.",
        "Treat handwritten annotations as lower-confidence text that may need visual review, context correction, and clearer placement.",
    ]

    samples: list[str] = []
    for line in lines[:80]:
        if line.text_type in {"printed", "handwritten", "handwritten annotation"}:
            samples.append(
                f"[{line.text_type}; confidence {line.confidence:.1f}] {line.text}"
            )

    if samples:
        summary.append("Line samples in page order:")
        summary.extend(samples)

    return "\n".join(summary)


def _bedrock_system_prompt() -> str:
    return (
        "You faithfully transcribe and organize OCR text from student handwritten notes. "
        "Your job is not to summarize, abridge, condense, or simplify the notes. "
        "Correct obvious OCR/spelling mistakes, preserve meaning, "
        "turn headings and bullet-like lines into clean structure without removing detail, "
        "preserve equations, units, symbols, names, and technical terms, "
        "use optional user context only to resolve likely OCR mistakes, "
        "perform a second-pass consistency check across the whole page, "
        "and do not add facts that are not present in the OCR text. "
        "If an image is provided, use it to verify layout, diagrams, arrows, tables, "
        "equations, visual grouping, and ambiguous handwritten symbols. "
        "For math and science, OCR is only a hypothesis: verify symbols against page context, "
        "nearby equations, variable consistency, known identities, units, and visual similarity. "
        "Visual drawings are first-class note content, not decoration. If a drawing, triangle, "
        "graph, axis, table, flowchart, circuit, chemical sketch, or labeled diagram appears, "
        "describe its structure and relationships in text so the note remains searchable. "
        "For mixed documents, handle printed/typed text differently from handwritten annotations: "
        "printed/typed text should usually be preserved with minimal correction, while handwritten "
        "annotations should receive stronger visual/context review and be placed where they belong. "
        "Never invent missing definitions, examples, equations, values, or explanations. "
        "Never omit readable handwritten lines just because they are repetitive, informal, or messy. "
        "If handwriting is unclear, mark it as [unclear] instead of guessing. "
        "Return only the faithful cleaned transcription using clear headings and bullets."
    )


def _bedrock_user_prompt(
    text: str,
    subject_hint: str,
    context_hint: str,
    document_context: str = "",
    visual_notes_enabled: bool = False,
) -> str:
    visual_instruction = _visual_notes_prompt() if visual_notes_enabled else ""
    math_instruction = _math_symbol_verification_prompt()
    return (
        f"Subject mode: {subject_hint}.\n"
        f"Optional user context: {context_hint or 'none provided'}.\n"
        f"Document analysis context:\n{document_context or 'none provided'}.\n"
        f"{visual_instruction}"
        f"{math_instruction}"
        "Faithfully transcribe and structure these OCR notes for a student. "
        "Do not summarize, shorten, abridge, merge away, or rewrite the notes into a study guide. "
        "The output should contain at least the same level of detail as the readable handwritten "
        "and printed source content. Preserve every readable line, list item, equation, label, "
        "abbreviation, example, and side note. Use headings and bullets only to organize the content, "
        "not to reduce it. "
        "Use the context only for terminology, abbreviations, and likely corrections. "
        "Do not add facts from the context unless they are supported by the OCR text. "
        "Do not complete partial math/science content from memory. "
        "Do not add generated explanations, extra formulas, or new examples. "
        "Treat OCR as a draft, not final truth. If an image is attached, compare the OCR "
        "draft against the visual page before finalizing. Build a page-level symbol inventory, "
        "then fix likely character substitutions using neighboring lines, repeated usage, "
        "grammar, the image, and domain conventions. "
        "For visual notes, preserve arrow relationships, diagram labels, table rows, and "
        "flowchart-style structure when visible. Watch for b/6, O/0, l/1, x/multiplication "
        "sign, z/2, and similar handwritten ambiguities. "
        "When the document mixes printed text with handwritten notes, preserve printed text "
        "closely, correct only obvious OCR errors in it, and do not rewrite the printed section "
        "as if it were handwritten. Put handwritten margin notes, equations, arrows, checkmarks, "
        "or annotations near the printed text they refer to when the image/layout makes that clear. "
        "If the relationship is not clear, keep annotations under a 'Handwritten annotations' heading. "
        "Do not include internal labels like [printed] or confidence scores in the final answer. "
        "Do not let a messy handwritten annotation degrade otherwise clean printed text. "
        "Do not collapse several handwritten lines into one short summary; keep the author's original "
        "level of detail and sequence whenever readable. "
        "If an ambiguity remains genuinely "
        "uncertain, preserve the most likely reading and add a short 'Possible OCR Ambiguities' "
        "note at the end. Use [unclear] for words, symbols, or equations that cannot be safely "
        "reconstructed from the OCR text and image. Use markdown-style headings and bullet lists "
        "when helpful. If the content contains equations or technical notation, keep it intact.\n\n"
        f"OCR draft:\n{text}"
    )


def _math_symbol_verification_prompt() -> str:
    return (
        "Math and scientific symbol verification mode: enabled.\n"
        "Do not passively repeat OCR for equations. Treat OCR as a hypothesis and reconstruct "
        "the author's intended notation when the page context supports a correction. "
        "Before final output, identify the variables and repeated symbols used across the whole page. "
        "Check equations against nearby equations, repeated variable usage, common mathematical "
        "identities, dimensional/unit consistency, and standard scientific notation. "
        "Resolve likely glyph confusions such as b/6, B/8, O/0, o/0, l/1, I/1, S/5, z/2, "
        "x/×, plus/t, minus/dash, and handwritten Greek/Latin lookalikes. "
        "If OCR reads '6' but surrounding equations consistently use 'b' and the formula is valid "
        "with b, correct 6 to b. If OCR reads '0' where surrounding notation expects O or o, correct "
        "it only when context supports that. Preserve the original variable names and do not invent "
        "new variables. "
        "When you make a non-trivial math/science symbol correction, add a brief 'Corrections made' "
        "section after the transcription. Keep it concise, for example: '6 -> b in a^2 + b^2 because "
        "nearby equations use b and the identity requires b.' If no meaningful correction was made, "
        "omit that section. If more than one interpretation remains plausible, include it under "
        "'Possible OCR Ambiguities' instead of pretending certainty.\n"
    )


def _visual_notes_enabled() -> bool:
    return os.getenv("AI_VISUAL_NOTES", "true").lower() in {"1", "true", "yes", "on"}


def _visual_notes_prompt() -> str:
    return (
        "Visual notes mode: enabled.\n"
        "Before finalizing, inspect the image for non-text note content. If visual content is present, "
        "include a 'Visual Notes' or domain-specific section such as 'Geometry Diagram', 'Graph', "
        "'Flowchart', 'Table', 'Circuit Diagram', or 'Chemical Structure'. "
        "The visual section should be detailed enough that a reader can recognize what was shown "
        "without seeing the original image, while still avoiding unsupported guesses. "
        "For geometry, identify shapes, vertices, side labels, angle labels, known values, unknowns, "
        "and relationships. For example, a drawn triangle with labels A, B, and C should become a "
        "searchable description of triangle ABC, including which labels appear at which vertices when "
        "visible. For graphs, identify axes, curves, intercepts, labels, trends, and marked points. "
        "For flowcharts, preserve node order and arrow direction. For tables, preserve rows and columns. "
        "For arrows and annotations, explain what each arrow connects if the relationship is visible. "
        "If visual content is too unclear, write [unclear diagram] and list only the safe visible labels. "
        "Do not invent missing values, labels, or relationships.\n"
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
