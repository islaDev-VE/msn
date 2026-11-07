// MSN Messenger 7.5 Status definitions and SVG icons

export const MSN_STATUSES = {
  online: {
    id: 'online',
    label: 'Conectado',
    color: '#388e3c',
    iconSvg: `<svg viewBox="0 0 16 16" width="14" height="14">
      <circle cx="8" cy="8" r="6" fill="#4caf50" stroke="#2e7d32" stroke-width="1.5"/>
      <ellipse cx="6" cy="5" rx="2" ry="1" fill="#ffffff" opacity="0.6"/>
    </svg>`
  },
  busy: {
    id: 'busy',
    label: 'Ocupado',
    color: '#d32f2f',
    iconSvg: `<svg viewBox="0 0 16 16" width="14" height="14">
      <circle cx="8" cy="8" r="6" fill="#f44336" stroke="#c62828" stroke-width="1.5"/>
      <line x1="5" y1="8" x2="11" y2="8" stroke="#ffffff" stroke-width="2" stroke-linecap="round"/>
    </svg>`
  },
  away: {
    id: 'away',
    label: 'Ausente',
    color: '#f57c00',
    iconSvg: `<svg viewBox="0 0 16 16" width="14" height="14">
      <circle cx="8" cy="8" r="6" fill="#ff9800" stroke="#ef6c00" stroke-width="1.5"/>
      <polyline points="8,5 8,8 11,8" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round" fill="none"/>
    </svg>`
  },
  brb: {
    id: 'brb',
    label: 'Vuelvo enseguida',
    color: '#f57c00',
    iconSvg: `<svg viewBox="0 0 16 16" width="14" height="14">
      <circle cx="8" cy="8" r="6" fill="#ffa726" stroke="#f57c00" stroke-width="1.5"/>
      <circle cx="8" cy="8" r="3" fill="#ffffff"/>
      <circle cx="8" cy="8" r="1.5" fill="#f57c00"/>
    </svg>`
  },
  phone: {
    id: 'phone',
    label: 'Al teléfono',
    color: '#0288d1',
    iconSvg: `<svg viewBox="0 0 16 16" width="14" height="14">
      <circle cx="8" cy="8" r="6" fill="#03a9f4" stroke="#0288d1" stroke-width="1.5"/>
      <path d="M5.5 6 C5.5 5 7 5 7.5 6 L7.5 7 L6.5 7.5 C7 9 7.5 9.5 9 10 L9.5 9 L10.5 9 C11.5 9.5 11.5 11 10.5 11 C9 11 5.5 8 5.5 6 Z" fill="#ffffff"/>
    </svg>`
  },
  lunch: {
    id: 'lunch',
    label: 'Salí a comer',
    color: '#7b1fa2',
    iconSvg: `<svg viewBox="0 0 16 16" width="14" height="14">
      <circle cx="8" cy="8" r="6" fill="#9c27b0" stroke="#7b1fa2" stroke-width="1.5"/>
      <line x1="6" y1="5" x2="6" y2="11" stroke="#ffffff" stroke-width="1.2"/>
      <line x1="10" y1="5" x2="10" y2="11" stroke="#ffffff" stroke-width="1.2"/>
    </svg>`
  },
  offline: {
    id: 'offline',
    label: 'No conectado',
    color: '#9e9e9e',
    iconSvg: `<svg viewBox="0 0 16 16" width="14" height="14">
      <circle cx="8" cy="8" r="6" fill="#bdbdbd" stroke="#757575" stroke-width="1.5"/>
    </svg>`
  }
};
