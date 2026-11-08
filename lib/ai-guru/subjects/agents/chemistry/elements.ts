/**
 * V51.9.147 — facts about one element, computed for the board: where it sits in the periodic table, its mass as
 * school textbooks write it, its electrons shell by shell (K, L, M, N …), its valence electrons and valency.
 * Data: elements-data.ts (from Zperiod, MIT).
 */
import { ELEMENT_ROWS, type Family } from './elements-data';

export interface Element {
  z: number;
  symbol: string;
  name: string;
  /** 1–18; 0 for the lanthanide / actinide rows. */
  group: number;
  period: number;
  mass: number;
  family: Family;
  config: string;
}

export const ELEMENTS: Element[] = ELEMENT_ROWS.map(([z, symbol, name, group, period, mass, family, config]) => ({ z, symbol, name, group, period, mass, family, config }));
const BY_SYMBOL = new Map(ELEMENTS.map((e) => [e.symbol, e]));
const BY_NAME = new Map(ELEMENTS.map((e) => [e.name.toLowerCase(), e]));
BY_NAME.set('aluminum', BY_SYMBOL.get('Al')!);
BY_NAME.set('sulphur', BY_SYMBOL.get('S')!);
BY_NAME.set('caesium', BY_SYMBOL.get('Cs')!);

/** Malayalam names as Kerala textbooks write them (the others are written in English). */
export const ML_NAME: Record<string, string> = {
  H: 'ഹൈഡ്രജൻ', He: 'ഹീലിയം', Li: 'ലിഥിയം', Be: 'ബെറിലിയം', B: 'ബോറോൺ', C: 'കാർബൺ', N: 'നൈട്രജൻ', O: 'ഓക്സിജൻ', F: 'ഫ്ലൂറിൻ', Ne: 'നിയോൺ',
  Na: 'സോഡിയം', Mg: 'മഗ്നീഷ്യം', Al: 'അലുമിനിയം', Si: 'സിലിക്കൺ', P: 'ഫോസ്ഫറസ്', S: 'സൾഫർ', Cl: 'ക്ലോറിൻ', Ar: 'ആർഗൺ', K: 'പൊട്ടാസ്യം', Ca: 'കാൽസ്യം',
  Fe: 'ഇരുമ്പ്', Cu: 'ചെമ്പ്', Zn: 'സിങ്ക്', Ag: 'വെള്ളി', Au: 'സ്വർണം', Hg: 'മെർക്കുറി', Pb: 'ലെഡ്', Sn: 'ടിൻ', I: 'അയഡിൻ', Br: 'ബ്രോമിൻ',
  Mn: 'മാംഗനീസ്', Cr: 'ക്രോമിയം', Ni: 'നിക്കൽ', Co: 'കൊബാൾട്ട്', Ba: 'ബേരിയം', U: 'യുറേനിയം', Pt: 'പ്ലാറ്റിനം',
};
export const nameIn = (e: Element, lang: 'en' | 'ml') => (lang === 'ml' ? ML_NAME[e.symbol] ?? e.name : e.name);

export const FAMILY_NAME: Record<Family, { en: string; ml: string }> = {
  alkali: { en: 'alkali metal', ml: 'ആൽക്കലി ലോഹം' },
  alkaline: { en: 'alkaline earth metal', ml: 'ആൽക്കലൈൻ എർത്ത് ലോഹം' },
  transition: { en: 'transition metal', ml: 'സംക്രമണ ലോഹം' },
  post: { en: 'post-transition metal', ml: 'ലോഹം' },
  metalloid: { en: 'metalloid', ml: 'ഉപലോഹം' },
  nonmetal: { en: 'non-metal', ml: 'അലോഹം' },
  halogen: { en: 'halogen', ml: 'ഹാലൊജൻ' },
  noble: { en: 'noble gas', ml: 'ഉൽകൃഷ്ട വാതകം' },
  lanthanide: { en: 'lanthanide', ml: 'ലാന്തനൈഡ്' },
  actinide: { en: 'actinide', ml: 'ആക്ടിനൈഡ്' },
  unknown: { en: 'element', ml: 'മൂലകം' },
};

