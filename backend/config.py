import os
import secrets
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent
DIST_DIR = BASE_DIR / "dist"

PORT = int(os.getenv("PORT", "8000"))
APP_ENV = os.getenv("APP_ENV", "development")
CORS_ORIGIN = os.getenv("CORS_ORIGIN", "*")
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./data/zumbido05.db")

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
