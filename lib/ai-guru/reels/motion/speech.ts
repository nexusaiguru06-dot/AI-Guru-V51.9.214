/**
 * Caption → spoken script. Captions are written for the eye ("25 − 5 = 20",
 * "x²", "1/2"); voices need words ("25 minus 5 equals 20"). One table per
 * language, so a teacher can tune how maths is read aloud in one place.
 *
 * Malayalam follows Kerala classroom speech: maths symbols are read with the
 * English loan words teachers actually use (പ്ലസ്, മൈനസ്, സ്ക്വയർ…), variables
 * as letters (എക്സ്, വൈ). Numbers stay as digits; the Malayalam voice reads them.
 */

import type { Lang } from './captions';

interface SpeechTable {
  plus: string;
  minus: string;
  times: string;
  divide: string;
  equals: string;
  approx: string;
  over: string;
  squared: string;
  cubed: string;
  power: (p: string) => string;
  sqrt: string;
  percent: string;
  degrees: string;
  pi: string;
  theta: string;
  or: string;
  ddx: string;
  letters: Record<string, string>;
  funcs: Record<string, string>;
  bracket: string;
  sqcm: string;
}

const MATH_WORD = /^(squared|cubed|to|plus|minus|equals|times|over|divided)$/;

const EN: SpeechTable = {
  plus: 'plus',
  minus: 'minus',
  times: 'times',
  divide: 'divided by',
  equals: 'equals',
  approx: 'is about',
  over: 'over',
  squared: 'squared',
  cubed: 'cubed',
  power: (p) => `to the power ${p}`,
  sqrt: 'the square root of',
  percent: 'percent',
  degrees: 'degrees',
  pi: 'pi',
  theta: 'theta',
  or: 'or',
  ddx: 'd by d x of',
  // Letters are read fine by English voices, except a lone maths "a" (handled by context).
  letters: {},
  funcs: { sin: 'sine', cos: 'cos', tan: 'tan' },
  bracket: 'bracket',
  sqcm: 'square centimetres',
};

const ML: SpeechTable = {
  plus: 'പ്ലസ്',
  minus: 'മൈനസ്',
  times: 'ഗുണം',
  divide: 'ഹരണം',
  equals: 'സമം',
  approx: 'ഏകദേശം',
  over: 'ബൈ',
  squared: 'സ്ക്വയർ',
  cubed: 'ക്യൂബ്',
  power: (p) => `പവർ ${p}`,
  sqrt: 'സ്ക്വയർ റൂട്ട്',
  percent: 'ശതമാനം',
  degrees: 'ഡിഗ്രി',
  pi: 'പൈ',
  theta: 'തീറ്റ',
  or: 'അല്ലെങ്കിൽ',
  ddx: 'ഡി ബൈ ഡി എക്സ്',
  letters: { a: 'എ', b: 'ബി', c: 'സി', x: 'എക്സ്', y: 'വൈ', r: 'ആർ', A: 'എ', P: 'പി', m: 'എം', n: 'എൻ' },
  funcs: { sin: 'സൈൻ', cos: 'കോസ്', tan: 'ടാൻ' },
  bracket: 'ബ്രാക്കറ്റ്',
  sqcm: 'ചതുരശ്ര സെന്റിമീറ്റർ',
};

/** V51.9.160: every English letter's Malayalam name (for letters that the table above does not cover). */
export const ML_LETTER_NAMES: Record<string, string> = {
  a: 'എ', b: 'ബി', c: 'സി', d: 'ഡി', e: 'ഇ', f: 'എഫ്', g: 'ജി', h: 'എച്ച്', i: 'ഐ', j: 'ജെ', k: 'കെ', l: 'എൽ', m: 'എം',
  n: 'എൻ', o: 'ഒ', p: 'പി', q: 'ക്യൂ', r: 'ആർ', s: 'എസ്', t: 'ടി', u: 'യു', v: 'വി', w: 'ഡബ്ല്യു', x: 'എക്സ്', y: 'വൈ', z: 'സെഡ്',
};

/** "of" in Malayalam after a spoken letter: എക്സ് → എക്സിന്റെ, വൈ → വൈയുടെ, ആർ → ആറിന്റെ, എൻ → എന്നിന്റെ. */
export function mlGenitive(w: string): string {
  const CHILLU: Record<string, string> = { 'ർ': 'റിന്റെ', 'ൻ': 'ന്നിന്റെ', 'ൽ': 'ലിന്റെ', 'ൾ': 'ളിന്റെ', 'ൺ': 'ണിന്റെ' };
  const last = w.slice(-1);
  if (last === '്') return `${w.slice(0, -1)}ിന്റെ`;
  if (CHILLU[last]) return w.slice(0, -1) + CHILLU[last];
  if (last === 'ം') return `${w.slice(0, -1)}ത്തിന്റെ`;
  return `${w}യുടെ`;
}

const SUP: Record<string, string> = {
  '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9',
  'ᵐ': 'm', 'ⁿ': 'n', '⁺': '+', '⁻': '−',
};

function powerWords(T: SpeechTable, p: string): string {
  if (p === '2') return T.squared;
  if (p === '3') return T.cubed;
  return T.power(p);
}

