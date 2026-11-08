/**
 * V51.9.173 — a simple guard against someone hammering the API (and spending the school's AI / voice credit).
 * Counts requests per address per minute in this server process. The limits are generous on purpose: a whole school
 * class can sit behind one address. Set AI_GURU_RATE_AI_PER_MIN / AI_GURU_RATE_PER_MIN to change them; 0 turns it off.
 */
const hits = new Map<string, number[]>();
let lastSweep = 0;

export function allow(bucket: string, limit: number, now = Date.now()): boolean {
  if (!(limit > 0)) return true;
  if (now - lastSweep > 60_000) {
    lastSweep = now;
    for (const [k, v] of hits) { const r = v.filter((t) => now - t < 60_000); if (r.length) hits.set(k, r); else hits.delete(k); }
  }
  const xs = (hits.get(bucket) ?? []).filter((t) => now - t < 60_000);
  if (xs.length >= limit) { hits.set(bucket, xs); return false; }
  xs.push(now);
  hits.set(bucket, xs);
  return true;
}

/** Routes that call a paid AI or voice service. */
export const AI_ROUTES = [
  '/api/ai-guru/tts', '/api/ai-guru/sarvam-tts', '/api/ai-guru/piper-tts', '/api/ai-guru/teacher-voice', '/api/ai-guru/model-router',
  '/api/ai-guru/byok', '/api/ai-guru/doubt', '/api/ai-guru/generate-lesson', '/api/ai-guru/lesson', '/api/ai-guru/math',
  '/api/ai-guru/material-studio', '/api/ai-guru/video', '/api/ai-guru/remediation', '/api/ai-guru/assessment', '/api/ai-guru/messages',
];
export const isAiRoute = (p: string) => AI_ROUTES.some((r) => p === r || p.startsWith(`${r}/`));
export const limits = () => ({
  ai: Number(process.env.AI_GURU_RATE_AI_PER_MIN ?? 600),
  all: Number(process.env.AI_GURU_RATE_PER_MIN ?? 1200),
});
