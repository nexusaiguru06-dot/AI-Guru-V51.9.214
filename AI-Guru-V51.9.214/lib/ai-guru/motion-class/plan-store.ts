/**
 * V51.9.208 — the whiteboard lesson's AI plan, kept on this device.
 * The classroom plans each section once (the AI reads every paragraph and decides what the board draws and says).
 * That plan used to live only in memory, so every new visit planned the same section again. Now it is saved in this
 * browser (localStorage, newest 24 sections), and the next visit starts playing at once.
 */
const PREFIX = 'aig_plan_v1:';
const KEEP = 24;

export interface StoredPlan<P, S> { plans: Array<[string, P]>; subjects?: Array<[string, S]>; at: number }

export function loadPlan<P, S>(key: string): { plans: Map<string, P>; subjects?: Map<string, S>; at: number } | null {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const j = JSON.parse(raw) as StoredPlan<P, S>;
    if (!Array.isArray(j.plans) || !j.plans.length) return null;
    return { plans: new Map(j.plans), subjects: Array.isArray(j.subjects) ? new Map(j.subjects) : undefined, at: j.at || 0 };
  } catch { return null; }
}

export function savePlan<P, S>(key: string, v: { plans: Map<string, P>; subjects?: Map<string, S> }): void {
  try {
    const rec: StoredPlan<P, S> = { plans: [...v.plans], ...(v.subjects ? { subjects: [...v.subjects] } : {}), at: Date.now() };
    const text = JSON.stringify(rec);
    const put = () => localStorage.setItem(PREFIX + key, text);
    try { put(); } catch { dropOldest(Math.ceil(KEEP / 2)); put(); } // a full browser store: make room, once
    const all = ours();
    if (all.length > KEEP) for (const k of all.slice(0, all.length - KEEP)) localStorage.removeItem(k.key);
  } catch { /* not kept: the lesson still plays, it is just planned again next time */ }
}

function ours(): Array<{ key: string; at: number }> {
  const out: Array<{ key: string; at: number }> = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k || !k.startsWith(PREFIX)) continue;
    let at = 0;
    try { at = (JSON.parse(localStorage.getItem(k) || '{}') as { at?: number }).at || 0; } catch { /* old or broken: oldest */ }
    out.push({ key: k, at });
  }
  return out.sort((a, b) => a.at - b.at);
}
function dropOldest(n: number) { for (const k of ours().slice(0, n)) localStorage.removeItem(k.key); }
