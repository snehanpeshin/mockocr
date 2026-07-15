from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from decimal import Decimal
import hashlib
import json
import os
import time
from typing import Any
from uuid import uuid4

from firebase_auth import optional_authenticated_identity
from payment_service import has_paid_entitlement

try:
    import boto3
    from boto3.dynamodb.conditions import Attr, Key
except ImportError:  # pragma: no cover - local dev can run without AWS extras.
    boto3 = None
    Attr = None
    Key = None


SUPPORTED_POLICY_MODES = {"free", "rewarded_ad_required", "payment_required", "service_disabled"}
SUPPORTED_KILL_MODES = {
    "OCR_DISABLED",
    "BEDROCK_DISABLED",
    "ANONYMOUS_DISABLED",
    "FREE_TIER_DISABLED",
}


class LimitExceeded(Exception):
    def __init__(self, detail: dict[str, Any]):
        super().__init__("Scan limit exceeded.")
        self.detail = detail


class MonetizationRequired(Exception):
    def __init__(self, feature: str, policy: str):
        super().__init__(f"{feature} requires {policy}.")
        self.detail = {"code": policy, "feature": feature, "policy": policy}


class ServiceDisabled(Exception):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.detail = {"code": code, "message": message}


class DuplicateInProgress(Exception):
    def __init__(self, retry_after_seconds: int):
        super().__init__("An identical scan is already being processed.")
        self.detail = {
            "code": "duplicate_in_progress",
            "retry_after_seconds": retry_after_seconds,
        }


@dataclass(frozen=True)
class ScanIdentity:
    identity_type: str
    identity_value: str
    identity_hash: str
    email: str = ""
    uid: str = ""


@dataclass(frozen=True)
class EffectiveAccess:
    is_paid: bool
    tier: str
    basic_policy: str
    ai_policy: str
    cleanup_mode: str
    bedrock_allowed: bool


@dataclass(frozen=True)
class CacheReservation:
    owner_hash: str
    cache_key: str
    upload_hash: str
    lease_token: str
    cache_hit: bool = False
    cached_response: dict[str, Any] | None = None


@dataclass(frozen=True)
class LimitReservation:
    period_keys: list[str]
    counted_units: int


def identify_scan_request(
    authorization: str | None,
    installation_id: str | None,
) -> ScanIdentity:
    identity = optional_authenticated_identity(authorization)
    if identity:
        value = f"firebase:{identity['uid'] or identity['email']}"
        return ScanIdentity(
            identity_type="authenticated",
            identity_value=value,
            identity_hash=_sha256_text(value),
            email=identity["email"],
            uid=identity["uid"],
        )

    normalized_installation_id = _normalize_installation_id(installation_id)
    value = f"install:{normalized_installation_id}"
    return ScanIdentity(
        identity_type="anonymous",
        identity_value=value,
        identity_hash=_sha256_text(value),
    )


def enforce_kill_switch(identity: ScanIdentity, access: EffectiveAccess) -> None:
    modes = _kill_switch_modes()
    if "OCR_DISABLED" in modes:
        raise ServiceDisabled("ocr_disabled", "Cleanote scanning is temporarily disabled.")
    if "ANONYMOUS_DISABLED" in modes and identity.identity_type == "anonymous":
        raise ServiceDisabled("anonymous_disabled", "Anonymous scanning is temporarily disabled.")
    if "FREE_TIER_DISABLED" in modes and not access.is_paid:
        raise ServiceDisabled("free_tier_disabled", "Free scanning is temporarily disabled.")
    if "BEDROCK_DISABLED" in modes and access.cleanup_mode == "bedrock":
        raise ServiceDisabled("bedrock_disabled", "AI cleanup is temporarily disabled.")


def effective_access(identity: ScanIdentity, requested_cleanup_mode: str) -> EffectiveAccess:
    policy = get_remote_policy()
    is_paid = has_paid_entitlement(identity.email) if identity.email else False
    tier = "paid" if is_paid else ("authenticated_free" if identity.identity_type == "authenticated" else "anonymous")
    basic_policy = _policy_value(policy, "basic_ocr_policy", "free")
    ai_policy = _policy_value(policy, "ai_cleanup_policy", "payment_required")
    requested_ai = requested_cleanup_mode.lower() in {"bedrock", "ai", "aws", "enhanced"}

    _enforce_policy("basic_ocr", basic_policy, is_paid)
    bedrock_allowed = False
    cleanup_mode = "rules"
    if requested_ai:
        _enforce_policy("ai_cleanup", ai_policy, is_paid)
        bedrock_allowed = is_paid or _admin_allows_free_bedrock()
        cleanup_mode = "bedrock" if bedrock_allowed else "rules"

    return EffectiveAccess(
        is_paid=is_paid,
        tier=tier,
        basic_policy=basic_policy,
        ai_policy=ai_policy,
        cleanup_mode=cleanup_mode,
        bedrock_allowed=bedrock_allowed,
    )


