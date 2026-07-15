from __future__ import annotations

from datetime import UTC, datetime
import os
from typing import Any
from uuid import uuid4

try:
    import boto3
except ImportError:  # pragma: no cover - local non-AWS installs can still run OCR mock mode.
    boto3 = None


def record_scan_event(event: dict[str, Any]) -> None:
    table_name = os.getenv("SCAN_EVENTS_TABLE_NAME")
    if not table_name or boto3 is None:
        return

    try:
        item = {
            "scan_id": event.get("event_id") or str(uuid4()),
            "created_at": event.get("created_at") or _now_iso(),
            "identity_hash": event.get("identity_hash", ""),
            "identity_type": event.get("identity_type", ""),
            "filename": event.get("filename", ""),
            "file_type": event.get("file_type", ""),
            "file_size_bytes": int(event.get("file_size_bytes") or 0),
            "provider": event.get("provider", ""),
            "cleanup_mode": event.get("cleanup_mode", ""),
            "cache_hit": bool(event.get("cache_hit", False)),
            "subject": event.get("subject", "general"),
            "status": event.get("status", "unknown"),
            "page_count": int(event.get("page_count") or 1),
            "text_length": int(event.get("text_length") or 0),
            "textract_calls": int(event.get("textract_calls") or 0),
            "textract_pages": int(event.get("textract_pages") or 0),
            "bedrock_used": bool(event.get("bedrock_used", False)),
            "bedrock_input_tokens": int(event.get("bedrock_input_tokens") or 0),
            "bedrock_output_tokens": int(event.get("bedrock_output_tokens") or 0),
            "estimated_textract_micro_usd": int(event.get("estimated_textract_micro_usd") or 0),
            "estimated_bedrock_micro_usd": int(event.get("estimated_bedrock_micro_usd") or 0),
            "estimated_storage_micro_usd": int(event.get("estimated_storage_micro_usd") or 0),
            "estimated_total_micro_usd": int(event.get("estimated_total_micro_usd") or 0),
            "subscription_tier": event.get("subscription_tier", ""),
            "idempotency_key_hash": event.get("idempotency_key_hash", ""),
            "error_message": event.get("error_message", ""),
        }
        _table(table_name).put_item(Item=item)
    except Exception:
        return


def scan_summary() -> dict[str, Any]:
    table_name = os.getenv("SCAN_EVENTS_TABLE_NAME")
    if not table_name or boto3 is None:
        return _empty_summary(configured=False)

    try:
        events = _scan_all(table_name)
    except Exception:
        return _empty_summary(configured=True, available=False)

    by_status: dict[str, int] = {}
    by_subject: dict[str, int] = {}
    total_scans = 0
    successful_scans = 0
    failed_scans = 0
    estimated_total_micro_usd = 0
    cache_hits = 0

    for event in events:
        total_scans += 1
        status = event.get("status", "unknown")
        subject = event.get("subject", "general")
        by_status[status] = by_status.get(status, 0) + 1
        by_subject[subject] = by_subject.get(subject, 0) + 1
        if status == "success":
            successful_scans += 1
        elif status in {"failed", "rejected"}:
            failed_scans += 1
        estimated_total_micro_usd += int(event.get("estimated_total_micro_usd") or 0)
        if event.get("cache_hit"):
            cache_hits += 1

    return {
        "configured": True,
        "available": True,
        "total_scans": total_scans,
        "successful_scans": successful_scans,
        "failed_scans": failed_scans,
        "cache_hits": cache_hits,
        "estimated_total_micro_usd": estimated_total_micro_usd,
        "by_status": [
            {"status": key, "count": value}
            for key, value in sorted(by_status.items())
        ],
        "by_subject": [
            {"subject": key, "count": value}
            for key, value in sorted(by_subject.items())
        ],
    }


def _empty_summary(configured: bool, available: bool = True) -> dict[str, Any]:
    return {
        "configured": configured,
        "available": available,
        "total_scans": 0,
        "successful_scans": 0,
        "failed_scans": 0,
        "by_status": [],
        "by_subject": [],
    }


def _scan_all(table_name: str) -> list[dict[str, Any]]:
    table = _table(table_name)
    items: list[dict[str, Any]] = []
    scan_kwargs: dict[str, Any] = {}

    while True:
        response = table.scan(**scan_kwargs)
        items.extend(response.get("Items", []))
        last_key = response.get("LastEvaluatedKey")
        if not last_key:
            return items
        scan_kwargs["ExclusiveStartKey"] = last_key


def _table(table_name: str):
    dynamodb = boto3.resource("dynamodb", region_name=_aws_region())
    return dynamodb.Table(table_name)


def _aws_region() -> str:
    return os.getenv("AWS_REGION") or os.getenv("AWS_DEFAULT_REGION") or "us-east-1"


def _now_iso() -> str:
    return datetime.now(UTC).isoformat()
