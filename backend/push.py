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


def _load_or_create_vapid_keys() -> Optional[dict]:
    global _vapid_cache
    if _vapid_cache is not None:
        return _vapid_cache
    if not WEBPUSH_AVAILABLE:
        return None

    # 1. Explicit env vars take precedence
    if VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY:
        _vapid_cache = {
            "publicKey": VAPID_PUBLIC_KEY,
            "privateKey": VAPID_PRIVATE_KEY.replace("\\n", "\n"),
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
                    "subject": VAPID_SUBJECT,
                }
                return _vapid_cache
        except Exception:
            pass

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
        "subject": VAPID_SUBJECT,
    }
    return _vapid_cache


def get_vapid_public_key() -> Optional[str]:
    keys = _load_or_create_vapid_keys()
    return keys["publicKey"] if keys else None


def _send_single_webpush(sub: dict, payload_json: str, private_key: str, subject: str) -> str:
    try:
        webpush(
            subscription_info={
                "endpoint": sub["endpoint"],
                "keys": sub["keys"],
            },
            data=payload_json,
            vapid_private_key=private_key,
            vapid_claims={"sub": subject},
            ttl=86400,
        )
        return "ok"
    except WebPushException as exc:
        status = getattr(getattr(exc, "response", None), "status_code", None)
        if status in (404, 410):
            delete_push_subscription_by_endpoint(sub["endpoint"])
            return "expired"
        return "error"
    except Exception:
        return "error"


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
) -> dict:
    keys = _load_or_create_vapid_keys()
    if not keys:
        return {"sent": 0, "total": 0}

    subs = get_user_push_subscriptions(user_id)
    if not subs:
        return {"sent": 0, "total": 0}

    payload_json = json.dumps(
        {
            "title": strip_plus_tags(title) or "Zumbido 05",
            "body": strip_plus_tags(body) or "Tienes un mensaje nuevo.",
            "url": url,
            "tag": tag or "zumbido-05-msg",
            "vibrate": vibrate or [140, 60, 140],
            "force": force,
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
                keys["privateKey"],
                keys["subject"],
            )
            for sub in subs
        ],
        return_exceptions=True,
    )
    sent = sum(1 for r in results if r == "ok")
    return {"sent": sent, "total": len(subs)}


def schedule_push_to_user(user_id: int, **kwargs) -> None:
    """Fire-and-forget wrapper so push delivery never delays Socket.IO or REST responses."""
    try:
        asyncio.create_task(send_push_to_user(user_id, **kwargs))
    except RuntimeError:
        pass