_POLICY_CACHE: dict[str, Any] = {"loaded_at": 0.0, "value": None}


def get_remote_policy() -> dict[str, Any]:
    ttl = max(5, _int_env("MONETIZATION_POLICY_CACHE_SECONDS", 60))
    now = time.time()
    if _POLICY_CACHE["value"] is not None and now - _POLICY_CACHE["loaded_at"] <= ttl:
        return dict(_POLICY_CACHE["value"])

    policy = _default_policy()
    table_name = os.getenv("MONETIZATION_POLICY_TABLE_NAME", "").strip()
    if table_name and boto3 is not None:
        try:
            item = _table(table_name).get_item(
                Key={"policy_id": os.getenv("MONETIZATION_POLICY_ID", "cleanote-default")}
            ).get("Item")
            if item:
                policy.update({key: item[key] for key in item if key.endswith("_policy")})
        except Exception:
            if os.getenv("MONETIZATION_POLICY_FAIL_OPEN", "false").lower() not in {"1", "true", "yes"}:
                policy = _safe_policy()

    for key in ("BASIC_OCR_POLICY", "AI_CLEANUP_POLICY"):
        if os.getenv(key):
            policy[key.lower()] = os.environ[key].strip()

    _POLICY_CACHE["loaded_at"] = now
    _POLICY_CACHE["value"] = dict(policy)
    return policy


def client_status(identity: ScanIdentity | None = None) -> dict[str, Any]:
    policy = get_remote_policy()
    return {
        "basic_ocr_policy": _policy_value(policy, "basic_ocr_policy", "free"),
        "ai_cleanup_policy": _policy_value(policy, "ai_cleanup_policy", "payment_required"),
        "kill_switch_modes": sorted(_kill_switch_modes()),
        "limits": {
            "anonymous_daily": _int_env("ANON_FREE_SCANS_PER_DAY", 5),
            "anonymous_monthly": _int_env("ANON_FREE_SCANS_PER_MONTH", 25),
            "authenticated_daily": _int_env("AUTH_FREE_SCANS_PER_DAY", 20),
            "authenticated_monthly": _int_env("AUTH_FREE_SCANS_PER_MONTH", 200),
            "paid_daily": _int_env("PAID_SCANS_PER_DAY", 250),
            "paid_monthly": _int_env("PAID_SCANS_PER_MONTH", 5000),
            "max_pages_per_upload": max_pages_per_upload(),
            "max_upload_bytes": max_upload_bytes(),
        },
        "identity_type": identity.identity_type if identity else "unknown",
    }


def max_upload_bytes() -> int:
    return _int_env("MAX_UPLOAD_BYTES", 10 * 1024 * 1024)


def max_pages_per_upload() -> int:
    return _int_env("MAX_PAGES_PER_UPLOAD", 3)


def reserve_limits(identity: ScanIdentity, access: EffectiveAccess, pages: int) -> LimitReservation:
    counted_units = max(1, int(pages))
    limits = _limits_for_access(identity, access)
    period_specs = [
        ("day", _period_start("day"), _period_reset("day"), limits["daily"]),
        ("month", _period_start("month"), _period_reset("month"), limits["monthly"]),
    ]
    reserved: list[str] = []
    try:
        for period_type, period_start, reset_time, limit in period_specs:
            key = f"{identity.identity_hash}#{access.tier}#{period_type}#{period_start}"
            _increment_counter(key, identity, access, counted_units, limit, reset_time)
            reserved.append(key)
    except LimitExceeded:
        for key in reserved:
            _decrement_counter(key, counted_units)
        raise
    return LimitReservation(period_keys=reserved, counted_units=counted_units)


def release_limits(reservation: LimitReservation | None) -> None:
    if not reservation:
        return
    for key in reservation.period_keys:
        _decrement_counter(key, reservation.counted_units)


