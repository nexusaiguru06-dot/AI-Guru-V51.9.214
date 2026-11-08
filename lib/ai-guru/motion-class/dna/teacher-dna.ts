/**
 * Teacher choices for DNA selection (V51.9.63): "for this problem, use this template".
 * A pin is keyed by the problem's text (whitespace and case do not matter), so the same problem is taught with the same
 * template in every class and on every device the teacher's choices are synced to. Pins are checked first by selectDna().
 */

export interface TeacherPin {
  key: string;
  /** First words of the problem, to show in the teacher's list. */
  preview: string;
  /** A built-in DNA id, or `learned:<id>` for a template. */
  dna: string;
  at: string;
}

const KEY = 'ai-guru-teacher-pins';
let pins: Map<string, TeacherPin> | null = null;

/** Stable key for a problem text. */
export function pinKey(text: string): string {
  const clean = text.replace(/\s+/g, ' ').trim().toLowerCase();
  let h = 2166136261;
  for (const ch of clean) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return `${(h >>> 0).toString(36)}-${clean.length}`;
}

function load(): Map<string, TeacherPin> {
  if (pins) return pins;
  pins = new Map();
  try {
    if (typeof localStorage !== 'undefined') for (const p of JSON.parse(localStorage.getItem(KEY) || '[]') as TeacherPin[]) if (p?.key && p.dna) pins.set(p.key, p);
  } catch {
    /* unreadable: start empty */
  }
  return pins;
}

function persist() {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(KEY, JSON.stringify([...load().values()]));
  } catch {
    /* storage unavailable: kept in memory */
  }
}

export const pinnedDna = (text: string): string | undefined => load().get(pinKey(text))?.dna;
export const allPins = (): TeacherPin[] => [...load().values()].sort((a, b) => b.at.localeCompare(a.at));

export function setPin(text: string, dna: string): TeacherPin {
  const p: TeacherPin = { key: pinKey(text), preview: text.replace(/\s+/g, ' ').trim().slice(0, 90), dna, at: new Date().toISOString() };
  load().set(p.key, p);
  persist();
  return p;
}

export function removePin(text: string): void {
  load().delete(pinKey(text));
  persist();
}

/** Replace all pins (used when the server's copy arrives). Newer local pins win on the same key. */
export function mergePins(list: TeacherPin[]): void {
  const m = load();
  for (const p of list) if (p?.key && p.dna && (!m.get(p.key) || m.get(p.key)!.at < p.at)) m.set(p.key, p);
  persist();
}

/** Tests only. */
export function resetPins(): void {
  pins = new Map();
}
