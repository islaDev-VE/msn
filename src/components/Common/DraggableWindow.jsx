import React, { useState, useRef, useEffect } from 'react';

/**
 * Reliable PointerEvents-based draggable window for Classic Desktop 05.
 * Automatically switches to native fullscreen layout on mobile (< 768px).
 */
export default function DraggableWindow({
  title,
  titleIcon = null,
  initialX = 40,
  initialY = 30,
  width = 340,
  height = 520,
  zIndex = 200,
  isFocused = true,
  isMobile = false,
  mobileChatMode = false,
  extraClassName = '',
  onFocus,
  onMinimize,
  onClose,
  hideMinimize = false,
  hideClose = false,
  children
}) {
  const [pos, setPos] = useState(() => ({ x: initialX, y: initialY }));
  const dragRef = useRef(null);
  const winRef = useRef(null);

  // Clamp position if viewport resizes so titlebar never gets lost off-screen
  useEffect(() => {
    if (isMobile) return;
    const handleResize = () => {
      setPos((prev) => {
        const maxX = Math.max(0, window.innerWidth - 120);
        const maxY = Math.max(0, window.innerHeight - 72);
        return {
          x: Math.min(Math.max(prev.x, -Math.floor(width * 0.5)), maxX),
          y: Math.min(Math.max(prev.y, 0), maxY)
        };
      });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isMobile, width]);

  const handlePointerDown = (e) => {
    if (isMobile) return;
    // Do not start drag if user clicked on minimize/close buttons
    if (e.target.closest('button')) return;
    if (e.button !== undefined && e.button !== 0) return;

    onFocus?.();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      originX: pos.x,
      originY: pos.y
    };
  };

  const handlePointerMove = (e) => {
    if (!dragRef.current || dragRef.current.pointerId !== e.pointerId) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;

    const minX = -Math.floor(width * 0.65);
    const maxX = Math.max(20, window.innerWidth - 100);
    const maxY = Math.max(20, window.innerHeight - 66);

    const nextX = Math.min(Math.max(dragRef.current.originX + dx, minX), maxX);
    const nextY = Math.min(Math.max(dragRef.current.originY + dy, 0), maxY);
    setPos({ x: nextX, y: nextY });
  };

  const handlePointerUp = (e) => {
    if (dragRef.current && dragRef.current.pointerId === e.pointerId) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // ignore if already released
      }
      dragRef.current = null;
    }
  };

  const desktopStyle = isMobile
    ? { zIndex }
    : {
        width,
        height: height === 'auto' ? 'auto' : height,
        left: pos.x,
        top: pos.y,
        zIndex
      };

  const classes = [
    'c05-window',
    isFocused ? 'focused' : 'inactive',
    isMobile ? 'c05-mobile-fullscreen' : '',
    isMobile && mobileChatMode ? 'c05-mobile-chat-open' : '',
    extraClassName
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      ref={winRef}
      className={classes}
      style={desktopStyle}
      onMouseDown={() => onFocus?.()}
    >
      <div
        className="c05-window-titlebar"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <div className="c05-window-title">
          {titleIcon}
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</span>
        </div>
        <div className="c05-window-controls">
          {!isMobile && !hideMinimize && onMinimize && (
            <button
              type="button"
              className="c05-control-btn c05-btn-min"
              title="Minimizar"
              onClick={(e) => {
                e.stopPropagation();
                onMinimize();
              }}
            >
              _
            </button>
          )}
          {!hideClose && onClose && (
            <button
              type="button"
              className="c05-control-btn c05-btn-close"
              title="Cerrar"
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
            >
              ✕
            </button>
          )}
        </div>
      </div>

      <div className="c05-window-body">{children}</div>
    </div>
  );
}