def cache_key_for(
    *,
    identity: ScanIdentity,
    upload_bytes: bytes,
    provider: str,
    cleanup_mode: str,
    subject: str,
    options: dict[str, Any],
) -> CacheReservation:
    upload_hash = hashlib.sha256(_normalized_upload_bytes(upload_bytes)).hexdigest()
    model = os.getenv("BEDROCK_MODEL_ID", "none") if cleanup_mode == "bedrock" else "rules"
    version = os.getenv("OCR_CACHE_VERSION", "v1")
    cache_identity = {
        "upload_hash": upload_hash,
        "provider": provider,
        "cleanup_mode": cleanup_mode,
        "subject": subject,
        "model": model,
        "version": version,
        "options": options,
    }
    cache_key = hashlib.sha256(json.dumps(cache_identity, sort_keys=True).encode("utf-8")).hexdigest()
    return CacheReservation(
        owner_hash=identity.identity_hash,
        cache_key=cache_key,
        upload_hash=upload_hash,
        lease_token=str(uuid4()),
    )


def reserve_or_get_cache(reservation: CacheReservation, idempotency_key: str | None) -> CacheReservation:
    idempotent = get_idempotent_response(reservation.owner_hash, idempotency_key)
    if idempotent:
        return CacheReservation(
            **{**reservation.__dict__, "cache_hit": True, "cached_response": idempotent}
        )

    table_name = os.getenv("OCR_CACHE_TABLE_NAME", "").strip()
    if not table_name or boto3 is None:
        return reservation

    now = _epoch_seconds()
    lease_expires_at = now + _int_env("OCR_CACHE_LEASE_SECONDS", 90)
    ttl = now + _int_env("OCR_CACHE_TTL_SECONDS", 7 * 24 * 3600)
    table = _table(table_name)
    item_key = {"owner_hash": reservation.owner_hash, "cache_key": reservation.cache_key}
    existing = table.get_item(Key=item_key).get("Item")
    if existing and existing.get("status") == "success" and int(existing.get("expires_at", 0)) > now:
        return CacheReservation(
            **{
                **reservation.__dict__,
                "cache_hit": True,
                "cached_response": json.loads(existing.get("response_json", "{}")),
            }
        )
    if existing and existing.get("status") == "in_progress" and int(existing.get("lease_expires_at", 0)) > now:
        raise DuplicateInProgress(int(existing.get("lease_expires_at", now) - now))

    table.put_item(
        Item={
            **item_key,
            "status": "in_progress",
            "lease_token": reservation.lease_token,
            "upload_hash": reservation.upload_hash,
            "created_at": _now_iso(),
            "lease_expires_at": lease_expires_at,
            "expires_at": ttl,
        },
        ConditionExpression=(
            "attribute_not_exists(owner_hash) OR #status <> :in_progress OR lease_expires_at < :now"
        ),
        ExpressionAttributeNames={"#status": "status"},
        ExpressionAttributeValues={":in_progress": "in_progress", ":now": now},
    )
    return reservation


def complete_cache(reservation: CacheReservation, response: dict[str, Any], idempotency_key: str | None) -> None:
    response_json = json.dumps(response, separators=(",", ":"), ensure_ascii=False)
    save_idempotent_response(reservation.owner_hash, idempotency_key, response)
    table_name = os.getenv("OCR_CACHE_TABLE_NAME", "").strip()
    if not table_name or boto3 is None:
        return
    _table(table_name).update_item(
        Key={"owner_hash": reservation.owner_hash, "cache_key": reservation.cache_key},
        UpdateExpression=(
            "SET #status=:success, response_json=:response_json, completed_at=:completed_at, "
            "expires_at=:expires_at"
        ),
        ConditionExpression="lease_token=:lease_token",
        ExpressionAttributeNames={"#status": "status"},
        ExpressionAttributeValues={
            ":success": "success",
            ":response_json": response_json,
            ":completed_at": _now_iso(),
            ":expires_at": _epoch_seconds() + _int_env("OCR_CACHE_TTL_SECONDS", 7 * 24 * 3600),
            ":lease_token": reservation.lease_token,
        },
    )


def abandon_cache(reservation: CacheReservation | None) -> None:
    if not reservation or reservation.cache_hit:
        return
    table_name = os.getenv("OCR_CACHE_TABLE_NAME", "").strip()
    if not table_name or boto3 is None:
        return
    try:
        _table(table_name).delete_item(
            Key={"owner_hash": reservation.owner_hash, "cache_key": reservation.cache_key},
            ConditionExpression="lease_token=:lease_token",
            ExpressionAttributeValues={":lease_token": reservation.lease_token},
        )
    except Exception:
        return


