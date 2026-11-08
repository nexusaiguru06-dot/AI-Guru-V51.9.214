/**
 * V51.9.101 — the first two seconds and the last card of a shared reel, in rotation, so no two reels open or close the
 * same way. Built with the same motion grammar as every lesson (captions, voice, the Deepa mascot, pen verbs), so the
 * voice-over speaks them and every look draws them.
 *
 *  OPENERS   challenge  "Can you solve 478 + 356 in 10 seconds?"   (a 3-second timer runs)
 *            countdown  "Ready? 3, 2, 1… go!"
 *            mistake    "Most students get this wrong!"           (a wrong answer is struck out)
 *            fact       "Did you know?" + a true maths fact
 *            avatar     "Watch how I solved this!"                (only with a face in the corner)
 *  ENDINGS   comment    "Your turn! Comment your answer: 567 + 289 = ?"
 *            tag        "Tag a friend who needs this trick!"
 *            streak     "Anu has earned 120 toffees · Day 5!"     (only when the numbers are known)
 *            part2      "Part 2 tomorrow — follow so you don't miss it!"
 *            quiz       three quick-fire questions with answers
 */

import { MISTAKES } from '../../../features';
import { Motion, type MotionScene } from '../engine';
import type { Lang } from '../captions';
import { tokenWidth } from '../metrics';
import { drawMascot, hopMascot, setPose, speechBubble, type Pose } from '../mascot';

export type OpenerKind = 'challenge' | 'countdown' | 'mistake' | 'fact' | 'avatar';
export type EndingKind = 'comment' | 'tag' | 'streak' | 'part2' | 'quiz';
// V51.9.123: "Most get it wrong" is left out while MISTAKES is off
export const OPENERS: readonly OpenerKind[] = (['challenge', 'countdown', 'mistake', 'fact', 'avatar'] as OpenerKind[]).filter((k) => MISTAKES || k !== 'mistake');
export const ENDINGS: readonly EndingKind[] = ['comment', 'tag', 'streak', 'part2', 'quiz'];

export const OPENER_NAME: Record<OpenerKind, string> = { challenge: 'Challenge', countdown: 'Countdown', mistake: 'Most get it wrong', fact: 'Did you know?', avatar: 'Watch me solve it' };
export const ENDING_NAME: Record<EndingKind, string> = { comment: 'Comment your answer', tag: 'Tag a friend', streak: 'My toffees & streak', part2: 'Part 2 tomorrow', quiz: 'Quick-fire quiz' };

export interface HookContext {
  lang: Lang;
  /** The reel's title, e.g. "478 + 356 = ?" or "Pair of Linear Equations". */
  title: string;
  /** The sum on the board, when the reel is a sum ("478 + 356"). */
  sum?: string;
  /** A tempting wrong answer for that sum (the "mistake" opener). */
  wrong?: string;
  /** A new sum of the same kind (the "comment" ending) and three quick ones with answers (the "quiz" ending). */
  next?: string;
  quick?: Array<[string, string]>;
  /** The student (or teacher) on the reel, and their numbers. */
  name?: string;
  toffees?: number;
  streak?: number;
  /** The mascot's pose, chosen by the student (V51.9.101). */
  pose?: Pose;
  /** A seasonal greeting at the top of the opener ("Happy Onam!"). */
  greeting?: string;
  /** Picks the fact. */
  seed?: number;
}

const W = 720;
const H = 444;
const MX = 118, MY = 318, MS = 1.15;
const BX = 410, BY = 118, BW = 500;

const ml = (c: HookContext) => c.lang === 'ml';

function scene(title: string): Motion {
  const m = new Motion(title, W, H);
  m.fixView(W / 2, W);
  return m;
}

function big(m: Motion, id: string, text: string, x: number, y: number, size: number, color = 'ink'): string {
  let s = size;
  while (tokenWidth(text, s, '700') > 640 && s > 24) s -= 2;
  return m.text(id, text, x, y, { size: s, weight: '700', color });
}

