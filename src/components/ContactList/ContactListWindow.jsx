import React, { useState, useEffect } from 'react';
import DraggableWindow from '../Common/DraggableWindow';
import ZumbidoLogo from '../Common/ZumbidoLogo';
import { AvatarView } from '../../services/avatars';
import { USER_STATUSES, formatLastSeen } from '../../services/statusHelper';
import { renderFormattedText, stripPlusTags } from '../../services/plusFormatter';

const DEFAULT_GROUPS = ['Amigos', 'Familia', 'Trabajo'];

export default function ContactListWindow({
  profile,
  onUpdateProfile,
  friends = [],
  incomingRequests = [],
  onOpenChat,
  onOpenAddFriend,
  onOpenInvite,
  onOpenProfileModal,
  onOpenAbout,
  onMoveFriendGroup,
  onToggleBlockFriend,
  onRemoveFriend,
  onInstallPwa,
  canInstallPwa,
  notificationPermission,
  onRequestNotifications,
  pushStatus = { supported: false, permission: 'default', subscribed: false, needsIosInstall: false },
  pushBusy = false,
  pushMessage = '',
  onTestPush,
  onCheckAppUpdate,
  appUpdateAvailable = false,
  onLogout,
  onMinimize,
  isFocused,
  zIndex,
  onFocus,
  isMobile,
  mobileSection = 'contacts' // 'contacts' | 'chats' | 'profile'
}) {
  const [filterQuery, setFilterQuery] = useState('');
  const [groupMode, setGroupMode] = useState('status'); // 'status' | 'group'
  const [collapsedGroups, setCollapsedGroups] = useState({});
  const [msgValue, setMsgValue] = useState(profile.personalMessage || '');
  const [openMenuFriendId, setOpenMenuFriendId] = useState(null);

  useEffect(() => {
    setMsgValue(profile.personalMessage || '');
  }, [profile.personalMessage]);

  useEffect(() => {
    const closeMenu = () => setOpenMenuFriendId(null);
    window.addEventListener('click', closeMenu);
    return () => window.removeEventListener('click', closeMenu);
  }, []);

  const toggleGroup = (key) => {
    setCollapsedGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleStatusChange = (e) => {
    onUpdateProfile({ status: e.target.value });
  };

  const handleMsgSave = () => {
    if (msgValue !== profile.personalMessage) {
      onUpdateProfile({ personalMessage: msgValue });
    }
  };

  const filteredFriends = friends.filter((f) => {
    const q = filterQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      stripPlusTags(f.nickname).toLowerCase().includes(q) ||
      f.email.toLowerCase().includes(q) ||
      (f.groupName || '').toLowerCase().includes(q)
    );
  });

  // Group contacts either by Online/Offline or by Custom Groups
  const groupedSections = (() => {
    if (groupMode === 'group') {
      const map = new Map();
      filteredFriends.forEach((f) => {
        const g = f.groupName || 'Amigos';
        if (!map.has(g)) map.set(g, []);
        map.get(g).push(f);
      });
      return Array.from(map.entries()).map(([label, list]) => ({
        key: `grp-${label}`,
        label: `${label} (${list.filter((x) => x.isOnline).length}/${list.length})`,
        items: list
      }));
    }

    const online = filteredFriends.filter((f) => f.isOnline && !f.isBlocked);
    const offline = filteredFriends.filter((f) => !f.isOnline || f.isBlocked);
    return [
      { key: 'online', label: `Conectados (${online.length})`, items: online },
      { key: 'offline', label: `Sin conexión (${offline.length})`, items: offline }
    ];
  })();

  const handleGroupPrompt = (friend) => {
    setOpenMenuFriendId(null);
    const next = window.prompt(
      `Escribe el nombre del grupo para ${stripPlusTags(friend.nickname)} (ej. ${DEFAULT_GROUPS.join(', ')}):`,
      friend.groupName || 'Amigos'
    );
    if (next && next.trim()) {
      onMoveFriendGroup(friend.id, next.trim());
    }
  };

  const handleDeleteConfirm = (friend) => {
    setOpenMenuFriendId(null);
    if (window.confirm(`¿Eliminar a ${stripPlusTags(friend.nickname)} de tu lista de contactos?`)) {
      onRemoveFriend(friend.id);
    }
  };

  const renderFriendRow = (friend) => (
    <div
      key={friend.id}
      className={`z05-buddy-item ${friend.isOnline ? '' : 'offline'} ${friend.isBlocked ? 'blocked' : ''}`}
      onDoubleClick={() => onOpenChat(friend)}
      onClick={() => {
        if (isMobile) onOpenChat(friend);
      }}
      title={isMobile ? 'Toca para chatear' : 'Doble clic para iniciar conversación'}
    >
      <div className="z05-buddy-mini-avatar">
        <AvatarView avatar={friend.avatar} alt={stripPlusTags(friend.nickname)} />
        <div
          className="z05-buddy-status-dot"
          dangerouslySetInnerHTML={{
            __html: USER_STATUSES[friend.status]?.iconSvg || USER_STATUSES.offline.iconSvg
          }}
        />
      </div>

      <div className="z05-buddy-info">
        <div className="z05-buddy-nickname">
          {renderFormattedText(friend.nickname, `buddy-${friend.id}`)}
          {friend.isBlocked && (
            <span style={{ marginLeft: 5, fontSize: 10, color: '#c62828' }}>[Bloqueado]</span>
          )}
        </div>
        <div className="z05-buddy-msg">
          {friend.isOnline
            ? (friend.personalMessage
                ? renderFormattedText(friend.personalMessage, `msg-${friend.id}`)
                : `${USER_STATUSES[friend.status]?.label || 'Conectado'} • ${friend.groupName}`)
            : `${formatLastSeen(friend.lastSeen)} • ${friend.groupName}`}
        </div>
      </div>

      <div className="z05-buddy-actions" onClick={(e) => e.stopPropagation()}>
        {friend.unreadCount > 0 && (
          <span className="z05-pill-badge">{friend.unreadCount}</span>
        )}
        <button
          type="button"
          className="z05-buddy-menu-btn"
          title="Opciones de contacto"
          onClick={(e) => {
            e.stopPropagation();
            setOpenMenuFriendId((prev) => (prev === friend.id ? null : friend.id));
          }}
        >
          ⋮
        </button>
      </div>

      {openMenuFriendId === friend.id && (
        <div className="z05-contact-context" onClick={(e) => e.stopPropagation()}>
          <div
            className="z05-context-item"
            onClick={() => {
              setOpenMenuFriendId(null);
              onOpenChat(friend);
            }}
          >
            💬 Enviar mensaje
          </div>
          <div className="z05-context-item" onClick={() => handleGroupPrompt(friend)}>
            📁 Mover de grupo ({friend.groupName})
          </div>
          <div
            className="z05-context-item"
            onClick={() => {
              setOpenMenuFriendId(null);
              onToggleBlockFriend(friend.id, !friend.isBlocked);
            }}
          >
            {friend.isBlocked ? '🔓 Desbloquear contacto' : '🚫 Bloquear contacto'}
          </div>
          <div className="z05-context-item danger" onClick={() => handleDeleteConfirm(friend)}>
            🗑️ Eliminar contacto
          </div>
        </div>
      )}
    </div>
  );

  // Mobile Profile tab view
  const renderMobileProfileView = () => (
    <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 11, overflowY: 'auto', flex: 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div className="z05-avatar-box" style={{ width: 64, height: 64 }} onClick={onOpenProfileModal}>
          <AvatarView avatar={profile.avatar} alt={stripPlusTags(profile.nickname)} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 'bold', fontSize: 15, color: '#0b3474' }}>
            {renderFormattedText(profile.nickname, 'mob-prof')}
          </div>
          <div style={{ fontSize: 12, color: '#555' }}>{profile.email}</div>
        </div>
      </div>

      <button type="button" className="c05-btn c05-btn-primary" style={{ padding: '10px 14px' }} onClick={onOpenProfileModal}>
        🖼️ Cambiar foto real, apodo y canción (8)
      </button>

      {/* Background Push Notifications Card */}
      <div className="z05-invite-box" style={{ gap: 7 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
          <strong style={{ fontSize: 12, color: '#0b3474' }}>🔔 Notificaciones con pantalla apagada</strong>
          <span
            style={{
              fontSize: 10,
              fontWeight: 'bold',
              padding: '2px 7px',
              borderRadius: 10,
              background: pushStatus.subscribed ? '#dcfce7' : '#fef3c7',
              color: pushStatus.subscribed ? '#166534' : '#92400e'
            }}
          >
            {pushStatus.subscribed ? 'Activas ✓' : 'Inactivas'}
          </span>
        </div>

        <div style={{ fontSize: 11, color: '#455a75', lineHeight: 1.4 }}>
          Recibe mensajes, zumbidos y solicitudes en tu teléfono aunque bloquees la pantalla o cierres la app.
        </div>

        {pushStatus.needsIosInstall && (
          <div className="z05-invite-callout" style={{ fontSize: 10 }}>
            En iPhone/iPad: abre en Safari, toca <strong>Compartir → Añadir a pantalla de inicio</strong> y entra desde ese ícono para activar notificaciones Push.
          </div>
        )}

        {pushMessage && (
          <div
            className={pushMessage.startsWith('⚠️') ? 'z05-alert-error' : 'z05-alert-success'}
            style={{ fontSize: 11 }}
          >
            {pushMessage}
          </div>
        )}

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {!pushStatus.subscribed ? (
            <button
              type="button"
              className="c05-btn c05-btn-primary"
              style={{ flex: 1, padding: '8px 10px' }}
              disabled={pushBusy}
              onClick={onRequestNotifications}
            >
              {pushBusy ? 'Activando...' : '🔔 Activar notificaciones Push'}
            </button>
          ) : (
            <button
              type="button"
              className="c05-btn"
              style={{ flex: 1, padding: '8px 10px' }}
              disabled={pushBusy}
              onClick={onTestPush}
            >
              {pushBusy ? 'Enviando...' : '🧪 Probar notificación en mi celular'}
            </button>
          )}
        </div>
      </div>

      {canInstallPwa && (
        <button type="button" className="c05-btn c05-btn-primary" style={{ padding: '10px 14px' }} onClick={onInstallPwa}>
          📲 Instalar Zumbido 05 en tu dispositivo
        </button>
      )}

      {/* Developer Card — islaDev (Mobile) */}
      <div
        style={{
          background: 'linear-gradient(135deg, #0f172a 0%, #162640 100%)',
          border: '1px solid #0891b2',
          borderRadius: 6,
          padding: 10,
          color: '#e2e8f0',
          display: 'flex',
          alignItems: 'center',
          gap: 10
        }}
      >
        <img
          src="/icons/isladev-icon.png"
          alt="islaDev"
          style={{ width: 42, height: 42, borderRadius: 8, border: '1px solid rgba(125,211,252,0.7)', flexShrink: 0 }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 'bold', color: '#fff' }}>Desarrollado por islaDev</div>
          <div style={{ fontSize: 10, color: '#cbd5e1' }}>Isla de Margarita, Venezuela 🌴</div>
        </div>
        <a
          href="https://isladev.com"
          target="_blank"
          rel="noopener noreferrer"
          className="c05-btn c05-btn-primary"
          style={{ textDecoration: 'none', fontSize: 11, padding: '5px 8px', whiteSpace: 'nowrap' }}
        >
          🌐 isladev.com
        </a>
      </div>

      <button
        type="button"
        className={`c05-btn ${appUpdateAvailable ? 'c05-btn-primary' : ''}`}
        style={{ padding: '10px 14px' }}
        onClick={onCheckAppUpdate}
      >
        {appUpdateAvailable ? '✨ Actualizar a la nueva versión ahora' : '🔄 Buscar actualización de la app'}
      </button>

      <button type="button" className="c05-btn" style={{ padding: '10px 14px' }} onClick={onOpenAbout}>
        ℹ️ Desarrollador y Acerca de Zumbido 05
      </button>

      <button type="button" className="c05-btn c05-btn-danger" style={{ padding: '10px 14px' }} onClick={onLogout}>
        🚪 Cerrar sesión
      </button>
    </div>
  );

  // Mobile Recent/Unread Chats tab view
  const renderMobileChatsView = () => {
    const sorted = [...friends].sort((a, b) => (b.unreadCount - a.unreadCount) || (Number(b.isOnline) - Number(a.isOnline)));
    return (
      <div className="z05-buddy-list">
        <div className="z05-group-header">💬 Conversaciones ({sorted.length})</div>
        {sorted.length === 0 ? (
          <div style={{ padding: 20, textAlign: 'center', color: '#666' }}>
            Agrega amigos por su correo para empezar a chatear.
          </div>
        ) : (
          sorted.map(renderFriendRow)
        )}
      </div>
    );
  };

  return (
    <DraggableWindow
      title={`Zumbido 05 — ${stripPlusTags(profile.nickname)}`}
      titleIcon={<ZumbidoLogo size={16} />}
      initialX={28}
      initialY={22}
      width={325}
      height={560}
      zIndex={zIndex}
      isFocused={isFocused}
      isMobile={isMobile}
      onFocus={onFocus}
      onMinimize={onMinimize}
      onClose={onLogout}
    >
      {/* Classic Menubar (Desktop) */}
      <div className="c05-menubar">
        <div className="c05-menu-item" onClick={onLogout}>Sesión</div>
        <div className="c05-menu-item" onClick={onOpenAddFriend}>Contactos</div>
        <div className="c05-menu-item" onClick={onOpenProfileModal}>Perfil</div>
        <div
          className="c05-menu-item"
          onClick={() => setGroupMode((m) => (m === 'status' ? 'group' : 'status'))}
        >
          Ver: {groupMode === 'status' ? 'Estado' : 'Grupos'}
        </div>
        <div className="c05-menu-item" onClick={onOpenAbout}>Ayuda</div>
      </div>

      <div className="z05-main-layout">
        {/* Left Vertical Tab Strip (Desktop) */}
        <div className="z05-tab-strip">
          <button
            type="button"
            className={`z05-tab-btn ${groupMode === 'status' ? 'active' : ''}`}
            title="Contactos por estado"
            onClick={() => setGroupMode('status')}
          >
            👥
          </button>
          <button
            type="button"
            className={`z05-tab-btn ${groupMode === 'group' ? 'active' : ''}`}
            title="Organizar por grupos personalizados"
            onClick={() => setGroupMode('group')}
          >
            📁
          </button>
          <button
            type="button"
            className="z05-tab-btn"
            title="Cambiar foto real y Colores Plus"
            onClick={onOpenProfileModal}
          >
            🖼️
          </button>
          <button
            type="button"
            className="z05-tab-btn"
            title="Acerca de Zumbido 05"
            onClick={onOpenAbout}
          >
            ℹ️
          </button>
        </div>

        <div className="z05-main-content">
          {isMobile && mobileSection === 'profile' ? (
            renderMobileProfileView()
          ) : isMobile && mobileSection === 'chats' ? (
            renderMobileChatsView()
          ) : (
            <>
              {/* User Card */}
              <div className="z05-user-card">
                <div
                  className="z05-avatar-box"
                  onClick={onOpenProfileModal}
                  title="Haz clic para cambiar tu foto real o apodo"
                >
                  <AvatarView avatar={profile.avatar} alt={stripPlusTags(profile.nickname)} />
                  <div className="z05-avatar-edit-hint">Editar</div>
                </div>

                <div className="z05-user-info">
                  <div
                    className="z05-user-nick-display"
                    onClick={onOpenProfileModal}
                    title="Editar apodo y Colores Plus"
                  >
                    {renderFormattedText(profile.nickname, 'my-nick')}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span
                      dangerouslySetInnerHTML={{
                        __html: USER_STATUSES[profile.status]?.iconSvg || USER_STATUSES.online.iconSvg
                      }}
                    />
                    <select
                      className="z05-status-select"
                      value={profile.status}
                      onChange={handleStatusChange}
                    >
                      {Object.values(USER_STATUSES).map((st) => (
                        <option key={st.id} value={st.id}>
                          {st.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <input
                    type="text"
                    className="z05-personal-msg-input"
                    value={msgValue}
                    onChange={(e) => setMsgValue(e.target.value)}
                    onBlur={handleMsgSave}
                    onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                    placeholder="Escribe un mensaje personal o canción (8)..."
                  />
                </div>
              </div>

              {/* Quick Actions Bar */}
              <div className="z05-quick-bar">
                <div style={{ display: 'flex', gap: 4 }}>
                  <button type="button" className="z05-quick-btn" onClick={onOpenAddFriend}>
                    <span>➕ Agregar</span>
                    {incomingRequests.length > 0 && (
                      <span className="z05-pill-badge">{incomingRequests.length}</span>
                    )}
                  </button>
                  <button
                    type="button"
                    className="z05-quick-btn"
                    onClick={onOpenInvite}
                    title="Invitar a personas que aún no tienen cuenta en Zumbido 05"
                  >
                    <span>✉️ Invitar</span>
                  </button>
                </div>

                <div style={{ display: 'flex', gap: 4 }}>
                  <button
                    type="button"
                    className="z05-quick-btn"
                    onClick={() => setGroupMode((m) => (m === 'status' ? 'group' : 'status'))}
                    title="Alternar vista por Estado o por Grupos"
                  >
                    {groupMode === 'status' ? '📁 Grupos' : '🟢 Estado'}
                  </button>
                  {canInstallPwa && (
                    <button type="button" className="z05-quick-btn" onClick={onInstallPwa}>
                      📲 Instalar
                    </button>
                  )}
                </div>
              </div>

              {/* Search Bar */}
              <div style={{ padding: '4px 8px', background: '#fff', borderBottom: '1px solid #e1e7f0' }}>
                <input
                  type="text"
                  className="c05-input"
                  style={{ width: '100%', fontSize: 11, padding: '3px 6px' }}
                  placeholder="Buscar contacto por apodo, correo o grupo..."
                  value={filterQuery}
                  onChange={(e) => setFilterQuery(e.target.value)}
                />
              </div>

              {/* Buddy List Accordion */}
              <div className="z05-buddy-list">
                {friends.length === 0 ? (
                  <div style={{ padding: '20px 14px', textAlign: 'center', color: '#555', lineHeight: 1.5 }}>
                    <div style={{ fontSize: 28, marginBottom: 6 }}>👥</div>
                    <strong>Aún no tienes contactos en tu lista.</strong>
                    <div style={{ fontSize: 11, marginTop: 4 }}>
                      Agrega a un amigo por su correo o envíale un enlace mágico de invitación si aún no tiene cuenta.
                    </div>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap', marginTop: 10 }}>
                      <button
                        type="button"
                        className="c05-btn c05-btn-primary"
                        onClick={onOpenAddFriend}
                      >
                        ➕ Agregar amigo
                      </button>
                      <button
                        type="button"
                        className="c05-btn"
                        onClick={onOpenInvite}
                      >
                        ✉️ Invitar amigos
                      </button>
                    </div>
                  </div>
                ) : (
                  groupedSections.map((sec) => {
                    const isCol = Boolean(collapsedGroups[sec.key]);
                    return (
                      <div key={sec.key}>
                        <div className="z05-group-header" onClick={() => toggleGroup(sec.key)}>
                          <span className={`z05-group-arrow ${isCol ? 'collapsed' : ''}`}>▼</span>
                          <span>{sec.label}</span>
                        </div>
                        {!isCol && sec.items.map(renderFriendRow)}
                      </div>
                    );
                  })
                )}
              </div>

              {/* Bottom Novedades 05 Bar */}
              <div className="z05-bottom-banner">
                <span>
                  <strong style={{ color: '#0055ea' }}>Zumbido 05</strong> por{' '}
                  <a
                    href="https://isladev.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: '#0891b2', fontWeight: 'bold', textDecoration: 'none' }}
                  >
                    islaDev
                  </a>
                </span>
                {(!pushStatus.subscribed && (pushStatus.supported || notificationPermission !== 'granted')) && (
                  <button
                    type="button"
                    className="c05-btn"
                    style={{ fontSize: 10, padding: '1px 6px' }}
                    disabled={pushBusy}
                    onClick={onRequestNotifications}
                  >
                    {pushBusy ? '...' : '🔔 Avisos Push'}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </DraggableWindow>
  );
}
