from __future__ import annotations

import os
from typing import Any

try:
    import boto3
    from boto3.dynamodb.conditions import Attr, Key
except ImportError:  # pragma: no cover - local non-AWS installs can still run OCR mock mode.
    boto3 = None
    Attr = None
    Key = None


def save_note(note: dict[str, str]) -> dict[str, str]:
    _ensure_configured()
    normalized_email = _normalize_email(note["email"])
    note_id = note["id"].strip()
    if not note_id:
        raise ValueError("Note id is required.")

    item = {
        "email": normalized_email,
        "note_id": note_id,
        "created_at": note["createdAt"],
        "filename": note.get("filename", "Untitled note").strip() or "Untitled note",
        "provider": note.get("provider", "edited").strip() or "edited",
        "subject": note.get("subject", "general").strip() or "general",
        "text": note.get("text", ""),
    }
    item["search_blob"] = _search_blob(item)
    _table().put_item(Item=item)
    return {"status": "saved", "id": note_id}


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
        }
        for item in response.get("Items", [])
    ]
    notes.sort(key=lambda note: note["createdAt"], reverse=True)
    return {"notes": notes[:safe_limit]}


def _search_blob(item: dict[str, str]) -> str:
    return " ".join(
        [
            item.get("filename", ""),
            item.get("provider", ""),
            item.get("subject", ""),
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


def _normalize_email(email: str) -> str:
    normalized = email.strip().lower()
    if "@" not in normalized or "." not in normalized.split("@")[-1]:
        raise ValueError("A verified email is required for cloud note search.")
    return normalized


def _aws_region() -> str:
    return os.getenv("AWS_REGION") or os.getenv("AWS_DEFAULT_REGION") or "us-east-1"
