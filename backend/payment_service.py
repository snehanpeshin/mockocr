from __future__ import annotations

import os
from datetime import UTC, datetime
from decimal import Decimal
from typing import Any

try:
    import boto3
    from boto3.dynamodb.conditions import Attr
except ImportError:  # pragma: no cover - local non-AWS installs can still run OCR mock mode.
    boto3 = None
    Attr = None

try:
    import stripe
except ImportError:  # pragma: no cover - keep non-billing local dev working.
    stripe = None


CLEANOTE_DBA = "Cleanote"

PRODUCT_CONFIG = {
    "cleanote_one_time_premium": {
        "dba_name": CLEANOTE_DBA,
        "product_name": "Cleanote One-Time Premium",
        "mode": "payment",
        "product_env": "STRIPE_CLEANOTE_ONE_TIME_PREMIUM_PRODUCT_ID",
        "price_env": "STRIPE_CLEANOTE_ONE_TIME_PREMIUM_PRICE_ID",
        "default_product_id": "prod_UpH9Wwph6Epw45",
        "default_price_id": "price_1TpcbeFpqcjE8MaKolB8O4rS",
    },
}

SUBSCRIPTION_ACTIVE_STATUSES = {"active", "trialing"}


def create_checkout_session(
    product_key: str,
    customer_email: str | None,
    success_url: str,
    cancel_url: str,
) -> dict[str, str]:
    config = _product_config(product_key)
    price_id = _price_id(config)
    metadata = _metadata(product_key, config)

    _ensure_stripe_configured()
    session_args: dict[str, Any] = {
        "mode": config["mode"],
        "line_items": [{"price": price_id, "quantity": 1}],
        "success_url": success_url,
        "cancel_url": cancel_url,
        "client_reference_id": product_key,
        "metadata": metadata,
        "branding_settings": {
            "display_name": config["dba_name"],
            "button_color": "#287C6B",
            "border_style": "rounded",
        },
    }
    if customer_email:
        session_args["customer_email"] = customer_email.strip()
    if config["mode"] == "payment":
        session_args["customer_creation"] = "always"
        session_args["payment_intent_data"] = {"metadata": metadata}
    else:
        session_args["subscription_data"] = {"metadata": metadata}

    session = stripe.checkout.Session.create(**session_args)
    return {"id": session["id"], "url": session["url"]}


def create_payment_link(product_key: str) -> dict[str, str]:
    config = _product_config(product_key)
    price_id = _price_id(config)
    metadata = _metadata(product_key, config)

    _ensure_stripe_configured()
    payment_link_args: dict[str, Any] = {
        "line_items": [{"price": price_id, "quantity": 1}],
        "metadata": metadata,
        "after_completion": {
            "type": "hosted_confirmation",
            "hosted_confirmation": {
                "custom_message": f"Thanks for purchasing {config['product_name']}."
            },
        },
    }
    if config["mode"] == "payment":
        payment_link_args["payment_intent_data"] = {"metadata": metadata}
    else:
        payment_link_args["subscription_data"] = {"metadata": metadata}

    payment_link = stripe.PaymentLink.create(**payment_link_args)
    return {"id": payment_link["id"], "url": payment_link["url"]}


def construct_webhook_event(payload: bytes, signature: str | None) -> Any:
    _ensure_stripe_configured(require_webhook=True)
    if not signature:
        raise ValueError("Missing Stripe-Signature header.")
    return stripe.Webhook.construct_event(
        payload=payload,
        sig_header=signature,
        secret=os.environ["STRIPE_WEBHOOK_SECRET"],
    )


def handle_stripe_event(event: Any) -> dict[str, str]:
    event_type = event["type"]
    obj = event["data"]["object"]

    if event_type == "checkout.session.completed":
        save_completed_checkout_session(obj)
        return {"status": "saved_payment"}

    if event_type in {
        "customer.subscription.created",
        "customer.subscription.updated",
        "customer.subscription.deleted",
    }:
        save_subscription_event(obj, event_type)
        return {"status": "saved_subscription"}

    return {"status": "ignored"}


