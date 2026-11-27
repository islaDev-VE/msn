import asyncio
import hashlib
import math
from typing import Optional

import socketio
from fastapi import Depends, FastAPI, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel

from backend.config import (
    ALLOWED_STATUSES,
    APP_ENV,
    CORS_ORIGIN,
    DIST_DIR,
    OFFLINE_GRACE_SECONDS,
    PORT,
)
from backend.database import (
    accept_friend_request,
    count_user_invitations,
    create_friend_request,
    create_or_get_invitation,
    create_user,
    delete_invitation,
    delete_push_subscription,
    did_user_block,
    get_accepted_friend_ids,
    get_conversation_messages,
    get_friends_bundle,
    get_friendship,
    get_invitation_by_code,
    get_user_by_email_raw,
    get_user_by_id,
    get_user_push_subscriptions,
    init_db,
    is_blocked_between,
    list_user_invitations,
    mark_conversation_read,
    now_ms,
    redeem_invitation,
    reject_pending_friend_request,
    remove_friendship,
    sanitize_user,
    save_message,
    save_push_subscription,
    set_friend_blocked,
    touch_user_last_seen,
    update_friend_group,
    update_user_profile,
)
from backend.push import (
    get_vapid_public_key,
    schedule_push_to_user,
    send_push_to_user,
    strip_plus_tags,
)
from backend.security import (
    api_limiter,
    auth_limiter,
    check_nudge_cooldown,
    decode_token,
    hash_password,
    is_valid_avatar,
    is_valid_email,
    is_valid_media_data,
    is_valid_password,
    is_valid_push_endpoint,
    sanitize_chat_color,
    sanitize_chat_font,
    sign_token,
    socket_msg_limiter,
    verify_password,
)

# Initialize database tables on startup
init_db()

cors_origins = ["*"] if CORS_ORIGIN == "*" else [o.strip() for o in CORS_ORIGIN.split(",") if o.strip()]

fastapi_app = FastAPI(title="Zumbido 05 API", version="1.0.0")

fastapi_app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=(CORS_ORIGIN != "*"),
    allow_methods=["*"],
    allow_headers=["*"],
)

CSP_HEADER = (
    "default-src 'self'; "
    "script-src 'self' 'unsafe-inline'; "
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
    "font-src 'self' https://fonts.gstatic.com data:; "
    "img-src 'self' data: blob: https:; "
    "media-src 'self' data: blob:; "
    "connect-src 'self' ws: wss: https:; "
    "frame-ancestors 'self'; "
    "base-uri 'self'; "
    "object-src 'none'"
)


@fastapi_app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "SAMEORIGIN"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "microphone=(self), camera=(self)"
    response.headers["Content-Security-Policy"] = CSP_HEADER
    if APP_ENV == "production":
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response


sio = socketio.AsyncServer(
    async_mode="asgi",
    cors_allowed_origins="*" if CORS_ORIGIN == "*" else cors_origins,
    max_http_buffer_size=4 * 1024 * 1024,
    ping_interval=20,
    ping_timeout=25,
)

# Active connected sockets per userId: dict[int, set[str]]
user_sockets: dict[int, set[str]] = {}
# Delayed offline tasks so brief mobile screen locks / network switches don't flap presence
pending_offline_tasks: dict[int, asyncio.Task] = {}


def get_online_user_ids() -> set[int]:
    active = {uid for uid, sids in user_sockets.items() if len(sids) > 0}
    return active | set(pending_offline_tasks.keys())


async def emit_to_user(user_id: int, event_name: str, payload: dict):
    await sio.emit(event_name, payload, room=f"user:{user_id}")


async def notify_friends_presence(user_id: int):
    user = get_user_by_id(user_id)
    if not user:
        return
    online_ids = get_online_user_ids()
    is_connected = user_id in online_ids
    friend_ids = get_accepted_friend_ids(user_id)

    for fid in friend_ids:
        if fid not in online_ids:
            continue
        i_blocked_them = did_user_block(user_id, fid)
        effective_status = (
            "offline"
            if (i_blocked_them or not is_connected or user["status"] == "offline")
            else user["status"]
        )
        await emit_to_user(
            fid,
            "friend_presence",
            {
                "userId": user["id"],
                "nickname": user["nickname"],
                "personalMessage": "" if i_blocked_them else user["personalMessage"],
                "avatar": user["avatar"],
                "status": effective_status,
                "isOnline": effective_status != "offline",
                "lastSeen": user["lastSeen"],
            },
        )


def client_ip(request: Request) -> str:
    # Uvicorn with --proxy-headers --forwarded-allow-ips=127.0.0.1 sets request.client.host reliably
    host = request.client.host if request.client else ""
    if host and host not in ("127.0.0.1", "::1", "localhost"):
        return host
    forwarded = request.headers.get("x-forwarded-for", "")
    if forwarded:
        # Take the right-most non-loopback IP appended by our trusted reverse proxy (Apache)
        hops = [h.strip() for h in forwarded.split(",") if h.strip()]
        for hop in reversed(hops):
            if hop not in ("127.0.0.1", "::1", "localhost"):
                return hop
    return host or "unknown"


