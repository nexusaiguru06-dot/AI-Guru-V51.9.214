'use client';

/**
 * V51.9.124 — Reel Studio "🎬 Explainer": a topic or lesson passage becomes a cinematic explainer script — one short
 * sentence per screen, each over its own moving picture. ✨ Write the script asks the student's AI (English and
 * Malayalam); without a key the text is split into sentences. Every shot can be changed; "Use these changes" puts
 * them in the reel (so the voice is not made again on every key press).
 */
import { useRef, useState } from 'react';
import { makeScript, MAX_SHOTS, PLANET_NAME, PLANETS, SAMPLE_EXPLAINERS, VISUAL_NAME, VISUALS, type Bi, type Llm, type Planet, type Visual, type XScript, type XShot } from '@/lib/ai-guru/reels/explainer/script';
import type { Lang } from '@/lib/ai-guru/reels/motion';
import { styledLlm, type OpusCard } from '@/lib/ai-guru/reels/opus/library';

const llm: Llm = async (system, user) => {
  const { callAiGuruText } = await import('@/lib/ai-guru/byok-providers');
  return (await callAiGuruText(system, user, { json: true, maxOutputTokens: 8000, task: 'Explainer reel script' })).text;
};
const box = 'w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm outline-none focus:border-violet-400';
const small = 'rounded-lg border border-white/10 bg-[#0b1626] px-2 py-1 text-xs outline-none focus:border-violet-400';
const btn = 'rounded-lg border border-white/15 px-2.5 py-1 text-xs hover:bg-white/10 disabled:opacity-40';

async function smallPhoto(f: File): Promise<string> {
  const url = URL.createObjectURL(f);
  try {
    const im = new Image(); im.src = url; await im.decode();
    const s = Math.min(1, 900 / Math.max(im.naturalWidth, im.naturalHeight));
    const c = document.createElement('canvas'); c.width = Math.round(im.naturalWidth * s); c.height = Math.round(im.naturalHeight * s);
    c.getContext('2d')!.drawImage(im, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.8);
  } finally { URL.revokeObjectURL(url); }
}

