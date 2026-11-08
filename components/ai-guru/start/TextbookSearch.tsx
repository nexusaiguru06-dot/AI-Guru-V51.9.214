'use client';
/** V51.9.198 — "Your syllabus is not here? Search the web." */
import { useState } from 'react';
import { textbookSearchUrl } from '@/lib/ai-guru/start/textbooks';

export function TextbookSearch() {
  const [q, setQ] = useState({ syllabus: '', grade: '', subject: '' });
  const inp = 'mt-1 w-full rounded-xl border border-[color:var(--ag-line)] bg-[color:var(--ag-tile)] px-3 py-2.5 text-sm outline-none focus:border-[color:var(--ag-accent-ink)]';
  const ready = !!(q.syllabus.trim() || q.subject.trim());
  return (
    <form action={textbookSearchUrl(q)} onSubmit={(e) => { e.preventDefault(); if (ready) window.open(textbookSearchUrl(q), '_blank', 'noopener'); }} className="grid gap-3 sm:grid-cols-[1.4fr_.7fr_1fr_auto] sm:items-end" data-textbook-search>
      <label className="block text-xs font-bold">Syllabus or board<input className={inp} value={q.syllabus} onChange={(e) => setQ({ ...q, syllabus: e.target.value })} placeholder="e.g. Gujarat board, IGCSE" /></label>
      <label className="block text-xs font-bold">Class<input className={inp} value={q.grade} onChange={(e) => setQ({ ...q, grade: e.target.value })} placeholder="8" inputMode="numeric" /></label>
      <label className="block text-xs font-bold">Subject<input className={inp} value={q.subject} onChange={(e) => setQ({ ...q, subject: e.target.value })} placeholder="Science" /></label>
      <button disabled={!ready} className="min-h-[44px] rounded-xl bg-[#F5B83D] px-5 text-sm font-bold text-[#1A1203] disabled:opacity-50">Search the web ↗</button>
    </form>
  );
}
