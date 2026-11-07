import React, { useState, useEffect, useRef } from 'react';
import { getAvatarSvg } from '../../services/avatars';
import { MSN_STATUSES } from '../../services/statusHelper';
import { MSN_EMOTICONS, parseTextWithEmoticons } from '../../services/emoticons';
import { playMessageSound, playNudgeSound } from '../../services/soundEngine';
import WinksOverlay, { WINKS_CATALOG } from './WinksOverlay';
import InkPad from './InkPad';

const MSN_FONTS = [
  'Tahoma',
  'Comic Sans MS, Comic Neue, cursive',
  'Arial',
  'Times New Roman',
  'Courier New'
];

const MSN_COLORS = [
  '#000000', '#0055ea', '#d32f2f', '#2e7d32',
  '#e65100', '#7b1fa2', '#c2185b', '#00838f',
  '#37474f', '#f57f17', '#1565c0', '#4e342e',
  '#827717', '#ad1457', '#00695c', '#4527a0'
];

export default function ChatWindow({
  contact,
  myProfile,
  roomId,
  socket,
  messages,
  onSendMessage,
  onSendNudge,
  onSendWink,
  typingUsers,
  onTypingStatus,
  onMinimize,
  onClose,
  isFocused,
  onFocus
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
  const [activeWink, setActiveWink] = useState(null);

  const historyEndRef = useRef(null);
  const typingTimerRef = useRef(null);

  // Auto scroll to bottom
  useEffect(() => {
    historyEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, activeWink, isInkMode]);

  // Handle incoming nudge/wink directly in this conversation
  useEffect(() => {
    if (!socket) return;

    const handleReceiveNudge = (data) => {
      setIsShaking(true);
      playNudgeSound();
      setTimeout(() => setIsShaking(false), 800);
    };

    const handleReceiveWink = (data) => {
      setActiveWink({ winkId: data.winkId, from: data.from });
    };

    socket.on('receive_nudge', handleReceiveNudge);
    socket.on('receive_wink', handleReceiveWink);

    return () => {
      socket.off('receive_nudge', handleReceiveNudge);
      socket.off('receive_wink', handleReceiveWink);
    };
  }, [socket]);

  // Notify typing
  const handleInputChange = (e) => {
    setInputText(e.target.value);

    onTypingStatus(true);
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      onTypingStatus(false);
    }, 1500);
  };

  const handleSend = () => {
    if (!inputText.trim()) return;

    onSendMessage({
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
    onTypingStatus(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleNudgeClick = () => {
    setIsShaking(true);
    playNudgeSound();
    onSendNudge();
    setTimeout(() => setIsShaking(false), 800);
  };

  const handleWinkSelect = (winkId) => {
    setShowWinks(false);
    setActiveWink({ winkId, from: myProfile });
    onSendWink(winkId);
  };

  const handleSendInk = (inkDataUrl) => {
    onSendMessage({
      text: '',
      inkData: inkDataUrl,
      font: selectedFont,
      color: selectedColor,
      isBold: false,
      isItalic: false
    });
    setIsInkMode(false);
  };

  const insertEmoticon = (code) => {
    setInputText((prev) => prev + ' ' + code + ' ');
    setShowEmoticons(false);
  };

  // Format timestamp (e.g., 16:42:05)
  const formatTime = (ts) => {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  // Render message text with parsed emoticons
  const renderMessageContent = (msg) => {
    if (msg.inkData) {
      return (
        <div>
          <img src={msg.inkData} alt="Tinta manuscrita de Messenger" className="msn-ink-image" />
        </div>
      );
    }

    const chunks = parseTextWithEmoticons(msg.text || '');
    return (
      <span
        style={{
          fontFamily: msg.font || 'Tahoma',
          color: msg.color || '#000000',
          fontWeight: msg.isBold ? 'bold' : 'normal',
          fontStyle: msg.isItalic ? 'italic' : 'normal'
        }}
      >
        {chunks.map((chunk, i) => {
          if (chunk.type === 'emoticon') {
            return (
              <span
                key={i}
                style={{
                  fontSize: 14,
                  verticalAlign: 'middle',
                  margin: '0 2px'
                }}
                title={chunk.data.name}
              >
                {chunk.data.render}
              </span>
            );
          }
          return <span key={i}>{chunk.value}</span>;
        })}
      </span>
    );
  };

  const isContactTyping = typingUsers.some(
    (u) => (u.socketId === contact.socketId || u.id === contact.id) && u.isTyping
  );

  return (
    <div
      className={`xp-window ${isFocused ? 'focused' : 'inactive'} ${isShaking ? 'shake-nudge' : ''}`}
      style={{
        width: 500,
        height: 480,
        top: 60,
        left: 360,
        zIndex: isFocused ? 250 : 120
      }}
      onClick={onFocus}
    >
      {/* Titlebar */}
      <div className="xp-window-titlebar">
        <div className="xp-window-title">
          <span>💬</span> {contact.nickname} - Conversación
        </div>
        <div className="xp-window-controls">
          <button className="xp-control-btn xp-btn-min" onClick={onMinimize}>
            _
          </button>
          <button className="xp-control-btn xp-btn-close" onClick={onClose}>
            ✕
          </button>
        </div>
      </div>

      {/* Menubar */}
      <div className="xp-menubar">
        <div className="xp-menu-item">Archivo</div>
        <div className="xp-menu-item">Editar</div>
        <div className="xp-menu-item">Acciones</div>
        <div className="xp-menu-item">Herramientas</div>
        <div className="xp-menu-item">Ayuda</div>
      </div>

      <div className="xp-window-body" style={{ position: 'relative' }}>
        {/* Contact Info Header */}
        <div className="msn-chat-header">
          <div className="msn-chat-contact-info">
            <div
              className="msn-chat-contact-avatar"
              dangerouslySetInnerHTML={{ __html: getAvatarSvg(contact.avatar) }}
            />
            <div className="msn-chat-contact-text">
              <div className="msn-chat-contact-name">
                {contact.nickname} &lt;{contact.email}&gt;
              </div>
              <div className="msn-chat-contact-sub">
                {contact.personalMessage || 'Sin mensaje personal'}
              </div>
            </div>
          </div>

          <div className="msn-chat-actions-bar">
            <button className="msn-action-btn" title="Iniciar llamada de audio">
              📞 Llamar
            </button>
            <button className="msn-action-btn" title="Iniciar videollamada web">
              📹 Vídeo
            </button>
            <button className="msn-action-btn" title="Enviar archivos o fotos">
              📁 Archivos
            </button>
            <button className="msn-action-btn" title="Jugar Buscaminas o Tres en raya">
              🎮 Juegos
            </button>
          </div>
        </div>

        {/* Chat History Pane */}
        <div className="msn-chat-history">
          <div className="msn-system-msg">
            Has iniciado una conversación con {contact.nickname}. No compartas contraseñas ni información confidencial.
          </div>

          {messages.map((m) => {
            if (m.type === 'nudge') {
              return (
                <div key={m.id} className="msn-nudge-msg">
                  <span>⚡</span>
                  {m.from.socketId === myProfile.socketId ? (
                    <span>¡Acabas de enviar un zumbido!</span>
                  ) : (
                    <span>¡{m.from.nickname} te acaba de enviar un zumbido!</span>
                  )}
                </div>
              );
            }

            if (m.type === 'wink') {
              return (
                <div key={m.id} className="msn-system-msg" style={{ color: '#0055ea', fontWeight: 'bold' }}>
                  ✨ {m.from.nickname} ha enviado un guiño interactivo.
                </div>
              );
            }

            const isMe = m.from?.socketId === myProfile.socketId;

            return (
              <div key={m.id} className="msn-msg-row">
                <span className="msn-msg-time">[{formatTime(m.timestamp)}]</span>
                <span
                  className="msn-msg-sender"
                  style={{ color: isMe ? '#0055ea' : '#d32f2f' }}
                >
                  {m.from?.nickname || 'Contacto'}:
                </span>
                {renderMessageContent(m)}
              </div>
            );
          })}

          <div ref={historyEndRef} />
        </div>

        {/* Typing indicator */}
        <div className="msn-typing-indicator">
          {isContactTyping && `✎ ${contact.nickname} está escribiendo un mensaje...`}
        </div>

        {/* Formatting Toolbar */}
        <div className="msn-chat-toolbar">
          {/* Font Picker */}
          <select
            className="xp-input"
            style={{ fontSize: 10, height: 22, maxWidth: 105, padding: '1px 3px' }}
            value={selectedFont}
            onChange={(e) => setSelectedFont(e.target.value)}
          >
            {MSN_FONTS.map((f) => (
              <option key={f} value={f}>
                {f.split(',')[0]}
              </option>
            ))}
          </select>

          {/* Color Picker Toggle */}
          <button
            type="button"
            className="msn-tool-btn"
            onClick={() => setShowColors(!showColors)}
            title="Color de texto"
          >
            <div className="msn-color-dot" style={{ backgroundColor: selectedColor }} />
          </button>

          {/* Bold */}
          <button
            type="button"
            className={`msn-tool-btn ${isBold ? 'active' : ''}`}
            onClick={() => setIsBold(!isBold)}
            style={{ fontWeight: 'bold' }}
            title="Negrita"
          >
            N
          </button>

          {/* Italic */}
          <button
            type="button"
            className={`msn-tool-btn ${isItalic ? 'active' : ''}`}
            onClick={() => setIsItalic(!isItalic)}
            style={{ fontStyle: 'italic', fontFamily: 'serif' }}
            title="Cursiva"
          >
            C
          </button>

          <div style={{ width: 1, height: 16, background: '#ccc', margin: '0 2px' }} />

          {/* Emoticons Picker Toggle */}
          <button
            type="button"
            className="msn-tool-btn"
            onClick={() => setShowEmoticons(!showEmoticons)}
            title="Insertar emoticonos clásicos de MSN"
          >
            😊
          </button>

          {/* Guiños / Winks Toggle */}
          <button
            type="button"
            className="msn-tool-btn"
            onClick={() => setShowWinks(!showWinks)}
            title="Enviar un guiño animado"
          >
            ✨
          </button>

          {/* ZUMBIDO / NUDGE BUTTON */}
          <button
            type="button"
            className="msn-tool-btn"
            onClick={handleNudgeClick}
            style={{ color: '#d32f2f', fontWeight: 'bold' }}
            title="¡Enviar un Zumbido! (Sacude la pantalla)"
          >
            ⚡ Zumbido
          </button>

          {/* TINTA MANUSCRITA / INK TOGGLE */}
          <button
            type="button"
            className={`msn-tool-btn ${isInkMode ? 'active' : ''}`}
            onClick={() => setIsInkMode(!isInkMode)}
            title="Tinta manuscrita (Dibujar a mano)"
          >
            ✍️ Tinta
          </button>
        </div>

        {/* Emoticons Popup Grid */}
        {showEmoticons && (
          <div className="msn-popup-panel" style={{ bottom: 70, left: 60 }}>
            <div style={{ fontSize: 10, fontWeight: 'bold', marginBottom: 4, color: '#0b3474' }}>
              Emoticonos de MSN Messenger:
            </div>
            <div className="msn-emoticons-grid">
              {MSN_EMOTICONS.map((emo) => (
                <div
                  key={emo.code}
                  className="msn-emoticon-choice"
                  onClick={() => insertEmoticon(emo.code)}
                  title={`${emo.name} (${emo.code})`}
                >
                  {emo.render}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Color Palette Popup Grid */}
        {showColors && (
          <div className="msn-popup-panel" style={{ bottom: 70, left: 100 }}>
            <div style={{ fontSize: 10, fontWeight: 'bold', marginBottom: 4, color: '#0b3474' }}>
              Selecciona color de fuente:
            </div>
            <div className="msn-colors-grid">
              {MSN_COLORS.map((c) => (
                <div
                  key={c}
                  className="msn-color-choice"
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

        {/* Winks Selector Popup */}
        {showWinks && (
          <div className="msn-popup-panel" style={{ bottom: 70, left: 140 }}>
            <div style={{ fontSize: 10, fontWeight: 'bold', marginBottom: 4, color: '#0b3474' }}>
              Elige un guiño animado:
            </div>
            <div className="msn-winks-grid">
              {WINKS_CATALOG.map((w) => (
                <div
                  key={w.id}
                  className="msn-wink-choice"
                  onClick={() => handleWinkSelect(w.id)}
                >
                  <span style={{ fontSize: 20 }}>{w.icon}</span>
                  <strong>{w.name}</strong>
                  <span style={{ fontSize: 9, color: '#666' }}>{w.desc}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Input Area or Ink Pad */}
        {isInkMode ? (
          <InkPad onSendInk={handleSendInk} onCancel={() => setIsInkMode(false)} />
        ) : (
          <div className="msn-chat-input-area">
            <textarea
              className="msn-chat-textarea"
              style={{
                fontFamily: selectedFont,
                color: selectedColor,
                fontWeight: isBold ? 'bold' : 'normal',
                fontStyle: isItalic ? 'italic' : 'normal'
              }}
              placeholder="Escribe un mensaje aquí... (Presiona Enter para enviar)"
              value={inputText}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
            />
            <button
              className="xp-btn xp-btn-primary msn-send-btn"
              onClick={handleSend}
            >
              Enviar
            </button>
          </div>
        )}

        {/* Active Wink Animation Overlay */}
        <WinksOverlay activeWink={activeWink} onWinkFinish={() => setActiveWink(null)} />
      </div>
    </div>
  );
}
