import React, { useState, useEffect, useCallback, useRef } from 'react';
import Desktop from './components/Desktop/Desktop';
import AuthModal from './components/Login/AuthModal';
import ContactListWindow from './components/ContactList/ContactListWindow';
import ChatWindow from './components/Chat/ChatWindow';
import AddFriendModal from './components/ContactList/AddFriendModal';
import AvatarUploadModal from './components/Profile/AvatarUploadModal';
import AboutModal from './components/Modals/AboutModal';
import ZumbidoLogo from './components/Common/ZumbidoLogo';

import { api, getStoredToken, setStoredToken } from './services/api';
import { connectSocket, disconnectSocket, reconnectSocketNow } from './services/socket';
import {
  getPushStatus,
  subscribeToWebPush,
  syncExistingPushSubscription,
  unsubscribeFromWebPush,
  updateAppBadge
} from './services/pushClient';
import {
  playMessageSound,
  playNudgeSound,
  playLogoutSound,
  vibrateForNudge
} from './services/soundEngine';
import { stripPlusTags } from './services/plusFormatter';

function getInitialInviteCode() {
  if (typeof window === 'undefined') return null;
  try {
    const params = new URLSearchParams(window.location.search);
    const code = (params.get('invite') || '').trim();
    return code || null;
  } catch {
    return null;
  }
}

function getInitialChatFriendId() {
  if (typeof window === 'undefined') return null;
  try {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get('chat');
    const num = raw ? Number(raw) : NaN;
    return Number.isInteger(num) && num > 0 ? num : null;
  } catch {
    return null;
  }
}

function clearQueryParamFromUrl(paramName) {
  if (typeof window === 'undefined') return;
  try {
    const url = new URL(window.location.href);
    if (url.searchParams.has(paramName)) {
      url.searchParams.delete(paramName);
      const next = `${url.pathname}${url.search}${url.hash}`;
      window.history.replaceState({}, '', next || '/');
    }
  } catch {
    // ignore URL manipulation errors
  }
}

function clearInviteFromUrl() {
  clearQueryParamFromUrl('invite');
}