/** An element from its symbol ("Na"), its name ("sodium", "sulphur") or its atomic number. */
export function findElement(x: string | number): Element | null {
  if (typeof x === 'number') return ELEMENTS[x - 1] ?? null;
  const s = x.trim();
  return BY_SYMBOL.get(s) ?? BY_NAME.get(s.toLowerCase()) ?? (/^\d+$/.test(s) ? ELEMENTS[Number(s) - 1] ?? null : null);
}

/**
 * The atomic mass as school textbooks use it (H 1, C 12, O 16, Na 23, Cl 35.5, Cu 63.5 …). Other elements: the
 * standard value to two decimals.
 */
const SCHOOL_MASS: Record<string, number> = {
  H: 1, He: 4, Li: 7, Be: 9, B: 11, C: 12, N: 14, O: 16, F: 19, Ne: 20, Na: 23, Mg: 24, Al: 27, Si: 28, P: 31, S: 32, Cl: 35.5, Ar: 40,
  K: 39, Ca: 40, Cr: 52, Mn: 55, Fe: 56, Co: 59, Ni: 59, Cu: 63.5, Zn: 65, Br: 80, Ag: 108, Sn: 119, I: 127, Ba: 137, Au: 197, Hg: 201, Pb: 207,
};
export const schoolMass = (e: Element): number => SCHOOL_MASS[e.symbol] ?? Math.round(e.mass * 100) / 100;

const SUPER = '⁰¹²³⁴⁵⁶⁷⁸⁹';
const fromSuper = (s: string) => Number(s.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]/g, (c) => String(SUPER.indexOf(c))));

/** Every sub-shell of the configuration, the noble-gas core written out: [[1,'s',2],[2,'s',2],…]. */
export function subshells(e: Element): Array<[n: number, l: string, count: number]> {
  const out: Array<[number, string, number]> = [];
  for (const part of e.config.split(/\s+/)) {
    const core = part.match(/^\[([A-Z][a-z]?)\]$/);
    if (core) { const c = findElement(core[1]); if (c) out.push(...subshells(c)); continue; }
    const m = part.match(/^(\d)([spdf])([⁰¹²³⁴⁵⁶⁷⁸⁹]+)$/);
    if (m) out.push([Number(m[1]), m[2], fromSuper(m[3])]);
  }
  return out;
}

/** Electrons in each shell K, L, M, N … (the "2, 8, 1" of sodium). */
export function shells(e: Element): number[] {
  const out: number[] = [];
  for (const [n, , c] of subshells(e)) out[n - 1] = (out[n - 1] ?? 0) + c;
  return Array.from(out, (x) => x ?? 0);
}
export const SHELL_NAMES = ['K', 'L', 'M', 'N', 'O', 'P', 'Q'];

/** Valence electrons and valency of a main-group element (null for transition, lanthanide and actinide elements). */
export function valencyOf(e: Element): { valence: number; valency: number; gains: boolean } | null {
  if (e.group === 0 || (e.group >= 3 && e.group <= 12)) return null;
  const sh = shells(e);
  const valence = sh[sh.length - 1];
  if (e.family === 'noble') return { valence, valency: 0, gains: false };
  if (e.symbol === 'H') return { valence: 1, valency: 1, gains: false };
  const valency = valence <= 4 ? valence : 8 - valence;
  return { valence, valency, gains: valence > 4 };
}

/** The configuration with the core written out (for small atoms, as Kerala textbooks write it: 1s² 2s² 2p⁶ 3s¹). */
export function fullConfig(e: Element): string {
  const sup = (n: number) => String(n).replace(/\d/g, (d) => SUPER[Number(d)]);
  return subshells(e).map(([n, l, c]) => `${n}${l}${sup(c)}`).join(' ');
}
