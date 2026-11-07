import { io } from 'socket.io-client';

class HybridSocketClient {
  constructor() {
    this.listeners = new Map();
    this.socket = null;
    this.broadcastChannel = null;
    this.currentRoom = 'sala-msn-nostalgia';
    this.myProfile = null;
    this.knownUsers = new Map();
    this.isStaticHost = typeof window !== 'undefined' && 
      (window.location.hostname.endsWith('github.io') || window.location.protocol === 'file:');

    this.init();
  }

  init() {
    // 1. If not a purely static host or if a custom server is specified via query param ?server=...
    const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
    const customServer = urlParams ? urlParams.get('server') : null;

    if (!this.isStaticHost || customServer) {
      const serverUrl = customServer || window.location.origin;
      try {
        this.socket = io(serverUrl, {
          transports: ['websocket', 'polling'],
          reconnectionAttempts: 3,
          reconnectionDelay: 2000,
          timeout: 4000
        });

        this.socket.on('connect', () => {
          console.log('[MSN 7.5 Socket] Connected to remote server:', this.socket.id);
        });

        // Forward server events to our listeners
        ['room_users', 'user_joined', 'user_left', 'receive_message', 'receive_nudge', 'receive_wink', 'user_typing'].forEach((evt) => {
          this.socket.on(evt, (data) => {
            this.emitLocal(evt, data);
          });
        });
      } catch (e) {
        console.warn('[MSN 7.5 Socket] Could not connect to remote server, using local broadcast channel fallback.');
      }
    }

    // 2. Setup BroadcastChannel fallback (always enabled for multi-tab sync without server)
    if (typeof window !== 'undefined' && window.BroadcastChannel) {
      try {
        this.broadcastChannel = new BroadcastChannel('msn_75_channel_' + this.currentRoom);
        this.broadcastChannel.onmessage = (event) => {
          const { evt, data, senderSocketId } = event.data || {};
          if (senderSocketId === this.id) return; // Ignore own echoes

          if (evt === 'join_room') {
            this.knownUsers.set(data.profile.socketId, data.profile);
            this.emitLocal('user_joined', { user: data.profile, timestamp: Date.now() });
            this.broadcastUsers();
            // Announce presence back
            if (this.myProfile) {
              this.broadcastChannel.postMessage({
                evt: 'announce_presence',
                data: { profile: this.myProfile },
                senderSocketId: this.id
              });
            }
          } else if (evt === 'announce_presence') {
            this.knownUsers.set(data.profile.socketId, data.profile);
            this.broadcastUsers();
          } else if (evt === 'receive_message') {
            this.emitLocal('receive_message', data);
          } else if (evt === 'receive_nudge') {
            this.emitLocal('receive_nudge', data);
          } else if (evt === 'receive_wink') {
            this.emitLocal('receive_wink', data);
          } else if (evt === 'user_typing') {
            this.emitLocal('user_typing', data);
          } else if (evt === 'update_profile') {
            this.knownUsers.set(data.profile.socketId, data.profile);
            this.broadcastUsers();
          }
        };
      } catch (err) {
        console.warn('[MSN 7.5 Broadcast] BroadcastChannel unavailable:', err);
      }
    }
  }

  get id() {
    return this.socket?.id || (this.myProfile?.socketId || 'local-' + (this._localId || (this._localId = Math.random().toString(36).substr(2, 6))));
  }

  emitLocal(evt, data) {
    const cbs = this.listeners.get(evt);
    if (cbs) {
      cbs.forEach((cb) => cb(data));
    }
  }

  on(evt, callback) {
    if (!this.listeners.has(evt)) {
      this.listeners.set(evt, new Set());
    }
    this.listeners.get(evt).add(callback);
  }

  off(evt, callback) {
    if (this.listeners.has(evt)) {
      if (callback) {
        this.listeners.get(evt).delete(callback);
      } else {
        this.listeners.delete(evt);
      }
    }
  }

  broadcastUsers() {
    const list = Array.from(this.knownUsers.values());
    this.emitLocal('room_users', list);
  }

