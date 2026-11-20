import React, { useId } from 'react';

/**
 * Official original Zumbido 05 glossy 3D dual chat-bubbles logo (2005 aesthetic)
 */
export default function ZumbidoLogo({ size = 24, style = {} }) {
  const uid = useId().replace(/:/g, '');
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0, ...style }}
      aria-label="Zumbido 05"
    >
      <defs>
        <linearGradient id={`zb1-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#80d8ff" />
          <stop offset="55%" stopColor="#1b88f5" />
          <stop offset="100%" stopColor="#0052cc" />
        </linearGradient>
        <linearGradient id={`zb2-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#c4fa69" />
          <stop offset="55%" stopColor="#58c733" />
          <stop offset="100%" stopColor="#268f17" />
        </linearGradient>
        <filter id={`zsh-${uid}`} x="-15%" y="-15%" width="130%" height="130%">
          <feDropShadow dx="0" dy="2" stdDeviation="1.8" floodColor="#001b4d" floodOpacity="0.4" />
        </filter>
      </defs>
      {/* Back Blue Glossy Bubble */}
      <g filter={`url(#zsh-${uid})`}>
        <path
          d="M7 22 C7 12 16 7 28 7 C40 7 48 13 48 22 C48 31 40 36 28 36 L19 36 L9 44 L13 34 C9 31 7 27 7 22 Z"
          fill={`url(#zb1-${uid})`}
          stroke="#ffffff"
          strokeWidth="2.2"
          strokeLinejoin="round"
        />
        <ellipse cx="27" cy="14" rx="13" ry="4" fill="#ffffff" opacity="0.48" />
      </g>
      {/* Front Lime-Green Glossy Bubble */}
      <g filter={`url(#zsh-${uid})`}>
        <path
          d="M19 38 C19 29 27 23 39 23 C51 23 58 29 58 38 C58 46 51 52 40 52 L50 60 L35 52 C25 52 19 46 19 38 Z"
          fill={`url(#zb2-${uid})`}
          stroke="#ffffff"
          strokeWidth="2.2"
          strokeLinejoin="round"
        />
        <ellipse cx="38" cy="30" rx="12" ry="3.8" fill="#ffffff" opacity="0.48" />
        <circle cx="31.5" cy="39" r="2.4" fill="#ffffff" />
        <circle cx="38.5" cy="39" r="2.4" fill="#ffffff" />
        <circle cx="45.5" cy="39" r="2.4" fill="#ffffff" />
      </g>
    </svg>
  );
}
