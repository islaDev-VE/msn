import re
import time
from typing import Optional

import bcrypt
import jwt

from backend.config import (
    JWT_SECRET,
    MAX_AVATAR_BYTES,
    MAX_MEDIA_BYTES,
    NUDGE_COOLDOWN_MS,
)

EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
RETRO_AVATAR_RE = re.compile(r"^[a-zA-Z0-9_-]{2,32}$")
IMAGE_DATA_URL_RE = re.compile(r"^data:image/(png|jpeg|jpg|webp|gif);base64,", re.IGNORECASE)
AUDIO_DATA_URL_RE = re.compile(
    r"^data:audio/[a-z0-9.+-]+(;codecs=[a-z0-9,._-]+)?;base64,",
    re.IGNORECASE,
)
WINK_ID_RE = re.compile(r"^[a-zA-Z0-9_-]{2,24}$")


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt(rounds=10)).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
    except Exception:
        return False


def sign_token(user: dict) -> str:
    now = int(time.time())
    payload = {
        "userId": user["id"],
        "email": user["email"],
        "iat": now,
        "exp": now + 30 * 24 * 3600,
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")


def decode_token(token: str) -> Optional[dict]:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
    except Exception:
        return None


def is_valid_email(email: Optional[str]) -> bool:
    if not isinstance(email, str):
        return False
    trimmed = email.strip()
    return 5 <= len(trimmed) <= 120 and bool(EMAIL_RE.match(trimmed))


def is_valid_password(password: Optional[str]) -> bool:
    return isinstance(password, str) and 6 <= len(password) <= 128


def is_valid_avatar(avatar: Optional[str]) -> bool:
    if not isinstance(avatar, str) or not avatar:
        return False
    if RETRO_AVATAR_RE.match(avatar):
        return True
    if IMAGE_DATA_URL_RE.match(avatar):
        return len(avatar.encode("utf-8")) <= MAX_AVATAR_BYTES
    return False


def is_valid_media_data(msg_type: str, media_data: Optional[str]) -> bool:
    if not media_data:
        return True
    if not isinstance(media_data, str):
        return False
    if len(media_data.encode("utf-8")) > MAX_MEDIA_BYTES:
        return False
    if msg_type in ("image", "ink"):
        return bool(IMAGE_DATA_URL_RE.match(media_data))
    if msg_type == "voice":
        return bool(AUDIO_DATA_URL_RE.match(media_data))
    if msg_type == "wink":
        return bool(WINK_ID_RE.match(media_data))
    return False


class RateLimiter:
    def __init__(self, window_sec: int, max_requests: int):
        self.window_sec = window_sec
        self.max_requests = max_requests
        self._hits: dict[str, tuple[int, float]] = {}

    def allow(self, key: str) -> bool:
        now = time.time()
        count, reset_at = self._hits.get(key, (0, 0.0))
        if reset_at <= now:
            self._hits[key] = (1, now + self.window_sec)
            return True
        if count >= self.max_requests:
            return False
        self._hits[key] = (count + 1, reset_at)
        return True


auth_limiter = RateLimiter(window_sec=15 * 60, max_requests=30)
api_limiter = RateLimiter(window_sec=60, max_requests=120)

_nudge_timestamps: dict[str, int] = {}


def check_nudge_cooldown(from_user_id: int, to_user_id: int) -> tuple[bool, int]:
    key = f"{from_user_id}:{to_user_id}"
    now = int(time.time() * 1000)
    last = _nudge_timestamps.get(key, 0)
    elapsed = now - last
    if elapsed < NUDGE_COOLDOWN_MS:
        return False, NUDGE_COOLDOWN_MS - elapsed
    _nudge_timestamps[key] = now
    return True, 0
