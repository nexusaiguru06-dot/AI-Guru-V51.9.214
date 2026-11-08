'use client';

/**
 * V51.9.117 — the moment a reward is earned, on every AI Guru page.
 *
 * Wrong answer: a big chilli drops in from the top, bounces and shakes (a falling whistle and a bonk), the voice says
 * "The answer is wrong. You got a chilli.", then it flies in an arc into the chilli counter, which jumps.
 * Right answer: confetti bursts, a toffee spins in (a chime), "Congratulations! You got a toffee.", then it flies into
 * the toffee counter. Each reward waits for the one before it. The card says the answer went to the teacher and the
 * parent, with the parent code. 🔊 turns the sound and voice off or on (kept on this device).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { REWARD_GAINED_EVENT, type RewardGain } from '@/lib/ai-guru/quiz/rewards';
import { celebrationOf, playAppear, playLand, sayIt, setSoundOn, soundOn, type Celebration } from '@/lib/ai-guru/quiz/celebrate';
import { studentCode } from '@/lib/ai-guru/quiz/records';
import { Chilli } from './Chilli';
import { Toffee } from './Toffee';

const CONFETTI = ['#fbbf24', '#f472b6', '#34d399', '#60a5fa', '#a78bfa', '#f87171', '#fde68a', '#22d3ee'];
const HOLD_MS = 2100;
const FLY_MS = 850;

interface Shown extends Celebration { key: number; code: string }

/** The visible counter for this kind, or null. V51.9.180: one on screen first (the classroom's header counts may be scrolled away). */
function counterOf(kind: 'chilli' | 'toffee'): HTMLElement | null {
  const all = Array.from(document.querySelectorAll<HTMLElement>(`[data-reward="${kind}"]`));
  const shown = all.filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; });
  const onScreen = shown.find((el) => { const r = el.getBoundingClientRect(); return r.bottom > 0 && r.top < window.innerHeight; });
  return onScreen ?? shown[0] ?? null;
}

/** Points along a curved path from a to b (lifted in the middle), for the flight. */
function arc(a: { x: number; y: number }, b: { x: number; y: number }, n = 14) {
  const c = { x: (a.x + b.x) / 2, y: Math.min(a.y, b.y) - Math.max(120, Math.abs(b.x - a.x) * 0.25) };
  return Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n, u = 1 - t;
    return { x: u * u * a.x + 2 * u * t * c.x + t * t * b.x, y: u * u * a.y + 2 * u * t * c.y + t * t * b.y, t };
  });
}

