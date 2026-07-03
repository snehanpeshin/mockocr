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


@dataclass
class TextractCandidate:
    image_path: Path
    line_items: list[TextractLine]
    low_confidence_words: list[str]
    raw_text: str
    score: float
    quality_notes: str


def extract_text(
    image_path: Path | list[Path],
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


def _extract_with_textract(
    image_path: Path | list[Path],
    subject: str,
    context_text: str = "",
) -> OcrResult:
    try:
        import boto3
    except ImportError as exc:
        raise RuntimeError(
            "Install AWS Textract support with: python -m pip install -r requirements-aws.txt"
        ) from exc

    client = boto3.client("textract", region_name=os.getenv("AWS_REGION"))
    image_paths = image_path if isinstance(image_path, list) else [image_path]
    max_candidates = max(1, int(os.getenv("OCR_MAX_IMAGE_CANDIDATES", "5")))
    candidates = [
        _extract_textract_candidate(client, candidate_path)
        for candidate_path in image_paths[:max_candidates]
    ]
    if not candidates:
        raise RuntimeError("No OCR image candidates were generated.")

    best_candidate = _select_best_candidate(candidates)
    line_items = best_candidate.line_items
    lines = [line.text for line in line_items]
    mixed_document_context = _mixed_document_context(line_items)
    selection_context = _candidate_selection_context(candidates, best_candidate)
    coverage_context = _ocr_coverage_context(line_items)
    document_context = "\n\n".join(
        section
        for section in [selection_context, mixed_document_context, coverage_context]
        if section
    )

    cleaned_text = clean_ocr_text("\n".join(lines))
    enhanced_text, cleanup_provider = enhance_with_ai(
        cleaned_text,
        subject,
        context_text,
        best_candidate.image_path,
        document_context,
    )
    variant_name = best_candidate.image_path.stem
    provider_base = f"textract:{variant_name}"
    provider = provider_base if cleanup_provider == "rules" else f"{provider_base}+{cleanup_provider}"
    return {"provider": provider, "text": enhanced_text}


def _select_best_candidate(candidates: list[TextractCandidate]) -> TextractCandidate:
    if len(candidates) == 1:
        return candidates[0]

    max_chars = max(_meaningful_char_count(candidate.raw_text) for candidate in candidates) or 1
    max_lines = max(len(candidate.line_items) for candidate in candidates) or 1

    def adjusted_score(candidate: TextractCandidate) -> float:
        char_ratio = _meaningful_char_count(candidate.raw_text) / max_chars
        line_ratio = len(candidate.line_items) / max_lines
        completeness_bonus = char_ratio * 12 + line_ratio * 8
        return candidate.score + completeness_bonus

    return max(candidates, key=adjusted_score)


def _extract_textract_candidate(client, image_path: Path) -> TextractCandidate:
    response = client.detect_document_text(
        Document={"Bytes": image_path.read_bytes()},
    )
    blocks = response.get("Blocks", [])
    line_items = _extract_textract_lines(blocks)
    low_confidence_words = _extract_low_confidence_words(blocks)
    raw_text = "\n".join(line.text for line in line_items)
    score, quality_notes = _score_textract_candidate(line_items, raw_text)
    return TextractCandidate(
        image_path=image_path,
        line_items=line_items,
        low_confidence_words=low_confidence_words,
        raw_text=raw_text,
        score=score,
        quality_notes=quality_notes,
    )


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
    max_tokens = int(os.getenv("AI_CLEANUP_MAX_TOKENS", "4500"))

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
    enhanced = _postprocess_ai_transcription(enhanced, text)
    if _ai_verification_enabled() and enhanced:
        try:
            enhanced = _verify_with_bedrock(
                client=client,
                model_id=model_id,
                max_tokens=max_tokens,
                system=system,
                raw_text=text,
                cleaned_text=enhanced,
                subject_hint=subject_hint,
                context_hint=context_hint,
                document_context=document_context,
                image_block=image_block,
            )
        except Exception:
            if os.getenv("AI_CLEANUP_STRICT", "false").lower() == "true":
                raise
    return enhanced or text


def _verify_with_bedrock(
    client,
    model_id: str,
    max_tokens: int,
    system: str,
    raw_text: str,
    cleaned_text: str,
    subject_hint: str,
    context_hint: str,
    document_context: str,
    image_block: dict[str, object] | None,
) -> str:
    user_text = _bedrock_verification_prompt(
        raw_text=raw_text,
        cleaned_text=cleaned_text,
        subject_hint=subject_hint,
        context_hint=context_hint,
        document_context=document_context,
    )

    try:
        response = _converse_cleanup(client, model_id, max_tokens, system, user_text, image_block)
    except Exception:
        if image_block is None or os.getenv("AI_CLEANUP_STRICT", "false").lower() == "true":
            raise
        response = _converse_cleanup(client, model_id, max_tokens, system, user_text, None)

    content = response.get("output", {}).get("message", {}).get("content", [])
    verified = "".join(block.get("text", "") for block in content).strip()
    return _postprocess_ai_transcription(verified, cleaned_text) or cleaned_text


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


def _extract_low_confidence_words(blocks: list[dict]) -> list[str]:
    words: list[tuple[float, str]] = []
    for block in blocks:
        text = str(block.get("Text", "")).strip()
        if block.get("BlockType") != "WORD" or not text:
            continue
        confidence = float(block.get("Confidence") or 0)
        if confidence < 92:
            text_type = str(block.get("TextType", "")).lower()
            label = f"{text} ({confidence:.1f}%"
            if text_type:
                label += f", {text_type}"
            label += ")"
            words.append((confidence, label))

    words.sort(key=lambda item: item[0])
    return [word for _, word in words[:40]]


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


def _ocr_coverage_context(lines: list[TextractLine]) -> str:
    if not lines:
        return ""

    max_lines = max(20, int(os.getenv("AI_COVERAGE_MAX_LINES", "180")))
    max_chars = max(2000, int(os.getenv("AI_COVERAGE_MAX_CHARS", "14000")))
    context_lines = [
        "OCR coverage checklist:",
        f"- Detected OCR lines: {len(lines)}",
        "- Before writing the final answer, account for every readable line below.",
        "- Do not ignore short lines, labels, margin notes, headings, crossed-looking notes, side notes, or repeated handwritten lines.",
        "- Merge lines only when they are visibly part of the same sentence or equation.",
        "- If a line is low confidence or visually unclear, include the safest reading with [unclear] instead of dropping it.",
        "- The final answer should not show these line IDs; use them only to prevent omissions.",
        "Detected lines in page order:",
    ]

    current_chars = sum(len(line) + 1 for line in context_lines)
    emitted = 0
    for index, line in enumerate(lines[:max_lines], start=1):
        item = f"L{index:03d} [{line.text_type}; confidence {line.confidence:.1f}] {line.text}"
        if current_chars + len(item) + 1 > max_chars:
            break
        context_lines.append(item)
        current_chars += len(item) + 1
        emitted += 1

    if emitted < len(lines):
        context_lines.append(
            f"- Coverage list truncated after {emitted} lines; still use the full OCR draft and image for remaining visible content."
        )

    return "\n".join(context_lines)


def _score_textract_candidate(lines: list[TextractLine], text: str) -> tuple[float, str]:
    if not lines:
        return -1000.0, "no readable lines"

    confidences = [line.confidence for line in lines if line.confidence > 0]
    avg_confidence = sum(confidences) / len(confidences) if confidences else 0.0
    meaningful_chars = _meaningful_char_count(text)
    line_count = len(lines)
    handwritten_count = sum(
        1 for line in lines if line.text_type in {"handwritten", "handwritten annotation"}
    )
    printed_count = sum(1 for line in lines if line.text_type == "printed")
    garbage_ratio = _garbage_ratio(text)
    repetition_penalty = _repetition_penalty(lines)
    short_line_penalty = max(0, 8 - meaningful_chars) * 4

    score = (
        avg_confidence * 1.12
        + min(meaningful_chars, 5000) / 70
        + min(line_count, 80) * 1.8
        + min(handwritten_count, 30) * 1.4
        + min(printed_count, 40) * 0.8
        - garbage_ratio * 65
        - repetition_penalty
        - short_line_penalty
    )
    quality_notes = (
        f"score={score:.1f}; avg_confidence={avg_confidence:.1f}; "
        f"lines={line_count}; meaningful_chars={meaningful_chars}; "
        f"handwritten_or_annotation_lines={handwritten_count}; printed_lines={printed_count}; "
        f"garbage_ratio={garbage_ratio:.2f}"
    )
    return score, quality_notes


def _meaningful_char_count(text: str) -> int:
    return len(re.findall(r"[A-Za-z0-9]", text))


def _garbage_ratio(text: str) -> float:
    if not text:
        return 1.0
    compact = re.sub(r"\s+", "", text)
    if not compact:
        return 1.0
    suspicious = len(re.findall(r"[^A-Za-z0-9\s.,;:!?()[\]{}+\-*/=<>^_×≤≥≠'\"%$#&@]", compact))
    orphan_symbols = len(re.findall(r"(?<![A-Za-z0-9])[+\-*/=<>^_×≤≥≠]{2,}(?![A-Za-z0-9])", compact))
    return min(1.0, (suspicious + orphan_symbols * 2) / max(1, len(compact)))


def _repetition_penalty(lines: list[TextractLine]) -> float:
    normalized = [re.sub(r"\W+", "", line.text.lower()) for line in lines if line.text.strip()]
    normalized = [line for line in normalized if line]
    if len(normalized) < 4:
        return 0.0
    unique_ratio = len(set(normalized)) / len(normalized)
    return 18.0 if unique_ratio < 0.45 else 0.0


def _candidate_selection_context(
    candidates: list[TextractCandidate],
    best_candidate: TextractCandidate,
) -> str:
    lines = ["OCR preprocessing candidate selection:"]
    ranked_candidates = _rank_candidates_for_context(candidates, best_candidate)
    if len(candidates) > 1:
        for candidate in ranked_candidates:
            marker = "selected" if candidate.image_path == best_candidate.image_path else "alternate"
            lines.append(f"- {candidate.image_path.stem}: {marker}; {candidate.quality_notes}")
        lines.append(
            "The selected preprocessing candidate balanced confidence and completeness. Use alternate "
            "OCR readings as supporting evidence for ambiguous symbols, but use the image as the final "
            "authority."
        )
    else:
        lines.append(f"- {best_candidate.image_path.stem}: selected; {best_candidate.quality_notes}")

    if best_candidate.low_confidence_words:
        lines.append("Lowest-confidence OCR words from the selected candidate:")
        lines.extend(f"- {word}" for word in best_candidate.low_confidence_words)

    if len(candidates) > 1:
        lines.append("Alternative OCR readings for comparison:")
        for candidate in ranked_candidates[:3]:
            marker = "selected" if candidate.image_path == best_candidate.image_path else "alternate"
            excerpt = _ocr_excerpt(candidate.raw_text)
            if excerpt:
                lines.append(f"{candidate.image_path.stem} ({marker}):\n{excerpt}")
    return "\n".join(lines)


def _rank_candidates_for_context(
    candidates: list[TextractCandidate],
    best_candidate: TextractCandidate,
) -> list[TextractCandidate]:
    alternates = [
        candidate for candidate in candidates if candidate.image_path != best_candidate.image_path
    ]
    alternates.sort(key=lambda item: item.score, reverse=True)
    return [best_candidate, *alternates]


def _ocr_excerpt(text: str, max_chars: int = 900) -> str:
    cleaned = clean_ocr_text(text)
    if len(cleaned) <= max_chars:
        return cleaned
    return cleaned[:max_chars].rsplit("\n", 1)[0].strip() + "\n[...]"


def _bedrock_system_prompt() -> str:
    return (
        "You faithfully transcribe and organize OCR text from student handwritten notes. "
        "Use a staged OCR reasoning process internally: first inspect visible characters and "
        "symbols, then reconstruct words, then reconstruct lines/sentences, and only then create "
        "a short separate summary if requested by the output format. "
        "Your primary job is transcription, not summarization. "
        "Do not abridge, condense, or simplify the transcription. "
        "Correct obvious OCR/spelling mistakes, preserve meaning, "
        "turn headings and bullet-like lines into clean structure without removing detail, "
        "preserve equations, units, symbols, names, and technical terms, "
        "use optional user context only to resolve likely OCR mistakes, "
        "perform a second-pass consistency check across the whole page, "
        "and do not add facts that are not present in the OCR text. "
        "If an image is provided, use it to verify layout, diagrams, arrows, tables, "
        "equations, visual grouping, and ambiguous handwritten symbols. "
        "For math and science, produce a corrected transcription of what is visible. Never replace "
        "an equation with a different known formula, theorem, identity, explanation, or solution. "
        "Visual drawings are first-class note content, not decoration. If a drawing, triangle, "
        "graph, axis, table, flowchart, circuit, chemical sketch, or labeled diagram appears, "
        "describe its structure and relationships in text so the note remains searchable. "
        "For mixed documents, handle printed/typed text differently from handwritten annotations: "
        "printed/typed text should usually be preserved with minimal correction, while handwritten "
        "annotations should receive stronger visual/context review and be placed where they belong. "
        "Never invent missing definitions, examples, equations, values, or explanations. "
        "Never omit readable handwritten lines just because they are repetitive, informal, or messy. "
        "Completeness is more important than neatness: every readable text region, line, label, "
        "annotation, and equation should be represented in the final transcription. "
        "If handwriting is unclear, mark it as [unclear] instead of guessing. "
        "Never let a summary replace the transcription. "
        "Return a faithful cleaned transcription using clear headings and bullets. "
        "Do not wrap the answer in a markdown code fence. "
        "If you include corrections, group repeated corrections once and never repeat the same "
        "correction line more than once."
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
    subject_instruction = _subject_specific_prompt(subject_hint)
    forensic_instruction = _forensic_transcription_prompt(_forensic_json_output_enabled())
    return (
        f"Subject mode: {subject_hint}.\n"
        f"Optional user context: {context_hint or 'none provided'}.\n"
        f"Document analysis context:\n{document_context or 'none provided'}.\n"
        f"{visual_instruction}"
        f"{math_instruction}"
        f"{subject_instruction}"
        f"{forensic_instruction}"
        "Staged OCR pipeline to follow internally:\n"
        "1. Character/symbol pass: inspect the image and OCR draft for ambiguous glyphs such as "
        "a/6, b/6, O/0, l/1, z/2, x/×, +/t, superscripts, brackets, and punctuation.\n"
        "2. Word pass: reconstruct words only when surrounding letters, word shape, OCR confidence, "
        "and the image support the correction. Keep unclear words as [unclear].\n"
        "3. Line/sentence pass: preserve the original line order and rebuild readable sentences "
        "without changing the author's meaning.\n"
        "4. Structure pass: add headings/bullets only to organize what is already present.\n"
        "5. Independent review pass: compare the literal transcription with the corrected "
        "transcription, then reject any correction that is not supported by repeated handwriting "
        "patterns, English grammar, mathematical consistency, or factual context visible on the page.\n"
        "6. Coverage pass: compare the final transcription against the OCR coverage checklist line "
        "by line. If a detected readable line, label, side note, heading, or equation is missing, "
        "add it in the correct nearby section before returning the answer. Do not mention line IDs "
        "in the final answer.\n"
        "Faithfully transcribe and structure these OCR notes for a student. "
        "Inside the transcription sections, do not summarize, shorten, abridge, merge away, "
        "or rewrite the notes into a study guide. "
        "The output should contain at least the same level of detail as the readable handwritten "
        "and printed source content. Preserve every readable line, list item, equation, label, "
        "abbreviation, example, and side note. Use headings and bullets only to organize the content, "
        "not to reduce it. "
        "Use the context only for terminology, abbreviations, and conservative OCR corrections. "
        "Do not add facts from the context unless they are supported by the OCR text. "
        "Do not complete partial math/science content from memory. "
        "Do not add generated explanations, extra formulas, or new examples. "
        "Treat OCR as a draft, not final truth, and use the image as the authority. If an image is "
        "attached, compare the OCR draft against the visual page before finalizing. First extract "
        "what is detected, then perform minimal context-aware correction only when confidence is "
        "very high. Build a page-level symbol inventory, then fix visually and contextually supported "
        "character substitutions using neighboring lines, repeated usage, grammar, and the image. "
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
        "when helpful. If the content contains equations or technical notation, keep it intact. "
        "Do not wrap the final answer in ```markdown or any code fence. "
        "If you include a 'Corrections made' section, it must contain at most 5 bullets, each "
        "unique. Combine repeated substitutions into one bullet, for example '6 -> b in repeated "
        "variable symbols.' Never list the same correction repeatedly.\n\n"
        f"OCR draft:\n{text}"
    )


def _math_symbol_verification_prompt() -> str:
    return (
        "Balanced mathematical transcription rules: enabled.\n"
        "Goal: output the author's intended visible equation, not the raw broken OCR and not a "
        "new formula from memory. Never replace an equation with a different known formula. "
        "Never infer formula names, theorem names, headings, explanations, solutions, or extra "
        "steps. Never convert one mathematical identity into another. Do not name formulas, "
        "classify formulas, explain formulas, solve equations, simplify expressions, or add "
        "mathematical context unless that wording is explicitly visible. "
        "Allowed corrections are limited to high-confidence OCR repair: obvious glyph confusions "
        "such as a/6, b/6, B/8, O/0, o/0, l/1, I/1, S/5, z/2, x/×, rn/m, vv/w, plus/t, "
        "minus/dash, missing parentheses, and superscripts when they are clearly intended by "
        "the image and surrounding symbols. "
        "Before applying a correction, verify that surrounding symbols, repeated variables, visual "
        "shape, and local equation syntax support it. Use mathematical syntax only to validate that "
        "a candidate transcription is plausible; do not use mathematical knowledge to generate new "
        "content. If one interpretation is overwhelmingly more likely than the raw OCR, output the "
        "corrected equation and mark it as an OCR-level correction. If uncertainty remains, preserve "
        "the uncertain symbol as [?] or list the alternatives under 'Possible OCR Ambiguities'. "
        "Before returning the final markdown, run a verification pass: remove any formula name, "
        "theorem name, heading, variable, operator, exponent, constant, or equation that is not "
        "visible in the image or supported by a high-confidence OCR repair. Do not create section "
        "titles such as 'Law of Cosines' or 'Difference of Squares' unless those exact words are "
        "visible. "
        "When you make a conservative symbol correction, add a brief 'Corrections made' section "
        "after the transcription. Explain only OCR-level corrections, for example '6 -> b because "
        "the same handwritten symbol appears as b elsewhere on the page.' Do not justify a correction "
        "by naming or applying a mathematical identity. List each distinct correction once only. "
        "The 'Corrections made' section must have at most 5 bullets total. If the OCR is too degraded "
        "to support a correction, do not force the correction; keep the uncertain symbol as [?] or "
        "[unclear]. If no meaningful correction was made, omit "
        "that section.\n"
    )


def _subject_specific_prompt(subject_hint: str) -> str:
    if "kids homework" not in subject_hint:
        return ""

    return (
        "Kids homework mode: enabled.\n"
        "This is a parent-supervised learning notebook mode. Preserve child-written work "
        "faithfully and use a calm, supportive tone. Do not shame, grade, or score the child. "
        "Do not add open-ended tutoring chat, personal questions, or content unrelated to the "
        "visible page. If the page is a worksheet, separate printed worksheet prompts from "
        "child handwritten answers when possible. Treat printed worksheet text as high-confidence "
        "source text, and child handwriting as lower-confidence text that may require visual review. "
        "For spelling practice, preserve the child's visible spelling first, then optionally add "
        "a short 'Possible unclear words' section only when the handwriting is ambiguous. "
        "For arithmetic, transcribe the visible work and mark unclear digits as [unclear] rather "
        "than guessing. Do not solve additional problems or create new practice questions. "
        "For drawings, preserve labels, shapes, arrows, and simple visual relationships so a "
        "parent can recognize what the child drew.\n"
    )


def _visual_notes_enabled() -> bool:
    return os.getenv("AI_VISUAL_NOTES", "true").lower() in {"1", "true", "yes", "on"}


def _ai_verification_enabled() -> bool:
    return os.getenv("AI_VERIFICATION_PASS", "true").lower() in {"1", "true", "yes", "on"}


def _forensic_json_output_enabled() -> bool:
    return os.getenv("AI_FORENSIC_JSON_OUTPUT", "false").lower() in {"1", "true", "yes", "on"}


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


def _forensic_transcription_prompt(json_output: bool = False) -> str:
    output_instruction = (
        "Return JSON only, with this exact top-level shape:\n"
        '{\n'
        '  "math": [\n'
        '    {"original": "", "corrected": "", "latex": "", "confidence": 98}\n'
        "  ],\n"
        '  "text": {\n'
        '    "literal": "",\n'
        '    "corrected": "",\n'
        '    "corrections": [\n'
        '      {"from": "", "to": "", "confidence": 95, "reason": ""}\n'
        "    ]\n"
        "  }\n"
        "}\n"
        "Use valid JSON strings only. Do not include markdown or code fences.\n"
        if json_output
        else (
            "Return readable text sections, not raw JSON:\n"
            "Literal Transcription\n"
            "- Preserve line breaks and write exactly what is readable from OCR/image, using "
            "[unclear] for unreadable words or symbols.\n"
            "Corrected Transcription\n"
            "- Fix only obvious OCR or handwriting interpretation errors.\n"
            "Mathematical Expressions\n"
            "- Separate math from prose when present and preserve notation using LaTeX where helpful.\n"
            "Corrections made\n"
            "- For every correction, include original text, corrected text, confidence 0-100%, "
            "and the reason. List each distinct correction once.\n"
            "Possible Alternatives\n"
            "- Include this only when multiple readings are plausible.\n"
        )
    )

    return (
        "Forensic handwriting transcription rules: enabled.\n"
        "Task:\n"
        "1. Read the handwritten image exactly as written.\n"
        "2. Produce a literal transcription first, preserving line breaks.\n"
        "3. Then produce a corrected transcription by fixing only obvious OCR or handwriting "
        "interpretation errors.\n"
        "4. Do not invent missing words.\n"
        "5. Use context, repeated letter shapes, grammar, and surrounding text to resolve ambiguous "
        "characters.\n"
        "6. For every correction, provide original text, corrected text, confidence 0-100%, and "
        "reason for the correction.\n"
        "7. If multiple readings are plausible, list the alternatives instead of guessing.\n"
        "8. Preserve mathematical notation using LaTeX.\n"
        "9. Separate mathematical expressions from prose.\n"
        "10. Mark anything unreadable as [unclear] instead of hallucinating.\n"
        "After producing the corrected transcription, perform a second independent review. Compare "
        "the literal transcription with the corrected version. Reject any correction that is not "
        "supported by repeated handwriting patterns, English grammar, mathematical consistency, or "
        "factual context visible in the page/OCR evidence. Prefer uncertainty over incorrect "
        "corrections.\n"
        f"{output_instruction}"
    )


def _bedrock_verification_prompt(
    raw_text: str,
    cleaned_text: str,
    subject_hint: str,
    context_hint: str,
    document_context: str,
) -> str:
    return (
        "Final OCR verification pass.\n"
        "You are checking a proposed Cleanote transcription against the noisy OCR draft and, when "
        "provided, the image. Your job is not to improve style. Your job is to decide whether the "
        "proposed transcription is faithful, readable, and supported by visible evidence.\n\n"
        f"Subject mode: {subject_hint}.\n"
        f"Optional user context: {context_hint or 'none provided'}.\n"
        f"Document analysis context:\n{document_context or 'none provided'}.\n\n"
        "Verification method:\n"
        "1. Read the raw OCR draft as noisy evidence, not as final truth.\n"
        "2. Read the proposed cleaned transcription as a candidate final answer.\n"
        "3. If a line, word, equation, or label in the cleaned transcription seems unsupported, "
        "compare it to the OCR draft and the image character by character around the mismatch.\n"
        "4. Compare the candidate final answer against the OCR coverage checklist in the document "
        "analysis context. If a readable OCR line, handwritten side note, label, table row, diagram "
        "label, heading, or equation is missing from the candidate answer, restore it in the most "
        "appropriate nearby section. Do not show OCR line IDs in the final answer.\n"
        "5. Use sentence meaning only as a warning signal. Meaning can tell you where to recheck, "
        "but it cannot justify inventing content. Use semantic consistency to choose between "
        "visually similar OCR candidates only, such as b/6, a/6, O/0, o/0, l/1, I/1, S/5, "
        "z/2, x/×, rn/m, vv/w, +/t, and missing superscripts or brackets.\n"
        "6. Apply minimal corrections only when the surrounding visible characters, OCR tokens, "
        "line order, repeated symbols, and page context strongly support them.\n"
        "7. Preserve the author's original wording and detail level. Do not rewrite notes into a "
        "study guide, factsheet, answer key, or explanation.\n"
        "8. Remove or replace unsupported additions with [unclear]. Unsupported additions include "
        "formula names, theorem names, definitions, geography facts, values, labels, or equations "
        "that are not visible or directly recoverable from OCR evidence.\n"
        "9. For mathematics, verify every variable, operator, exponent, bracket, and number against "
        "the page. Use math syntax only to identify suspicious OCR, not to generate a known formula. "
        "Never replace a visible equation with a different formula. If OCR reads '6' in a place "
        "where the same handwritten mark is used as variable 'b' elsewhere and the equation remains "
        "locally consistent as 'b', correct 6 -> b. If both are plausible, mark the character as "
        "[?] and list the ambiguity instead of guessing.\n"
        "10. For printed plus handwritten documents, keep printed text close to its source and use "
        "the recheck mainly for handwritten annotations and low-confidence words.\n"
        "11. Final sense check: every sentence should be grammatical when the handwriting supports "
        "that reading, and every equation should be locally coherent when the symbols support that "
        "reading. Fix OCR-level nonsense, but do not add explanations or facts.\n"
        "12. Compare the literal transcription against the corrected transcription. Reject any "
        "correction that is not supported by repeated handwriting patterns, English grammar, "
        "mathematical consistency, or factual context visible in the page/OCR evidence.\n"
        "13. For every remaining correction, make sure original text, corrected text, confidence, "
        "and reason are present. If confidence is below 90%, move it to alternatives/ambiguities "
        "instead of applying it.\n"
        "14. If the cleaned transcription is already faithful and complete, return it unchanged.\n\n"
        "Return only the corrected final answer in the same section format as the proposed "
        "transcription. If the proposed transcription is JSON, return valid JSON only with the same "
        "top-level keys. Do not include your verification notes, chain of thought, or a code fence. "
        "Keep 'Corrections made' to at most 5 unique OCR-level corrections, and include only "
        "corrections actually applied during transcription.\n\n"
        f"Raw OCR draft:\n{raw_text}\n\n"
        f"Proposed cleaned transcription:\n{cleaned_text}"
    )


def _postprocess_ai_transcription(enhanced: str, fallback_text: str) -> str:
    enhanced = _strip_markdown_fence(enhanced.strip())
    if not enhanced:
        return fallback_text

    enhanced = _collapse_repeated_corrections(enhanced)
    if _looks_like_runaway_response(enhanced):
        return _strip_markdown_fence(fallback_text.strip())
    return enhanced


def _strip_markdown_fence(text: str) -> str:
    text = text.strip()
    fenced = re.fullmatch(r"```(?:markdown|md|text)?\s*(.*?)\s*```", text, flags=re.I | re.S)
    if fenced:
        return fenced.group(1).strip()
    text = re.sub(r"^```(?:markdown|md|text)?\s*", "", text, flags=re.I).strip()
    text = re.sub(r"\s*```$", "", text).strip()
    return text


def _collapse_repeated_corrections(text: str) -> str:
    match = re.search(
        r"(?im)^#{0,3}\s*Corrections made\s*$",
        text,
    )
    if not match:
        return _dedupe_adjacent_lines(text)

    before = text[: match.start()].rstrip()
    section_and_after = text[match.end() :].strip()
    next_heading = re.search(r"(?m)^\s*#{1,3}\s+\S", section_and_after)
    if next_heading:
        correction_block = section_and_after[: next_heading.start()].strip()
        after = section_and_after[next_heading.start() :].strip()
    else:
        correction_block = section_and_after
        after = ""

    bullets = re.findall(r"(?m)^\s*[-*]\s+(.+?)\s*$", correction_block)
    if not bullets:
        return text

    unique_bullets: list[str] = []
    seen: set[str] = set()
    duplicate_counts: dict[str, int] = {}
    for bullet in bullets:
        normalized = _normalize_correction_bullet(bullet)
        duplicate_counts[normalized] = duplicate_counts.get(normalized, 0) + 1
        if normalized in seen:
            continue
        seen.add(normalized)
        unique_bullets.append(bullet.strip())

    collapsed: list[str] = []
    for bullet in unique_bullets[:5]:
        normalized = _normalize_correction_bullet(bullet)
        count = duplicate_counts.get(normalized, 1)
        if count > 1:
            collapsed.append(f"- {bullet} (grouped from repeated OCR corrections)")
        else:
            collapsed.append(f"- {bullet}")

    parts = [before, "Corrections made", "\n".join(collapsed)]
    if len(unique_bullets) > 5:
        parts.append("- Additional repeated correction notes omitted.")
    if after:
        parts.append(after)
    return "\n\n".join(part for part in parts if part).strip()


def _normalize_correction_bullet(bullet: str) -> str:
    bullet = re.sub(r"\s+", " ", bullet.strip().lower())
    bullet = re.sub(r"\b\d+\s+time[s]?\b", "repeated", bullet)
    return bullet


def _dedupe_adjacent_lines(text: str) -> str:
    cleaned_lines: list[str] = []
    previous = ""
    repeat_count = 0
    for line in text.splitlines():
        normalized = re.sub(r"\s+", " ", line.strip().lower())
        if normalized and normalized == previous:
            repeat_count += 1
            if repeat_count > 1:
                continue
        else:
            previous = normalized
            repeat_count = 0
        cleaned_lines.append(line)
    return "\n".join(cleaned_lines).strip()


def _looks_like_runaway_response(text: str) -> bool:
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    if len(lines) < 30:
        return False
    normalized = [re.sub(r"\W+", "", line.lower()) for line in lines if line]
    normalized = [line for line in normalized if line]
    if not normalized:
        return False
    unique_ratio = len(set(normalized)) / len(normalized)
    correction_lines = sum(1 for line in lines if re.match(r"^[-*]\s+.+->.+", line))
    return unique_ratio < 0.25 or correction_lines > 20


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
        "kids": "kids homework",
        "kids homework": "kids homework",
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
