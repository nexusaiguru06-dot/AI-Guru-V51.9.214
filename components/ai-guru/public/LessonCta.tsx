'use client';
/** Sign-up button and share button on a public lesson. A friend's link (?ref=CODE) is remembered so sign-up can fill the coupon. */
import { useEffect, useState } from 'react';
import { fetchIfSignedIn } from '@/lib/ai-guru/net/session-hint';

export function LessonCta({ slug, title }: { slug: string; title: string }) {
  const [ref, setRef] = useState('');
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    let r = '';
    try { r = new URLSearchParams(window.location.search).get('ref')?.trim().toUpperCase() ?? ''; if (r) localStorage.setItem('aig_ref', r); } catch { /* storage blocked */ }
    if (r) { setRef(r); return; }
    fetchIfSignedIn(['student'], '/api/ai-guru/student-portal/me', { cache: 'no-store' }).then((x) => (x.ok ? x.json() : null)).then((j) => { if (j?.affiliate?.enabled && j.affiliate.code) setRef(j.affiliate.code); }).catch(() => undefined);
  }, []);
  const mine = typeof window !== 'undefined' ? `${window.location.origin}/ai-guru/learn/${slug}${ref ? `?ref=${ref}` : ''}` : '';
  const text = `${title}: free lesson in Malayalam and English on AI Guru. ${mine}`;
  const share = async () => { try { if (navigator.share) await navigator.share({ title, text, url: mine }); else { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); } } catch { /* cancelled */ } };
  return (
    <div className="flex flex-wrap gap-3">
      <a href={`/ai-guru/student/signup${ref ? `?ref=${ref}` : ''}`} className="rounded-xl bg-cyan-400 px-5 py-3 font-extrabold text-[#04121f]">Create a free account</a>
      <button onClick={share} className="rounded-xl border border-white/20 px-5 py-3 font-bold">{copied ? 'Link copied ✓' : 'Share this lesson'}</button>
      <a href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noreferrer" className="rounded-xl bg-emerald-500 px-5 py-3 font-extrabold text-white">WhatsApp</a>
    </div>
  );
}
