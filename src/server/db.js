import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

let db = null;

export function initDatabase(dbPath = process.env.DB_PATH || './data/zumbido05.db') {
  const resolved = path.resolve(dbPath);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });

  db = new DatabaseSync(resolved);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec('PRAGMA busy_timeout = 5000;');

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      nickname TEXT NOT NULL,
      personal_message TEXT NOT NULL DEFAULT '',
      avatar TEXT NOT NULL DEFAULT 'bubbles',
      status TEXT NOT NULL DEFAULT 'online',
      last_seen INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS friendships (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      friend_id INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      requester_id INTEGER NOT NULL,
      group_name TEXT NOT NULL DEFAULT 'Amigos',
      is_blocked INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT 0,
      UNIQUE(user_id, friend_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (friend_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      from_user_id INTEGER NOT NULL,
      to_user_id INTEGER NOT NULL,
      type TEXT NOT NULL DEFAULT 'text',
      text TEXT NOT NULL DEFAULT '',
      font TEXT NOT NULL DEFAULT 'Tahoma',
      color TEXT NOT NULL DEFAULT '#000000',
      is_bold INTEGER NOT NULL DEFAULT 0,
      is_italic INTEGER NOT NULL DEFAULT 0,
      media_data TEXT DEFAULT NULL,
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (from_user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (to_user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_messages_pair_id
      ON messages (from_user_id, to_user_id, id DESC);
    CREATE INDEX IF NOT EXISTS idx_messages_unread
      ON messages (to_user_id, from_user_id, is_read);
    CREATE INDEX IF NOT EXISTS idx_friendships_user
      ON friendships (user_id, status);
  `);

  return db;
}

export function getDb() {
  if (!db) {
    initDatabase();
  }
  return db;
}

export function sanitizeUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    nickname: row.nickname,
    personalMessage: row.personal_message || '',
    avatar: row.avatar || 'bubbles',
    status: row.status || 'online',
    lastSeen: row.last_seen || Date.now(),
    createdAt: row.created_at || Date.now()
  };
}

// --- USERS ---

export function createUser({ email, passwordHash, nickname, personalMessage = '', avatar = 'bubbles', status = 'online' }) {
  const now = Date.now();
  const stmt = getDb().prepare(`
    INSERT INTO users (email, password_hash, nickname, personal_message, avatar, status, last_seen, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const info = stmt.run(email.trim().toLowerCase(), passwordHash, nickname.trim(), personalMessage.trim(), avatar, status, now, now);
  return getUserById(Number(info.lastInsertRowid));
}

export function getUserByEmailRaw(email) {
  return getDb().prepare('SELECT * FROM users WHERE email = ?').get(email.trim().toLowerCase()) || null;
}

export function getUserById(id) {
  const row = getDb().prepare('SELECT * FROM users WHERE id = ?').get(Number(id));
  return sanitizeUser(row);
}

export function updateUserProfile(userId, fields) {
  const allowed = [];
  const params = [];

  if (typeof fields.nickname === 'string' && fields.nickname.trim()) {
    allowed.push('nickname = ?');
    params.push(fields.nickname.trim().slice(0, 120));
  }
  if (typeof fields.personalMessage === 'string') {
    allowed.push('personal_message = ?');
    params.push(fields.personalMessage.trim().slice(0, 180));
  }
  if (typeof fields.avatar === 'string' && fields.avatar.length > 0) {
    allowed.push('avatar = ?');
    params.push(fields.avatar);
  }
  if (typeof fields.status === 'string') {
    allowed.push('status = ?');
    params.push(fields.status);
  }
  allowed.push('last_seen = ?');
  params.push(Date.now());

  if (allowed.length === 0) return getUserById(userId);

  params.push(Number(userId));
  getDb().prepare(`UPDATE users SET ${allowed.join(', ')} WHERE id = ?`).run(...params);
  return getUserById(userId);
}

export function touchUserLastSeen(userId) {
  getDb().prepare('UPDATE users SET last_seen = ? WHERE id = ?').run(Date.now(), Number(userId));
}

// --- FRIENDSHIPS ---

export function getFriendship(userId, friendId) {
  return getDb()
    .prepare('SELECT * FROM friendships WHERE user_id = ? AND friend_id = ?')
    .get(Number(userId), Number(friendId)) || null;
}

export function createFriendRequest(fromUserId, toUserId) {
  const now = Date.now();
  const database = getDb();
  const existing = getFriendship(fromUserId, toUserId);
  if (existing) {
    return { alreadyExists: true, friendship: existing };
  }

  const insert = database.prepare(`
    INSERT INTO friendships (user_id, friend_id, status, requester_id, group_name, is_blocked, created_at)
    VALUES (?, ?, 'pending', ?, 'Amigos', 0, ?)
  `);

  database.exec('BEGIN');
  try {
    insert.run(Number(fromUserId), Number(toUserId), Number(fromUserId), now);
    insert.run(Number(toUserId), Number(fromUserId), Number(fromUserId), now);
    database.exec('COMMIT');
  } catch (err) {
    database.exec('ROLLBACK');
    throw err;
  }

  return { alreadyExists: false };
}

export function acceptFriendRequest(userId, requesterId) {
  const row = getFriendship(userId, requesterId);
  if (!row || row.status !== 'pending' || row.requester_id === Number(userId)) {
    return false;
  }
  const database = getDb();
  const update = database.prepare(`
    UPDATE friendships SET status = 'accepted'
    WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)
  `);
  update.run(Number(userId), Number(requesterId), Number(requesterId), Number(userId));
  return true;
}

export function removeFriendship(userId, friendId) {
  const info = getDb().prepare(`
    DELETE FROM friendships
    WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)
  `).run(Number(userId), Number(friendId), Number(friendId), Number(userId));
  return info.changes > 0;
}

export function updateFriendGroup(userId, friendId, groupName) {
  const cleanGroup = (groupName || 'Amigos').trim().slice(0, 40) || 'Amigos';
  const info = getDb().prepare(`
    UPDATE friendships SET group_name = ?
    WHERE user_id = ? AND friend_id = ? AND status = 'accepted'
  `).run(cleanGroup, Number(userId), Number(friendId));
  return info.changes > 0 ? cleanGroup : null;
}

export function setFriendBlocked(userId, friendId, isBlocked) {
  const val = isBlocked ? 1 : 0;
  const info = getDb().prepare(`
    UPDATE friendships SET is_blocked = ?
    WHERE user_id = ? AND friend_id = ? AND status = 'accepted'
  `).run(val, Number(userId), Number(friendId));
  return info.changes > 0;
}

export function isBlockedBetween(userA, userB) {
  const row = getDb().prepare(`
    SELECT 1 FROM friendships
    WHERE ((user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?))
      AND is_blocked = 1
    LIMIT 1
  `).get(Number(userA), Number(userB), Number(userB), Number(userA));
  return Boolean(row);
}

export function didUserBlock(ownerId, targetId) {
  const row = getDb().prepare(`
    SELECT is_blocked FROM friendships WHERE user_id = ? AND friend_id = ?
  `).get(Number(ownerId), Number(targetId));
  return Boolean(row && row.is_blocked === 1);
}

export function getFriendsBundle(userId, onlineUserIdsSet = new Set()) {
  const uid = Number(userId);
  const rows = getDb().prepare(`
    SELECT
      f.status AS relation_status,
      f.requester_id,
      f.group_name,
      f.is_blocked,
      f.created_at AS relation_created_at,
      u.id,
      u.email,
      u.nickname,
      u.personal_message,
      u.avatar,
      u.status AS preferred_status,
      u.last_seen,
      (SELECT is_blocked FROM friendships f2 WHERE f2.user_id = u.id AND f2.friend_id = f.user_id) AS blocked_by_them,
      (SELECT COUNT(*) FROM messages m WHERE m.from_user_id = u.id AND m.to_user_id = f.user_id AND m.is_read = 0) AS unread_count
    FROM friendships f
    JOIN users u ON u.id = f.friend_id
    WHERE f.user_id = ?
    ORDER BY u.nickname COLLATE NOCASE ASC
  `).all(uid);

  const friends = [];
  const incomingRequests = [];
  const outgoingRequests = [];

  for (const r of rows) {
    if (r.relation_status === 'accepted') {
      const blockedByThem = Boolean(r.blocked_by_them);
      const isOnlineSocket = onlineUserIdsSet.has(r.id);
      // Show offline if they blocked me, if they are disconnected, or if they chose appear-offline
      const effectiveStatus = (blockedByThem || !isOnlineSocket || r.preferred_status === 'offline')
        ? 'offline'
        : r.preferred_status;

      friends.push({
        id: r.id,
        email: r.email,
        nickname: r.nickname,
        personalMessage: blockedByThem ? '' : (r.personal_message || ''),
        avatar: r.avatar || 'bubbles',
        status: effectiveStatus,
        isOnline: effectiveStatus !== 'offline',
        lastSeen: r.last_seen,
        groupName: r.group_name || 'Amigos',
        isBlocked: Boolean(r.is_blocked),
        unreadCount: Number(r.unread_count || 0)
      });
    } else if (r.relation_status === 'pending') {
      const item = {
        id: r.id,
        email: r.email,
        nickname: r.nickname,
        avatar: r.avatar || 'bubbles',
        personalMessage: r.personal_message || '',
        createdAt: r.relation_created_at
      };
      if (r.requester_id === uid) {
        outgoingRequests.push(item);
      } else {
        incomingRequests.push(item);
      }
    }
  }

  return { friends, incomingRequests, outgoingRequests };
}

export function getAcceptedFriendIds(userId) {
  const rows = getDb().prepare(`
    SELECT friend_id FROM friendships WHERE user_id = ? AND status = 'accepted'
  `).all(Number(userId));
  return rows.map((r) => r.friend_id);
}

// --- MESSAGES ---

export function saveMessage({
  fromUserId,
  toUserId,
  type = 'text',
  text = '',
  font = 'Tahoma',
  color = '#000000',
  isBold = false,
  isItalic = false,
  mediaData = null
}) {
  const now = Date.now();
  const stmt = getDb().prepare(`
    INSERT INTO messages (
      from_user_id, to_user_id, type, text, font, color, is_bold, is_italic, media_data, is_read, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
  `);
  const info = stmt.run(
    Number(fromUserId),
    Number(toUserId),
    type,
    String(text || '').slice(0, 4000),
    String(font || 'Tahoma').slice(0, 80),
    String(color || '#000000').slice(0, 30),
    isBold ? 1 : 0,
    isItalic ? 1 : 0,
    mediaData || null,
    now
  );

  return formatMessageRow(
    getDb().prepare('SELECT * FROM messages WHERE id = ?').get(Number(info.lastInsertRowid))
  );
}

export function formatMessageRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    fromUserId: row.from_user_id,
    toUserId: row.to_user_id,
    type: row.type,
    text: row.text,
    font: row.font,
    color: row.color,
    isBold: Boolean(row.is_bold),
    isItalic: Boolean(row.is_italic),
    mediaData: row.media_data,
    isRead: Boolean(row.is_read),
    timestamp: row.created_at
  };
}

export function getConversationMessages(userId, friendId, { beforeId = null, limit = 30 } = {}) {
  const uid = Number(userId);
  const fid = Number(friendId);
  const safeLimit = Math.min(Math.max(Number(limit) || 30, 1), 100);

  let rows;
  if (beforeId) {
    rows = getDb().prepare(`
      SELECT * FROM messages
      WHERE ((from_user_id = ? AND to_user_id = ?) OR (from_user_id = ? AND to_user_id = ?))
        AND id < ?
      ORDER BY id DESC
      LIMIT ?
    `).all(uid, fid, fid, uid, Number(beforeId), safeLimit + 1);
  } else {
    rows = getDb().prepare(`
      SELECT * FROM messages
      WHERE (from_user_id = ? AND to_user_id = ?) OR (from_user_id = ? AND to_user_id = ?)
      ORDER BY id DESC
      LIMIT ?
    `).all(uid, fid, fid, uid, safeLimit + 1);
  }

  const hasMore = rows.length > safeLimit;
  const page = hasMore ? rows.slice(0, safeLimit) : rows;
  page.reverse();

  return {
    messages: page.map(formatMessageRow),
    hasMore
  };
}

export function markConversationRead(userId, friendId) {
  const info = getDb().prepare(`
    UPDATE messages SET is_read = 1
    WHERE from_user_id = ? AND to_user_id = ? AND is_read = 0
  `).run(Number(friendId), Number(userId));
  return info.changes;
}
