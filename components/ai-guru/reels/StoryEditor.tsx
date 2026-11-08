'use client';

/**
 * V51.9.118 — Reel Studio "📖 Story": a lesson passage (or a ready sample) becomes a storyboard — the cast and the
 * shots — that the student can change before it becomes a reel.
 *
 * ✨ Make storyboard asks the student's AI (in English and Malayalam); without a key the passage is split by sentences.
 * Each shot: setting, who is in it, how they move, props, the narrator's line, and who speaks. ↻ Redo asks again for
 * that one shot only; ↶ Back returns to the shot before the redo. The edits reach the reel with "Use these changes"
 * (so the voice is not made again on every key press).
 */
import { useState } from 'react';
import { ACTION_NAME, ACTIONS, CAST_KINDS, KIND_NAME, PROP_NAME, PROPS, SETTING_NAME, SETTINGS, type Action, type CastKind, type Prop, type Setting, type Shot, type StoryBoard } from '@/lib/ai-guru/reels/motion/recipes/story';
import { makeStoryboard, MAX_CAST, MAX_IN_SHOT, MAX_SHOTS, redoShot, SAMPLE_STORIES, type Llm } from '@/lib/ai-guru/reels/story/storyboard';
import type { Lang } from '@/lib/ai-guru/reels/motion';

const llm: Llm = async (system, user) => {
  const { callAiGuruText } = await import('@/lib/ai-guru/byok-providers');
  return (await callAiGuruText(system, user, { json: true, maxOutputTokens: 8000, task: 'Story reel storyboard' })).text;
};

const box = 'w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm outline-none focus:border-violet-400';
const small = 'rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-xs outline-none focus:border-violet-400';
const btn = 'rounded-lg border border-white/15 px-2.5 py-1 text-xs hover:bg-white/10 disabled:opacity-40';