function greet(m: Motion, c: HookContext, t: number): void {
  if (!c.greeting) return;
  const id = big(m, 'greet', c.greeting, W / 2, 26, 30, 'accent');
  m.appear(id, t, 0, false);
}

/** Facts that are true and short (checked by hand; add more here). */
const FACTS: Array<{ en: string; ml: string }> = [
  { en: 'India gave the world zero as a number: Brahmagupta wrote its rules in 628 CE.', ml: 'പൂജ്യത്തെ ഒരു സംഖ്യയായി ലോകത്തിന് നൽകിയത് ഇന്ത്യയാണ്: ബ്രഹ്മഗുപ്തൻ 628-ൽ അതിന്റെ നിയമങ്ങൾ എഴുതി.' },
  { en: 'Madhava of Sangamagrama and his Kerala school found series for π centuries before Europe.', ml: 'യൂറോപ്പിനും നൂറ്റാണ്ടുകൾക്ക് മുമ്പ് സംഗമഗ്രാമ മാധവനും ശിഷ്യരും π-യുടെ ശ്രേണികൾ കണ്ടെത്തി.' },
  { en: 'Add the digits of any multiple of 9 and you get a multiple of 9 again.', ml: '9-ന്റെ ഏത് ഗുണിതത്തിന്റെയും അക്കങ്ങൾ കൂട്ടിയാൽ വീണ്ടും 9-ന്റെ ഗുണിതം കിട്ടും.' },
  { en: 'A googol is 1 followed by 100 zeros.', ml: 'ഒന്നിനു പിന്നാലെ 100 പൂജ്യങ്ങൾ: അതാണ് ഒരു ഗൂഗോൾ.' },
  { en: 'Every even number above 2 that has ever been checked is a sum of two primes, but nobody has proved it for all of them!', ml: '2-നേക്കാൾ വലിയ, ഇതുവരെ പരിശോധിച്ച ഓരോ ഇരട്ട സംഖ്യയും രണ്ട് അഭാജ്യസംഖ്യകളുടെ തുകയാണ്, പക്ഷേ എല്ലാറ്റിനും ഇത് ആരും ഇനിയും തെളിയിച്ചിട്ടില്ല!' },
  { en: 'The word "algebra" comes from the Arabic al-jabr, meaning "putting back together".', ml: '"ആൾജിബ്ര" എന്ന വാക്ക് "വീണ്ടും ചേർക്കൽ" എന്നർത്ഥമുള്ള അറബി വാക്കായ അൽ-ജബ്റിൽ നിന്നാണ്.' },
];

export function factFor(seed = 0) { return FACTS[Math.abs(seed) % FACTS.length]; }