def get_current_user(request: Request) -> Optional[dict]:
    auth_header = request.headers.get("authorization", "")
    if not auth_header.startswith("Bearer "):
        return None
    token = auth_header[7:].strip()
    decoded = decode_token(token)
    if not decoded or "userId" not in decoded:
        return None
    return get_user_by_id(int(decoded["userId"]))


def require_user(request: Request):
    user = get_current_user(request)
    if not user:
        return None
    return user


# ========================
# PYDANTIC SCHEMAS
# ========================

class RegisterPayload(BaseModel):
    email: str
    password: str
    nickname: Optional[str] = None
    personalMessage: Optional[str] = ""
    avatar: Optional[str] = "bubbles"
    status: Optional[str] = "online"
    inviteCode: Optional[str] = None


class LoginPayload(BaseModel):
    email: str
    password: str
    status: Optional[str] = None


class ProfileUpdatePayload(BaseModel):
    nickname: Optional[str] = None
    personalMessage: Optional[str] = None
    avatar: Optional[str] = None
    status: Optional[str] = None


class FriendRequestPayload(BaseModel):
    email: str


class FriendRespondPayload(BaseModel):
    friendId: int
    action: str


class FriendGroupPayload(BaseModel):
    groupName: str


class FriendBlockPayload(BaseModel):
    blocked: bool


class InvitationCreatePayload(BaseModel):
    email: Optional[str] = None
    regenerate: bool = False


class PushKeysPayload(BaseModel):
    p256dh: str
    auth: str


class PushSubscribePayload(BaseModel):
    endpoint: str
    keys: PushKeysPayload


class PushUnsubscribePayload(BaseModel):
    endpoint: str


# ========================
# REST API ENDPOINTS
# ========================

def _get_frontend_build_id() -> str:
    index_file = DIST_DIR / "index.html"
    if not index_file.is_file():
        return "dev"
    try:
        return hashlib.sha256(index_file.read_bytes()).hexdigest()[:12]
    except OSError:
        return "unknown"


@fastapi_app.get("/api/health")
async def health_check():
    return {
        "status": "ok",
        "service": "zumbido-05",
        "runtime": "python-fastapi",
        "buildId": _get_frontend_build_id(),
        "activeUsers": len(get_online_user_ids()),
        "timestamp": now_ms(),
    }


@fastapi_app.post("/api/auth/register")
async def register(payload: RegisterPayload, request: Request):
    if not auth_limiter.allow(client_ip(request)):
        return JSONResponse(
            status_code=429,
            content={"error": "Demasiados intentos de acceso. Espera unos minutos e inténtalo de nuevo."},
        )

    if not is_valid_email(payload.email):
        return JSONResponse(
            status_code=400,
            content={"error": "Ingresa una dirección de correo válida (ej. tu_nombre@ejemplo.com)."},
        )
    if not is_valid_password(payload.password):
        return JSONResponse(
            status_code=400,
            content={"error": "La contraseña debe tener al menos 6 caracteres."},
        )

    clean_nick = (payload.nickname or payload.email.split("@")[0]).strip()[:120]
    if not clean_nick or not strip_plus_tags(clean_nick):
        return JSONResponse(status_code=400, content={"error": "El nombre para mostrar debe contener texto visible."})

    safe_avatar = payload.avatar if (payload.avatar and is_valid_avatar(payload.avatar)) else "bubbles"
    safe_status = payload.status if (payload.status in ALLOWED_STATUSES) else "online"

    if get_user_by_email_raw(payload.email):
        return JSONResponse(
            status_code=409,
            content={"error": "Ya existe una cuenta registrada con ese correo electrónico."},
        )

    pw_hash = hash_password(payload.password)
    user = create_user(
        email=payload.email,
        password_hash=pw_hash,
        nickname=clean_nick,
        personal_message=payload.personalMessage or "",
        avatar=safe_avatar,
        status=safe_status,
    )

    invited_by = None
    if payload.inviteCode and payload.inviteCode.strip():
        redeemed = redeem_invitation(payload.inviteCode.strip(), user["id"])
        if redeemed and not redeemed.get("selfInvite") and redeemed.get("inviter"):
            invited_by = redeemed["inviter"]
            inviter_id = invited_by["id"]
            inviter_bundle = get_friends_bundle(inviter_id, get_online_user_ids())
            await emit_to_user(
                inviter_id,
                "invite_joined",
                {"user": user, "bundle": inviter_bundle},
            )
            schedule_push_to_user(
                inviter_id,
                title=f"🎉 {strip_plus_tags(user['nickname'])} aceptó tu invitación",
                body="Se unió a Zumbido 05 y ya está en tu lista de contactos.",
                url=f"/?chat={user['id']}",
                tag=f"z05-invite-{user['id']}",
                data={"kind": "invite_joined", "friendId": user["id"]},
            )

    token = sign_token(user)
    return JSONResponse(
        status_code=201,
        content={"token": token, "user": user, "invitedBy": invited_by},
    )