export function StoryEditor({ applied, onApply, lang, standard }: { applied: StoryBoard; onApply: (b: StoryBoard) => void; lang: Lang; standard?: string }) {
  const [draft, setDraft] = useState<StoryBoard>(applied);
  const [passage, setPassage] = useState('');
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState('');
  /** Earlier versions of each shot (for ↶ Back after a redo), by shot index. */
  const [history, setHistory] = useState<Record<number, Shot[]>>({});
  const dirty = JSON.stringify(draft) !== JSON.stringify(applied);
  const L = lang === 'ml' ? 'ml' : 'en';

  const adopt = (b: StoryBoard) => { setDraft(b); setHistory({}); onApply(b); };
  const setShot = (i: number, f: (s: Shot) => Shot) => setDraft((b) => ({ ...b, shots: b.shots.map((s, k) => (k === i ? f(s) : s)) }));
  const nameOf = (id: string) => { const c = draft.cast.find((x) => x.id === id); return c ? (L === 'ml' ? c.name.ml || c.name.en : c.name.en) || KIND_NAME[c.kind] : id; };

  const make = async () => {
    setBusy('Planning the story…'); setNote('');
    try {
      const r = await makeStoryboard(passage, llm, { standard, title });
      adopt(r.board);
      setNote(r.by === 'ai' ? `✓ ${r.board.shots.length} shots planned by AI. Change anything below.` : r.note ?? 'Split by sentences (no AI key). Change anything below.');
    } catch (e) { setNote(e instanceof Error ? e.message : String(e)); } finally { setBusy(null); }
  };
  const redo = async (i: number) => {
    setBusy(`Redoing shot ${i + 1}…`);
    try {
      const r = await redoShot(draft, i, llm);
      setHistory((h) => ({ ...h, [i]: [...(h[i] ?? []), draft.shots[i]] }));
      const next = { ...draft, shots: draft.shots.map((s, k) => (k === i ? r.shot : s)) };
      setDraft(next); onApply(next);
      setNote(r.by === 'ai' ? `Shot ${i + 1} redone by AI. ↶ Back gives the earlier one.` : `Shot ${i + 1} framed another way (no AI). ↶ Back gives the earlier one.`);
    } finally { setBusy(null); }
  };
  const back = (i: number) => {
    const prev = history[i]?.at(-1);
    if (!prev) return;
    setHistory((h) => ({ ...h, [i]: h[i].slice(0, -1) }));
    const next = { ...draft, shots: draft.shots.map((s, k) => (k === i ? prev : s)) };
    setDraft(next); onApply(next);
  };
  const moveShot = (i: number, d: -1 | 1) => setDraft((b) => { const s = [...b.shots]; const j = i + d; if (j < 0 || j >= s.length) return b; [s[i], s[j]] = [s[j], s[i]]; setHistory({}); return { ...b, shots: s }; });
  const removeShot = (i: number) => { setHistory({}); setDraft((b) => ({ ...b, shots: b.shots.filter((_, k) => k !== i) })); };
  const addShot = (i: number) => { setHistory({}); setDraft((b) => ({ ...b, shots: [...b.shots.slice(0, i + 1), { setting: b.shots[i]?.setting ?? 'village', who: b.shots[i]?.who ?? [], action: 'stand' as Action, props: [] as Prop[], narration: { en: '' }, line: null }, ...b.shots.slice(i + 1)].slice(0, MAX_SHOTS) })); };

  const text = (v: { en: string; ml?: string } | undefined, k: 'en' | 'ml') => (k === 'ml' ? v?.ml ?? '' : v?.en ?? '');
  const withText = (v: { en: string; ml?: string } | undefined, k: 'en' | 'ml', t: string) => (k === 'ml' ? { en: v?.en ?? '', ml: t } : { ...(v ?? {}), en: t });

  return (
    <div className="space-y-4" data-story-editor>
      <div className="flex flex-wrap gap-2">
        {SAMPLE_STORIES.map((s) => <button key={s.id} className={btn} onClick={() => { adopt(s.board); setNote(`Sample: ${s.label}.`); }}>{s.label}</button>)}
      </div>
      <div className="space-y-2 rounded-xl border border-white/10 bg-white/[0.03] p-3">
        <textarea value={passage} onChange={(e) => setPassage(e.target.value)} rows={5} className={box} placeholder="Paste a story, a history lesson or a Malayalam passage here (English or Malayalam)…" aria-label="Lesson passage" />
        <div className="flex flex-wrap items-center gap-2">
          <input value={title} onChange={(e) => setTitle(e.target.value)} className={`${small} min-w-[12rem] flex-1`} placeholder="Title (optional)" aria-label="Story title" />
          <button onClick={make} disabled={!!busy || !passage.trim()} className="rounded-lg bg-violet-500 px-3 py-1.5 text-sm font-bold text-white disabled:opacity-40">✨ Make storyboard</button>
        </div>
        <p className="text-[11px] text-white/45">Uses your AI key (Settings) and writes every line in English and Malayalam. With no key, the passage is split into shots by sentences.</p>
      </div>
      {(busy || note) && <p role="status" className="text-xs text-cyan-200">{busy ?? note}</p>}

      <div className="space-y-2">
        <div className="flex items-center gap-2"><h3 className="text-sm font-bold">Characters</h3><span className="text-[11px] text-white/45">Each one looks the same in every shot.</span></div>
        <input value={text(draft.title, L)} onChange={(e) => setDraft((b) => ({ ...b, title: withText(b.title, L, e.target.value) }))} className={box} aria-label="Reel title" placeholder="Reel title" />
        <div className="grid gap-2 sm:grid-cols-2">
          {draft.cast.map((c, i) => (
            <div key={c.id} className="flex items-center gap-1.5">
              <input value={text(c.name, L)} onChange={(e) => setDraft((b) => ({ ...b, cast: b.cast.map((x, k) => (k === i ? { ...x, name: withText(x.name, L, e.target.value) } : x)) }))} className={`${small} min-w-0 flex-1`} aria-label="Character name" />
              <select value={c.kind} onChange={(e) => setDraft((b) => ({ ...b, cast: b.cast.map((x, k) => (k === i ? { ...x, kind: e.target.value as CastKind } : x)) }))} className={small} aria-label="Character kind">{CAST_KINDS.map((k) => <option key={k} value={k}>{KIND_NAME[k]}</option>)}</select>
              <button className={btn} title="Remove" onClick={() => setDraft((b) => ({ ...b, cast: b.cast.filter((x) => x.id !== c.id), shots: b.shots.map((s) => ({ ...s, who: s.who.filter((w) => w !== c.id), line: s.line?.who === c.id ? null : s.line })) }))}>✕</button>
            </div>
          ))}
        </div>
        {draft.cast.length < MAX_CAST && <button className={btn} onClick={() => setDraft((b) => { let n = b.cast.length + 1; while (b.cast.some((c) => c.id === `c${n}`)) n++; return { ...b, cast: [...b.cast, { id: `c${n}`, name: { en: `Friend ${n}` }, kind: 'boy' }] }; })}>+ Character</button>}
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-bold">Shots</h3>
        {draft.shots.map((s, i) => (
          <div key={i} className="space-y-2 rounded-xl border border-white/10 bg-white/[0.03] p-3" data-shot={i + 1}>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="rounded-md bg-violet-500/30 px-2 py-0.5 text-xs font-bold">Shot {i + 1}</span>
              <select value={s.setting} onChange={(e) => setShot(i, (x) => ({ ...x, setting: e.target.value as Setting }))} className={small} aria-label="Setting">{SETTINGS.map((k) => <option key={k} value={k}>{SETTING_NAME[k]}</option>)}</select>
              <select value={s.action} onChange={(e) => setShot(i, (x) => ({ ...x, action: e.target.value as Action }))} className={small} aria-label="Movement">{ACTIONS.map((k) => <option key={k} value={k}>{ACTION_NAME[k]}</option>)}</select>
              <span className="ml-auto flex gap-1">
                <button className={btn} disabled={!!busy} onClick={() => redo(i)} title="Ask again for this shot only">↻ Redo</button>
                <button className={btn} disabled={!history[i]?.length} onClick={() => back(i)} title="The shot before the redo">↶ Back</button>
                <button className={btn} disabled={i === 0} onClick={() => moveShot(i, -1)} aria-label="Move up">↑</button>
                <button className={btn} disabled={i === draft.shots.length - 1} onClick={() => moveShot(i, 1)} aria-label="Move down">↓</button>
                <button className={btn} disabled={draft.shots.length >= MAX_SHOTS} onClick={() => addShot(i)} title="Add a shot after this">＋</button>
                <button className={btn} disabled={draft.shots.length <= 1} onClick={() => removeShot(i)} aria-label="Delete shot">🗑</button>
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="text-white/45">In the shot:</span>
              {draft.cast.map((c) => {
                const on = s.who.includes(c.id);
                return <button key={c.id} className={`${btn} ${on ? 'border-violet-400 bg-violet-500/25' : ''}`} disabled={!on && s.who.length >= MAX_IN_SHOT} onClick={() => setShot(i, (x) => ({ ...x, who: on ? x.who.filter((w) => w !== c.id) : [...x.who, c.id], line: on && x.line?.who === c.id ? null : x.line }))}>{nameOf(c.id)}</button>;
              })}
              <span className="ml-2 text-white/45">Props:</span>
              {PROPS.map((p) => {
                const on = (s.props ?? []).includes(p);
                return <button key={p} className={`${btn} ${on ? 'border-amber-300 bg-amber-400/20' : ''}`} disabled={!on && (s.props ?? []).length >= 3} onClick={() => setShot(i, (x) => ({ ...x, props: on ? (x.props ?? []).filter((q) => q !== p) : [...(x.props ?? []), p as Prop] }))}>{PROP_NAME[p]}</button>;
              })}
            </div>
            <textarea value={text(s.narration, L)} onChange={(e) => setShot(i, (x) => ({ ...x, narration: withText(x.narration, L, e.target.value) }))} rows={2} className={box} aria-label={`Narration of shot ${i + 1}`} placeholder={L === 'ml' ? 'കഥ പറയുന്ന വരി…' : 'What the narrator says…'} />
            <div className="flex flex-wrap items-center gap-1.5">
              <select value={s.line?.who ?? ''} onChange={(e) => setShot(i, (x) => ({ ...x, line: e.target.value ? { who: e.target.value, text: x.line?.text ?? { en: '' } } : null }))} className={small} aria-label="Who speaks">
                <option value="">No one speaks</option>
                {s.who.map((id) => <option key={id} value={id}>{nameOf(id)} says</option>)}
              </select>
              {s.line && <input value={text(s.line.text, L)} onChange={(e) => setShot(i, (x) => ({ ...x, line: x.line ? { ...x.line, text: withText(x.line.text, L, e.target.value) } : null }))} className={`${small} min-w-[12rem] flex-1`} aria-label="Speech bubble" placeholder="Speech bubble" />}
            </div>
          </div>
        ))}
      </div>
      <div className="sticky bottom-0 z-10 -mx-1 flex items-center gap-2 border-t border-white/10 bg-[#04101c]/95 px-1 py-2 backdrop-blur">
        <button onClick={() => { onApply(draft); setNote('Changes are in the reel.'); }} disabled={!dirty} className="rounded-xl bg-cyan-400 px-4 py-2 text-sm font-extrabold text-[#04121f] shadow-lg disabled:opacity-40">{dirty ? '▶ Use these changes in the reel' : '✓ The reel shows this storyboard'}</button>
        {dirty && <button className={btn} onClick={() => setDraft(applied)}>Undo changes</button>}
      </div>
    </div>
  );
}
