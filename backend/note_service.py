from __future__ import annotations

import base64
import hashlib
import os
import re
from typing import Any

try:
    import boto3
    from boto3.dynamodb.conditions import Attr, Key
except ImportError:  # pragma: no cover - local non-AWS installs can still run OCR mock mode.
    boto3 = None
    Attr = None
    Key = None


MAX_IMAGE_BYTES = 900_000
DATA_URL_PATTERN = re.compile(r"^data:(image/(?:jpeg|jpg|png|webp));base64,(.+)$", re.IGNORECASE | re.DOTALL)


def save_note(note: dict[str, Any]) -> dict[str, str]:
    _ensure_configured()
    normalized_email = _normalize_email(note["email"])
    note_id = note["id"].strip()
    if not note_id:
        raise ValueError("Note id is required.")
    image_key = note.get("imageKey") or ""
    if note.get("imageData"):
        image_key = _save_note_image(normalized_email, note_id, str(note["imageData"]))

    item = {
        "email": normalized_email,
        "note_id": note_id,
        "created_at": note["createdAt"],
        "filename": note.get("filename", "Untitled note").strip() or "Untitled note",
        "provider": note.get("provider", "edited").strip() or "edited",
        "subject": note.get("subject", "general").strip() or "general",
        "text": note.get("text", ""),
        "context_text": note.get("contextText", ""),
    }
    if image_key:
        item["image_key"] = image_key
    item["search_blob"] = _search_blob(item)
    _table().put_item(Item=item)
    response = {"status": "saved", "id": note_id}
    if image_key:
        response["imageKey"] = image_key
        image_url = _presigned_image_url(image_key)
        if image_url:
            response["imageUrl"] = image_url
    return response


def search_notes(email: str, query: str = "", limit: int = 30) -> dict[str, Any]:
    _ensure_configured()
    normalized_email = _normalize_email(email)
    safe_limit = max(1, min(limit, 50))
    query_text = query.strip().lower()

    query_kwargs: dict[str, Any] = {
        "KeyConditionExpression": Key("email").eq(normalized_email),
        "Limit": 100,
    }
    if query_text:
        query_kwargs["FilterExpression"] = Attr("search_blob").contains(query_text)

    response = _table().query(**query_kwargs)
    notes = [
        {
            "id": item["note_id"],
            "createdAt": item.get("created_at", ""),
            "filename": item.get("filename", "Untitled note"),
            "provider": item.get("provider", "edited"),
            "subject": item.get("subject", "general"),
            "text": item.get("text", ""),
            "contextText": item.get("context_text", ""),
            "imageKey": item.get("image_key", ""),
            "imageUrl": _presigned_image_url(item.get("image_key", "")),
        }
        for item in response.get("Items", [])
    ]
    notes.sort(key=lambda note: note["createdAt"], reverse=True)
    return {"notes": notes[:safe_limit]}


def delete_note(email: str, note_id: str) -> dict[str, str]:
    _ensure_configured()
    normalized_email = _normalize_email(email)
    normalized_note_id = note_id.strip()
    if not normalized_note_id:
        raise ValueError("Note id is required.")

    existing = _table().get_item(Key={"email": normalized_email, "note_id": normalized_note_id}).get("Item")
    if existing and existing.get("image_key"):
        _delete_note_image(existing["image_key"])
    _table().delete_item(Key={"email": normalized_email, "note_id": normalized_note_id})
    return {"status": "deleted", "id": normalized_note_id}


def _search_blob(item: dict[str, str]) -> str:
    return " ".join(
        [
            item.get("filename", ""),
            item.get("provider", ""),
            item.get("subject", ""),
            item.get("context_text", ""),
            item.get("text", ""),
        ]
    ).lower()


def _ensure_configured() -> None:
    if not os.getenv("NOTE_TABLE_NAME"):
        raise RuntimeError("Cloud note search is not configured yet. Missing: NOTE_TABLE_NAME")
    if boto3 is None or Key is None or Attr is None:
        raise RuntimeError("Install AWS support with: python -m pip install -r requirements-aws.txt")


def _table():
    dynamodb = boto3.resource("dynamodb", region_name=_aws_region())
    return dynamodb.Table(os.environ["NOTE_TABLE_NAME"])


def _s3_client():
    return boto3.client("s3", region_name=_aws_region())


def _image_bucket() -> str:
    return os.getenv("NOTE_IMAGES_BUCKET_NAME", "").strip()


def _save_note_image(email: str, note_id: str, image_data: str) -> str:
    bucket = _image_bucket()
    if not bucket:
        raise RuntimeError("Cloud image saving is not configured yet. Missing: NOTE_IMAGES_BUCKET_NAME")

    match = DATA_URL_PATTERN.match(image_data)
    if not match:
        raise ValueError("Image must be a compressed image data URL.")

    content_type = match.group(1).lower().replace("image/jpg", "image/jpeg")
    try:
        image_bytes = base64.b64decode(match.group(2), validate=True)
    except Exception as exc:
        raise ValueError("Image data is not valid base64.") from exc

    if not image_bytes:
        raise ValueError("Image data is empty.")
    if len(image_bytes) > MAX_IMAGE_BYTES:
        raise ValueError("Compressed image is too large. Try a clearer single slate photo.")

    extension = "jpg" if content_type == "image/jpeg" else content_type.split("/")[-1]
    email_hash = hashlib.sha256(email.encode("utf-8")).hexdigest()[:24]
    safe_note_id = re.sub(r"[^A-Za-z0-9_.-]", "-", note_id)[:96]
    image_key = f"notes/{email_hash}/{safe_note_id}.{extension}"

    _s3_client().put_object(
        Bucket=bucket,
        Key=image_key,
        Body=image_bytes,
        ContentType=content_type,
        ServerSideEncryption="AES256",
        Metadata={"note-id": safe_note_id},
    )
    return image_key


def _presigned_image_url(image_key: str) -> str:
    bucket = _image_bucket()
    if not bucket or not image_key:
        return ""
    try:
        return _s3_client().generate_presigned_url(
            "get_object",
            Params={"Bucket": bucket, "Key": image_key},
            ExpiresIn=900,
        )
    except Exception:
        return ""


def _delete_note_image(image_key: str) -> None:
    bucket = _image_bucket()
    if not bucket or not image_key:
        return
    try:
        _s3_client().delete_object(Bucket=bucket, Key=image_key)
    except Exception:
        return


def _normalize_email(email: str) -> str:
    normalized = email.strip().lower()
    if "@" not in normalized or "." not in normalized.split("@")[-1]:
        raise ValueError("A verified email is required for cloud note search.")
    return normalized


def _aws_region() -> str:
    return os.getenv("AWS_REGION") or os.getenv("AWS_DEFAULT_REGION") or "us-east-1"
