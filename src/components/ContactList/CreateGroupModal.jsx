import React, { useMemo, useState } from 'react';
import { renderFormattedText } from '../../services/plusFormatter';

const GROUP_AVATARS = ['💬', '👥', '🎮', '🎧', '🔥', '✨', '🚀', '☕'];

export default function CreateGroupModal({
  friends = [],
  existingGroup = null,
  onCreateGroup,
  onAddMembers,
  onClose,
}) {
  const isInviteMode = Boolean(existingGroup);
  const existingMemberIds = useMemo(
    () => new Set((existingGroup?.members || []).map((m) => m.id)),
    [existingGroup]
  );

  const selectableFriends = useMemo(() => {
    const accepted = friends.filter((f) => f.relationStatus === 'accepted');
    return isInviteMode
      ? accepted.filter((f) => !existingMemberIds.has(f.id))
      : accepted;
  }, [friends, isInviteMode, existingMemberIds]);

  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState('💬');
  const [selectedIds, setSelectedIds] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const toggleId = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!isInviteMode && name.trim().length < 2) {
      setError('Escribe un nombre para la sala (mínimo 2 caracteres).');
      return;
    }
    if (selectedIds.length === 0) {
      setError('Selecciona al menos un contacto.');
      return;
    }

    setBusy(true);
    try {
      if (isInviteMode) {
        await onAddMembers?.(existingGroup.id, selectedIds);
      } else {
        await onCreateGroup?.(name.trim(), selectedIds, avatar);
      }
      onClose?.();
    } catch (err) {
      setError(err?.message || 'No se pudo completar la operación.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="z05-modal-overlay" onClick={onClose}>
      <div className="xp-window z05-modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400 }}>
        <div className="xp-titlebar">
          <div className="xp-titlebar-title">
            <span style={{ fontSize: 14 }}>👥</span>
            <span>{isInviteMode ? `Invitar a "${existingGroup.name}"` : 'Nueva Sala Grupal'}</span>
          </div>
          <div className="xp-titlebar-controls">
            <button type="button" className="xp-btn-control xp-btn-close" onClick={onClose} title="Cerrar">✕</button>
          </div>
        </div>

        <form className="xp-window-body" onSubmit={handleSubmit}>
          {error && (
            <div className="z05-alert z05-alert-error" style={{ marginBottom: 10 }}>
              {error}
            </div>
          )}

          {!isInviteMode && (
            <>
              <div className="z05-field" style={{ marginBottom: 10 }}>
                <label className="z05-label">Nombre de la sala</label>
                <input
                  type="text"
                  className="xp-input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={50}
                  placeholder="Ej: La Banda del Cyber 2005"
                  autoFocus
                />
              </div>

              <div className="z05-field" style={{ marginBottom: 10 }}>
                <label className="z05-label">Ícono de la sala</label>
                <div className="z05-group-avatar-row">
                  {GROUP_AVATARS.map((em) => (
                    <button
                      key={em}
                      type="button"
                      className={`z05-group-avatar-btn ${avatar === em ? 'is-selected' : ''}`}
                      onClick={() => setAvatar(em)}
                    >
                      {em}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          <div className="z05-field" style={{ marginBottom: 12 }}>
            <label className="z05-label">
              {isInviteMode ? 'Selecciona contactos a invitar:' : 'Participantes (selecciona 1 o más contactos):'}
            </label>
            <div className="z05-group-checklist">
              {selectableFriends.length === 0 ? (
                <div style={{ padding: 12, textAlign: 'center', fontSize: 12, color: '#64748b' }}>
                  {isInviteMode
                    ? 'Todos tus contactos aceptados ya están en esta sala.'
                    : 'Aún no tienes contactos aceptados para invitar.'}
                </div>
              ) : (
                selectableFriends.map((friend) => {
                  const checked = selectedIds.includes(friend.id);
                  return (
                    <label key={friend.id} className={`z05-group-check-item ${checked ? 'is-checked' : ''}`}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleId(friend.id)}
                      />
                      <span className="z05-group-check-avatar">{friend.avatar || '🧑'}</span>
                      <span className="z05-group-check-name">
                        {renderFormattedText(friend.nickname, `cg-${friend.id}`)}
                      </span>
                      <span className={`z05-status-dot ${friend.isOnline ? 'online' : 'offline'}`} />
                    </label>
                  );
                })
              )}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button type="button" className="xp-btn" onClick={onClose} disabled={busy}>
              Cancelar
            </button>
            <button
              type="submit"
              className="xp-btn xp-btn-primary"
              disabled={busy || selectableFriends.length === 0}
            >
              {busy ? 'Guardando...' : isInviteMode ? 'Agregar a la sala' : 'Crear sala'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