export function ExplainerEditor({ applied, onApply, lang, standard, styleRecipe }: { applied: XScript; onApply: (s: XScript) => void; lang: Lang; standard?: string; /** V51.9.135: the style library's choice: ✨ Write the script writes in its style */ styleRecipe?: OpusCard | null }) {
  const [draft, setDraft] = useState<XScript>(applied);
  const [topic, setTopic] = useState('');
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const fileFor = useRef<number | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const dirty = JSON.stringify(draft) !== JSON.stringify(applied);
  const L = lang === 'ml' ? 'ml' : 'en';
  const get = (b: Bi | undefined) => (L === 'ml' ? b?.ml ?? '' : b?.en ?? '');
  const put = (b: Bi | undefined, v: string): Bi => (L === 'ml' ? { en: b?.en ?? v, ml: v } : { ...(b ?? {}), en: v });
  const setShot = (i: number, f: (s: XShot) => XShot) => setDraft((d) => ({ ...d, shots: d.shots.map((s, k) => (k === i ? f(s) : s)) }));
  const adopt = (s: XScript) => { setDraft(s); onApply(s); };

  const write = async () => {
    setBusy(true); setNote('');
    try {
      const r = await makeScript(topic, styledLlm(llm, styleRecipe ?? null), { standard, title });
      adopt(r.script);
      setNote(r.by === 'ai' ? `✓ ${r.script.shots.length} shots written by AI. Change anything below.` : r.note ?? 'Split into sentences (no AI key). Change anything below.');
    } catch (e) { setNote(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
  };

  return (
    <div className="space-y-4" data-explainer-editor>
      <div className="flex flex-wrap gap-2">{SAMPLE_EXPLAINERS.map((s) => <button key={s.id} className={btn} onClick={() => { adopt(s.script); setNote(`Sample: ${s.label}.`); }}>{s.label}</button>)}</div>
      <div className="space-y-2 rounded-xl border border-white/10 bg-white/[0.03] p-3">
        <textarea value={topic} onChange={(e) => setTopic(e.target.value)} rows={4} className={box} placeholder="A topic (“Why is the sky blue?”) or a lesson passage, in English or Malayalam…" aria-label="Topic or passage" />
        <div className="flex flex-wrap items-center gap-2">
          <input value={title} onChange={(e) => setTitle(e.target.value)} className={`${small} min-w-[12rem] flex-1 py-1.5`} placeholder="Title (optional)" aria-label="Title" />
          <button onClick={write} disabled={busy || !topic.trim()} className="rounded-lg bg-violet-500 px-3 py-1.5 text-sm font-bold text-white disabled:opacity-40">{busy ? 'Writing…' : '✨ Write the script'}</button>
        </div>
        <p className="text-[11px] text-white/45">One short sentence per screen, a hook first and a memorable last line, in English and Malayalam, with your AI key. In a sentence, *stars* make words bold italic and [brackets] put them in a highlight box.</p>
      </div>
      {note && <p role="status" className="text-xs text-cyan-200">{note}</p>}
      <input value={get(draft.title)} onChange={(e) => setDraft((d) => ({ ...d, title: put(d.title, e.target.value) }))} className={box} aria-label="Reel title" placeholder="Reel title" />
      <input ref={file} type="file" accept="image/*" className="hidden" aria-label="Photo for a shot" onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ''; const i = fileFor.current; if (f && i !== null) { const src = await smallPhoto(f); setShot(i, (s) => ({ ...s, visual: 'photo', photo: src })); } }} />
      <div className="space-y-3">
        {draft.shots.map((s, i) => (
          <div key={i} className="space-y-2 rounded-xl border border-white/10 bg-white/[0.03] p-3" data-xshot={i + 1}>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="rounded-md bg-violet-500/30 px-2 py-0.5 text-xs font-bold">Shot {i + 1}</span>
              <select value={s.visual} onChange={(e) => setShot(i, (x) => ({ ...x, visual: e.target.value as Visual }))} className={small} aria-label="Picture">{VISUALS.map((v) => <option key={v} value={v}>{VISUAL_NAME[v]}</option>)}</select>
              {s.visual === 'planet' && <select value={s.planet ?? 'earth'} onChange={(e) => setShot(i, (x) => ({ ...x, planet: e.target.value as Planet }))} className={small} aria-label="Planet">{PLANETS.map((p) => <option key={p} value={p}>{PLANET_NAME[p]}</option>)}</select>}
              {s.visual === 'photo' && <button className={btn} onClick={() => { fileFor.current = i; file.current?.click(); }}>{s.photo ? '📷 Change photo' : '📷 Choose photo'}</button>}
              <span className="ml-auto flex gap-1">
                <button className={btn} disabled={i === 0} onClick={() => setDraft((d) => { const sh = [...d.shots]; [sh[i - 1], sh[i]] = [sh[i], sh[i - 1]]; return { ...d, shots: sh }; })} aria-label="Move up">↑</button>
                <button className={btn} disabled={i === draft.shots.length - 1} onClick={() => setDraft((d) => { const sh = [...d.shots]; [sh[i + 1], sh[i]] = [sh[i], sh[i + 1]]; return { ...d, shots: sh }; })} aria-label="Move down">↓</button>
                <button className={btn} disabled={draft.shots.length >= MAX_SHOTS} onClick={() => setDraft((d) => ({ ...d, shots: [...d.shots.slice(0, i + 1), { text: { en: '' }, visual: 'night-sky' as Visual }, ...d.shots.slice(i + 1)] }))} title="Add a shot after this">＋</button>
                <button className={btn} disabled={draft.shots.length <= 1} onClick={() => setDraft((d) => ({ ...d, shots: d.shots.filter((_, k) => k !== i) }))} aria-label="Delete shot">🗑</button>
              </span>
            </div>
            <textarea value={get(s.text)} onChange={(e) => setShot(i, (x) => ({ ...x, text: put(x.text, e.target.value) }))} rows={2} className={box} aria-label={`Sentence of shot ${i + 1}`} placeholder="One short sentence. *bold italic*, [highlight]" />
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <input value={get(s.label)} onChange={(e) => setShot(i, (x) => ({ ...x, label: e.target.value ? put(x.label, L === 'en' ? e.target.value.toUpperCase() : e.target.value) : undefined }))} className={`${small} min-w-[9rem] flex-1`} placeholder="SMALL LABEL (optional)" aria-label="Label" />
              <input type="number" value={s.number?.value ?? ''} onChange={(e) => setShot(i, (x) => ({ ...x, number: e.target.value === '' ? undefined : { ...(x.number ?? {}), value: Number(e.target.value) } }))} className={`${small} w-24`} placeholder="Number" aria-label="Number that counts up" />
              {s.number && <input value={get(s.number.suffix)} onChange={(e) => setShot(i, (x) => ({ ...x, number: x.number ? { ...x.number, suffix: put(x.number.suffix, e.target.value) } : undefined }))} className={`${small} w-28`} placeholder=" crore km" aria-label="After the number" />}
              {s.visual === 'title' && <input value={get(s.big)} onChange={(e) => setShot(i, (x) => ({ ...x, big: put(x.big, e.target.value) }))} className={`${small} w-32`} placeholder="Big word" aria-label="Big word" />}
            </div>
          </div>
        ))}
      </div>
      <div className="sticky bottom-0 z-10 -mx-1 flex items-center gap-2 border-t border-white/10 bg-[#04101c]/95 px-1 py-2 backdrop-blur">
        <button onClick={() => { onApply(draft); setNote('Changes are in the reel.'); }} disabled={!dirty} className="rounded-xl bg-cyan-400 px-4 py-2 text-sm font-extrabold text-[#04121f] disabled:opacity-40">{dirty ? '▶ Use these changes in the reel' : '✓ The reel shows this script'}</button>
        {dirty && <button className={btn} onClick={() => setDraft(applied)}>Undo changes</button>}
      </div>
    </div>
  );
}
