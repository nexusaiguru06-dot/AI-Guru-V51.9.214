/**
 * Share clip: any reel trimmed to a short length with an AI Guru end card (what the app is, the student's own link).
 * New code only: the reel engine and its recipes are used as they are.
 */
import { withVoice, type MotionScene } from '../reels/motion/engine';
import { buildIntro } from '../reels/motion/recipes/intro';
import { makeReel, type MotionReel } from '../reels/motion/reel';
import type { Lang } from '../reels/motion/captions';
import { qrScene } from './qr-scene';
import { codeFromLink, codeLine } from './join-code';

export interface ClipOptions {
  link: string;
  lang: Lang;
  /** Longest part of the lesson to keep, in ms (default 40 s). */
  maxMs?: number;
  /** Add a closing QR code of the link (default true). */
  qr?: boolean;
  /** V51.9.101: voice clip lengths, so the end card and the QR card are spoken too (they were silent before). */
  voiceMs?: (spoken: string) => number | undefined;
  /** V51.9.102: which closing card (any number; the reel's seed) and the student's name for "Made by …". */
  variant?: number;
  name?: string;
}

type Point = { board: string; say: string };
/**
 * V51.9.102: closing cards in rotation, so not every reel ends the same way. Each keeps the student's link (and the
 * QR card after it); the reel's look changes its colours and shapes. Variant 3 names the student who made it.
 */
function endCardText(variant: number, ml: boolean, link: string, name: string): { heading: string; points: Point[] } {
  const join: Point = ml ? { board: `ചേരൂ: *${link}*`, say: 'ഈ ലിങ്കിൽ ചേരൂ, ഫീസിൽ ഡിസ്കൗണ്ട് നേടൂ.' } : { board: `Join: *${link}*`, say: 'Join with this link and get a discount on fees.' };
  const first = name.split(' ')[0];
  const v = ((variant % END_CARD_VARIANTS) + END_CARD_VARIANTS) % END_CARD_VARIANTS;
  if (v === 1) return ml
    ? { heading: 'ഈ ട്രിക്ക് ഇഷ്ടപ്പെട്ടോ?', points: [{ board: '*AI Guru*-വിൽ ദിവസവും പുതിയ ട്രിക്കുകൾ', say: 'AI Guru-വിൽ ദിവസവും പുതിയ ട്രിക്കുകൾ.' }, { board: 'നിങ്ങളുടെ *പാഠപുസ്തകം* ഘട്ടം ഘട്ടമായി', say: 'നിങ്ങളുടെ പാഠപുസ്തകം ഘട്ടം ഘട്ടമായി പഠിക്കാം.' }, join] }
    : { heading: 'Liked this trick?', points: [{ board: 'New tricks every day in *AI Guru*', say: 'New tricks every day in AI Guru.' }, { board: 'Your own *textbook*, step by step', say: 'Learn your own textbook, step by step.' }, join] };
  if (v === 2) return ml
    ? { heading: 'ഇനി നിങ്ങളുടെ ഊഴം!', points: [{ board: 'എല്ലാ അധ്യായത്തിനും *ആനിമേഷൻ* പാഠങ്ങൾ', say: 'എല്ലാ അധ്യായത്തിനും ആനിമേഷൻ പാഠങ്ങൾ.' }, { board: 'ക്വിസിൽ ശരിയാക്കിയാൽ *ടോഫി*', say: 'ക്വിസിൽ ശരി ഉത്തരത്തിന് ടോഫി കിട്ടും.' }, join] }
    : { heading: 'Your turn to learn!', points: [{ board: '*Animated* lessons for every chapter', say: 'Animated lessons for every chapter.' }, { board: 'Quizzes that give *toffees*', say: 'Quizzes that give you toffees.' }, join] };
  if (v === 3 && first) return ml
    ? { heading: `${first} AI Guru-വിൽ ഉണ്ടാക്കിയത്`, points: [{ board: 'ഈ റീൽ ഞാൻ *AI Guru*-വിൽ ഉണ്ടാക്കി', say: 'ഈ റീൽ ഞാൻ AI Guru-വിൽ ഉണ്ടാക്കി.' }, { board: 'നിങ്ങൾക്കും *ഉണ്ടാക്കാം*', say: 'നിങ്ങൾക്കും ഇതുപോലെ ഉണ്ടാക്കാം.' }, join] }
    : { heading: `Made by ${first} with AI Guru`, points: [{ board: 'I made this reel in *AI Guru*', say: 'I made this reel in AI Guru.' }, { board: 'You can *make one* too', say: 'You can make one too.' }, join] };
  if (v === 4) return ml
    ? { heading: 'സ്മാർട്ടായി പഠിക്കാം', points: [{ board: 'നിങ്ങളുടെ *കേരള സിലബസ്*, വിശദമായി', say: 'നിങ്ങളുടെ കേരള സിലബസ്, വിശദമായി.' }, { board: '*മലയാളത്തിലും* ഇംഗ്ലീഷിലും', say: 'മലയാളത്തിലും ഇംഗ്ലീഷിലും.' }, join] }
    : { heading: 'Study smarter', points: [{ board: 'Your *Kerala syllabus*, explained', say: 'Your Kerala syllabus, explained.' }, { board: 'In *Malayalam* and English', say: 'In Malayalam and English.' }, join] };
  // 0 (and 3 without a name): the original card
  return ml
    ? { heading: 'AI Guru-വിൽ പഠിക്കാം', points: [{ board: '*മലയാളത്തിലും* ഇംഗ്ലീഷിലും പാഠങ്ങൾ', say: 'മലയാളത്തിലും ഇംഗ്ലീഷിലും പാഠങ്ങൾ.' }, { board: 'ശരിയാക്കിയാൽ *ടോഫി*', say: 'ശരി ഉത്തരത്തിന് ടോഫി കിട്ടും.' }, join] }
    : { heading: 'Learn with AI Guru', points: [{ board: 'Lessons in *Malayalam* and English', say: 'Lessons in Malayalam and English.' }, { board: 'Right answer = a *toffee*', say: 'Every right answer earns a toffee.' }, join] };
}