def save_completed_checkout_session(session: dict[str, Any]) -> dict[str, str]:
    _ensure_database_configured()
    item = _payment_item_from_session(session)
    _payments_table().put_item(Item=item)
    return {"status": "saved", "stripe_session_id": item["stripe_session_id"]}


def save_subscription_event(subscription: dict[str, Any], event_type: str) -> dict[str, str]:
    _ensure_database_configured()
    item = _subscription_item_from_event(subscription, event_type)
    _subscriptions_table().put_item(Item=item)
    return {"status": "saved", "stripe_subscription_id": item["stripe_subscription_id"]}


def revenue_summary() -> dict[str, Any]:
    _ensure_database_configured()
    payments = _scan_all(_payments_table())
    subscriptions = _scan_all(_subscriptions_table())

    total_revenue = Decimal("0")
    revenue_by_dba: dict[str, Decimal] = {}
    revenue_by_month: dict[str, Decimal] = {}
    customers: dict[str, dict[str, Any]] = {}

    for payment in payments:
        amount = _decimal(payment.get("amount", "0"))
        total_revenue += amount
        dba_name = payment.get("dba_name", CLEANOTE_DBA)
        month = payment.get("payment_date", "")[:7] or "unknown"
        revenue_by_dba[dba_name] = revenue_by_dba.get(dba_name, Decimal("0")) + amount
        revenue_by_month[month] = revenue_by_month.get(month, Decimal("0")) + amount

        email = payment.get("customer_email", "")
        customer_key = email or payment.get("stripe_customer_id", "unknown")
        customer = customers.setdefault(
            customer_key,
            {
                "customer_name": payment.get("customer_name", ""),
                "customer_email": email,
                "stripe_customer_id": payment.get("stripe_customer_id", ""),
                "dba_name": dba_name,
                "total_amount": Decimal("0"),
                "latest_payment_date": payment.get("payment_date", ""),
            },
        )
        customer["total_amount"] += amount
        if payment.get("payment_date", "") > customer.get("latest_payment_date", ""):
            customer["latest_payment_date"] = payment.get("payment_date", "")

    active_subscriptions = [
        {
            "stripe_subscription_id": item.get("stripe_subscription_id", ""),
            "stripe_customer_id": item.get("stripe_customer_id", ""),
            "customer_email": item.get("customer_email", ""),
            "status": item.get("status", ""),
            "dba_name": item.get("dba_name", CLEANOTE_DBA),
            "product_name": item.get("product_name", ""),
            "current_period_end": item.get("current_period_end", ""),
        }
        for item in subscriptions
        if item.get("status") in SUBSCRIPTION_ACTIVE_STATUSES
    ]

    return {
        "total_revenue": _money(total_revenue),
        "revenue_by_dba": [
            {"dba_name": key, "amount": _money(value)}
            for key, value in sorted(revenue_by_dba.items())
        ],
        "revenue_by_month": [
            {"month": key, "amount": _money(value)}
            for key, value in sorted(revenue_by_month.items())
        ],
        "active_subscriptions": active_subscriptions,
        "active_subscription_count": len(active_subscriptions),
        "customers": [
            {**customer, "total_amount": _money(customer["total_amount"])}
            for customer in sorted(
                customers.values(),
                key=lambda customer: customer.get("latest_payment_date", ""),
                reverse=True,
            )
        ],
    }