export default function App() {
  const [authReady, setAuthReady] = useState(false);
  const [token, setToken] = useState(() => getStoredToken());
  const [profile, setProfile] = useState(null);
  const [connectionState, setConnectionState] = useState('connected');
  const [pendingInviteCode, setPendingInviteCode] = useState(() => getInitialInviteCode());
  const [pendingChatFriendId, setPendingChatFriendId] = useState(() => getInitialChatFriendId());

  // Friends & requests
  const [friends, setFriends] = useState([]);
  const [incomingRequests, setIncomingRequests] = useState([]);
  const [outgoingRequests, setOutgoingRequests] = useState([]);

  // Open chat friend IDs, per-friend message histories & state
  const [openChatIds, setOpenChatIds] = useState([]);
  const [chatHistories, setChatHistories] = useState({}); // { [friendId]: { items: [], hasMore: false, loaded: false, loading: false } }
  const [typingByFriend, setTypingByFriend] = useState({});
  const [shakeByFriend, setShakeByFriend] = useState({});
  const [winkByFriend, setWinkByFriend] = useState({});
  const [cooldownByFriend, setCooldownByFriend] = useState({});

  // Window stacking & minimization
  const [activeWindowId, setActiveWindowId] = useState('contactList');
  const [zOrders, setZOrders] = useState({ contactList: 200 });
  const [minimizedWindows, setMinimizedWindows] = useState({});
  const [flashingWindows, setFlashingWindows] = useState({});
  const zCounterRef = useRef(210);

  // Modals & notifications
  const [addFriendModalTab, setAddFriendModalTab] = useState(null); // null | 'add' | 'invite'
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [toasterData, setToasterData] = useState(null);
  const toasterTimerRef = useRef(null);

  // Mobile & PWA state
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(max-width: 768px)').matches : false
  );
  const [mobileSection, setMobileSection] = useState('contacts');
  const [deferredInstallPrompt, setDeferredInstallPrompt] = useState(null);
  const [notificationPermission, setNotificationPermission] = useState(() =>
    typeof Notification !== 'undefined' ? Notification.permission : 'unsupported'
  );
  const [pushStatus, setPushStatus] = useState({
    supported: false,
    permission: typeof Notification !== 'undefined' ? Notification.permission : 'unsupported',
    subscribed: false,
    needsIosInstall: false
  });
  const [pushBusy, setPushBusy] = useState(false);
  const [pushMessage, setPushMessage] = useState('');

  const socketRef = useRef(null);
  const activeWindowRef = useRef(activeWindowId);
  const minimizedRef = useRef(minimizedWindows);
  const profileRef = useRef(profile);
  const openChatIdsRef = useRef(openChatIds);
  const friendsRef = useRef(friends);

  useEffect(() => { activeWindowRef.current = activeWindowId; }, [activeWindowId]);
  useEffect(() => { minimizedRef.current = minimizedWindows; }, [minimizedWindows]);
  useEffect(() => { profileRef.current = profile; }, [profile]);
  useEffect(() => { openChatIdsRef.current = openChatIds; }, [openChatIds]);
  useEffect(() => { friendsRef.current = friends; }, [friends]);

  // Responsive matchMedia + visualViewport keyboard adaptation
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    const onChange = (e) => setIsMobile(e.matches);
    mq.addEventListener('change', onChange);

    const updateViewportHeight = () => {
      const h = window.visualViewport ? window.visualViewport.height : window.innerHeight;
      document.documentElement.style.setProperty('--vvh', `${h}px`);
    };
    updateViewportHeight();
    window.visualViewport?.addEventListener('resize', updateViewportHeight);
    window.addEventListener('resize', updateViewportHeight);

    const handleBeforeInstall = (e) => {
      e.preventDefault();
      setDeferredInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    return () => {
      mq.removeEventListener('change', onChange);
      window.visualViewport?.removeEventListener('resize', updateViewportHeight);
      window.removeEventListener('resize', updateViewportHeight);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  const showToaster = useCallback((user, text, friendId = null) => {
    if (toasterTimerRef.current) clearTimeout(toasterTimerRef.current);
    setToasterData({ user, text, friendId });
    toasterTimerRef.current = setTimeout(() => setToasterData(null), 5200);
  }, []);

  const sendSystemNotification = useCallback((title, body) => {
    try {
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted' && document.hidden) {
        new Notification(title, {
          body,
          icon: '/icons/icon-192.png',
          badge: '/icons/icon-192.png'
        });
      }
    } catch {
      // ignore if browser blocks notification
    }
  }, []);

  const focusWindow = useCallback((winId) => {
    zCounterRef.current += 1;
    setZOrders((prev) => ({ ...prev, [winId]: zCounterRef.current }));
    setMinimizedWindows((prev) => ({ ...prev, [winId]: false }));
    setFlashingWindows((prev) => ({ ...prev, [winId]: false }));
    setActiveWindowId(winId);
  }, []);

  const applyFriendsBundle = useCallback((bundle) => {
    if (!bundle) return;
    setFriends(bundle.friends || []);
    setIncomingRequests(bundle.incomingRequests || []);
    setOutgoingRequests(bundle.outgoingRequests || []);
  }, []);

  // Load persisted session on startup
  useEffect(() => {
    if (!token) {
      setAuthReady(true);
      return;
    }
    api.getMe()
      .then((res) => {
        setProfile(res.user);
        return api.getFriends();
      })
      .then((bundle) => {
        applyFriendsBundle(bundle);
      })
      .catch(() => {
        setStoredToken(null);
        setToken(null);
        setProfile(null);
      })
      .finally(() => setAuthReady(true));
  }, [token, applyFriendsBundle]);

  const loadHistory = useCallback(async (friendId, { loadOlder = false } = {}) => {
    let beforeId = null;
    setChatHistories((prev) => {
      const current = prev[friendId] || { items: [], hasMore: false, loaded: false, loading: false };
      if (current.loading) return prev;
      if (loadOlder && current.items.length > 0) {
        beforeId = current.items[0].id;
      }
      return {
        ...prev,
        [friendId]: { ...current, loading: true }
      };
    });

    try {
      const res = await api.getMessages(friendId, { beforeId, limit: 30 });
      setChatHistories((prev) => {
        const current = prev[friendId] || { items: [], hasMore: false, loaded: false, loading: false };
        const merged = loadOlder
          ? [...res.messages, ...current.items]
          : res.messages;
        // Deduplicate by id
        const seen = new Set();
        const unique = merged.filter((m) => {
          if (seen.has(m.id)) return false;
          seen.add(m.id);
          return true;
        });
        return {
          ...prev,
          [friendId]: {
            items: unique,
            hasMore: res.hasMore,
            loaded: true,
            loading: false
          }
        };
      });
    } catch {
      setChatHistories((prev) => ({
        ...prev,
        [friendId]: { ...(prev[friendId] || { items: [], hasMore: false }), loaded: true, loading: false }
      }));
    }
  }, []);

  const markConversationAsRead = useCallback((friendId) => {
    socketRef.current?.emit('mark_read', { friendId });
    setFriends((prev) =>
      prev.map((f) => (f.id === friendId ? { ...f, unreadCount: 0 } : f))
    );
    setFlashingWindows((prev) => ({ ...prev, [`chat-${friendId}`]: false }));
  }, []);

  const openChatWithFriend = useCallback((friend) => {
    const fid = friend.id;
    const winId = `chat-${fid}`;
    setOpenChatIds((prev) => {
      if (isMobile) return [fid];
      return prev.includes(fid) ? prev : [...prev, fid];
    });
    focusWindow(winId);
    loadHistory(fid);
    markConversationAsRead(fid);
  }, [focusWindow, isMobile, loadHistory, markConversationAsRead]);

  // Connect Socket.io when logged in
  useEffect(() => {
    if (!token || !profile?.id) return;

    const s = connectSocket(token, (state) => {
      if (state === 'auth_error') {
        handleLogout();
      } else {
        setConnectionState(state);
      }
    });
    socketRef.current = s;

    const appendMessageToConversation = (msg, { triggerAlert = true } = {}) => {
      const me = profileRef.current;
      if (!me) return;
      const otherId = msg.fromUserId === me.id ? msg.toUserId : msg.fromUserId;

      setChatHistories((prev) => {
        const curr = prev[otherId] || { items: [], hasMore: false, loaded: false, loading: false };
        if (curr.items.some((m) => m.id === msg.id)) return prev;
        return {
          ...prev,
          [otherId]: { ...curr, items: [...curr.items, msg] }
        };
      });

      if (msg.fromUserId !== me.id) {
        const winId = `chat-${otherId}`;
        const isChatCurrentlyFocused = activeWindowRef.current === winId && !minimizedRef.current[winId] && !document.hidden;

        if (isChatCurrentlyFocused) {
          markConversationAsRead(otherId);
        } else {
          // Increment unread badge and trigger classic orange taskbar flash
          setFriends((prev) =>
            prev.map((f) => (f.id === otherId ? { ...f, unreadCount: (f.unreadCount || 0) + 1 } : f))
          );
          setFlashingWindows((prev) => ({ ...prev, [winId]: true }));

          // Open minimized chat window on desktop if not already open so taskbar flashes orange!
          if (!window.matchMedia('(max-width: 768px)').matches) {
            setOpenChatIds((prev) => {
              if (!prev.includes(otherId)) {
                setMinimizedWindows((mPrev) => ({ ...mPrev, [winId]: true }));
                return [...prev, otherId];
              }
              return prev;
            });
          }

          if (triggerAlert) {
            const previewText =
              msg.type === 'image' ? 'te envió una foto 📷'
                : msg.type === 'voice' ? 'te envió un clip de voz 🎙️'
                  : msg.type === 'ink' ? 'te envió una nota manuscrita ✍️'
                    : msg.type === 'nudge' ? '¡te acaba de enviar un ZUMBIDO! ⚡'
                      : msg.type === 'wink' ? 'te envió un guiño ✨'
                        : `dice: ${msg.text.slice(0, 38)}`;

            showToaster(msg.fromUser, previewText, otherId);
            sendSystemNotification(
              `Zumbido 05 — ${stripPlusTags(msg.fromUser?.nickname || 'Contacto')}`,
              previewText
            );
          }
        }
      }
    };

    s.on('friends_refresh', (bundle) => applyFriendsBundle(bundle));

    s.on('profile_updated', ({ user }) => {
      if (user) setProfile(user);
    });

    s.on('friend_presence', (update) => {
      setFriends((prev) =>
        prev.map((f) =>
          f.id === update.userId
            ? {
                ...f,
                nickname: update.nickname,
                personalMessage: update.personalMessage,
                avatar: update.avatar,
                status: update.status,
                isOnline: update.isOnline,
                lastSeen: update.lastSeen
              }
            : f
        )
      );
    });

    s.on('friend_signed_in', ({ user }) => {
      showToaster(user, 'acaba de iniciar sesión', user.id);
    });

    s.on('friend_request_received', ({ from }) => {
      setIncomingRequests((prev) => (prev.some((r) => r.id === from.id) ? prev : [from, ...prev]));
      showToaster(from, 'quiere agregarte como contacto');
    });

    s.on('friend_request_accepted', ({ user, bundle }) => {
      if (bundle) applyFriendsBundle(bundle);
      showToaster(user, 'aceptó tu solicitud de contacto', user.id);
    });

    s.on('invite_joined', ({ user, bundle }) => {
      if (bundle) applyFriendsBundle(bundle);
      playMessageSound();
      if (user) {
        showToaster(user, 'se unió a Zumbido 05 con tu invitación 🎉', user.id);
      }
    });

    s.on('receive_message', (msg) => {
      appendMessageToConversation(msg);
      if (msg.fromUserId !== profileRef.current?.id) {
        playMessageSound();
      }
    });

    s.on('receive_nudge', (msg) => {
      const me = profileRef.current;
      const otherId = msg.fromUserId === me?.id ? msg.toUserId : msg.fromUserId;
      appendMessageToConversation(msg);
      playNudgeSound();
      if (msg.fromUserId !== me?.id) {
        vibrateForNudge();
      }
      setShakeByFriend((prev) => ({ ...prev, [otherId]: Date.now() }));
    });

    s.on('nudge_cooldown', ({ toUserId, message }) => {
      setCooldownByFriend((prev) => ({ ...prev, [toUserId]: message }));
      setTimeout(() => {
        setCooldownByFriend((prev) => ({ ...prev, [toUserId]: '' }));
      }, 3500);
    });

    s.on('receive_wink', (msg) => {
      const me = profileRef.current;
      const otherId = msg.fromUserId === me?.id ? msg.toUserId : msg.fromUserId;
      appendMessageToConversation(msg);
      setWinkByFriend((prev) => ({
        ...prev,
        [otherId]: { winkId: msg.winkId || msg.mediaData || 'laugh', ts: Date.now() }
      }));
    });

    s.on('user_typing', ({ fromUserId, isTyping }) => {
      setTypingByFriend((prev) => ({ ...prev, [fromUserId]: isTyping }));
    });

    s.on('conversation_read', ({ friendId }) => {
      setFriends((prev) => prev.map((f) => (f.id === friendId ? { ...f, unreadCount: 0 } : f)));
      setFlashingWindows((prev) => ({ ...prev, [`chat-${friendId}`]: false }));
    });

    return () => {
      disconnectSocket();
      socketRef.current = null;
    };
  }, [token, profile?.id, applyFriendsBundle, markConversationAsRead, sendSystemNotification, showToaster]);

  // If user is already logged in (or just logged in via login tab) with ?invite=<code>, accept automatically
  useEffect(() => {
    if (!token || !profile?.id || !pendingInviteCode) return;
    const code = pendingInviteCode;
    setPendingInviteCode(null);
    clearInviteFromUrl();
    api.acceptInvitation(code)
      .then((res) => {
        applyFriendsBundle(res);
        if (res.inviter) {
          showToaster(
            res.inviter,
            res.alreadyFriends
              ? 'ya está en tu lista de contactos'
              : 'ahora está en tu lista de contactos 🎉',
            res.inviter.id
          );
        }
      })
      .catch(() => {
        // Ignore expired/self/invalid invite codes silently after cleaning URL
      });
  }, [token, profile?.id, pendingInviteCode, applyFriendsBundle, showToaster]);

  // Instant mobile reconnect & chat sync whenever screen wakes up or network returns
  useEffect(() => {
    if (!token || !profile?.id) return;

    const handleResume = () => {
      if (document.visibilityState === 'hidden') return;
      reconnectSocketNow();
      api.getFriends().then(applyFriendsBundle).catch(() => {});
      openChatIdsRef.current.forEach((fid) => {
        loadHistory(fid);
      });
    };

    document.addEventListener('visibilitychange', handleResume);
    window.addEventListener('pageshow', handleResume);
    window.addEventListener('focus', handleResume);
    window.addEventListener('online', handleResume);

    return () => {
      document.removeEventListener('visibilitychange', handleResume);
      window.removeEventListener('pageshow', handleResume);
      window.removeEventListener('focus', handleResume);
      window.removeEventListener('online', handleResume);
    };
  }, [token, profile?.id, applyFriendsBundle, loadHistory]);

  // Sync Web Push subscription status & silently refresh existing subscription on login
  useEffect(() => {
    if (!token || !profile?.id) return;
    let cancelled = false;
    (async () => {
      await syncExistingPushSubscription();
      const st = await getPushStatus();
      if (!cancelled) {
        setPushStatus(st);
        setNotificationPermission(st.permission);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, profile?.id]);

  // Listen for Service Worker notificationclick -> OPEN_CHAT messages
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    const onSwMessage = (event) => {
      if (event.data?.type === 'OPEN_CHAT' && event.data.friendId) {
        const fid = Number(event.data.friendId);
        const found = friendsRef.current.find((f) => f.id === fid);
        if (found) {
          openChatWithFriend(found);
        } else {
          setPendingChatFriendId(fid);
        }
      }
    };
    navigator.serviceWorker.addEventListener('message', onSwMessage);
    return () => navigator.serviceWorker.removeEventListener('message', onSwMessage);
  }, [openChatWithFriend]);

  // Open pending chat from ?chat=<friendId> or push click once friends list loads
  useEffect(() => {
    if (!pendingChatFriendId || friends.length === 0) return;
    const target = friends.find((f) => f.id === pendingChatFriendId);
    if (target) {
      setPendingChatFriendId(null);
      clearQueryParamFromUrl('chat');
      openChatWithFriend(target);
    }
  }, [pendingChatFriendId, friends, openChatWithFriend]);

  const handleAuthenticated = (newToken, user, invitedBy = null) => {
    setStoredToken(newToken);
    setToken(newToken);
    setProfile(user);
    setActiveWindowId('contactList');
    if (invitedBy) {
      setPendingInviteCode(null);
      clearInviteFromUrl();
      showToaster(invitedBy, 'ya está en tu lista de contactos por invitación 🎉', invitedBy.id);
    }
    api.getFriends().then(applyFriendsBundle).catch(() => {});
  };

  const handleLogout = () => {
    unsubscribeFromWebPush();
    updateAppBadge(0);
    playLogoutSound();
    disconnectSocket();
    setStoredToken(null);
    setToken(null);
    setProfile(null);
    setFriends([]);
    setIncomingRequests([]);
    setOutgoingRequests([]);
    setOpenChatIds([]);
    setChatHistories({});
    setFlashingWindows({});
    setPushMessage('');
  };

  const handleUpdateProfile = async (updates) => {
    const res = await api.updateProfile(updates);
    setProfile(res.user);
  };

  const handleSendFriendRequest = async (email) => {
    const res = await api.sendFriendRequest(email);
    applyFriendsBundle(res);
  };

  const handleRespondFriendRequest = async (friendId, action) => {
    const res = await api.respondFriendRequest(friendId, action);
    applyFriendsBundle(res);
  };

  const handleMoveFriendGroup = async (friendId, groupName) => {
    const res = await api.updateFriendGroup(friendId, groupName);
    applyFriendsBundle(res);
  };

  const handleToggleBlockFriend = async (friendId, blocked) => {
    const res = await api.setFriendBlocked(friendId, blocked);
    applyFriendsBundle(res);
  };

  const handleRemoveFriend = async (friendId) => {
    const res = await api.removeFriend(friendId);
    applyFriendsBundle(res);
    setOpenChatIds((prev) => prev.filter((id) => id !== friendId));
  };

  const handleSendMessage = (payload) => {
    socketRef.current?.emit('send_message', payload);
  };

  const handleSendNudge = (toUserId) => {
    socketRef.current?.emit('send_nudge', { toUserId });
  };

  const handleSendWink = (toUserId, winkId) => {
    socketRef.current?.emit('send_wink', { toUserId, winkId });
  };

  const handleTypingStatus = (toUserId, isTyping) => {
    socketRef.current?.emit('typing_status', { toUserId, isTyping });
  };

  const handleMinimize = (winId) => {
    setMinimizedWindows((prev) => ({ ...prev, [winId]: true }));
    if (activeWindowId === winId) setActiveWindowId(null);
  };

  const handleCloseChat = (friendId) => {
    setOpenChatIds((prev) => prev.filter((id) => id !== friendId));
    setFlashingWindows((prev) => ({ ...prev, [`chat-${friendId}`]: false }));
  };

  const handleInstallPwa = async () => {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    setDeferredInstallPrompt(null);
  };

  const handleRequestNotifications = async () => {
    setPushBusy(true);
    setPushMessage('');
    try {
      await subscribeToWebPush();
      const st = await getPushStatus();
      setPushStatus(st);
      setNotificationPermission(st.permission);
      setPushMessage('✓ ¡Notificaciones Push activadas! Ya puedes bloquear la pantalla y recibirás alertas.');
    } catch (err) {
      const st = await getPushStatus();
      setPushStatus(st);
      setNotificationPermission(st.permission);
      setPushMessage(`⚠️ ${err.message || 'No se pudieron activar las notificaciones Push.'}`);
    } finally {
      setPushBusy(false);
    }
  };

  const handleTestPush = async () => {
    setPushBusy(true);
    setPushMessage('');
    try {
      await api.sendTestPush();
      setPushMessage('✓ Notificación de prueba enviada a tu dispositivo.');
    } catch (err) {
      setPushMessage(`⚠️ ${err.message || 'No se pudo enviar la notificación de prueba.'}`);
    } finally {
      setPushBusy(false);
    }
  };

  const isLoggedIn = Boolean(profile);
  const totalUnreadCount = friends.reduce((sum, f) => sum + (f.unreadCount || 0), 0);

  // Sync PWA App Icon Badge with unread messages + pending requests
  useEffect(() => {
    updateAppBadge(isLoggedIn ? totalUnreadCount + incomingRequests.length : 0);
  }, [isLoggedIn, totalUnreadCount, incomingRequests.length]);

  const openFriends = openChatIds
    .map((fid) => friends.find((f) => f.id === fid))
    .filter(Boolean);

  // Build desktop taskbar entries
  const taskbarWindows = [];
  if (isLoggedIn) {
    taskbarWindows.push({
      id: 'contactList',
      title: `Zumbido 05 — ${stripPlusTags(profile.nickname)}`,
      icon: <ZumbidoLogo size={15} />,
      isMinimized: Boolean(minimizedWindows.contactList),
      isFlashing: false,
      unreadCount: incomingRequests.length,
      onMinimize: () => handleMinimize('contactList')
    });

    openFriends.forEach((friend) => {
      const winId = `chat-${friend.id}`;
      taskbarWindows.push({
        id: winId,
        title: stripPlusTags(friend.nickname),
        icon: <span>💬</span>,
        isMinimized: Boolean(minimizedWindows[winId]),
        isFlashing: Boolean(flashingWindows[winId]) || (friend.unreadCount > 0 && activeWindowId !== winId),
        unreadCount: friend.unreadCount || 0,
        onMinimize: () => handleMinimize(winId)
      });
    });
  } else {
    taskbarWindows.push({
      id: 'auth',
      title: 'Zumbido 05 — Iniciar sesión',
      icon: <ZumbidoLogo size={15} />,
      isMinimized: false,
      isFlashing: false,
      unreadCount: 0,
      onMinimize: () => {}
    });
  }

  const hasOpenMobileChat = isMobile && openFriends.length > 0;

  if (!authReady) {
    return (
      <div className="c05-desktop" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(0,40,120,0.65)', padding: '12px 20px', borderRadius: 8 }}>
          <ZumbidoLogo size={28} />
          <span>Cargando Zumbido 05...</span>
        </div>
      </div>
    );
  }

  return (
    <Desktop
      windows={taskbarWindows}
      activeWindowId={activeWindowId}
      onRestoreWindow={(winId) => {
        focusWindow(winId);
        if (winId.startsWith('chat-')) {
          const fid = Number(winId.slice(5));
          loadHistory(fid);
          markConversationAsRead(fid);
        }
      }}
      onFocusWindow={(winId) => {
        focusWindow(winId);
        if (winId.startsWith('chat-')) {
          const fid = Number(winId.slice(5));
          markConversationAsRead(fid);
        }
      }}
      onOpenAbout={() => setIsAboutOpen(true)}
      onLogout={handleLogout}
      isLoggedIn={isLoggedIn}
      userProfile={profile}
      connectionState={connectionState}
      toasterData={toasterData}
      onDismissToaster={() => setToasterData(null)}
      onToasterClick={() => {
        if (toasterData?.friendId) {
          const target = friends.find((f) => f.id === toasterData.friendId);
          if (target) openChatWithFriend(target);
        } else if (incomingRequests.length > 0) {
          setAddFriendModalTab('add');
        }
        setToasterData(null);
      }}
      isMobile={isMobile}
      mobileSection={mobileSection}
      onSelectMobileSection={setMobileSection}
      hasOpenMobileChat={hasOpenMobileChat}
      totalUnreadCount={totalUnreadCount}
      pendingRequestCount={incomingRequests.length}
    >
      {/* 1. Authentication Window */}
      {!isLoggedIn && (
        <AuthModal
          onAuthenticated={handleAuthenticated}
          onOpenAbout={() => setIsAboutOpen(true)}
          isMobile={isMobile}
          inviteCode={pendingInviteCode}
        />
      )}

      {/* 2. Contact List Window */}
      {isLoggedIn && !minimizedWindows.contactList && (!isMobile || !hasOpenMobileChat) && (
        <ContactListWindow
          profile={profile}
          onUpdateProfile={handleUpdateProfile}
          friends={friends}
          incomingRequests={incomingRequests}
          onOpenChat={openChatWithFriend}
          onOpenAddFriend={() => setAddFriendModalTab('add')}
          onOpenInvite={() => setAddFriendModalTab('invite')}
          onOpenProfileModal={() => setIsProfileModalOpen(true)}
          onOpenAbout={() => setIsAboutOpen(true)}
          onMoveFriendGroup={handleMoveFriendGroup}
          onToggleBlockFriend={handleToggleBlockFriend}
          onRemoveFriend={handleRemoveFriend}
          onInstallPwa={handleInstallPwa}
          canInstallPwa={Boolean(deferredInstallPrompt)}
          notificationPermission={notificationPermission}
          onRequestNotifications={handleRequestNotifications}
          pushStatus={pushStatus}
          pushBusy={pushBusy}
          pushMessage={pushMessage}
          onTestPush={handleTestPush}
          onLogout={handleLogout}
          onMinimize={() => handleMinimize('contactList')}
          isFocused={activeWindowId === 'contactList'}
          zIndex={zOrders.contactList || 200}
          onFocus={() => focusWindow('contactList')}
          isMobile={isMobile}
          mobileSection={mobileSection}
        />
      )}

      {/* 3. Open Chat Windows */}
      {isLoggedIn &&
        openFriends.map((friend, idx) => {
          const winId = `chat-${friend.id}`;
          if (minimizedWindows[winId]) return null;
          const hist = chatHistories[friend.id] || { items: [], hasMore: false, loading: false };

          return (
            <ChatWindow
              key={friend.id}
              contact={friend}
              myProfile={profile}
              messages={hist.items}
              hasMore={hist.hasMore}
              loadingHistory={hist.loading}
              onLoadMore={(fid) => loadHistory(fid, { loadOlder: true })}
              isTyping={Boolean(typingByFriend[friend.id])}
              shakingToken={shakeByFriend[friend.id] || 0}
              activeWink={winkByFriend[friend.id] || null}
              onClearWink={(fid) => setWinkByFriend((prev) => ({ ...prev, [fid]: null }))}
              cooldownNotice={cooldownByFriend[friend.id] || ''}
              onSendMessage={handleSendMessage}
              onSendNudge={handleSendNudge}
              onSendWink={handleSendWink}
              onTypingStatus={handleTypingStatus}
              onMarkRead={markConversationAsRead}
              onMinimize={() => handleMinimize(winId)}
              onClose={() => handleCloseChat(friend.id)}
              isFocused={activeWindowId === winId}
              zIndex={zOrders[winId] || 220 + idx}
              cascadeIndex={idx}
              onFocus={() => {
                focusWindow(winId);
                markConversationAsRead(friend.id);
              }}
              isMobile={isMobile}
            />
          );
        })}

      {/* 4. Add Friend, Requests & Invitations Modal */}
      {addFriendModalTab && (
        <AddFriendModal
          incomingRequests={incomingRequests}
          outgoingRequests={outgoingRequests}
          initialTab={addFriendModalTab}
          myNickname={profile?.nickname || ''}
          onSendRequest={handleSendFriendRequest}
          onRespondRequest={handleRespondFriendRequest}
          onClose={() => setAddFriendModalTab(null)}
        />
      )}

      {/* 5. Profile, Real Photo & Colores Plus Modal */}
      {isProfileModalOpen && profile && (
        <AvatarUploadModal
          profile={profile}
          onSave={handleUpdateProfile}
          onClose={() => setIsProfileModalOpen(false)}
        />
      )}

      {/* 6. About / Legal Independence Modal */}
      {isAboutOpen && <AboutModal onClose={() => setIsAboutOpen(false)} />}
    </Desktop>
  );
}
