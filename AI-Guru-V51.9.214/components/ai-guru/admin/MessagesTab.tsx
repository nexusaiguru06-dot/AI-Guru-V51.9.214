'use client';

/**
 * V51.9.153 — the office's Messages tab. The inbox shows WHO wrote (name, ID, student/teacher), the colour of what it
 * is about (fees and money in red, technical in orange, app help in blue, study in violet, suggestions in green), its
 * status and unread mark — never the text. A click opens the conversation in full, to read and reply. The bot's
 * knowledge base is edited here too.
 */
import { useCallback, useEffect, useState } from 'react';
import { CATEGORIES, CATEGORY_INFO, type Category, type KbEntry, type Status, type Thread, type ThreadSummary } from '@/lib/ai-guru/messages/core';
import { Bubbles, Composer } from '@/components/ai-guru/messages/ChatView';

const api = async (body?: unknown, query = '') => {
  const r = await fetch(`/api/ai-guru/admin/messages${query}`, { method: body ? 'POST' : 'GET', headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined, cache: 'no-store' });
  const j = await r.json().catch(() => ({}));
  return { ok: !!j.ok, j };
};
const STATUS: Record<Status, { label: string; cls: string }> = {
  'needs-reply': { label: 'Needs reply', cls: 'bg-rose-500/20 text-rose-200' },
  bot: { label: 'Bot answered', cls: 'bg-white/10 text-white/60' },
  answered: { label: 'Answered', cls: 'bg-emerald-500/15 text-emerald-200' },
  closed: { label: 'Closed', cls: 'bg-white/5 text-white/40' },
};
const KIND: Record<string, string> = { 'student-admin': '🎒 Student', 'teacher-admin': '👩‍🏫 Teacher', 'teacher-student': '👩‍🏫↔🎒 Teacher–student' };
const when = (iso: string) => new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
type Summary = Omit<ThreadSummary, 'last'>;

