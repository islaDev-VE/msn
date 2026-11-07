import React, { useEffect } from 'react';
import { playWinkSound } from '../../services/soundEngine';

export const WINKS_CATALOG = [
  {
    id: 'laugh',
    name: 'Risa a carcajadas',
    icon: '🤣',
    desc: 'Cara animada riéndose sin parar'
  },
  {
    id: 'water',
    name: 'Globo de agua',
    icon: '🎈',
    desc: 'Explosión de agua que moja la pantalla'
  },
  {
    id: 'kiss',
    name: 'Beso enorme',
    icon: '💋',
    desc: 'Labios que estampan un beso con sonido'
  },
  {
    id: 'knock',
    name: 'Golpe a la pantalla',
    icon: '👊',
    desc: 'Toca el cristal tres veces: toc, toc, toc'
  }
];

export default function WinksOverlay({ activeWink, onWinkFinish }) {
  useEffect(() => {
    if (activeWink) {
      playWinkSound(activeWink.winkId);
      const timer = setTimeout(() => {
        onWinkFinish();
      }, 2600);
      return () => clearTimeout(timer);
    }
  }, [activeWink, onWinkFinish]);

  if (!activeWink) return null;

  return (
    <div className="msn-winks-overlay">
      {activeWink.winkId === 'laugh' && (
        <div style={{ animation: 'bounce-laugh 0.3s infinite alternate', textAlign: 'center' }}>
          <svg viewBox="0 0 100 100" width="160" height="160">
            <circle cx="50" cy="50" r="45" fill="#FFEB3B" stroke="#F57F17" strokeWidth="3" />
            <ellipse cx="32" cy="38" rx="8" ry="10" fill="#212121" />
            <circle cx="34" cy="36" r="3" fill="#FFFFFF" />
            <ellipse cx="68" cy="38" rx="8" ry="10" fill="#212121" />
            <circle cx="70" cy="36" r="3" fill="#FFFFFF" />
            {/* Wide Laughing Mouth */}
            <path d="M 22 55 Q 50 95 78 55 Z" fill="#D32F2F" stroke="#B71C1C" strokeWidth="2" />
            <path d="M 34 78 Q 50 86 66 78 Z" fill="#FF8A80" />
            {/* White Teeth */}
            <rect x="32" y="55" width="36" height="8" rx="3" fill="#FFFFFF" />
          </svg>
          <div
            style={{
              fontSize: 18,
              fontWeight: 'bold',
              color: '#d32f2f',
              textShadow: '2px 2px 4px #fff',
              marginTop: 6
            }}
          >
            ¡JAJAJAJAJA!
          </div>
        </div>
      )}

      {activeWink.winkId === 'water' && (
        <div style={{ position: 'relative', width: 220, height: 220, textAlign: 'center' }}>
          <svg viewBox="0 0 120 120" width="220" height="220" style={{ animation: 'water-splash 2.4s forwards' }}>
            <circle cx="60" cy="60" r="50" fill="#00B0FF" opacity="0.6" />
            <circle cx="35" cy="40" r="15" fill="#40C4FF" opacity="0.8" />
            <circle cx="85" cy="45" r="18" fill="#40C4FF" opacity="0.8" />
            <circle cx="60" cy="85" r="22" fill="#0091EA" opacity="0.7" />
            <path d="M 20 60 Q 60 20 100 60 Q 60 100 20 60 Z" fill="#80D8FF" opacity="0.5" />
          </svg>
          <div
            style={{
              position: 'absolute',
              bottom: 10,
              width: '100%',
              fontSize: 14,
              fontWeight: 'bold',
              color: '#0058ee',
              textShadow: '1px 1px 2px #fff'
            }}
          >
            💦 ¡SPLASH! 💦
          </div>
        </div>
      )}

      {activeWink.winkId === 'kiss' && (
        <div style={{ animation: 'kiss-zoom 2.4s forwards', textAlign: 'center' }}>
          <svg viewBox="0 0 100 80" width="180" height="150">
            <path
              d="M 10 40 C 20 15, 45 25, 50 35 C 55 25, 80 15, 90 40 C 75 48, 55 45, 50 48 C 45 45, 25 48, 10 40 Z"
              fill="#E91E63"
              stroke="#880E4F"
              strokeWidth="2"
            />
            <path
              d="M 12 42 C 25 68, 75 68, 88 42 C 65 52, 35 52, 12 42 Z"
              fill="#D81B60"
              stroke="#880E4F"
              strokeWidth="2"
            />
            <ellipse cx="35" cy="30" rx="8" ry="3" fill="#FF80AB" opacity="0.7" />
          </svg>
          <div
            style={{
              fontSize: 20,
              fontWeight: 'bold',
              color: '#c2185b',
              textShadow: '2px 2px 4px #fff',
              marginTop: 4
            }}
          >
            💋 ¡MUUUAAAK! 💋
          </div>
        </div>
      )}

      {activeWink.winkId === 'knock' && (
        <div style={{ animation: 'knock-screen 2.4s forwards', textAlign: 'center' }}>
          <svg viewBox="0 0 100 100" width="160" height="160">
            {/* Screen Shockwave Rings */}
            <circle cx="50" cy="50" r="42" fill="none" stroke="#29B6F6" strokeWidth="2" opacity="0.6" />
            <circle cx="50" cy="50" r="30" fill="none" stroke="#0288D1" strokeWidth="2" opacity="0.8" />
            {/* Hand Knocking Fist */}
            <rect x="36" y="32" width="28" height="34" rx="8" fill="#FFCC80" stroke="#E65100" strokeWidth="2" />
            <circle cx="43" cy="38" r="4" fill="#FFE0B2" />
            <circle cx="50" cy="38" r="4" fill="#FFE0B2" />
            <circle cx="57" cy="38" r="4" fill="#FFE0B2" />
            <path d="M 62 48 L 74 52 L 68 62 L 60 56 Z" fill="#FFB74D" />
          </svg>
          <div
            style={{
              fontSize: 16,
              fontWeight: 'bold',
              color: '#01579b',
              textShadow: '2px 2px 4px #fff'
            }}
          >
            ¡TOC! ¡TOC! ¡TOC!
          </div>
        </div>
      )}

      <style>{`
        @keyframes bounce-laugh {
          from { transform: scale(1) translateY(0); }
          to { transform: scale(1.12) translateY(-14px) rotate(4deg); }
        }
        @keyframes water-splash {
          0% { transform: scale(0.2) translateY(-80px); opacity: 0; }
          40% { transform: scale(1.1) translateY(0); opacity: 1; }
          75% { transform: scale(1.2); opacity: 0.9; }
          100% { transform: scale(1.3); opacity: 0; }
        }
        @keyframes kiss-zoom {
          0% { transform: scale(0.1) rotate(-15deg); opacity: 0; }
          30% { transform: scale(1.2) rotate(5deg); opacity: 1; }
          70% { transform: scale(1.2) rotate(0deg); opacity: 1; }
          100% { transform: scale(1.6); opacity: 0; }
        }
        @keyframes knock-screen {
          0% { transform: scale(0.7); opacity: 0; }
          20% { transform: scale(1.1); opacity: 1; }
          35% { transform: scale(0.95); }
          50% { transform: scale(1.15); }
          65% { transform: scale(0.95); }
          80% { transform: scale(1.1); opacity: 1; }
          100% { transform: scale(1.2); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
