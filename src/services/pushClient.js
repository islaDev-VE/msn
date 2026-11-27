import { api } from './api';

export function isPushSupported() {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

export function isIosDevice() {
  if (typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export function isStandalonePwa() {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.navigator?.standalone === true
  );
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

async function getReadyRegistration() {
  if (!('serviceWorker' in navigator)) return null;
  try {
    await navigator.serviceWorker.register('/sw.js');
  } catch {
    // ignore if already registered
  }
  return navigator.serviceWorker.ready;
}

export async function getPushStatus() {
  if (!isPushSupported()) {
    return {
      supported: false,
      permission: typeof Notification !== 'undefined' ? Notification.permission : 'unsupported',
      subscribed: false,
      needsIosInstall: isIosDevice() && !isStandalonePwa()
    };
  }
  const permission = Notification.permission;
  let subscribed = false;
  try {
    const reg = await getReadyRegistration();
    const sub = await reg?.pushManager?.getSubscription();
    subscribed = Boolean(sub);
  } catch {
    subscribed = false;
  }
  return {
    supported: true,
    permission,
    subscribed,
    needsIosInstall: isIosDevice() && !isStandalonePwa()
  };
}

export async function subscribeToWebPush() {
  if (!isPushSupported()) {
    if (isIosDevice() && !isStandalonePwa()) {
      throw new Error('En iPhone/iPad primero instala Zumbido 05: toca Compartir → "Añadir a pantalla de inicio" y ábrela desde ahí.');
    }
    throw new Error('Este navegador no soporta notificaciones Push en segundo plano.');
  }

  let permission = Notification.permission;
  if (permission === 'default') {
    permission = await Notification.requestPermission();
  }
  if (permission !== 'granted') {
    throw new Error('Debes permitir las notificaciones en los ajustes del navegador para recibir alertas con la pantalla apagada.');
  }

  const keyRes = await api.getPushPublicKey();
  if (!keyRes?.enabled || !keyRes.publicKey) {
    throw new Error('El servidor no tiene configurado Web Push en este momento.');
  }

  const reg = await getReadyRegistration();
  if (!reg?.pushManager) {
    throw new Error('No se pudo inicializar el Service Worker para notificaciones.');
  }

  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(keyRes.publicKey)
    });
  }

  const subJson = sub.toJSON();
  await api.subscribePush({
    endpoint: subJson.endpoint,
    keys: {
      p256dh: subJson.keys?.p256dh || '',
      auth: subJson.keys?.auth || ''
    }
  });

  return { ok: true, endpoint: subJson.endpoint };
}

export async function syncExistingPushSubscription() {
  if (!isPushSupported() || Notification.permission !== 'granted') {
    return false;
  }
  try {
    await subscribeToWebPush();
    return true;
  } catch {
    return false;
  }
}

export async function unsubscribeFromWebPush() {
  if (!isPushSupported()) return;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager?.getSubscription();
    if (sub) {
      await api.unsubscribePush(sub.endpoint).catch(() => {});
      await sub.unsubscribe().catch(() => {});
    }
  } catch {
    // ignore cleanup errors on logout
  }
}

export function updateAppBadge(count) {
  try {
    if (typeof navigator === 'undefined') return;
    const safeCount = Math.max(0, Number(count) || 0);
    if (safeCount > 0 && typeof navigator.setAppBadge === 'function') {
      navigator.setAppBadge(safeCount).catch(() => {});
    } else if (safeCount === 0 && typeof navigator.clearAppBadge === 'function') {
      navigator.clearAppBadge().catch(() => {});
    }
  } catch {
    // ignore unsupported badge API
  }
}