export function RewardCelebration() {
  const [shown, setShown] = useState<Shown | null>(null);
  const [sound, setSound] = useState(() => soundOn());
  const queue = useRef<Shown[]>([]);
  const busy = useRef(false);
  const seq = useRef(0);
  const icon = useRef<HTMLDivElement>(null);
  const card = useRef<HTMLDivElement>(null);
  const burst = useRef<HTMLDivElement>(null);

  const next = useCallback(() => {
    const c = queue.current.shift();
    if (!c) { busy.current = false; setShown(null); return; }
    busy.current = true;
    setShown(c);
  }, []);

  useEffect(() => {
    const on = (e: Event) => {
      const g = (e as CustomEvent<RewardGain>).detail;
      const c = g && celebrationOf(g);
      if (!c) return;
      // many rewards at once (a quiz's end): keep the latest few
      queue.current = [...queue.current, { ...c, key: ++seq.current, code: studentCode(g.studentId) }].slice(-3);
      if (!busy.current) next();
    };
    window.addEventListener(REWARD_GAINED_EVENT, on);
    // voices load late in some browsers; asking once wakes them up
    try { window.speechSynthesis?.getVoices(); } catch { /* none */ }
    return () => window.removeEventListener(REWARD_GAINED_EVENT, on);
  }, [next]);

  // play one celebration: appear, hold, fly to the counter, land
  useEffect(() => {
    if (!shown) return;
    const el = icon.current, box = card.current;
    if (!el || !box) return;
    const still = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const kind = shown.kind === 'chilli' ? 'chilli' : 'toffee';
    const timers: number[] = [];
    const anims: Animation[] = [];
    const later = (ms: number, f: () => void) => timers.push(window.setTimeout(f, ms));

    playAppear(shown.kind);
    later(shown.kind === 'chilli' ? 650 : 450, () => sayIt(shown));

    if (!still) {
      box.animate([{ opacity: 0, transform: 'translateY(16px) scale(.96)' }, { opacity: 1, transform: 'none' }], { duration: 260, easing: 'ease-out', fill: 'both' });
      if (kind === 'chilli') {
        anims.push(el.animate([
          { transform: 'translateY(-70vh) rotate(-35deg) scale(1)', offset: 0 },
          { transform: 'translateY(0) rotate(8deg) scale(1.08, .92)', offset: 0.42 },
          { transform: 'translateY(-38px) rotate(-6deg) scale(1)', offset: 0.58 },
          { transform: 'translateY(0) rotate(0) scale(1.04, .96)', offset: 0.72 },
          { transform: 'translateX(-9px) rotate(-9deg)', offset: 0.78 },
          { transform: 'translateX(9px) rotate(9deg)', offset: 0.84 },
          { transform: 'translateX(-6px) rotate(-6deg)', offset: 0.9 },
          { transform: 'translateX(4px) rotate(4deg)', offset: 0.95 },
          { transform: 'none', offset: 1 },
        ], { duration: 1150, easing: 'ease-in', fill: 'both' }));
      } else {
        anims.push(el.animate([
          { transform: 'scale(0) rotate(-540deg)', offset: 0 },
          { transform: 'scale(1.35) rotate(20deg)', offset: 0.55 },
          { transform: 'scale(.92) rotate(-8deg)', offset: 0.75 },
          { transform: 'scale(1) rotate(0)', offset: 1 },
        ], { duration: 900, easing: 'cubic-bezier(.2,.8,.3,1.2)', fill: 'both' }));
      }
      // confetti for a toffee, hot sparks for a chilli
      const b = burst.current;
      if (b) {
        b.innerHTML = '';
        const n = kind === 'toffee' ? 44 : 12;
        for (let i = 0; i < n; i++) {
          const p = document.createElement('span');
          const big = kind === 'toffee';
          const ang = big ? Math.random() * Math.PI * 2 : -Math.PI / 2 + (Math.random() - 0.5) * 2.2;
          const dist = big ? 120 + Math.random() * 220 : 60 + Math.random() * 70;
          const dx = Math.cos(ang) * dist, dy = Math.sin(ang) * dist;
          p.style.cssText = `position:absolute;left:50%;top:50%;width:${big ? 8 + Math.random() * 6 : 6}px;height:${big ? 12 + Math.random() * 8 : 6}px;border-radius:${big && i % 3 ? '2px' : '999px'};background:${big ? CONFETTI[i % CONFETTI.length] : i % 2 ? '#fb923c' : '#ef4444'};`;
          b.appendChild(p);
          anims.push(p.animate([
            { transform: 'translate(-50%,-50%) rotate(0)', opacity: 1 },
            { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) rotate(${Math.random() * 540}deg)`, opacity: 1, offset: 0.55 },
            { transform: `translate(calc(-50% + ${dx * 1.1}px), calc(-50% + ${dy + (big ? 160 : 30)}px)) rotate(${Math.random() * 900}deg)`, opacity: 0 },
          ], { duration: big ? 1700 : 800, delay: big ? 120 + Math.random() * 160 : 700, easing: 'cubic-bezier(.15,.7,.4,1)', fill: 'both' }));
        }
      }
    }

    // fly into the counter
    later(HOLD_MS, () => {
      const target = counterOf(kind);
      const from = el.getBoundingClientRect();
      const a = { x: from.left + from.width / 2, y: from.top + from.height / 2 };
      const tr = target?.getBoundingClientRect();
      const b = tr ? { x: tr.left + tr.width / 2, y: tr.top + tr.height / 2 } : { x: kind === 'chilli' ? window.innerWidth - 40 : 40, y: window.innerHeight - 30 };
      box.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300, fill: 'forwards' });
      if (still) { finish(); return; }
      const scaleTo = 0.28;
      const pts = arc(a, b);
      const fly = el.animate(pts.map((p) => ({ transform: `translate(${p.x - a.x}px, ${p.y - a.y}px) scale(${1 - (1 - scaleTo) * p.t}) rotate(${p.t * (kind === 'chilli' ? 300 : 360)}deg)`, offset: p.t })), { duration: FLY_MS, easing: 'cubic-bezier(.45,0,.7,1)', fill: 'forwards' });
      anims.push(fly);
      fly.onfinish = () => {
        playLand(shown.kind);
        el.style.opacity = '0';
        target?.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.4)', boxShadow: `0 0 28px ${kind === 'chilli' ? '#f43f5e' : '#fbbf24'}` }, { transform: 'scale(1)' }], { duration: 420, easing: 'ease-out' });
        later(380, finish);
      };
    });

    // not one of this run's timers: the cleanup (when `shown` changes) must not cancel the start of the next one
    function finish() { window.setTimeout(next, 120); }
    return () => { timers.forEach(clearTimeout); anims.forEach((x) => { try { x.cancel(); } catch { /* gone */ } }); };
  }, [shown, next]);

  if (!shown) return null;
  const chilli = shown.kind === 'chilli';
  return (
    <div key={shown.key} className="pointer-events-none fixed inset-0 z-[10050] flex items-center justify-center" role="status" aria-live="assertive" data-celebration={shown.kind}>
      <div className={`absolute inset-0 ${chilli ? 'bg-rose-950/25' : 'bg-amber-900/20'}`} />
      <div className="relative flex flex-col items-center">
        <div ref={burst} className="absolute left-1/2 top-[70px] h-0 w-0" aria-hidden />
        <div ref={icon} className="relative z-10 flex h-[150px] items-center justify-center drop-shadow-[0_12px_24px_rgba(0,0,0,.45)]">
          {chilli ? <Chilli size={150} /> : <Toffee size={190} />}
          {!chilli && shown.count > 1 && <span className="absolute -right-4 -top-2 rounded-full bg-amber-300 px-2.5 py-0.5 text-xl font-black text-[#3a1800]">×{shown.count}</span>}
        </div>
        <div ref={card} className={`mt-4 max-w-[min(92vw,26rem)] rounded-3xl border px-6 py-4 text-center shadow-2xl ${chilli ? 'border-rose-400/50 bg-[#2a0b12]/95 text-rose-50' : 'border-amber-300/60 bg-[#2a1a05]/95 text-amber-50'}`}>
          {chilli && <p className="text-sm font-bold uppercase tracking-wider text-rose-300">The answer is wrong</p>}
          <p className="text-2xl font-black">{shown.title}</p>
          {!chilli && <p className="text-base font-bold text-amber-200">{shown.kind === 'redeem' ? 'Well done!' : `You got ${shown.count === 1 ? 'a toffee' : `${shown.count} toffees`}`}</p>}
          {chilli && <p className="mt-1 text-sm text-rose-200">Look at the explanation, then try the next one. Redo it later to turn this chilli into a toffee.</p>}
          {shown.reported && <p className="mt-2 text-[11px] text-white/60">Sent to your teacher and parent · parent code <b className="font-mono text-white/85">{shown.code}</b></p>}
          <button type="button" onClick={() => { const v = !sound; setSound(v); setSoundOn(v); if (!v) try { window.speechSynthesis?.cancel(); } catch { /* none */ } }}
            className="pointer-events-auto mt-2 rounded-full border border-white/20 px-3 py-0.5 text-[11px] text-white/70 hover:bg-white/10" aria-label={sound ? 'Turn reward sound off' : 'Turn reward sound on'}>{sound ? '🔊 Sound on' : '🔇 Sound off'}</button>
        </div>
      </div>
    </div>
  );
}
