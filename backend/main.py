import math
from typing import Optional

import socketio
from fastapi import Depends, FastAPI, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel

from backend.config import (
    ALLOWED_STATUSES,
    CORS_ORIGIN,
    DIST_DIR,
    PORT,
)
from backend.database import (
    accept_friend_request,
    create_friend_request,
    create_user,
    did_user_block,
    get_accepted_friend_ids,
    get_conversation_messages,
    get_friends_bundle,
    get_friendship,
    get_user_by_email_raw,
    get_user_by_id,
    init_db,
    is_blocked_between,
    mark_conversation_read,
    now_ms,
    remove_friendship,
    sanitize_user,
    save_message,
    set_friend_blocked,
    touch_user_last_seen,
    update_friend_group,
    update_user_profile,
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
    sign_token,
    verify_password,
)

# Initialize database tables on startup
init_db()

cors_origins = ["*"] if CORS_ORIGIN == "*" else [o.strip() for o in CORS_ORIGIN.split(",") if o.strip()]

fastapi_app = FastAPI(title="Zumbido 05 API", version="1.0.0")

fastapi_app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@fastapi_app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "SAMEORIGIN"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "microphone=(self), camera=(self)"
    return response


sio = socketio.AsyncServer(
    async_mode="asgi",
    cors_allowed_origins="*" if CORS_ORIGIN == "*" else cors_origins,
    max_http_buffer_size=4 * 1024 * 1024,
)

# Active connected sockets per userId: dict[int, set[str]]
user_sockets: dict[int, set[str]] = {}


def get_online_user_ids() -> set[int]:
    return {uid for uid, sids in user_sockets.items() if len(sids) > 0}


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
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


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


# ========================
# REST API ENDPOINTS
# ========================

@fastapi_app.get("/api/health")
async def health_check():
    return {
        "status": "ok",
        "service": "zumbido-05",
        "runtime": "python-fastapi",
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
    if not clean_nick:
        return JSONResponse(status_code=400, content={"error": "El nombre para mostrar es obligatorio."})

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
    token = sign_token(user)
    return JSONResponse(status_code=201, content={"token": token, "user": user})


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
        if not payload.nickname.strip():
            return JSONResponse(status_code=400, content={"error": "El apodo no puede estar vacío."})
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
        return JSONResponse(status_code=404, content={"error": "No existe ningún usuario registrado con ese correo."})
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
        remove_friendship(user["id"], fid)
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


# ========================
# SOCKET.IO REAL-TIME EVENTS
# ========================

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
    was_offline = uid not in user_sockets or len(user_sockets[uid]) == 0
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
            await notify_friends_presence(uid)


@sio.event
async def send_message(sid, payload):
    session = await sio.get_session(sid)
    user_id = session.get("user_id") if session else None
    if not user_id or not isinstance(payload, dict):
        return {"error": "Sesión o mensaje inválido."}

    try:
        to_user_id = int(payload.get("toUserId") or 0)
    except (TypeError, ValueError):
        return {"error": "Destinatario inválido."}

    if not to_user_id:
        return {"error": "Destinatario inválido."}

    msg_type = payload.get("type") if payload.get("type") in ("text", "ink", "image", "voice") else "text"
    text = payload.get("text") if isinstance(payload.get("text"), str) else ""
    media_data = payload.get("mediaData")

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
        font=payload.get("font") or "Tahoma",
        color=payload.get("color") or "#000000",
        is_bold=bool(payload.get("isBold")),
        is_italic=bool(payload.get("isItalic")),
        media_data=media_data,
    )
    sender = get_user_by_id(user_id)
    wire = {**saved, "fromUser": sender}

    await emit_to_user(user_id, "receive_message", wire)
    await emit_to_user(to_user_id, "receive_message", wire)
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
    return {"ok": True, "message": wire}


@sio.event
async def send_wink(sid, payload):
    session = await sio.get_session(sid)
    user_id = session.get("user_id") if session else None
    if not user_id or not isinstance(payload, dict):
        return {"error": "Sesión inválida."}

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
            return FileResponse(candidate)

        index_file = DIST_DIR / "index.html"
        if index_file.is_file():
            return FileResponse(index_file)

    return JSONResponse(
        status_code=200,
        content={"message": "Zumbido 05 API Python (FastAPI) ejecutándose. Ejecuta `npm run build` para servir el frontend."},
    )


# Unified ASGI app: Socket.io + FastAPI REST + PWA static files
app = socketio.ASGIApp(sio, other_asgi_app=fastapi_app)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="0.0.0.0", port=PORT, reload=False)
