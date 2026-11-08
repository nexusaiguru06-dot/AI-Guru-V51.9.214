'use client';

/**
 * V51.9.114 — "AI keys & log" on the Material Studio: which AI keys this browser has (Gemini keys with their state,
 * OpenAI / Agnes / Sarvam), which provider and model is making each study material right now, and — when a call
 * fails — the provider's own reason (e.g. "HTTP 429: quota exceeded"). Keys are shown masked.
 */

import { useEffect, useState } from 'react';
import { aiLogEntries, clearAiLog, maskKey, onAiLog, type AiLogEntry } from '@/lib/ai-guru/ai-log';
import { getFallbackProviders, getProviders } from '@/lib/ai-guru/byok-providers';
import { GEMINI_TEXT_MODEL, studentKey } from '@/lib/student-key';
import { openRouter } from '@/lib/ai-guru/openrouter';

const PROVIDER: Record<string, string> = { gemini: 'Gemini', openai: 'OpenAI', agnes: 'Agnes AI', sarvam: 'Sarvam AI', openrouter: 'OpenRouter' };
const STATE: Record<string, [string, string]> = {
  ready: ['ready', 'text-emerald-300'],
  'daily-limit': ['used up for today', 'text-amber-300'],
  cooldown: ['resting a minute (rate limit)', 'text-amber-300'],
  invalid: ['not valid', 'text-rose-300'],
};
const time = (t: number) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

/** Plain words for the common failures. */
export function explain(e: Pick<AiLogEntry, 'status' | 'error'>): string {
  const m = (e.error ?? '').toLowerCase();
  if (e.status === 429 || /quota|exhausted|rate.?limit|429/.test(m)) return /day|daily|per day/.test(m) ? 'This key has used up today’s free limit.' : 'Too many requests a minute on this key — it rests and the next key is tried.';
  if (e.status === 400 && /api key|api_key|invalid/.test(m)) return 'The key is not valid. Check it in Settings.';
  if (e.status === 401 || e.status === 403 || /permission|unauthori[sz]ed|forbidden/.test(m)) return 'The key is not allowed to use this model.';
  if ((e.status ?? 0) >= 500 || /unavailable|overloaded|internal/.test(m)) return 'The AI service is busy. It is tried again.';
  if (/not active|no gemini api key|no .* key/.test(m)) return 'No usable key for this provider.';
  if (/failed to fetch|network|offline/.test(m)) return 'No internet connection to the AI service.';
  if (/json|parse|empty/.test(m)) return 'The AI answer could not be read; another try is made.';
  return '';
}

