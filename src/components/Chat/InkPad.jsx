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
      canvas.width = canvas.parentElement.clientWidth - 16;
      canvas.height = 110;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
    }
  }, []);

  const getCanvasCoords = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  };

  const startDrawing = (e) => {
    setIsDrawing(true);
    setHasStrokes(true);
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const { x, y } = getCanvasCoords(e);
    ctx.strokeStyle = penColor;
    ctx.lineWidth = penWidth;
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const { x, y } = getCanvasCoords(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      setHasStrokes(false);
    }
  };

  const handleSend = () => {
    if (!hasStrokes) return;
    const canvas = canvasRef.current;
    const dataUrl = canvas.toDataURL('image/png');
    onSendInk(dataUrl);
    clearCanvas();
  };

  return (
    <div className="msn-ink-pad-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 10, fontWeight: 'bold', color: '#0b3474' }}>
          ✍️ Tinta manuscrita de Messenger:
        </span>
        <button
          className="xp-btn"
          style={{ fontSize: 9, padding: '1px 5px' }}
          onClick={onCancel}
        >
          Volver a teclado
        </button>
      </div>

      <canvas
        ref={canvasRef}
        className="msn-ink-canvas"
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
        onTouchStart={startDrawing}
        onTouchMove={draw}
        onTouchEnd={stopDrawing}
      />

      <div className="msn-ink-toolbar">
        {/* Colors */}
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          {colors.map((c) => (
            <div
              key={c}
              onClick={() => setPenColor(c)}
              style={{
                width: 14,
                height: 14,
                backgroundColor: c,
                border: penColor === c ? '2px solid #0055ea' : '1px solid #777',
                borderRadius: 2,
                cursor: 'pointer'
              }}
            />
          ))}

          {/* Width */}
          <div style={{ display: 'flex', gap: 3, marginLeft: 6 }}>
            {[2, 4, 7].map((w) => (
              <button
                key={w}
                type="button"
                className={`xp-btn ${penWidth === w ? 'xp-btn-primary' : ''}`}
                style={{ padding: '1px 4px', fontSize: 9 }}
                onClick={() => setPenWidth(w)}
              >
                ●
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 6 }}>
          <button
            type="button"
            className="xp-btn"
            style={{ fontSize: 10 }}
            onClick={clearCanvas}
          >
            Borrar todo
          </button>
          <button
            type="button"
            className="xp-btn xp-btn-primary"
            style={{ fontSize: 10, fontWeight: 'bold' }}
            disabled={!hasStrokes}
            onClick={handleSend}
          >
            Enviar dibujo
          </button>
        </div>
      </div>
    </div>
  );
}
