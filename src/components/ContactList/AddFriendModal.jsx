import React, { useState } from 'react';
import { AvatarView } from '../../services/avatars';
import { renderFormattedText } from '../../services/plusFormatter';

export default function AddFriendModal({
  incomingRequests = [],
  outgoingRequests = [],
  onSendRequest,
  onRespondRequest,
  onClose
}) {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      await onSendRequest(email.trim());
      setSuccess(`Solicitud enviada a ${email.trim()}.`);
      setEmail('');
    } catch (err) {
      setError(err.message || 'No se pudo enviar la solicitud.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="c05-modal-backdrop" onClick={onClose}>
      <div
        className="c05-window focused"
        style={{ position: 'relative', width: 440, maxWidth: '95vw', maxHeight: '88vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="c05-window-titlebar" style={{ cursor: 'default' }}>
          <div className="c05-window-title">
            <span>👥</span> Agregar contacto y solicitudes
          </div>
          <div className="c05-window-controls">
            <button type="button" className="c05-control-btn c05-btn-close" onClick={onClose}>
              ✕
            </button>
          </div>
        </div>

        <div className="c05-window-body" style={{ padding: 14, gap: 12, overflowY: 'auto' }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label style={{ fontWeight: 'bold', fontSize: 12, color: '#0b3474' }}>
              Agregar un amigo por su correo Zumbido ID:
            </label>
            {error && <div className="z05-alert-error">⚠️ {error}</div>}
            {success && <div className="z05-alert-success">✓ {success}</div>}
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                type="email"
                className="c05-input"
                style={{ flex: 1 }}
                placeholder="amigo@ejemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <button type="submit" className="c05-btn c05-btn-primary" disabled={busy}>
                {busy ? 'Enviando...' : 'Agregar'}
              </button>
            </div>
          </form>

          {/* Incoming Requests */}
          <div>
            <div style={{ fontWeight: 'bold', fontSize: 11, color: '#0b3474', marginBottom: 6 }}>
              Solicitudes recibidas ({incomingRequests.length}):
            </div>
            {incomingRequests.length === 0 ? (
              <div style={{ fontSize: 11, color: '#777', fontStyle: 'italic' }}>
                No tienes solicitudes pendientes.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {incomingRequests.map((req) => (
                  <div
                    key={req.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: 6,
                      background: '#ffffff',
                      border: '1px solid #c8d7eb',
                      borderRadius: 4
                    }}
                  >
                    <div className="z05-buddy-mini-avatar">
                      <AvatarView avatar={req.avatar} alt={req.nickname} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 'bold', fontSize: 12 }}>
                        {renderFormattedText(req.nickname, `req-${req.id}`)}
                      </div>
                      <div style={{ fontSize: 10, color: '#666' }}>{req.email}</div>
                    </div>
                    <button
                      type="button"
                      className="c05-btn c05-btn-primary"
                      onClick={() => onRespondRequest(req.id, 'accept')}
                    >
                      Admitir
                    </button>
                    <button
                      type="button"
                      className="c05-btn c05-btn-danger"
                      onClick={() => onRespondRequest(req.id, 'reject')}
                    >
                      Rechazar
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Outgoing Requests */}
          {outgoingRequests.length > 0 && (
            <div>
              <div style={{ fontWeight: 'bold', fontSize: 11, color: '#555', marginBottom: 6 }}>
                Solicitudes enviadas ({outgoingRequests.length}):
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {outgoingRequests.map((req) => (
                  <div
                    key={req.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '5px 8px',
                      background: '#f8fafd',
                      border: '1px solid #dce5f2',
                      borderRadius: 3,
                      fontSize: 11
                    }}
                  >
                    <span>
                      <strong>{req.email}</strong> (esperando respuesta)
                    </span>
                    <button
                      type="button"
                      className="c05-btn"
                      style={{ fontSize: 10, padding: '2px 6px' }}
                      onClick={() => onRespondRequest(req.id, 'reject')}
                    >
                      Cancelar
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
            <button type="button" className="c05-btn" onClick={onClose}>
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
