import React, { useState, useEffect } from 'react';
import { RETRO_AVATARS, getAvatarSvg } from '../../services/avatars';
import { MSN_STATUSES } from '../../services/statusHelper';
import { initAudio, playLoginSound } from '../../services/soundEngine';

export default function LoginModal({ onLogin, initialRoomId }) {
  const [email, setEmail] = useState('retro_user2005@hotmail.com');
  const [nickname, setNickname] = useState('·#·$1·' + '★~[El_Chico_Retro]~★');
  const [password, setPassword] = useState('••••••••');
  const [status, setStatus] = useState('online');
  const [avatarIndex, setAvatarIndex] = useState(0);
  const [personalMessage, setPersonalMessage] = useState('(8) Linkin Park - In The End (8)');
  const [roomId, setRoomId] = useState(initialRoomId || 'sala-msn-nostalgia');
  const [rememberPass, setRememberPass] = useState(true);

  // Check URL query param for room
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const roomParam = urlParams.get('room');
    if (roomParam) {
      setRoomId(roomParam);
    }
  }, []);

  const currentAvatar = RETRO_AVATARS[avatarIndex];

  const handleNextAvatar = () => {
    setAvatarIndex((prev) => (prev + 1) % RETRO_AVATARS.length);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    initAudio();
    playLoginSound();
    onLogin({
      email,
      nickname,
      status,
      avatar: currentAvatar.id,
      personalMessage,
      roomId: roomId.trim() || 'sala-msn-nostalgia'
    });
  };

  return (
    <div className="xp-window focused" style={{ width: 360, margin: '80px auto', position: 'relative' }}>
      <div className="xp-window-titlebar">
        <div className="xp-window-title">
          <svg viewBox="0 0 16 16" width="14" height="14" style={{ verticalAlign: 'middle' }}>
            <circle cx="8" cy="8" r="7" fill="#0078D7"/>
            <path d="M4 8 C4 5 7 5 8 8 C9 5 12 5 12 8" stroke="#ffffff" stroke-width="1.5" fill="none"/>
          </svg>
          MSN Messenger - Iniciar sesión
        </div>
        <div className="xp-window-controls">
          <button className="xp-control-btn xp-btn-min">_</button>
          <button className="xp-control-btn xp-btn-close">✕</button>
        </div>
      </div>

      <div className="xp-window-body">
        {/* Banner with MSN Butterfly */}
        <div className="msn-login-banner">
          <div
            className="msn-butterfly-logo"
            dangerouslySetInnerHTML={{ __html: getAvatarSvg('butterfly') }}
          />
          <div className="msn-login-banner-text">
            <h2>MSN Messenger 7.5</h2>
            <p>.NET Passport • Windows XP Edition</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="msn-login-body">
          {/* Avatar Selector Box */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
            <div
              className="msn-avatar-box"
              style={{ width: 56, height: 56, cursor: 'pointer' }}
              onClick={handleNextAvatar}
              title="Haz clic para cambiar tu foto para mostrar"
              dangerouslySetInnerHTML={{ __html: currentAvatar.svg }}
            />
            <div>
              <div style={{ fontSize: 11, fontWeight: 'bold', color: '#0b3474' }}>
                Foto para mostrar:
              </div>
              <button
                type="button"
                className="xp-btn"
                style={{ fontSize: 10, marginTop: 3 }}
                onClick={handleNextAvatar}
              >
                Cambiar foto ({currentAvatar.name})
              </button>
            </div>
          </div>

          <div className="msn-form-group">
            <label>Dirección de correo electrónico:</label>
            <input
              type="text"
              className="xp-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ejemplo@hotmail.com"
              required
            />
          </div>

          <div className="msn-form-group">
            <label>Nombre para mostrar (Nick):</label>
            <input
              type="text"
              className="xp-input"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="Tu apodo nostálgico..."
              required
            />
          </div>

          <div className="msn-form-group">
            <label>Mensaje personal / Lo que estoy escuchando:</label>
            <input
              type="text"
              className="xp-input"
              value={personalMessage}
              onChange={(e) => setPersonalMessage(e.target.value)}
              placeholder="(8) Canción o estado..."
            />
          </div>

          <div className="msn-form-group">
            <label>Contraseña:</label>
            <input
              type="password"
              className="xp-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <div className="msn-form-group">
            <label>Estado de inicio:</label>
            <select
              className="xp-input"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              style={{ background: '#fff' }}
            >
              {Object.values(MSN_STATUSES).map((st) => (
                <option key={st.id} value={st.id}>
                  {st.label}
                </option>
              ))}
            </select>
          </div>

          <div className="msn-form-group" style={{ marginTop: 2 }}>
            <label style={{ color: '#0055ea', fontWeight: 'bold' }}>
              Código / Sala de amigos:
            </label>
            <input
              type="text"
              className="xp-input"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              placeholder="sala-msn-nostalgia"
              required
            />
            <span style={{ fontSize: 9, color: '#666' }}>
              Comparte este mismo código con tus amigos para chatear en la misma sala.
            </span>
          </div>

          <div className="msn-login-checkboxes">
            <label>
              <input
                type="checkbox"
                checked={rememberPass}
                onChange={(e) => setRememberPass(e.target.checked)}
              />
              Recordar mi contraseña en este equipo
            </label>
            <label>
              <input type="checkbox" defaultChecked />
              Iniciar sesión automáticamente
            </label>
          </div>

          <div className="msn-login-actions">
            <button type="submit" className="xp-btn xp-btn-primary" style={{ minWidth: 100 }}>
              Iniciar sesión
            </button>
            <button type="button" className="xp-btn">
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
