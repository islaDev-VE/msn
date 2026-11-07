import React, { useState } from 'react';
import { getAvatarSvg, RETRO_AVATARS } from '../../services/avatars';
import { MSN_STATUSES } from '../../services/statusHelper';
import { parseTextWithEmoticons } from '../../services/emoticons';

export default function ContactListWindow({
  profile,
  onUpdateProfile,
  roomUsers,
  roomId,
  onOpenChat,
  onOpenInvite,
  onMinimize,
  onClose,
  isFocused,
  onFocus
}) {
  const [activeTab, setActiveTab] = useState('contacts');
  const [onlineCollapsed, setOnlineCollapsed] = useState(false);
  const [offlineCollapsed, setOfflineCollapsed] = useState(false);
  const [filterQuery, setFilterQuery] = useState('');
  const [editingNick, setEditingNick] = useState(false);
  const [nickValue, setNickValue] = useState(profile.nickname);
  const [msgValue, setMsgValue] = useState(profile.personalMessage);

  // Filter out self from buddy list
  const otherUsers = roomUsers.filter((u) => u.socketId !== profile.socketId);

  // Nostalgic offline buddies for authentic 2005 feel
  const offlineBuddies = [
    {
      id: 'off-1',
      nickname: '★_lA_cHiCa_EmO_2005_★',
      email: 'dark_fairy@hotmail.com',
      status: 'offline',
      personalMessage: '(8) My Chemical Romance - Helena (8)',
      avatar: 'guitar'
    },
    {
      id: 'off-2',
      nickname: '[xX_ProGamer_CS16_Xx]',
      email: 'sniper_elite@msn.com',
      status: 'offline',
      personalMessage: 'Jugando dust2 no molestar',
      avatar: 'soccer'
    },
    {
      id: 'off-3',
      nickname: '·#·$4♫ Solecito ♫·$',
      email: 'mariposa_sol@hotmail.com',
      status: 'offline',
      personalMessage: 'vuelvo en un rato :P',
      avatar: 'palm'
    }
  ];

  const handleAvatarClick = () => {
    const currentIndex = RETRO_AVATARS.findIndex((a) => a.id === profile.avatar);
    const nextIndex = (currentIndex + 1) % RETRO_AVATARS.length;
    onUpdateProfile({ avatar: RETRO_AVATARS[nextIndex].id });
  };

  const handleStatusChange = (e) => {
    onUpdateProfile({ status: e.target.value });
  };

  const handleNickBlur = () => {
    setEditingNick(false);
    if (nickValue.trim()) {
      onUpdateProfile({ nickname: nickValue.trim() });
    } else {
      setNickValue(profile.nickname);
    }
  };

  const handleMsgBlur = () => {
    onUpdateProfile({ personalMessage: msgValue });
  };

  const renderParsed = (text) => {
    const parts = parseTextWithEmoticons(text || '');
    return parts.map((p, idx) => {
      if (p.type === 'emoticon') {
        return (
          <span key={idx} style={{ fontSize: 13, verticalAlign: 'middle', margin: '0 1px' }}>
            {p.data.render}
          </span>
        );
      }
      return <span key={idx}>{p.value}</span>;
    });
  };

  return (
    <div
      className={`xp-window ${isFocused ? 'focused' : 'inactive'}`}
      style={{
        width: 310,
        height: 540,
        top: 20,
        left: 30,
        zIndex: isFocused ? 200 : 100
      }}
      onClick={onFocus}
    >
      {/* Titlebar */}
      <div className="xp-window-titlebar">
        <div className="xp-window-title">
          <svg viewBox="0 0 16 16" width="14" height="14" style={{ verticalAlign: 'middle' }}>
            <circle cx="8" cy="8" r="7" fill="#0078D7"/>
            <path d="M4 8 C4 5 7 5 8 8 C9 5 12 5 12 8" stroke="#ffffff" stroke-width="1.5" fill="none"/>
          </svg>
          MSN Messenger - {profile.nickname}
        </div>
        <div className="xp-window-controls">
          <button className="xp-control-btn xp-btn-min" onClick={onMinimize}>
            _
          </button>
          <button className="xp-control-btn xp-btn-close" onClick={onClose}>
            ✕
          </button>
        </div>
      </div>

      {/* Menubar */}
      <div className="xp-menubar">
        <div className="xp-menu-item">Archivo</div>
        <div className="xp-menu-item" onClick={onOpenInvite}>Contactos</div>
        <div className="xp-menu-item">Acciones</div>
        <div className="xp-menu-item">Herramientas</div>
        <div className="xp-menu-item">Ayuda</div>
      </div>

      {/* Body with Tabs and Content */}
      <div className="xp-window-body" style={{ flexDirection: 'row' }}>
        {/* Left Tab Strip */}
        <div className="msn-tab-strip">
          <button
            className={`msn-tab-btn ${activeTab === 'contacts' ? 'active' : ''}`}
            title="Contactos de Messenger"
            onClick={() => setActiveTab('contacts')}
          >
            👥
          </button>
          <button
            className={`msn-tab-btn ${activeTab === 'today' ? 'active' : ''}`}
            title="MSN Hoy y Noticias"
            onClick={() => setActiveTab('today')}
          >
            📰
          </button>
          <button
            className={`msn-tab-btn ${activeTab === 'mobile' ? 'active' : ''}`}
            title="Messenger Móvil"
            onClick={() => setActiveTab('mobile')}
          >
            📱
          </button>
          <button
            className={`msn-tab-btn ${activeTab === 'games' ? 'active' : ''}`}
            title="Juegos MSN"
            onClick={() => setActiveTab('games')}
          >
            🎮
          </button>
        </div>

        {/* Main Content Area */}
        <div className="msn-main-content">
          {/* User Profile Card */}
          <div className="msn-user-card">
            <div
              className="msn-avatar-box"
              onClick={handleAvatarClick}
              title="Haz clic para cambiar tu foto para mostrar"
              dangerouslySetInnerHTML={{ __html: getAvatarSvg(profile.avatar) }}
            />
            <div className="msn-user-info">
              <div className="msn-nickname-row">
                <input
                  type="text"
                  className="msn-nickname-input"
                  value={nickValue}
                  onChange={(e) => setNickValue(e.target.value)}
                  onBlur={handleNickBlur}
                  onKeyDown={(e) => e.key === 'Enter' && handleNickBlur()}
                  title="Haz clic para editar tu apodo"
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span
                  dangerouslySetInnerHTML={{
                    __html: MSN_STATUSES[profile.status]?.iconSvg || MSN_STATUSES.online.iconSvg
                  }}
                />
                <select
                  className="msn-status-dropdown"
                  value={profile.status}
                  onChange={handleStatusChange}
                >
                  {Object.values(MSN_STATUSES).map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.label}
                    </option>
                  ))}
                </select>
              </div>

              <input
                type="text"
                className="msn-personal-msg-input"
                value={msgValue}
                onChange={(e) => setMsgValue(e.target.value)}
                onBlur={handleMsgBlur}
                onKeyDown={(e) => e.key === 'Enter' && handleMsgBlur()}
                placeholder="Escribe un mensaje personal o canción..."
                title="Mensaje personal / Lo que estoy escuchando"
              />
            </div>
          </div>

          {/* Quick Bar: Room & Invite Button */}
          <div className="msn-quick-bar">
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, overflow: 'hidden' }}>
              <span style={{ fontSize: 9, color: '#444' }}>Sala:</span>
              <span className="msn-room-badge">{roomId}</span>
            </div>
            <button className="msn-invite-btn" onClick={onOpenInvite}>
              + Invitar amigo
            </button>
          </div>

          {/* Contact Search Bar */}
          <div style={{ padding: '3px 8px', background: '#fff', borderBottom: '1px solid #e1e7f0' }}>
            <input
              type="text"
              className="xp-input"
              style={{ width: '100%', fontSize: 10, padding: '2px 4px' }}
              placeholder="Buscar un contacto..."
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
            />
          </div>

          {/* Buddy List Accordion */}
          <div className="msn-buddy-list">
            {/* ONLINE GROUP */}
            <div
              className="msn-group-header"
              onClick={() => setOnlineCollapsed(!onlineCollapsed)}
            >
              <span className={`msn-group-arrow ${onlineCollapsed ? 'collapsed' : ''}`}>
                ▼
              </span>
              <span>Conectados ({otherUsers.length})</span>
            </div>

            {!onlineCollapsed && (
              <div>
                {otherUsers.length === 0 ? (
                  <div
                    style={{
                      padding: '12px 16px',
                      color: '#777',
                      fontSize: 10,
                      fontStyle: 'italic',
                      lineHeight: 1.4,
                      textAlign: 'center'
                    }}
                  >
                    No hay amigos conectados en esta sala aún.<br/>
                    <button
                      className="xp-btn xp-btn-primary"
                      style={{ marginTop: 6, fontSize: 10 }}
                      onClick={onOpenInvite}
                    >
                      Copiar enlace e invitar
                    </button>
                  </div>
                ) : (
                  otherUsers
                    .filter((u) =>
                      u.nickname.toLowerCase().includes(filterQuery.toLowerCase()) ||
                      u.email.toLowerCase().includes(filterQuery.toLowerCase())
                    )
                    .map((user) => (
                      <div
                        key={user.socketId || user.id}
                        className="msn-buddy-item"
                        onDoubleClick={() => onOpenChat(user)}
                        title="Doble clic para iniciar conversación"
                      >
                        <span
                          className="msn-buddy-pawn"
                          dangerouslySetInnerHTML={{
                            __html: MSN_STATUSES[user.status]?.iconSvg || MSN_STATUSES.online.iconSvg
                          }}
                        />
                        <div className="msn-buddy-info">
                          <div className="msn-buddy-nickname">
                            {renderParsed(user.nickname)}
                          </div>
                          {user.personalMessage && (
                            <div className="msn-buddy-msg">
                              {renderParsed(user.personalMessage)}
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                )}
              </div>
            )}

            {/* OFFLINE GROUP */}
            <div
              className="msn-group-header"
              onClick={() => setOfflineCollapsed(!offlineCollapsed)}
            >
              <span className={`msn-group-arrow ${offlineCollapsed ? 'collapsed' : ''}`}>
                ▼
              </span>
              <span>No conectados ({offlineBuddies.length})</span>
            </div>

            {!offlineCollapsed && (
              <div>
                {offlineBuddies
                  .filter((b) =>
                    b.nickname.toLowerCase().includes(filterQuery.toLowerCase())
                  )
                  .map((b) => (
                    <div
                      key={b.id}
                      className="msn-buddy-item offline"
                      onDoubleClick={() => onOpenChat(b)}
                      title="Contacto no conectado (Doble clic para dejar mensaje)"
                    >
                      <span
                        className="msn-buddy-pawn"
                        dangerouslySetInnerHTML={{ __html: MSN_STATUSES.offline.iconSvg }}
                      />
                      <div className="msn-buddy-info">
                        <div className="msn-buddy-nickname">
                          {renderParsed(b.nickname)}
                        </div>
                        <div className="msn-buddy-msg">
                          {renderParsed(b.personalMessage)}
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>

          {/* Bottom MSN Hoy Ads */}
          <div className="msn-bottom-ad" onClick={() => setActiveTab('today')}>
            <span className="msn-ad-logo">MSN Hoy</span>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'now' }}>
              ¡Descubre los nuevos guiños y emoticonos animados de Messenger!
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
