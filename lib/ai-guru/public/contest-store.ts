import { promises as fs } from 'node:fs';
import path from 'node:path';

export interface Entry { contest: string; year: number; studentId: string; name: string; school: string; correct: number; seconds: number; at: string }
const DIR = path.join(process.cwd(), 'data', 'ai-guru', 'progress');
const FILE = path.join(DIR, 'contests.json');
let chain: Promise<unknown> = Promise.resolve();

export async function readEntries(): Promise<Entry[]> {
  try { const a = JSON.parse(await fs.readFile(FILE, 'utf8')); return Array.isArray(a) ? a : []; } catch { return []; }
}
/** One entry per student per contest edition: only a better result (more right, or the same and faster) replaces the first. */
export function addEntry(e: Entry): Promise<'new' | 'better' | 'kept'> {
  const run = chain.then(async () => {
    const all = await readEntries();
    const i = all.findIndex((x) => x.contest === e.contest && x.year === e.year && x.studentId === e.studentId);
    let out: 'new' | 'better' | 'kept' = 'new';
    if (i >= 0) { const o = all[i]; if (e.correct > o.correct || (e.correct === o.correct && e.seconds < o.seconds)) { all[i] = e; out = 'better'; } else out = 'kept'; } else all.push(e);
    await fs.mkdir(DIR, { recursive: true });
    const tmp = `${FILE}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(all.slice(-20000)));
    await fs.rename(tmp, FILE);
    return out;
  });
  chain = run.catch(() => undefined);
  return run;
}

/** Most right first; ties go to the faster one. Ties on both share a rank. */
export function ranked(entries: Entry[]): Array<Entry & { rank: number }> {
  const s = [...entries].sort((a, b) => b.correct - a.correct || a.seconds - b.seconds || a.name.localeCompare(b.name));
  let rank = 0, pc = -1, ps = -1;
  return s.map((e, i) => { if (e.correct !== pc || e.seconds !== ps) { rank = i + 1; pc = e.correct; ps = e.seconds; } return { ...e, rank }; });
}
