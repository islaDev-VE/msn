import { io } from 'socket.io-client';

let socket = null;

export function connectSocket(token, onConnectionStateChange) {
  disconnectSocket();

  socket = io(window.location.origin, {
    auth: { token },
    transports: ['polling', 'websocket'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1200,
    reconnectionDelayMax: 6000
  });

  socket.on('connect', () => {
    onConnectionStateChange?.('connected');
  });

  socket.on('disconnect', () => {
    onConnectionStateChange?.('reconnecting');
  });

  socket.io.on('reconnect_attempt', () => {
    onConnectionStateChange?.('reconnecting');
  });

  socket.io.on('reconnect', () => {
    onConnectionStateChange?.('connected');
  });

  socket.on('connect_error', (err) => {
    if (err?.message === 'INVALID_TOKEN' || err?.message === 'AUTH_REQUIRED') {
      onConnectionStateChange?.('auth_error');
    } else {
      onConnectionStateChange?.('reconnecting');
    }
  });

  return socket;
}

export function getSocket() {
  return socket;
}

export function reconnectSocketNow() {
  if (!socket) return;
  if (!socket.connected) {
    socket.connect();
  }
}

export function disconnectSocket() {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
}
