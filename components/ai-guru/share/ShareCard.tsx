'use client';
/** After a quiz: the score card picture with Share, WhatsApp and Download. The picture carries the student's own referral link when they have an account. */
import { useEffect, useMemo, useState } from 'react';
import { currentStudentId } from '@/lib/ai-guru/motion-class/interactive/progress';
import { studentCode, type SessionRecord } from '@/lib/ai-guru/quiz/records';
import { istDay, streakOf } from '@/lib/ai-guru/share/badges';
import { scoreCardSvg, scoreShareText, svgToPng, type CardData, type Lang } from '@/lib/ai-guru/share/scorecard';
import { fetchIfSignedIn } from '@/lib/ai-guru/net/session-hint';

export function ShareCard({ name, correct, total, pct, toffees, chillies, streak, lang, title }: Omit<CardData, 'link' | 'lang'> & { lang: 'english' | 'malayalam' }) {
  const [ref, setRef] = useState('');
  const [days, setDays] = useState(0);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const l: Lang = lang === 'malayalam' ? 'ml' : 'en';
  useEffect(() => { fetchIfSignedIn(['student'], '/api/ai-guru/student-portal/me', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).then((j) => { if (j?.affiliate?.code && j.affiliate.enabled) setRef(j.affiliate.code); }).catch(() => undefined); }, []);
  useEffect(() => {
    if (streak !== undefined) return;
    fetch(`/api/ai-guru/progress?role=parent&code=${encodeURIComponent(studentCode(currentStudentId()))}`, { cache: 'no-store' }).then((r) => r.json()).then((j) => {
      const now = new Date().toISOString();
      setDays(streakOf([...((j?.recent ?? []) as SessionRecord[]), { at: now } as SessionRecord], istDay(now)).current);
    }).catch(() => undefined);
  }, [streak]);
  const link = `${typeof window !== 'undefined' ? window.location.origin : ''}${ref ? `/j/${ref}` : '/ai-guru/student/signup'}`; // V51.9.91: short link — shows a rich preview card and carries the code
  const data: CardData = { name, correct, total, pct, toffees, chillies, streak: streak ?? days, link, lang: l, title };
  const svg = useMemo(() => scoreCardSvg(data), [name, correct, total, pct, toffees, chillies, streak, days, link, l, title]); // eslint-disable-line react-hooks/exhaustive-deps
  const text = scoreShareText(data);
  const T = l === 'ml' ? { share: 'പങ്കിടൂ', wa: 'WhatsApp', dl: 'ചിത്രം സേവ് ചെയ്യൂ', head: 'നിങ്ങളുടെ സ്കോർ കാർഡ്', fail: 'ചിത്രം ഉണ്ടാക്കാൻ കഴിഞ്ഞില്ല' } : { share: 'Share', wa: 'WhatsApp', dl: 'Save picture', head: 'Your score card', fail: 'Could not make the picture' };
  const png = async () => svgToPng(svg);
  const download = async () => { setBusy(true); setMsg(''); try { const u = URL.createObjectURL(await png()); const a = document.createElement('a'); a.href = u; a.download = 'ai-guru-score.png'; a.click(); setTimeout(() => URL.revokeObjectURL(u), 4000); } catch { setMsg(T.fail); } finally { setBusy(false); } };
  const share = async () => {
    setBusy(true); setMsg('');
    try {
      const file = new File([await png()], 'ai-guru-score.png', { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], text, title: 'AI Guru' });
      else if (navigator.share) await navigator.share({ text, url: link, title: 'AI Guru' });
      else await download();
    } catch (e) { if ((e as Error)?.name !== 'AbortError') setMsg(T.fail); } finally { setBusy(false); }
  };
  const btn = 'rounded-xl px-4 py-2.5 text-sm font-extrabold disabled:opacity-60';
  return (
    <section aria-label={T.head} className="mx-auto w-full max-w-[300px] space-y-3 text-left">
      <h3 className="text-center text-xs font-bold uppercase tracking-widest text-slate-400">{T.head}</h3>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img alt={text} src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`} className="w-full rounded-2xl border border-white/10 shadow-lg" />
      <div className="flex flex-wrap justify-center gap-2">
        <button disabled={busy} onClick={share} className={`${btn} bg-cyan-400 text-[#04121f]`}>{T.share}</button>
        <a href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noreferrer" className={`${btn} bg-emerald-500 text-white`}>{T.wa}</a>
        <button disabled={busy} onClick={download} className={`${btn} border border-white/20 text-slate-100`}>{T.dl}</button>
      </div>
      {msg && <p role="alert" className="text-center text-xs text-rose-300">{msg}</p>}
    </section>
  );
}
