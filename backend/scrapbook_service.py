"""Complete, private scrapbook PDF exports with image captions."""
from __future__ import annotations
import base64
import hashlib
import io
import re
from datetime import datetime
from html import escape
from pathlib import Path
import note_service as notes


def caption(text: str, title: str) -> str:
    source = re.split(r"Possible transcription ambiguities|Corrections made|Verification unavailable", text)[0]
    source = " ".join(source.split())
    if not source or source.startswith("Slate Scrapbook Memory"):
        source = title
    return source[:177].rstrip() + "..." if len(source) > 180 else source


def cloud_pages(email: str) -> list[dict]:
    notes._ensure_configured()
    email = notes._normalize_email(email)
    table = notes._table()
    paginator = table.meta.client.get_paginator("query")
    items = []
    for page in paginator.paginate(TableName=table.name, KeyConditionExpression=notes.Key("email").eq(email)):
        items.extend(item for item in page.get("Items", []) if item.get("image_key"))
    items.sort(key=lambda item: (item.get("created_at", ""), item["note_id"]))
    s3 = notes._s3_client()
    expected_prefix = "notes/" + hashlib.sha256(email.encode()).hexdigest()[:24] + "/"
    result = []
    for item in items:
        key = item["image_key"]
        if not key.startswith(expected_prefix):
            raise ValueError("A scrapbook image does not belong to this account.")
        try:
            with s3.get_object(Bucket=notes._image_bucket(), Key=key)["Body"] as body:
                image = body.read(notes.MAX_IMAGE_BYTES + 1)
        except s3.exceptions.NoSuchKey as exc:
            raise ValueError("A saved scrapbook image is unavailable. Restore it before ordering the complete book.") from exc
        if not image or len(image) > notes.MAX_IMAGE_BYTES:
            raise ValueError("A saved scrapbook image cannot be printed.")
        result.append({"id": item["note_id"], "title": item.get("filename", "A little memory"),
                       "createdAt": item.get("created_at", ""), "text": item.get("text", ""), "image": image})
    return result


def local_page(page: dict) -> dict:
    match = notes.DATA_URL_PATTERN.match(page.get("imageData", ""))
    if not match:
        raise ValueError("Save each local scrapbook image before exporting.")
    try:
        image = base64.b64decode(match.group(2), validate=True)
    except ValueError as exc:
        raise ValueError("A scrapbook image is invalid.") from exc
    if not image or len(image) > notes.MAX_IMAGE_BYTES:
        raise ValueError("A scrapbook image is too large to print.")
    return {**page, "image": image}


def export_scrapbook(email: str | None, local: list[dict]) -> tuple[bytes, int]:
    pages = cloud_pages(email) if email else []
    existing = {page["id"] for page in pages}
    for page in local:
        if page["id"] not in existing:
            pages.append(local_page(page))
            existing.add(page["id"])
    if not pages:
        raise ValueError("There are no saved scrapbook images yet. Save a slate capture or Kids Mode drawing first.")
    pages.sort(key=lambda page: (page.get("createdAt", ""), page["id"]))
    return render_scrapbook(pages), len(pages)


def render_scrapbook(pages: list[dict]) -> bytes:
    from reportlab.pdfgen import canvas
    from reportlab.lib.colors import HexColor
    from reportlab.lib.utils import ImageReader
    from reportlab.platypus import Paragraph
    from reportlab.lib.styles import ParagraphStyle
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont
    import reportlab
    font_path = Path(reportlab.__file__).parent / "fonts/Vera.ttf"
    if "Scrapbook" not in pdfmetrics.getRegisteredFontNames():
        pdfmetrics.registerFont(TTFont("Scrapbook", str(font_path)))
    output = io.BytesIO()
    book = canvas.Canvas(output, pagesize=(612, 792), pageCompression=1)
    book.setTitle("Cleanote - Entire Scrapbook")
    title_style = ParagraphStyle("title", fontName="Scrapbook", fontSize=17, leading=22, textColor=HexColor("#26324a"))
    summary_style = ParagraphStyle("summary", fontName="Scrapbook", fontSize=11, leading=16, textColor=HexColor("#26324a"))
    for index, page in enumerate(pages):
        book.setFillColor(HexColor("#fff9ec")); book.rect(0, 0, 612, 792, fill=1, stroke=0)
        for x, y, color in [(25, 750, "#ffdf86"), (586, 685, "#d5f0e8"), (18, 210, "#e6dcfa")]:
            book.setFillColor(HexColor(color)); book.circle(x, y, 28, fill=1, stroke=0)
        book.setFillColor(HexColor("#fffefd")); book.roundRect(38, 40, 536, 710, 20, fill=1, stroke=0)
        book.setFillColor(HexColor("#138b76")); book.setFont("Scrapbook", 9)
        book.drawString(58, 721, "CLEANOTE  /  LITTLE MEMORIES")
        title = Paragraph(escape(page.get("title", "A little memory")[:100]), title_style)
        _, title_height = title.wrap(492, 50)
        title.drawOn(book, 58, 697 - title_height)
        try: date = datetime.fromisoformat(page.get("createdAt", "").replace("Z", "+00:00")).strftime("%d %b %Y")
        except ValueError: date = "A saved memory"
        book.setFillColor(HexColor("#697385")); book.setFont("Scrapbook", 9); book.drawString(58, 640, date)
        try:
            image = ImageReader(io.BytesIO(page["image"]))
            image_width, image_height = image.getSize()
        except Exception as exc:
            raise ValueError("A scrapbook image could not be read. Restore the image before ordering.") from exc
        scale = min(492 / image_width, 444 / image_height)
        width, height = image_width * scale, image_height * scale
        book.drawImage(image, (612-width)/2, 184 + (444-height)/2, width, height, mask="auto")
        book.setFillColor(HexColor("#eef8f2")); book.roundRect(58, 69, 496, 100, 12, fill=1, stroke=0)
        book.setFillColor(HexColor("#138b76")); book.setFont("Scrapbook", 9); book.drawString(74, 147, "A LITTLE NOTE ABOUT THIS MOMENT")
        summary = Paragraph(escape(caption(page.get("text", ""), page.get("title", "A little memory"))), summary_style)
        _, summary_height = summary.wrap(464, 68)
        summary.drawOn(book, 74, 131-summary_height)
        book.setFillColor(HexColor("#697385")); book.setFont("Scrapbook", 8)
        book.drawString(58, 24, "Print enquiries: info@cleanote.in")
        book.drawRightString(554, 24, f"{index+1} / {len(pages)}")
        book.showPage()
    book.save()
    return output.getvalue()
