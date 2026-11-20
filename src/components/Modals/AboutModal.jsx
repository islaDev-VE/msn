import React from 'react';
import ZumbidoLogo from '../Common/ZumbidoLogo';

export default function AboutModal({ onClose }) {
  return (
    <div className="c05-modal-backdrop" onClick={onClose}>
      <div
        className="c05-window focused"
        style={{ position: 'relative', width: 410, maxWidth: '94vw' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="c05-window-titlebar" style={{ cursor: 'default' }}>
          <div className="c05-window-title">
            <ZumbidoLogo size={16} />
            <span>Acerca de Zumbido 05</span>
          </div>
          <div className="c05-window-controls">
            <button type="button" className="c05-control-btn c05-btn-close" onClick={onClose}>
              ✕
            </button>
          </div>
        </div>

        <div className="c05-window-body" style={{ padding: 16, gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <ZumbidoLogo size={54} />
            <div>
              <h3 style={{ color: '#0b3474', fontSize: 16 }}>Zumbido 05</h3>
              <div style={{ fontSize: 11, color: '#555' }}>
                Edición Retro 7.5 • Aplicación Web Progresiva (PWA)
              </div>
            </div>
          </div>

          <p style={{ fontSize: 12, color: '#222', lineHeight: 1.5 }}>
            <strong>Zumbido 05</strong> es una plataforma de mensajería instantánea en tiempo real
            con base de datos persistente, fotos de perfil reales, zumbidos, guiños animados,
            tinta manuscrita y clips de voz, creada con estética nostálgica de los años 2000.
          </p>

          <div
            style={{
              background: '#eef4ff',
              border: '1px solid #b8cde8',
              borderRadius: 4,
              padding: '8px 10px',
              fontSize: 11,
              color: '#1b3a68',
              lineHeight: 1.45
            }}
          >
            <strong>Aviso de independencia:</strong> Zumbido 05 es un proyecto de software
            independiente inspirado en la estética clásica de la mensajería de los años 2000.
            Todos sus gráficos, sonidos procedurales y código son originales. No está afiliado,
            asociado, patrocinado ni respaldado por Microsoft Corporation ni por ninguna otra marca
            comercial.
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button type="button" className="c05-btn c05-btn-primary" onClick={onClose}>
              Aceptar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
