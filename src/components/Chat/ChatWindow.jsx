import React, { useState, useEffect, useRef, useCallback } from 'react';
import DraggableWindow from '../Common/DraggableWindow';
import { AvatarView } from '../../services/avatars';
import { RETRO_EMOTICONS } from '../../services/emoticons';
import { USER_STATUSES, formatLastSeen } from '../../services/statusHelper';
import { renderFormattedText, stripPlusTags } from '../../services/plusFormatter';
import { compressChatImage } from '../../services/imageProcessor';
import WinksOverlay, { WINKS_CATALOG } from './WinksOverlay';
import InkPad from './InkPad';

const CHAT_FONTS = [
  'Tahoma',
  'Comic Sans MS, Comic Neue, cursive',
  'Arial',
  'Times New Roman',
  'Courier New'
];

const CHAT_COLORS = [
  '#000000', '#0055ea', '#d32f2f', '#2e7d32',
  '#e65100', '#7b1fa2', '#c2185b', '#00838f',
  '#37474f', '#f57f17', '#1565c0', '#4e342e',
  '#827717', '#ad1457', '#00695c', '#4527a0'
];

const REACTION_EMOJIS = ['❤️', '😂', '👍', '😮', '🔥', '😢'];

export default function ChatWindow({
  mode = 'dm',
  contact = null,
  group = null,
  myProfile,
  messages = [],
  hasMore = false,
  loadingHistory = false,
  onLoadMore,
  isTyping = false,
  typingText = '',
  shakingToken = 0,
  activeWink = null,
  onClearWink,
  cooldownNotice = '',
  onSendMessage,
  onSendNudge,
  onSendWink,
  onTypingStatus,
  onMarkRead,
  onToggleReaction,
  onInviteGroupMembers,
  onLeaveGroup,
  onMinimize,
  onClose,
  isFocused,
  zIndex,
  cascadeIndex = 0,
  onFocus,
  isMobile
}) {
  const isGroup = mode === 'group' && Boolean(group);
  const targetId = isGroup ? group.id : contact?.id;
  const unreadCount = isGroup ? (group?.unreadCount || 0) : (contact?.unreadCount || 0);
  const isBlocked = !isGroup && Boolean(contact?.isBlocked);

  const [inputText, setInputText] = useState('');
  const [selectedFont, setSelectedFont] = useState('Tahoma');
  const [selectedColor, setSelectedColor] = useState('#000000');
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [showEmoticons, setShowEmoticons] = useState(false);
  const [showColors, setShowColors] = useState(false);
  const [showWinks, setShowWinks] = useState(false);
  const [isInkMode, setIsInkMode] = useState(false);
  const [isShaking, setIsShaking] = useState(false);
  const [transferProgress, setTransferProgress] = useState(null);
  const [lightboxSrc, setLightboxSrc] = useState(null);
  const [localError, setLocalError] = useState('');

  // Reply / quote & reaction picker
  const [replyingTo, setReplyingTo] = useState(null);
  const [reactionPickerMsgId, setReactionPickerMsgId] = useState(null);

  // Drag & drop image state
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const dragDepthRef = useRef(0);

  // Voice clip recording (F2 / mic button) with cancel + preview before sending
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [voiceDraft, setVoiceDraft] = useState(null);
  const mediaRecorderRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const recordingStartRef = useRef(0);
  const audioChunksRef = useRef([]);
  const recordIntervalRef = useRef(null);
  const voiceCancelledRef = useRef(false);

  const historyEndRef = useRef(null);
  const typingTimerRef = useRef(null);
  const imageInputRef = useRef(null);
  const prevLenRef = useRef(0);

  // Scroll to bottom when new messages arrive (not when prepending older history)
  useEffect(() => {
    if (messages.length > prevLenRef.current) {
      const added = messages.length - prevLenRef.current;
      if (added <= 2 || prevLenRef.current === 0) {
        historyEndRef.current?.scrollIntoView({ behavior: prevLenRef.current === 0 ? 'auto' : 'smooth' });
      }
    }
    prevLenRef.current = messages.length;
  }, [messages.length]);

  // Shake when shakingToken increments
  useEffect(() => {
    if (!shakingToken) return;
    setIsShaking(true);
    const t = setTimeout(() => setIsShaking(false), 650);
    return () => clearTimeout(t);
  }, [shakingToken]);

  // Mark read when focused
  useEffect(() => {
    if (isFocused && targetId && unreadCount > 0) {
      onMarkRead?.(targetId);
    }
  }, [isFocused, targetId, unreadCount, onMarkRead]);

  // Stop voice recording cleanly
  const stopVoiceRecording = useCallback((cancel = false) => {
    voiceCancelledRef.current = Boolean(cancel);
    if (recordIntervalRef.current) {
      clearInterval(recordIntervalRef.current);
      recordIntervalRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  }, []);

  const startVoiceRecording = useCallback(async () => {
    setLocalError('');
    setVoiceDraft(null);
    voiceCancelledRef.current = false;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setLocalError('Tu navegador no soporta grabación de clips de voz en este contexto.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : (MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : '');
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);

      audioChunksRef.current = [];
      recordingStartRef.current = Date.now();
      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) audioChunksRef.current.push(ev.data);
      };

      recorder.onstop = () => {
        stream.getTracks().forEach((tr) => tr.stop());
        if (mediaStreamRef.current === stream) {
          mediaStreamRef.current = null;
        }
        if (voiceCancelledRef.current) {
          voiceCancelledRef.current = false;
          audioChunksRef.current = [];
          return;
        }
        const elapsedSecs = Math.max(1, Math.min(20, Math.round((Date.now() - recordingStartRef.current) / 1000)));
        const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        if (blob.size < 200) return;

        const reader = new FileReader();
        reader.onloadend = () => {
          setVoiceDraft({
            dataUrl: reader.result,
            label: `Clip de voz (${elapsedSecs}s)`
          });
        };
        reader.readAsDataURL(blob);
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
      setRecordingSeconds(0);

      recordIntervalRef.current = setInterval(() => {
        setRecordingSeconds((prev) => {
          if (prev >= 19) {
            stopVoiceRecording(false);
            return 20;
          }
          return prev + 1;
        });
      }, 1000);
    } catch {
      setLocalError('No se obtuvo permiso para usar el micrófono.');
    }
  }, [stopVoiceRecording]);

  // F2 keyboard shortcut for retro Voice Clip recording when chat is focused
  useEffect(() => {
    if (!isFocused || isMobile) return;
    const onKeyDown = (e) => {
      if (e.key === 'F2' && !e.repeat) {
        e.preventDefault();
        if (isRecording) stopVoiceRecording(false);
        else startVoiceRecording();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isFocused, isMobile, isRecording, startVoiceRecording, stopVoiceRecording]);

  useEffect(() => {
    return () => {
      if (recordIntervalRef.current) clearInterval(recordIntervalRef.current);
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.onstop = null;
        try {
          mediaRecorderRef.current.stop();
        } catch {
          // ignore
        }
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((tr) => tr.stop());
        mediaStreamRef.current = null;
      }
    };
  }, []);

  const buildTargetPayload = useCallback(
    (extra) => (isGroup ? { groupId: group.id, ...extra } : { toUserId: contact.id, ...extra }),
    [isGroup, group?.id, contact?.id]
  );

  const handleInputChange = (e) => {
    setInputText(e.target.value);
    onTypingStatus?.(targetId, true);
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      onTypingStatus?.(targetId, false);
    }, 1500);
  };

  const handleSend = () => {
    if (!inputText.trim() || isBlocked) return;
    setLocalError('');
    onSendMessage(
      buildTargetPayload({
        type: 'text',
        text: inputText,
        font: selectedFont,
        color: selectedColor,
        isBold,
        isItalic,
        replyToId: replyingTo?.id || undefined
      })
    );
    setInputText('');
    setReplyingTo(null);
    setShowEmoticons(false);
    setShowColors(false);
    setShowWinks(false);
    onTypingStatus?.(targetId, false);
  };

  const sendImageFile = async (file) => {
    if (!file || isBlocked) return;
    if (!file.type?.startsWith('image/')) {
      setLocalError('Solo puedes adjuntar o arrastrar archivos de imagen.');
      return;
    }
    setLocalError('');
    try {
      const fileLabel = file.name || 'imagen-pegada.png';
      setTransferProgress({ label: `Preparando ${fileLabel}...`, percent: 30 });
      const dataUrl = await compressChatImage(file, 800);
      setTransferProgress({ label: `Transfiriendo ${fileLabel}...`, percent: 85 });
      onSendMessage(
        buildTargetPayload({
          type: 'image',
          text: fileLabel,
          mediaData: dataUrl,
          replyToId: replyingTo?.id || undefined
        })
      );
      setReplyingTo(null);
      setTransferProgress({ label: 'Transferencia completada ✓', percent: 100 });
      setTimeout(() => setTransferProgress(null), 700);
    } catch (err) {
      setTransferProgress(null);
      setLocalError(err.message || 'No se pudo enviar la imagen.');
    }
  };

  const handleImagePick = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await sendImageFile(file);
    e.target.value = '';
  };

  const handlePaste = async (e) => {
    if (isBlocked) return;
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type && item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          e.preventDefault();
          await sendImageFile(file);
          return;
        }
      }
    }
  };

  const handleDragEnter = (e) => {
    if (isBlocked) return;
    if (!Array.from(e.dataTransfer?.types || []).includes('Files')) return;
    e.preventDefault();
    dragDepthRef.current += 1;
    setIsDraggingOver(true);
  };

  const handleDragOver = (e) => {
    if (isBlocked) return;
    if (!Array.from(e.dataTransfer?.types || []).includes('Files')) return;
    e.preventDefault();
  };

  const handleDragLeave = (e) => {
    if (!isDraggingOver) return;
    e.preventDefault();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) {
      setIsDraggingOver(false);
    }
  };

  const handleDrop = async (e) => {
    if (isBlocked) return;
    e.preventDefault();
    dragDepthRef.current = 0;
    setIsDraggingOver(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) {
      await sendImageFile(file);
    }
  };

  const handleSendVoiceDraft = () => {
    if (!voiceDraft || isBlocked) return;
    setTransferProgress({ label: 'Enviando clip de voz...', percent: 100 });
    onSendMessage(
      buildTargetPayload({
        type: 'voice',
        text: voiceDraft.label,
        mediaData: voiceDraft.dataUrl,
        replyToId: replyingTo?.id || undefined
      })
    );
    setVoiceDraft(null);
    setReplyingTo(null);
    setTimeout(() => setTransferProgress(null), 400);
  };

  const handleSendInk = (inkDataUrl) => {
    onSendMessage(
      buildTargetPayload({
        type: 'ink',
        text: 'Nota manuscrita',
        mediaData: inkDataUrl,
        replyToId: replyingTo?.id || undefined
      })
    );
    setReplyingTo(null);
    setIsInkMode(false);
  };

  const formatTime = (ts) => {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getSenderNick = (m) => {
    if (m.fromUserId === myProfile.id) return myProfile.nickname;
    if (isGroup) {
      if (m.fromUser?.nickname) return m.fromUser.nickname;
      const found = (group?.members || []).find((mb) => mb.id === m.fromUserId);
      return found?.nickname || 'Contacto';
    }
    return contact?.nickname || 'Contacto';
  };

  const describeMessagePreview = (m) => {
    if (!m) return '';
    if (m.type === 'image') return '📷 Foto';
    if (m.type === 'voice') return `🎙️ ${m.text || 'Clip de voz'}`;
    if (m.type === 'ink') return '✍️ Nota manuscrita';
    return stripPlusTags(m.text || '').slice(0, 75);
  };

  const cleanHeaderTitle = isGroup ? group.name : stripPlusTags(contact?.nickname || '');
  const windowTitle = isGroup
    ? `${group.name} (${group.members?.length || 0}) — Sala grupal`
    : `${cleanHeaderTitle} — Conversación`;

  const initialX = Math.min(365 + cascadeIndex * 28, Math.max(40, window.innerWidth - 530));
  const initialY = Math.min(36 + cascadeIndex * 26, Math.max(20, window.innerHeight - 520));

  return (
    <>
      <DraggableWindow
        title={windowTitle}
        titleIcon={<span>{isGroup ? (group.avatar || '👥') : '💬'}</span>}
        initialX={initialX}
        initialY={initialY}
        width={520}
        height={510}
        zIndex={zIndex}
        isFocused={isFocused}
        isMobile={isMobile}
        mobileChatMode={true}
        extraClassName={isShaking ? 'shake-nudge' : ''}
        onFocus={onFocus}
        onMinimize={onMinimize}
        onClose={onClose}
      >
        <div
          className="z05-chat-window"
          style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {isDraggingOver && !isBlocked && (
            <div className="z05-drop-overlay">
              <div className="z05-drop-overlay-card">📷 Suelta la imagen para enviarla</div>
            </div>
          )}

          {/* Header with Contact Photo or Group Members & Back button on Mobile */}
          <div className="z05-chat-header">
            <div className="z05-chat-contact-info">
              <button type="button" className="z05-mobile-back-btn" onClick={onClose}>
                ← Atrás
              </button>
              {isGroup ? (
                <div className="z05-chat-contact-avatar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, background: '#e5f0ff' }}>
                  {group.avatar || '💬'}
                </div>
              ) : (
                <div className="z05-chat-contact-avatar">
                  <AvatarView avatar={contact.avatar} alt={cleanHeaderTitle} />
                </div>
              )}

              <div className="z05-chat-contact-text">
                <div className="z05-chat-contact-name">
                  {isGroup
                    ? `${group.name} (${group.members?.length || 0} miembros)`
                    : renderFormattedText(contact.nickname, `hdr-${contact.id}`)}
                </div>
                {isGroup ? (
                  <div className="z05-group-members-strip">
                    {(group.members || []).slice(0, 6).map((mb) => (
                      <span key={mb.id} className="z05-group-member-chip">
                        <span className={`z05-status-dot ${mb.isOnline ? 'online' : 'offline'}`} />
                        {stripPlusTags(mb.nickname)}
                      </span>
                    ))}
                    {(group.members || []).length > 6 && (
                      <span className="z05-group-member-chip">+{group.members.length - 6}</span>
                    )}
                  </div>
                ) : (
                  <div className="z05-chat-contact-sub">
                    {contact.isOnline
                      ? (contact.personalMessage
                          ? renderFormattedText(contact.personalMessage, `hdr-msg-${contact.id}`)
                          : `${USER_STATUSES[contact.status]?.label || 'Conectado'} • ${contact.email}`)
                      : `Sin conexión (${formatLastSeen(contact.lastSeen)}) — los mensajes llegarán al conectarse`}
                  </div>
                )}
              </div>
            </div>

            {isGroup ? (
              <div className="z05-group-header-actions">
                <button
                  type="button"
                  className="xp-btn"
                  style={{ padding: '3px 8px', fontSize: 11 }}
                  onClick={() => onInviteGroupMembers?.(group)}
                  title="Invitar más contactos a esta sala"
                >
                  ➕ Invitar
                </button>
                <button
                  type="button"
                  className="xp-btn"
                  style={{ padding: '3px 8px', fontSize: 11, color: '#a51d24' }}
                  onClick={() => onLeaveGroup?.(group.id)}
                  title="Salir de esta sala grupal"
                >
                  Salir
                </button>
              </div>
            ) : (
              <div className="z05-chat-contact-avatar" style={{ width: 34, height: 34 }} title="Tu foto">
                <AvatarView avatar={myProfile.avatar} alt="Mi foto" />
              </div>
            )}
          </div>

          {/* Chat History */}
          <div className="z05-chat-history" style={{ position: 'relative' }}>
            {hasMore && (
              <button
                type="button"
                className="c05-btn z05-load-more-btn"
                disabled={loadingHistory}
                onClick={() => onLoadMore?.(targetId)}
              >
                {loadingHistory ? 'Cargando...' : '▲ Cargar mensajes anteriores'}
              </button>
            )}

            {messages.length === 0 && !loadingHistory && (
              <div className="z05-system-msg">
                {isGroup
                  ? `Sala grupal "${group.name}". ¡Saluda a los miembros de la sala!`
                  : `Conversación privada con ${cleanHeaderTitle}. El historial se guarda automáticamente.`}
              </div>
            )}

            {messages.map((m) => {
              const isMe = m.fromUserId === myProfile.id;
              const senderNick = getSenderNick(m);

              if (m.type === 'nudge') {
                return (
                  <div key={m.id} className="z05-nudge-msg">
                    <span>⚡</span>
                    <span>
                      {isMe
                        ? (isGroup ? '¡Enviaste un zumbido a la sala!' : '¡Acabas de enviar un zumbido!')
                        : `¡${stripPlusTags(senderNick)} ${isGroup ? 'envió un zumbido a la sala' : 'te acaba de enviar un zumbido'}!`}
                    </span>
                  </div>
                );
              }

              if (m.type === 'wink') {
                return (
                  <div key={m.id} className="z05-system-msg" style={{ color: '#0055ea', fontWeight: 'bold' }}>
                    ✨ {stripPlusTags(senderNick)} envió un guiño animado ({m.mediaData || m.text}).
                  </div>
                );
              }

              const reactions = Array.isArray(m.reactions) ? m.reactions : [];
              const showPicker = reactionPickerMsgId === m.id;

              return (
                <div key={m.id} className="z05-msg-row z05-msg-item">
                  <div className="z05-msg-header-row">
                    <div>
                      <span className="z05-msg-time">[{formatTime(m.timestamp)}]</span>
                      <span className="z05-msg-sender" style={{ color: isMe ? '#0055ea' : '#c62828' }}>
                        {renderFormattedText(senderNick, `snd-${m.id}`)}:
                      </span>
                      {!isGroup && isMe && (
                        <span
                          className={`z05-read-receipt ${m.read ? 'is-read' : ''}`}
                          title={m.read ? 'Leído' : 'Enviado'}
                        >
                          {m.read ? '✓✓' : '✓'}
                        </span>
                      )}
                    </div>

                    <div className="z05-msg-actions">
                      <button
                        type="button"
                        className="z05-msg-action-btn"
                        title="Responder / Citar"
                        onClick={() => setReplyingTo(m)}
                      >
                        ↩
                      </button>
                      <button
                        type="button"
                        className="z05-msg-action-btn"
                        title="Reaccionar con emoji"
                        onClick={() => setReactionPickerMsgId((curr) => (curr === m.id ? null : m.id))}
                      >
                        😊+
                      </button>
                    </div>
                  </div>

                  {m.replyTo && (
                    <div className="z05-msg-quote">
                      <div className="z05-msg-quote-author">
                        ↩ {stripPlusTags(m.replyTo.fromNickname || 'Mensaje')}
                      </div>
                      <div className="z05-msg-quote-text">
                        {describeMessagePreview(m.replyTo)}
                      </div>
                    </div>
                  )}

                  {m.type === 'ink' && m.mediaData && (
                    <div>
                      <img src={m.mediaData} alt="Tinta manuscrita" className="z05-ink-image" />
                    </div>
                  )}

                  {m.type === 'image' && m.mediaData && (
                    <div>
                      <img
                        src={m.mediaData}
                        alt={m.text || 'Foto enviada'}
                        className="z05-chat-photo"
                        onClick={() => setLightboxSrc(m.mediaData)}
                        title="Clic para ampliar"
                      />
                    </div>
                  )}

                  {m.type === 'voice' && m.mediaData && (
                    <div className="z05-voice-player">
                      <span title={m.text || 'Clip de voz'}>🎙️</span>
                      {m.text && <span style={{ fontSize: 10, color: '#0b3474', fontWeight: 'bold' }}>{m.text}</span>}
                      <audio controls preload="metadata" src={m.mediaData} />
                    </div>
                  )}

                  {m.type === 'text' && (
                    <span
                      style={{
                        fontFamily: m.font || 'Tahoma',
                        color: m.color || '#000000',
                        fontWeight: m.isBold ? 'bold' : 'normal',
                        fontStyle: m.isItalic ? 'italic' : 'normal'
                      }}
                    >
                      {renderFormattedText(m.text, `txt-${m.id}`, { enableLinks: true })}
                    </span>
                  )}

                  {(reactions.length > 0 || showPicker) && (
                    <div className="z05-msg-reactions">
                      {reactions.map((r) => {
                        const isMine = Array.isArray(r.userIds) && r.userIds.includes(myProfile.id);
                        return (
                          <button
                            key={r.emoji}
                            type="button"
                            className={`z05-reaction-chip ${isMine ? 'is-mine' : ''}`}
                            onClick={() => onToggleReaction?.(isGroup ? 'group' : 'dm', m.id, r.emoji)}
                            title={isMine ? 'Quitar reacción' : 'Sumar reacción'}
                          >
                            <span>{r.emoji}</span>
                            <span>{r.count}</span>
                          </button>
                        );
                      })}
                      {showPicker && (
                        <div className="z05-reaction-picker">
                          {REACTION_EMOJIS.map((em) => (
                            <button
                              key={em}
                              type="button"
                              className="z05-reaction-pick-btn"
                              onClick={() => {
                                onToggleReaction?.(isGroup ? 'group' : 'dm', m.id, em);
                                setReactionPickerMsgId(null);
                              }}
                            >
                              {em}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            <div ref={historyEndRef} />
          </div>

          {/* Retro File Transfer Progress */}
          {transferProgress && (
            <div className="z05-transfer-progress">
              <div>📁 {transferProgress.label} ({transferProgress.percent}%)</div>
              <div className="z05-progress-track">
                <div className="z05-progress-bar" style={{ width: `${transferProgress.percent}%` }} />
              </div>
            </div>
          )}

          {/* Voice recording live controls / draft preview */}
          {isRecording && (
            <div className="z05-voice-preview-bar" style={{ background: '#fff1f1', borderColor: '#e57373' }}>
              <span style={{ fontWeight: 'bold', color: '#c62828', fontSize: 12 }}>
                🔴 Grabando audio... {recordingSeconds}s / 20s
              </span>
              <button
                type="button"
                className="xp-btn xp-btn-primary"
                style={{ padding: '3px 8px', fontSize: 11 }}
                onClick={() => stopVoiceRecording(false)}
              >
                ⏹ Terminar
              </button>
              <button
                type="button"
                className="xp-btn"
                style={{ padding: '3px 8px', fontSize: 11 }}
                onClick={() => stopVoiceRecording(true)}
              >
                ✖ Cancelar
              </button>
            </div>
          )}

          {!isRecording && voiceDraft && (
            <div className="z05-voice-preview-bar">
              <span style={{ fontSize: 11, fontWeight: 'bold', color: '#0b3474' }}>
                🎙️ {voiceDraft.label}
              </span>
              <audio controls src={voiceDraft.dataUrl} style={{ height: 28, maxWidth: 190 }} />
              <button
                type="button"
                className="xp-btn xp-btn-primary"
                style={{ padding: '3px 8px', fontSize: 11 }}
                onClick={handleSendVoiceDraft}
              >
                Enviar audio
              </button>
              <button
                type="button"
                className="xp-btn"
                style={{ padding: '3px 8px', fontSize: 11 }}
                onClick={() => setVoiceDraft(null)}
              >
                🗑 Descartar
              </button>
            </div>
          )}

          {/* Reply / Quote Composer Bar */}
          {replyingTo && (
            <div className="z05-reply-bar">
              <div className="z05-reply-bar-content">
                <div style={{ fontWeight: 'bold', color: '#0046ad' }}>
                  ↩ Respondiendo a {stripPlusTags(getSenderNick(replyingTo))}
                </div>
                <div className="z05-msg-quote-text">{describeMessagePreview(replyingTo)}</div>
              </div>
              <button
                type="button"
                className="xp-btn"
                style={{ padding: '1px 6px', fontSize: 11 }}
                onClick={() => setReplyingTo(null)}
                title="Cancelar respuesta"
              >
                ✕
              </button>
            </div>
          )}

          {/* Cooldown / Error / Typing Bar */}
          <div className="z05-typing-indicator">
            {localError ? (
              <span style={{ color: '#c62828', fontStyle: 'normal' }}>⚠️ {localError}</span>
            ) : cooldownNotice ? (
              <span style={{ color: '#b71c1c', fontStyle: 'normal' }}>⏳ {cooldownNotice}</span>
            ) : isGroup && typingText ? (
              `✎ ${typingText}`
            ) : !isGroup && isTyping ? (
              `✎ ${cleanHeaderTitle} está escribiendo un mensaje...`
            ) : null}
          </div>

          {/* Toolbar */}
          <div className="z05-chat-toolbar">
            <select
              className="c05-input"
              style={{ fontSize: 11, height: 26, maxWidth: 100, padding: '1px 4px' }}
              value={selectedFont}
              onChange={(e) => setSelectedFont(e.target.value)}
              title="Fuente"
            >
              {CHAT_FONTS.map((f) => (
                <option key={f} value={f}>
                  {f.split(',')[0]}
                </option>
              ))}
            </select>

            <button
              type="button"
              className="z05-tool-btn"
              onClick={() => {
                setShowColors((v) => !v);
                setShowEmoticons(false);
                setShowWinks(false);
              }}
              title="Color de texto"
            >
              <div className="z05-color-dot" style={{ backgroundColor: selectedColor }} />
            </button>

            <button
              type="button"
              className={`z05-tool-btn ${isBold ? 'active' : ''}`}
              onClick={() => setIsBold((b) => !b)}
              style={{ fontWeight: 'bold' }}
              title="Negrita"
            >
              N
            </button>

            <button
              type="button"
              className={`z05-tool-btn ${isItalic ? 'active' : ''}`}
              onClick={() => setIsItalic((i) => !i)}
              style={{ fontStyle: 'italic', fontFamily: 'serif' }}
              title="Cursiva"
            >
              C
            </button>

            <button
              type="button"
              className="z05-tool-btn"
              onClick={() => {
                setShowEmoticons((v) => !v);
                setShowColors(false);
                setShowWinks(false);
              }}
              title="Emoticonos"
            >
              😊
            </button>

            <button
              type="button"
              className="z05-tool-btn"
              onClick={() => {
                setShowWinks((v) => !v);
                setShowEmoticons(false);
                setShowColors(false);
              }}
              title="Guiños animados"
            >
              ✨
            </button>

            <button
              type="button"
              className="z05-tool-btn"
              style={{ color: '#c62828', fontWeight: 'bold' }}
              onClick={() => onSendNudge?.(targetId)}
              title="Enviar Zumbido"
            >
              ⚡ Zumbido
            </button>

            <button
              type="button"
              className="z05-tool-btn"
              onClick={() => imageInputRef.current?.click()}
              title="Enviar foto en el chat (también puedes pegar Ctrl+V o arrastrar)"
            >
              📷
            </button>
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleImagePick}
            />

            <button
              type="button"
              className={`z05-tool-btn ${isRecording ? 'recording' : ''}`}
              onClick={() => (isRecording ? stopVoiceRecording(false) : startVoiceRecording())}
              title="Clip de voz (también con tecla F2)"
            >
              {isRecording ? `⏹ ${recordingSeconds}s` : '🎙️ Voz'}
            </button>

            <button
              type="button"
              className={`z05-tool-btn ${isInkMode ? 'active' : ''}`}
              onClick={() => setIsInkMode((v) => !v)}
              title="Tinta manuscrita"
            >
              ✍️
            </button>
          </div>

          {/* Emoticons Popup */}
          {showEmoticons && (
            <div className="z05-popup-panel" style={{ bottom: 80, left: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 'bold', marginBottom: 4, color: '#0b3474' }}>
                Emoticonos clásicos:
              </div>
              <div className="z05-emoticons-grid">
                {RETRO_EMOTICONS.map((emo) => (
                  <div
                    key={emo.code}
                    className="z05-emoticon-choice"
                    onClick={() => {
                      setInputText((prev) => `${prev}${prev ? ' ' : ''}${emo.code} `);
                      setShowEmoticons(false);
                    }}
                    title={`${emo.name} (${emo.code})`}
                  >
                    {emo.render}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Colors Popup */}
          {showColors && (
            <div className="z05-popup-panel" style={{ bottom: 80, left: 80 }}>
              <div style={{ fontSize: 11, fontWeight: 'bold', marginBottom: 4, color: '#0b3474' }}>
                Color de fuente:
              </div>
              <div className="z05-colors-grid">
                {CHAT_COLORS.map((c) => (
                  <div
                    key={c}
                    className="z05-color-choice"
                    style={{ backgroundColor: c }}
                    onClick={() => {
                      setSelectedColor(c);
                      setShowColors(false);
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Winks Popup */}
          {showWinks && (
            <div className="z05-popup-panel" style={{ bottom: 80, left: 120 }}>
              <div style={{ fontSize: 11, fontWeight: 'bold', marginBottom: 4, color: '#0b3474' }}>
                Enviar un guiño animado:
              </div>
              <div className="z05-winks-grid">
                {WINKS_CATALOG.map((w) => (
                  <div
                    key={w.id}
                    className="z05-wink-choice"
                    onClick={() => {
                      setShowWinks(false);
                      onSendWink?.(targetId, w.id);
                    }}
                  >
                    <span style={{ fontSize: 22 }}>{w.icon}</span>
                    <strong>{w.name}</strong>
                    <span style={{ fontSize: 10, color: '#666' }}>{w.desc}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Input Area or Ink Pad */}
          {isInkMode ? (
            <InkPad onSendInk={handleSendInk} onCancel={() => setIsInkMode(false)} />
          ) : (
            <div className="z05-chat-input-area">
              <textarea
                className="z05-chat-textarea"
                style={{
                  fontFamily: selectedFont,
                  color: selectedColor,
                  fontWeight: isBold ? 'bold' : 'normal',
                  fontStyle: isItalic ? 'italic' : 'normal'
                }}
                placeholder={isBlocked ? 'Contacto bloqueado' : 'Escribe un mensaje... (Enter para enviar o Ctrl+V para pegar foto)'}
                value={inputText}
                disabled={isBlocked}
                onChange={handleInputChange}
                onPaste={handlePaste}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
              />
              <button
                type="button"
                className="c05-btn c05-btn-primary z05-send-btn"
                disabled={isBlocked || !inputText.trim()}
                onClick={handleSend}
              >
                Enviar
              </button>
            </div>
          )}

          <WinksOverlay activeWink={activeWink} onWinkFinish={() => onClearWink?.(targetId)} />
        </div>
      </DraggableWindow>

      {/* Photo Lightbox */}
      {lightboxSrc && (
        <div className="z05-lightbox" onClick={() => setLightboxSrc(null)}>
          <img src={lightboxSrc} alt="Imagen ampliada" />
        </div>
      )}
    </>
  );
}
