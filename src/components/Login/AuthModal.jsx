import React, { useState, useRef } from 'react';
import ZumbidoLogo from '../Common/ZumbidoLogo';
import DraggableWindow from '../Common/DraggableWindow';
import { RETRO_AVATARS, AvatarView } from '../../services/avatars';
import { USER_STATUSES } from '../../services/statusHelper';
import { compressAvatar } from '../../services/imageProcessor';
import { api } from '../../services/api';
import { initAudio, playLoginSound } from '../../services/soundEngine';

export default function AuthModal({ onAuthenticated, onOpenAbout, isMobile }) {
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [personalMessage, setPersonalMessage] = useState('(8) Linkin Park - In The End (8)');
  const [status, setStatus] = useState('online');
  const [avatar, setAvatar] = useState('bubbles');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const fileInputRef = useRef(null);

  const cycleRetroAvatar = () => {
    const idx = RETRO_AVATARS.findIndex((a) => a.id === avatar);
    const next = RETRO_AVATARS[(idx + 1) % RETRO_AVATARS.length];
    setAvatar(next.id);
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    try {
      const compressed = await compressAvatar(file, 256);
      setAvatar(compressed);
    } catch (err) {
      setError(err.message || 'No se pudo procesar la foto.');
    } finally {
      e.target.value = '';
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    initAudio();

    try {
      let res;
      if (mode === 'register') {
        res = await api.register({
          email,
          password,
          nickname: nickname.trim() || email.split('@')[0],
          personalMessage,
          avatar,
          status
        });
      } else {
        res = await api.login({ email, password, status });
      }
      playLoginSound();
      onAuthenticated(res.token, res.user);
    } catch (err) {
      setError(err.message || 'No se pudo completar la operación.');
    } finally {
      setLoading(false);
    }
  };

  const initialX = typeof window !== 'undefined' ? Math.max(20, Math.floor((window.innerWidth - 380) / 2)) : 120;
  const initialY = typeof window !== 'undefined' ? Math.max(20, Math.floor((window.innerHeight - 540) / 2)) : 50;

  return (
    <DraggableWindow
      title={mode === 'login' ? 'Zumbido 05 — Iniciar sesión' : 'Zumbido 05 — Crear cuenta'}
      titleIcon={<ZumbidoLogo size={16} />}
      initialX={initialX}
      initialY={initialY}
      width={385}
      height="auto"
      zIndex={400}
      isFocused={true}
      isMobile={isMobile}
      mobileChatMode={true}
      hideMinimize={true}
      hideClose={true}
    >
      <div className="z05-login-banner">
        <ZumbidoLogo size={46} />
        <div className="z05-login-banner-text">
          <h2>Zumbido 05</h2>
          <p>Cuenta Zumbido ID • Edición Retro 7.5</p>
        </div>
      </div>

      <div className="z05-auth-tabs">
        <button
          type="button"
          className={`z05-auth-tab ${mode === 'login' ? 'active' : ''}`}
          onClick={() => {
            setMode('login');
            setError('');
          }}
        >
          Iniciar sesión
        </button>
        <button
          type="button"
          className={`z05-auth-tab ${mode === 'register' ? 'active' : ''}`}
          onClick={() => {
            setMode('register');
            setError('');
          }}
        >
          Crear cuenta nueva
        </button>
      </div>

      <form onSubmit={handleSubmit} className="z05-login-body">
        {error && <div className="z05-alert-error">⚠️ {error}</div>}

        {mode === 'register' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              className="z05-avatar-box"
              style={{ width: 60, height: 60 }}
              onClick={() => fileInputRef.current?.click()}
              title="Subir tu foto real"
            >
              <AvatarView avatar={avatar} alt="Avatar seleccionado" />
              <div className="z05-avatar-edit-hint">Foto</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5, flex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 'bold', color: '#0b3474' }}>
                Foto de perfil (real o retro):
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="c05-btn"
                  onClick={() => fileInputRef.current?.click()}
                >
                  📷 Subir foto real
                </button>
                <button type="button" className="c05-btn" onClick={cycleRetroAvatar}>
                  🎲 Avatar retro
                </button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={handleFileChange}
              />
            </div>
          </div>
        )}

        <div className="z05-form-group">
          <label>Dirección de correo electrónico:</label>
          <input
            type="email"
            className="c05-input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tu_nombre@ejemplo.com"
            autoComplete="email"
            required
          />
        </div>

        <div className="z05-form-group">
          <label>Contraseña:</label>
          <input
            type="password"
            className="c05-input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={mode === 'register' ? 'Mínimo 6 caracteres' : 'Tu contraseña'}
            autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
            minLength={6}
            required
          />
        </div>

        {mode === 'register' && (
          <>
            <div className="z05-form-group">
              <label>Nombre para mostrar (soporta Colores Plus como [c=#0055ea]Nick[/c]):</label>
              <input
                type="text"
                className="c05-input"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="Ej. ★~[TuApodo]~★"
                required
              />
            </div>

            <div className="z05-form-group">
              <label>Mensaje personal / (8) Lo que estoy escuchando:</label>
              <input
                type="text"
                className="c05-input"
                value={personalMessage}
                onChange={(e) => setPersonalMessage(e.target.value)}
                placeholder="(8) Tu canción favorita..."
              />
            </div>
          </>
        )}

        <div className="z05-form-group">
          <label>Estado al conectarte:</label>
          <select
            className="c05-input"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            {Object.values(USER_STATUSES).map((st) => (
              <option key={st.id} value={st.id}>
                {st.label}
              </option>
            ))}
          </select>
        </div>

        <div className="z05-login-actions">
          <button
            type="button"
            className="c05-btn"
            onClick={onOpenAbout}
            style={{ fontSize: 10 }}
          >
            ℹ️ Acerca de
          </button>

          <button
            type="submit"
            className="c05-btn c05-btn-primary"
            style={{ minWidth: 130 }}
            disabled={loading}
          >
            {loading
              ? 'Conectando...'
              : mode === 'register'
                ? 'Crear y entrar'
                : 'Iniciar sesión'}
          </button>
        </div>

        <div className="z05-disclaimer-note">
          Zumbido 05 es un proyecto independiente inspirado en la estética de mensajería de los
          2000s. No está afiliado a ninguna marca comercial.
        </div>
      </form>
    </DraggableWindow>
  );
}
