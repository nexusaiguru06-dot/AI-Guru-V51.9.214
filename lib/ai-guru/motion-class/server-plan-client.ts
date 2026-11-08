/**
 * V51.9.209 (browser) — asks the server for the whiteboard lesson plan it made for a section, so the classroom plays at
 * once and needs no AI key of the student's own. Returns null when the server has none (the classroom then plans as before).
 */
export interface ServerPlan<P, S> { plans: Map<string, P>; subjects: Map<string, S> }

export async function fetchServerPlan<P, S>(materialId: string, sectionId: string, hash: number): Promise<ServerPlan<P, S> | null> {
  try {
    const q = new URLSearchParams({ materialId, sectionId, h: String(hash) });
    const r = await fetch(`/api/ai-guru/board-plan?${q}`, { cache: 'no-store', signal: AbortSignal.timeout(8000) });
    if (!r.ok) return null;
    const j = (await r.json()) as { ok?: boolean; plans?: Array<[string, P]>; subjects?: Array<[string, S]> };
    if (!j.ok || !Array.isArray(j.plans) || !j.plans.length) return null;
    return { plans: new Map(j.plans), subjects: new Map(Array.isArray(j.subjects) ? j.subjects : []) };
  } catch { return null; }
}