@fastapi_app.post("/api/auth/login")
async def login(payload: LoginPayload, request: Request):
    if not auth_limiter.allow(client_ip(request)):
        return JSONResponse(
            status_code=429,
            content={"error": "Demasiados intentos de acceso. Espera unos minutos e inténtalo de nuevo."},
        )

    if not is_valid_email(payload.email) or not isinstance(payload.password, str):
        return JSONResponse(status_code=400, content={"error": "Correo o contraseña inválidos."})

    raw_user = get_user_by_email_raw(payload.email)
    if not raw_user or not verify_password(payload.password, raw_user.password_hash):
        return JSONResponse(status_code=401, content={"error": "Correo o contraseña incorrectos."})

    user = sanitize_user(raw_user)
    if payload.status and payload.status in ALLOWED_STATUSES:
        user = update_user_profile(user["id"], {"status": payload.status})
    else:
        touch_user_last_seen(user["id"])
        user = get_user_by_id(user["id"])

    token = sign_token(user)
    return {"token": token, "user": user}


@fastapi_app.get("/api/auth/me")
async def auth_me(user: Optional[dict] = Depends(require_user)):
    if not user:
        return JSONResponse(status_code=401, content={"error": "Sesión no autorizada. Inicia sesión nuevamente."})
    return {"user": user}


@fastapi_app.put("/api/auth/profile")
async def update_profile(
    payload: ProfileUpdatePayload,
    request: Request,
    user: Optional[dict] = Depends(require_user),
):
    if not user:
        return JSONResponse(status_code=401, content={"error": "Sesión no autorizada."})
    if not api_limiter.allow(client_ip(request)):
        return JSONResponse(status_code=429, content={"error": "Límite temporal de peticiones alcanzado."})

    updates = {}
    if payload.nickname is not None:
        if not payload.nickname.strip() or not strip_plus_tags(payload.nickname):
            return JSONResponse(status_code=400, content={"error": "El apodo debe contener texto visible."})
        updates["nickname"] = payload.nickname
    if payload.personalMessage is not None:
        updates["personalMessage"] = payload.personalMessage
    if payload.avatar is not None:
        if not is_valid_avatar(payload.avatar):
            return JSONResponse(status_code=400, content={"error": "Formato o tamaño de foto inválido (máximo 350 KB)."})
        updates["avatar"] = payload.avatar
    if payload.status is not None:
        if payload.status not in ALLOWED_STATUSES:
            return JSONResponse(status_code=400, content={"error": "Estado no válido."})
        updates["status"] = payload.status

    updated = update_user_profile(user["id"], updates)
    await emit_to_user(user["id"], "profile_updated", {"user": updated})
    await notify_friends_presence(user["id"])
    return {"user": updated}


# --- FRIENDS ---

@fastapi_app.get("/api/friends")
async def list_friends(user: Optional[dict] = Depends(require_user)):
    if not user:
        return JSONResponse(status_code=401, content={"error": "Sesión no autorizada."})
    return get_friends_bundle(user["id"], get_online_user_ids())


@fastapi_app.post("/api/friends/request")
async def request_friend(
    payload: FriendRequestPayload,
    request: Request,
    user: Optional[dict] = Depends(require_user),
):
    if not user:
        return JSONResponse(status_code=401, content={"error": "Sesión no autorizada."})
    if not api_limiter.allow(client_ip(request)):
        return JSONResponse(status_code=429, content={"error": "Límite temporal de peticiones alcanzado."})
    if not is_valid_email(payload.email):
        return JSONResponse(status_code=400, content={"error": "Ingresa un correo electrónico válido."})

    target_raw = get_user_by_email_raw(payload.email)
    if not target_raw:
        return JSONResponse(
            status_code=404,
            content={
                "error": "No existe ningún usuario registrado con ese correo.",
                "code": "USER_NOT_FOUND",
                "email": payload.email.strip().lower(),
            },
        )
    if target_raw.id == user["id"]:
        return JSONResponse(status_code=400, content={"error": "No puedes agregarte a ti mismo como contacto."})

    result = create_friend_request(user["id"], target_raw.id)
    if result["already_exists"]:
        msg = (
            "Ese usuario ya está en tu lista de contactos."
            if result["status"] == "accepted"
            else "Ya existe una solicitud pendiente con este contacto."
        )
        return JSONResponse(status_code=409, content={"error": msg})

    await emit_to_user(
        target_raw.id,
        "friend_request_received",
        {
            "from": {
                "id": user["id"],
                "email": user["email"],
                "nickname": user["nickname"],
                "avatar": user["avatar"],
                "personalMessage": user["personalMessage"],
                "createdAt": now_ms(),
            }
        },
    )
    schedule_push_to_user(
        target_raw.id,
        title="👥 Nueva solicitud en Zumbido 05",
        body=f"{strip_plus_tags(user['nickname'])} quiere agregarte como contacto.",
        url="/",
        tag=f"z05-req-{user['id']}",
        data={"kind": "friend_request", "fromUserId": user["id"]},
    )

    bundle = get_friends_bundle(user["id"], get_online_user_ids())
    return JSONResponse(status_code=201, content={"message": "Solicitud enviada correctamente.", **bundle})


