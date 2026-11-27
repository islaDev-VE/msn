import os
import secrets
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent
DIST_DIR = BASE_DIR / "dist"
DATA_DIR = BASE_DIR / "data"

PORT = int(os.getenv("PORT", "8000"))
APP_ENV = os.getenv("APP_ENV", "development")
CORS_ORIGIN = os.getenv("CORS_ORIGIN", "*")
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./data/zumbido05.db")

VAPID_PUBLIC_KEY = os.getenv("VAPID_PUBLIC_KEY", "").strip()
VAPID_PRIVATE_KEY = os.getenv("VAPID_PRIVATE_KEY", "").strip()
VAPID_SUBJECT = os.getenv("VAPID_SUBJECT", "mailto:somos@isladev.com").strip() or "mailto:somos@isladev.com"
VAPID_KEYS_FILE = Path(os.getenv("VAPID_KEYS_FILE", str(DATA_DIR / "vapid_keys.json")))

# Grace period (seconds) before marking a mobile/disconnected socket user offline
OFFLINE_GRACE_SECONDS = float(os.getenv("OFFLINE_GRACE_SECONDS", "45"))

ALLOWED_STATUSES = {
    "online",
    "busy",
    "away",
    "brb",
    "phone",
    "lunch",
    "offline",
}

MAX_AVATAR_BYTES = 350 * 1024        # 350 KB
MAX_MEDIA_BYTES = int(2.5 * 1024 * 1024)  # 2.5 MB
NUDGE_COOLDOWN_MS = 5000

_env_secret = os.getenv("JWT_SECRET", "").strip()
if len(_env_secret) >= 16:
    JWT_SECRET = _env_secret
else:
    JWT_SECRET = secrets.token_hex(32)
    if APP_ENV == "production":
        print(
            "[Zumbido 05] ADVERTENCIA: Define JWT_SECRET (>= 16 chars) en .env para sesiones persistentes en produccion."
        )
