const CACHE_NAME = 'zumbido-05-v4';
const STATIC_SHELL = [
  '/',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-512.png',
  '/icons/apple-touch-icon.png',
  '/icons/badge-72.png',
  '/icons/isladev-icon.png',
  '/icons/isladev-logo.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  // Never intercept API or Socket.io traffic
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/socket.io/')) {
    return;
  }

  const isNavigation =
    request.mode === 'navigate' ||
    url.pathname === '/' ||
    url.pathname === '/index.html';

  const networkRequest = isNavigation
    ? new Request(request, { cache: 'no-store' })
    : request;

  event.respondWith(
    fetch(networkRequest)
      .then((response) => {
        if (response && response.status === 200 && url.origin === self.location.origin) {
          const cloned = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, cloned));
        }
        return response;
      })
      .catch(() => caches.match(request).then((cached) => cached || caches.match('/')))
  );
});

async function applySwAppBadge(count) {
  try {
    const safeCount = Math.max(0, Number(count) || 0);
    if (safeCount > 0) {
      if (self.navigator && typeof self.navigator.setAppBadge === 'function') {
        await self.navigator.setAppBadge(safeCount);
      } else if (self.registration && typeof self.registration.setAppBadge === 'function') {
        await self.registration.setAppBadge(safeCount);
      }
    } else if (self.navigator && typeof self.navigator.clearAppBadge === 'function') {
      await self.navigator.clearAppBadge();
    } else if (self.registration && typeof self.registration.clearAppBadge === 'function') {
      await self.registration.clearAppBadge();
    }
  } catch {
    // ignore unsupported badge API
  }
}

self.addEventListener('push', (event) => {
  let payload = {
    title: 'Zumbido 05',
    body: 'Tienes un mensaje nuevo.',
    url: '/',
    tag: 'zumbido-05-msg',
    vibrate: [140, 60, 140],
    badgeCount: 1,
    data: {}
  };

  try {
    if (event.data) {
      const parsed = event.data.json();
      payload = { ...payload, ...parsed };
    }
  } catch {
    if (event.data) {
      payload.body = event.data.text() || payload.body;
    }
  }

  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const hasFocusedClient = clients.some(
        (c) => c.visibilityState === 'visible' && c.focused
      );
      const forceNotify = Boolean(payload.force || payload.data?.kind === 'nudge' || payload.data?.kind === 'test');

      if (!hasFocusedClient || forceNotify) {
        const badgeCount = typeof payload.badgeCount === 'number' ? Math.max(1, payload.badgeCount) : 1;
        await applySwAppBadge(badgeCount);
      }

      if (hasFocusedClient && !forceNotify) {
        return;
      }

      await self.registration.showNotification(payload.title, {
        body: payload.body,
        icon: '/icons/icon-192.png',
        badge: '/icons/badge-72.png',
        tag: payload.tag || 'zumbido-05-msg',
        renotify: true,
        vibrate: Array.isArray(payload.vibrate) ? payload.vibrate : [140, 60, 140],
        data: {
          url: payload.url || '/',
          ...(payload.data || {})
        }
      });
    })()
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const notifData = event.notification.data || {};
  const friendId = notifData.friendId ? Number(notifData.friendId) : null;
  const targetUrl = friendId ? `/?chat=${encodeURIComponent(friendId)}` : (notifData.url || '/');

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) {
          if (friendId) {
            client.postMessage({ type: 'OPEN_CHAT', friendId });
          }
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
