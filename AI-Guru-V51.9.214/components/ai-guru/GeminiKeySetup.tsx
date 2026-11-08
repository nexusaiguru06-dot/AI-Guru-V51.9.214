'use client';
/**
 * Gemini BYOK key-pool manager (adopted from the v35 build).
 *
 * The v43 settings page originally exposed a single key. lib/student-key.ts
 * already implements the full 5-slot pool with automatic rotation on
 * daily-quota / rate-limit / invalid-key failures, so this component simply
 * surfaces that pool. Styling follows the existing v43 dark theme
 * (#070a0f / #10141b / cyan-300) so nothing else in the app changes.
 */
import { useEffect, useState } from 'react';
import { CheckCircle2, ExternalLink, Trash2 } from 'lucide-react';
import { studentKey, isValidGeminiKey, validateGeminiKey, type GeminiKeyState } from '@/lib/student-key';

const SLOTS = 5;

/** V51.9.199: `slots` = how many paste boxes (students get one; the office keeps the five-key pool). */
export function GeminiKeySetup({ onKeyChanged, slots: SLOTS = 5 }: { onKeyChanged?: () => void; slots?: number }) {
  const [keys, setKeys] = useState<GeminiKeyState[]>([]);
  const [mounted, setMounted] = useState(false);
  const [busySlot, setBusySlot] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    setMounted(true);
    const refresh = () => setKeys(studentKey.getAll());
    refresh();
    window.addEventListener('gemini-key-pool-changed', refresh);
    return () => window.removeEventListener('gemini-key-pool-changed', refresh);
  }, []);

  function refresh() {
    setKeys(studentKey.getAll());
    onKeyChanged?.();
  }

  async function saveKey(raw: string, slot: number) {
    const key = raw.trim();
    setError('');
    setNotice('');
    if (!key) return;
    if (!isValidGeminiKey(key)) {
      setError('That does not look like a Gemini API key. Keys from Google AI Studio start with "AIza".');
      return;
    }
    if (studentKey.getAll().some(k => k.key === key)) {
      setError('That key is already saved in another slot.');
      return;
    }
    setBusySlot(slot);
    try {
      const validation = await validateGeminiKey(key);
      studentKey.save(key);
      studentKey.markValidated(key, validation.model);
      refresh();
      setNotice(SLOTS === 1 ? `Your key is connected and validated (${validation.model}).` : `Key ${slot + 1} is connected and validated (${validation.model}).`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gemini key validation failed.');
    } finally {
      setBusySlot(null);
    }
  }

  async function pasteInto(slot: number) {
    try {
      const text = await navigator.clipboard.readText();
      await saveKey(text, slot);
    } catch {
      setError('Could not read the clipboard. Paste the key into the box instead.');
    }
  }

  if (!mounted) return <div className="h-96 animate-pulse rounded-2xl border border-white/10 bg-[#10141b]" />;

  const activeCount = keys.filter(k => studentKey.status(k) === 'ready').length;
  const inUse = studentKey.get();

  return (
    <div className="rounded-2xl border border-white/10 bg-[#10141b] p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">{SLOTS === 1 ? 'Your Gemini key' : 'Your Gemini keys'}</h2>
          <p className="mt-1 text-sm leading-6 text-white/50">
            {SLOTS === 1 ? 'Press Get key, make your free key on Google AI Studio, copy it, then paste it below and press Save. It is kept in this browser only and is never sent to the AI Guru server.' : <>Paste up to {SLOTS} free keys. Material Studio uses them in rotation — when one hits its daily
            quota or a rate limit, generation continues automatically on the next key. Keys are stored in
            this browser only and are never sent to the AI Guru server.</>}
          </p>
        </div>
        {SLOTS > 1 && <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-cyan-300/30 bg-cyan-300/10 px-3 py-2 text-xs font-semibold text-cyan-100 hover:bg-cyan-300/20"><ExternalLink size={13}/> Get key</a>}
      </div>

      {SLOTS > 1 && <div className="mt-5 rounded-xl border border-white/10 bg-black/25 p-3 text-sm text-white/70">
        {keys.length} / {SLOTS} keys saved — <span className="text-emerald-300">{activeCount} active</span>,{' '}
        <span className="text-amber-200">{keys.length - activeCount} inactive</span>
      </div>}

      <div className="mt-4 space-y-3">
        {Array.from({ length: SLOTS }, (_, slot) => {
          const item = keys[slot];
          const status = item ? studentKey.status(item) : null;
          const ready = status === 'ready';
          const reason =
            status === 'daily-limit' ? 'Daily limit' : status === 'cooldown' ? 'Cooling down' : status === 'invalid' ? 'Invalid' : null;
          const currentlyInUse = Boolean(item && inUse === item.key);
          return (
            <div
              key={slot}
              className={`flex flex-wrap items-center gap-2 rounded-xl border p-3 ${
                currentlyInUse
                  ? 'border-emerald-300/40 bg-emerald-300/10'
                  : ready
                    ? 'border-white/10 bg-black/20'
                    : item
                      ? 'border-amber-300/25 bg-amber-300/5'
                      : 'border-white/10 bg-black/20'
              }`}
            >
              {SLOTS > 1 && <div className="w-9 rounded-lg bg-white/10 py-2 text-center font-mono text-sm">{slot + 1}</div>}

              {item ? (
                <input readOnly value={studentKey.masked(item.key) || ''} className="min-w-0 flex-1 bg-transparent px-2 py-2 font-mono text-sm text-white/60 outline-none" />
              ) : (
                <input
                  type="password"
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="Paste a Gemini API key here"
                  disabled={busySlot !== null}
                  className="min-w-0 flex-1 rounded-lg border border-white/10 bg-black/30 px-3 py-2 font-mono text-sm outline-none focus:border-cyan-300"
                  onPaste={e => void saveKey(e.clipboardData.getData('text'), slot)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') void saveKey((e.target as HTMLInputElement).value, slot);
                  }}
                  onBlur={e => {
                    if (e.target.value.trim()) void saveKey(e.target.value, slot);
                  }}
                />
              )}

              {item && (
                <span
                  className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold ${
                    ready ? 'bg-emerald-300/15 text-emerald-100' : 'bg-amber-300/15 text-amber-100'
                  }`}
                >
                  {ready ? <CheckCircle2 size={13} /> : null}
                  {ready ? 'Active' : `Inactive${reason ? ` · ${reason}` : ''}`}
                </span>
              )}
              {currentlyInUse && <span className="rounded-lg border border-emerald-300/30 px-2 py-1 text-xs text-emerald-200">In use</span>}

              {busySlot === slot ? (
                <span className="px-2 text-xs text-cyan-200">Checking…</span>
              ) : item ? (
                <button
                  type="button"
                  onClick={() => {
                    studentKey.remove(item.id);
                    refresh();
                    setNotice(`Key ${slot + 1} was removed from this browser.`);
                  }}
                  className="inline-flex items-center gap-1 rounded-lg border border-red-300/20 px-3 py-2 text-xs text-red-200 hover:bg-red-950/30"
                >
                  <Trash2 size={13} /> Delete
                </button>
              ) : (
                <div className="flex items-center gap-1.5">
                  <button type="button" onClick={() => void pasteInto(slot)} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-white/70 hover:bg-white/10">
                    Paste
                  </button>
                  <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg border border-cyan-300/20 px-3 py-2 text-xs text-cyan-100 hover:bg-cyan-300/10">
                    <ExternalLink size={12}/> Get key
                  </a>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {error && (
        <div role="alert" className="mt-4 rounded-xl border border-red-400/30 bg-red-950/25 p-3 text-sm text-red-100">
          {error}
        </div>
      )}
      {!error && notice && (
        <div className="mt-4 rounded-xl border border-emerald-300/20 bg-emerald-300/5 p-3 text-sm text-emerald-100">
          <CheckCircle2 className="mr-2 inline" size={15} />
          {notice}
        </div>
      )}

      <p className="mt-5 text-xs leading-5 text-white/40">
        Each key is checked against Google before it is marked active. A key that returns a daily-quota error is
        benched until the next day and becomes eligible again automatically. Never paste a key into a chat
        message or commit it to source files.
      </p>
    </div>
  );
}
