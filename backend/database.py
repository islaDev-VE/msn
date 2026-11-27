import os
import secrets
import time
from pathlib import Path
from typing import Optional

from sqlalchemy import (
    BigInteger,
    Boolean,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    and_,
    create_engine,
    event,
    func,
    or_,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, sessionmaker

from backend.config import DATABASE_URL


def now_ms() -> int:
    return int(time.time() * 1000)


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    email: Mapped[str] = mapped_column(String(120), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    nickname: Mapped[str] = mapped_column(String(120), nullable=False)
    personal_message: Mapped[str] = mapped_column(String(180), nullable=False, default="")
    avatar: Mapped[str] = mapped_column(Text, nullable=False, default="bubbles")
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="online")
    last_seen: Mapped[int] = mapped_column(BigInteger, nullable=False, default=now_ms)
    created_at: Mapped[int] = mapped_column(BigInteger, nullable=False, default=now_ms)


class Friendship(Base):
    __tablename__ = "friendships"
    __table_args__ = (
        UniqueConstraint("user_id", "friend_id", name="uq_friendship_pair"),
        Index("idx_friendships_user_status", "user_id", "status"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    friend_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")  # pending | accepted
    requester_id: Mapped[int] = mapped_column(Integer, nullable=False)
    group_name: Mapped[str] = mapped_column(String(40), nullable=False, default="Amigos")
    is_blocked: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[int] = mapped_column(BigInteger, nullable=False, default=now_ms)


class Message(Base):
    __tablename__ = "messages"
    __table_args__ = (
        Index("idx_messages_pair_id", "from_user_id", "to_user_id", "id"),
        Index("idx_messages_unread", "to_user_id", "from_user_id", "is_read"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    from_user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    to_user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    type: Mapped[str] = mapped_column(String(20), nullable=False, default="text")
    text: Mapped[str] = mapped_column(Text, nullable=False, default="")
    font: Mapped[str] = mapped_column(String(80), nullable=False, default="Tahoma")
    color: Mapped[str] = mapped_column(String(30), nullable=False, default="#000000")
    is_bold: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_italic: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    media_data: Mapped[Optional[str]] = mapped_column(Text, nullable=True, default=None)
    is_read: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[int] = mapped_column(BigInteger, nullable=False, default=now_ms)


class Invitation(Base):
    __tablename__ = "invitations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    code: Mapped[str] = mapped_column(String(32), unique=True, nullable=False, index=True)
    inviter_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    invited_email: Mapped[Optional[str]] = mapped_column(String(120), nullable=True, default=None)
    uses_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[int] = mapped_column(BigInteger, nullable=False, default=now_ms)


class PushSubscription(Base):
    __tablename__ = "push_subscriptions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    endpoint: Mapped[str] = mapped_column(Text, unique=True, nullable=False)
    p256dh: Mapped[str] = mapped_column(String(255), nullable=False)
    auth: Mapped[str] = mapped_column(String(255), nullable=False)
    user_agent: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    created_at: Mapped[int] = mapped_column(BigInteger, nullable=False, default=now_ms)
    updated_at: Mapped[int] = mapped_column(BigInteger, nullable=False, default=now_ms)


def _build_engine(db_url: str):
    if db_url.startswith("sqlite"):
        # Ensure directory exists for file-based SQLite
        if db_url.startswith("sqlite:///"):
            file_part = db_url.replace("sqlite:///", "", 1)
            if file_part != ":memory:":
                Path(file_part).resolve().parent.mkdir(parents=True, exist_ok=True)

        eng = create_engine(
            db_url,
            connect_args={"check_same_thread": False},
            future=True,
        )

        @event.listens_for(eng, "connect")
        def _set_sqlite_pragmas(dbapi_conn, _connection_record):
            cursor = dbapi_conn.cursor()
            cursor.execute("PRAGMA journal_mode=WAL;")
            cursor.execute("PRAGMA foreign_keys=ON;")
            cursor.execute("PRAGMA busy_timeout=5000;")
            cursor.close()

        return eng

    return create_engine(db_url, pool_pre_ping=True, future=True)


engine = _build_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)


def init_db():
    Base.metadata.create_all(bind=engine)


def get_session() -> Session:
    return SessionLocal()


def sanitize_user(user: Optional[User]) -> Optional[dict]:
    if not user:
        return None
    return {
        "id": user.id,
        "email": user.email,
        "nickname": user.nickname,
        "personalMessage": user.personal_message or "",
        "avatar": user.avatar or "bubbles",
        "status": user.status or "online",
        "lastSeen": user.last_seen or now_ms(),
        "createdAt": user.created_at or now_ms(),
    }


def format_message(msg: Optional[Message]) -> Optional[dict]:
    if not msg:
        return None
    return {
        "id": msg.id,
        "fromUserId": msg.from_user_id,
        "toUserId": msg.to_user_id,
        "type": msg.type,
        "text": msg.text,
        "font": msg.font,
        "color": msg.color,
        "isBold": bool(msg.is_bold),
        "isItalic": bool(msg.is_italic),
        "mediaData": msg.media_data,
        "isRead": bool(msg.is_read),
        "timestamp": msg.created_at,
    }


# --- USER QUERIES ---

def create_user(
    email: str,
    password_hash: str,
    nickname: str,
    personal_message: str = "",
    avatar: str = "bubbles",
    status: str = "online",
) -> dict:
    ts = now_ms()
    with get_session() as db:
        user = User(
            email=email.strip().lower(),
            password_hash=password_hash,
            nickname=nickname.strip()[:120],
            personal_message=(personal_message or "").strip()[:180],
            avatar=avatar or "bubbles",
            status=status or "online",
            last_seen=ts,
            created_at=ts,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        return sanitize_user(user)


def get_user_by_email_raw(email: str) -> Optional[User]:
    with get_session() as db:
        return db.query(User).filter(User.email == email.strip().lower()).first()


def get_user_by_id(user_id: int) -> Optional[dict]:
    with get_session() as db:
        return sanitize_user(db.get(User, int(user_id)))


def update_user_profile(user_id: int, updates: dict) -> Optional[dict]:
    with get_session() as db:
        user = db.get(User, int(user_id))
        if not user:
            return None
        if "nickname" in updates and str(updates["nickname"]).strip():
            user.nickname = str(updates["nickname"]).strip()[:120]
        if "personalMessage" in updates:
            user.personal_message = str(updates["personalMessage"]).strip()[:180]
        if "avatar" in updates and updates["avatar"]:
            user.avatar = str(updates["avatar"])
        if "status" in updates and updates["status"]:
            user.status = str(updates["status"])
        user.last_seen = now_ms()
        db.commit()
        db.refresh(user)
        return sanitize_user(user)


def touch_user_last_seen(user_id: int) -> None:
    with get_session() as db:
        user = db.get(User, int(user_id))
        if user:
            user.last_seen = now_ms()
            db.commit()


# --- FRIENDSHIP QUERIES ---

def get_friendship(user_id: int, friend_id: int) -> Optional[Friendship]:
    with get_session() as db:
        return (
            db.query(Friendship)
            .filter(Friendship.user_id == int(user_id), Friendship.friend_id == int(friend_id))
            .first()
        )


def create_friend_request(from_user_id: int, to_user_id: int) -> dict:
    with get_session() as db:
        existing = (
            db.query(Friendship)
            .filter(Friendship.user_id == int(from_user_id), Friendship.friend_id == int(to_user_id))
            .first()
        )
        if existing:
            return {"already_exists": True, "status": existing.status}

        ts = now_ms()
        r1 = Friendship(
            user_id=int(from_user_id),
            friend_id=int(to_user_id),
            status="pending",
            requester_id=int(from_user_id),
            group_name="Amigos",
            is_blocked=False,
            created_at=ts,
        )
        r2 = Friendship(
            user_id=int(to_user_id),
            friend_id=int(from_user_id),
            status="pending",
            requester_id=int(from_user_id),
            group_name="Amigos",
            is_blocked=False,
            created_at=ts,
        )
        db.add_all([r1, r2])
        db.commit()
        return {"already_exists": False}


def accept_friend_request(user_id: int, requester_id: int) -> bool:
    uid, rid = int(user_id), int(requester_id)
    with get_session() as db:
        row = db.query(Friendship).filter(Friendship.user_id == uid, Friendship.friend_id == rid).first()
        if not row or row.status != "pending" or row.requester_id == uid:
            return False

        db.query(Friendship).filter(
            or_(
                and_(Friendship.user_id == uid, Friendship.friend_id == rid),
                and_(Friendship.user_id == rid, Friendship.friend_id == uid),
            )
        ).update({"status": "accepted"}, synchronize_session=False)
        db.commit()
        return True


def remove_friendship(user_id: int, friend_id: int) -> bool:
    uid, fid = int(user_id), int(friend_id)
    with get_session() as db:
        deleted = (
            db.query(Friendship)
            .filter(
                or_(
                    and_(Friendship.user_id == uid, Friendship.friend_id == fid),
                    and_(Friendship.user_id == fid, Friendship.friend_id == uid),
                )
            )
            .delete(synchronize_session=False)
        )
        db.commit()
        return deleted > 0


def update_friend_group(user_id: int, friend_id: int, group_name: str) -> Optional[str]:
    clean_group = (group_name or "Amigos").strip()[:40] or "Amigos"
    with get_session() as db:
        row = (
            db.query(Friendship)
            .filter(
                Friendship.user_id == int(user_id),
                Friendship.friend_id == int(friend_id),
                Friendship.status == "accepted",
            )
            .first()
        )
        if not row:
            return None
        row.group_name = clean_group
        db.commit()
        return clean_group


def set_friend_blocked(user_id: int, friend_id: int, is_blocked: bool) -> bool:
    with get_session() as db:
        row = (
            db.query(Friendship)
            .filter(
                Friendship.user_id == int(user_id),
                Friendship.friend_id == int(friend_id),
                Friendship.status == "accepted",
            )
            .first()
        )
        if not row:
            return False
        row.is_blocked = bool(is_blocked)
        db.commit()
        return True


def is_blocked_between(user_a: int, user_b: int) -> bool:
    ua, ub = int(user_a), int(user_b)
    with get_session() as db:
        row = (
            db.query(Friendship.id)
            .filter(
                or_(
                    and_(Friendship.user_id == ua, Friendship.friend_id == ub),
                    and_(Friendship.user_id == ub, Friendship.friend_id == ua),
                ),
                Friendship.is_blocked.is_(True),
            )
            .first()
        )
        return row is not None


def did_user_block(owner_id: int, target_id: int) -> bool:
    with get_session() as db:
        row = (
            db.query(Friendship.is_blocked)
            .filter(Friendship.user_id == int(owner_id), Friendship.friend_id == int(target_id))
            .first()
        )
        return bool(row and row[0])


def get_accepted_friend_ids(user_id: int) -> list[int]:
    with get_session() as db:
        rows = (
            db.query(Friendship.friend_id)
            .filter(Friendship.user_id == int(user_id), Friendship.status == "accepted")
            .all()
        )
        return [r[0] for r in rows]


def get_friends_bundle(user_id: int, online_user_ids: set[int]) -> dict:
    uid = int(user_id)
    with get_session() as db:
        rows = (
            db.query(Friendship, User)
            .join(User, User.id == Friendship.friend_id)
            .filter(Friendship.user_id == uid)
            .order_by(func.lower(User.nickname))
            .all()
        )

        # Reverse block flags (did friend block me?)
        reverse_blocks = {
            r[0]
            for r in db.query(Friendship.user_id)
            .filter(Friendship.friend_id == uid, Friendship.is_blocked.is_(True))
            .all()
        }

        # Unread message counts grouped by sender
        unread_rows = (
            db.query(Message.from_user_id, func.count(Message.id))
            .filter(Message.to_user_id == uid, Message.is_read.is_(False))
            .group_by(Message.from_user_id)
            .all()
        )
        unread_map = {sender_id: count for sender_id, count in unread_rows}

        friends = []
        incoming_requests = []
        outgoing_requests = []

        for rel, u in rows:
            if rel.status == "accepted":
                blocked_by_them = u.id in reverse_blocks
                is_socket_online = u.id in online_user_ids
                effective_status = (
                    "offline"
                    if (blocked_by_them or not is_socket_online or u.status == "offline")
                    else u.status
                )
                friends.append(
                    {
                        "id": u.id,
                        "email": u.email,
                        "nickname": u.nickname,
                        "personalMessage": "" if blocked_by_them else (u.personal_message or ""),
                        "avatar": u.avatar or "bubbles",
                        "status": effective_status,
                        "isOnline": effective_status != "offline",
                        "lastSeen": u.last_seen,
                        "groupName": rel.group_name or "Amigos",
                        "isBlocked": bool(rel.is_blocked),
                        "unreadCount": int(unread_map.get(u.id, 0)),
                    }
                )
            elif rel.status == "pending":
                item = {
                    "id": u.id,
                    "email": u.email,
                    "nickname": u.nickname,
                    "avatar": u.avatar or "bubbles",
                    "personalMessage": u.personal_message or "",
                    "createdAt": rel.created_at,
                }
                if rel.requester_id == uid:
                    outgoing_requests.append(item)
                else:
                    incoming_requests.append(item)

        return {
            "friends": friends,
            "incomingRequests": incoming_requests,
            "outgoingRequests": outgoing_requests,
        }


# --- MESSAGE QUERIES ---

def save_message(
    from_user_id: int,
    to_user_id: int,
    msg_type: str = "text",
    text: str = "",
    font: str = "Tahoma",
    color: str = "#000000",
    is_bold: bool = False,
    is_italic: bool = False,
    media_data: Optional[str] = None,
) -> dict:
    with get_session() as db:
        msg = Message(
            from_user_id=int(from_user_id),
            to_user_id=int(to_user_id),
            type=msg_type,
            text=str(text or "")[:4000],
            font=str(font or "Tahoma")[:80],
            color=str(color or "#000000")[:30],
            is_bold=bool(is_bold),
            is_italic=bool(is_italic),
            media_data=media_data,
            is_read=False,
            created_at=now_ms(),
        )
        db.add(msg)
        db.commit()
        db.refresh(msg)
        return format_message(msg)


def get_conversation_messages(
    user_id: int,
    friend_id: int,
    before_id: Optional[int] = None,
    limit: int = 30,
) -> dict:
    uid, fid = int(user_id), int(friend_id)
    safe_limit = min(max(int(limit or 30), 1), 100)

    with get_session() as db:
        q = db.query(Message).filter(
            or_(
                and_(Message.from_user_id == uid, Message.to_user_id == fid),
                and_(Message.from_user_id == fid, Message.to_user_id == uid),
            )
        )
        if before_id is not None:
            q = q.filter(Message.id < int(before_id))

        rows = q.order_by(Message.id.desc()).limit(safe_limit + 1).all()
        has_more = len(rows) > safe_limit
        page = rows[:safe_limit] if has_more else rows
        page.reverse()

        return {
            "messages": [format_message(m) for m in page],
            "hasMore": has_more,
        }


def mark_conversation_read(user_id: int, friend_id: int) -> int:
    with get_session() as db:
        updated = (
            db.query(Message)
            .filter(
                Message.from_user_id == int(friend_id),
                Message.to_user_id == int(user_id),
                Message.is_read.is_(False),
            )
            .update({"is_read": True}, synchronize_session=False)
        )
        db.commit()
        return int(updated)


# --- INVITATION QUERIES ---

def _generate_invite_code() -> str:
    return secrets.token_urlsafe(9)


def format_invitation(inv: Optional[Invitation]) -> Optional[dict]:
    if not inv:
        return None
    return {
        "id": inv.id,
        "code": inv.code,
        "inviterId": inv.inviter_id,
        "invitedEmail": inv.invited_email,
        "usesCount": int(inv.uses_count or 0),
        "createdAt": inv.created_at,
    }


def create_accepted_friendship(user_a_id: int, user_b_id: int) -> dict:
    a, b = int(user_a_id), int(user_b_id)
    if a == b:
        return {"created": False, "already_friends": False}

    with get_session() as db:
        existing = (
            db.query(Friendship)
            .filter(
                or_(
                    and_(Friendship.user_id == a, Friendship.friend_id == b),
                    and_(Friendship.user_id == b, Friendship.friend_id == a),
                )
            )
            .all()
        )
        if existing:
            already_accepted = all(row.status == "accepted" for row in existing)
            if already_accepted:
                return {"created": False, "already_friends": True}
            for row in existing:
                row.status = "accepted"
            db.commit()
            return {"created": True, "already_friends": False}

        ts = now_ms()
        r1 = Friendship(
            user_id=a,
            friend_id=b,
            status="accepted",
            requester_id=a,
            group_name="Amigos",
            is_blocked=False,
            created_at=ts,
        )
        r2 = Friendship(
            user_id=b,
            friend_id=a,
            status="accepted",
            requester_id=a,
            group_name="Amigos",
            is_blocked=False,
            created_at=ts,
        )
        db.add_all([r1, r2])
        db.commit()
        return {"created": True, "already_friends": False}


def create_or_get_invitation(
    inviter_id: int,
    invited_email: Optional[str] = None,
    regenerate: bool = False,
) -> dict:
    uid = int(inviter_id)
    clean_email = invited_email.strip().lower()[:120] if invited_email and invited_email.strip() else None

    with get_session() as db:
        q = db.query(Invitation).filter(Invitation.inviter_id == uid)
        if clean_email is None:
            q = q.filter(Invitation.invited_email.is_(None))
        else:
            q = q.filter(Invitation.invited_email == clean_email)

        existing = q.order_by(Invitation.id.desc()).first()
        if existing and not regenerate:
            return format_invitation(existing)
        if existing and regenerate:
            existing.code = _generate_invite_code()
            existing.created_at = now_ms()
            db.commit()
            db.refresh(existing)
            return format_invitation(existing)

        inv = Invitation(
            code=_generate_invite_code(),
            inviter_id=uid,
            invited_email=clean_email,
            uses_count=0,
            created_at=now_ms(),
        )
        db.add(inv)
        db.commit()
        db.refresh(inv)
        return format_invitation(inv)


def get_invitation_by_code(code: str) -> Optional[dict]:
    clean_code = (code or "").strip()[:32]
    if not clean_code:
        return None
    with get_session() as db:
        inv = db.query(Invitation).filter(Invitation.code == clean_code).first()
        if not inv:
            return None
        inviter = db.get(User, inv.inviter_id)
        if not inviter:
            return None
        return {
            "code": inv.code,
            "invitedEmail": inv.invited_email,
            "usesCount": int(inv.uses_count or 0),
            "createdAt": inv.created_at,
            "inviter": {
                "id": inviter.id,
                "nickname": inviter.nickname,
                "personalMessage": inviter.personal_message or "",
                "avatar": inviter.avatar or "bubbles",
            },
        }


def list_user_invitations(inviter_id: int) -> list[dict]:
    with get_session() as db:
        rows = (
            db.query(Invitation)
            .filter(Invitation.inviter_id == int(inviter_id))
            .order_by(Invitation.invited_email.isnot(None), Invitation.created_at.desc())
            .all()
        )
        return [format_invitation(r) for r in rows]


def delete_invitation(inviter_id: int, code: str) -> bool:
    clean_code = (code or "").strip()[:32]
    if not clean_code:
        return False
    with get_session() as db:
        deleted = (
            db.query(Invitation)
            .filter(Invitation.inviter_id == int(inviter_id), Invitation.code == clean_code)
            .delete(synchronize_session=False)
        )
        db.commit()
        return deleted > 0


def redeem_invitation(code: str, new_user_id: int) -> Optional[dict]:
    clean_code = (code or "").strip()[:32]
    if not clean_code:
        return None
    with get_session() as db:
        inv = db.query(Invitation).filter(Invitation.code == clean_code).first()
        if not inv:
            return None
        if inv.inviter_id == int(new_user_id):
            return {"selfInvite": True, "code": inv.code}
        inviter = db.get(User, inv.inviter_id)
        if not inviter:
            return None
        inviter_dict = sanitize_user(inviter)
        inviter_id = inv.inviter_id
        inv.uses_count = int(inv.uses_count or 0) + 1
        db.commit()

    rel = create_accepted_friendship(inviter_id, int(new_user_id))
    return {
        "selfInvite": False,
        "code": clean_code,
        "inviter": inviter_dict,
        "alreadyFriends": rel["already_friends"],
    }


# --- WEB PUSH SUBSCRIPTION QUERIES ---

def save_push_subscription(
    user_id: int,
    endpoint: str,
    p256dh: str,
    auth: str,
    user_agent: str = "",
) -> dict:
    uid = int(user_id)
    clean_ep = (endpoint or "").strip()
    clean_p256dh = (p256dh or "").strip()[:255]
    clean_auth = (auth or "").strip()[:255]
    clean_ua = (user_agent or "").strip()[:255]
    ts = now_ms()

    with get_session() as db:
        existing = db.query(PushSubscription).filter(PushSubscription.endpoint == clean_ep).first()
        if existing:
            existing.user_id = uid
            existing.p256dh = clean_p256dh
            existing.auth = clean_auth
            existing.user_agent = clean_ua
            existing.updated_at = ts
            db.commit()
            return {"id": existing.id, "endpoint": existing.endpoint}

        sub = PushSubscription(
            user_id=uid,
            endpoint=clean_ep,
            p256dh=clean_p256dh,
            auth=clean_auth,
            user_agent=clean_ua,
            created_at=ts,
            updated_at=ts,
        )
        db.add(sub)
        db.commit()
        db.refresh(sub)
        return {"id": sub.id, "endpoint": sub.endpoint}


def get_user_push_subscriptions(user_id: int) -> list[dict]:
    with get_session() as db:
        rows = (
            db.query(PushSubscription)
            .filter(PushSubscription.user_id == int(user_id))
            .all()
        )
        return [
            {
                "id": r.id,
                "endpoint": r.endpoint,
                "keys": {"p256dh": r.p256dh, "auth": r.auth},
            }
            for r in rows
        ]


def delete_push_subscription(user_id: int, endpoint: str) -> bool:
    clean_ep = (endpoint or "").strip()
    if not clean_ep:
        return False
    with get_session() as db:
        deleted = (
            db.query(PushSubscription)
            .filter(PushSubscription.user_id == int(user_id), PushSubscription.endpoint == clean_ep)
            .delete(synchronize_session=False)
        )
        db.commit()
        return deleted > 0


def delete_push_subscription_by_endpoint(endpoint: str) -> bool:
    clean_ep = (endpoint or "").strip()
    if not clean_ep:
        return False
    with get_session() as db:
        deleted = (
            db.query(PushSubscription)
            .filter(PushSubscription.endpoint == clean_ep)
            .delete(synchronize_session=False)
        )
        db.commit()
        return deleted > 0


def get_user_pending_badge_count(user_id: int) -> int:
    uid = int(user_id)
    with get_session() as db:
        unread_msgs = (
            db.query(func.count(Message.id))
            .filter(Message.to_user_id == uid, Message.is_read.is_(False))
            .scalar()
            or 0
        )
        pending_reqs = (
            db.query(func.count(Friendship.id))
            .filter(
                Friendship.user_id == uid,
                Friendship.status == "pending",
                Friendship.requester_id != uid,
            )
            .scalar()
            or 0
        )
        return int(unread_msgs) + int(pending_reqs)