  emit(evt, payload) {
    // 1. If real socket connected, forward to server
    if (this.socket && this.socket.connected) {
      this.socket.emit(evt, payload);
    }

    // 2. Also handle via BroadcastChannel
    if (evt === 'join_room') {
      this.currentRoom = payload.roomId || 'sala-msn-nostalgia';
      this.myProfile = { ...payload.profile, socketId: this.id };
      this.knownUsers.set(this.id, this.myProfile);

      // Always include Encarta & MSN AutoBot in the room list so users can chat even when alone
      if (!this.knownUsers.has('bot_encarta')) {
        this.knownUsers.set('bot_encarta', {
          socketId: 'bot_encarta',
          id: 'bot_encarta',
          nickname: '🤖 Encarta & MSN AutoBot',
          email: 'encarta_bot@msn.com',
          status: 'online',
          avatar: 'guitar',
          personalMessage: 'Pregúntame algo o envíame un zumbido'
        });
      }

      this.broadcastUsers();

      if (this.broadcastChannel) {
        this.broadcastChannel.postMessage({
          evt: 'join_room',
          data: { roomId: this.currentRoom, profile: this.myProfile },
          senderSocketId: this.id
        });
      }
    } else if (evt === 'send_message') {
      const enriched = {
        ...payload,
        id: 'msg-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
        from: this.myProfile,
        timestamp: Date.now()
      };

      // If purely static or socket not connected, emit to self
      if (!this.socket || !this.socket.connected) {
        this.emitLocal('receive_message', enriched);
      }

      if (this.broadcastChannel) {
        this.broadcastChannel.postMessage({
          evt: 'receive_message',
          data: enriched,
          senderSocketId: this.id
        });
      }

      // If message was to the bot or bot is present and socket is not connected, trigger nostalgic auto-reply
      if (!this.socket || !this.socket.connected) {
        this.handleBotAutoReply(payload.text);
      }
    } else if (evt === 'send_nudge') {
      const data = { from: this.myProfile, timestamp: Date.now() };
      if (!this.socket || !this.socket.connected) {
        this.emitLocal('receive_nudge', data);
      }
      if (this.broadcastChannel) {
        this.broadcastChannel.postMessage({
          evt: 'receive_nudge',
          data,
          senderSocketId: this.id
        });
      }
    } else if (evt === 'send_wink') {
      const data = { from: this.myProfile, winkId: payload.winkId, timestamp: Date.now() };
      if (!this.socket || !this.socket.connected) {
        this.emitLocal('receive_wink', data);
      }
      if (this.broadcastChannel) {
        this.broadcastChannel.postMessage({
          evt: 'receive_wink',
          data,
          senderSocketId: this.id
        });
      }
    } else if (evt === 'typing_status') {
      const data = { from: this.myProfile, isTyping: payload.isTyping };
      if (this.broadcastChannel) {
        this.broadcastChannel.postMessage({
          evt: 'user_typing',
          data,
          senderSocketId: this.id
        });
      }
    } else if (evt === 'update_profile') {
      this.myProfile = { ...this.myProfile, ...payload };
      this.knownUsers.set(this.id, this.myProfile);
      this.broadcastUsers();
      if (this.broadcastChannel) {
        this.broadcastChannel.postMessage({
          evt: 'update_profile',
          data: { profile: this.myProfile },
          senderSocketId: this.id
        });
      }
    }
  }

  handleBotAutoReply(userText) {
    setTimeout(() => {
      const botProfile = this.knownUsers.get('bot_encarta');
      if (!botProfile) return;

      const responses = [
        '¡Qué nostalgia recordar MSN Messenger! ¿Te acuerdas de cambiar tu estado a "Ocupado" cuando sonaba buena música?',
        '¡Totalmente! Si quieres, presióname el botón de ⚡ Zumbido para ver cómo tiembla la pantalla.',
        '(8) Escuchando: Evanescence - Bring Me To Life (8) ¿Y tú qué canción tienes puesta en tu mensaje personal?',
        '¡Prueba enviar un guiño animado con el botón ✨ o dibuja algo con la Tinta manuscrita ✍️!',
        '¡Recuerdo cuando nos conectábamos y desconectábamos 5 veces seguidas para que la persona que nos gustaba viera el cartelito en la esquina! 😂'
      ];

      const reply = responses[Math.floor(Math.random() * responses.length)];
      this.emitLocal('receive_message', {
        id: 'bot-msg-' + Date.now(),
        from: botProfile,
        text: reply,
        font: 'Tahoma',
        color: '#7b1fa2',
        isBold: false,
        isItalic: true,
        timestamp: Date.now()
      });
    }, 1200);
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
    }
    if (this.broadcastChannel) {
      this.broadcastChannel.close();
    }
    this.listeners.clear();
  }
}

let instance = null;

export function getSocket() {
  if (!instance) {
    instance = new HybridSocketClient();
  }
  return instance;
}

export function disconnectSocket() {
  if (instance) {
    instance.disconnect();
    instance = null;
  }
}