export const END_CARD_VARIANTS = 5;

export function endCardScene(o: { link: string; lang: Lang; voiceMs?: (spoken: string) => number | undefined; variant?: number; name?: string }): MotionScene {
  const link = o.link.replace(/^https?:\/\//, '');
  const card = endCardText(o.variant ?? 0, o.lang === 'ml', link, o.name ?? '');
  const scene = withVoice({ lang: o.lang, clipMs: o.voiceMs ?? (() => undefined) }, () => buildIntro({ title: 'AI Guru', heading: card.heading, points: card.points }));
  scene.group = 'end-card';
  return scene;
}

/** Keep whole parts while they fit in `maxMs` (the first part is always kept), then add the end card. */
export function shareClip(reel: MotionReel, o: ClipOptions): MotionReel {
  const max = o.maxMs ?? 40_000;
  const kept: MotionScene[] = [];
  let total = 0;
  for (const p of reel.parts) {
    if (kept.length && total + p.durationMs > max) break;
    kept.push(p); total += p.durationMs;
  }
  const qr = o.qr === false ? [] : [withVoice({ lang: o.lang, clipMs: o.voiceMs ?? (() => undefined) }, () => qrScene(o))];
  return makeReel(reel.title, [...kept, endCardScene(o), ...qr]);
}

/** Caption to post with the clip. V51.9.91: also names the join code, since links in Instagram captions cannot be tapped. */
export function clipCaption(title: string, link: string, lang: Lang): string {
  const code = codeFromLink(link);
  const extra = code ? `\n${codeLine(code, link, lang)}` : '';
  return lang === 'ml'
    ? `${title} 🎬${link}${extra}\n#AIGuru #Malayalam #Maths #Kerala`
    : `${title} 🎬\nLearn in Malayalam and English, play quizzes and earn toffees 🍬\nJoin: ${link}${extra}\n#AIGuru #Malayalam #Maths #Kerala`;
}
