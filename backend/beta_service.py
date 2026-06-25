from __future__ import annotations

import hashlib
import os
import secrets
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from typing import Any

try:
    import boto3
except ImportError:  # pragma: no cover - local non-AWS installs can still run OCR mock mode.
    boto3 = None


ALLOWED_ROLES = {"Student", "Researcher", "Professional"}


def request_beta_access(name: str, email: str, role: str) -> dict[str, Any]:
    _ensure_configured()

    normalized_email = _normalize_email(email)
    normalized_name = name.strip()
    normalized_role = role.strip()
    if normalized_role not in ALLOWED_ROLES:
        raise ValueError("Choose Student, Researcher, or Professional.")

    table = _table()
    existing_response = table.get_item(Key={"email": normalized_email})
    existing_item = existing_response.get("Item")
    if existing_item and existing_item.get("status") == "verified":
        return {
            "status": "already_verified",
            "beta_access": bool(existing_item.get("beta_access", False)),
            "email": normalized_email,
        }

    beta_limit = int(os.getenv("BETA_LIMIT", "50"))
    beta_access = _verified_beta_count(table) < beta_limit
    now = _now()

    if not _email_verification_enabled():
        table.put_item(
            Item={
                "email": normalized_email,
                "name": normalized_name,
                "role": normalized_role,
                "status": "verified",
                "beta_access": beta_access,
                "created_at": now.isoformat(),
                "verified_at": now.isoformat(),
                "verification_method": "instant_access",
            }
        )
        return {
            "status": "access_granted" if beta_access else "waitlisted",
            "beta_access": beta_access,
            "email": normalized_email,
            "name": normalized_name,
            "role": normalized_role,
        }

    token = secrets.token_urlsafe(32)
    expires_at = now + timedelta(hours=int(os.getenv("BETA_TOKEN_TTL_HOURS", "24")))

    table.put_item(
        Item={
            "email": normalized_email,
            "name": normalized_name,
            "role": normalized_role,
            "status": "pending",
            "beta_access": beta_access,
            "token_hash": _hash_token(token),
            "token_expires_at": Decimal(str(int(expires_at.timestamp()))),
            "created_at": now.isoformat(),
        }
    )
    _send_verification_email(normalized_name, normalized_email, token, beta_access)

    return {
        "status": "verification_sent",
        "beta_access": beta_access,
        "email": normalized_email,
    }


def verify_beta_token(token: str) -> dict[str, Any]:
    _ensure_configured()

    token_hash = _hash_token(token)
    table = _table()
    response = table.scan(
        FilterExpression="token_hash = :token_hash",
        ExpressionAttributeValues={":token_hash": token_hash},
        Limit=1,
    )
    items = response.get("Items", [])
    if not items:
        raise LookupError("This verification link is invalid or has already been used.")

    item = items[0]
    expires_at = int(item.get("token_expires_at", 0))
    if expires_at < int(_now().timestamp()):
        raise TimeoutError("This verification link has expired. Request a new one.")

    verified_at = _now().isoformat()
    table.update_item(
        Key={"email": item["email"]},
        UpdateExpression=(
            "SET #status = :status, verified_at = :verified_at "
            "REMOVE token_hash, token_expires_at"
        ),
        ExpressionAttributeNames={"#status": "status"},
        ExpressionAttributeValues={
            ":status": "verified",
            ":verified_at": verified_at,
        },
    )

    return {
        "status": "verified",
        "email": item["email"],
        "name": item.get("name", ""),
        "role": item.get("role", ""),
        "beta_access": bool(item.get("beta_access", False)),
    }


def _ensure_configured() -> None:
    required = ["BETA_TABLE_NAME"]
    if _email_verification_enabled():
        required.extend(["SES_FROM_EMAIL", "APP_BASE_URL"])
    missing = [name for name in required if not os.getenv(name)]
    if missing:
        raise RuntimeError(
            "Beta access is not configured yet. Missing: " + ", ".join(missing)
        )
    if boto3 is None:
        raise RuntimeError("Install AWS support with: python -m pip install -r requirements-aws.txt")


def _email_verification_enabled() -> bool:
    value = os.getenv("BETA_EMAIL_VERIFICATION", "disabled").strip().lower()
    return value in {"1", "true", "yes", "enabled"}


def _table():
    dynamodb = boto3.resource("dynamodb", region_name=_aws_region())
    return dynamodb.Table(os.environ["BETA_TABLE_NAME"])


def _verified_beta_count(table) -> int:
    response = table.scan(
        Select="COUNT",
        FilterExpression="#status = :status AND beta_access = :beta_access",
        ExpressionAttributeNames={"#status": "status"},
        ExpressionAttributeValues={":status": "verified", ":beta_access": True},
    )
    return int(response.get("Count", 0))


def _send_verification_email(name: str, email: str, token: str, beta_access: bool) -> None:
    app_base_url = os.environ["APP_BASE_URL"].rstrip("/")
    verify_url = f"{app_base_url}/verify?token={token}"
    subject = "Your Cleanote access link" if beta_access else "You are on the Cleanote waitlist"
    greeting = f"Hi {name}," if name else "Hi,"
    access_line = (
        "Click the link below to verify your email and open Cleanote."
        if beta_access
        else "You are on the waitlist. Verify your email so we can invite you when a spot opens."
    )
    body = f"""{greeting}

{access_line}

{verify_url}

This link expires in {os.getenv("BETA_TOKEN_TTL_HOURS", "24")} hours.

Cleanote
"""
    ses = boto3.client("ses", region_name=_aws_region())
    ses.send_email(
        Source=os.environ["SES_FROM_EMAIL"],
        Destination={"ToAddresses": [email]},
        Message={
            "Subject": {"Data": subject},
            "Body": {"Text": {"Data": body}},
        },
    )


def _normalize_email(email: str) -> str:
    normalized = email.strip().lower()
    if "@" not in normalized or "." not in normalized.split("@")[-1]:
        raise ValueError("Enter a valid email address.")
    return normalized


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _now() -> datetime:
    return datetime.now(UTC)


def _aws_region() -> str:
    return os.getenv("AWS_REGION") or os.getenv("AWS_DEFAULT_REGION") or "us-east-1"