def has_paid_entitlement(email: str) -> bool:
    normalized_email = email.strip().lower()
    if not normalized_email or boto3 is None:
        return False

    try:
        if os.getenv("STRIPE_PAYMENT_TABLE_NAME"):
            for payment in _scan_all(_payments_table()):
                payment_email = str(payment.get("customer_email") or "").strip().lower()
                if payment_email == normalized_email and payment.get("product_key") in PRODUCT_CONFIG:
                    return True

        if os.getenv("STRIPE_SUBSCRIPTION_TABLE_NAME"):
            for subscription in _scan_all(_subscriptions_table()):
                subscription_email = str(subscription.get("customer_email") or "").strip().lower()
                if (
                    subscription_email == normalized_email
                    and subscription.get("status") in SUBSCRIPTION_ACTIVE_STATUSES
                ):
                    return True
    except Exception:
        return False

    return False


def validate_admin_token(token: str | None) -> None:
    expected = os.getenv("ADMIN_DASHBOARD_TOKEN")
    if not expected:
        raise RuntimeError("Admin dashboard is not configured. Missing: ADMIN_DASHBOARD_TOKEN")
    if not token or token != expected:
        raise PermissionError("Invalid admin token.")


def _payment_item_from_session(session: dict[str, Any]) -> dict[str, Any]:
    metadata = _session_metadata(session)
    customer_details = session.get("customer_details") or {}
    product_key = metadata.get("product_key", "")
    product_name = metadata.get("product_name") or _product_name_from_key(product_key)
    dba_name = metadata.get("dba_name") or CLEANOTE_DBA
    amount_minor = int(session.get("amount_total") or 0)
    currency = (session.get("currency") or "usd").lower()
    payment_date = _timestamp_to_iso(session.get("created")) or _now_iso()

    return {
        "stripe_session_id": session["id"],
        "customer_name": customer_details.get("name") or "",
        "customer_email": customer_details.get("email") or session.get("customer_email") or "",
        "stripe_customer_id": session.get("customer") or "",
        "amount": _minor_to_major(amount_minor),
        "amount_minor": Decimal(amount_minor),
        "currency": currency,
        "dba_name": dba_name,
        "product_name": product_name,
        "product_key": product_key,
        "payment_date": payment_date,
        "mode": session.get("mode", ""),
        "stripe_subscription_id": session.get("subscription") or "",
        "created_at": _now_iso(),
    }


def _session_metadata(session: dict[str, Any]) -> dict[str, str]:
    metadata = dict(session.get("metadata") or {})
    if metadata or not session.get("payment_link") or stripe is None:
        return metadata

    try:
        payment_link = stripe.PaymentLink.retrieve(session["payment_link"])
        return dict(payment_link.get("metadata") or {})
    except Exception:
        return metadata


def _subscription_item_from_event(subscription: dict[str, Any], event_type: str) -> dict[str, Any]:
    metadata = dict(subscription.get("metadata") or {})
    price = _first_subscription_price(subscription)
    product_key = metadata.get("product_key") or _product_key_from_price(price.get("id", ""))
    product_name = metadata.get("product_name") or _product_name_from_key(product_key)
    dba_name = metadata.get("dba_name") or CLEANOTE_DBA

    return {
        "stripe_subscription_id": subscription["id"],
        "stripe_customer_id": subscription.get("customer") or "",
        "customer_email": _subscription_customer_email(subscription),
        "status": subscription.get("status") or "",
        "price_id": price.get("id", ""),
        "product_id": price.get("product", ""),
        "product_key": product_key,
        "product_name": product_name,
        "dba_name": dba_name,
        "current_period_start": _timestamp_to_iso(subscription.get("current_period_start")),
        "current_period_end": _timestamp_to_iso(subscription.get("current_period_end")),
        "cancel_at_period_end": bool(subscription.get("cancel_at_period_end", False)),
        "latest_event_type": event_type,
        "updated_at": _now_iso(),
    }


def _subscription_customer_email(subscription: dict[str, Any]) -> str:
    customer = subscription.get("customer")
    if isinstance(customer, dict):
        return customer.get("email") or ""
    return ""


