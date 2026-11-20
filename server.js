import 'dotenv/config';
import express from 'express';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  initDatabase,
  createUser,
  getUserByEmailRaw,
  getUserById,
  updateUserProfile,
  touchUserLastSeen,
  createFriendRequest,
  acceptFriendRequest,
  removeFriendship,
  updateFriendGroup,
  setFriendBlocked,
  isBlockedBetween,
  didUserBlock,
  getFriendsBundle,
  getAcceptedFriendIds,
  getFriendship,
  saveMessage,
  getConversationMessages,
  markConversationRead,
  sanitizeUser
} from './src/server/db.js';

import {
  ALLOWED_STATUSES,
  getJwtSecret,
  securityHeaders,
  createRateLimiter,
  isValidEmail,
  isValidPassword,
  isValidAvatar,
  isValidMediaData,
  checkNudgeCooldown
} from './src/server/security.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

initDatabase(process.env.DB_PATH || './data/zumbido05.db');

const app = express();
const corsOrigin = process.env.CORS_ORIGIN || '*';

app.set('trust proxy', 1);
app.use(securityHeaders);
app.use(cors({ origin: corsOrigin }));
app.use(express.json({ limit: '4mb' }));

const httpServer = createServer(app);
const io = new Server(httpServer, {
  maxHttpBufferSize: 4 * 1024 * 1024,
  cors: {
    origin: corsOrigin,
    methods: ['GET', 'POST', 'PUT', 'DELETE']
  }
});

// Track connected sockets per userId: Map<number, Set<string>>
const userSockets = new Map();

function getOnlineUserIdsSet() {
  const set = new Set();
  for (const [uid, sockets] of userSockets.entries()) {
    if (sockets.size > 0) set.add(uid);
  }
  return set;
}

function emitToUser(userId, event, payload) {
  io.to(`user:${userId}`).emit(event, payload);
}

function notifyFriendsPresence(userId) {
  const user = getUserById(userId);
  if (!user) return;
  const onlineSet = getOnlineUserIdsSet();
  const isConnected = onlineSet.has(userId);
  const friendIds = getAcceptedFriendIds(userId);

  for (const fid of friendIds) {
    if (!onlineSet.has(fid)) continue;
    const iBlockedThem = didUserBlock(userId, fid);
    const effectiveStatus = (iBlockedThem || !isConnected || user.status === 'offline')
      ? 'offline'
      : user.status;

    emitToUser(fid, 'friend_presence', {
      userId: user.id,
      nickname: user.nickname,
      personalMessage: iBlockedThem ? '' : user.personalMessage,
      avatar: user.avatar,
      status: effectiveStatus,
      isOnline: effectiveStatus !== 'offline',
      lastSeen: user.lastSeen
    });
  }
}

function signToken(user) {
  return jwt.sign(
    { userId: user.id, email: user.email },
    getJwtSecret(),
    { expiresIn: '30d' }
  );
}

function authMiddleware(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : null;
  if (!token) {
    return res.status(401).json({ error: 'Sesión no autorizada. Inicia sesión nuevamente.' });
  }
  try {
    const decoded = jwt.verify(token, getJwtSecret());
    const user = getUserById(decoded.userId);
    if (!user) {
      return res.status(401).json({ error: 'Usuario no encontrado.' });
    }
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: 'Tu sesión expiró. Vuelve a iniciar sesión.' });
  }
}

const authLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: 'Demasiados intentos de acceso. Espera unos minutos e inténtalo de nuevo.'
});

const apiLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 120,
  message: 'Límite temporal de peticiones alcanzado.'
});

// ========================
// REST API ROUTES
// ========================

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'zumbido-05',
    activeUsers: userSockets.size,
    timestamp: Date.now()
  });
});

