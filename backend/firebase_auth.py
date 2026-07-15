from __future__ import annotations

import os

try:
    from google.auth.transport.requests import Request as GoogleAuthRequest
    from google.oauth2 import id_token
except ImportError:  # pragma: no cover - local OCR-only installs can run without auth support.
    GoogleAuthRequest = None
    id_token = None


def authenticated_email(authorization: str | None) -> str:
    claims = _verified_claims(authorization)
    email = str(claims.get("email") or "").strip().lower()
    if not email:
        raise PermissionError("The signed-in Cleanote account does not have an email address.")
    return email


def optional_authenticated_identity(authorization: str | None) -> dict[str, str] | None:
    if not authorization:
        return None
    try:
        claims = _verified_claims(authorization)
    except Exception:
        return None

    email = str(claims.get("email") or "").strip().lower()
    uid = str(claims.get("user_id") or claims.get("sub") or "").strip()
    if not email and not uid:
        return None
    return {"email": email, "uid": uid}


def _verified_claims(authorization: str | None) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise PermissionError("Sign in to use cloud note storage.")
    if GoogleAuthRequest is None or id_token is None:
        raise RuntimeError("Firebase token verification is not installed.")

    token = authorization.removeprefix("Bearer ").strip()
    if not token:
        raise PermissionError("Sign in to use cloud note storage.")

    project_id = os.getenv("FIREBASE_PROJECT_ID", "cleanote-443ef").strip()
    try:
        return id_token.verify_firebase_token(
            token,
            GoogleAuthRequest(),
            audience=project_id,
        )
    except Exception as exc:
        raise PermissionError("Your Cleanote session is invalid or expired. Sign in again.") from exc


def require_matching_email(authorization: str | None, requested_email: str) -> str:
    email = authenticated_email(authorization)
    if email != requested_email.strip().lower():
        raise PermissionError("This account cannot access notes belonging to another email address.")
    return email
