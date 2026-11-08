/**
 * V51.9.96: picks the pictures a textbook paragraph talks about — molecules, PhET simulations, maps and biology drawings —
 * from words in English or Malayalam. Pure: the biology catalogue (about 1,500 drawings) is passed in once it is loaded.
 */
import { MOLECULES } from './molecules';
import { PHET } from './phet';
import { MAP_PLACES, MAP_VISUALS } from './maps';
import type { Visual, VisualSubject } from './types';

/** Malayalam words a paragraph may use → the English words the catalogues are tagged with. */
export const ML_TO_EN: Record<string, string> = {
  'ഹൃദയം': 'heart', 'ശ്വാസകോശം': 'lung', 'വൃക്ക': 'kidney', 'മസ്തിഷ്കം': 'brain', 'തലച്ചോർ': 'brain', 'കണ്ണ്': 'eye', 'ചെവി': 'ear', 'ത്വക്ക്': 'skin', 'അസ്ഥി': 'bone', 'പല്ല്': 'tooth', 'ആമാശയം': 'stomach', 'കരൾ': 'liver', 'കുടൽ': 'intestine', 'കോശം': 'cell', 'മർമം': 'nucleus', 'ഹരിതകണം': 'chloroplast', 'ഇല': 'leaf', 'വേര്': 'root', 'പൂവ്': 'flower', 'വിത്ത്': 'seed', 'സസ്യം': 'plant', 'ബാക്ടീരിയ': 'bacteria', 'വൈറസ്': 'virus', 'ഫംഗസ്': 'fungus', 'രക്തം': 'blood', 'നാഡീകോശം': 'neuron', 'തവള': 'frog', 'മത്സ്യം': 'fish', 'പക്ഷി': 'bird', 'കൊതുക്': 'mosquito', 'ഷഡ്പദം': 'insect', 'സൂക്ഷ്മദർശിനി': 'microscope', 'ബീക്കർ': 'beaker', 'ഫ്ലാസ്ക്': 'flask', 'ഡിഎൻഎ': 'dna', 'ക്രോമസോം': 'chromosome', 'പേശി': 'muscle', 'അമീബ': 'amoeba', 'മൈറ്റോകോൺഡ്രിയ': 'mitochondria', 'ഹരിതകം': 'chlorophyll', 'കോശസ്തരം': 'membrane', 'ഇലക്ട്രോൺ': 'electron', 'പാരമീസിയം': 'paramecium', 'എലി': 'mouse', 'പശു': 'cow', 'നായ': 'dog', 'ആന': 'elephant',
};

const STOP = new Set(['icon', 'left', 'right', 'front', 'side', 'view', 'small', 'large', 'simple', 'color', 'colour', 'white', 'black', 'with', 'without', 'part', 'type', 'normal', 'general', 'version', 'outline', 'filled', 'empty', 'full', 'open', 'closed', 'new', 'old', 'and', 'the', 'for', 'one', 'two', 'top', 'bottom', 'cross', 'section', 'detail', 'image', 'shape', 'single', 'double', 'group', 'flat', 'style', 'line', 'lines', 'base', 'basic', 'human', 'female', 'male', 'pump', 'pumps', 'sample', 'samples', 'whole', 'generic', 'sketch', 'clothed', 'excess', 'weight', 'light', 'water', 'green', 'blue', 'red', 'yellow', 'bottle', 'bath', 'adult', 'using', 'make', 'made', 'form', 'image', 'object', 'distance', 'model', 'diagram', 'small', 'big',
  // everyday English words that appear in drawing names but never name a topic
  'from', 'above', 'below', 'under', 'over', 'into', 'onto', 'versus', 'between', 'about', 'after', 'before', 'inside', 'outside', 'through', 'this', 'that', 'these', 'those', 'which', 'have', 'has', 'are', 'was', 'were', 'not', 'all', 'any', 'can', 'its', 'our', 'out', 'per', 'via', 'body', 'state', 'stage', 'step', 'set', 'kit', 'free', 'high', 'low', 'long', 'short', 'more', 'less', 'most', 'many', 'much', 'other', 'same', 'different', 'like', 'also', 'such', 'each', 'very', 'they', 'them', 'there', 'their', 'when', 'where', 'what', 'how', 'why']);

export const CURATED: Visual[] = [
  ...MOLECULES.map((m): Visual => ({ kind: 'molecule', id: `mol-${m.id}`, subject: 'chemistry', title: m.name, ml: m.ml, formula: m.formula, smiles: m.smiles, keywords: m.keywords })),
  ...PHET.map((p): Visual => ({ kind: 'phet', id: `phet-${p.slug}`, subject: p.subject, title: p.title, ml: p.ml, slug: p.slug, keywords: p.keywords })),
  ...MAP_VISUALS,
];

/** "Science" → biology, chemistry, physics; "Social Science" → geography; etc. */
export function subjectsFor(subject?: string): VisualSubject[] | null {
  const s = String(subject ?? '').toLowerCase();
  if (!s) return null;
  if (/bio|life|ജീവ/.test(s)) return ['biology'];
  if (/chem|രസ/.test(s)) return ['chemistry'];
  if (/phys|ഭൗതിക/.test(s)) return ['physics'];
  if (/geo|social|ഭൂമി|സാമൂഹ/.test(s)) return ['geography'];
  if (/science|ശാസ്ത്ര/.test(s)) return ['biology', 'chemistry', 'physics'];
  return null;
}