@fastapi_app.post("/api/friends/respond")
async def respond_friend(
    payload: FriendRespondPayload,
    request: Request,
    user: Optional[dict] = Depends(require_user),
):
    if not user:
        return JSONResponse(status_code=401, content={"error": "Sesión no autorizada."})
    if not api_limiter.allow(client_ip(request)):
        return JSONResponse(status_code=429, content={"error": "Límite temporal de peticiones alcanzado."})
    if payload.action not in ("accept", "reject"):
        return JSONResponse(status_code=400, content={"error": "Solicitud de respuesta inválida."})

    fid = int(payload.friendId)
    if payload.action == "accept":
        ok = accept_friend_request(user["id"], fid)
        if not ok:
            return JSONResponse(status_code=404, content={"error": "Solicitud no encontrada o ya procesada."})
        await emit_to_user(
            fid,
            "friend_request_accepted",
            {"user": user, "bundle": get_friends_bundle(fid, get_online_user_ids())},
        )
        await notify_friends_presence(user["id"])
        await notify_friends_presence(fid)
    else:
        ok = reject_pending_friend_request(user["id"], fid)
        if not ok:
            return JSONResponse(status_code=404, content={"error": "Solicitud pendiente no encontrada."})
        await emit_to_user(fid, "friends_refresh", get_friends_bundle(fid, get_online_user_ids()))

    return get_friends_bundle(user["id"], get_online_user_ids())


@fastapi_app.put("/api/friends/{friend_id}/group")
async def change_friend_group(
    friend_id: int,
    payload: FriendGroupPayload,
    user: Optional[dict] = Depends(require_user),
):
    if not user:
        return JSONResponse(status_code=401, content={"error": "Sesión no autorizada."})
    updated_group = update_friend_group(user["id"], friend_id, payload.groupName)
    if not updated_group:
        return JSONResponse(status_code=404, content={"error": "Contacto no encontrado."})
    bundle = get_friends_bundle(user["id"], get_online_user_ids())
    await emit_to_user(user["id"], "friends_refresh", bundle)
    return {"groupName": updated_group, **bundle}


@fastapi_app.put("/api/friends/{friend_id}/block")
async def toggle_block_friend(
    friend_id: int,
    payload: FriendBlockPayload,
    user: Optional[dict] = Depends(require_user),
):
    if not user:
        return JSONResponse(status_code=401, content={"error": "Sesión no autorizada."})
    ok = set_friend_blocked(user["id"], friend_id, payload.blocked)
    if not ok:
        return JSONResponse(status_code=404, content={"error": "Contacto no encontrado."})
    await notify_friends_presence(user["id"])
    bundle = get_friends_bundle(user["id"], get_online_user_ids())
    await emit_to_user(user["id"], "friends_refresh", bundle)
    return bundle


@fastapi_app.delete("/api/friends/{friend_id}")
async def delete_friend(friend_id: int, user: Optional[dict] = Depends(require_user)):
    if not user:
        return JSONResponse(status_code=401, content={"error": "Sesión no autorizada."})
    removed = remove_friendship(user["id"], friend_id)
    if not removed:
        return JSONResponse(status_code=404, content={"error": "Contacto no encontrado."})
    await emit_to_user(friend_id, "friends_refresh", get_friends_bundle(friend_id, get_online_user_ids()))
    bundle = get_friends_bundle(user["id"], get_online_user_ids())
    await emit_to_user(user["id"], "friends_refresh", bundle)
    return bundle


# --- INVITATIONS ---

@fastapi_app.get("/api/invitations")
async def get_my_invitations(user: Optional[dict] = Depends(require_user)):
    if not user:
        return JSONResponse(status_code=401, content={"error": "Sesión no autorizada."})
    # Ensure personal general invitation link always exists
    personal = create_or_get_invitation(user["id"], invited_email=None, regenerate=False)
    return {
        "personal": personal,
        "invitations": list_user_invitations(user["id"]),
    }


