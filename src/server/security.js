import crypto from 'node:crypto';

export const ALLOWED_STATUSES = new Set([
  'online',
  'busy',
  'away',
  'brb',
  'phone',
  'lunch',
  'offline'
]);

export const MAX_AVATAR_BYTES = 350 * 1024; // 350 KB
export const MAX_MEDIA_BYTES = 2.5 * 1024 * 1024; // 2.5 MB
export const NUDGE_COOLDOWN_MS = 5000;

let cachedSecret = null;

export function getJwtSecret() {
  if (process.env.JWT_SECRET && process.env.JWT_SECRET.trim().length >= 16) {
    return process.env.JWT_SECRET.trim();
  }
  if (!cachedSecret) {
    cachedSecret = crypto.randomBytes(32).toString('hex');
    if (process.env.NODE_ENV === 'production') {
      console.warn('[Zumbido 05] ADVERTENCIA: Define JWT_SECRET en tus variables de entorno para sesiones persistentes en produccion.');
    }
  }
  return cachedSecret;
}

export function securityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'microphone=(self), camera=(self)');
  next();
}

export function createRateLimiter({ windowMs = 15 * 60 * 1000, max = 30, message = 'Demasiadas solicitudes. Intenta nuevamente en unos minutos.' }) {
  const hits = new Map();

  // Periodic cleanup
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of hits.entries()) {
      if (entry.resetAt <= now) hits.delete(key);
    }
  }, Math.min(windowMs, 60000));
  if (timer.unref) timer.unref();

  return (req, res, next) => {
    const ip = req.ip || req.socket?.remoteAddress || 'unknown';
    const now = Date.now();
    let entry = hits.get(ip);

    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      hits.set(ip, entry);
    }

    entry.count += 1;
    if (entry.count > max) {
      return res.status(429).json({ error: message });
    }
    next();
  };
}

export function isValidEmail(email) {
  if (typeof email !== 'string') return false;
  const trimmed = email.trim();
  return trimmed.length >= 5 && trimmed.length <= 120 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
}

export function isValidPassword(password) {
  return typeof password === 'string' && password.length >= 6 && password.length <= 128;
}

export function isValidAvatar(avatar) {
  if (typeof avatar !== 'string' || avatar.length === 0) return false;
  if (/^[a-z0-9_-]{2,32}$/i.test(avatar)) return true;
  if (/^data:image\/(png|jpeg|jpg|webp|gif);base64,/i.test(avatar)) {
    return Buffer.byteLength(avatar, 'utf8') <= MAX_AVATAR_BYTES;
  }
  return false;
}

export function isValidMediaData(type, mediaData) {
  if (!mediaData) return true;
  if (typeof mediaData !== 'string') return false;
  if (Buffer.byteLength(mediaData, 'utf8') > MAX_MEDIA_BYTES) return false;

  if (type === 'image' || type === 'ink') {
    return /^data:image\/(png|jpeg|jpg|webp|gif);base64,/i.test(mediaData);
  }
  if (type === 'voice') {
    return /^data:audio\/[a-z0-9.+-]+(;codecs=[a-z0-9,._-]+)?;base64,/i.test(mediaData);
  }
  if (type === 'wink') {
    return /^[a-z0-9_-]{2,24}$/i.test(mediaData);
  }
  return false;
}

// Track nudge cooldowns per sender->receiver pair
const nudgeTimestamps = new Map();

export function checkNudgeCooldown(fromUserId, toUserId) {
  const key = `${fromUserId}:${toUserId}`;
  const now = Date.now();
  const last = nudgeTimestamps.get(key) || 0;
  const elapsed = now - last;

  if (elapsed < NUDGE_COOLDOWN_MS) {
    return {
      allowed: false,
      retryAfterMs: NUDGE_COOLDOWN_MS - elapsed
    };
  }

  nudgeTimestamps.set(key, now);
  return { allowed: true, retryAfterMs: 0 };
}