// \p{M} keeps Malayalam vowel signs and virama (ഹൃദയം), which are marks, not letters.
const norm = (t: string) => ` ${t.toLowerCase().replace(/[^\p{L}\p{M}\p{N}\s'-]+/gu, ' ').replace(/\s+/g, ' ')} `;
const isAscii = (w: string) => /^[\x20-\x7e]+$/.test(w);
/** A word and its school-book plurals: lens/lenses, mitochondrion/mitochondria, bacterium/bacteria, nucleus/nuclei, ovary/ovaries. */
const forms = (kw: string) => { const f = [kw, `${kw}s`, `${kw}es`]; if (kw.endsWith('on')) f.push(`${kw.slice(0, -2)}a`); if (kw.endsWith('um')) f.push(`${kw.slice(0, -2)}a`); if (kw.endsWith('us')) f.push(`${kw.slice(0, -2)}i`); if (kw.endsWith('y')) f.push(`${kw.slice(0, -1)}ies`); if (kw.endsWith('a')) f.push(`${kw}e`); return f; };
/** Malayalam words take endings (അക്ഷാംശം → അക്ഷാംശവും, ഹൃദയം → ഹൃദയത്തിൽ): match on the stem without the final ം. */
export const mlStem = (w: string) => (w.endsWith('ം') && [...w].length > 3 ? w.slice(0, -1) : w);
const has = (text: string, kw: string) => (isAscii(kw) ? forms(kw).some((f) => text.includes(` ${f} `)) : text.includes(mlStem(kw)));
/** 1 for the exact word, 0.7 when only a plural/other form matched (a plural usually names a general thing, not the topic). */
const hitStrength = (text: string, kw: string) => (!isAscii(kw) ? (text.includes(mlStem(kw)) ? 1 : 0) : text.includes(` ${kw} `) ? 1 : forms(kw).slice(1).some((f) => text.includes(` ${f} `)) ? 0.7 : 0);

/** How rare each biology keyword is (rare words like "mitochondria" count more than common ones like "cell"). */
export function keywordWeights(bio: Visual[]): Map<string, number> {
  const df = new Map<string, number>();
  for (const v of bio) for (const k of new Set(v.keywords)) df.set(k, (df.get(k) ?? 0) + 1);
  const w = new Map<string, number>();
  for (const [k, n] of df) w.set(k, 1 / Math.log2(1 + n));
  return w;
}

export interface Match { visual: Visual; score: number; /** the word that matched most strongly (biology drawings) */ key?: string }

/** The pictures for a paragraph, best first. */
export function findVisuals(textIn: string, o: { subject?: string; bio?: Visual[]; weights?: Map<string, number>; limit?: number } = {}): Match[] {
  let text = norm(textIn);
  for (const [ml, en] of Object.entries(ML_TO_EN)) if (text.includes(mlStem(ml))) text += `${en} `;
  const want = subjectsFor(o.subject);
  const out: Match[] = [];
  const scoreBy = (v: Visual, s: number, key?: string) => { if (s <= 0) return; out.push({ visual: v, score: want && !want.includes(v.subject) ? s * 0.4 : s, key }); };
  for (const v of CURATED) {
    let s = 0;
    for (const kw of v.keywords) if (has(text, kw.toLowerCase())) s += 2 + Math.min(3, kw.split(' ').length) + (isAscii(kw) ? 0 : 1);
    scoreBy(v, s ? s + 2 : 0);
  }
  for (const name of MAP_PLACES.countries) if (has(text, name.toLowerCase())) scoreBy({ kind: 'map', id: `map-country-${name.toLowerCase().replace(/\s+/g, '-')}`, subject: 'geography', title: `${name} on the world map`, map: { view: 'country', iso: '', name }, keywords: [name.toLowerCase()] }, 6);
  for (const name of MAP_PLACES.states) if (has(text, name.toLowerCase())) scoreBy({ kind: 'map', id: `map-state-${name.toLowerCase().replace(/\s+/g, '-')}`, subject: 'geography', title: `${name} on the map of India`, map: { view: 'state', name }, keywords: [name.toLowerCase()] }, 6);
  if (o.bio?.length) {
    const w = o.weights ?? keywordWeights(o.bio);
    for (const v of o.bio) {
      let s = 0, strong = 0, key = '', best = 0;
      for (const kw of v.keywords) { if (kw.length < 3 || STOP.has(kw)) continue; const h = hitStrength(text, kw); if (h) { const x = w.get(kw) ?? 0.3; s += x * 4 * h; if (x > 0.2) strong++; if (x * h > best) { best = x * h; key = kw; } } }
      if (strong && s >= 1) scoreBy(v, s, key); // a single weak word is not enough for a drawing
    }
  }
  // Variety: at most two drawings per matched word, so every topic of the paragraph gets a picture.
  const seen = new Set<string>(); const perKey = new Map<string, number>();
  return out.sort((a, b) => b.score - a.score).filter((m) => {
    if (seen.has(m.visual.id)) return false;
    if (m.key) { const n = perKey.get(m.key) ?? 0; if (n >= 2) return false; perKey.set(m.key, n + 1); }
    seen.add(m.visual.id); return true;
  }).slice(0, o.limit ?? 8);
}

/** Search box on the gallery: every word must hit the title, keywords, category or Malayalam name. */
export function searchVisuals(list: Visual[], q: string): Visual[] {
  let t = q.trim().toLowerCase();
  if (!t) return list;
  for (const [ml, en] of Object.entries(ML_TO_EN)) if (t.includes(mlStem(ml))) t += ` ${en}`;
  const words = t.split(/\s+/).filter(Boolean);
  return list.filter((v) => { const hay = `${v.title} ${'ml' in v ? v.ml ?? '' : ''} ${v.keywords.join(' ')} ${'category' in v ? v.category : ''} ${'formula' in v ? v.formula : ''}`.toLowerCase(); return words.some((w) => hay.includes(w)) && words.filter((w) => hay.includes(w)).length >= Math.min(words.length, 1); });
}