def get_idempotent_response(owner_hash: str, idempotency_key: str | None) -> dict[str, Any] | None:
    normalized_key = _normalize_optional_key(idempotency_key)
    table_name = os.getenv("IDEMPOTENCY_TABLE_NAME", "").strip()
    if not normalized_key or not table_name or boto3 is None:
        return None
    item = _table(table_name).get_item(
        Key={"owner_hash": owner_hash, "idempotency_key": normalized_key}
    ).get("Item")
    if item and item.get("status") == "success":
        return json.loads(item.get("response_json", "{}"))
    if item and item.get("status") == "in_progress" and int(item.get("lease_expires_at", 0)) > _epoch_seconds():
        raise DuplicateInProgress(int(item["lease_expires_at"] - _epoch_seconds()))
    return None


def save_idempotent_response(owner_hash: str, idempotency_key: str | None, response: dict[str, Any]) -> None:
    normalized_key = _normalize_optional_key(idempotency_key)
    table_name = os.getenv("IDEMPOTENCY_TABLE_NAME", "").strip()
    if not normalized_key or not table_name or boto3 is None:
        return
    _table(table_name).put_item(
        Item={
            "owner_hash": owner_hash,
            "idempotency_key": normalized_key,
            "status": "success",
            "response_json": json.dumps(response, separators=(",", ":"), ensure_ascii=False),
            "created_at": _now_iso(),
            "expires_at": _epoch_seconds() + _int_env("IDEMPOTENCY_TTL_SECONDS", 24 * 3600),
        }
    )


def usage_event(
    *,
    identity: ScanIdentity,
    access: EffectiveAccess,
    filename: str,
    file_type: str,
    upload_bytes: int,
    page_count: int,
    provider: str,
    status: str,
    cache_hit: bool,
    idempotency_key: str | None,
    subject: str = "",
    error_message: str = "",
    text_length: int = 0,
) -> dict[str, Any]:
    textract_calls = 0 if cache_hit or status == "rejected" else max(0, page_count)
    bedrock_used = "+bedrock" in provider or provider.endswith("bedrock")
    bedrock_calls = 1 if bedrock_used and status == "success" else 0
    estimate = estimate_cost_micro_usd(
        textract_pages=textract_calls,
        bedrock_calls=bedrock_calls,
        upload_bytes=upload_bytes,
    )
    return {
        "event_id": str(uuid4()),
        "identity_hash": identity.identity_hash,
        "identity_type": identity.identity_type,
        "created_at": _now_iso(),
        "filename": filename,
        "file_type": file_type,
        "file_size_bytes": upload_bytes,
        "page_count": page_count,
        "provider": provider,
        "bedrock_used": bedrock_used,
        "cleanup_mode": access.cleanup_mode,
        "cache_hit": cache_hit,
        "status": status,
        "subject": subject,
        "text_length": text_length,
        "textract_calls": textract_calls,
        "textract_pages": textract_calls,
        "bedrock_input_tokens": 0,
        "bedrock_output_tokens": 0,
        "estimated_textract_micro_usd": estimate["textract"],
        "estimated_bedrock_micro_usd": estimate["bedrock"],
        "estimated_storage_micro_usd": estimate["storage"],
        "estimated_total_micro_usd": estimate["total"],
        "cost_estimate": True,
        "subscription_tier": access.tier,
        "idempotency_key_hash": _sha256_text(idempotency_key or "") if idempotency_key else "",
        "error_message": error_message[:500],
    }


def estimate_cost_micro_usd(textract_pages: int, bedrock_calls: int, upload_bytes: int) -> dict[str, int]:
    textract_per_page = _int_env("EST_TEXTRACT_MICRO_USD_PER_PAGE", 1500)
    bedrock_per_call = _int_env("EST_BEDROCK_MICRO_USD_PER_CALL", 1000)
    storage_per_mb = _int_env("EST_STORAGE_MICRO_USD_PER_MB_MONTH", 25)
    storage = int((Decimal(upload_bytes) / Decimal(1024 * 1024)) * Decimal(storage_per_mb))
    textract = max(0, textract_pages) * textract_per_page
    bedrock = max(0, bedrock_calls) * bedrock_per_call
    return {"textract": textract, "bedrock": bedrock, "storage": storage, "total": textract + bedrock + storage}


