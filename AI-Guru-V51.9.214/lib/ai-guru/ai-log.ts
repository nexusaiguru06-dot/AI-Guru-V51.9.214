/**
 * V51.9.114 — a log of every AI call made from this browser: which provider, model and key (masked) was tried, for
 * which task, whether it worked, how long it took and — when it failed — Google's / the provider's own reason.
 * Kept in memory only (this page visit); the Material Studio shows it so a teacher can see why a material was slow
 * or failed. Keys are never logged in full.
 */

export type AiProvider = 'gemini' | 'openai' | 'agnes' | 'sarvam' | 'openrouter';

export interface AiLogEntry {
  id: number;
  at: number;
  provider: AiProvider;
  model: string;
  /** Masked key, e.g. "AIza…1234". */
  key?: string;
  task?: string;
  ok: boolean;
  ms: number;
  /** Why it failed (short), or a note. */
  error?: string;
  /** HTTP status when there was one. */
  status?: number;
}

const MAX = 300;
const entries: AiLogEntry[] = [];
const listeners = new Set<(e: AiLogEntry[]) => void>();
let seq = 0;

/** "Gemini HTTP 429: Resource has been exhausted (e.g. check quota)." → short and readable. */
export function shortReason(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err ?? '');
  return raw.replace(/\s+/g, ' ').replace(/AIza[0-9A-Za-z_-]{20,}/g, 'AIza…').replace(/sk-[0-9A-Za-z_-]{10,}/g, 'sk-…').trim().slice(0, 220) || 'Unknown error';
}

export const maskKey = (k?: string | null) => (k ? `${k.slice(0, 4)}…${k.slice(-4)}` : undefined);

export function logAi(e: Omit<AiLogEntry, 'id' | 'at'> & { at?: number }): void {
  const entry: AiLogEntry = { ...e, id: ++seq, at: e.at ?? Date.now(), error: e.error ? shortReason(e.error) : undefined };
  entries.push(entry);
  if (entries.length > MAX) entries.splice(0, entries.length - MAX);
  const copy = entries.slice();
  for (const fn of listeners) { try { fn(copy); } catch { /* a listener must not break the AI call */ } }
}

export function aiLogEntries(): AiLogEntry[] { return entries.slice(); }

export function onAiLog(fn: (e: AiLogEntry[]) => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

export function clearAiLog(): void {
  entries.length = 0;
  for (const fn of listeners) fn([]);
}

/** Times an attempt and logs it (re-throws the error). */
export async function timedAi<T>(meta: Omit<AiLogEntry, 'id' | 'at' | 'ok' | 'ms' | 'error'>, run: () => Promise<T>): Promise<T> {
  const t0 = Date.now();
  try {
    const r = await run();
    logAi({ ...meta, ok: true, ms: Date.now() - t0 });
    return r;
  } catch (err) {
    const status = typeof (err as { status?: unknown })?.status === 'number' ? (err as { status: number }).status : undefined;
    logAi({ ...meta, ok: false, ms: Date.now() - t0, error: shortReason(err), status });
    throw err;
  }
}