@fastapi_app.post("/api/invitations")
async def create_invitation_endpoint(
    payload: InvitationCreatePayload,
    request: Request,
    user: Optional[dict] = Depends(require_user),
):
    if not user:
        return JSONResponse(status_code=401, content={"error": "Sesión no autorizada."})
    if not api_limiter.allow(client_ip(request)):
        return JSONResponse(status_code=429, content={"error": "Límite temporal de peticiones alcanzado."})

    clean_email = payload.email.strip().lower() if (payload.email and payload.email.strip()) else None
    if clean_email is not None:
        if not is_valid_email(clean_email):
            return JSONResponse(status_code=400, content={"error": "Ingresa un correo electrónico válido para invitar."})
        existing_user = get_user_by_email_raw(clean_email)
        if existing_user:
            return JSONResponse(
                status_code=409,
                content={
                    "error": "Ese correo ya tiene una cuenta en Zumbido 05. Agrégalo directamente como contacto.",
                    "code": "ALREADY_REGISTERED",
                },
            )
        if count_user_invitations(user["id"]) >= 50:
            return JSONResponse(
                status_code=429,
                content={"error": "Alcanzaste el límite de 50 invitaciones activas. Elimina alguna antigua para crear otra."},
            )

    inv = create_or_get_invitation(
        inviter_id=user["id"],
        invited_email=clean_email,
        regenerate=bool(payload.regenerate),
    )
    return JSONResponse(
        status_code=201,
        content={
            "invitation": inv,
            "invitations": list_user_invitations(user["id"]),
        },
    )


@fastapi_app.get("/api/invitations/{code}")
async def inspect_invitation_endpoint(code: str, request: Request):
    if not api_limiter.allow(client_ip(request)):
        return JSONResponse(status_code=429, content={"error": "Demasiadas consultas. Intenta en unos segundos."})
    info = get_invitation_by_code(code)
    if not info:
        return JSONResponse(status_code=404, content={"error": "Este enlace de invitación no existe o fue revocado."})
    return {"valid": True, **info}


@fastapi_app.post("/api/invitations/{code}/accept")
async def accept_invitation_endpoint(
    code: str,
    request: Request,
    user: Optional[dict] = Depends(require_user),
):
    if not user:
        return JSONResponse(status_code=401, content={"error": "Sesión no autorizada."})
    if not api_limiter.allow(client_ip(request)):
        return JSONResponse(status_code=429, content={"error": "Límite temporal de peticiones alcanzado."})

    redeemed = redeem_invitation(code, user["id"])
    if not redeemed:
        return JSONResponse(status_code=404, content={"error": "Este enlace de invitación no existe o fue revocado."})
    if redeemed.get("selfInvite"):
        return JSONResponse(status_code=400, content={"error": "Ese es tu propio enlace de invitación."})
    if redeemed.get("blocked"):
        return JSONResponse(status_code=403, content={"error": "No es posible aceptar esta invitación."})

    inviter = redeemed["inviter"]
    inviter_id = inviter["id"]
    if not redeemed.get("alreadyFriends"):
        inviter_bundle = get_friends_bundle(inviter_id, get_online_user_ids())
        await emit_to_user(
            inviter_id,
            "invite_joined",
            {"user": user, "bundle": inviter_bundle},
        )
        await notify_friends_presence(user["id"])
        await notify_friends_presence(inviter_id)

    my_bundle = get_friends_bundle(user["id"], get_online_user_ids())
    return {
        "ok": True,
        "inviter": inviter,
        "alreadyFriends": bool(redeemed.get("alreadyFriends")),
        **my_bundle,
    }


@fastapi_app.delete("/api/invitations/{code}")
async def delete_invitation_endpoint(code: str, user: Optional[dict] = Depends(require_user)):
    if not user:
        return JSONResponse(status_code=401, content={"error": "Sesión no autorizada."})
    removed = delete_invitation(user["id"], code)
    if not removed:
        return JSONResponse(status_code=404, content={"error": "Invitación no encontrada."})
    return {"ok": True, "invitations": list_user_invitations(user["id"])}


# --- MESSAGES ---

@fastapi_app.get("/api/messages/{friend_id}")
async def get_messages(
    friend_id: int,
    before: Optional[int] = Query(default=None),
    limit: int = Query(default=30),
    user: Optional[dict] = Depends(require_user),
):
    if not user:
        return JSONResponse(status_code=401, content={"error": "Sesión no autorizada."})
    rel = get_friendship(user["id"], friend_id)
    if not rel or rel.status != "accepted":
        return JSONResponse(
            status_code=403,
            content={"error": "Solo puedes ver el historial con tus contactos admitidos."},
        )
    return get_conversation_messages(user["id"], friend_id, before_id=before, limit=limit)


@fastapi_app.post("/api/messages/{friend_id}/read")
async def read_messages(friend_id: int, user: Optional[dict] = Depends(require_user)):
    if not user:
        return JSONResponse(status_code=401, content={"error": "Sesión no autorizada."})
    updated_count = mark_conversation_read(user["id"], friend_id)
    await emit_to_user(user["id"], "conversation_read", {"friendId": friend_id})
    return {"ok": True, "updatedCount": updated_count}


# --- WEB PUSH NOTIFICATIONS ---

@fastapi_app.get("/api/push/public-key")
async def push_public_key():
    pub = get_vapid_public_key()
    return {
        "enabled": bool(pub),
        "publicKey": pub,
    }


