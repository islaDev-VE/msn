import React, { useState } from 'react';

export default function InviteModal({ roomId, onClose }) {
  const [copied, setCopied] = useState(false);
  const inviteUrl = `${window.location.origin}${window.location.pathname}?room=${encodeURIComponent(roomId)}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.3)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 11000
      }}
    >
      <div className="xp-window focused" style={{ width: 420 }}>
        <div className="xp-window-titlebar">
          <div className="xp-window-title">
            <span>👥</span> Invitar a un amigo a chatear en MSN
          </div>
          <div className="xp-window-controls">
            <button className="xp-control-btn xp-btn-close" onClick={onClose}>
              ✕
            </button>
          </div>
        </div>

        <div className="xp-window-body" style={{ padding: 16, gap: 12 }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <div style={{ fontSize: 32 }}>💌</div>
            <div style={{ flex: 1, fontSize: 11, color: '#333', lineHeight: 1.5 }}>
              <strong>¡Conecta con tus amigos en MSN Messenger 7.5!</strong>
              <p style={{ marginTop: 4 }}>
                Envía este enlace directo a tu amigo por WhatsApp, Discord o correo. Al abrirlo,
                iniciará sesión directamente en tu misma sala privada.
              </p>
            </div>
          </div>

          <div className="msn-form-group">
            <label style={{ fontWeight: 'bold' }}>Enlace de invitación directo:</label>
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                type="text"
                readOnly
                className="xp-input"
                style={{ flex: 1, background: '#fff' }}
                value={inviteUrl}
              />
              <button className="xp-btn xp-btn-primary" onClick={handleCopy}>
                {copied ? '¡Copiado! ✓' : 'Copiar enlace'}
              </button>
            </div>
          </div>

          <div className="msn-form-group">
            <label style={{ fontWeight: 'bold' }}>Código de sala (PIN):</label>
            <div style={{ fontSize: 13, fontWeight: 'bold', color: '#0055ea', padding: '4px 8px', background: '#eef4ff', border: '1px solid #b8cde8', borderRadius: 3 }}>
              {roomId}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
            <button className="xp-btn" onClick={onClose} style={{ minWidth: 80 }}>
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
