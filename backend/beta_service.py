from __future__ import annotations

import hashlib
import os
import secrets
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from typing import Any
from uuid import uuid4

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
        now = _now().isoformat()
        table.update_item(
            Key={"email": normalized_email},
            UpdateExpression=(
                "SET #name = :name, #role = :role, last_requested_at = :now, "
                "app_link = :app_link, premium_link = :premium_link, "
                "tablet_bundle_status = :tablet_bundle_status, "
                "followup_status = if_not_exists(followup_status, :followup_status), "
                "auto_reply_status = if_not_exists(auto_reply_status, :auto_reply_status), "
                "manual_email_subject = :manual_email_subject, "
                "manual_email_body = :manual_email_body"
            ),
            ExpressionAttributeNames={"#name": "name", "#role": "role"},
            ExpressionAttributeValues={
                ":name": normalized_name,
                ":role": normalized_role,
                ":now": now,
                ":app_link": _app_link(),
                ":premium_link": _premium_link(),
                ":tablet_bundle_status": "coming_soon_preorder_interest",
                ":followup_status": "needs_manual_followup",
                ":auto_reply_status": "manual_required_ses_disabled",
                ":manual_email_subject": _manual_followup_subject(),
                ":manual_email_body": _manual_followup_body(normalized_name),
            },
        )
        return {
            "status": "already_verified",
            "beta_access": bool(existing_item.get("beta_access", False)),
            "email": normalized_email,
            "name": normalized_name,
            "role": normalized_role,
            "message": _signup_message(),
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
                "app_link": _app_link(),
                "premium_link": _premium_link(),
                "tablet_bundle_status": "coming_soon_preorder_interest",
                "followup_status": "needs_manual_followup",
                "auto_reply_status": "manual_required_ses_disabled",
                "manual_email_subject": _manual_followup_subject(),
                "manual_email_body": _manual_followup_body(normalized_name),
            }
        )
        return {
            "status": "access_granted" if beta_access else "waitlisted",
            "beta_access": beta_access,
            "email": normalized_email,
            "name": normalized_name,
            "role": normalized_role,
            "message": _signup_message(),
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


def save_customer_discovery(feedback: dict[str, Any]) -> dict[str, str]:
    _ensure_configured()

    normalized_email = _normalize_email(str(feedback.get("email", "")))
    now = _now().isoformat()
    response = {
        "discovery_id": str(uuid4()),
        "created_at": now,
        "source": _clean_text(feedback.get("source", "post_scan"), 40),
        "note_filename": _clean_text(feedback.get("note_filename", ""), 160),
        "subject": _clean_text(feedback.get("subject", ""), 80),
        "word_count": int(feedback.get("word_count") or 0),
        "rating": _rating(feedback.get("rating")),
        "feedback": _clean_text(feedback.get("feedback", ""), 1500),
        "worked": _clean_text(feedback.get("worked", ""), 1000),
        "missing": _clean_text(feedback.get("missing", ""), 1000),
        "pay_value": _clean_text(feedback.get("pay_value", ""), 1000),
    }

    _table().update_item(
        Key={"email": normalized_email},
        UpdateExpression=(
            "SET #name = if_not_exists(#name, :name), "
            "#role = if_not_exists(#role, :role), "
            "#status = if_not_exists(#status, :status), "
            "beta_access = if_not_exists(beta_access, :beta_access), "
            "latest_discovery_response = :response, "
            "last_feedback_at = :now, "
            "discovery_responses = list_append(if_not_exists(discovery_responses, :empty), :responses)"
        ),
        ExpressionAttributeNames={
            "#name": "name",
            "#role": "role",
            "#status": "status",
        },
        ExpressionAttributeValues={
            ":name": _clean_text(feedback.get("name", ""), 120),
            ":role": _clean_text(feedback.get("role", ""), 40),
            ":status": "verified",
            ":beta_access": True,
            ":response": response,
            ":responses": [response],
            ":empty": [],
            ":now": now,
        },
    )
    return {"status": "saved", "email": normalized_email}


def feedback_summary(limit: int = 50) -> dict[str, Any]:
    _ensure_configured()

    responses: list[dict[str, Any]] = []
    for item in _scan_all(_table()):
        user_responses = item.get("discovery_responses") or []
        if not user_responses and item.get("latest_discovery_response"):
            user_responses = [item["latest_discovery_response"]]

        for response in user_responses:
            if not isinstance(response, dict):
                continue
            rating = _rating(response.get("rating"))
            responses.append(
                {
                    "email": item.get("email", ""),
                    "name": item.get("name", ""),
                    "role": item.get("role", ""),
                    "created_at": response.get("created_at", ""),
                    "rating": rating,
                    "feedback": response.get("feedback", ""),
                    "worked": response.get("worked", ""),
                    "missing": response.get("missing", ""),
                    "pay_value": response.get("pay_value", ""),
                    "note_filename": response.get("note_filename", ""),
                    "subject": response.get("subject", ""),
                    "word_count": int(response.get("word_count") or 0),
                }
            )

    responses.sort(key=lambda response: response["created_at"], reverse=True)
    rated_responses = [response for response in responses if response["rating"] > 0]
    average_rating = (
        round(sum(response["rating"] for response in rated_responses) / len(rated_responses), 2)
        if rated_responses
        else 0
    )

    return {
        "feedback_count": len(responses),
        "average_rating": average_rating,
        "recent_feedback": responses[: max(1, min(limit, 200))],
    }


def beta_summary(limit: int = 200) -> dict[str, Any]:
    _ensure_configured()

    signups: list[dict[str, Any]] = []
    for item in _scan_all(_table()):
        email = item.get("email", "")
        if not email:
            continue
        signups.append(
            {
                "email": email,
                "name": item.get("name", ""),
                "role": item.get("role", ""),
                "status": item.get("status", ""),
                "beta_access": bool(item.get("beta_access", False)),
                "created_at": item.get("created_at", ""),
                "verified_at": item.get("verified_at", ""),
                "last_requested_at": item.get("last_requested_at", ""),
                "last_feedback_at": item.get("last_feedback_at", ""),
                "followup_status": item.get("followup_status", "needs_manual_followup"),
                "auto_reply_status": item.get("auto_reply_status", "manual_required_ses_disabled"),
                "tablet_bundle_status": item.get("tablet_bundle_status", "coming_soon_preorder_interest"),
                "app_link": item.get("app_link", _app_link()),
                "premium_link": item.get("premium_link", _premium_link()),
                "manual_email_subject": item.get("manual_email_subject", _manual_followup_subject()),
                "manual_email_body": item.get("manual_email_body", _manual_followup_body(item.get("name", ""))),
            }
        )

    signups.sort(
        key=lambda signup: signup.get("last_requested_at") or signup.get("created_at") or "",
        reverse=True,
    )
    emailed_count = sum(
        1 for signup in signups if str(signup.get("auto_reply_status", "")).startswith("sent")
    )
    manual_required_count = sum(
        1 for signup in signups if signup.get("auto_reply_status") == "manual_required_ses_disabled"
    )
    beta_access_count = sum(1 for signup in signups if signup.get("beta_access"))

    return {
        "signup_count": len(signups),
        "beta_access_count": beta_access_count,
        "manual_required_count": manual_required_count,
        "emailed_count": emailed_count,
        "recent_signups": signups[: max(1, min(limit, 500))],
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


def _scan_all(table) -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []
    response = table.scan()
    items.extend(response.get("Items", []))
    while "LastEvaluatedKey" in response:
        response = table.scan(ExclusiveStartKey=response["LastEvaluatedKey"])
        items.extend(response.get("Items", []))
    return items


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


def _app_base_url() -> str:
    return os.getenv("APP_BASE_URL", "https://www.cleanote.in").rstrip("/")


def _app_link() -> str:
    return f"{_app_base_url()}/app"


def _premium_link() -> str:
    return f"{_app_base_url()}/billing"


def _manual_followup_subject() -> str:
    return "Welcome to Cleanote beta"


def _manual_followup_body(name: str = "") -> str:
    greeting = f"Hi {name}," if str(name).strip() else "Hi,"
    return f"""{greeting}

Thanks for joining the Cleanote beta. You can start using the scanner here:

{_app_link()}

Cleanote turns handwritten notes, worksheets, and annotated documents into editable, searchable text.

We are also exploring the Cleanote+ 8.5-inch writing tablet bundle. Premium access is available at $9.99/month here:

{_premium_link()}

We will get back to you within 1-2 days with next steps and beta updates.

Cleanote
Karigari Home LLC
"""


def _signup_message() -> str:
    return (
        "Thanks. Your beta details were saved. You can open Cleanote now, and we will get "
        "back to you within 1-2 days with app and tablet bundle details."
    )


def _normalize_email(email: str) -> str:
    normalized = email.strip().lower()
    if "@" not in normalized or "." not in normalized.split("@")[-1]:
        raise ValueError("Enter a valid email address.")
    return normalized


def _clean_text(value: Any, max_length: int) -> str:
    return str(value or "").strip()[:max_length]


def _rating(value: Any) -> int:
    try:
        return max(0, min(5, int(value or 0)))
    except (TypeError, ValueError):
        return 0


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _now() -> datetime:
    return datetime.now(UTC)


def _aws_region() -> str:
    return os.getenv("AWS_REGION") or os.getenv("AWS_DEFAULT_REGION") or "us-east-1"
