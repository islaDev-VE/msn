import React from 'react';

// Original 2005-inspired Retro Display Pictures (100% original SVGs)
export const RETRO_AVATARS = [
  {
    id: 'bubbles',
    name: 'Burbujas Zumbido',
    svg: `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="avBg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#d7eeff"/>
          <stop offset="100%" stop-color="#9ccdff"/>
        </linearGradient>
        <linearGradient id="avB1" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#76d3ff"/>
          <stop offset="100%" stop-color="#0060df"/>
        </linearGradient>
        <linearGradient id="avB2" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#b4f562"/>
          <stop offset="100%" stop-color="#2d9e1b"/>
        </linearGradient>
      </defs>
      <rect width="64" height="64" fill="url(#avBg)"/>
      <path d="M9 22 C9 13 17 9 27 9 C38 9 45 14 45 22 C45 30 38 35 27 35 L19 35 L10 42 L13 33 C10 30 9 26 9 22 Z" fill="url(#avB1)" stroke="#ffffff" stroke-width="2"/>
      <ellipse cx="26" cy="15" rx="11" ry="3.5" fill="#ffffff" opacity="0.45"/>
      <path d="M20 38 C20 30 27 25 38 25 C49 25 56 30 56 38 C56 46 49 51 39 51 L48 58 L35 51 C26 51 20 45 20 38 Z" fill="url(#avB2)" stroke="#ffffff" stroke-width="2"/>
      <ellipse cx="38" cy="31" rx="11" ry="3.5" fill="#ffffff" opacity="0.45"/>
      <circle cx="32" cy="39" r="2.2" fill="#ffffff"/>
      <circle cx="38" cy="39" r="2.2" fill="#ffffff"/>
      <circle cx="44" cy="39" r="2.2" fill="#ffffff"/>
    </svg>`
  },
  {
    id: 'soccer',
    name: 'Balón de Fútbol',
    svg: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="48" height="48" fill="#DFF0D8"/>
      <circle cx="24" cy="24" r="18" fill="#FFFFFF" stroke="#333333" stroke-width="2"/>
      <polygon points="24,16 19,20 21,25 27,25 29,20" fill="#222222"/>
      <line x1="24" y1="16" x2="24" y2="8" stroke="#222222" stroke-width="1.5"/>
      <line x1="19" y1="20" x2="11" y2="18" stroke="#222222" stroke-width="1.5"/>
      <line x1="21" y1="25" x2="15" y2="33" stroke="#222222" stroke-width="1.5"/>
      <line x1="27" y1="25" x2="33" y2="33" stroke="#222222" stroke-width="1.5"/>
      <line x1="29" y1="20" x2="37" y2="18" stroke="#222222" stroke-width="1.5"/>
    </svg>`
  },
  {
    id: 'guitar',
    name: 'Guitarra Rock',
    svg: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="48" height="48" fill="#FCE4EC"/>
      <path d="M14 36 C10 32, 10 24, 18 20 C22 18, 26 22, 28 26 C30 34, 20 42, 14 36 Z" fill="#D32F2F"/>
      <line x1="23" y1="21" x2="38" y2="8" stroke="#8D6E63" stroke-width="3"/>
      <circle cx="39" cy="7" r="2.5" fill="#5D4037"/>
      <circle cx="18" cy="28" r="3.5" fill="#212121"/>
    </svg>`
  },
  {
    id: 'duck',
    name: 'Patito de Goma',
    svg: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="48" height="48" fill="#E1F5FE"/>
      <ellipse cx="22" cy="28" rx="14" ry="10" fill="#FFEB3B"/>
      <circle cx="30" cy="18" r="8" fill="#FFEB3B"/>
      <path d="M37 17 C41 18, 41 21, 36 21 Z" fill="#FF9800"/>
      <circle cx="32" cy="16" r="1.5" fill="#212121"/>
    </svg>`
  },
  {
    id: 'palm',
    name: 'Palmera Playa',
    svg: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="48" height="48" fill="#FFF9C4"/>
      <path d="M22 42 Q23 28 26 18" stroke="#795548" stroke-width="4" stroke-linecap="round"/>
      <path d="M26 18 Q14 14 10 20" stroke="#4CAF50" stroke-width="3" fill="none"/>
      <path d="M26 18 Q20 10 24 6" stroke="#4CAF50" stroke-width="3" fill="none"/>
      <path d="M26 18 Q34 10 36 6" stroke="#4CAF50" stroke-width="3" fill="none"/>
      <path d="M26 18 Q38 14 40 20" stroke="#4CAF50" stroke-width="3" fill="none"/>
    </svg>`
  },
  {
    id: 'cat',
    name: 'Gatito Curioso',
    svg: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="48" height="48" fill="#EDE7F6"/>
      <circle cx="24" cy="26" r="13" fill="#FFB74D"/>
      <polygon points="14,19 14,10 21,16" fill="#FFB74D"/>
      <polygon points="34,19 34,10 27,16" fill="#FFB74D"/>
      <circle cx="19" cy="25" r="2" fill="#2E7D32"/>
      <circle cx="29" cy="25" r="2" fill="#2E7D32"/>
      <polygon points="24,28 22,30 26,30" fill="#E91E63"/>
      <line x1="16" y1="29" x2="8" y2="28" stroke="#795548"/>
      <line x1="32" y1="29" x2="40" y2="28" stroke="#795548"/>
    </svg>`
  },
  {
    id: 'headphones',
    name: 'Auriculares 2005',
    svg: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="48" height="48" fill="#E8EAF6"/>
      <path d="M11 26 C11 14 37 14 37 26" stroke="#1E88E5" stroke-width="4" stroke-linecap="round"/>
      <rect x="8" y="24" width="7" height="14" rx="3.5" fill="#1565C0"/>
      <rect x="33" y="24" width="7" height="14" rx="3.5" fill="#1565C0"/>
      <circle cx="24" cy="30" r="4" fill="#43A047"/>
    </svg>`
  },
  {
    id: 'star',
    name: 'Estrella Glossy',
    svg: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="48" height="48" fill="#FFF3E0"/>
      <polygon points="24,6 29.5,17.5 42,19 33,28 35,40.5 24,34.5 13,40.5 15,28 6,19 18.5,17.5" fill="#FFB300" stroke="#EF6C00" stroke-width="2"/>
    </svg>`
  }
];

export function isRealPhotoAvatar(avatar) {
  return typeof avatar === 'string' && (avatar.startsWith('data:image/') || avatar.startsWith('http://') || avatar.startsWith('https://'));
}

export function getAvatarSvg(avatarId) {
  const item = RETRO_AVATARS.find((a) => a.id === avatarId);
  return item ? item.svg : RETRO_AVATARS[0].svg;
}

export function AvatarView({ avatar, alt = 'Foto de perfil', className = 'z05-avatar-img' }) {
  if (isRealPhotoAvatar(avatar)) {
    return <img src={avatar} alt={alt} className={className} draggable={false} />;
  }
  return (
    <div
      className={className}
      style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      dangerouslySetInnerHTML={{ __html: getAvatarSvg(avatar) }}
    />
  );
}
