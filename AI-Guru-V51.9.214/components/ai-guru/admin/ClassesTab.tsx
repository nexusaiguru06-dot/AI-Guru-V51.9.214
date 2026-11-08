'use client';
import { useCallback, useEffect, useState } from 'react';
import { posterHtml } from '@/lib/ai-guru/share/poster';
import { inviteLink, SITE_URL } from '@/lib/ai-guru/site';
import type { RewardTier } from '@/lib/ai-guru/admin/groups';

type Say = (ok: boolean, t: string) => void;
interface G { teacherCode?: string; id: string; kind: 'class' | 'centre'; name: string; code: string; teacherName: string; teacherPhone?: string; school?: string; active: boolean; discountPct: number; pilotUntil?: string; pilotActive: boolean; testimonial?: string; joined: number; activeThisWeek: number; rewardsGiven: number[]; tiers: { tiers: Array<{ at: number; reward: string; status: 'given' | 'earned' | 'locked'; left: number }> }; top: Array<{ short: string; points: number }> }
const api = async (body?: unknown) => { const r = await fetch('/api/ai-guru/admin/classes', { method: body ? 'POST' : 'GET', headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined, cache: 'no-store' }); return { ok: r.ok, j: await r.json().catch(() => ({})) }; };
const inp = 'mt-1 w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400';
const btn = 'rounded-lg bg-cyan-400 px-4 py-2 text-sm font-extrabold text-[#04121f] disabled:opacity-50';
const ghost = 'rounded-lg border border-white/15 px-3 py-2 text-xs font-bold text-slate-200 hover:bg-white/5';