@fastapi_app.post("/api/push/subscribe")
async def push_subscribe(
    payload: PushSubscribePayload,
    request: Request,
    user: Optional[dict] = Depends(require_user),
):
    if not user:
        return JSONResponse(status_code=401, content={"error": "Sesión no autorizada."})
    if not api_limiter.allow(client_ip(request)):
        return JSONResponse(status_code=429, content={"error": "Límite temporal de peticiones alcanzado."})
    if not is_valid_push_endpoint(payload.endpoint):
        return JSONResponse(status_code=400, content={"error": "Endpoint de notificación no permitido o inválido."})
    if not payload.keys.p256dh or not payload.keys.auth:
        return JSONResponse(status_code=400, content={"error": "Claves de suscripción incompletas."})

    ua = request.headers.get("user-agent", "")[:255]
    save_push_subscription(
        user_id=user["id"],
        endpoint=payload.endpoint,
        p256dh=payload.keys.p256dh,
        auth=payload.keys.auth,
        user_agent=ua,
    )
    subs = get_user_push_subscriptions(user["id"])
    return JSONResponse(status_code=201, content={"ok": True, "devices": len(subs)})


@fastapi_app.delete("/api/push/subscribe")
async def push_unsubscribe(
    payload: PushUnsubscribePayload,
    user: Optional[dict] = Depends(require_user),
):
    if not user:
        return JSONResponse(status_code=401, content={"error": "Sesión no autorizada."})
    removed = delete_push_subscription(user["id"], payload.endpoint)
    return {"ok": True, "removed": removed}


@fastapi_app.post("/api/push/test")
async def push_test(
    request: Request,
    user: Optional[dict] = Depends(require_user),
):
    if not user:
        return JSONResponse(status_code=401, content={"error": "Sesión no autorizada."})
    if not api_limiter.allow(client_ip(request)):
        return JSONResponse(status_code=429, content={"error": "Espera unos segundos antes de probar nuevamente."})

    res = await send_push_to_user(
        user["id"],
        title="🔔 Zumbido 05 — Notificaciones activas",
        body="¡Perfecto! Recibirás mensajes y zumbidos aunque apagues la pantalla.",
        url="/",
        tag="z05-test-push",
        vibrate=[180, 80, 180],
        data={"kind": "test"},
        force=True,
    )
    if res["total"] == 0:
        return JSONResponse(
            status_code=400,
            content={"error": "Este dispositivo aún no está suscrito a notificaciones Push."},
        )
    if res["sent"] == 0:
        return JSONResponse(
            status_code=502,
            content={
                "error": "No se pudo entregar la notificación al servicio Push. Reintenta o vuelve a activar las notificaciones.",
                "detail": res.get("lastError"),
            },
        )
    return {"ok": True, **res}


# ========================
# SOCKET.IO REAL-TIME EVENTS
# ========================

async def _delayed_mark_offline(uid: int):
    try:
        if OFFLINE_GRACE_SECONDS > 0:
            await asyncio.sleep(OFFLINE_GRACE_SECONDS)
        # Only mark offline if user still has zero active sockets
        if len(user_sockets.get(uid, set())) == 0:
            pending_offline_tasks.pop(uid, None)
            touch_user_last_seen(uid)
            await notify_friends_presence(uid)
    except asyncio.CancelledError:
        return


@sio.event
async def connect(sid, environ, auth):
    token = auth.get("token") if isinstance(auth, dict) else None
    if not token:
        raise socketio.exceptions.ConnectionRefusedError("AUTH_REQUIRED")

    decoded = decode_token(token)
    if not decoded or "userId" not in decoded:
        raise socketio.exceptions.ConnectionRefusedError("INVALID_TOKEN")

    user = get_user_by_id(int(decoded["userId"]))
    if not user:
        raise socketio.exceptions.ConnectionRefusedError("USER_NOT_FOUND")

    uid = user["id"]
    pending_task = pending_offline_tasks.pop(uid, None)
    was_in_grace = pending_task is not None
    if pending_task and not pending_task.done():
        pending_task.cancel()

    was_offline = (uid not in user_sockets or len(user_sockets[uid]) == 0) and not was_in_grace
    user_sockets.setdefault(uid, set()).add(sid)

    await sio.save_session(sid, {"user_id": uid})
    await sio.enter_room(sid, f"user:{uid}")
    touch_user_last_seen(uid)

    # Send fresh friend list to newly connected socket
    await sio.emit("friends_refresh", get_friends_bundle(uid, get_online_user_ids()), to=sid)

    if was_offline:
        online_ids = get_online_user_ids()
        for fid in get_accepted_friend_ids(uid):
            if fid not in online_ids:
                continue
            if not did_user_block(uid, fid) and user["status"] != "offline":
                await emit_to_user(
                    fid,
                    "friend_signed_in",
                    {
                        "user": {
                            "id": user["id"],
                            "nickname": user["nickname"],
                            "avatar": user["avatar"],
                            "personalMessage": user["personalMessage"],
                            "status": user["status"],
                        }
                    },
                )
        await notify_friends_presence(uid)


