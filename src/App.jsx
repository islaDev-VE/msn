import React, { useState, useEffect } from 'react';
import Desktop from './components/Desktop/Desktop';
import LoginModal from './components/Login/LoginModal';
import ContactListWindow from './components/ContactList/ContactListWindow';
import ChatWindow from './components/Chat/ChatWindow';
import InviteModal from './components/Modals/InviteModal';
import { getSocket, disconnectSocket } from './services/socket';
import { playMessageSound, playLogoutSound } from './services/soundEngine';

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [myProfile, setMyProfile] = useState(null);
  const [roomId, setRoomId] = useState('sala-msn-nostalgia');
  const [roomUsers, setRoomUsers] = useState([]);
  const [openChats, setOpenChats] = useState([]); // Array of contacts
  const [messages, setMessages] = useState([]);
  const [typingUsers, setTypingUsers] = useState([]);
  const [activeWindowId, setActiveWindowId] = useState('login');
  const [minimizedWindows, setMinimizedWindows] = useState({});
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [toasterData, setToasterData] = useState(null);
  const [socket, setSocket] = useState(null);

  // Initialize room ID from URL if present
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get('room');
    if (roomParam) {
      setRoomId(roomParam);
    }
  }, []);

  // Setup Socket listeners when logged in
  useEffect(() => {
    if (!isLoggedIn || !myProfile) return;

    const s = getSocket();
    setSocket(s);

    s.emit('join_room', {
      roomId,
      profile: myProfile
    });

    s.on('room_users', (users) => {
      setRoomUsers(users);
      // Update my own socketId
      const me = users.find((u) => u.email === myProfile.email);
      if (me) {
        setMyProfile((prev) => ({ ...prev, socketId: me.socketId }));
      }
    });

    s.on('user_joined', ({ user }) => {
      setToasterData({
        user,
        text: 'acaba de iniciar sesión'
      });
      setTimeout(() => setToasterData(null), 5500);
    });

    s.on('receive_message', (msg) => {
      setMessages((prev) => [...prev, msg]);
      playMessageSound();

      // If sender is someone else and their chat is not open, open it or show toaster
      if (msg.from?.socketId !== myProfile.socketId) {
        setOpenChats((prev) => {
          if (!prev.some((c) => c.socketId === msg.from.socketId || c.email === msg.from.email)) {
            return [...prev, msg.from];
          }
          return prev;
        });

        setToasterData({
          user: msg.from,
          text: msg.text ? `dice: ${msg.text.slice(0, 30)}...` : 'te envió una nota manuscrita'
        });
        setTimeout(() => setToasterData(null), 5000);
      }
    });

    s.on('receive_nudge', ({ from }) => {
      setMessages((prev) => [
        ...prev,
        {
          id: 'nudge-' + Date.now(),
          type: 'nudge',
          from,
          timestamp: Date.now()
        }
      ]);
      // Ensure chat is open
      if (from.socketId !== myProfile.socketId) {
        setOpenChats((prev) => {
          if (!prev.some((c) => c.socketId === from.socketId || c.email === from.email)) {
            return [...prev, from];
          }
          return prev;
        });
      }
    });

    s.on('receive_wink', ({ from, winkId }) => {
      setMessages((prev) => [
        ...prev,
        {
          id: 'wink-' + Date.now(),
          type: 'wink',
          from,
          winkId,
          timestamp: Date.now()
        }
      ]);
    });

    s.on('user_typing', ({ from, isTyping }) => {
      setTypingUsers((prev) => {
        const filtered = prev.filter((u) => u.socketId !== from.socketId);
        if (isTyping) {
          return [...filtered, { socketId: from.socketId, isTyping: true }];
        }
        return filtered;
      });
    });

    return () => {
      s.off('room_users');
      s.off('user_joined');
      s.off('receive_message');
      s.off('receive_nudge');
      s.off('receive_wink');
      s.off('user_typing');
    };
  }, [isLoggedIn, myProfile?.email, roomId]);

  // Login handler
  const handleLogin = (credentials) => {
    setMyProfile(credentials);
    setRoomId(credentials.roomId);
    setIsLoggedIn(true);
    setActiveWindowId('contactList');
  };

  // Logout handler
  const handleLogout = () => {
    playLogoutSound();
    disconnectSocket();
    setIsLoggedIn(false);
    setMyProfile(null);
    setOpenChats([]);
    setMessages([]);
    setActiveWindowId('login');
  };

  // Update profile handler
  const handleUpdateProfile = (updatedFields) => {
    const updated = { ...myProfile, ...updatedFields };
    setMyProfile(updated);
    if (socket) {
      socket.emit('update_profile', updatedFields);
    }
  };

  // Open chat with a contact
  const handleOpenChat = (contact) => {
    const chatKey = contact.socketId || contact.id || contact.email;
    if (!openChats.some((c) => (c.socketId || c.id || c.email) === chatKey)) {
      setOpenChats((prev) => [...prev, contact]);
    }
    setMinimizedWindows((prev) => ({ ...prev, [`chat-${chatKey}`]: false }));
    setActiveWindowId(`chat-${chatKey}`);
  };

  // Close chat window
  const handleCloseChat = (chatKey) => {
    setOpenChats((prev) =>
      prev.filter((c) => (c.socketId || c.id || c.email) !== chatKey)
    );
  };

  // Minimize window
  const handleMinimize = (winId) => {
    setMinimizedWindows((prev) => ({ ...prev, [winId]: true }));
    if (activeWindowId === winId) {
      setActiveWindowId(null);
    }
  };

  // Restore window
  const handleRestore = (winId) => {
    setMinimizedWindows((prev) => ({ ...prev, [winId]: false }));
    setActiveWindowId(winId);
  };

  // Message send
  const handleSendMessage = (msgData) => {
    if (!socket) return;
    socket.emit('send_message', {
      roomId,
      ...msgData
    });
  };

  // Nudge send
  const handleSendNudge = () => {
    if (!socket) return;
    socket.emit('send_nudge');
  };

  // Wink send
  const handleSendWink = (winkId) => {
    if (!socket) return;
    socket.emit('send_wink', { winkId });
  };

  // Typing status
  const handleTypingStatus = (isTyping) => {
    if (!socket) return;
    socket.emit('typing_status', { isTyping });
  };

  // Prepare windows for taskbar
  const taskbarWindows = [];

  if (isLoggedIn) {
    taskbarWindows.push({
      id: 'contactList',
      title: `MSN Messenger - ${myProfile.nickname}`,
      icon: '🦋',
      isMinimized: !!minimizedWindows['contactList'],
      onMinimize: () => handleMinimize('contactList')
    });

    openChats.forEach((contact) => {
      const chatKey = contact.socketId || contact.id || contact.email;
      const winId = `chat-${chatKey}`;
      taskbarWindows.push({
        id: winId,
        title: `💬 ${contact.nickname}`,
        icon: '💬',
        isMinimized: !!minimizedWindows[winId],
        onMinimize: () => handleMinimize(winId)
      });
    });
  } else {
    taskbarWindows.push({
      id: 'login',
      title: 'MSN Messenger - Iniciar sesión',
      icon: '🦋',
      isMinimized: false,
      onMinimize: () => {}
    });
  }

  return (
    <Desktop
      windows={taskbarWindows}
      onRestoreWindow={handleRestore}
      activeWindowId={activeWindowId}
      onFocusWindow={(id) => setActiveWindowId(id)}
      toasterData={toasterData}
      onToasterClick={() => {
        if (toasterData?.user) {
          handleOpenChat(toasterData.user);
          setToasterData(null);
        }
      }}
    >
      {/* 1. Login Window */}
      {!isLoggedIn && (
        <LoginModal
          onLogin={handleLogin}
          initialRoomId={roomId}
        />
      )}

      {/* 2. Main Contact List Window */}
      {isLoggedIn && !minimizedWindows['contactList'] && (
        <ContactListWindow
          profile={myProfile}
          onUpdateProfile={handleUpdateProfile}
          roomUsers={roomUsers}
          roomId={roomId}
          onOpenChat={handleOpenChat}
          onOpenInvite={() => setIsInviteOpen(true)}
          onMinimize={() => handleMinimize('contactList')}
          onClose={handleLogout}
          isFocused={activeWindowId === 'contactList'}
          onFocus={() => setActiveWindowId('contactList')}
        />
      )}

      {/* 3. Open Chat Windows */}
      {isLoggedIn &&
        openChats.map((contact) => {
          const chatKey = contact.socketId || contact.id || contact.email;
          const winId = `chat-${chatKey}`;
          if (minimizedWindows[winId]) return null;

          return (
            <ChatWindow
              key={chatKey}
              contact={contact}
              myProfile={myProfile}
              roomId={roomId}
              socket={socket}
              messages={messages}
              onSendMessage={handleSendMessage}
              onSendNudge={handleSendNudge}
              onSendWink={handleSendWink}
              typingUsers={typingUsers}
              onTypingStatus={handleTypingStatus}
              onMinimize={() => handleMinimize(winId)}
              onClose={() => handleCloseChat(chatKey)}
              isFocused={activeWindowId === winId}
              onFocus={() => setActiveWindowId(winId)}
            />
          );
        })}

      {/* 4. Invite Friends Modal */}
      {isInviteOpen && (
        <InviteModal
          roomId={roomId}
          onClose={() => setIsInviteOpen(false)}
        />
      )}
    </Desktop>
  );
}
