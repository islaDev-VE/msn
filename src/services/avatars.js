// Authentic MSN Messenger 7.5 Retro Display Pictures (SVG based)

export const RETRO_AVATARS = [
  {
    id: 'butterfly',
    name: 'Mariposa MSN',
    svg: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="48" height="48" fill="#E8F4FD"/>
      <path d="M12 16 C4 6, 18 4, 22 14 C24 19, 18 24, 12 16 Z" fill="#00B0F0"/>
      <path d="M36 16 C44 6, 30 4, 26 14 C24 19, 30 24, 36 16 Z" fill="#FF9900"/>
      <path d="M15 32 C6 38, 20 42, 23 34 C25 28, 18 27, 15 32 Z" fill="#70AD47"/>
      <path d="M33 32 C42 38, 28 42, 25 34 C23 28, 30 27, 33 32 Z" fill="#ED7D31"/>
      <ellipse cx="24" cy="24" rx="4" ry="11" fill="#0078D7"/>
      <circle cx="24" cy="12" r="3" fill="#0078D7"/>
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
    name: 'Guitarra Eléctrica Rock',
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
  }
];

export function getAvatarSvg(avatarId) {
  const item = RETRO_AVATARS.find((a) => a.id === avatarId);
  return item ? item.svg : RETRO_AVATARS[0].svg;
}