@sio.event
async def disconnect(sid):
    session = await sio.get_session(sid)
    uid = session.get("user_id") if session else None
    if uid is None:
        return
    sids = user_sockets.get(uid)
    if sids:
        sids.discard(sid)
        if len(sids) == 0:
            user_sockets.pop(uid, None)
            touch_user_last_seen(uid)
            if OFFLINE_GRACE_SECONDS > 0:
                existing = pending_offline_tasks.pop(uid, None)
                if existing and not existing.done():
                    existing.cancel()
                pending_offline_tasks[uid] = asyncio.create_task(_delayed_mark_offline(uid))
            else:
                await notify_friends_presence(uid)


@sio.event
async def send_message(sid, payload):
    session = await sio.get_session(sid)
    user_id = session.get("user_id") if session else None
    if not user_id or not isinstance(payload, dict):
        return {"error": "Sesión o mensaje inválido."}
    if not socket_msg_limiter.allow(f"u:{user_id}"):
        return {"error": "Estás enviando mensajes demasiado rápido. Espera unos segundos."}

    try:
        to_user_id = int(payload.get("toUserId") or 0)
    except (TypeError, ValueError):
        return {"error": "Destinatario inválido."}

    if not to_user_id:
        return {"error": "Destinatario inválido."}

    msg_type = payload.get("type") if payload.get("type") in ("text", "ink", "image", "voice") else "text"
    text = payload.get("text") if isinstance(payload.get("text"), str) else ""
    media_data = payload.get("mediaData") if msg_type != "text" else None

    rel = get_friendship(user_id, to_user_id)
    if not rel or rel.status != "accepted":
        return {"error": "Este usuario no está en tu lista de contactos."}
    if is_blocked_between(user_id, to_user_id):
        return {"error": "No puedes enviar mensajes porque el contacto está bloqueado."}
    if msg_type == "text" and not text.strip():
        return {"error": "El mensaje no puede estar vacío."}
    if not is_valid_media_data(msg_type, media_data):
        return {"error": "El archivo adjunto excede el tamaño permitido o tiene un formato no soportado."}

    saved = save_message(
        from_user_id=user_id,
        to_user_id=to_user_id,
        msg_type=msg_type,
        text=text,
        font=sanitize_chat_font(payload.get("font")),
        color=sanitize_chat_color(payload.get("color")),
        is_bold=bool(payload.get("isBold")),
        is_italic=bool(payload.get("isItalic")),
        media_data=media_data,
    )
    sender = get_user_by_id(user_id)
    wire = {**saved, "fromUser": sender}

    await emit_to_user(user_id, "receive_message", wire)
    await emit_to_user(to_user_id, "receive_message", wire)

    sender_name = strip_plus_tags(sender["nickname"]) if sender else "Contacto"
    preview_body = (
        "📷 Te envió una foto"
        if msg_type == "image"
        else "🎙️ Te envió un clip de voz"
        if msg_type == "voice"
        else "✍️ Te envió una nota manuscrita"
        if msg_type == "ink"
        else text.strip()[:120]
    )
    schedule_push_to_user(
        to_user_id,
        title=f"💬 {sender_name}",
        body=preview_body,
        url=f"/?chat={user_id}",
        tag=f"z05-chat-{user_id}",
        data={"kind": "message", "friendId": user_id},
    )
    return {"ok": True, "message": wire}


@sio.event
async def send_nudge(sid, payload):
    session = await sio.get_session(sid)
    user_id = session.get("user_id") if session else None
    if not user_id or not isinstance(payload, dict):
        return {"error": "Sesión inválida."}

    try:
        to_user_id = int(payload.get("toUserId") or 0)
    except (TypeError, ValueError):
        return {"error": "Destinatario inválido."}

    rel = get_friendship(user_id, to_user_id)
    if not rel or rel.status != "accepted":
        return {"error": "Contacto no encontrado."}
    if is_blocked_between(user_id, to_user_id):
        return {"error": "No puedes enviar zumbidos a un contacto bloqueado."}

    allowed, retry_ms = check_nudge_cooldown(user_id, to_user_id)
    if not allowed:
        secs = max(1, math.ceil(retry_ms / 1000))
        msg = f"No puedes enviar un zumbido con tanta frecuencia. Espera {secs}s."
        await sio.emit(
            "nudge_cooldown",
            {"toUserId": to_user_id, "retryAfterMs": retry_ms, "message": msg},
            to=sid,
        )
        return {"error": msg, "cooldown": True, "retryAfterMs": retry_ms}

    saved = save_message(
        from_user_id=user_id,
        to_user_id=to_user_id,
        msg_type="nudge",
        text="¡Envió un zumbido!",
    )
    sender = get_user_by_id(user_id)
    wire = {**saved, "fromUser": sender}

    await emit_to_user(user_id, "receive_nudge", wire)
    await emit_to_user(to_user_id, "receive_nudge", wire)

    sender_name = strip_plus_tags(sender["nickname"]) if sender else "Contacto"
    schedule_push_to_user(
        to_user_id,
        title=f"⚡ ¡Zumbido de {sender_name}!",
        body="¡Te acaba de enviar un zumbido en Zumbido 05!",
        url=f"/?chat={user_id}",
        tag=f"z05-nudge-{user_id}",
        vibrate=[220, 90, 220, 90, 320],
        data={"kind": "nudge", "friendId": user_id},
    )
    return {"ok": True, "message": wire}


