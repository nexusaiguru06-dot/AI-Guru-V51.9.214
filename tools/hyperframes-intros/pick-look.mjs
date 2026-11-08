/**
 * Which look each heading gets, and the file name of its clip. The class (lib/ai-guru/motion-class/intro-clips.ts) has the
 * same two functions; intro-clips.test.ts checks that both give the same answers, so a clip rendered here is found there.
 */
export const LOOKS = [
  { id: 'graph', file: '01-graph.html', subjects: ['maths', 'general'] },
  { id: 'chalk', file: '02-chalk.html', subjects: ['maths', 'science', 'general'] },
  { id: 'globe', file: '03-globe.html', subjects: ['earth', 'general'] },
  { id: 'rain', file: '04-rain.html', subjects: ['maths', 'science'] },
  { id: 'curtain', file: '05-curtain.html', subjects: ['maths', 'science', 'earth', 'general'] },
  { id: 'atom', file: '06-atom.html', subjects: ['science'] },
  { id: 'notebook', file: '07-notebook.html', subjects: ['maths', 'science', 'earth', 'general'] },
  { id: 'sunrise', file: '08-sunrise.html', subjects: ['earth', 'general'] },
];

const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };

export function subjectClass(subject) {
  const k = (subject ?? '').toLowerCase();
  if (/geograph|earth|ഭൂമി|ഭൂമിശാസ്ത്ര/.test(k)) return 'earth';
  if (/sci|phys|chem|bio|ശാസ്ത്ര|ഭൗതിക|രസതന്ത്ര|ജീവ/.test(k)) return 'science';
  if (/social|histor|civic|econom|english|malayalam|hindi|language|സാമൂഹ്യ|ചരിത്ര|ഭാഷ/.test(k)) return 'general';
  return 'maths';
}

/** Index into LOOKS for the n-th heading of a chapter; never the same look twice in a row. */
export function pickLook(subject, n, prev, chapterTitle = '') {
  const cls = subjectClass(subject);
  const pool = LOOKS.map((l, i) => ({ l, i })).filter(({ l }) => l.subjects.includes(cls));
  let k = (hash(`${chapterTitle}|${cls}`) + n) % pool.length;
  if (pool[k].i === prev && pool.length > 1) k = (k + 1) % pool.length;
  return pool[k].i;
}

/** File stem of the clip for one heading in one look. */
export function introKey({ heading, sub = '', lang, look }) {
  const s = `${look}|${lang}|${heading}|${sub}`;
  return hash(s).toString(16).padStart(8, '0') + hash(`${s}#`).toString(16).padStart(8, '0');
}