/** Make a caption speakable in the given language. */
export function speakable(caption: string, lang: Lang): string {
  const T = lang === 'ml' ? ML : EN;
  let s = ` ${caption} `;

  // V51.9.160: a question "x = ?" is asked as a teacher asks it ("എക്സിന്റെ വില എത്ര?" / "what is x?"),
  // and "… = ?" as "… എത്ര?" / "… equals what?" (not "x equals?")
  s = s.replace(/(^|[\s,(])([a-zA-Z])\s*=\s*\?/g, (m, pre, v) => {
    if (lang !== 'ml') return `${pre}what is ${v}?`;
    const w = T.letters[v] ?? ML_LETTER_NAMES[v.toLowerCase()];
    return w ? `${pre}${mlGenitive(w)} വില എത്ര?` : m;
  });
  s = s.replace(/=\s*\?/g, lang === 'ml' ? ' എത്ര?' : ' equals what?');

  s = s.replace(/cm²/g, ` ${T.sqcm} `);
  // Unit vectors: î / ĵ are read "i hat" / "j hat" (Malayalam: ഐ ഹാറ്റ് / ജെ ഹാറ്റ്).
  s = s.replace(/î/g, lang === 'ml' ? ' ഐ ഹാറ്റ് ' : ' i hat ').replace(/ĵ/g, lang === 'ml' ? ' ജെ ഹാറ്റ് ' : ' j hat ');
  // Unicode superscripts → ^(…)
  s = s.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹ᵐⁿ⁺⁻]+/g, (m) => `^(${[...m].map((c) => SUP[c]).join('')})`);
  // Token notation from the boards: {a/b} fractions, x^{3+4} powers.
  s = s.replace(/\{([^{}/]+)\/([^{}]+)\}/g, '$1/$2').replace(/\^\{([^}]*)\}/g, '^($1)');
  // d/dx
  s = s.replace(/d\/dx/g, ` ${T.ddx} `);
  // Powers: x^2, 2^(3+4), x^(3−1)
  s = s.replace(/\^\(([^)]*)\)|\^([0-9a-z]+)/gi, (_m, a, b) => ` ${powerWords(T, String(a ?? b).replace(/\s+/g, ''))} `);
  // Square roots
  s = s.replace(/√\s*/g, ` ${T.sqrt} `);
  // Fractions a/b (digits or single letters)
  s = s.replace(/(\d+|\b[a-zA-Z]\b)\s*\/\s*(\d+|\b[a-zA-Z]\b)/g, ` $1 ${T.over} $2 `);
  // Brackets: a product of brackets is read "bracket … , times bracket …"; other brackets are dropped.
  if (/\)\s*\(/.test(s)) {
    s = s.replace(/\)\s*\(/g, `, ${T.times} (`).replace(/\(/g, ` ${T.bracket} `).replace(/\)/g, ' ');
  } else {
    s = s.replace(/[()]/g, ' ');
  }
  // Coefficients: 2x → 2 x (but not plurals like "12s")
  s = s.replace(/(\d)([xyzabcmnr])\b/g, '$1 $2');
  // Signs
  s = s.replace(/\s[−-](?=\s*\d|\s*[a-zA-Z])/g, ` ${T.minus} `); // "− 5", "−5", "−y"
  s = s.replace(/([0-9a-zA-Z])\s*[−]\s*/g, `$1 ${T.minus} `);
  s = s.replace(/\+/g, ` ${T.plus} `);
  s = s.replace(/×/g, ` ${T.times} `);
  s = s.replace(/÷/g, ` ${T.divide} `);
  s = s.replace(/≈/g, ` ${T.approx} `);
  s = s.replace(/=/g, ` ${T.equals} `);
  s = s.replace(/%/g, ` ${T.percent} `);
  s = s.replace(/°/g, ` ${T.degrees} `);
  s = s.replace(/π/g, ` ${T.pi} `);
  s = s.replace(/θ/g, ` ${T.theta} `);
  s = s.replace(/→/g, ', ');
  s = s.replace(/…/g, '.');
  s = s.replace(/\b(sin|cos|tan)\b/g, (f) => T.funcs[f] ?? f);
  if (lang === 'ml') {
    // x-നെ → എക്സിനെ (letter + Malayalam case ending)
    s = s.replace(/(^|[^A-Za-z])([a-zA-Z])-(?=[\u0D00-\u0D7F])/g, (m, pre, v) => {
      const w = T.letters[v];
      return w ? `${pre}${w.endsWith('്') ? w.slice(0, -1) + 'ി' : w}` : m;
    });
    s = s.replace(/(^|[\s,(])([a-zA-Z])(?=[\s,.)?!:;]|$)/g, (m, pre, v) => (T.letters[v] ? `${pre}${T.letters[v]}` : m));
    s = s.replace(/\bor\b/g, ` ${T.or} `);
    // Join case endings that follow a spoken word: "ക്യൂബ് -ന്റെ" → "ക്യൂബിന്റെ", "ശതമാനം -നെ" → "ശതമാനത്തെ".
    s = s.replace(/ം\s*-നെ/g, 'ത്തെ').replace(/ം\s*-ന്റെ/g, 'ത്തിന്റെ').replace(/്\s*-(?=ന)/g, 'ി');
    s = s.replace(/\s+-(?=[\u0D00-\u0D7F])/g, '');
  } else {
    // A maths "a" next to a maths word is read as the letter A, not the article.
    const words = s.split(/(\s+)/);
    for (let i = 0; i < words.length; i++) {
      if (words[i] !== 'a') continue;
      const next = words.slice(i + 1).find((w) => w.trim());
      const prev = words.slice(0, i).reverse().find((w) => w.trim());
      if ((next && MATH_WORD.test(next)) || (prev && MATH_WORD.test(prev))) words[i] = 'A';
    }
    s = words.join('');
  }
  return s
    .replace(/\s+([,.!?:;])/g, '$1')
    .replace(/,\s*,+/g, ',')
    .replace(/(^[\s,]+)|([\s,]+$)/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/** Rough speaking time (used only until real clips are measured). */
export function estimateSpeechMs(text: string, lang: Lang): number {
  const cps = lang === 'ml' ? 11 : 14;
  return Math.round(400 + (text.length / cps) * 1000);
}