/** Admin: classes and tuition centres — codes, teacher keys, joined students, teacher reward tiers, centre pilots, posters. */
export function ClassesTab({ say }: { say: Say }) {
  const [groups, setGroups] = useState<G[]>([]);
  const [set, setSet] = useState<{ discountPct: number; tiers: RewardTier[] } | null>(null);
  const [f, setF] = useState({ kind: 'class', name: '', teacherName: '', teacherPhone: '', school: '', pilotUntil: '' });
  const [key, setKey] = useState<{ name: string; code: string; key: string } | null>(null);
  const load = useCallback(async () => { const r = await api(); if (r.ok) { setGroups(r.j.groups); setSet(r.j.settings); } }, []);
  useEffect(() => { void load(); }, [load]);
  const create = async () => { const r = await api({ action: 'create', ...f }); if (!r.ok) return say(false, r.j.error || 'Could not create'); setKey({ name: r.j.group.name, code: r.j.group.code, key: r.j.teacherKey }); setF({ ...f, name: '', teacherName: '', teacherPhone: '', school: '', pilotUntil: '' }); say(true, 'Created. Give the teacher the code and key.'); void load(); };
  const act = async (body: object, ok: string) => { const r = await api(body); say(r.ok, r.ok ? ok : r.j.error || 'Failed'); if (r.ok) { if (r.j.teacherKey) { const g = groups.find((x) => x.id === (body as { id: string }).id); setKey({ name: g?.name ?? '', code: g?.code ?? '', key: r.j.teacherKey }); } void load(); } };
  const poster = (g: G) => { const w = window.open('', '_blank'); if (!w) return; w.document.write(posterHtml(g, inviteLink(window.location.origin || SITE_URL, g.code))); w.document.close(); setTimeout(() => w.print(), 400); };
  const saveSet = async () => { if (!set) return; const r = await api({ action: 'settings', ...set }); say(r.ok, r.ok ? 'Saved. Every class code now gives this discount.' : r.j.error || 'Failed'); void load(); };
  const total = groups.reduce((t, g) => t + g.joined, 0);
  return (
    <div className="space-y-6">
      {key && <div role="status" className="rounded-2xl border border-amber-300/40 bg-amber-300/10 p-4 text-sm"><b>Teacher key for {key.name}:</b> <span className="font-mono text-xl font-extrabold text-amber-200">{key.key}</span> with class code <span className="font-mono font-bold">{key.code}</span>. It is shown only now — copy it and send it to the teacher. <button className={`${ghost} ml-2`} onClick={() => setKey(null)}>Done</button></div>}
      <section className="rounded-2xl border border-white/10 bg-white/[.04] p-4">
        <h2 className="font-extrabold">New class or tuition centre</h2>
        <div className="mt-2 grid gap-3 sm:grid-cols-3">
          <label className="text-xs font-bold text-slate-300">Type<select className={inp} value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}><option value="class">School class</option><option value="centre">Tuition centre (pilot)</option></select></label>
          <label className="text-xs font-bold text-slate-300">Name<input className={inp} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Class 6B, GHSS Aluva" /></label>
          <label className="text-xs font-bold text-slate-300">Teacher<input className={inp} value={f.teacherName} onChange={(e) => setF({ ...f, teacherName: e.target.value })} /></label>
          <label className="text-xs font-bold text-slate-300">Teacher phone<input className={inp} value={f.teacherPhone} onChange={(e) => setF({ ...f, teacherPhone: e.target.value })} /></label>
          <label className="text-xs font-bold text-slate-300">School<input className={inp} value={f.school} onChange={(e) => setF({ ...f, school: e.target.value })} /></label>
          {f.kind === 'centre' && <label className="text-xs font-bold text-slate-300">Free pilot until<input type="date" className={inp} value={f.pilotUntil} onChange={(e) => setF({ ...f, pilotUntil: e.target.value })} /></label>}
        </div>
        <button className={`${btn} mt-3`} disabled={!f.name || !f.teacherName} onClick={create}>Create and get code</button>
      </section>
      <section>
        <h2 className="mb-2 font-extrabold">Classes and centres ({groups.length}) · {total} students joined</h2>
        <div className="space-y-3">
          {groups.map((g) => (
            <article key={g.id} className={`rounded-2xl border p-4 ${g.active ? 'border-white/10 bg-white/[.04]' : 'border-white/5 bg-white/[.02] opacity-60'}`}>
              <div className="flex flex-wrap items-center gap-2"><h3 className="font-extrabold">{g.name}</h3><span className="rounded-full bg-white/10 px-2 py-0.5 text-xs">{g.kind === 'centre' ? 'Tuition centre' : 'Class'}</span><span className="font-mono text-sm font-bold text-cyan-300">{g.code}</span>{g.pilotActive && <span className="rounded-full bg-emerald-400/20 px-2 py-0.5 text-xs text-emerald-200">Pilot until {g.pilotUntil}</span>}{!g.active && <span className="text-xs text-rose-300">Switched off</span>}</div>
              <p className="text-sm text-slate-400">{g.teacherCode && <b className="mr-1 font-mono text-violet-300">{g.teacherCode}</b>}{g.teacherName}{g.teacherPhone ? ` · ${g.teacherPhone}` : ''}{g.school ? ` · ${g.school}` : ''} — <b className="text-slate-100">{g.joined}</b> joined, {g.activeThisWeek} active this week{g.top[0] ? ` · top: ${g.top[0].short} (${g.top[0].points}⭐)` : ''}</p>
              <ul className="mt-2 flex flex-wrap gap-2">{g.tiers.tiers.map((t) => <li key={t.at} className={`rounded-lg px-3 py-1 text-xs ${t.status === 'given' ? 'bg-emerald-400/20 text-emerald-200' : t.status === 'earned' ? 'bg-amber-300/20 text-amber-200' : 'bg-white/5 text-slate-400'}`}>{t.at}: {t.reward} — {t.status === 'given' ? 'given' : t.status === 'earned' ? 'EARNED' : `${t.left} to go`}{t.status === 'earned' && <button className="ml-2 rounded bg-amber-300 px-2 py-0.5 font-extrabold text-black" onClick={() => act({ action: 'reward', id: g.id, at: t.at }, 'Marked as given.')}>Mark given</button>}</li>)}</ul>
              {<div className="mt-2 flex gap-2"><input className={inp} defaultValue={g.testimonial ?? ''} placeholder="Teacher’s own words, with their permission (shown on the public page)" onBlur={(e) => { if (e.target.value !== (g.testimonial ?? '')) void act({ action: 'update', id: g.id, testimonial: e.target.value }, 'Testimonial saved.'); }} /></div>}
              <div className="mt-2 flex flex-wrap items-end gap-3 text-xs">{/* V51.9.92: this class's own discount */}
                <label className="font-bold text-slate-300">Discount with this code (%)<input type="number" min={0} max={100} step="0.5" className={`${inp} w-24`} defaultValue={g.discountPct} onBlur={(e) => { if (Number(e.target.value) !== g.discountPct) void act({ action: 'update', id: g.id, discountPct: Number(e.target.value) }, `Discount for ${g.name}: ${e.target.value}%.`); }} /></label>
              </div>
              <div className="mt-3 flex flex-wrap gap-2"><button className={ghost} onClick={() => poster(g)}>Poster with QR</button><button className={ghost} onClick={() => act({ action: 'newkey', id: g.id }, 'New key made.')}>New teacher key</button><button className={ghost} onClick={() => act({ action: 'toggle', id: g.id }, g.active ? 'Switched off.' : 'Switched on.')}>{g.active ? 'Switch off' : 'Switch on'}</button></div>
            </article>
          ))}
          {!groups.length && <p className="text-sm text-slate-400">No classes yet. Make one above, then give the teacher the code and key.</p>}
        </div>
      </section>
      {set && <section className="rounded-2xl border border-white/10 bg-white/[.04] p-4">
        <h2 className="font-extrabold">Discount and teacher rewards</h2>
        <label className="mt-2 block max-w-xs text-xs font-bold text-slate-300">Discount for students who join with a class code (%)<input className={inp} type="number" min={0} max={100} value={set.discountPct} onChange={(e) => setSet({ ...set, discountPct: Number(e.target.value) })} /></label>
        <div className="mt-3 space-y-2">{set.tiers.map((t, i) => <div key={i} className="flex gap-2"><input className={`${inp} w-24`} type="number" min={1} value={t.at} onChange={(e) => setSet({ ...set, tiers: set.tiers.map((x, k) => k === i ? { ...x, at: Number(e.target.value) } : x) })} /><input className={inp} value={t.reward} onChange={(e) => setSet({ ...set, tiers: set.tiers.map((x, k) => k === i ? { ...x, reward: e.target.value } : x) })} /><button className={ghost} onClick={() => setSet({ ...set, tiers: set.tiers.filter((_, k) => k !== i) })}>Remove</button></div>)}</div>
        <div className="mt-3 flex gap-2"><button className={ghost} onClick={() => setSet({ ...set, tiers: [...set.tiers, { at: 100, reward: '' }] })}>Add reward</button><button className={btn} onClick={saveSet}>Save</button></div>
      </section>}
    </div>
  );
}