app.post('/api/auth/register', authLimiter, async (req, res) => {
  try {
    const { email, password, nickname, personalMessage, avatar, status } = req.body || {};

    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'Ingresa una dirección de correo válida (ej. tu_nombre@ejemplo.com).' });
    }
    if (!isValidPassword(password)) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres.' });
    }
    const cleanNick = (nickname || email.split('@')[0]).trim().slice(0, 120);
    if (!cleanNick) {
      return res.status(400).json({ error: 'El nombre para mostrar es obligatorio.' });
    }

    const safeAvatar = avatar && isValidAvatar(avatar) ? avatar : 'bubbles';
    const safeStatus = status && ALLOWED_STATUSES.has(status) ? status : 'online';

    const existing = getUserByEmailRaw(email);
    if (existing) {
      return res.status(409).json({ error: 'Ya existe una cuenta registrada con ese correo electrónico.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = createUser({
      email,
      passwordHash,
      nickname: cleanNick,
      personalMessage: typeof personalMessage === 'string' ? personalMessage.slice(0, 180) : '',
      avatar: safeAvatar,
      status: safeStatus
    });

    const token = signToken(user);
    return res.status(201).json({ token, user });
  } catch (err) {
    console.error('[Zumbido 05] Register error:', err);
    return res.status(500).json({ error: 'No se pudo crear la cuenta. Intenta nuevamente.' });
  }
});

app.post('/api/auth/login', authLimiter, async (req, res) => {
  try {
    const { email, password, status } = req.body || {};

    if (!isValidEmail(email) || typeof password !== 'string') {
      return res.status(400).json({ error: 'Correo o contraseña inválidos.' });
    }

    const rawUser = getUserByEmailRaw(email);
    if (!rawUser) {
      return res.status(401).json({ error: 'Correo o contraseña incorrectos.' });
    }

    const valid = await bcrypt.compare(password, rawUser.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Correo o contraseña incorrectos.' });
    }

    let user = sanitizeUser(rawUser);
    if (status && ALLOWED_STATUSES.has(status)) {
      user = updateUserProfile(user.id, { status });
    } else {
      touchUserLastSeen(user.id);
      user = getUserById(user.id);
    }

    const token = signToken(user);
    return res.json({ token, user });
  } catch (err) {
    console.error('[Zumbido 05] Login error:', err);
    return res.status(500).json({ error: 'Error al iniciar sesión.' });
  }
});

app.get('/api/auth/me', authMiddleware, (req, res) => {
  res.json({ user: req.user });
});

app.put('/api/auth/profile', authMiddleware, apiLimiter, (req, res) => {
  const { nickname, personalMessage, avatar, status } = req.body || {};
  const updates = {};

  if (nickname !== undefined) {
    if (typeof nickname !== 'string' || !nickname.trim()) {
      return res.status(400).json({ error: 'El apodo no puede estar vacío.' });
    }
    updates.nickname = nickname;
  }
  if (personalMessage !== undefined) {
    updates.personalMessage = String(personalMessage);
  }
  if (avatar !== undefined) {
    if (!isValidAvatar(avatar)) {
      return res.status(400).json({ error: 'Formato o tamaño de foto inválido (máximo 350 KB).' });
    }
    updates.avatar = avatar;
  }
  if (status !== undefined) {
    if (!ALLOWED_STATUSES.has(status)) {
      return res.status(400).json({ error: 'Estado no válido.' });
    }
    updates.status = status;
  }

  const updated = updateUserProfile(req.user.id, updates);
  // Sync across user's own tabs/devices and notify friends
  emitToUser(req.user.id, 'profile_updated', { user: updated });
  notifyFriendsPresence(req.user.id);
  res.json({ user: updated });
});

// --- FRIENDS ROUTES ---

app.get('/api/friends', authMiddleware, (req, res) => {
  const bundle = getFriendsBundle(req.user.id, getOnlineUserIdsSet());
  res.json(bundle);
});

