import React from 'react';
import ZumbidoLogo from '../Common/ZumbidoLogo';

export default function AboutModal({ onClose }) {
  return (
    <div className="c05-modal-backdrop" onClick={onClose}>
      <div
        className="c05-window focused"
        style={{ position: 'relative', width: 430, maxWidth: '94vw', maxHeight: '90vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="c05-window-titlebar" style={{ cursor: 'default' }}>
          <div className="c05-window-title">
            <ZumbidoLogo size={16} />
            <span>Acerca de Zumbido 05 • islaDev</span>
          </div>
          <div className="c05-window-controls">
            <button type="button" className="c05-control-btn c05-btn-close" onClick={onClose}>
              ✕
            </button>
          </div>
        </div>

        <div className="c05-window-body" style={{ padding: 16, gap: 12, overflowY: 'auto' }}>
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
            tinta manuscrita, clips de voz y notificaciones Push, creada con estética nostálgica de
            los años 2000.
          </p>

          {/* Developer Card — islaDev */}
          <div
            style={{
              background: 'linear-gradient(135deg, #0f172a 0%, #162640 100%)',
              border: '1px solid #0891b2',
              borderRadius: 6,
              padding: 12,
              color: '#e2e8f0',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.12)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <img
                src="/icons/isladev-logo.png"
                alt="islaDev"
                style={{ width: 72, height: 'auto', flexShrink: 0, filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.45))' }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.8, color: '#38bdf8', fontWeight: 'bold' }}>
                  Desarrollado por
                </div>
                <div style={{ fontSize: 15, fontWeight: 'bold', color: '#ffffff' }}>
                  islaDev Digital Studio
                </div>
                <div style={{ fontSize: 11, color: '#cbd5e1', marginTop: 2 }}>
                  Desarrollamos con amor desde la Isla de Margarita, Venezuela 🌴
                </div>
              </div>
            </div>

            <div style={{ fontSize: 11, color: '#cbd5e1', lineHeight: 1.45 }}>
              Agencia boutique de ingeniería de software a la medida, sistemas web empresariales,
              plataformas SaaS y aplicaciones modernas.
            </div>

            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <a
                href="https://isladev.com"
                target="_blank"
                rel="noopener noreferrer"
                className="c05-btn c05-btn-primary"
                style={{ textDecoration: 'none', fontSize: 11 }}
              >
                🌐 Visitar isladev.com
              </a>
              <a
                href="https://wa.me/584122547691?text=Hola%20islaDev!%20Vi%20Zumbido%2005%20y%20quiero%20conversar%20sobre%20un%20proyecto."
                target="_blank"
                rel="noopener noreferrer"
                className="c05-btn z05-invite-btn-wa"
                style={{ textDecoration: 'none', fontSize: 11 }}
              >
                💬 WhatsApp
              </a>
              <a
                href="mailto:somos@isladev.com"
                className="c05-btn"
                style={{ textDecoration: 'none', fontSize: 11 }}
              >
                📧 somos@isladev.com
              </a>
            </div>
          </div>

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
