import React, { useState, useEffect, useCallback, useRef } from 'react';
import Desktop from './components/Desktop/Desktop';
import AuthModal from './components/Login/AuthModal';
import ContactListWindow from './components/ContactList/ContactListWindow';
import ChatWindow from './components/Chat/ChatWindow';
import AddFriendModal from './components/ContactList/AddFriendModal';
import CreateGroupModal from './components/ContactList/CreateGroupModal';
import AvatarUploadModal from './components/Profile/AvatarUploadModal';
import AboutModal from './components/Modals/AboutModal';
import RetroPlayerModal from './components/Player/RetroPlayerModal';
import ZumbidoLogo from './components/Common/ZumbidoLogo';

import { api, getStoredToken, setStoredToken } from './services/api';
import { connectSocket, disconnectSocket, reconnectSocketNow } from './services/socket';
import {
  getPushStatus,
  isStandalonePwa,
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

function getInitialGroupId() {
  if (typeof window === 'undefined') return null;
  try {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get('group');
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
  const [pendingGroupId, setPendingGroupId] = useState(() => getInitialGroupId());

  // Friends & requests
  const [friends, setFriends] = useState([]);
  const [incomingRequests, setIncomingRequests] = useState([]);
  const [outgoingRequests, setOutgoingRequests] = useState([]);

  // Groups
  const [groups, setGroups] = useState([]);
  const [openGroupIds, setOpenGroupIds] = useState([]);
  const [groupHistories, setGroupHistories] = useState({});
  const [typingByGroup, setTypingByGroup] = useState({});
  const [shakeByGroup, setShakeByGroup] = useState({});
  const [winkByGroup, setWinkByGroup] = useState({});
  const [cooldownByGroup, setCooldownByGroup] = useState({});

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
  const [groupModalState, setGroupModalState] = useState(null); // null | { mode: 'create' } | { mode: 'invite', group }
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isPlayerOpen, setIsPlayerOpen] = useState(false);
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
  const [appUpdateAvailable, setAppUpdateAvailable] = useState(false);
  const [installBannerDismissed, setInstallBannerDismissed] = useState(false);
  const initialBuildIdRef = useRef(null);

  const socketRef = useRef(null);
  const activeWindowRef = useRef(activeWindowId);
  const minimizedRef = useRef(minimizedWindows);
  const profileRef = useRef(profile);
  const openChatIdsRef = useRef(openChatIds);
  const openGroupIdsRef = useRef(openGroupIds);
  const friendsRef = useRef(friends);
  const groupsRef = useRef(groups);
  const chatHistoriesRef = useRef(chatHistories);
  const groupHistoriesRef = useRef(groupHistories);

  useEffect(() => { activeWindowRef.current = activeWindowId; }, [activeWindowId]);
  useEffect(() => { minimizedRef.current = minimizedWindows; }, [minimizedWindows]);
  useEffect(() => { profileRef.current = profile; }, [profile]);
  useEffect(() => { openChatIdsRef.current = openChatIds; }, [openChatIds]);
  useEffect(() => { openGroupIdsRef.current = openGroupIds; }, [openGroupIds]);
  useEffect(() => { friendsRef.current = friends; }, [friends]);
  useEffect(() => { groupsRef.current = groups; }, [groups]);
  useEffect(() => { chatHistoriesRef.current = chatHistories; }, [chatHistories]);
  useEffect(() => { groupHistoriesRef.current = groupHistories; }, [groupHistories]);

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

  const showToaster = useCallback((user, text, friendId = null, groupId = null) => {
    if (toasterTimerRef.current) clearTimeout(toasterTimerRef.current);
    setToasterData({ user, text, friendId, groupId });
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
      .then(async (res) => {
        setProfile(res.user);
        const [bundle, groupRes] = await Promise.all([
          api.getFriends(),
          api.getGroups().catch(() => ({ groups: [] }))
        ]);
        applyFriendsBundle(bundle);
        setGroups(groupRes.groups || []);
      })
      .catch(() => {
        setStoredToken(null);
        setToken(null);
        setProfile(null);
      })
      .finally(() => setAuthReady(true));
  }, [token, applyFriendsBundle]);

  const loadHistory = useCallback(async (friendId, { loadOlder = false } = {}) => {
    const snapshot = chatHistoriesRef.current[friendId] || { items: [], hasMore: false, loaded: false, loading: false };
    if (snapshot.loading) return;
    const beforeId = loadOlder && snapshot.items.length > 0 ? snapshot.items[0].id : null;

    setChatHistories((prev) => {
      const current = prev[friendId] || { items: [], hasMore: false, loaded: false, loading: false };
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

  const loadGroupHistory = useCallback(async (groupId, { loadOlder = false } = {}) => {
    const snapshot = groupHistoriesRef.current[groupId] || { items: [], hasMore: false, loaded: false, loading: false };
    if (snapshot.loading) return;
    const beforeId = loadOlder && snapshot.items.length > 0 ? snapshot.items[0].id : null;

    setGroupHistories((prev) => {
      const current = prev[groupId] || { items: [], hasMore: false, loaded: false, loading: false };
      return {
        ...prev,
        [groupId]: { ...current, loading: true }
      };
    });

    try {
      const res = await api.getGroupMessages(groupId, beforeId);
      setGroupHistories((prev) => {
        const current = prev[groupId] || { items: [], hasMore: false, loaded: false, loading: false };
        const merged = loadOlder ? [...res.messages, ...current.items] : res.messages;
        const seen = new Set();
        const unique = merged.filter((m) => {
          if (seen.has(m.id)) return false;
          seen.add(m.id);
          return true;
        });
        return {
          ...prev,
          [groupId]: {
            items: unique,
            hasMore: res.hasMore,
            loaded: true,
            loading: false
          }
        };
      });
    } catch {
      setGroupHistories((prev) => ({
        ...prev,
        [groupId]: { ...(prev[groupId] || { items: [], hasMore: false }), loaded: true, loading: false }
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

  const markGroupAsRead = useCallback((groupId) => {
    socketRef.current?.emit('mark_group_read', { groupId });
    setGroups((prev) =>
      prev.map((g) => (g.id === groupId ? { ...g, unreadCount: 0 } : g))
    );
    setFlashingWindows((prev) => ({ ...prev, [`group-${groupId}`]: false }));
  }, []);

  const openChatWithFriend = useCallback((friend) => {
    const fid = friend.id;
    const winId = `chat-${fid}`;
    if (isMobile) {
      setOpenGroupIds([]);
    }
    setOpenChatIds((prev) => {
      if (isMobile) return [fid];
      return prev.includes(fid) ? prev : [...prev, fid];
    });
    focusWindow(winId);
    loadHistory(fid);
    markConversationAsRead(fid);
  }, [focusWindow, isMobile, loadHistory, markConversationAsRead]);

  const openGroupChat = useCallback((group) => {
    const gid = group.id;
    const winId = `group-${gid}`;
    if (isMobile) {
      setOpenChatIds([]);
    }
    setOpenGroupIds((prev) => {
      if (isMobile) return [gid];
      return prev.includes(gid) ? prev : [...prev, gid];
    });
    focusWindow(winId);
    loadGroupHistory(gid);
    markGroupAsRead(gid);
  }, [focusWindow, isMobile, loadGroupHistory, markGroupAsRead]);

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

    s.on('nudge_cooldown', ({ toUserId, groupId, message }) => {
      if (groupId) {
        setCooldownByGroup((prev) => ({ ...prev, [groupId]: message }));
        setTimeout(() => {
          setCooldownByGroup((prev) => ({ ...prev, [groupId]: '' }));
        }, 3500);
      } else if (toUserId) {
        setCooldownByFriend((prev) => ({ ...prev, [toUserId]: message }));
        setTimeout(() => {
          setCooldownByFriend((prev) => ({ ...prev, [toUserId]: '' }));
        }, 3500);
      }
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

    s.on('friend_read_messages', ({ byUserId }) => {
      const me = profileRef.current;
      if (!me || !byUserId) return;
      setChatHistories((prev) => {
        const curr = prev[byUserId];
        if (!curr) return prev;
        return {
          ...prev,
          [byUserId]: {
            ...curr,
            items: curr.items.map((m) => (m.fromUserId === me.id ? { ...m, read: true } : m))
          }
        };
      });
    });

    s.on('reaction_updated', ({ scope, messageId, groupId, reactions }) => {
      if (scope === 'group' && groupId) {
        setGroupHistories((prev) => {
          const curr = prev[groupId];
          if (!curr) return prev;
          return {
            ...prev,
            [groupId]: {
              ...curr,
              items: curr.items.map((m) => (m.id === messageId ? { ...m, reactions } : m))
            }
          };
        });
      } else {
        setChatHistories((prev) => {
          let changed = false;
          const next = { ...prev };
          for (const fid of Object.keys(next)) {
            const hist = next[fid];
            if (hist?.items?.some((m) => m.id === messageId)) {
              changed = true;
              next[fid] = {
                ...hist,
                items: hist.items.map((m) => (m.id === messageId ? { ...m, reactions } : m))
              };
            }
          }
          return changed ? next : prev;
        });
      }
    });

    const appendMessageToGroup = (msg, { triggerAlert = true } = {}) => {
      const me = profileRef.current;
      if (!me || !msg?.groupId) return;
      const gid = msg.groupId;

      setGroupHistories((prev) => {
        const curr = prev[gid] || { items: [], hasMore: false, loaded: false, loading: false };
        if (curr.items.some((m) => m.id === msg.id)) return prev;
        return {
          ...prev,
          [gid]: { ...curr, items: [...curr.items, msg] }
        };
      });

      if (msg.fromUserId !== me.id) {
        const winId = `group-${gid}`;
        const isGroupFocused = activeWindowRef.current === winId && !minimizedRef.current[winId] && !document.hidden;
        if (isGroupFocused) {
          markGroupAsRead(gid);
        } else {
          setGroups((prev) =>
            prev.map((g) => (g.id === gid ? { ...g, unreadCount: (g.unreadCount || 0) + 1 } : g))
          );
          setFlashingWindows((prev) => ({ ...prev, [winId]: true }));

          if (!window.matchMedia('(max-width: 768px)').matches) {
            setOpenGroupIds((prev) => {
              if (!prev.includes(gid)) {
                setMinimizedWindows((mPrev) => ({ ...mPrev, [winId]: true }));
                return [...prev, gid];
              }
              return prev;
            });
          }

          if (triggerAlert) {
            const senderClean = stripPlusTags(msg.fromUser?.nickname || 'Contacto');
            const previewText =
              msg.type === 'image' ? `${senderClean} envió una foto 📷`
                : msg.type === 'voice' ? `${senderClean} envió un clip de voz 🎙️`
                  : msg.type === 'ink' ? `${senderClean} envió una nota manuscrita ✍️`
                    : msg.type === 'nudge' ? `¡${senderClean} envió un ZUMBIDO a la sala! ⚡`
                      : msg.type === 'wink' ? `${senderClean} envió un guiño ✨`
                        : `${senderClean}: ${msg.text.slice(0, 38)}`;

            showToaster(
              { ...(msg.fromUser || {}), nickname: `${msg.groupName || 'Sala'}` },
              previewText,
              null,
              gid
            );
            sendSystemNotification(`Zumbido 05 — ${msg.groupName || 'Sala grupal'}`, previewText);
          }
        }
      }
    };

    s.on('groups_refresh', ({ groups: nextGroups }) => {
      if (Array.isArray(nextGroups)) {
        setGroups(nextGroups);
      }
    });

    s.on('receive_group_message', (msg) => {
      appendMessageToGroup(msg);
      if (msg.fromUserId !== profileRef.current?.id) {
        playMessageSound();
      }
    });

    s.on('receive_group_nudge', (msg) => {
      const me = profileRef.current;
      appendMessageToGroup(msg);
      playNudgeSound();
      if (msg.fromUserId !== me?.id) {
        vibrateForNudge();
      }
      setShakeByGroup((prev) => ({ ...prev, [msg.groupId]: Date.now() }));
    });

    s.on('receive_group_wink', (msg) => {
      appendMessageToGroup(msg);
      setWinkByGroup((prev) => ({
        ...prev,
        [msg.groupId]: { winkId: msg.winkId || msg.mediaData || 'laugh', ts: Date.now() }
      }));
    });

    s.on('group_typing', ({ groupId, fromUserId, nickname, isTyping }) => {
      if (!groupId || fromUserId === profileRef.current?.id) return;
      setTypingByGroup((prev) => {
        const curr = { ...(prev[groupId] || {}) };
        if (isTyping) curr[fromUserId] = nickname || 'Alguien';
        else delete curr[fromUserId];
        return { ...prev, [groupId]: curr };
      });
    });

    s.on('group_read', ({ groupId }) => {
      setGroups((prev) => prev.map((g) => (g.id === groupId ? { ...g, unreadCount: 0 } : g)));
      setFlashingWindows((prev) => ({ ...prev, [`group-${groupId}`]: false }));
    });

    return () => {
      disconnectSocket();
      socketRef.current = null;
    };
  }, [token, profile?.id, applyFriendsBundle, markConversationAsRead, markGroupAsRead, sendSystemNotification, showToaster]);

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

  // Track deployed buildId so mobile PWAs automatically detect new versions
  const checkServerBuildVersion = useCallback(async () => {
    try {
      const res = await fetch('/api/health', { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      if (!data?.buildId) return;
      if (!initialBuildIdRef.current) {
        initialBuildIdRef.current = data.buildId;
      } else if (initialBuildIdRef.current !== data.buildId) {
        setAppUpdateAvailable(true);
      }
    } catch {
      // ignore offline check
    }
  }, []);

  useEffect(() => {
    checkServerBuildVersion();
  }, [checkServerBuildVersion]);

  // Instant mobile reconnect & chat sync whenever screen wakes up or network returns
  useEffect(() => {
    if (!token || !profile?.id) return;

    const handleResume = () => {
      if (document.visibilityState === 'hidden') return;
      reconnectSocketNow();
      checkServerBuildVersion();
      api.getFriends().then(applyFriendsBundle).catch(() => {});
      api.getGroups().then((r) => setGroups(r.groups || [])).catch(() => {});
      openChatIdsRef.current.forEach((fid) => {
        loadHistory(fid);
      });
      openGroupIdsRef.current.forEach((gid) => {
        loadGroupHistory(gid);
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
  }, [token, profile?.id, applyFriendsBundle, loadHistory, loadGroupHistory, checkServerBuildVersion]);

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

  // Listen for Service Worker notificationclick -> OPEN_CHAT / OPEN_GROUP messages
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
      } else if (event.data?.type === 'OPEN_GROUP' && event.data.groupId) {
        const gid = Number(event.data.groupId);
        const found = groupsRef.current.find((g) => g.id === gid);
        if (found) {
          openGroupChat(found);
        } else {
          setPendingGroupId(gid);
        }
      }
    };
    navigator.serviceWorker.addEventListener('message', onSwMessage);
    return () => navigator.serviceWorker.removeEventListener('message', onSwMessage);
  }, [openChatWithFriend, openGroupChat]);

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

  // Open pending group from ?group=<groupId> or push click once groups load
  useEffect(() => {
    if (!pendingGroupId || groups.length === 0) return;
    const target = groups.find((g) => g.id === pendingGroupId);
    if (target) {
      setPendingGroupId(null);
      clearQueryParamFromUrl('group');
      openGroupChat(target);
    }
  }, [pendingGroupId, groups, openGroupChat]);

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
    api.getGroups().then((r) => setGroups(r.groups || [])).catch(() => {});
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
    setGroups([]);
    setIncomingRequests([]);
    setOutgoingRequests([]);
    setOpenChatIds([]);
    setOpenGroupIds([]);
    setChatHistories({});
    setGroupHistories({});
    setFlashingWindows({});
    setIsPlayerOpen(false);
    setGroupModalState(null);
    setPushMessage('');
  };

  const handleUpdateProfile = async (updates) => {
    const res = await api.updateProfile(updates);
    setProfile(res.user);
  };

  const handleApplySongStatus = async (statusText) => {
    try {
      await handleUpdateProfile({ personalMessage: statusText });
      if (profileRef.current) {
        showToaster(profileRef.current, `Estado musical actualizado: ${statusText}`);
      }
    } catch {
      // ignore profile update error
    }
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

  const showChatNotice = useCallback((friendId, message) => {
    if (!friendId || !message) return;
    setCooldownByFriend((prev) => ({ ...prev, [friendId]: message }));
    setTimeout(() => {
      setCooldownByFriend((prev) => (prev[friendId] === message ? { ...prev, [friendId]: '' } : prev));
    }, 4200);
  }, []);

  const showGroupNotice = useCallback((groupId, message) => {
    if (!groupId || !message) return;
    setCooldownByGroup((prev) => ({ ...prev, [groupId]: message }));
    setTimeout(() => {
      setCooldownByGroup((prev) => (prev[groupId] === message ? { ...prev, [groupId]: '' } : prev));
    }, 4200);
  }, []);

  const handleSendMessage = (payload) => {
    socketRef.current?.emit('send_message', payload, (ack) => {
      if (ack?.error) {
        showChatNotice(payload.toUserId, ack.error);
      }
    });
  };

  const handleSendNudge = (toUserId) => {
    socketRef.current?.emit('send_nudge', { toUserId }, (ack) => {
      if (ack?.error && !ack?.cooldown) {
        showChatNotice(toUserId, ack.error);
      }
    });
  };

  const handleSendWink = (toUserId, winkId) => {
    socketRef.current?.emit('send_wink', { toUserId, winkId }, (ack) => {
      if (ack?.error) {
        showChatNotice(toUserId, ack.error);
      }
    });
  };

  const handleTypingStatus = (toUserId, isTyping) => {
    socketRef.current?.emit('typing_status', { toUserId, isTyping });
  };

  const handleToggleReaction = (scope, messageId, emoji) => {
    socketRef.current?.emit('toggle_reaction', { scope, messageId, emoji });
  };

  const handleSendGroupMessage = (payload) => {
    socketRef.current?.emit('send_group_message', payload, (ack) => {
      if (ack?.error) {
        showGroupNotice(payload.groupId, ack.error);
      }
    });
  };

  const handleSendGroupNudge = (groupId) => {
    socketRef.current?.emit('send_group_nudge', { groupId }, (ack) => {
      if (ack?.error && !ack?.cooldown) {
        showGroupNotice(groupId, ack.error);
      }
    });
  };

  const handleSendGroupWink = (groupId, winkId) => {
    socketRef.current?.emit('send_group_wink', { groupId, winkId }, (ack) => {
      if (ack?.error) {
        showGroupNotice(groupId, ack.error);
      }
    });
  };

  const handleGroupTypingStatus = (groupId, isTyping) => {
    socketRef.current?.emit('group_typing_status', { groupId, isTyping });
  };

  const handleCreateGroup = async (name, memberIds, avatar) => {
    const res = await api.createGroup(name, memberIds, avatar);
    if (res?.groups) setGroups(res.groups);
    if (res?.group) openGroupChat(res.group);
  };

  const handleAddGroupMembers = async (groupId, memberIds) => {
    const res = await api.addGroupMembers(groupId, memberIds);
    if (res?.group) {
      setGroups((prev) => prev.map((g) => (g.id === groupId ? res.group : g)));
    }
  };

  const handleLeaveGroup = async (groupId) => {
    if (!window.confirm('¿Salir de esta sala grupal?')) return;
    const res = await api.leaveGroup(groupId);
    if (res?.groups) setGroups(res.groups);
    else setGroups((prev) => prev.filter((g) => g.id !== groupId));
    setOpenGroupIds((prev) => prev.filter((id) => id !== groupId));
    setFlashingWindows((prev) => ({ ...prev, [`group-${groupId}`]: false }));
  };

  const handleMinimize = (winId) => {
    setMinimizedWindows((prev) => ({ ...prev, [winId]: true }));
    if (activeWindowId === winId) setActiveWindowId(null);
  };

  const handleCloseChat = (friendId) => {
    setOpenChatIds((prev) => prev.filter((id) => id !== friendId));
    setFlashingWindows((prev) => ({ ...prev, [`chat-${friendId}`]: false }));
  };

  const handleCloseGroupChat = (groupId) => {
    setOpenGroupIds((prev) => prev.filter((id) => id !== groupId));
    setFlashingWindows((prev) => ({ ...prev, [`group-${groupId}`]: false }));
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
      // Auto-recover if Chrome rotated/expired the PushSubscription (410 Gone -> 502 / 400)
      if (err?.status === 400 || err?.status === 502) {
        try {
          await subscribeToWebPush({ forceResubscribe: true });
          const st = await getPushStatus();
          setPushStatus(st);
          setNotificationPermission(st.permission);
          await api.sendTestPush();
          setPushMessage('✓ Suscripción renovada y notificación de prueba enviada a tu dispositivo.');
          return;
        } catch (retryErr) {
          setPushMessage(`⚠️ ${retryErr.message || 'No se pudo renovar ni enviar la notificación de prueba.'}`);
          return;
        }
      }
      setPushMessage(`⚠️ ${err.message || 'No se pudo enviar la notificación de prueba.'}`);
    } finally {
      setPushBusy(false);
    }
  };

  const handleForceUpdateApp = async () => {
    try {
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.update().catch(() => {})));
      }
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
    } catch {
      // fallback to reload anyway
    }
    window.location.reload();
  };

  const isLoggedIn = Boolean(profile);
  const totalUnreadCount =
    friends.reduce((sum, f) => sum + (f.unreadCount || 0), 0) +
    groups.reduce((sum, g) => sum + (g.unreadCount || 0), 0);

  // Sync PWA App Icon Badge & browser tab title with unread messages + pending requests
  useEffect(() => {
    const pendingTotal = isLoggedIn ? totalUnreadCount + incomingRequests.length : 0;
    updateAppBadge(pendingTotal);
    document.title = pendingTotal > 0
      ? `(${pendingTotal}) Zumbido 05 — Mensajería Retro`
      : 'Zumbido 05 — Mensajería Retro por islaDev';
  }, [isLoggedIn, totalUnreadCount, incomingRequests.length]);

  // Support manifest shortcut /?action=invite when logged in
  useEffect(() => {
    if (!isLoggedIn || typeof window === 'undefined') return;
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get('action') === 'invite') {
        setAddFriendModalTab('invite');
        clearQueryParamFromUrl('action');
      }
    } catch {
      // ignore
    }
  }, [isLoggedIn]);

  const openFriends = openChatIds
    .map((fid) => friends.find((f) => f.id === fid))
    .filter(Boolean);

  const openGroups = openGroupIds
    .map((gid) => groups.find((g) => g.id === gid))
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

    openGroups.forEach((group) => {
      const winId = `group-${group.id}`;
      taskbarWindows.push({
        id: winId,
        title: group.name,
        icon: <span>{group.avatar || '👥'}</span>,
        isMinimized: Boolean(minimizedWindows[winId]),
        isFlashing: Boolean(flashingWindows[winId]) || ((group.unreadCount || 0) > 0 && activeWindowId !== winId),
        unreadCount: group.unreadCount || 0,
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

  const hasOpenMobileChat = isMobile && (openFriends.length > 0 || openGroups.length > 0);

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
        } else if (winId.startsWith('group-')) {
          const gid = Number(winId.slice(6));
          loadGroupHistory(gid);
          markGroupAsRead(gid);
        }
      }}
      onFocusWindow={(winId) => {
        focusWindow(winId);
        if (winId.startsWith('chat-')) {
          const fid = Number(winId.slice(5));
          markConversationAsRead(fid);
        } else if (winId.startsWith('group-')) {
          const gid = Number(winId.slice(6));
          markGroupAsRead(gid);
        }
      }}
      onOpenAbout={() => setIsAboutOpen(true)}
      onOpenPlayer={() => setIsPlayerOpen(true)}
      onLogout={handleLogout}
      isLoggedIn={isLoggedIn}
      userProfile={profile}
      connectionState={connectionState}
      toasterData={toasterData}
      onDismissToaster={() => setToasterData(null)}
      onToasterClick={() => {
        if (toasterData?.groupId) {
          const targetGroup = groups.find((g) => g.id === toasterData.groupId);
          if (targetGroup) openGroupChat(targetGroup);
        } else if (toasterData?.friendId) {
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
      {/* 0. New Version Available Banner */}
      {appUpdateAvailable && (
        <div
          className="c05-reconnect-banner"
          style={{ background: '#e0f2fe', borderColor: '#0284c7', color: '#0c4a6e', top: 10 }}
        >
          <span>✨ Nueva versión de Zumbido 05 lista.</span>
          <button
            type="button"
            className="c05-btn c05-btn-primary"
            style={{ fontSize: 11, padding: '2px 8px' }}
            onClick={handleForceUpdateApp}
          >
            🔄 Actualizar ahora
          </button>
        </div>
      )}

      {/* 0b. Direct App-Only (WebAPK) Install Banner — skips Chrome's 2-option Shortcut menu */}
      {Boolean(deferredInstallPrompt) && !isStandalonePwa() && !installBannerDismissed && !appUpdateAvailable && (
        <div
          className="c05-reconnect-banner"
          style={{
            background: 'linear-gradient(180deg, #eff6ff 0%, #dbeafe 100%)',
            borderColor: '#0055ea',
            color: '#0b3474',
            top: 10,
            maxWidth: '94vw',
            flexWrap: 'wrap',
            justifyContent: 'center'
          }}
        >
          <span>📲 Instala <strong>Zumbido 05</strong> como aplicación (notificaciones e ícono)</span>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <button
              type="button"
              className="c05-btn c05-btn-primary"
              style={{ fontSize: 11, padding: '3px 10px' }}
              onClick={handleInstallPwa}
            >
              Instalar app
            </button>
            <button
              type="button"
              onClick={() => setInstallBannerDismissed(true)}
              style={{ background: 'none', border: 'none', color: '#316ac5', cursor: 'pointer', fontSize: 12, padding: '0 4px' }}
              title="Ocultar"
            >
              ✕
            </button>
          </div>
        </div>
      )}

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
          groups={groups}
          incomingRequests={incomingRequests}
          onOpenChat={openChatWithFriend}
          onOpenGroupChat={openGroupChat}
          onOpenCreateGroup={() => setGroupModalState({ mode: 'create' })}
          onOpenAddFriend={() => setAddFriendModalTab('add')}
          onOpenInvite={() => setAddFriendModalTab('invite')}
          onOpenProfileModal={() => setIsProfileModalOpen(true)}
          onOpenPlayer={() => setIsPlayerOpen(true)}
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
          onCheckAppUpdate={handleForceUpdateApp}
          appUpdateAvailable={appUpdateAvailable}
          onLogout={handleLogout}
          onMinimize={() => handleMinimize('contactList')}
          isFocused={activeWindowId === 'contactList'}
          zIndex={zOrders.contactList || 200}
          onFocus={() => focusWindow('contactList')}
          isMobile={isMobile}
          mobileSection={mobileSection}
        />
      )}

      {/* 3. Open DM Chat Windows */}
      {isLoggedIn &&
        openFriends.map((friend, idx) => {
          const winId = `chat-${friend.id}`;
          if (minimizedWindows[winId]) return null;
          const hist = chatHistories[friend.id] || { items: [], hasMore: false, loading: false };

          return (
            <ChatWindow
              key={winId}
              mode="dm"
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
              onToggleReaction={handleToggleReaction}
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

      {/* 3b. Open Group Chat Windows */}
      {isLoggedIn &&
        openGroups.map((group, idx) => {
          const winId = `group-${group.id}`;
          if (minimizedWindows[winId]) return null;
          const hist = groupHistories[group.id] || { items: [], hasMore: false, loading: false };
          const typingNicks = Object.values(typingByGroup[group.id] || {}).map((n) => stripPlusTags(n));
          const typingText =
            typingNicks.length === 1
              ? `${typingNicks[0]} está escribiendo...`
              : typingNicks.length > 1
                ? `${typingNicks.slice(0, 2).join(', ')} están escribiendo...`
                : '';

          return (
            <ChatWindow
              key={winId}
              mode="group"
              group={group}
              myProfile={profile}
              messages={hist.items}
              hasMore={hist.hasMore}
              loadingHistory={hist.loading}
              onLoadMore={(gid) => loadGroupHistory(gid, { loadOlder: true })}
              typingText={typingText}
              shakingToken={shakeByGroup[group.id] || 0}
              activeWink={winkByGroup[group.id] || null}
              onClearWink={(gid) => setWinkByGroup((prev) => ({ ...prev, [gid]: null }))}
              cooldownNotice={cooldownByGroup[group.id] || ''}
              onSendMessage={handleSendGroupMessage}
              onSendNudge={handleSendGroupNudge}
              onSendWink={handleSendGroupWink}
              onTypingStatus={handleGroupTypingStatus}
              onMarkRead={markGroupAsRead}
              onToggleReaction={handleToggleReaction}
              onInviteGroupMembers={(grp) => setGroupModalState({ mode: 'invite', group: grp })}
              onLeaveGroup={handleLeaveGroup}
              onMinimize={() => handleMinimize(winId)}
              onClose={() => handleCloseGroupChat(group.id)}
              isFocused={activeWindowId === winId}
              zIndex={zOrders[winId] || 220 + openFriends.length + idx}
              cascadeIndex={openFriends.length + idx}
              onFocus={() => {
                focusWindow(winId);
                markGroupAsRead(group.id);
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

      {/* 4b. Create Group / Invite Members Modal */}
      {groupModalState && (
        <CreateGroupModal
          friends={friends}
          existingGroup={groupModalState.mode === 'invite' ? groupModalState.group : null}
          onCreateGroup={handleCreateGroup}
          onAddMembers={handleAddGroupMembers}
          onClose={() => setGroupModalState(null)}
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

      {/* 5b. Reproductor 05 Modal */}
      {isPlayerOpen && (
        <RetroPlayerModal
          onClose={() => setIsPlayerOpen(false)}
          onApplySongStatus={handleApplySongStatus}
        />
      )}

      {/* 6. About / Legal Independence Modal */}
      {isAboutOpen && <AboutModal onClose={() => setIsAboutOpen(false)} />}
    </Desktop>
  );
}
