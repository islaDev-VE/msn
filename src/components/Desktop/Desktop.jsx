import React, { useState, useEffect } from 'react';
import { playToasterSound } from '../../services/soundEngine';
import { getAvatarSvg } from '../../services/avatars';

export default function Desktop({
  children,
  windows,
  onRestoreWindow,
  activeWindowId,
  onFocusWindow,
  toasterData,
  onToasterClick
}) {
  const [currentTime, setCurrentTime] = useState('');
  const [showStartMenu, setShowStartMenu] = useState(false);

  // Update system tray digital clock
  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      );
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  // Play sound when toaster appears
  useEffect(() => {
    if (toasterData) {
      playToasterSound();
    }
  }, [toasterData]);

  return (
    <div className="xp-desktop" onClick={() => setShowStartMenu(false)}>
      {/* Bliss background hills overlay */}
      <div className="bliss-hills-overlay" />

      {/* Desktop Retro Icons */}
      <div style={{ position: 'absolute', top: 16, left: 16, display: 'flex', flexDirection: 'column', gap: 16, zIndex: 10 }}>
        <div
          style={{ width: 70, textAlign: 'center', cursor: 'pointer', color: '#fff' }}
          onDoubleClick={() => onRestoreWindow('contactList')}
        >
          <div style={{ fontSize: 30, filter: 'drop-shadow(1px 1px 2px #000)' }}>🦋</div>
          <div style={{ fontSize: 11, textShadow: '1px 1px 2px #000', marginTop: 2 }}>
            MSN Messenger
          </div>
        </div>

        <div style={{ width: 70, textAlign: 'center', cursor: 'pointer', color: '#fff' }}>
          <div style={{ fontSize: 30, filter: 'drop-shadow(1px 1px 2px #000)' }}>💻</div>
          <div style={{ fontSize: 11, textShadow: '1px 1px 2px #000', marginTop: 2 }}>
            Mi PC
          </div>
        </div>

        <div style={{ width: 70, textAlign: 'center', cursor: 'pointer', color: '#fff' }}>
          <div style={{ fontSize: 30, filter: 'drop-shadow(1px 1px 2px #000)' }}>🌐</div>
          <div style={{ fontSize: 11, textShadow: '1px 1px 2px #000', marginTop: 2 }}>
            Internet Explorer
          </div>
        </div>

        <div style={{ width: 70, textAlign: 'center', cursor: 'pointer', color: '#fff' }}>
          <div style={{ fontSize: 30, filter: 'drop-shadow(1px 1px 2px #000)' }}>🗑️</div>
          <div style={{ fontSize: 11, textShadow: '1px 1px 2px #000', marginTop: 2 }}>
            Papelera
          </div>
        </div>
      </div>

      {/* Render All Windows */}
      {children}

      {/* Bottom Right Toaster Notification */}
      {toasterData && (
        <div className="msn-toaster" onClick={onToasterClick}>
          <div className="msn-toaster-header">
            <div className="msn-toaster-title">
              <span>🦋</span> MSN Messenger
            </div>
            <span style={{ fontSize: 10, color: '#316ac5' }}>✕</span>
          </div>
          <div className="msn-toaster-body">
            <div
              className="msn-toaster-avatar"
              dangerouslySetInnerHTML={{ __html: getAvatarSvg(toasterData.user?.avatar || 'butterfly') }}
            />
            <div className="msn-toaster-text">
              <span className="msn-toaster-nickname">
                {toasterData.user?.nickname || 'Un contacto'}
              </span>
              <br />
              {toasterData.text || 'acaba de iniciar sesión'}
            </div>
          </div>
        </div>
      )}

      {/* Start Menu (XP Classic Two-Column Menu) */}
      {showStartMenu && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'absolute',
            bottom: 30,
            left: 0,
            width: 380,
            height: 440,
            background: '#ffffff',
            border: '2px solid #0055ea',
            borderTopLeftRadius: 6,
            borderTopRightRadius: 6,
            boxShadow: '3px -3px 12px rgba(0,0,0,0.4)',
            zIndex: 10000,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}
        >
          {/* Header */}
          <div
            style={{
              height: 52,
              background: 'linear-gradient(to right, #0058ee 0%, #3593ff 100%)',
              display: 'flex',
              alignItems: 'center',
              padding: '0 16px',
              gap: 12,
              color: '#fff'
            }}
          >
            <div style={{ width: 36, height: 36, borderRadius: 3, border: '2px solid #fff', overflow: 'hidden', background: '#fff' }}
              dangerouslySetInnerHTML={{ __html: getAvatarSvg('butterfly') }}
            />
            <span style={{ fontSize: 14, fontWeight: 'bold', textShadow: '1px 1px 2px #000' }}>
              Usuario de Windows XP
            </span>
          </div>

          {/* Two column body */}
          <div style={{ flex: 1, display: 'flex' }}>
            {/* Left Column (Pinned Programs) */}
            <div style={{ width: '50%', background: '#fff', padding: 8, display: 'flex', flexDirection: 'column', gap: 6, borderRight: '1px solid #95bdee' }}>
              <div
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 6px', cursor: 'pointer', borderRadius: 2 }}
                onClick={() => { onRestoreWindow('contactList'); setShowStartMenu(false); }}
              >
                <span style={{ fontSize: 20 }}>🦋</span>
                <div>
                  <strong style={{ fontSize: 11, color: '#000' }}>MSN Messenger 7.5</strong>
                  <div style={{ fontSize: 9, color: '#777' }}>Mensajería instantánea</div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 6px', cursor: 'pointer' }}>
                <span style={{ fontSize: 20 }}>🌐</span>
                <div>
                  <strong style={{ fontSize: 11, color: '#000' }}>Internet Explorer</strong>
                  <div style={{ fontSize: 9, color: '#777' }}>Examinar la web</div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 6px', cursor: 'pointer' }}>
                <span style={{ fontSize: 20 }}>🎵</span>
                <div>
                  <strong style={{ fontSize: 11, color: '#000' }}>Windows Media Player</strong>
                  <div style={{ fontSize: 9, color: '#777' }}>Música y vídeos</div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 6px', cursor: 'pointer' }}>
                <span style={{ fontSize: 20 }}>🎮</span>
                <div>
                  <strong style={{ fontSize: 11, color: '#000' }}>Pinball 3D</strong>
                  <div style={{ fontSize: 9, color: '#777' }}>Space Cadet</div>
                </div>
              </div>
            </div>

            {/* Right Column (My Documents, Control Panel) */}
            <div style={{ width: '50%', background: '#d3e5fa', padding: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 'bold', color: '#0b3474', cursor: 'pointer' }}>
                📁 Mis documentos
              </div>
              <div style={{ fontSize: 11, fontWeight: 'bold', color: '#0b3474', cursor: 'pointer' }}>
                🖼️ Mis imágenes
              </div>
              <div style={{ fontSize: 11, fontWeight: 'bold', color: '#0b3474', cursor: 'pointer' }}>
                🎵 Mi música
              </div>
              <div style={{ width: '100%', height: 1, background: '#a0c0e8', margin: '4px 0' }} />
              <div style={{ fontSize: 11, color: '#0b3474', cursor: 'pointer' }}>
                ⚙️ Panel de control
              </div>
              <div style={{ fontSize: 11, color: '#0b3474', cursor: 'pointer' }}>
                🔍 Buscar archivos
              </div>
            </div>
          </div>

          {/* Footer with Turn Off Computer */}
          <div
            style={{
              height: 38,
              background: 'linear-gradient(to right, #428bf6 0%, #1562e8 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              padding: '0 12px',
              gap: 12
            }}
          >
            <button className="xp-btn" style={{ fontSize: 10 }}>
              🔒 Cerrar sesión
            </button>
            <button className="xp-btn" style={{ fontSize: 10, background: '#e83323', color: '#fff' }}>
              ⏻ Apagar equipo
            </button>
          </div>
        </div>
      )}

      {/* Windows XP Taskbar */}
      <div className="xp-taskbar">
        {/* Start Button */}
        <button
          className="xp-start-btn"
          onClick={(e) => {
            e.stopPropagation();
            setShowStartMenu(!showStartMenu);
          }}
        >
          {/* Windows 4-Color Flag */}
          <svg className="xp-windows-flag" viewBox="0 0 16 16">
            <path d="M1 2.5 L6.5 1.5 L6.5 7 L1 7 Z" fill="#E81123" />
            <path d="M7.5 1.3 L15 0 L15 7 L7.5 7 Z" fill="#00B0F0" />
            <path d="M1 8 L6.5 8 L6.5 13.5 L1 12.5 Z" fill="#00A4EF" />
            <path d="M7.5 8 L15 8 L15 15 L7.5 13.7 Z" fill="#7FBA00" />
          </svg>
          inicio
        </button>

        {/* Running Windows Taskbar Items */}
        <div className="xp-taskbar-tasks">
          {windows.map((win) => (
            <button
              key={win.id}
              className={`xp-taskbar-item ${activeWindowId === win.id && !win.isMinimized ? 'active' : ''}`}
              onClick={() => {
                if (win.isMinimized) {
                  onRestoreWindow(win.id);
                } else if (activeWindowId === win.id) {
                  win.onMinimize();
                } else {
                  onFocusWindow(win.id);
                }
              }}
            >
              <span>{win.icon || '🦋'}</span>
              <span>{win.title}</span>
            </button>
          ))}
        </div>

        {/* System Tray */}
        <div className="xp-systray">
          {/* MSN Twin Buddy Tray Icon */}
          <span
            className="xp-tray-icon"
            title="MSN Messenger 7.5 - Conectado"
            onClick={() => onRestoreWindow('contactList')}
          >
            🦋
          </span>
          <span className="xp-tray-icon" title="Volumen: 100%">
            🔊
          </span>
          <span style={{ fontWeight: 'bold', marginLeft: 4 }}>
            {currentTime}
          </span>
        </div>
      </div>
    </div>
  );
}