def _first_subscription_price(subscription: dict[str, Any]) -> dict[str, Any]:
    items = subscription.get("items", {}).get("data", [])
    if not items:
        return {}
    return items[0].get("price") or {}


def _metadata(product_key: str, config: dict[str, str]) -> dict[str, str]:
    return {
        "dba_name": config["dba_name"],
        "product_name": config["product_name"],
        "product_key": product_key,
    }


def _product_config(product_key: str) -> dict[str, str]:
    if product_key not in PRODUCT_CONFIG:
        raise ValueError("Unknown Stripe product.")
    return PRODUCT_CONFIG[product_key]


def _price_id(config: dict[str, str]) -> str:
    price_id = os.getenv(config["price_env"], "").strip() or config.get("default_price_id", "").strip()
    if not price_id:
        raise RuntimeError(f"Missing Stripe price env var: {config['price_env']}")
    return price_id


def _product_name_from_key(product_key: str) -> str:
    config = PRODUCT_CONFIG.get(product_key)
    return config["product_name"] if config else "Cleanote"


def _product_key_from_price(price_id: str) -> str:
    for product_key, config in PRODUCT_CONFIG.items():
        configured_price_id = os.getenv(config["price_env"], "").strip() or config.get(
            "default_price_id", ""
        ).strip()
        if price_id and configured_price_id == price_id:
            return product_key
    return ""


def _ensure_stripe_configured(require_webhook: bool = False) -> None:
    if stripe is None:
        raise RuntimeError("Install Stripe support with: python -m pip install -r requirements.txt")
    if not os.getenv("STRIPE_SECRET_KEY"):
        raise RuntimeError("Stripe is not configured. Missing: STRIPE_SECRET_KEY")
    if require_webhook and not os.getenv("STRIPE_WEBHOOK_SECRET"):
        raise RuntimeError("Stripe webhooks are not configured. Missing: STRIPE_WEBHOOK_SECRET")
    stripe.api_key = os.environ["STRIPE_SECRET_KEY"]


def _ensure_database_configured() -> None:
    missing = [
        name
        for name in ["STRIPE_PAYMENT_TABLE_NAME", "STRIPE_SUBSCRIPTION_TABLE_NAME"]
        if not os.getenv(name)
    ]
    if missing:
        raise RuntimeError("Stripe database is not configured. Missing: " + ", ".join(missing))
    if boto3 is None:
        raise RuntimeError("Install AWS support with: python -m pip install -r requirements-aws.txt")


def _payments_table():
    dynamodb = boto3.resource("dynamodb", region_name=_aws_region())
    return dynamodb.Table(os.environ["STRIPE_PAYMENT_TABLE_NAME"])


def _subscriptions_table():
    dynamodb = boto3.resource("dynamodb", region_name=_aws_region())
    return dynamodb.Table(os.environ["STRIPE_SUBSCRIPTION_TABLE_NAME"])


def _scan_all(table) -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []
    response = table.scan()
    items.extend(response.get("Items", []))
    while "LastEvaluatedKey" in response:
        response = table.scan(ExclusiveStartKey=response["LastEvaluatedKey"])
        items.extend(response.get("Items", []))
    return items


def _minor_to_major(amount_minor: int) -> Decimal:
    return (Decimal(amount_minor) / Decimal("100")).quantize(Decimal("0.01"))


def _money(amount: Decimal) -> str:
    return str(amount.quantize(Decimal("0.01")))


def _decimal(value: Any) -> Decimal:
    if isinstance(value, Decimal):
        return value
    return Decimal(str(value or "0"))


def _timestamp_to_iso(timestamp: Any) -> str:
    if not timestamp:
        return ""
    return datetime.fromtimestamp(int(timestamp), UTC).isoformat()


def _now_iso() -> str:
    return datetime.now(UTC).isoformat()


def _aws_region() -> str:
    return os.getenv("AWS_REGION") or os.getenv("AWS_DEFAULT_REGION") or "us-east-1"
