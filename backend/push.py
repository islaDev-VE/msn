import asyncio
import base64
import json
import os
import re
from pathlib import Path
from typing import Optional

from backend.config import (
    VAPID_KEYS_FILE,
    VAPID_PRIVATE_KEY,
    VAPID_PUBLIC_KEY,
    VAPID_SUBJECT,
)
from backend.database import (
    delete_push_subscription_by_endpoint,
    get_user_pending_badge_count,
    get_user_push_subscriptions,
)

try:
    from cryptography.hazmat.primitives import serialization
    from py_vapid import Vapid01
    from pywebpush import WebPushException, webpush

    WEBPUSH_AVAILABLE = True
except Exception:
    WEBPUSH_AVAILABLE = False
    WebPushException = Exception  # type: ignore

_PLUS_TAG_RE = re.compile(r"\[(?:/?(?:b|i|u|c)|c=[^\]]+)\]", re.IGNORECASE)

_vapid_cache: Optional[dict] = None


def strip_plus_tags(text: str) -> str:
    return _PLUS_TAG_RE.sub("", text or "").strip()


def _build_vapid_instance(raw_private_key: str):
    cleaned = raw_private_key.replace("\\n", "\n").strip()
    if "-----BEGIN" in cleaned:
        return Vapid01.from_pem(cleaned.encode("ascii"))
    return Vapid01.from_string(private_key=cleaned)


def _load_or_create_vapid_keys() -> Optional[dict]:
    global _vapid_cache
    if _vapid_cache is not None:
        return _vapid_cache
    if not WEBPUSH_AVAILABLE:
        return None

    # 1. Explicit env vars take precedence
    if VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY:
        priv = VAPID_PRIVATE_KEY.replace("\\n", "\n")
        _vapid_cache = {
            "publicKey": VAPID_PUBLIC_KEY,
            "privateKey": priv,
            "vapid": _build_vapid_instance(priv),
            "subject": VAPID_SUBJECT,
        }
        return _vapid_cache

    # 2. Load persisted JSON file if present
    keys_path = Path(VAPID_KEYS_FILE)
    if keys_path.is_file():
        try:
            data = json.loads(keys_path.read_text(encoding="utf-8"))
            if data.get("publicKey") and data.get("privateKey"):
                _vapid_cache = {
                    "publicKey": data["publicKey"],
                    "privateKey": data["privateKey"],
                    "vapid": _build_vapid_instance(data["privateKey"]),
                    "subject": VAPID_SUBJECT,
                }
                return _vapid_cache
        except Exception as exc:
            print(f"[Zumbido 05 Push] Error leyendo {keys_path}: {exc}", flush=True)

    # 3. Generate new EC P-256 VAPID keypair and persist with 0600 permissions
    vapid = Vapid01()
    vapid.generate_keys()
    raw_pub = vapid.public_key.public_bytes(
        serialization.Encoding.X962,
        serialization.PublicFormat.UncompressedPoint,
    )
    pub_b64 = base64.urlsafe_b64encode(raw_pub).rstrip(b"=").decode("ascii")
    priv_pem = vapid.private_pem().decode("ascii")

    keys_path.parent.mkdir(parents=True, exist_ok=True)
    keys_path.write_text(
        json.dumps({"publicKey": pub_b64, "privateKey": priv_pem}, indent=2),
        encoding="utf-8",
    )
    try:
        os.chmod(keys_path, 0o600)
    except OSError:
        pass

    _vapid_cache = {
        "publicKey": pub_b64,
        "privateKey": priv_pem,
        "vapid": vapid,
        "subject": VAPID_SUBJECT,
    }
    return _vapid_cache


def get_vapid_public_key() -> Optional[str]:
    keys = _load_or_create_vapid_keys()
    return keys["publicKey"] if keys else None


def _send_single_webpush(sub: dict, payload_json: str, vapid_obj, subject: str) -> tuple[str, Optional[str]]:
    try:
        webpush(
            subscription_info={
                "endpoint": sub["endpoint"],
                "keys": sub["keys"],
            },
            data=payload_json,
            vapid_private_key=vapid_obj,
            vapid_claims={"sub": subject},
            ttl=86400,
            timeout=15,
            headers={"Urgency": "high"},
        )
        return ("ok", None)
    except WebPushException as exc:
        resp = getattr(exc, "response", None)
        status = getattr(resp, "status_code", None)
        body = (getattr(resp, "text", "") or "")[:200]
        print(f"[Zumbido 05 Push] WebPushException status={status} body={body!r}", flush=True)
        if status in (404, 410):
            delete_push_subscription_by_endpoint(sub["endpoint"])
            return ("expired", f"HTTP {status}")
        return ("error", f"HTTP {status}: {body}" if status else str(exc))
    except Exception as exc:
        print(f"[Zumbido 05 Push] Error inesperado enviando push: {exc!r}", flush=True)
        return ("error", str(exc))


async def send_push_to_user(
    user_id: int,
    *,
    title: str,
    body: str,
    url: str = "/",
    tag: Optional[str] = None,
    data: Optional[dict] = None,
    vibrate: Optional[list[int]] = None,
    force: bool = False,
    badge_count: Optional[int] = None,
) -> dict:
    keys = _load_or_create_vapid_keys()
    if not keys:
        return {"sent": 0, "total": 0, "failed": 0, "lastError": "VAPID no disponible"}

    subs = get_user_push_subscriptions(user_id)
    if not subs:
        return {"sent": 0, "total": 0, "failed": 0, "lastError": None}

    resolved_badge = (
        int(badge_count)
        if badge_count is not None
        else max(1, get_user_pending_badge_count(user_id))
    )

    payload_json = json.dumps(
        {
            "title": strip_plus_tags(title) or "Zumbido 05",
            "body": strip_plus_tags(body) or "Tienes un mensaje nuevo.",
            "url": url,
            "tag": tag or "zumbido-05-msg",
            "vibrate": vibrate or [140, 60, 140],
            "force": force,
            "badgeCount": resolved_badge,
            "data": data or {},
        },
        ensure_ascii=False,
    )

    results = await asyncio.gather(
        *[
            asyncio.to_thread(
                _send_single_webpush,
                sub,
                payload_json,
                keys["vapid"],
                keys["subject"],
            )
            for sub in subs
        ],
        return_exceptions=True,
    )
    sent = 0
    failed = 0
    last_error = None
    for r in results:
        if isinstance(r, tuple) and r[0] == "ok":
            sent += 1
        else:
            failed += 1
            if isinstance(r, tuple) and r[1]:
                last_error = r[1]
            elif isinstance(r, Exception):
                last_error = str(r)

    return {"sent": sent, "total": len(subs), "failed": failed, "lastError": last_error}


def schedule_push_to_user(user_id: int, **kwargs) -> None:
    """Fire-and-forget wrapper so push delivery never delays Socket.IO or REST responses."""
    try:
        asyncio.create_task(send_push_to_user(user_id, **kwargs))
    except RuntimeError:
        pass