@sio.event
async def send_wink(sid, payload):
    session = await sio.get_session(sid)
    user_id = session.get("user_id") if session else None
    if not user_id or not isinstance(payload, dict):
        return {"error": "Sesión inválida."}
    if not socket_msg_limiter.allow(f"u:{user_id}"):
        return {"error": "Demasiadas acciones en poco tiempo. Espera unos segundos."}

    try:
        to_user_id = int(payload.get("toUserId") or 0)
    except (TypeError, ValueError):
        return {"error": "Destinatario inválido."}

    wink_id = str(payload.get("winkId") or "laugh")
    if not to_user_id or not is_valid_media_data("wink", wink_id):
        return {"error": "Guiño inválido."}

    rel = get_friendship(user_id, to_user_id)
    if not rel or rel.status != "accepted" or is_blocked_between(user_id, to_user_id):
        return {"error": "No se pudo enviar el guiño."}

    saved = save_message(
        from_user_id=user_id,
        to_user_id=to_user_id,
        msg_type="wink",
        text=wink_id,
        media_data=wink_id,
    )
    sender = get_user_by_id(user_id)
    wire = {**saved, "winkId": wink_id, "fromUser": sender}

    await emit_to_user(user_id, "receive_wink", wire)
    await emit_to_user(to_user_id, "receive_wink", wire)

    sender_name = strip_plus_tags(sender["nickname"]) if sender else "Contacto"
    schedule_push_to_user(
        to_user_id,
        title=f"✨ {sender_name}",
        body="Te envió un guiño animado en Zumbido 05.",
        url=f"/?chat={user_id}",
        tag=f"z05-chat-{user_id}",
        data={"kind": "wink", "friendId": user_id},
    )
    return {"ok": True, "message": wire}


@sio.event
async def typing_status(sid, payload):
    session = await sio.get_session(sid)
    user_id = session.get("user_id") if session else None
    if not user_id or not isinstance(payload, dict):
        return
    try:
        to_user_id = int(payload.get("toUserId") or 0)
    except (TypeError, ValueError):
        return
    if not to_user_id or is_blocked_between(user_id, to_user_id):
        return
    sender = get_user_by_id(user_id)
    await emit_to_user(
        to_user_id,
        "user_typing",
        {
            "fromUserId": user_id,
            "nickname": sender["nickname"] if sender else "Contacto",
            "isTyping": bool(payload.get("isTyping")),
        },
    )


@sio.event
async def mark_read(sid, payload):
    session = await sio.get_session(sid)
    user_id = session.get("user_id") if session else None
    if not user_id or not isinstance(payload, dict):
        return
    try:
        friend_id = int(payload.get("friendId") or 0)
    except (TypeError, ValueError):
        return
    if not friend_id:
        return
    mark_conversation_read(user_id, friend_id)
    await emit_to_user(user_id, "conversation_read", {"friendId": friend_id})


# ========================
# STATIC BUILT FRONTEND (SPA + PWA)
# ========================

NO_CACHE_HEADERS = {
    "Cache-Control": "no-cache, no-store, must-revalidate",
    "Pragma": "no-cache",
    "Expires": "0",
}
IMMUTABLE_HEADERS = {
    "Cache-Control": "public, max-age=31536000, immutable",
}
SHORT_CACHE_HEADERS = {
    "Cache-Control": "public, max-age=3600",
}


@fastapi_app.get("/{full_path:path}")
async def serve_spa(full_path: str):
    if full_path.startswith("api/"):
        return JSONResponse(status_code=404, content={"error": "Endpoint no encontrado."})

    if DIST_DIR.exists():
        candidate = (DIST_DIR / full_path).resolve()
        try:
            candidate.relative_to(DIST_DIR.resolve())
        except ValueError:
            return JSONResponse(status_code=403, content={"error": "Acceso denegado."})

        if full_path and candidate.is_file():
            normalized = full_path.lstrip("/")
            if normalized in ("sw.js", "manifest.json", "index.html"):
                headers = NO_CACHE_HEADERS
            elif normalized.startswith("assets/"):
                headers = IMMUTABLE_HEADERS
            else:
                headers = SHORT_CACHE_HEADERS
            return FileResponse(candidate, headers=headers)

        index_file = DIST_DIR / "index.html"
        if index_file.is_file():
            return FileResponse(index_file, headers=NO_CACHE_HEADERS)

    return JSONResponse(
        status_code=200,
        content={"message": "Zumbido 05 API Python (FastAPI) ejecutándose. Ejecuta `npm run build` para servir el frontend."},
    )


# Unified ASGI app: Socket.io + FastAPI REST + PWA static files
app = socketio.ASGIApp(sio, other_asgi_app=fastapi_app)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="0.0.0.0", port=PORT, reload=False)
