/**
 * Member numbers: ST-123-26 = the 123rd student who joined in 2026; TE-34-26 = the 34th teacher of 2026.
 * The count restarts each Indian-time year (the year in the number keeps every number unique). Pure rules, no I/O.
 */
export type CodeKind = 'ST' | 'TE';

/** Two-digit year in India (IST), e.g. 26 for 2026. */
export function yearTag(now: Date = new Date()): string {
  const ist = new Date(now.getTime() + 5.5 * 3600_000);
  return String(ist.getUTCFullYear() % 100).padStart(2, '0');
}

export const formatCode = (kind: CodeKind, n: number, yy: string) => `${kind}-${n}-${yy}`;

export function parseCode(code: string): { kind: CodeKind; n: number; yy: string } | null {
  const m = /^(ST|TE)-(\d{1,7})-(\d{2})$/i.exec(code.trim());
  return m ? { kind: m[1].toUpperCase() as CodeKind, n: Number(m[2]), yy: m[3] } : null;
}

/** Takes the next number for this kind and year; `counters` is saved with the data so a number is never given twice. */
export function nextCode(counters: Record<string, number>, kind: CodeKind, now: Date = new Date()): string {
  const yy = yearTag(now), key = `${kind}-${yy}`;
  counters[key] = (counters[key] ?? 0) + 1;
  return formatCode(kind, counters[key], yy);
}

/** Makes sure the counters are at least as high as numbers already given (older data, or a restored backup). */
export function syncCounters(counters: Record<string, number>, existing: Array<string | undefined>): void {
  for (const c of existing) {
    const p = c ? parseCode(c) : null;
    if (!p) continue;
    const key = `${p.kind}-${p.yy}`;
    if ((counters[key] ?? 0) < p.n) counters[key] = p.n;
  }
}

/** The same teacher teaching several classes keeps one number: match on phone digits, else on name + school. */
export function sameTeacher(a: { teacherName: string; teacherPhone?: string; school?: string }, b: { teacherName: string; teacherPhone?: string; school?: string }): boolean {
  const pa = (a.teacherPhone ?? '').replace(/\D/g, '').slice(-10), pb = (b.teacherPhone ?? '').replace(/\D/g, '').slice(-10);
  if (pa.length >= 8 && pb.length >= 8) return pa === pb;
  const k = (x: typeof a) => `${x.teacherName.trim().toLowerCase()}|${(x.school ?? '').trim().toLowerCase()}`;
  return k(a) === k(b);
}
