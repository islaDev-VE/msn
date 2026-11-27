import React, { useState, useEffect } from 'react';
import ZumbidoLogo from '../Common/ZumbidoLogo';
import { AvatarView } from '../../services/avatars';
import { playToasterSound, setSoundMuted } from '../../services/soundEngine';
import { stripPlusTags } from '../../services/plusFormatter';

export default function Desktop({
  children,
  windows = [],
  activeWindowId,
  onRestoreWindow,
  onFocusWindow,
  onOpenAbout,
  onLogout,
  isLoggedIn,
  userProfile,
  connectionState,
  toasterData,
  onToasterClick,
  onDismissToaster,
  isMobile,
  mobileSection,
  onSelectMobileSection,
  hasOpenMobileChat,
  totalUnreadCount = 0,
  pendingRequestCount = 0
}) {
  const [currentTime, setCurrentTime] = useState('');
  const [showClassicMenu, setShowClassicMenu] = useState(false);
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    const updateClock = () => {
      setCurrentTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (toasterData) {
      playToasterSound();
    }
  }, [toasterData]);

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    setSoundMuted(next);
  };

  return (
    <div className="c05-desktop" onClick={() => setShowClassicMenu(false)}>
      {/* Procedural Sunny Meadow Overlay (Desktop) */}
      <div className="c05-meadow-overlay" />

      {/* Reconnecting Banner */}
      {isLoggedIn && connectionState === 'reconnecting' && (
        <div className="c05-reconnect-banner">
          <span>⚠️</span> Reconectando con el servidor de Zumbido 05...
        </div>
      )}

      {/* Desktop Retro Shortcuts (Brand-safe original labels) */}
      <div className="c05-desktop-icons">
        <div
          className="c05-desktop-shortcut"
          onDoubleClick={() => onRestoreWindow?.('contactList')}
          title="Abrir Zumbido 05"
        >
          <div className="c05-shortcut-icon">
            <ZumbidoLogo size={34} />
          </div>
          <div className="c05-shortcut-label">Zumbido 05</div>
        </div>

        <a
          href="https://isladev.com"
          target="_blank"
          rel="noopener noreferrer"
          className="c05-desktop-shortcut"
          title="Visitar isladev.com — Desarrollado por islaDev"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="c05-shortcut-icon">
            <div className="c05-shortcut-isladev">
              <img src="/icons/isladev-icon.png" alt="islaDev" />
              <span className="c05-shortcut-arrow" aria-hidden="true">↗</span>
            </div>
          </div>
          <div className="c05-shortcut-label">islaDev.com</div>
        </a>

        <div className="c05-desktop-shortcut" onDoubleClick={() => onOpenAbout?.()} title="Información del desarrollador y Acerca de">
          <div className="c05-shortcut-icon">💻</div>
          <div className="c05-shortcut-label">Mi Equipo</div>
        </div>

        <div className="c05-desktop-shortcut" onDoubleClick={() => onOpenAbout?.()}>
          <div className="c05-shortcut-icon">🎵</div>
          <div className="c05-shortcut-label">Reproductor 05</div>
        </div>

        <div className="c05-desktop-shortcut">
          <div className="c05-shortcut-icon">🗑️</div>
          <div className="c05-shortcut-label">Papelera</div>
        </div>
      </div>

      {/* Render Windows */}
      {children}

      {/* Toaster Popup Notification */}
      {toasterData && (
        <div
          className="z05-toaster"
          onClick={(e) => {
            e.stopPropagation();
            onToasterClick?.();
          }}
        >
          <div className="z05-toaster-header">
            <div className="z05-toaster-title">
              <ZumbidoLogo size={14} />
              <span>Zumbido 05</span>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDismissToaster?.();
              }}
              style={{ background: 'none', border: 'none', color: '#316ac5', cursor: 'pointer', fontSize: 11 }}
            >
              ✕
            </button>
          </div>
          <div className="z05-toaster-body">
            <div className="z05-toaster-avatar">
              <AvatarView avatar={toasterData.user?.avatar || 'bubbles'} alt="Avatar" />
            </div>
            <div className="z05-toaster-text">
              <div className="z05-toaster-nickname">
                {stripPlusTags(toasterData.user?.nickname || 'Contacto')}
              </div>
              <div>{toasterData.text}</div>
            </div>
          </div>
        </div>
      )}

      {/* Classic Two-Column Green Menu (Desktop, original glossy orb branding) */}
      {showClassicMenu && !isMobile && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'absolute',
            bottom: 32,
            left: 0,
            width: 360,
            background: '#ffffff',
            border: '2px solid #0055ea',
            borderTopLeftRadius: 8,
            borderTopRightRadius: 8,
            boxShadow: '3px -3px 14px rgba(0,0,0,0.42)',
            zIndex: 10000,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}
        >
          <div
            style={{
              height: 52,
              background: 'linear-gradient(to right, #0058ee 0%, #3593ff 100%)',
              display: 'flex',
              alignItems: 'center',
              padding: '0 14px',
              gap: 10,
              color: '#fff'
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 4,
                border: '2px solid #fff',
                overflow: 'hidden',
                background: '#fff'
              }}
            >
              <AvatarView avatar={userProfile?.avatar || 'bubbles'} alt="Perfil" />
            </div>
            <span style={{ fontSize: 13, fontWeight: 'bold', textShadow: '1px 1px 2px #000' }}>
              {userProfile ? stripPlusTags(userProfile.nickname) : 'Escritorio Clásico 05'}
            </span>
          </div>

          <div style={{ display: 'flex', minHeight: 230 }}>
            <div style={{ width: '54%', background: '#fff', padding: 8, display: 'flex', flexDirection: 'column', gap: 6, borderRight: '1px solid #95bdee' }}>
              <div
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 6px', cursor: 'pointer', borderRadius: 3 }}
                onClick={() => {
                  onRestoreWindow?.('contactList');
                  setShowClassicMenu(false);
                }}
              >
                <ZumbidoLogo size={24} />
                <div>
                  <strong style={{ fontSize: 12, color: '#000' }}>Zumbido 05</strong>
                  <div style={{ fontSize: 10, color: '#666' }}>Mensajería retro</div>
                </div>
              </div>
              <a
                href="https://isladev.com"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setShowClassicMenu(false)}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 6px', color: '#0b3474', textDecoration: 'none', borderRadius: 3 }}
              >
                <img
                  src="/icons/isladev-icon.png"
                  alt="islaDev"
                  style={{ width: 24, height: 24, borderRadius: 4, border: '1px solid #7dd3fc' }}
                />
                <div>
                  <strong style={{ fontSize: 11, color: '#000' }}>islaDev.com</strong>
                  <div style={{ fontSize: 10, color: '#666' }}>Desarrollo web & apps</div>
                </div>
              </a>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 6px', color: '#444' }}>
                <span style={{ fontSize: 20 }}>🎵</span>
                <div>
                  <strong style={{ fontSize: 11 }}>Reproductor 05</strong>
                  <div style={{ fontSize: 10, color: '#777' }}>Música y audio</div>
                </div>
              </div>
            </div>

            <div style={{ width: '46%', background: '#d3e5fa', padding: 10, display: 'flex', flexDirection: 'column', gap: 9 }}>
              <div style={{ fontSize: 11, fontWeight: 'bold', color: '#0b3474' }}>📁 Mis documentos</div>
              <div style={{ fontSize: 11, fontWeight: 'bold', color: '#0b3474' }}>🖼️ Mis imágenes</div>
              <div style={{ fontSize: 11, fontWeight: 'bold', color: '#0b3474' }}>🎵 Mi música</div>
              <div style={{ height: 1, background: '#a0c0e8' }} />
              <div
                style={{ fontSize: 11, color: '#0b3474', cursor: 'pointer', fontWeight: 'bold' }}
                onClick={() => {
                  setShowClassicMenu(false);
                  onOpenAbout?.();
                }}
              >
                ℹ️ Desarrollador & Acerca de
              </div>
            </div>
          </div>

          <div
            style={{
              height: 38,
              background: 'linear-gradient(to right, #428bf6 0%, #1562e8 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              padding: '0 12px',
              gap: 8
            }}
          >
            {isLoggedIn && (
              <button
                type="button"
                className="c05-btn"
                onClick={() => {
                  setShowClassicMenu(false);
                  onLogout?.();
                }}
              >
                🚪 Cerrar sesión
              </button>
            )}
          </div>
        </div>
      )}

      {/* Classic Desktop Taskbar */}
      <div className="c05-taskbar">
        <button
          type="button"
          className="c05-menu-btn"
          onClick={(e) => {
            e.stopPropagation();
            setShowClassicMenu((v) => !v);
          }}
        >
          {/* Original glossy orb emblem (zero trademark flags) */}
          <svg viewBox="0 0 20 20" width="18" height="18">
            <defs>
              <radialGradient id="c05Orb" cx="35%" cy="30%" r="70%">
                <stop offset="0%" stopColor="#ffffff" />
                <stop offset="45%" stopColor="#a7f268" />
                <stop offset="100%" stopColor="#1b6e12" />
              </radialGradient>
            </defs>
            <circle cx="10" cy="10" r="8.5" fill="url(#c05Orb)" stroke="#ffffff" strokeWidth="1.4" />
            <circle cx="10" cy="10" r="3" fill="#ffffff" opacity="0.85" />
          </svg>
          menú
        </button>

        <div className="c05-taskbar-tasks">
          {windows.map((win) => {
            const isActive = activeWindowId === win.id && !win.isMinimized;
            const isFlashing = Boolean(win.isFlashing) && !isActive;
            return (
              <button
                key={win.id}
                type="button"
                className={`c05-taskbar-item ${isActive ? 'active' : ''} ${isFlashing ? 'flashing' : ''}`}
                onClick={() => {
                  if (win.isMinimized) {
                    onRestoreWindow?.(win.id);
                  } else if (isActive) {
                    win.onMinimize?.();
                  } else {
                    onFocusWindow?.(win.id);
                  }
                }}
              >
                {win.icon}
                <span className="c05-taskbar-item-text">{win.title}</span>
                {win.unreadCount > 0 && (
                  <span className="c05-taskbar-badge">{win.unreadCount}</span>
                )}
              </button>
            );
          })}
        </div>

        <div className="c05-systray">
          <button
            type="button"
            className="c05-tray-btn"
            title="Abrir Zumbido 05"
            onClick={() => onRestoreWindow?.('contactList')}
          >
            <ZumbidoLogo size={17} />
          </button>
          <button
            type="button"
            className="c05-tray-btn"
            title={muted ? 'Activar sonidos' : 'Silenciar sonidos'}
            onClick={toggleMute}
          >
            {muted ? '🔇' : '🔊'}
          </button>
          <span style={{ fontWeight: 'bold', marginLeft: 3 }}>{currentTime}</span>
        </div>
      </div>

      {/* Mobile Bottom Navigation Bar (only shown on mobile when logged in and no chat fullscreen) */}
      {isMobile && isLoggedIn && !hasOpenMobileChat && (
        <nav className="c05-mobile-nav" aria-label="Navegación principal">
          <button
            type="button"
            className={`c05-mobile-nav-btn ${mobileSection === 'contacts' ? 'active' : ''}`}
            onClick={() => onSelectMobileSection?.('contacts')}
          >
            <span style={{ fontSize: 18 }}>👥</span>
            <span>Contactos</span>
            {pendingRequestCount > 0 && (
              <span className="c05-mobile-nav-badge">{pendingRequestCount}</span>
            )}
          </button>

          <button
            type="button"
            className={`c05-mobile-nav-btn ${mobileSection === 'chats' ? 'active' : ''}`}
            onClick={() => onSelectMobileSection?.('chats')}
          >
            <span style={{ fontSize: 18 }}>💬</span>
            <span>Chats</span>
            {totalUnreadCount > 0 && (
              <span className="c05-mobile-nav-badge">{totalUnreadCount}</span>
            )}
          </button>

          <button
            type="button"
            className={`c05-mobile-nav-btn ${mobileSection === 'profile' ? 'active' : ''}`}
            onClick={() => onSelectMobileSection?.('profile')}
          >
            <span style={{ fontSize: 18 }}>⚙️</span>
            <span>Perfil</span>
          </button>
        </nav>
      )}
    </div>
  );
}