def admin_usage_summary(days: int = 1) -> dict[str, Any]:
    table_name = os.getenv("SCAN_EVENTS_TABLE_NAME", "").strip()
    if not table_name or boto3 is None:
        return {"configured": False, "available": False, "message": "SCAN_EVENTS_TABLE_NAME not configured."}

    cutoff = datetime.now(UTC) - timedelta(days=max(1, min(days, 31)))
    items = _scan_all(table_name)
    recent = [item for item in items if str(item.get("created_at", "")) >= cutoff.isoformat()]
    successful = [item for item in recent if item.get("status") == "success"]
    total_cost = sum(int(item.get("estimated_total_micro_usd") or 0) for item in recent)
    aws_calls_avoided = sum(int(item.get("textract_pages") or 0) for item in recent if item.get("cache_hit"))
    free_events = [item for item in recent if str(item.get("subscription_tier", "")).endswith("free") or item.get("subscription_tier") == "anonymous"]
    paid_events = [item for item in recent if item.get("subscription_tier") == "paid"]
    return {
        "configured": True,
        "available": True,
        "days": days,
        "total_events": len(recent),
        "successful_scans": len(successful),
        "cache_hit_rate": _ratio(sum(1 for item in recent if item.get("cache_hit")), len(recent)),
        "aws_calls_avoided": aws_calls_avoided,
        "estimated_total_micro_usd": total_cost,
        "estimated_cost_usd": _micro_usd_to_string(total_cost),
        "estimated_cost_per_successful_scan_usd": _micro_usd_to_string(total_cost // max(1, len(successful))),
        "free_usage_count": len(free_events),
        "paid_usage_count": len(paid_events),
        "by_status": _counts(recent, "status"),
        "by_tier": _counts(recent, "subscription_tier"),
        "note": "Costs are estimates from configured pricing assumptions, not AWS billing records.",
    }


def _increment_counter(
    key: str,
    identity: ScanIdentity,
    access: EffectiveAccess,
    units: int,
    limit: int,
    reset_time: datetime,
) -> None:
    if limit <= 0:
        raise LimitExceeded(_limit_detail(key, 0, limit, reset_time))
    table_name = os.getenv("USAGE_COUNTER_TABLE_NAME", "").strip()
    if not table_name or boto3 is None:
        return
    try:
        _table(table_name).update_item(
            Key={"counter_key": key},
            UpdateExpression=(
                "SET identity_hash=:identity_hash, identity_type=:identity_type, "
                "subscription_tier=:tier, reset_at=:reset_at, expires_at=:expires_at "
                "ADD usage_count :units"
            ),
            ConditionExpression="attribute_not_exists(usage_count) OR usage_count <= :remaining",
            ExpressionAttributeValues={
                ":units": units,
                ":remaining": max(0, limit - units),
                ":identity_hash": identity.identity_hash,
                ":identity_type": identity.identity_type,
                ":tier": access.tier,
                ":reset_at": reset_time.isoformat(),
                ":expires_at": int(reset_time.timestamp()) + 86400,
            },
        )
    except Exception as exc:
        current = _counter_usage(table_name, key)
        raise LimitExceeded(_limit_detail(key, current, limit, reset_time)) from exc


def _decrement_counter(key: str, units: int) -> None:
    table_name = os.getenv("USAGE_COUNTER_TABLE_NAME", "").strip()
    if not table_name or boto3 is None:
        return
    try:
        _table(table_name).update_item(
            Key={"counter_key": key},
            UpdateExpression="ADD usage_count :negative_units",
            ExpressionAttributeValues={":negative_units": -max(1, units)},
        )
    except Exception:
        return


def _limits_for_access(identity: ScanIdentity, access: EffectiveAccess) -> dict[str, int]:
    if access.is_paid:
        return {"daily": _int_env("PAID_SCANS_PER_DAY", 250), "monthly": _int_env("PAID_SCANS_PER_MONTH", 5000)}
    if identity.identity_type == "authenticated":
        return {"daily": _int_env("AUTH_FREE_SCANS_PER_DAY", 20), "monthly": _int_env("AUTH_FREE_SCANS_PER_MONTH", 200)}
    return {"daily": _int_env("ANON_FREE_SCANS_PER_DAY", 5), "monthly": _int_env("ANON_FREE_SCANS_PER_MONTH", 25)}


def _normalize_installation_id(installation_id: str | None) -> str:
    value = (installation_id or "").strip()
    if not value or len(value) < 16:
        raise ValueError("Missing X-Cleanote-Installation-Id header for anonymous scans.")
    return value[:160]


def _policy_value(policy: dict[str, Any], key: str, default: str) -> str:
    value = str(policy.get(key) or default).strip()
    return value if value in SUPPORTED_POLICY_MODES else default


def _enforce_policy(feature: str, policy: str, is_paid: bool) -> None:
    if policy == "service_disabled":
        raise ServiceDisabled(f"{feature}_disabled", f"{feature} is temporarily disabled.")
    if policy == "payment_required" and not is_paid:
        raise MonetizationRequired(feature, "payment_required")
    if policy == "rewarded_ad_required" and not is_paid:
        raise MonetizationRequired(feature, "rewarded_ad_required")


def _default_policy() -> dict[str, str]:
    return {
        "basic_ocr_policy": os.getenv("BASIC_OCR_POLICY", "free"),
        "ai_cleanup_policy": os.getenv("AI_CLEANUP_POLICY", "payment_required"),
    }


def _safe_policy() -> dict[str, str]:
    return {"basic_ocr_policy": "service_disabled", "ai_cleanup_policy": "payment_required"}


def _kill_switch_modes() -> set[str]:
    raw = os.getenv("APP_KILL_SWITCH", "")
    modes = {item.strip().upper() for item in raw.split(",") if item.strip()}
    return {mode for mode in modes if mode in SUPPORTED_KILL_MODES}


def _admin_allows_free_bedrock() -> bool:
    return os.getenv("ALLOW_FREE_BEDROCK_FOR_TESTING", "false").lower() in {"1", "true", "yes", "on"}


def _period_start(period: str) -> str:
    now = datetime.now(UTC)
    return now.strftime("%Y-%m-%d") if period == "day" else now.strftime("%Y-%m")


def _period_reset(period: str) -> datetime:
    now = datetime.now(UTC)
    if period == "day":
        return datetime(now.year, now.month, now.day, tzinfo=UTC) + timedelta(days=1)
    if now.month == 12:
        return datetime(now.year + 1, 1, 1, tzinfo=UTC)
    return datetime(now.year, now.month + 1, 1, tzinfo=UTC)


def _limit_detail(key: str, current: int, limit: int, reset_time: datetime) -> dict[str, Any]:
    period = "month" if "#month#" in key else "day"
    return {
        "code": "scan_limit_exceeded",
        "limit_type": period,
        "current_usage": current,
        "limit": limit,
        "reset_time": reset_time.isoformat(),
    }


def _counter_usage(table_name: str, key: str) -> int:
    try:
        item = _table(table_name).get_item(Key={"counter_key": key}).get("Item") or {}
        return int(item.get("usage_count") or 0)
    except Exception:
        return 0


def _normalized_upload_bytes(upload_bytes: bytes) -> bytes:
    return upload_bytes.replace(b"\r\n", b"\n")


def _normalize_optional_key(key: str | None) -> str:
    return (key or "").strip()[:160]


def _scan_all(table_name: str) -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []
    scan_kwargs: dict[str, Any] = {}
    table = _table(table_name)
    while True:
        response = table.scan(**scan_kwargs)
        items.extend(response.get("Items", []))
        last_key = response.get("LastEvaluatedKey")
        if not last_key:
            return items
        scan_kwargs["ExclusiveStartKey"] = last_key


def _counts(items: list[dict[str, Any]], key: str) -> list[dict[str, Any]]:
    counts: dict[str, int] = {}
    for item in items:
        value = str(item.get(key) or "unknown")
        counts[value] = counts.get(value, 0) + 1
    return [{key: name, "count": count} for name, count in sorted(counts.items())]


def _ratio(numerator: int, denominator: int) -> float:
    return round(numerator / denominator, 4) if denominator else 0.0


def _micro_usd_to_string(micro_usd: int) -> str:
    return str((Decimal(micro_usd) / Decimal(1_000_000)).quantize(Decimal("0.000001")))


def _sha256_text(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def _int_env(name: str, default: int) -> int:
    try:
        return max(0, int(os.getenv(name, str(default))))
    except ValueError:
        return default


def _epoch_seconds() -> int:
    return int(time.time())


def _now_iso() -> str:
    return datetime.now(UTC).isoformat()


def _table(table_name: str):
    dynamodb = boto3.resource("dynamodb", region_name=_aws_region())
    return dynamodb.Table(table_name)


def _aws_region() -> str:
    return os.getenv("AWS_REGION") or os.getenv("AWS_DEFAULT_REGION") or "us-east-1"