app.post('/api/friends/request', authMiddleware, apiLimiter, (req, res) => {
  const { email } = req.body || {};
  if (!isValidEmail(email)) {
    return res.status(400).json({ error: 'Ingresa un correo electrónico válido.' });
  }

  const targetRaw = getUserByEmailRaw(email);
  if (!targetRaw) {
    return res.status(404).json({ error: 'No existe ningún usuario registrado con ese correo.' });
  }
  if (targetRaw.id === req.user.id) {
    return res.status(400).json({ error: 'No puedes agregarte a ti mismo como contacto.' });
  }

  const result = createFriendRequest(req.user.id, targetRaw.id);
  if (result.alreadyExists) {
    if (result.friendship.status === 'accepted') {
      return res.status(409).json({ error: 'Ese usuario ya está en tu lista de contactos.' });
    }
    return res.status(409).json({ error: 'Ya existe una solicitud pendiente con este contacto.' });
  }

  // Notify target in real time
  emitToUser(targetRaw.id, 'friend_request_received', {
    from: {
      id: req.user.id,
      email: req.user.email,
      nickname: req.user.nickname,
      avatar: req.user.avatar,
      personalMessage: req.user.personalMessage,
      createdAt: Date.now()
    }
  });

  const bundle = getFriendsBundle(req.user.id, getOnlineUserIdsSet());
  res.status(201).json({ message: 'Solicitud enviada correctamente.', ...bundle });
});

app.post('/api/friends/respond', authMiddleware, apiLimiter, (req, res) => {
  const { friendId, action } = req.body || {};
  const fid = Number(friendId);
  if (!fid || !['accept', 'reject'].includes(action)) {
    return res.status(400).json({ error: 'Solicitud de respuesta inválida.' });
  }

  if (action === 'accept') {
    const ok = acceptFriendRequest(req.user.id, fid);
    if (!ok) {
      return res.status(404).json({ error: 'Solicitud no encontrada o ya procesada.' });
    }
    emitToUser(fid, 'friend_request_accepted', {
      user: req.user,
      bundle: getFriendsBundle(fid, getOnlineUserIdsSet())
    });
    notifyFriendsPresence(req.user.id);
    notifyFriendsPresence(fid);
  } else {
    removeFriendship(req.user.id, fid);
    emitToUser(fid, 'friends_refresh', getFriendsBundle(fid, getOnlineUserIdsSet()));
  }

  const bundle = getFriendsBundle(req.user.id, getOnlineUserIdsSet());
  res.json(bundle);
});

app.put('/api/friends/:friendId/group', authMiddleware, apiLimiter, (req, res) => {
  const fid = Number(req.params.friendId);
  const { groupName } = req.body || {};
  const updatedGroup = updateFriendGroup(req.user.id, fid, groupName);
  if (!updatedGroup) {
    return res.status(404).json({ error: 'Contacto no encontrado.' });
  }
  const bundle = getFriendsBundle(req.user.id, getOnlineUserIdsSet());
  emitToUser(req.user.id, 'friends_refresh', bundle);
  res.json({ groupName: updatedGroup, ...bundle });
});

app.put('/api/friends/:friendId/block', authMiddleware, apiLimiter, (req, res) => {
  const fid = Number(req.params.friendId);
  const { blocked } = req.body || {};
  const ok = setFriendBlocked(req.user.id, fid, Boolean(blocked));
  if (!ok) {
    return res.status(404).json({ error: 'Contacto no encontrado.' });
  }
  // Update presence visibility for the blocked/unblocked contact
  notifyFriendsPresence(req.user.id);
  const bundle = getFriendsBundle(req.user.id, getOnlineUserIdsSet());
  emitToUser(req.user.id, 'friends_refresh', bundle);
  res.json(bundle);
});

app.delete('/api/friends/:friendId', authMiddleware, apiLimiter, (req, res) => {
  const fid = Number(req.params.friendId);
  const removed = removeFriendship(req.user.id, fid);
  if (!removed) {
    return res.status(404).json({ error: 'Contacto no encontrado.' });
  }
  emitToUser(fid, 'friends_refresh', getFriendsBundle(fid, getOnlineUserIdsSet()));
  const bundle = getFriendsBundle(req.user.id, getOnlineUserIdsSet());
  emitToUser(req.user.id, 'friends_refresh', bundle);
  res.json(bundle);
});

// --- MESSAGES ROUTES ---

