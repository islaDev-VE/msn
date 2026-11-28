import React, { useEffect } from 'react';
import { playWinkSound } from '../../services/soundEngine';

export const WINKS_CATALOG = [
  { id: 'laugh', name: 'Risa a carcajadas', icon: '🤣', desc: 'Cara animada riéndose' },
  { id: 'water', name: 'Globo de agua', icon: '🎈', desc: 'Salpicadura en pantalla' },
  { id: 'kiss', name: 'Beso enorme', icon: '💋', desc: 'Labios con efecto pop' },
  { id: 'knock', name: 'Toc-toc cristal', icon: '👊', desc: 'Golpea tres veces la ventana' },
  { id: 'hearts', name: 'Lluvia de corazones', icon: '💖', desc: 'Corazones flotando con amor' },
  { id: 'party', name: 'Fiesta & Confeti', icon: '🎉', desc: 'Celebración retro 2005' },
  { id: 'lightning', name: 'Rayo eléctrico', icon: '⚡', desc: 'Descarga de energía pura' },
  { id: 'clap', name: 'Aplausos', icon: '👏', desc: 'Ovación de pie en pantalla' }
];

export default function WinksOverlay({ activeWink, onWinkFinish }) {
  useEffect(() => {
    if (activeWink) {
      playWinkSound(activeWink.winkId);
      const timer = setTimeout(() => {
        onWinkFinish();
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [activeWink, onWinkFinish]);

  if (!activeWink) return null;

  return (
    <div className="z05-winks-overlay">
      {activeWink.winkId === 'laugh' && (
        <div style={{ animation: 'z05-bounce-laugh 0.3s infinite alternate', textAlign: 'center' }}>
          <svg viewBox="0 0 100 100" width="150" height="150">
            <circle cx="50" cy="50" r="45" fill="#FFEB3B" stroke="#F57F17" strokeWidth="3" />
            <ellipse cx="32" cy="38" rx="8" ry="10" fill="#212121" />
            <circle cx="34" cy="36" r="3" fill="#FFFFFF" />
            <ellipse cx="68" cy="38" rx="8" ry="10" fill="#212121" />
            <circle cx="70" cy="36" r="3" fill="#FFFFFF" />
            <path d="M 22 55 Q 50 95 78 55 Z" fill="#D32F2F" stroke="#B71C1C" strokeWidth="2" />
            <path d="M 34 78 Q 50 86 66 78 Z" fill="#FF8A80" />
            <rect x="32" y="55" width="36" height="8" rx="3" fill="#FFFFFF" />
          </svg>
          <div style={{ fontSize: 18, fontWeight: 'bold', color: '#d32f2f', textShadow: '2px 2px 4px #fff', marginTop: 4 }}>
            ¡JAJAJAJAJA!
          </div>
        </div>
      )}

      {activeWink.winkId === 'water' && (
        <div style={{ position: 'relative', width: 200, height: 200, textAlign: 'center' }}>
          <svg viewBox="0 0 120 120" width="200" height="200" style={{ animation: 'z05-water-splash 2.4s forwards' }}>
            <circle cx="60" cy="60" r="50" fill="#00B0FF" opacity="0.62" />
            <circle cx="35" cy="40" r="15" fill="#40C4FF" opacity="0.82" />
            <circle cx="85" cy="45" r="18" fill="#40C4FF" opacity="0.82" />
            <circle cx="60" cy="85" r="22" fill="#0091EA" opacity="0.72" />
            <path d="M 20 60 Q 60 20 100 60 Q 60 100 20 60 Z" fill="#80D8FF" opacity="0.55" />
          </svg>
          <div style={{ position: 'absolute', bottom: 8, width: '100%', fontSize: 15, fontWeight: 'bold', color: '#0058ee', textShadow: '1px 1px 2px #fff' }}>
            💦 ¡SPLASH! 💦
          </div>
        </div>
      )}

      {activeWink.winkId === 'kiss' && (
        <div style={{ animation: 'z05-kiss-zoom 2.4s forwards', textAlign: 'center' }}>
          <svg viewBox="0 0 100 80" width="170" height="140">
            <path d="M 10 40 C 20 15, 45 25, 50 35 C 55 25, 80 15, 90 40 C 75 48, 55 45, 50 48 C 45 45, 25 48, 10 40 Z" fill="#E91E63" stroke="#880E4F" strokeWidth="2" />
            <path d="M 12 42 C 25 68, 75 68, 88 42 C 65 52, 35 52, 12 42 Z" fill="#D81B60" stroke="#880E4F" strokeWidth="2" />
            <ellipse cx="35" cy="30" rx="8" ry="3" fill="#FF80AB" opacity="0.7" />
          </svg>
          <div style={{ fontSize: 19, fontWeight: 'bold', color: '#c2185b', textShadow: '2px 2px 4px #fff', marginTop: 4 }}>
            💋 ¡MUUUAAAK! 💋
          </div>
        </div>
      )}

      {activeWink.winkId === 'knock' && (
        <div style={{ animation: 'z05-knock-screen 2.4s forwards', textAlign: 'center' }}>
          <svg viewBox="0 0 100 100" width="150" height="150">
            <circle cx="50" cy="50" r="42" fill="none" stroke="#29B6F6" strokeWidth="2" opacity="0.6" />
            <circle cx="50" cy="50" r="30" fill="none" stroke="#0288D1" strokeWidth="2" opacity="0.8" />
            <rect x="36" y="32" width="28" height="34" rx="8" fill="#FFCC80" stroke="#E65100" strokeWidth="2" />
            <circle cx="43" cy="38" r="4" fill="#FFE0B2" />
            <circle cx="50" cy="38" r="4" fill="#FFE0B2" />
            <circle cx="57" cy="38" r="4" fill="#FFE0B2" />
            <path d="M 62 48 L 74 52 L 68 62 L 60 56 Z" fill="#FFB74D" />
          </svg>
          <div style={{ fontSize: 16, fontWeight: 'bold', color: '#01579b', textShadow: '2px 2px 4px #fff' }}>
            ¡TOC! ¡TOC! ¡TOC!
          </div>
        </div>
      )}

      {activeWink.winkId === 'hearts' && (
        <div style={{ animation: 'z05-hearts-float 2.4s forwards', textAlign: 'center' }}>
          <svg viewBox="0 0 140 120" width="190" height="165">
            <path d="M70 102 C35 78, 16 55, 16 36 C16 20, 30 12, 44 12 C56 12, 65 20, 70 29 C75 20, 84 12, 96 12 C110 12, 124 20, 124 36 C124 55, 105 78, 70 102 Z" fill="#E91E63" stroke="#AD1457" strokeWidth="3" />
            <path d="M24 22 C16 14, 6 18, 8 27 C10 34, 24 41, 24 41 C24 41, 38 34, 40 27 C42 18, 32 14, 24 22 Z" fill="#FF80AB" opacity="0.9" />
            <path d="M116 24 C109 17, 100 21, 102 29 C104 35, 116 41, 116 41 C116 41, 128 35, 130 29 C132 21, 123 17, 116 24 Z" fill="#FF4081" opacity="0.9" />
          </svg>
          <div style={{ fontSize: 18, fontWeight: 'bold', color: '#ad1457', textShadow: '2px 2px 4px #fff', marginTop: 2 }}>
            💖 ¡MUCHO LOVE! 💖
          </div>
        </div>
      )}

      {activeWink.winkId === 'party' && (
        <div style={{ animation: 'z05-party-pop 2.4s forwards', textAlign: 'center' }}>
          <svg viewBox="0 0 140 120" width="190" height="165">
            <polygon points="35,105 55,40 95,80" fill="#FF9800" stroke="#E65100" strokeWidth="3" />
            <line x1="42" y1="84" x2="72" y2="62" stroke="#FFF176" strokeWidth="4" />
            <line x1="49" y1="62" x2="84" y2="71" stroke="#EC407A" strokeWidth="4" />
            <circle cx="72" cy="24" r="6" fill="#E91E63" />
            <circle cx="96" cy="30" r="5" fill="#00BCD4" />
            <circle cx="114" cy="48" r="6" fill="#4CAF50" />
            <rect x="82" y="14" width="8" height="8" rx="2" fill="#FFEB3B" transform="rotate(20 86 18)" />
            <rect x="104" y="22" width="7" height="7" rx="2" fill="#9C27B0" transform="rotate(-25 107 25)" />
            <path d="M64 38 Q78 16 94 22" fill="none" stroke="#FF5722" strokeWidth="3" />
            <path d="M78 46 Q102 32 118 46" fill="none" stroke="#2196F3" strokeWidth="3" />
          </svg>
          <div style={{ fontSize: 18, fontWeight: 'bold', color: '#e65100', textShadow: '2px 2px 4px #fff', marginTop: 2 }}>
            🎉 ¡A CELEBRAR! 🎉
          </div>
        </div>
      )}

      {activeWink.winkId === 'lightning' && (
        <div style={{ animation: 'z05-lightning-flash 2.4s forwards', textAlign: 'center' }}>
          <svg viewBox="0 0 120 120" width="180" height="180">
            <circle cx="60" cy="60" r="50" fill="#FFF9C4" opacity="0.55" />
            <polygon points="68,10 34,62 58,62 48,110 88,52 62,52" fill="#FFD600" stroke="#FF6F00" strokeWidth="3" />
          </svg>
          <div style={{ fontSize: 18, fontWeight: 'bold', color: '#f57f17', textShadow: '2px 2px 4px #fff', marginTop: 2 }}>
            ⚡ ¡PURA ENERGÍA! ⚡
          </div>
        </div>
      )}

      {activeWink.winkId === 'clap' && (
        <div style={{ animation: 'z05-clap-beat 0.35s infinite alternate', textAlign: 'center' }}>
          <div style={{ fontSize: 92, lineHeight: 1.05, filter: 'drop-shadow(0 4px 10px rgba(0,0,0,0.22))' }}>👏</div>
          <div style={{ fontSize: 18, fontWeight: 'bold', color: '#0058ee', textShadow: '2px 2px 4px #fff', marginTop: 6 }}>
            👏 ¡BRAVOOOO! 👏
          </div>
        </div>
      )}

      <style>{`
        @keyframes z05-bounce-laugh {
          from { transform: scale(1) translateY(0); }
          to { transform: scale(1.12) translateY(-14px) rotate(4deg); }
        }
        @keyframes z05-water-splash {
          0% { transform: scale(0.2) translateY(-80px); opacity: 0; }
          40% { transform: scale(1.1) translateY(0); opacity: 1; }
          75% { transform: scale(1.2); opacity: 0.9; }
          100% { transform: scale(1.3); opacity: 0; }
        }
        @keyframes z05-kiss-zoom {
          0% { transform: scale(0.1) rotate(-15deg); opacity: 0; }
          30% { transform: scale(1.2) rotate(5deg); opacity: 1; }
          70% { transform: scale(1.2) rotate(0deg); opacity: 1; }
          100% { transform: scale(1.55); opacity: 0; }
        }
        @keyframes z05-knock-screen {
          0% { transform: scale(0.7); opacity: 0; }
          20% { transform: scale(1.1); opacity: 1; }
          35% { transform: scale(0.95); }
          50% { transform: scale(1.15); }
          65% { transform: scale(0.95); }
          80% { transform: scale(1.1); opacity: 1; }
          100% { transform: scale(1.2); opacity: 0; }
        }
        @keyframes z05-hearts-float {
          0% { transform: scale(0.3) translateY(35px); opacity: 0; }
          30% { transform: scale(1.12) translateY(-6px); opacity: 1; }
          65% { transform: scale(1.04) translateY(-16px); opacity: 1; }
          100% { transform: scale(1.25) translateY(-34px); opacity: 0; }
        }
        @keyframes z05-party-pop {
          0% { transform: scale(0.2) rotate(-18deg); opacity: 0; }
          28% { transform: scale(1.18) rotate(8deg); opacity: 1; }
          72% { transform: scale(1.08) rotate(-4deg); opacity: 1; }
          100% { transform: scale(1.25) translateY(-18px); opacity: 0; }
        }
        @keyframes z05-lightning-flash {
          0% { transform: scale(0.5); opacity: 0; }
          15% { transform: scale(1.22); opacity: 1; }
          30% { transform: scale(0.95); opacity: 0.7; }
          45% { transform: scale(1.18); opacity: 1; }
          80% { transform: scale(1.08); opacity: 0.95; }
          100% { transform: scale(1.3); opacity: 0; }
        }
        @keyframes z05-clap-beat {
          from { transform: scale(0.96) rotate(-5deg); }
          to { transform: scale(1.14) rotate(5deg); }
        }
      `}</style>
    </div>
  );
}
