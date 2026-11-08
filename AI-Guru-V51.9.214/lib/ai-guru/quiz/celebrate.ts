/**
 * V51.9.117 — what a reward looks and sounds like when it is earned.
 *
 * A wrong answer: a chilli drops in, shakes, and flies to the chilli counter, with a comic "whoop-bonk" and the voice
 * "The answer is wrong. You got a chilli."
 * A right answer: confetti, a spinning toffee, a chime, "Congratulations! You got a toffee.", then it flies to the toffee
 * counter. Redoing a missed question turns a chilli into a toffee.
 *
 * `celebrationOf` is pure (tested). The sounds (Web Audio) and the voice (the browser's speech) are browser-only.
 */
import type { RewardGain } from './rewards';

export type CelebrationKind = 'toffee' | 'chilli' | 'redeem';
export interface Celebration {
  kind: CelebrationKind;
  count: number;
  title: string;
  /** What the voice says (English). */
  say: string;
  /** The same in Malayalam, used when the class is in Malayalam and the device has a Malayalam voice. */
  sayMl: string;
  lang: 'en' | 'ml';
  reported: boolean;
}

const plural = (n: number, one: string, many: string) => (n === 1 ? `a ${one}` : `${n} ${many}`);

/** The celebration for a gain: chillies first (a wrong answer), then toffees. null when nothing was earned. */
export function celebrationOf(g: Pick<RewardGain, 'toffees' | 'chillies' | 'redeemed' | 'meta'>): Celebration | null {
  const lang = g.meta.lang === 'ml' ? 'ml' : 'en';
  const reported = !!g.meta.reported;
  if (g.chillies > 0) {
    const n = g.chillies;
    return { kind: 'chilli', count: n, lang, reported, title: `You got ${plural(n, 'chilli', 'chillies')}`, say: `The answer is wrong. You got ${plural(n, 'chilli', 'chillies')}.`, sayMl: n === 1 ? 'ഉത്തരം തെറ്റാണ്. നിനക്ക് ഒരു മുളക് കിട്ടി.' : `ഉത്തരം തെറ്റാണ്. നിനക്ക് ${n} മുളക് കിട്ടി.` };
  }
  if (g.toffees > 0 && g.redeemed > 0) {
    return { kind: 'redeem', count: g.toffees, lang, reported, title: 'Your chilli became a toffee!', say: 'Well done! Your chilli turned into a toffee.', sayMl: 'മിടുക്കൻ! നിന്റെ മുളക് ടോഫി ആയി മാറി.' };
  }
  if (g.toffees > 0) {
    const n = g.toffees;
    return { kind: 'toffee', count: n, lang, reported, title: 'Congratulations!', say: `Congratulations! You got ${plural(n, 'toffee', 'toffees')}.`, sayMl: n === 1 ? 'അഭിനന്ദനങ്ങൾ! നിനക്ക് ഒരു ടോഫി കിട്ടി.' : `അഭിനന്ദനങ്ങൾ! നിനക്ക് ${n} ടോഫി കിട്ടി.` };
  }
  return null;
}

/* ---------------- browser: sound on/off, sounds, voice ---------------- */

const SOUND_KEY = 'ai-guru:reward-sound';
export function soundOn(): boolean { try { return localStorage.getItem(SOUND_KEY) !== 'off'; } catch { return true; } }
export function setSoundOn(on: boolean) { try { localStorage.setItem(SOUND_KEY, on ? 'on' : 'off'); } catch { /* storage blocked */ } }

let ctx: AudioContext | null = null;
function audio(): AudioContext | null {
  try {
    const AC = (window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext);
    if (!AC) return null;
    ctx ??= new AC();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch { return null; }
}

function tone(ac: AudioContext, o: { type: OscillatorType; from: number; to?: number; at: number; dur: number; vol: number }) {
  const osc = ac.createOscillator(), g = ac.createGain();
  osc.type = o.type;
  const t = ac.currentTime + o.at;
  osc.frequency.setValueAtTime(o.from, t);
  if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + o.dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(o.vol, t + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
  osc.connect(g).connect(ac.destination);
  osc.start(t); osc.stop(t + o.dur + 0.05);
}

/** The sound when the reward appears. */
export function playAppear(kind: CelebrationKind) {
  if (!soundOn()) return;
  const ac = audio(); if (!ac) return;
  if (kind === 'chilli') {
    // a comic falling whistle, then a soft bonk
    tone(ac, { type: 'triangle', from: 900, to: 160, at: 0, dur: 0.42, vol: 0.22 });
    tone(ac, { type: 'sine', from: 140, to: 70, at: 0.44, dur: 0.22, vol: 0.4 });
    tone(ac, { type: 'square', from: 70, to: 55, at: 0.44, dur: 0.12, vol: 0.06 });
  } else {
    // a bright rising chime: C E G C, with a sparkle on top
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(ac, { type: 'triangle', from: f, at: i * 0.09, dur: 0.32, vol: 0.2 }));
    [2093, 2637, 3136].forEach((f, i) => tone(ac, { type: 'sine', from: f, at: 0.38 + i * 0.06, dur: 0.18, vol: 0.06 }));
  }
}

/** The small "pop" when the reward lands in its counter. */
export function playLand(kind: CelebrationKind) {
  if (!soundOn()) return;
  const ac = audio(); if (!ac) return;
  if (kind === 'chilli') tone(ac, { type: 'sine', from: 330, to: 220, at: 0, dur: 0.12, vol: 0.18 });
  else tone(ac, { type: 'sine', from: 880, to: 1320, at: 0, dur: 0.12, vol: 0.18 });
}

/** Speaks the line; Malayalam only when this device has a Malayalam voice, otherwise English. */
export function sayIt(c: Celebration) {
  if (!soundOn()) return;
  try {
    const synth = window.speechSynthesis; if (!synth) return;
    const voices = synth.getVoices();
    const ml = c.lang === 'ml' ? voices.find((v) => /^ml/i.test(v.lang)) : undefined;
    const en = voices.find((v) => /en-IN/i.test(v.lang)) ?? voices.find((v) => /^en/i.test(v.lang));
    const u = new SpeechSynthesisUtterance(ml ? c.sayMl : c.say);
    const v = ml ?? en;
    if (v) { u.voice = v; u.lang = v.lang; } else u.lang = 'en-IN';
    u.rate = c.kind === 'chilli' ? 0.98 : 1.04;
    u.pitch = c.kind === 'chilli' ? 0.95 : 1.15;
    synth.speak(u);
  } catch { /* no speech on this device */ }
}
