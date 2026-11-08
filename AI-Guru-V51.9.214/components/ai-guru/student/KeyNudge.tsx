'use client';
/**
 * V51.9.188 — "🔑 Add your free Gemini key": a small card for a signed-in student whose browser has no AI key of their
 * own. Tapping it opens Settings → Your AI keys (how to get the free key, and where to paste it). It says what the free
 * trial still gives (doubts on the school key, within the office's limits), and "Later" hides it until tomorrow.
 * A student with their own key never sees it (and the server is told only that they have one, so reminders stop).
 */
import { useEffect, useState } from 'react';
import { fetchIfSignedIn } from '@/lib/ai-guru/net/session-hint';
import { studentKey } from '@/lib/student-key';

interface Status { open: boolean; days: number; left: number; until: string; perDay: number; used: number; minutes: number; enrolled: boolean; trial: boolean; tier: string }
const HIDE = 'ai-guru:key-nudge-hidden';
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

export function KeyNudge({ place = 'classroom' }: { place?: string }) {
  const [s, setS] = useState<Status | null>(null);
  useEffect(() => {
    let off = false;
    const own = studentKey.hasKey();
    try { if (!own && window.localStorage.getItem(HIDE) === today()) return; } catch { /* no storage */ }
    void fetchIfSignedIn(['student'], `/api/ai-guru/student-portal/doubt-key${own ? '?own=1' : ''}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (!off && j?.ok && !own) setS(j); })
      .catch(() => undefined);
    return () => { off = true; };
  }, []);
  if (!s) return null;
  const later = () => { try { window.localStorage.setItem(HIDE, today()); } catch { /* ignore */ } setS(null); };
  const trial = s.open ? `${s.trial ? 'Free trial' : 'Free doubts'}: ask by camera, voice or typing on AI Guru’s key — ${Math.max(0, s.perDay - s.used)} of ${s.perDay} left today, up to ${s.minutes} min each${s.trial ? `, trial until ${s.until}` : ''}.`
    : s.tier && s.tier !== 'none' ? `Today’s ${s.perDay} free doubt session${s.perDay === 1 ? '' : 's'} are used. Your own key has no limit.`
    : s.enrolled ? 'You are enrolled — doubts use your own key.' : s.days ? 'Your free trial of doubt clearing has ended.' : 'Doubts by camera, voice or typing need your own key.';
  return (
    <div role="status" className="fixed right-3 top-20 z-40 w-[min(22rem,calc(100vw-1.5rem))] rounded-2xl border border-cyan-300/40 bg-[#071a2c]/95 p-3 text-sm text-white shadow-2xl backdrop-blur" data-key-nudge={place}>
      <a href="/ai-guru/settings/gemini" className="block" data-key-nudge-open>
        <b className="block">🔑 Add your free Gemini key</b>
        <span className="mt-1 block text-xs text-slate-300">{trial}</span>
        <span className="mt-1 block text-xs text-cyan-200">It takes 2 minutes and is free. Tap here to open Settings.</span>
      </a>
      <button type="button" onClick={later} className="mt-2 text-xs text-slate-400 underline">Later</button>
    </div>
  );
}
