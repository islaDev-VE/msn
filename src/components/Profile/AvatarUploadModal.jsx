import React, { useState, useRef } from 'react';
import { RETRO_AVATARS, AvatarView } from '../../services/avatars';
import { compressAvatar } from '../../services/imageProcessor';
import {
  QUICK_PLUS_COLORS,
  RETRO_2005_SONGS,
  renderFormattedText,
  stripPlusTags
} from '../../services/plusFormatter';

export default function AvatarUploadModal({ profile, onSave, onClose }) {
  const [avatar, setAvatar] = useState(profile.avatar || 'bubbles');
  const [nickname, setNickname] = useState(profile.nickname || '');
  const [personalMessage, setPersonalMessage] = useState(profile.personalMessage || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef(null);

  const handleFilePick = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    try {
      const compressed = await compressAvatar(file, 256);
      setAvatar(compressed);
    } catch (err) {
      setError(err.message || 'Error al comprimir la imagen.');
    } finally {
      e.target.value = '';
    }
  };

  const applyColorWrap = (hex) => {
    const clean = nickname.trim() || 'TuNick';
    setNickname(`[c=${hex}]${clean}[/c]`);
  };

  const applyTagWrap = (tag) => {
    const clean = nickname.trim() || 'TuNick';
    setNickname(`[${tag}]${clean}[/${tag}]`);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!nickname.trim() || !stripPlusTags(nickname).trim()) {
      setError('Tu nombre para mostrar debe contener texto visible.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onSave({
        avatar,
        nickname: nickname.trim(),
        personalMessage
      });
      onClose();
    } catch (err) {
      setError(err.message || 'No se pudieron guardar los cambios.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="c05-modal-backdrop" onClick={onClose}>
      <div
        className="c05-window focused"
        style={{ position: 'relative', width: 450, maxWidth: '95vw', maxHeight: '90vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="c05-window-titlebar" style={{ cursor: 'default' }}>
          <div className="c05-window-title">
            <span>🖼️</span> Mi perfil, foto y Colores Plus
          </div>
          <div className="c05-window-controls">
            <button type="button" className="c05-control-btn c05-btn-close" onClick={onClose}>
              ✕
            </button>
          </div>
        </div>

        <form
          onSubmit={handleSave}
          className="c05-window-body"
          style={{ padding: 14, gap: 12, overflowY: 'auto' }}
        >
          {error && <div className="z05-alert-error">⚠️ {error}</div>}

          {/* Top Preview + Upload Real Photo */}
          <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
            <div className="z05-avatar-box" style={{ width: 76, height: 76 }}>
              <AvatarView avatar={avatar} alt="Previsualización de foto" />
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ fontWeight: 'bold', color: '#0b3474', fontSize: 12 }}>
                Cambiar foto para mostrar:
              </div>
              <div style={{ fontSize: 11, color: '#555' }}>
                Sube una foto real desde tu PC o móvil (se recorta y optimiza automáticamente a 256×256).
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="c05-btn c05-btn-primary"
                  onClick={() => fileRef.current?.click()}
                >
                  📷 Examinar foto real...
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={handleFilePick}
                />
              </div>
            </div>
          </div>

          {/* Retro Avatars Gallery */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 'bold', color: '#333', marginBottom: 6 }}>
              O elige un avatar retro original:
            </div>
            <div className="z05-avatar-gallery">
              {RETRO_AVATARS.map((item) => (
                <div
                  key={item.id}
                  className={`z05-avatar-option ${avatar === item.id ? 'selected' : ''}`}
                  onClick={() => setAvatar(item.id)}
                >
                  <div style={{ width: 42, height: 42 }}>
                    <AvatarView avatar={item.id} alt={item.name} />
                  </div>
                  <span>{item.name}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Nickname + Colores Plus Toolbar */}
          <div className="z05-form-group">
            <label>Nombre para mostrar (Colores Plus):</label>
            <input
              type="text"
              className="c05-input"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              maxLength={120}
              required
            />
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4, alignItems: 'center' }}>
              <span style={{ fontSize: 10, color: '#555' }}>Estilos rápidos:</span>
              {QUICK_PLUS_COLORS.map((c) => (
                <button
                  key={c.code}
                  type="button"
                  title={`Aplicar color ${c.label}`}
                  onClick={() => applyColorWrap(c.code)}
                  style={{
                    width: 18,
                    height: 18,
                    background: c.code,
                    border: '1px solid #444',
                    borderRadius: 2,
                    cursor: 'pointer'
                  }}
                />
              ))}
              <button type="button" className="c05-btn" style={{ padding: '1px 6px' }} onClick={() => applyTagWrap('b')}>
                <strong>B</strong>
              </button>
              <button type="button" className="c05-btn" style={{ padding: '1px 6px' }} onClick={() => applyTagWrap('i')}>
                <em>I</em>
              </button>
            </div>
            <div
              style={{
                marginTop: 4,
                padding: '4px 8px',
                background: '#ffffff',
                border: '1px solid #c8d7eb',
                borderRadius: 3,
                fontSize: 12
              }}
            >
              <span style={{ fontSize: 10, color: '#666', marginRight: 6 }}>Vista previa:</span>
              {renderFormattedText(nickname, 'nick-prev')}
            </div>
          </div>

          {/* Personal Message + 2005 Songs Quick Picker */}
          <div className="z05-form-group">
            <label>Mensaje personal / (8) Lo que estoy escuchando:</label>
            <input
              type="text"
              className="c05-input"
              value={personalMessage}
              onChange={(e) => setPersonalMessage(e.target.value)}
              placeholder="(8) Canción o frase del día..."
              maxLength={180}
            />
            <select
              className="c05-input"
              style={{ marginTop: 4, fontSize: 11 }}
              value=""
              onChange={(e) => {
                if (e.target.value) setPersonalMessage(e.target.value);
              }}
            >
              <option value="">🎵 Elegir un temazo clásico del 2005...</option>
              {RETRO_2005_SONGS.map((song) => (
                <option key={song} value={song}>
                  {song}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
            <button type="button" className="c05-btn" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="c05-btn c05-btn-primary" disabled={saving}>
              {saving ? 'Guardando...' : 'Guardar perfil'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
