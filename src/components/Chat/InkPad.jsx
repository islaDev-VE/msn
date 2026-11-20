import React, { useRef, useState, useEffect } from 'react';

export default function InkPad({ onSendInk, onCancel }) {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [penColor, setPenColor] = useState('#000000');
  const [penWidth, setPenWidth] = useState(3);
  const [hasStrokes, setHasStrokes] = useState(false);

  const colors = ['#000000', '#0055ea', '#d32f2f', '#2e7d32', '#f57c00', '#7b1fa2'];

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const parentW = canvas.parentElement?.clientWidth || 320;
      canvas.width = Math.max(220, parentW - 14);
      canvas.height = 120;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
    }
  }, []);

  const getCoords = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  };

  const handlePointerDown = (e) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDrawing(true);
    setHasStrokes(true);
    const ctx = canvasRef.current.getContext('2d');
    const { x, y } = getCoords(e);
    ctx.strokeStyle = penColor;
    ctx.lineWidth = penWidth;
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const handlePointerMove = (e) => {
    if (!isDrawing) return;
    e.preventDefault();
    const ctx = canvasRef.current.getContext('2d');
    const { x, y } = getCoords(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const handlePointerUp = (e) => {
    if (!isDrawing) return;
    setIsDrawing(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setHasStrokes(false);
  };

  const handleSend = () => {
    if (!hasStrokes) return;
    const dataUrl = canvasRef.current.toDataURL('image/png');
    onSendInk(dataUrl);
    clearCanvas();
  };

  return (
    <div className="z05-ink-pad-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 11, fontWeight: 'bold', color: '#0b3474' }}>
          ✍️ Tinta manuscrita (mouse o dedo):
        </span>
        <button type="button" className="c05-btn" style={{ fontSize: 10, padding: '2px 7px' }} onClick={onCancel}>
          Volver a teclado
        </button>
      </div>

      <canvas
        ref={canvasRef}
        className="z05-ink-canvas"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      />

      <div className="z05-ink-toolbar">
        <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
          {colors.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setPenColor(c)}
              style={{
                width: 18,
                height: 18,
                backgroundColor: c,
                border: penColor === c ? '2px solid #0055ea' : '1px solid #777',
                borderRadius: 2,
                cursor: 'pointer'
              }}
              aria-label={`Color ${c}`}
            />
          ))}

          <div style={{ display: 'flex', gap: 3, marginLeft: 4 }}>
            {[2, 4, 7].map((w) => (
              <button
                key={w}
                type="button"
                className={`c05-btn ${penWidth === w ? 'c05-btn-primary' : ''}`}
                style={{ padding: '2px 6px', fontSize: 9 }}
                onClick={() => setPenWidth(w)}
              >
                ●
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 6 }}>
          <button type="button" className="c05-btn" onClick={clearCanvas}>
            Borrar
          </button>
          <button type="button" className="c05-btn c05-btn-primary" disabled={!hasStrokes} onClick={handleSend}>
            Enviar dibujo
          </button>
        </div>
      </div>
    </div>
  );
}
