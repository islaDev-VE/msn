import React from 'react';
import { parseTextWithEmoticons } from './emoticons';

// Classic numbered palette inspired by 2005 Plus color codes
export const PLUS_COLOR_PALETTE = {
  1: '#000000',
  2: '#00007f',
  3: '#009300',
  4: '#e60026',
  5: '#7f0000',
  6: '#9c009c',
  7: '#fc7f00',
  8: '#d4a000',
  9: '#00b800',
  10: '#008080',
  11: '#0099cc',
  12: '#0055ea',
  13: '#e60073',
  14: '#555555'
};

export const QUICK_PLUS_COLORS = [
  { label: 'Azul', code: '#0055ea' },
  { label: 'Rosa', code: '#e60073' },
  { label: 'Rojo', code: '#d32f2f' },
  { label: 'Verde', code: '#2e7d32' },
  { label: 'Naranja', code: '#ef6c00' },
  { label: 'Morado', code: '#7b1fa2' },
  { label: 'Turquesa', code: '#00838f' }
];

export const RETRO_2005_SONGS = [
  '(8) Evanescence - Bring Me To Life (8)',
  '(8) Linkin Park - In The End (8)',
  '(8) Avril Lavigne - Complicated (8)',
  '(8) Green Day - Boulevard of Broken Dreams (8)',
  '(8) Juanes - La Camisa Negra (8)',
  '(8) Daddy Yankee - Gasolina (8)',
  '(8) Shakira - La Tortura (8)',
  '(8) My Chemical Romance - Helena (8)',
  '(8) Black Eyed Peas - Where Is The Love? (8)',
  '(8) RBD - Sálvame (8)'
];

function resolveColor(raw) {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (/^#[0-9a-f]{3,6}$/i.test(trimmed)) return trimmed;
  const num = Number(trimmed);
  if (PLUS_COLOR_PALETTE[num]) return PLUS_COLOR_PALETTE[num];
  return null;
}

/**
 * Strips Colores Plus tags to get clean plain text (e.g. for window titles or notifications)
 */
export function stripPlusTags(text) {
  if (!text) return '';
  return String(text)
    .replace(/\[c=[^\]]+\]/gi, '')
    .replace(/\[\/c\]/gi, '')
    .replace(/\[\/?(b|i|u)\]/gi, '');
}

/**
 * Renders text supporting Colores Plus tags ([c=#hex], [c=4], [b], [i], [u]) + classic emoticons.
 * Safe React element output (zero dangerouslySetInnerHTML).
 */
export function renderFormattedText(input, keyPrefix = 'fmt') {
  if (!input) return null;
  const str = String(input);
  const tokenRegex = /(\[c=[^\]]+\]|\[\/c\]|\[b\]|\[\/b\]|\[i\]|\[\/i\]|\[u\]|\[\/u\])/gi;
  const parts = str.split(tokenRegex);

  const colorStack = [];
  let bold = 0;
  let italic = 0;
  let underline = 0;

  const nodes = [];
  parts.forEach((part, idx) => {
    if (!part) return;
    const lower = part.toLowerCase();

    if (lower.startsWith('[c=') && lower.endsWith(']')) {
      const col = resolveColor(part.slice(3, -1));
      if (col) colorStack.push(col);
      return;
    }
    if (lower === '[/c]') {
      if (colorStack.length > 0) colorStack.pop();
      return;
    }
    if (lower === '[b]') { bold += 1; return; }
    if (lower === '[/b]') { bold = Math.max(0, bold - 1); return; }
    if (lower === '[i]') { italic += 1; return; }
    if (lower === '[/i]') { italic = Math.max(0, italic - 1); return; }
    if (lower === '[u]') { underline += 1; return; }
    if (lower === '[/u]') { underline = Math.max(0, underline - 1); return; }

    const style = {};
    if (colorStack.length > 0) style.color = colorStack[colorStack.length - 1];
    if (bold > 0) style.fontWeight = 'bold';
    if (italic > 0) style.fontStyle = 'italic';
    if (underline > 0) style.textDecoration = 'underline';

    const chunks = parseTextWithEmoticons(part);
    const renderedChunks = chunks.map((chunk, cIdx) => {
      if (chunk.type === 'emoticon') {
        return (
          <span
            key={`${keyPrefix}-${idx}-e-${cIdx}`}
            style={{ fontSize: '1.15em', verticalAlign: 'middle', margin: '0 1px' }}
            title={`${chunk.data.name} (${chunk.data.code})`}
          >
            {chunk.data.render}
          </span>
        );
      }
      return <React.Fragment key={`${keyPrefix}-${idx}-t-${cIdx}`}>{chunk.value}</React.Fragment>;
    });

    if (Object.keys(style).length > 0) {
      nodes.push(
        <span key={`${keyPrefix}-${idx}`} style={style}>
          {renderedChunks}
        </span>
      );
    } else {
      nodes.push(<React.Fragment key={`${keyPrefix}-${idx}`}>{renderedChunks}</React.Fragment>);
    }
  });

  return nodes;
}