app.get('/api/messages/:friendId', authMiddleware, (req, res) => {
  const fid = Number(req.params.friendId);
  const rel = getFriendship(req.user.id, fid);
  if (!rel || rel.status !== 'accepted') {
    return res.status(403).json({ error: 'Solo puedes ver el historial con tus contactos admitidos.' });
  }

  const beforeId = req.query.before ? Number(req.query.before) : null;
  const limit = req.query.limit ? Number(req.query.limit) : 30;
  const result = getConversationMessages(req.user.id, fid, { beforeId, limit });
  res.json(result);
});

app.post('/api/messages/:friendId/read', authMiddleware, (req, res) => {
  const fid = Number(req.params.friendId);
  const updatedCount = markConversationRead(req.user.id, fid);
  emitToUser(req.user.id, 'conversation_read', { friendId: fid });
  res.json({ ok: true, updatedCount });
});

// ========================
// SOCKET.IO WITH JWT AUTH
// ========================

io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) {
    return next(new Error('AUTH_REQUIRED'));
  }
  try {
    const decoded = jwt.verify(token, getJwtSecret());
    const user = getUserById(decoded.userId);
    if (!user) return next(new Error('USER_NOT_FOUND'));
    socket.userId = user.id;
    next();
  } catch {
    next(new Error('INVALID_TOKEN'));
  }
});

