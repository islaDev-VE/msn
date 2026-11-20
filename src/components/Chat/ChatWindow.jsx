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

export default function ChatWindow({
  contact,
  myProfile,
  messages = [],
  hasMore = false,
  loadingHistory = false,
  onLoadMore,
  isTyping = false,
  shakingToken = 0,
  activeWink = null,
  onClearWink,
  cooldownNotice = '',
  onSendMessage,
  onSendNudge,
  onSendWink,
  onTypingStatus,
  onMarkRead,
  onMinimize,
  onClose,
  isFocused,
  zIndex,
  cascadeIndex = 0,
  onFocus,
  isMobile
}) {
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

  // Voice clip recording (F2 / mic button)
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordIntervalRef = useRef(null);

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
    if (isFocused && contact.unreadCount > 0) {
      onMarkRead?.(contact.id);
    }
  }, [isFocused, contact.id, contact.unreadCount, onMarkRead]);

  // Stop voice recording cleanly
  const stopVoiceRecording = useCallback(() => {
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
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setLocalError('Tu navegador no soporta grabación de clips de voz en este contexto.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : (MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : '');
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);

      audioChunksRef.current = [];
      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) audioChunksRef.current.push(ev.data);
      };

      recorder.onstop = () => {
        stream.getTracks().forEach((tr) => tr.stop());
        const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        if (blob.size < 200) return;

        setTransferProgress({ label: 'Enviando clip de voz...', percent: 45 });
        const reader = new FileReader();
        reader.onloadend = () => {
          setTransferProgress({ label: 'Enviando clip de voz...', percent: 100 });
          onSendMessage({
            toUserId: contact.id,
            type: 'voice',
            text: `Clip de voz (${Math.max(1, recordingSeconds)}s)`,
            mediaData: reader.result
          });
          setTimeout(() => setTransferProgress(null), 400);
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
            stopVoiceRecording();
            return 20;
          }
          return prev + 1;
        });
      }, 1000);
    } catch {
      setLocalError('No se obtuvo permiso para usar el micrófono.');
    }
  }, [contact.id, onSendMessage, recordingSeconds, stopVoiceRecording]);

  // F2 keyboard shortcut for retro Voice Clip recording when chat is focused
  useEffect(() => {
    if (!isFocused || isMobile) return;
    const onKeyDown = (e) => {
      if (e.key === 'F2' && !e.repeat) {
        e.preventDefault();
        if (isRecording) stopVoiceRecording();
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
    };
  }, []);

  const handleInputChange = (e) => {
    setInputText(e.target.value);
    onTypingStatus?.(contact.id, true);
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      onTypingStatus?.(contact.id, false);
    }, 1500);
  };

  const handleSend = () => {
    if (!inputText.trim()) return;
    setLocalError('');
    onSendMessage({
      toUserId: contact.id,
      type: 'text',
      text: inputText,
      font: selectedFont,
      color: selectedColor,
      isBold,
      isItalic
    });
    setInputText('');
    setShowEmoticons(false);
    setShowColors(false);
    setShowWinks(false);
    onTypingStatus?.(contact.id, false);
  };

  const handleImagePick = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLocalError('');
    try {
      setTransferProgress({ label: `Preparando ${file.name}...`, percent: 30 });
      const dataUrl = await compressChatImage(file, 800);
      setTransferProgress({ label: `Transfiriendo ${file.name}...`, percent: 85 });
      onSendMessage({
        toUserId: contact.id,
        type: 'image',
        text: file.name,
        mediaData: dataUrl
      });
      setTransferProgress({ label: 'Transferencia completada ✓', percent: 100 });
      setTimeout(() => setTransferProgress(null), 700);
    } catch (err) {
      setTransferProgress(null);
      setLocalError(err.message || 'No se pudo enviar la imagen.');
    } finally {
      e.target.value = '';
    }
  };

  const handleSendInk = (inkDataUrl) => {
    onSendMessage({
      toUserId: contact.id,
      type: 'ink',
      text: 'Nota manuscrita',
      mediaData: inkDataUrl
    });
    setIsInkMode(false);
  };

  const formatTime = (ts) => {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const cleanContactNick = stripPlusTags(contact.nickname);

  const initialX = Math.min(365 + cascadeIndex * 28, Math.max(40, window.innerWidth - 530));
  const initialY = Math.min(36 + cascadeIndex * 26, Math.max(20, window.innerHeight - 520));

  return (
    <>
      <DraggableWindow
        title={`${cleanContactNick} — Conversación`}
        titleIcon={<span>💬</span>}
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
        {/* Header with Contact Photo & Back button on Mobile */}
        <div className="z05-chat-header">
          <div className="z05-chat-contact-info">
            <button type="button" className="z05-mobile-back-btn" onClick={onClose}>
              ← Atrás
            </button>
            <div className="z05-chat-contact-avatar">
              <AvatarView avatar={contact.avatar} alt={cleanContactNick} />
            </div>
            <div className="z05-chat-contact-text">
              <div className="z05-chat-contact-name">
                {renderFormattedText(contact.nickname, `hdr-${contact.id}`)}
              </div>
              <div className="z05-chat-contact-sub">
                {contact.isOnline
                  ? (contact.personalMessage
                      ? renderFormattedText(contact.personalMessage, `hdr-msg-${contact.id}`)
                      : `${USER_STATUSES[contact.status]?.label || 'Conectado'} • ${contact.email}`)
                  : `Sin conexión (${formatLastSeen(contact.lastSeen)}) — los mensajes llegarán al conectarse`}
              </div>
            </div>
          </div>

          <div className="z05-chat-contact-avatar" style={{ width: 34, height: 34 }} title="Tu foto">
            <AvatarView avatar={myProfile.avatar} alt="Mi foto" />
          </div>
        </div>

        {/* Chat History */}
        <div className="z05-chat-history" style={{ position: 'relative' }}>
          {hasMore && (
            <button
              type="button"
              className="c05-btn z05-load-more-btn"
              disabled={loadingHistory}
              onClick={() => onLoadMore?.(contact.id)}
            >
              {loadingHistory ? 'Cargando...' : '▲ Cargar mensajes anteriores'}
            </button>
          )}

          {messages.length === 0 && !loadingHistory && (
            <div className="z05-system-msg">
              Conversación privada con {cleanContactNick}. El historial se guarda automáticamente.
            </div>
          )}

          {messages.map((m) => {
            const isMe = m.fromUserId === myProfile.id;
            const senderNick = isMe ? myProfile.nickname : contact.nickname;

            if (m.type === 'nudge') {
              return (
                <div key={m.id} className="z05-nudge-msg">
                  <span>⚡</span>
                  <span>
                    {isMe
                      ? '¡Acabas de enviar un zumbido!'
                      : `¡${stripPlusTags(senderNick)} te acaba de enviar un zumbido!`}
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

            return (
              <div key={m.id} className="z05-msg-row">
                <span className="z05-msg-time">[{formatTime(m.timestamp)}]</span>
                <span className="z05-msg-sender" style={{ color: isMe ? '#0055ea' : '#c62828' }}>
                  {renderFormattedText(senderNick, `snd-${m.id}`)}:
                </span>

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
                    <span>🎙️</span>
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
                    {renderFormattedText(m.text, `txt-${m.id}`)}
                  </span>
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

        {/* Cooldown / Error / Typing Bar */}
        <div className="z05-typing-indicator">
          {localError ? (
            <span style={{ color: '#c62828', fontStyle: 'normal' }}>⚠️ {localError}</span>
          ) : cooldownNotice ? (
            <span style={{ color: '#b71c1c', fontStyle: 'normal' }}>⏳ {cooldownNotice}</span>
          ) : isTyping ? (
            `✎ ${cleanContactNick} está escribiendo un mensaje...`
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
            onClick={() => onSendNudge?.(contact.id)}
            title="Enviar Zumbido"
          >
            ⚡ Zumbido
          </button>

          <button
            type="button"
            className="z05-tool-btn"
            onClick={() => imageInputRef.current?.click()}
            title="Enviar foto en el chat"
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
            onClick={isRecording ? stopVoiceRecording : startVoiceRecording}
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
                    onSendWink?.(contact.id, w.id);
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
              placeholder={contact.isBlocked ? 'Contacto bloqueado' : 'Escribe un mensaje... (Enter para enviar)'}
              value={inputText}
              disabled={contact.isBlocked}
              onChange={handleInputChange}
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
              disabled={contact.isBlocked || !inputText.trim()}
              onClick={handleSend}
            >
              Enviar
            </button>
          </div>
        )}

        <WinksOverlay activeWink={activeWink} onWinkFinish={() => onClearWink?.(contact.id)} />
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
