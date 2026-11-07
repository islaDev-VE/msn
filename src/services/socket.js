import { io } from 'socket.io-client';

let socket = null;

export function getSocket() {
  if (!socket) {
    const serverUrl = window.location.origin;

    socket = io(serverUrl, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 1000
    });

    socket.on('connect', () => {
      console.log('[MSN 7.5 Socket] Connected with ID:', socket.id);
    });

    socket.on('disconnect', (reason) => {
      console.log('[MSN 7.5 Socket] Disconnected:', reason);
    });
  }
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
