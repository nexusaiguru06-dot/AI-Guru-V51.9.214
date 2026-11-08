'use client';
/**
 * V51.9.197 — "Download the AI Guru app?" for someone who opened a friend's invite link.
 * Yes → the app goes on the home screen with the AI Guru logo:
 *  • Android Chrome / Edge / Samsung Internet, and computers: the phone's own "Install" box, at once;
 *  • iPhone / iPad (Safari): two taps, shown with pictures (Apple does not let a page install by itself);
 *  • WhatsApp's or Instagram's own browser: "Open in Chrome" first (they cannot install apps), then Yes again.
 * The friend's code goes with the app, so the invite still counts when they sign up inside it.
 * "Not now" hides it on this device for 7 days. Nothing shows when it already runs as the app.
 */
import { useEffect, useState } from 'react';
import { chromeIntent, installWay, type InstallWay } from '@/lib/ai-guru/pwa/manifest';

interface PromptEvent extends Event { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }
declare global { interface Window { __aigInstall?: PromptEvent | null } }

const LATER = 'aig_app_later';
const later = () => { try { const t = Number(localStorage.getItem(LATER)); return t > 0 && Date.now() - t < 7 * 864e5; } catch { return false; } };
const installed = () => { try { return localStorage.getItem('aig_app') === 'installed'; } catch { return false; } };
const standalone = () => window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

export function InstallAppPrompt({ refCode }: { refCode: string }) {
  const [way, setWay] = useState<InstallWay | null>(null);
  const [step, setStep] = useState<'ask' | 'ios' | 'inapp' | 'desktop' | 'done' | 'hidden'>('ask');

  useEffect(() => {
    if (installed() || later()) { setStep('hidden'); return; }
    // the app opens with the friend's code
    const link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    if (link && refCode) link.href = `/app-manifest?ref=${encodeURIComponent(refCode)}`;
    const look = () => setWay(installWay(navigator.userAgent, standalone(), !!window.__aigInstall));
    look();
    window.addEventListener('aig-install-ready', look);
    const done = () => setStep('done');
    window.addEventListener('appinstalled', done);
    return () => { window.removeEventListener('aig-install-ready', look); window.removeEventListener('appinstalled', done); };
  }, [refCode]);

  if (!way || way === 'installed' || step === 'hidden') return null;

  const yes = async () => {
    const ev = window.__aigInstall;
    if (ev) {
      await ev.prompt();
      const { outcome } = await ev.userChoice;
      window.__aigInstall = null;
      if (outcome === 'accepted') setStep('done'); else setWay(installWay(navigator.userAgent, standalone(), false));
      return;
    }
    if (way === 'ios-safari') setStep('ios');
    else if (way === 'android-inapp' || way === 'ios-other') setStep('inapp');
    else setStep('desktop'); // Android Chrome that has not offered yet, or a computer: the browser menu
  };
  const notNow = () => { try { localStorage.setItem(LATER, String(Date.now())); } catch { /* ignore */ } setStep('hidden'); };

  const box = 'rounded-2xl border border-cyan-300/40 bg-gradient-to-br from-cyan-400/10 to-violet-400/10 px-4 py-3 text-sm text-slate-100';
  const btn = 'rounded-xl bg-cyan-400 px-4 py-2 text-sm font-extrabold text-[#04121f]';
  const ghost = 'rounded-xl border border-white/20 px-3 py-2 text-xs font-bold text-slate-200';
  const head = (
    <div className="flex items-center gap-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/app-icons/icon-192.png" alt="" width={48} height={48} className="h-12 w-12 rounded-xl" />
      <div><b className="text-base">Download the AI Guru app?</b><span className="block text-xs text-slate-300">Free · opens from your home screen</span></div>
    </div>
  );

  if (step === 'done') return <div className={box} role="status" data-app-installed>✅ <b>AI Guru is on your home screen</b> with its logo. Open it any time.</div>;

  if (step === 'ios') return (
    <div className={box} data-app-ios>{head}
      <ol className="mt-3 space-y-2">
        <li>1. Tap <b>Share</b> <span aria-hidden className="inline-block rounded border border-white/30 px-1">⬆︎</span> at the bottom of Safari.</li>
        <li>2. Choose <b>Add to Home Screen</b> <span aria-hidden className="inline-block rounded border border-white/30 px-1">＋</span>, then <b>Add</b>.</li>
      </ol>
      <p className="mt-2 text-xs text-slate-300">The AI Guru logo appears on your home screen. Sign up inside the app; your friend’s code goes with it.</p>
      <button type="button" className={`${ghost} mt-2`} onClick={() => setStep('hidden')}>Done</button>
    </div>
  );

  if (step === 'inapp') return (
    <div className={box} data-app-inapp>{head}
      <p className="mt-2">This page is open inside {/iPhone|iPad/i.test(navigator.userAgent) ? 'another app' : 'WhatsApp or another app'}, which cannot add apps. Open it in {/iPhone|iPad/i.test(navigator.userAgent) ? 'Safari' : 'Chrome'} first, then tap Yes again.</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {/Android/i.test(navigator.userAgent)
          ? <a className={btn} href={chromeIntent(window.location.href)} data-open-chrome>Open in Chrome</a>
          : <p className="text-xs text-slate-300">Tap <b>⋯</b> or the share button, then <b>Open in Safari</b>.</p>}
        <button type="button" className={ghost} onClick={() => setStep('hidden')}>Not now</button>
      </div>
    </div>
  );

  if (step === 'desktop') return (
    <div className={box} data-app-menu>{head}
      <p className="mt-2">Open the browser menu <b>⋮</b> and choose <b>Install app</b> or <b>Add to Home screen</b>.</p>
      <button type="button" className={`${ghost} mt-2`} onClick={() => setStep('hidden')}>Done</button>
    </div>
  );

  return (
    <div className={box} data-app-ask>{head}
      <div className="mt-3 flex gap-2">
        <button type="button" className={btn} onClick={() => void yes()} data-app-yes>Yes, download</button>
        <button type="button" className={ghost} onClick={notNow} data-app-later>Not now</button>
      </div>
    </div>
  );
}