export function buildOpener(kind0: OpenerKind, c: HookContext): MotionScene {
  const kind: OpenerKind = !MISTAKES && kind0 === 'mistake' ? 'challenge' : kind0; // a pinned or saved choice too
  const m = scene(c.title);
  let t = 250;
  greet(m, c, t);
  const pose: Pose = c.pose ?? (kind === 'mistake' ? 'ask' : kind === 'fact' ? 'think' : 'cheer');
  const q = c.sum ?? c.title.replace(/\s*=\s*\?$/, '');
  if (kind === 'challenge') {
    const say = ml(c) ? `${q} പത്ത് സെക്കൻഡിൽ ചെയ്യാമോ?` : `Can you solve ${q} in ten seconds?`;
    t = m.step(say, t, 2200);
    m.appear(big(m, 'q', `${q} = ?`, W / 2, 150, 64, 'a'), t);
    m.text('timer', '3', W / 2, 290, { size: 96, weight: '700', color: 'accent' });
    m.appear('timer', t + 400, 0, false);
    t = m.count('timer', 3, 0, t + 700, { dur: 1500 }) + 200;
    m.hold(t + 300);
  } else if (kind === 'countdown') {
    t = m.step(ml(c) ? 'റെഡി? മൂന്ന്, രണ്ട്, ഒന്ന്… തുടങ്ങാം!' : "Ready? Three, two, one… let's go!", t, 2400);
    m.text('n', '3', W / 2, 200, { size: 150, weight: '700', color: 'accent' });
    m.appear('n', t);
    m.swap('n', '2', t + 600, 'b');
    m.swap('n', '1', t + 1200, 'c');
    t = m.swap('n', ml(c) ? 'തുടങ്ങാം!' : 'GO!', t + 1800, 'a') + 300;
    m.hold(t + 200);
  } else if (kind === 'mistake') {
    t = m.step(ml(c) ? 'മിക്ക കുട്ടികൾക്കും ഇത് തെറ്റുന്നു!' : 'Most students get this wrong!', t, 2400);
    const { mascot, end } = drawMascot(m, 'mc', MX, MY, MS, t, 'idle');
    setPose(m, mascot, pose, end);
    if (c.wrong) {
      m.appear(big(m, 'w', `${q} = ${c.wrong}`, 420, 170, 56, 'ink'), t + 200);
      m.strike('w', t + 1000);
      m.appear(big(m, 'x', ml(c) ? 'തെറ്റ്!' : 'WRONG!', 420, 260, 40, 'accent'), t + 1300);
      t += 1800;
    } else {
      const b = speechBubble(m, 'mb', ml(c) ? 'ശ്രദ്ധിച്ച് നോക്കൂ…' : 'Watch closely…', t + 300, { x: BX, y: BY, maxW: BW, toward: [mascot.x + 18, mascot.box.y0 + 8] });
      t = m.write(b.lines, t + 900, 120) + 400;
    }
    m.hold(t + 300);
  } else if (kind === 'fact') {
    const f = factFor(c.seed);
    t = m.step(ml(c) ? 'നിങ്ങൾക്കറിയാമോ?' : 'Did you know?', t, 1500);
    const { mascot, end } = drawMascot(m, 'mc', MX, MY, MS, t, 'idle');
    setPose(m, mascot, pose, end);
    const b = speechBubble(m, 'fb', ml(c) ? f.ml : f.en, t + 300, { x: BX, y: BY + 40, maxW: BW, maxLines: 5, size: 24, toward: [mascot.x + 18, mascot.box.y0 + 8] });
    t = m.step(ml(c) ? f.ml : f.en, t + 300, 2600);
    t = m.write(b.lines, t + 400, 150) + 400;
    m.hold(t + 300);
  } else {
    // avatar: the face in the corner says it; the bubble's tail points down-right to it
    t = m.step(ml(c) ? 'ഞാൻ ഇത് എങ്ങനെ ചെയ്തെന്ന് നോക്കൂ!' : 'Watch how I solved this!', t, 2200);
    const b = speechBubble(m, 'ab', ml(c) ? 'ഞാൻ ഇത് എങ്ങനെ ചെയ്തെന്ന് നോക്കൂ!' : 'Watch how I solved this!', t, { x: 330, y: 150, maxW: 520, toward: [640, 420] });
    t = m.write(b.lines, t + 600, 120) + 300;
    m.appear(big(m, 'q', `${q}`, 330, 300, 52, 'a'), t);
    m.hold(t + 700);
  }
  const s = m.build(500);
  s.group = 'opener';
  s.pill = ml(c) ? 'തുടക്കം' : 'START';
  return s;
}

