import os
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