io.on('connection', (socket) => {
  const userId = socket.userId;
  const wasOffline = !userSockets.has(userId) || userSockets.get(userId).size === 0;

  if (!userSockets.has(userId)) {
    userSockets.set(userId, new Set());
  }
  userSockets.get(userId).add(socket.id);
  socket.join(`user:${userId}`);

  touchUserLastSeen(userId);

  // Send fresh friend list to this socket
  socket.emit('friends_refresh', getFriendsBundle(userId, getOnlineUserIdsSet()));

  // Notify friends if user just came online
  if (wasOffline) {
    const me = getUserById(userId);
    const friendIds = getAcceptedFriendIds(userId);
    const onlineSet = getOnlineUserIdsSet();

    for (const fid of friendIds) {
      if (!onlineSet.has(fid)) continue;
      const iBlockedThem = didUserBlock(userId, fid);
      if (!iBlockedThem && me && me.status !== 'offline') {
        emitToUser(fid, 'friend_signed_in', {
          user: {
            id: me.id,
            nickname: me.nickname,
            avatar: me.avatar,
            personalMessage: me.personalMessage,
            status: me.status
          }
        });
      }
    }
    notifyFriendsPresence(userId);
  }

  socket.on('send_message', (payload, ack) => {
    try {
      const toUserId = Number(payload?.toUserId);
      const type = ['text', 'ink', 'image', 'voice'].includes(payload?.type) ? payload.type : 'text';
      const text = typeof payload?.text === 'string' ? payload.text : '';
      const mediaData = payload?.mediaData || null;

      if (!toUserId) {
        return ack?.({ error: 'Destinatario inválido.' });
      }
      const rel = getFriendship(userId, toUserId);
      if (!rel || rel.status !== 'accepted') {
        return ack?.({ error: 'Este usuario no está en tu lista de contactos.' });
      }
      if (isBlockedBetween(userId, toUserId)) {
        return ack?.({ error: 'No puedes enviar mensajes porque el contacto está bloqueado.' });
      }
      if (type === 'text' && !text.trim()) {
        return ack?.({ error: 'El mensaje no puede estar vacío.' });
      }
      if (!isValidMediaData(type, mediaData)) {
        return ack?.({ error: 'El archivo adjunto excede el tamaño permitido o tiene un formato no soportado.' });
      }

      const saved = saveMessage({
        fromUserId: userId,
        toUserId,
        type,
        text,
        font: payload.font || 'Tahoma',
        color: payload.color || '#000000',
        isBold: Boolean(payload.isBold),
        isItalic: Boolean(payload.isItalic),
        mediaData
      });

      const sender = getUserById(userId);
      const wirePayload = { ...saved, fromUser: sender };

      emitToUser(userId, 'receive_message', wirePayload);
      emitToUser(toUserId, 'receive_message', wirePayload);
      ack?.({ ok: true, message: wirePayload });
    } catch (err) {
      console.error('[Zumbido 05] send_message error:', err);
      ack?.({ error: 'Error al enviar el mensaje.' });
    }
  });

  socket.on('send_nudge', (payload, ack) => {
    const toUserId = Number(payload?.toUserId);
    if (!toUserId) return ack?.({ error: 'Destinatario inválido.' });

    const rel = getFriendship(userId, toUserId);
    if (!rel || rel.status !== 'accepted') {
      return ack?.({ error: 'Contacto no encontrado.' });
    }
    if (isBlockedBetween(userId, toUserId)) {
      return ack?.({ error: 'No puedes enviar zumbidos a un contacto bloqueado.' });
    }

    const cooldown = checkNudgeCooldown(userId, toUserId);
    if (!cooldown.allowed) {
      const secs = Math.ceil(cooldown.retryAfterMs / 1000);
      const msg = `No puedes enviar un zumbido con tanta frecuencia. Espera ${secs}s.`;
      socket.emit('nudge_cooldown', { toUserId, retryAfterMs: cooldown.retryAfterMs, message: msg });
      return ack?.({ error: msg, cooldown: true, retryAfterMs: cooldown.retryAfterMs });
    }

    const saved = saveMessage({
      fromUserId: userId,
      toUserId,
      type: 'nudge',
      text: '¡Envió un zumbido!'
    });

    const sender = getUserById(userId);
    const wirePayload = { ...saved, fromUser: sender };

    emitToUser(userId, 'receive_nudge', wirePayload);
    emitToUser(toUserId, 'receive_nudge', wirePayload);
    ack?.({ ok: true, message: wirePayload });
  });

  socket.on('send_wink', (payload, ack) => {
    const toUserId = Number(payload?.toUserId);
    const winkId = String(payload?.winkId || 'laugh');
    if (!toUserId || !isValidMediaData('wink', winkId)) {
      return ack?.({ error: 'Guiño inválido.' });
    }

    const rel = getFriendship(userId, toUserId);
    if (!rel || rel.status !== 'accepted' || isBlockedBetween(userId, toUserId)) {
      return ack?.({ error: 'No se pudo enviar el guiño.' });
    }

    const saved = saveMessage({
      fromUserId: userId,
      toUserId,
      type: 'wink',
      text: winkId,
      mediaData: winkId
    });

    const sender = getUserById(userId);
    const wirePayload = { ...saved, winkId, fromUser: sender };

    emitToUser(userId, 'receive_wink', wirePayload);
    emitToUser(toUserId, 'receive_wink', wirePayload);
    ack?.({ ok: true, message: wirePayload });
  });

  socket.on('typing_status', ({ toUserId, isTyping }) => {
    const tid = Number(toUserId);
    if (!tid || isBlockedBetween(userId, tid)) return;
    const sender = getUserById(userId);
    emitToUser(tid, 'user_typing', {
      fromUserId: userId,
      nickname: sender?.nickname || 'Contacto',
      isTyping: Boolean(isTyping)
    });
  });

  socket.on('mark_read', ({ friendId }) => {
    const fid = Number(friendId);
    if (!fid) return;
    markConversationRead(userId, fid);
    emitToUser(userId, 'conversation_read', { friendId: fid });
  });

  socket.on('disconnect', () => {
    const set = userSockets.get(userId);
    if (set) {
      set.delete(socket.id);
      if (set.size === 0) {
        userSockets.delete(userId);
        touchUserLastSeen(userId);
        notifyFriendsPresence(userId);
      }
    }
  });
});

// Serve built SPA frontend
const distPath = path.join(__dirname, 'dist');
app.use(express.static(distPath));

app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Endpoint no encontrado.' });
  }
  const indexPath = path.join(distPath, 'index.html');
  res.sendFile(indexPath, (err) => {
    if (err) {
      res.status(200).send('Zumbido 05 API Server ejecutándose. Ejecuta `npm run build` para servir el cliente.');
    }
  });
});

const PORT = Number(process.env.PORT || 3000);
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`[Zumbido 05] Servidor listo en http://localhost:${PORT}`);
});
