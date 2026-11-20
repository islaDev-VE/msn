// Classic 2005 Emoticons Directory & Text Parser for Zumbido 05

export const RETRO_EMOTICONS = [
  { code: ':)', shortcuts: [':)', ':-)'], name: 'Sonrisa', render: '😊' },
  { code: ':D', shortcuts: [':D', ':-D', ':d', ':-d'], name: 'Risa abierta', render: '😃' },
  { code: ';)', shortcuts: [';)', ';-)'], name: 'Guiño', render: '😉' },
  { code: ':P', shortcuts: [':P', ':-P', ':p', ':-p'], name: 'Lengua afuera', render: '😛' },
  { code: ':O', shortcuts: [':O', ':-O', ':o', ':-o'], name: 'Sorpresa', render: '😮' },
  { code: ':(', shortcuts: [':(', ':-('], name: 'Tristeza', render: '🙁' },
  { code: ":'(", shortcuts: [":'(", ":'-("], name: 'Llorando', render: '😢' },
  { code: ':@', shortcuts: [':@', ':-@'], name: 'Enojado', render: '😡' },
  { code: ':S', shortcuts: [':S', ':-S', ':s', ':-s'], name: 'Confundido', render: '😖' },
  { code: ':|', shortcuts: [':|', ':-|'], name: 'Inexpresivo', render: '😐' },
  { code: '(H)', shortcuts: ['(H)', '(h)'], name: 'Gafas de sol', render: '😎' },
  { code: '(A)', shortcuts: ['(A)', '(a)'], name: 'Angelito', render: '😇' },
  { code: '(6)', shortcuts: ['(6)'], name: 'Diablillo', render: '😈' },
  { code: '(L)', shortcuts: ['(L)', '(l)'], name: 'Corazón rojo', render: '❤️' },
  { code: '(U)', shortcuts: ['(U)', '(u)'], name: 'Corazón roto', render: '💔' },
  { code: '(K)', shortcuts: ['(K)', '(k)'], name: 'Beso', render: '💋' },
  { code: '(G)', shortcuts: ['(G)', '(g)'], name: 'Regalo', render: '🎁' },
  { code: '(F)', shortcuts: ['(F)', '(f)'], name: 'Rosa roja', render: '🌹' },
  { code: '(W)', shortcuts: ['(W)', '(w)'], name: 'Rosa marchita', render: '🥀' },
  { code: '(P)', shortcuts: ['(P)', '(p)'], name: 'Cámara', render: '📷' },
  { code: '(Y)', shortcuts: ['(Y)', '(y)'], name: 'Pulgar arriba', render: '👍' },
  { code: '(N)', shortcuts: ['(N)', '(n)'], name: 'Pulgar abajo', render: '👎' },
  { code: '(B)', shortcuts: ['(B)', '(b)'], name: 'Cerveza', render: '🍺' },
  { code: '(D)', shortcuts: ['(D)', '(d)'], name: 'Cóctel', render: '🍸' },
  { code: '(8)', shortcuts: ['(8)'], name: 'Nota musical', render: '🎵' },
  { code: '*-)', shortcuts: ['*-)'], name: 'Pensativo', render: '🤔' },
  { code: '({)', shortcuts: ['({)'], name: 'Abrazo', render: '🫂' },
  { code: '(})', shortcuts: ['(})'], name: 'Abrazo cálido', render: '🤗' },
  { code: '(co)', shortcuts: ['(co)', '(CO)'], name: 'Café', render: '☕' },
  { code: '(mp)', shortcuts: ['(mp)', '(MP)'], name: 'Móvil', render: '📱' },
  { code: '(brb)', shortcuts: ['(brb)', '(BRB)'], name: 'Vuelvo enseguida', render: '⏳' }
];

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const shortcutMap = new Map();
const patternParts = [];

RETRO_EMOTICONS.forEach((item) => {
  item.shortcuts.forEach((sc) => {
    shortcutMap.set(sc, item);
    patternParts.push(escapeRegExp(sc));
  });
});

patternParts.sort((a, b) => b.length - a.length);
const emoticonsRegex = new RegExp(`(${patternParts.join('|')})`, 'g');

export function parseTextWithEmoticons(text) {
  if (!text) return [];
  const parts = text.split(emoticonsRegex);
  return parts.map((part) => {
    if (shortcutMap.has(part)) {
      return {
        type: 'emoticon',
        value: part,
        data: shortcutMap.get(part)
      };
    }
    return {
      type: 'text',
      value: part
    };
  });
}