export function buildEnding(kind: EndingKind, c: HookContext): MotionScene {
  const m = scene(c.title);
  let t = 250;
  const pose: Pose = c.pose ?? 'cheer';
  const who = c.name?.split(' ')[0] ?? '';
  const { mascot, end } = drawMascot(m, 'mc', MX, MY, MS, t, 'idle');
  const head: [number, number] = [mascot.x + 18, mascot.box.y0 + 8];
  setPose(m, mascot, pose, end);
  if (kind === 'comment' && c.next) {
    t = m.step(ml(c) ? 'ഇനി നിങ്ങളുടെ ഊഴം! ഉത്തരം കമന്റ് ചെയ്യൂ.' : 'Your turn! Comment your answer.', t, 2400);
    m.appear(big(m, 'nq', `${c.next} = ?`, 420, 150, 56, 'a'), t + 200);
    m.appear(big(m, 'cm', ml(c) ? 'ഉത്തരം കമന്റ് ചെയ്യൂ' : 'Comment below', 420, 250, 34, 'accent'), t + 700);
    t += 1600;
  } else if (kind === 'quiz' && c.quick?.length) {
    t = m.step(ml(c) ? 'വേഗം! മൂന്ന് ചോദ്യങ്ങൾ.' : 'Quick-fire! Three questions.', t, 1600);
    c.quick.slice(0, 3).forEach(([qq, a], i) => {
      const y = 110 + i * 100;
      m.text(`qq${i}`, `${qq} = ?`, 430, y, { size: 50, weight: '700', color: (['a', 'b', 'c'] as const)[i] });
      t = m.step(ml(c) ? `${qq} എത്ര?` : `What is ${qq}?`, t, 1500);
      m.appear(`qq${i}`, t);
      t = m.swap(`qq${i}`, `${qq} = ${a}`, t + 1100, 'result') + 200;
    });
  } else if (kind === 'streak' && c.toffees) {
    const say = ml(c)
      ? `${who} ${c.toffees} ടോഫികൾ നേടി${c.streak ? `, തുടർച്ചയായി ${c.streak} ദിവസം` : ''}!`
      : `${who} has earned ${c.toffees} toffees${c.streak ? `, ${c.streak} days in a row` : ''}!`;
    t = m.step(say, t, 2600);
    m.text('tn', '0', 420, 150, { size: 96, weight: '700', color: 'carry' });
    m.appear('tn', t + 200, 0, false);
    t = m.count('tn', 0, c.toffees, t + 300, { dur: 1200 }) + 100;
    m.appear(big(m, 'tl', ml(c) ? 'ടോഫികൾ' : 'TOFFEES', 420, 240, 36, 'accent'), t);
    if (c.streak) m.appear(big(m, 'sk', ml(c) ? `തുടർച്ചയായി ${c.streak} ദിവസം` : `${c.streak}-DAY STREAK`, 420, 300, 32, 'c'), t + 300);
    t = hopMascot(m, mascot, t + 300) + 200;
  } else if (kind === 'part2') {
    t = m.step(ml(c) ? 'രണ്ടാം ഭാഗം നാളെ! മിസ്സാകാതിരിക്കാൻ ഫോളോ ചെയ്യൂ.' : "Part 2 tomorrow! Follow so you don't miss it.", t, 2600);
    m.appear(big(m, 'p2', ml(c) ? 'ഭാഗം 2' : 'PART 2', 430, 150, 80, 'accent'), t + 200);
    m.appear(big(m, 'tm', ml(c) ? 'നാളെ' : 'TOMORROW', 430, 250, 44, 'b'), t + 600);
    t += 1500;
  } else {
    // tag (also the fallback when the numbers for another ending are missing)
    t = m.step(ml(c) ? 'ഈ ട്രിക്ക് വേണ്ട ഒരു കൂട്ടുകാരനെ ടാഗ് ചെയ്യൂ!' : 'Tag a friend who needs this trick!', t, 2400);
    const b = speechBubble(m, 'tg', ml(c) ? 'ഒരു കൂട്ടുകാരനെ ടാഗ് ചെയ്യൂ!' : 'Tag a friend who needs this!', t + 200, { x: BX, y: BY, maxW: BW, toward: head });
    t = m.write(b.lines, t + 800, 120) + 300;
    t = hopMascot(m, mascot, t) + 200;
  }
  m.hold(t + 500);
  const s = m.build(700);
  s.group = 'ending';
  s.pill = ml(c) ? 'അവസാനം' : 'YOUR TURN';
  return s;
}

/** The ending actually used: one that needs numbers we do not have falls back to "tag a friend". */
export function usableEnding(kind: EndingKind, c: HookContext): EndingKind {
  if (kind === 'comment' && !c.next) return 'tag';
  if (kind === 'quiz' && !c.quick?.length) return 'tag';
  if (kind === 'streak' && !c.toffees) return 'tag';
  return kind;
}
