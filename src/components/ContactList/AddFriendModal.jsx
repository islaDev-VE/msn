import React, { useState, useEffect, useCallback } from 'react';
import { AvatarView } from '../../services/avatars';
import { renderFormattedText, stripPlusTags } from '../../services/plusFormatter';
import { api } from '../../services/api';

function buildInviteUrl(code) {
  if (typeof window === 'undefined' || !code) return '';
  return `${window.location.origin}/?invite=${encodeURIComponent(code)}`;
}

function buildShareMessage(url, inviterName) {
  const who = inviterName ? `${inviterName} te invita` : 'Te invito';
  return `¡Ey! ${who} a volver a los 2000s en Zumbido 05 (chat retro con zumbidos, guiños, tinta y clips de voz). Crea tu cuenta con este enlace y quedamos conectados al instante: ${url}`;
}

async function copyToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  document.execCommand('copy');
  document.body.removeChild(ta);
}

export default function AddFriendModal({
  incomingRequests = [],
  outgoingRequests = [],
  initialTab = 'add',
  myNickname = '',
  onSendRequest,
  onRespondRequest,
  onClose
}) {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [notFoundEmail, setNotFoundEmail] = useState('');

  // Invitations state
  const [inviteLoading, setInviteLoading] = useState(false);
  const [personalInvite, setPersonalInvite] = useState(null);
  const [invitations, setInvitations] = useState([]);
  const [inviteEmailInput, setInviteEmailInput] = useState('');
  const [activeInvite, setActiveInvite] = useState(null);
  const [inviteError, setInviteError] = useState('');
  const [inviteFeedback, setInviteFeedback] = useState('');
  const [copiedCode, setCopiedCode] = useState('');

  const cleanMyName = stripPlusTags(myNickname || '').trim();
  const canWebShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  const loadInvitations = useCallback(async () => {
    setInviteLoading(true);
    setInviteError('');
    try {
      const res = await api.getInvitations();
      setPersonalInvite(res.personal || null);
      setInvitations(res.invitations || []);
      setActiveInvite((prev) => prev || res.personal || null);
    } catch (err) {
      setInviteError(err.message || 'No se pudieron cargar tus invitaciones.');
    } finally {
      setInviteLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'invite') {
      loadInvitations();
    }
  }, [activeTab, loadInvitations]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    setBusy(true);
    setError('');
    setSuccess('');
    setNotFoundEmail('');
    try {
      await onSendRequest(email.trim());
      setSuccess(`Solicitud enviada a ${email.trim()}.`);
      setEmail('');
    } catch (err) {
      setError(err.message || 'No se pudo enviar la solicitud.');
      if (err.data?.code === 'USER_NOT_FOUND') {
        setNotFoundEmail(err.data.email || email.trim());
      }
    } finally {
      setBusy(false);
    }
  };

  const handleCreateEmailInvite = async (targetEmail) => {
    const clean = (targetEmail || '').trim();
    setInviteLoading(true);
    setInviteError('');
    setInviteFeedback('');
    try {
      const res = await api.createInvitation({ email: clean || null });
      setInvitations(res.invitations || []);
      setActiveInvite(res.invitation);
      setInviteEmailInput('');
      setInviteFeedback(
        clean
          ? `¡Enlace mágico listo para ${clean}! Compártelo por WhatsApp, correo o copiándolo.`
          : 'Enlace de invitación listo para compartir.'
      );
    } catch (err) {
      setInviteError(err.message || 'No se pudo generar la invitación.');
    } finally {
      setInviteLoading(false);
    }
  };

  const handleQuickInviteFromNotFound = async () => {
    const target = notFoundEmail;
    setActiveTab('invite');
    await handleCreateEmailInvite(target);
  };

  const handleRegeneratePersonal = async () => {
    setInviteLoading(true);
    setInviteError('');
    setInviteFeedback('');
    try {
      const res = await api.createInvitation({ email: null, regenerate: true });
      setPersonalInvite(res.invitation);
      setInvitations(res.invitations || []);
      setActiveInvite(res.invitation);
      setInviteFeedback('Se generó un nuevo enlace personal (el anterior dejó de funcionar).');
    } catch (err) {
      setInviteError(err.message || 'No se pudo regenerar el enlace.');
    } finally {
      setInviteLoading(false);
    }
  };

  const handleDeleteInvite = async (code) => {
    setInviteError('');
    try {
      const res = await api.deleteInvitation(code);
      setInvitations(res.invitations || []);
      if (activeInvite?.code === code) {
        setActiveInvite(personalInvite);
      }
    } catch (err) {
      setInviteError(err.message || 'No se pudo eliminar la invitación.');
    }
  };

  const handleCopyInvite = async (inv) => {
    if (!inv?.code) return;
    const url = buildInviteUrl(inv.code);
    try {
      await copyToClipboard(url);
      setCopiedCode(inv.code);
      setTimeout(() => setCopiedCode(''), 2200);
    } catch {
      setInviteError('No se pudo copiar automáticamente; selecciona el enlace manualmente.');
    }
  };

  const handleWebShare = async (inv) => {
    if (!inv?.code || !canWebShare) return;
    const url = buildInviteUrl(inv.code);
    const text = buildShareMessage(url, cleanMyName);
    try {
      await navigator.share({
        title: 'Invitación a Zumbido 05',
        text,
        url
      });
    } catch {
      // user cancelled share sheet
    }
  };

  const openWhatsAppShare = (inv) => {
    if (!inv?.code) return;
    const url = buildInviteUrl(inv.code);
    const text = buildShareMessage(url, cleanMyName);
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
  };

  const openMailtoShare = (inv) => {
    if (!inv?.code) return;
    const url = buildInviteUrl(inv.code);
    const subject = '¡Te invito a chatear en Zumbido 05!';
    const body = buildShareMessage(url, cleanMyName);
    const to = inv.invitedEmail ? encodeURIComponent(inv.invitedEmail) : '';
    window.location.href = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  const currentInvite = activeInvite || personalInvite;
  const currentUrl = currentInvite ? buildInviteUrl(currentInvite.code) : '';
  const emailInvitations = invitations.filter((i) => Boolean(i.invitedEmail));

  return (
    <div className="c05-modal-backdrop" onClick={onClose}>
      <div
        className="c05-window focused"
        style={{ position: 'relative', width: 460, maxWidth: '95vw', maxHeight: '90vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="c05-window-titlebar" style={{ cursor: 'default' }}>
          <div className="c05-window-title">
            <span>👥</span> Contactos e invitaciones
          </div>
          <div className="c05-window-controls">
            <button type="button" className="c05-control-btn c05-btn-close" onClick={onClose}>
              ✕
            </button>
          </div>
        </div>

        {/* Classic Tabs */}
        <div className="z05-auth-tabs">
          <button
            type="button"
            className={`z05-auth-tab ${activeTab === 'add' ? 'active' : ''}`}
            onClick={() => setActiveTab('add')}
          >
            👥 Agregar y solicitudes
            {incomingRequests.length > 0 ? ` (${incomingRequests.length})` : ''}
          </button>
          <button
            type="button"
            className={`z05-auth-tab ${activeTab === 'invite' ? 'active' : ''}`}
            onClick={() => setActiveTab('invite')}
          >
            ✉️ Invitar personas nuevas
          </button>
        </div>

        <div className="c05-window-body" style={{ padding: 14, gap: 12, overflowY: 'auto' }}>
          {activeTab === 'add' ? (
            <>
              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <label style={{ fontWeight: 'bold', fontSize: 12, color: '#0b3474' }}>
                  Agregar un amigo que ya tiene cuenta Zumbido ID:
                </label>
                {error && <div className="z05-alert-error">⚠️ {error}</div>}
                {notFoundEmail && (
                  <div className="z05-invite-callout">
                    <div>
                      <strong>{notFoundEmail}</strong> aún no está en Zumbido 05. ¡Envíale un enlace mágico y quedarán conectados al instante cuando cree su cuenta!
                    </div>
                    <div>
                      <button
                        type="button"
                        className="c05-btn c05-btn-primary"
                        onClick={handleQuickInviteFromNotFound}
                      >
                        ✨ Crear enlace de invitación para {notFoundEmail}
                      </button>
                    </div>
                  </div>
                )}
                {success && <div className="z05-alert-success">✓ {success}</div>}
                <div style={{ display: 'flex', gap: 6 }}>
                  <input
                    type="email"
                    className="c05-input"
                    style={{ flex: 1 }}
                    placeholder="amigo@ejemplo.com"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (notFoundEmail) setNotFoundEmail('');
                    }}
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
            </>
          ) : (
            <>
              {inviteError && <div className="z05-alert-error">⚠️ {inviteError}</div>}
              {inviteFeedback && <div className="z05-alert-success">✓ {inviteFeedback}</div>}

              {/* Active / Personal Magic Invite Link Box */}
              <div className="z05-invite-box">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <div style={{ fontWeight: 'bold', fontSize: 12, color: '#0b3474' }}>
                    {currentInvite?.invitedEmail
                      ? `✨ Enlace personalizado para ${currentInvite.invitedEmail}`
                      : '🔗 Tu enlace mágico personal (reutilizable)'}
                  </div>
                  {currentInvite?.invitedEmail && personalInvite && (
                    <button
                      type="button"
                      className="c05-btn"
                      style={{ fontSize: 10, padding: '2px 6px' }}
                      onClick={() => {
                        setActiveInvite(personalInvite);
                        setInviteFeedback('');
                      }}
                    >
                      Ver mi enlace general
                    </button>
                  )}
                </div>

                <div style={{ fontSize: 11, color: '#455a75', lineHeight: 1.4 }}>
                  Quien abra este enlace verá tu invitación personalizada y, al crear su cuenta,{' '}
                  <strong>se agregará automáticamente a tu lista de amigos</strong>.
                </div>

                <div className="z05-invite-link-row">
                  <input
                    type="text"
                    readOnly
                    className="c05-input"
                    style={{ flex: 1, fontSize: 11, background: '#f8fbff' }}
                    value={inviteLoading && !currentUrl ? 'Generando enlace...' : currentUrl}
                    onFocus={(e) => e.target.select()}
                  />
                  <button
                    type="button"
                    className="c05-btn c05-btn-primary"
                    disabled={!currentInvite}
                    onClick={() => handleCopyInvite(currentInvite)}
                  >
                    {copiedCode === currentInvite?.code ? '✓ ¡Copiado!' : '📋 Copiar'}
                  </button>
                </div>

                <div className="z05-invite-share-row">
                  <button
                    type="button"
                    className="c05-btn z05-invite-btn-wa"
                    disabled={!currentInvite}
                    onClick={() => openWhatsAppShare(currentInvite)}
                  >
                    💬 Enviar por WhatsApp
                  </button>
                  {canWebShare && (
                    <button
                      type="button"
                      className="c05-btn"
                      disabled={!currentInvite}
                      onClick={() => handleWebShare(currentInvite)}
                    >
                      📤 Compartir...
                    </button>
                  )}
                  <button
                    type="button"
                    className="c05-btn"
                    disabled={!currentInvite}
                    onClick={() => openMailtoShare(currentInvite)}
                  >
                    📧 Abrir correo
                  </button>
                  {!currentInvite?.invitedEmail && (
                    <button
                      type="button"
                      className="c05-btn"
                      style={{ marginLeft: 'auto', fontSize: 10 }}
                      disabled={inviteLoading}
                      onClick={handleRegeneratePersonal}
                      title="Crear un código nuevo e invalidar el enlace personal anterior"
                    >
                      🔄 Nuevo enlace
                    </button>
                  )}
                </div>

                {personalInvite && !currentInvite?.invitedEmail && (
                  <div style={{ fontSize: 10, color: '#5c6f88' }}>
                    Personas que se unieron con tu enlace personal:{' '}
                    <strong>{personalInvite.usesCount || 0}</strong>
                  </div>
                )}
              </div>

              {/* Dedicated Email Invite Form */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!inviteEmailInput.trim()) return;
                  handleCreateEmailInvite(inviteEmailInput.trim());
                }}
                style={{ display: 'flex', flexDirection: 'column', gap: 6 }}
              >
                <label style={{ fontWeight: 'bold', fontSize: 11, color: '#0b3474' }}>
                  Crear enlace dedicado para un correo (pre-rellena su correo al registrarse):
                </label>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input
                    type="email"
                    className="c05-input"
                    style={{ flex: 1 }}
                    placeholder="persona@ejemplo.com"
                    value={inviteEmailInput}
                    onChange={(e) => setInviteEmailInput(e.target.value)}
                    required
                  />
                  <button type="submit" className="c05-btn" disabled={inviteLoading}>
                    {inviteLoading ? 'Creando...' : '✨ Generar'}
                  </button>
                </div>
              </form>

              {/* Dedicated Email Invites History */}
              {emailInvitations.length > 0 && (
                <div>
                  <div style={{ fontWeight: 'bold', fontSize: 11, color: '#555', marginBottom: 6 }}>
                    Invitaciones por correo ({emailInvitations.length}):
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    {emailInvitations.map((inv) => (
                      <div
                        key={inv.code}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 6,
                          padding: '5px 8px',
                          background: activeInvite?.code === inv.code ? '#edf6ff' : '#f8fafd',
                          border: '1px solid #dce5f2',
                          borderRadius: 3,
                          fontSize: 11
                        }}
                      >
                        <div
                          style={{ minWidth: 0, flex: 1, cursor: 'pointer' }}
                          onClick={() => setActiveInvite(inv)}
                          title="Seleccionar este enlace para compartir"
                        >
                          <div style={{ fontWeight: 'bold', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {inv.invitedEmail}
                          </div>
                          <div style={{ fontSize: 10, color: inv.usesCount > 0 ? '#1b5e20' : '#666' }}>
                            {inv.usesCount > 0
                              ? `✓ Se unió (${inv.usesCount})`
                              : 'Pendiente de registro'}
                          </div>
                        </div>
                        <button
                          type="button"
                          className="c05-btn"
                          style={{ fontSize: 10, padding: '2px 6px' }}
                          onClick={() => handleCopyInvite(inv)}
                        >
                          {copiedCode === inv.code ? '✓' : '📋'}
                        </button>
                        <button
                          type="button"
                          className="c05-btn c05-btn-danger"
                          style={{ fontSize: 10, padding: '2px 6px' }}
                          onClick={() => handleDeleteInvite(inv.code)}
                          title="Revocar invitación"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
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

