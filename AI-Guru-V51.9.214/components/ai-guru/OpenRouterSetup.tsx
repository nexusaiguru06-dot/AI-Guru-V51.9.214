'use client';

/**
 * V51.9.158 — Settings card: the student's OpenRouter key(s), the backup behind the Gemini keys.
 * Add (checked without spending a request), see each key's state and daily allowance, pick a free model (or let
 * AI Guru choose), and try it in Malayalam. Keys stay in this browser.
 */
import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Trash2 } from 'lucide-react';
import { callOpenRouter, listFreeModels, MODEL_GROUPS, modelGroup, openRouter, validateOpenRouterKey, type FreeModel, type OpenRouterKey } from '@/lib/ai-guru/openrouter';

const STATUS: Record<string, [string, string]> = {
  ready: ['Ready', 'bg-emerald-300/15 text-emerald-100'],
  'daily-limit': ['Today’s free requests used', 'bg-amber-300/15 text-amber-100'],
  cooldown: ['Resting a minute', 'bg-amber-300/15 text-amber-100'],
  invalid: ['Not accepted', 'bg-red-300/15 text-red-100'],
};

export function OpenRouterSetup() {
  const [keys, setKeys] = useState<OpenRouterKey[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState<'' | 'save' | 'models' | 'test'>('');
  const [models, setModels] = useState<FreeModel[] | null>(null);
  const [model, setModel] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [answer, setAnswer] = useState('');

  const refresh = useCallback(() => { setKeys(openRouter.getAll()); setModel(openRouter.model() ?? ''); }, []);
  useEffect(() => {
    void Promise.resolve().then(refresh);
    window.addEventListener('ai-guru-openrouter-changed', refresh);
    return () => window.removeEventListener('ai-guru-openrouter-changed', refresh);
  }, [refresh]);

  const loadModels = useCallback(async (force = false) => {
    setBusy('models'); setErr('');
    try { setModels(await listFreeModels(force)); } catch (e) { setErr(`Could not load OpenRouter’s free models: ${e instanceof Error ? e.message : String(e)}`); }
    finally { setBusy(''); }
  }, []);
  useEffect(() => { if (keys.length && models === null) void Promise.resolve().then(() => loadModels()); }, [keys.length, models, loadModels]);

  const save = async () => {
    if (!draft.trim()) return;
    setBusy('save'); setErr(''); setMsg('');
    try {
      const k = await validateOpenRouterKey(draft);
      setDraft(''); refresh();
      setMsg(`OpenRouter key saved and checked. ${k.freeTier === false ? 'This account has bought credits: up to 1,000 free requests a day.' : 'Free account: about 50 free requests a day.'} It is used when your Gemini keys cannot answer.`);
    } catch (e) { setErr(e instanceof Error ? e.message : 'The key could not be checked.'); }
    finally { setBusy(''); }
  };
  const test = async () => {
    setBusy('test'); setErr(''); setAnswer('');
    try {
      const t = await callOpenRouter({ messages: [{ role: 'system', content: 'You are AI Guru, a friendly teacher for Kerala school students.' }, { role: 'user', content: 'In two short sentences, first in Malayalam and then in English, explain what a fraction is to a Std 5 student.' }], maxTokens: 300, task: 'OpenRouter test' });
      setAnswer(t.trim());
    } catch (e) { setErr(e instanceof Error ? e.message : 'The test did not work.'); }
    finally { setBusy(''); }
  };

  return (
    <section className="mt-5 rounded-2xl border border-violet-300/20 bg-[#10141b] p-6" data-openrouter-setup>
      <h2 className="text-xl font-semibold">OpenRouter backup (free models)</h2>
      <p className="mt-1 text-sm leading-6 text-white/55">
        When all your Gemini keys reach today’s limit (or have none), AI Guru answers through <b>OpenRouter</b>’s free models instead: lessons, doubts, photos of your paper and more.
        A free OpenRouter account gives about <b>50 free requests a day</b> (1,000 a day once the account has ever bought $10 of credits). Your Gemini keys are still used first.
      </p>
      <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-white/70">
        <li>Ask a parent or an older student to make a free account at <a className="text-cyan-300 underline" href="https://openrouter.ai" target="_blank" rel="noreferrer">openrouter.ai</a>.</li>
        <li>Open <a className="text-cyan-300 underline" href="https://openrouter.ai/keys" target="_blank" rel="noreferrer">openrouter.ai/keys</a>, press <b>Create key</b> and copy it (it starts with <code>sk-or-</code>).</li>
        <li>Paste it here and press <b>Save &amp; check</b>.</li>
      </ol>

      <div className="mt-4 flex flex-wrap gap-2">
        <input type="password" autoComplete="off" spellCheck={false} value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void save(); }} placeholder="Paste your OpenRouter key (sk-or-…)" className="min-w-[260px] flex-1 rounded-lg border border-white/10 bg-black/30 px-3 py-2 font-mono text-sm outline-none focus:border-violet-300" data-or-key-input />
        <button type="button" disabled={!draft.trim() || !!busy} onClick={() => void save()} className="rounded-lg bg-violet-300 px-4 py-2 text-xs font-semibold text-black disabled:opacity-40" data-or-save>{busy === 'save' ? 'Checking…' : 'Save & check'}</button>
      </div>

      {keys.length > 0 && (
        <div className="mt-4 space-y-2" data-or-keys>
          {keys.map((k) => {
            const st = openRouter.status(k);
            return (
              <div key={k.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2" data-or-key>
                <code className="font-mono text-sm text-white/70">{openRouter.masked(k.key)}</code>
                <span className={`rounded-lg px-2 py-1 text-xs font-semibold ${STATUS[st][1]}`}>{st === 'ready' && <CheckCircle2 className="mr-1 inline" size={13} />}{STATUS[st][0]}</span>
                <span className="text-xs text-white/45">{k.freeTier === false ? 'up to 1,000 free requests a day' : k.freeTier ? 'about 50 free requests a day' : ''}</span>
                {k.lastError && st !== 'ready' && <span className="w-full text-[11px] text-white/40">{k.lastError}</span>}
                <button type="button" onClick={() => { openRouter.remove(k.id); refresh(); setMsg('OpenRouter key removed.'); }} className="ml-auto inline-flex items-center gap-1 rounded-lg border border-red-300/20 px-3 py-1.5 text-xs text-red-200"><Trash2 size={13} /> Delete</button>
              </div>
            );
          })}
          <p className="text-xs text-white/40">You can add more than one key (for example a parent’s and your own): when one reaches today’s limit, the next is used.</p>
        </div>
      )}

      {keys.length > 0 && (
        <div className="mt-4 space-y-2 rounded-xl border border-white/10 bg-black/20 p-3">
          <label className="block text-sm font-semibold">Model
            <select value={model} onChange={(e) => { openRouter.setModel(e.target.value || null); setModel(e.target.value); }} className="mt-1 block w-full rounded-lg border border-white/10 bg-[#0b1426] px-3 py-2 text-sm" data-or-model>
              <option value="">Automatic — Gemini first, then OpenAI, then Sarvam (recommended)</option>
              {MODEL_GROUPS.map(([grp, label]) => {
                const list = (models ?? []).filter((m) => modelGroup(m.id) === grp);
                return list.length ? <optgroup key={grp} label={label}>{list.map((m) => <option key={m.id} value={m.id}>{m.vision ? '📷 ' : ''}{m.name}</option>)}</optgroup> : null;
              })}
            </select>
          </label>
          <p className="text-xs text-white/45">{models === null ? (busy === 'models' ? 'Loading today’s free models…' : '') : `${models.length} free models today, in this order: Gemini, OpenAI, Sarvam, then the others (good in Malayalam first). 📷 = can read photos; for a photo, Automatic takes the first one that can.`} <button type="button" onClick={() => void loadModels(true)} className="underline">Refresh list</button></p>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" disabled={!!busy || !openRouter.hasUsable()} onClick={() => void test()} className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold disabled:opacity-40" data-or-test>{busy === 'test' ? 'Asking…' : 'Try it (Malayalam + English)'}</button>
            <span className="text-xs text-white/40">Uses one request. Check how well the model writes Malayalam.</span>
          </div>
          {answer && <p className="whitespace-pre-wrap rounded-lg bg-black/30 p-2 text-sm text-white/85" data-or-answer>{answer}</p>}
        </div>
      )}

      {err && <div role="alert" className="mt-4 rounded-xl border border-red-400/30 bg-red-950/25 p-3 text-sm text-red-100">{err}</div>}
      {!err && msg && <div className="mt-4 rounded-xl border border-emerald-300/20 bg-emerald-300/5 p-3 text-sm text-emerald-100"><CheckCircle2 className="mr-2 inline" size={15} />{msg}</div>}
      <p className="mt-4 text-xs leading-5 text-white/40">
        The key stays in this browser and goes only to OpenRouter (never to the AI Guru server). Some free models are run by companies that may keep what is sent to them, so do not type your full name, phone number or address in questions. Voices (Gemini voice) and the live camera doubt still need a Gemini key.
      </p>
    </section>
  );
}