export function MessagesTab({ say }: { say: (ok: boolean, text: string) => void }) {
  const [items, setItems] = useState<Summary[]>([]);
  const [total, setTotal] = useState(0);
  const [cnt, setCnt] = useState<Record<Category, { open: number; all: number }> | null>(null);
  const [cat, setCat] = useState<Category | 'all'>('all');
  const [status, setStatus] = useState<Status | 'all' | 'open'>('open');
  const [kind, setKind] = useState<string>('all');
  const [q, setQ] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [thread, setThread] = useState<Thread | null>(null);
  const [view, setView] = useState<'inbox' | 'new' | 'kb'>('inbox');

  const load = useCallback(async (more = false) => {
    const qs = new URLSearchParams({ category: cat, status, kind, q, offset: String(more ? items.length : 0) });
    const r = await api(undefined, `?${qs}`);
    if (!r.ok) return;
    setItems((xs) => (more ? [...xs, ...r.j.items] : r.j.items)); setTotal(r.j.total); setCnt(r.j.counts);
  }, [cat, status, kind, q, items.length]);
  useEffect(() => { void Promise.resolve().then(() => load()); const id = setInterval(() => void load(), 20000); return () => clearInterval(id); }, [cat, status, kind, q]); // eslint-disable-line react-hooks/exhaustive-deps

  const openThread = async (id: string) => {
    if (openId === id) { setOpenId(null); setThread(null); return; }
    setOpenId(id); setThread(null);
    const r = await api({ action: 'open', id });
    if (r.ok) { setThread(r.j.thread); setItems((xs) => xs.map((x) => (x.id === id ? { ...x, unread: { ...x.unread, admin: 0 } } : x))); }
  };
  const reply = async (text: string) => {
    if (!openId) return false;
    const r = await api({ action: 'reply', id: openId, text });
    if (!r.ok) { say(false, r.j.error ?? 'Could not send'); return false; }
    // the conversation stays open; its row shows the new status (the list catches up on the next refresh)
    setThread(r.j.thread); setItems((xs) => xs.map((x) => (x.id === openId ? { ...x, status: r.j.thread.status, lastAt: r.j.thread.lastAt, lastFrom: 'admin' } : x)));
    return true;
  };
  const setThreadStatus = async (s: Status) => {
    if (!openId) return;
    const r = await api({ action: 'status', id: openId, status: s });
    if (r.ok) { setThread(r.j.thread); void load(); }
  };
  const chip = (on: boolean) => `rounded-full px-3 py-1.5 text-xs font-bold ${on ? 'bg-cyan-400 text-[#04121f]' : 'border border-white/15 text-slate-200 hover:bg-white/5'}`;

  return (
    <section className="space-y-4" data-admin-messages>
      <div className="flex flex-wrap gap-2">
        <button className={chip(view === 'inbox')} onClick={() => setView('inbox')}>Inbox</button>
        <button className={chip(view === 'new')} onClick={() => setView('new')} data-admin-new>✉ New message</button>
        <button className={chip(view === 'kb')} onClick={() => setView('kb')} data-admin-kb>🤖 Bot knowledge</button>
      </div>

      {view === 'inbox' && (
        <>
          {/* the colour legend doubles as the category filter */}
          <div className="flex flex-wrap gap-2" data-legend>
            <button onClick={() => setCat('all')} className={`rounded-xl border px-3 py-2 text-xs font-bold ${cat === 'all' ? 'border-white/60 bg-white/10' : 'border-white/15'}`}>All</button>
            {CATEGORIES.map((c) => {
              const i = CATEGORY_INFO[c];
              return (
                <button key={c} onClick={() => setCat(c)} className={`rounded-xl border px-3 py-2 text-left text-xs ${cat === c ? i.bg : 'border-white/15 text-slate-200'}`} style={{ borderLeft: `6px solid ${i.color}` }} data-legend-cat={c}>
                  <span className="font-bold">{i.icon} {i.en}</span>
                  {cnt && <span className="ml-2 text-white/60">{cnt[c].open} waiting · {cnt[c].all}</span>}
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {(['open', 'bot', 'answered', 'closed', 'all'] as const).map((s) => <button key={s} className={chip(status === s)} onClick={() => setStatus(s)}>{s === 'open' ? 'Needs reply' : s === 'all' ? 'All' : STATUS[s].label}</button>)}
            <select value={kind} onChange={(e) => setKind(e.target.value)} className="rounded-lg border border-white/15 bg-black/30 px-2 py-1.5 text-xs">
              <option value="all">Students & teachers</option><option value="student-admin">Students</option><option value="teacher-admin">Teachers</option><option value="teacher-student">Teacher–student (read only)</option>
            </select>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or ID" className="ml-auto rounded-lg border border-white/15 bg-black/30 px-3 py-1.5 text-xs" data-admin-search />
          </div>
          <p className="text-xs text-slate-400">{total} conversation{total === 1 ? '' : 's'}. The list shows who wrote; click one to read it.</p>
          <div className="space-y-1.5" data-inbox>
            {items.map((t) => {
              const i = CATEGORY_INFO[t.category];
              const unread = t.unread.admin ?? 0;
              return (
                <div key={t.id} className="overflow-hidden rounded-xl border border-white/10" style={{ borderLeft: `6px solid ${i.color}` }}>
                  <button onClick={() => void openThread(t.id)} className={`flex w-full flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5 text-left text-sm ${openId === t.id ? 'bg-white/[0.06]' : 'hover:bg-white/[0.04]'}`} data-inbox-row={t.id}>
                    <span className="text-lg" title={i.en}>{i.icon}</span>
                    <span className="min-w-0 flex-1">
                      <span className={`font-bold ${unread ? 'text-white' : 'text-slate-300'}`}>{t.party.name}</span>
                      <span className="ml-2 font-mono text-xs text-slate-400">{t.party.code ?? t.party.id}</span>
                      {t.teacher && <span className="ml-2 text-xs text-slate-400">with {t.teacher.name}</span>}
                    </span>
                    <span className="text-xs text-slate-400">{KIND[t.kind]}</span>
                    <span className="rounded-md px-2 py-0.5 text-[11px] font-semibold" style={{ color: i.color, background: `${i.color}22` }}>{i.en}</span>
                    <span className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${STATUS[t.status].cls}`}>{STATUS[t.status].label}</span>
                    <span className="w-28 text-right text-[11px] text-slate-400">{when(t.lastAt)}</span>
                    {unread > 0 && <span className="rounded-full bg-rose-500 px-2 py-0.5 text-[11px] font-bold text-white" data-inbox-unread>{unread}</span>}
                  </button>
                  {openId === t.id && (
                    <div className="space-y-3 border-t border-white/10 bg-black/20 p-3" data-inbox-open>
                      {!thread && <p className="text-xs text-slate-400">Opening…</p>}
                      {thread && <div className="max-h-[50vh] overflow-y-auto pr-1"><Bubbles messages={thread.messages} me="admin" /></div>}
                      {thread && thread.kind !== 'teacher-student' && <Composer onSend={reply} placeholder={`Reply to ${t.party.name}…`} />}
                      {thread && thread.kind === 'teacher-student' && <p className="text-xs text-slate-400">A conversation between a teacher and a student: the office can read it, not write in it.</p>}
                      {thread && thread.kind !== 'teacher-student' && (
                        <div className="flex flex-wrap gap-2 text-xs">
                          <button className="rounded-lg border border-white/15 px-2.5 py-1" onClick={() => void setThreadStatus('closed')}>✓ Close</button>
                          <button className="rounded-lg border border-white/15 px-2.5 py-1" onClick={() => void setThreadStatus('needs-reply')}>Mark as needs reply</button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            {items.length < total && <button className="rounded-lg border border-white/15 px-3 py-2 text-xs" onClick={() => void load(true)}>Show more</button>}
            {!items.length && <p className="text-sm text-slate-400">Nothing here.</p>}
          </div>
        </>
      )}
      {view === 'new' && <NewMessage say={say} onSent={() => { setView('inbox'); setStatus('all'); void load(); }} />}
      {view === 'kb' && <KbEditor say={say} />}
    </section>
  );
}

function NewMessage({ say, onSent }: { say: (ok: boolean, text: string) => void; onSent: () => void }) {
  const [q, setQ] = useState('');
  const [people, setPeople] = useState<Array<{ role: 'student' | 'teacher'; id: string; name: string; code?: string; standard?: string }>>([]);
  const [to, setTo] = useState<(typeof people)[number] | null>(null);
  useEffect(() => { const t = setTimeout(() => void api({ action: 'people', q }).then((r) => r.ok && setPeople(r.j.people)), 250); return () => clearTimeout(t); }, [q]);
  const send = async (text: string) => {
    if (!to) { say(false, 'Choose who to write to'); return false; }
    const r = await api({ action: 'compose', to: { role: to.role, id: to.id }, text });
    if (!r.ok) { say(false, r.j.error ?? 'Could not send'); return false; }
    say(true, `Sent to ${to.name}`); onSent();
    return true;
  };
  return (
    <div className="space-y-3 rounded-xl border border-white/10 p-3" data-new-message>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a student or teacher: name, ID or phone" className="w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm" data-people-search />
      <div className="flex flex-wrap gap-1.5">
        {people.map((p) => (
          <button key={`${p.role}:${p.id}`} onClick={() => setTo(p)} className={`rounded-lg border px-2.5 py-1.5 text-xs ${to?.id === p.id && to.role === p.role ? 'border-cyan-400 bg-cyan-500/15' : 'border-white/15'}`} data-person={p.id}>
            {p.role === 'teacher' ? '👩‍🏫' : '🎒'} {p.name} <span className="font-mono text-white/45">{p.code ?? ''}</span>{p.standard ? <span className="text-white/45"> · Std {p.standard}</span> : null}
          </button>
        ))}
      </div>
      {to && <p className="text-xs text-slate-300">To: <b>{to.name}</b> ({to.role})</p>}
      <Composer onSend={send} placeholder="Write the message…" />
    </div>
  );
}

function KbEditor({ say }: { say: (ok: boolean, text: string) => void }) {
  const [kb, setKb] = useState<KbEntry[]>([]);
  const blank = { id: '', category: 'app-help' as Category, question: '', keywords: '', answer: '', answerMl: '', audience: 'all' };
  const [f, setF] = useState(blank);
  useEffect(() => { void api({ action: 'kb' }).then((r) => r.ok && setKb(r.j.kb)); }, []);
  const save = async () => {
    const r = await api({ action: 'kb-save', entry: f });
    if (!r.ok) { say(false, r.j.error ?? 'Could not save'); return; }
    setKb(r.j.kb); setF(blank); say(true, 'Saved. The bot uses it from the next message.');
  };
  const del = async (id: string) => { const r = await api({ action: 'kb-delete', id }); if (r.ok) setKb(r.j.kb); };
  const inp = 'mt-1 w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm';
  return (
    <div className="space-y-4" data-kb-editor>
      <p className="text-sm text-slate-300">The bot answers a message when its words match an entry here (at least one keyword). Anything it cannot answer goes to the inbox. Add your fees, payment methods, timings and common problems.</p>
      <div className="grid gap-2 rounded-xl border border-white/10 p-3 sm:grid-cols-2">
        <label className="text-xs">Question people ask<input className={inp} value={f.question} onChange={(e) => setF({ ...f, question: e.target.value })} data-kb-question /></label>
        <label className="text-xs">Keywords (comma separated)<input className={inp} value={f.keywords} onChange={(e) => setF({ ...f, keywords: e.target.value })} placeholder="fee, monthly, how much" data-kb-keywords /></label>
        <label className="text-xs">Category<select className={inp} value={f.category} onChange={(e) => setF({ ...f, category: e.target.value as Category })}>{CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_INFO[c].en}</option>)}</select></label>
        <label className="text-xs">For<select className={inp} value={f.audience} onChange={(e) => setF({ ...f, audience: e.target.value })}><option value="all">Students & teachers</option><option value="student">Students</option><option value="teacher">Teachers</option></select></label>
        <label className="text-xs sm:col-span-2">Answer (English)<textarea className={inp} rows={3} value={f.answer} onChange={(e) => setF({ ...f, answer: e.target.value })} data-kb-answer /></label>
        <label className="text-xs sm:col-span-2">Answer (Malayalam, optional — used when the message is in Malayalam)<textarea className={inp} rows={2} value={f.answerMl} onChange={(e) => setF({ ...f, answerMl: e.target.value })} /></label>
        <div className="flex gap-2 sm:col-span-2">
          <button onClick={() => void save()} className="rounded-lg bg-cyan-400 px-4 py-2 text-sm font-extrabold text-[#04121f]" data-kb-save>{f.id ? 'Save changes' : 'Add to the bot'}</button>
          {f.id && <button onClick={() => setF(blank)} className="rounded-lg border border-white/15 px-3 py-2 text-xs">Cancel</button>}
        </div>
      </div>
      <div className="space-y-1.5">
        {kb.map((e) => (
          <div key={e.id} className="rounded-xl border border-white/10 p-2.5 text-sm" style={{ borderLeft: `6px solid ${CATEGORY_INFO[e.category].color}` }} data-kb-entry>
            <div className="flex flex-wrap items-center gap-2">
              <b>{e.question}</b>
              <span className="text-xs text-slate-400">{e.keywords.join(', ')}</span>
              <span className="ml-auto flex gap-1.5 text-xs">
                <button className="rounded-md border border-white/15 px-2 py-0.5" onClick={() => setF({ id: e.id, category: e.category, question: e.question, keywords: e.keywords.join(', '), answer: e.answer, answerMl: e.answerMl ?? '', audience: e.audience ?? 'all' })}>Edit</button>
                <button className="rounded-md border border-rose-400/40 px-2 py-0.5 text-rose-200" onClick={() => void del(e.id)}>Delete</button>
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-300">{e.answer}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
