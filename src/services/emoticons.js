// MSN Messenger 7.5 Iconic Emoticons Directory & Text Parser

export const MSN_EMOTICONS = [
  {
    code: ':)',
    shortcuts: [':)', ':-)'],
    name: 'Sonrisa',
    render: '😊'
  },
  {
    code: ':D',
    shortcuts: [':D', ':-D', ':d', ':-d'],
    name: 'Risa abierta',
    render: '😃'
  },
  {
    code: ';)',
    shortcuts: [';)', ';-)'],
    name: 'Guiño',
    render: '😉'
  },
  {
    code: ':P',
    shortcuts: [':P', ':-P', ':p', ':-p'],
    name: 'Lengua afuera',
    render: '😛'
  },
  {
    code: ':O',
    shortcuts: [':O', ':-O', ':o', ':-o'],
    name: 'Sorpresa',
    render: '😮'
  },
  {
    code: ':(',
    shortcuts: [':(', ':-('],
    name: 'Tristeza',
    render: '🙁'
  },
  {
    code: ':\'(',
    shortcuts: [':\'(', ':\'-('],
    name: 'Llorando',
    render: '😢'
  },
  {
    code: ':@',
    shortcuts: [':@', ':-@'],
    name: 'Enojado / Furia',
    render: '😡'
  },
  {
    code: ':S',
    shortcuts: [':S', ':-S', ':s', ':-s'],
    name: 'Confundido',
    render: '😖'
  },
  {
    code: ':|',
    shortcuts: [':|', ':-|'],
    name: 'Inexpresivo',
    render: '😐'
  },
  {
    code: '(H)',
    shortcuts: ['(H)', '(h)'],
    name: 'Gafas de sol (Cool)',
    render: '😎'
  },
  {
    code: '(A)',
    shortcuts: ['(A)', '(a)'],
    name: 'Angelito',
    render: '😇'
  },
  {
    code: '(6)',
    shortcuts: ['(6)'],
    name: 'Diablillo',
    render: '😈'
  },
  {
    code: '(L)',
    shortcuts: ['(L)', '(l)'],
    name: 'Corazón rojo',
    render: '❤️'
  },
  {
    code: '(U)',
    shortcuts: ['(U)', '(u)'],
    name: 'Corazón roto',
    render: '💔'
  },
  {
    code: '(K)',
    shortcuts: ['(K)', '(k)'],
    name: 'Beso con labios',
    render: '💋'
  },
  {
    code: '(G)',
    shortcuts: ['(G)', '(g)'],
    name: 'Regalo',
    render: '🎁'
  },
  {
    code: '(F)',
    shortcuts: ['(F)', '(f)'],
    name: 'Rosa roja',
    render: '🌹'
  },
  {
    code: '(W)',
    shortcuts: ['(W)', '(w)'],
    name: 'Rosa marchita',
    render: '🥀'
  },
  {
    code: '(P)',
    shortcuts: ['(P)', '(p)'],
    name: 'Cámara fotográfica',
    render: '📷'
  },
  {
    code: '(Y)',
    shortcuts: ['(Y)', '(y)'],
    name: 'Pulgar arriba (Sí)',
    render: '👍'
  },
  {
    code: '(N)',
    shortcuts: ['(N)', '(n)'],
    name: 'Pulgar abajo (No)',
    render: '👎'
  },
  {
    code: '(B)',
    shortcuts: ['(B)', '(b)'],
    name: 'Jarra de cerveza',
    render: '🍺'
  },
  {
    code: '(D)',
    shortcuts: ['(D)', '(d)'],
    name: 'Copa de cóctel',
    render: '🍸'
  },
  {
    code: '(8)',
    shortcuts: ['(8)'],
    name: 'Nota musical',
    render: '🎵'
  },
  {
    code: '*-)',
    shortcuts: ['*-)'],
    name: 'Pensativo / Soñador',
    render: '🤔'
  },
  {
    code: '({)',
    shortcuts: ['({)'],
    name: 'Abrazo chico',
    render: '🫂'
  },
  {
    code: '(})',
    shortcuts: ['(})'],
    name: 'Abrazo chica',
    render: '🤗'
  },
  {
    code: '(co)',
    shortcuts: ['(co)', '(CO)'],
    name: 'Taza de café',
    render: '☕'
  },
  {
    code: '(mp)',
    shortcuts: ['(mp)', '(MP)'],
    name: 'Teléfono móvil',
    render: '📱'
  },
  {
    code: '(brb)',
    shortcuts: ['(brb)', '(BRB)'],
    name: 'Vuelvo enseguida',
    render: '⏳'
  }
];

// Helper to escape regex special characters
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Build regex mapping all shortcuts
const shortcutMap = new Map();
const patternParts = [];

MSN_EMOTICONS.forEach((item) => {
  item.shortcuts.forEach((sc) => {
    shortcutMap.set(sc, item);
    patternParts.push(escapeRegExp(sc));
  });
});

// Sort by length descending so longer tokens match first (e.g., ':-D' before ':D')
patternParts.sort((a, b) => b.length - a.length);
const emoticonsRegex = new RegExp(`(${patternParts.join('|')})`, 'g');

/**
 * Splits plain text into a list of chunks: { type: 'text' | 'emoticon', value, data }
 */
export function parseTextWithEmoticons(text) {
  if (!text) return [];
  const parts = text.split(emoticonsRegex);
  return parts.map((part) => {
    if (shortcutMap.has(part)) {
      const emoticon = shortcutMap.get(part);
      return {
        type: 'emoticon',
        value: part,
        data: emoticon
      };
    }
    return {
      type: 'text',
      value: part
    };
  });
}