export function AiKeysLog() {
  const [log, setLog] = useState<AiLogEntry[]>([]);
  const [open, setOpen] = useState(true);
  const [tick, setTick] = useState(0); // re-read the key states after each call
  useEffect(() => {
    void Promise.resolve().then(() => setLog(aiLogEntries()));
    const bump = () => setTick((t) => t + 1);
    window.addEventListener('ai-guru-openrouter-changed', bump);
    const off = onAiLog((e) => { setLog(e); setTick((t) => t + 1); });
    return () => { window.removeEventListener('ai-guru-openrouter-changed', bump); off(); };
  }, []);
  const [keys, setKeys] = useState<{ gemini: ReturnType<typeof studentKey.getAll>; others: Array<{ id: string; label: string; model: string; on: boolean; state: string; error?: string }> } | null>(null);
  useEffect(() => {
    void Promise.resolve().then(() => {
      const p = getProviders();
      const d = getFallbackProviders();
      setKeys({
        gemini: studentKey.getAll(),
        // V51.9.164: the OpenRouter keys are listed too
        others: [...openRouter.getAll().map((k, i) => {
          const st = openRouter.status(k);
          return { id: `or-${i}`, label: 'OpenRouter', model: openRouter.model() || 'free models', on: true, state: st === 'ready' ? 'ready' : st === 'daily-limit' ? 'used up for today' : st === 'cooldown' ? 'resting (rate limit)' : 'not valid', error: k.lastError };
        }), ...(Object.keys(d) as Array<keyof typeof d>).map((id) => {
          const s = p[id];
          const state = !s?.key ? 'not added' : s.invalid ? 'not valid' : s.cooldownUntil && s.cooldownUntil > Date.now() ? 'resting (rate limit)' : 'ready';
          return { id, label: d[id].label, model: d[id].model, on: !!s?.key, state, error: s?.lastError };
        })],
      });
    });
  }, [tick]);
  const last = [...log].reverse().find((e) => e.ok);
  return (
    <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3 text-xs text-white/80" data-ai-keys-log>
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => setOpen((o) => !o)} className="font-semibold text-white">{open ? '▾' : '▸'} AI keys &amp; log</button>
        {last && <span className="text-white/50">· last answer from <b className="text-cyan-200">{PROVIDER[last.provider]} {last.model}</b>{last.task ? ` (${last.task})` : ''}</span>}
        {log.length > 0 && <button type="button" onClick={clearAiLog} className="ml-auto rounded border border-white/15 px-2 py-0.5 text-[11px] text-white/60 hover:text-white">Clear log</button>}
      </div>
      {open && keys && (
        <div className="mt-2 grid gap-3 md:grid-cols-[minmax(0,260px)_minmax(0,1fr)]">
          <div className="space-y-1.5">
            <div className="text-[11px] font-bold uppercase tracking-wider text-white/40">Keys on this browser</div>
            {keys.gemini.length === 0 && <div className="text-amber-200">Gemini: no key — add one in <a className="underline" href="/ai-guru/settings/gemini">Settings</a>.</div>}
            {keys.gemini.map((k) => {
              const [label, cls] = STATE[studentKey.status(k)] ?? ['?', ''];
              return (
                <div key={k.id} title={k.lastError ?? ''}>
                  <span className="font-semibold">Gemini</span> <span className="font-mono text-white/60">{maskKey(k.key)}</span> · <span className={cls}>{label}</span>
                  {k.lastError && studentKey.status(k) !== 'ready' && <div className="truncate pl-3 text-[11px] text-white/40">{k.lastError}</div>}
                </div>
              );
            })}
            <div className="text-[11px] text-white/40">Gemini model: {GEMINI_TEXT_MODEL}</div>
            {keys.others.map((o) => (
              <div key={o.id} title={o.error ?? ''}>
                <span className="font-semibold">{o.label}</span> · <span className={o.on ? (o.state === 'ready' ? 'text-emerald-300' : 'text-amber-300') : 'text-white/35'}>{o.state}</span>{o.on && <span className="text-white/40"> · {o.model}</span>}
              </div>
            ))}
            <div className="text-[11px] text-white/40">Order: OpenAI first when added, else Gemini (each saved key in turn), then OpenRouter, then Agnes and Sarvam.</div>
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-bold uppercase tracking-wider text-white/40">What happened (this visit)</div>
            {log.length === 0 && <div className="mt-1 text-white/45">Nothing yet. When you create study materials, every AI call is listed here: which model made it, or why it failed.</div>}
            <ul className="mt-1 max-h-56 space-y-1 overflow-y-auto pr-1">
              {[...log].reverse().map((e) => {
                const why = e.ok ? '' : explain(e);
                return (
                  <li key={e.id} className={`rounded-md px-2 py-1 ${e.ok ? 'bg-emerald-400/5' : 'bg-rose-400/10'}`}>
                    <span className="text-white/40">{time(e.at)}</span> {e.ok ? '✅' : '❌'} <b>{PROVIDER[e.provider]}</b> <span className="text-white/60">{e.model}</span>{e.key && <span className="font-mono text-white/40"> {e.key}</span>}
                    {e.task && <span className="text-cyan-200/80"> · {e.task}</span>}
                    <span className="text-white/40"> · {(e.ms / 1000).toFixed(1)} s</span>
                    {!e.ok && <div className="pl-5 text-rose-200">{why && <b>{why} </b>}<span className="text-rose-200/70">{e.error}</span></div>}
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
