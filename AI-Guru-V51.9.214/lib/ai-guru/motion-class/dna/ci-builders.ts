/**
 * DNA builder for the chapter introduction (V51.9.58): a title card with formulas drifting in the background,
 * one card per topic of the chapter (with a small worked example the app computes), and a closing recap.
 * Modelled on the "what is this chapter about" openings of explainer videos. The planner gives the topics,
 * what to say and a few numbers; the app computes and draws every line (ci-math.ts).
 */

import { ease, Motion, type MotionScene } from '../../reels/motion/engine';
import { tokenWidth } from '../../reels/motion/metrics';
import type { Lang } from '../../reels/motion/captions';
import type { Bi, ChapterIntroPlan, IntroTopic } from './types';
import { pairFacts, solveFacts } from './ci-math';

const pick = (b: Bi | undefined, lang: Lang): string => (b ? (lang === 'ml' ? b.ml || b.en : b.en) : '');
const W = 720;
const H = 405;
/** Night-blue stage, as in the reference opening; every colour here is on a dark ground. */
export const CI_COLORS = { bg: '#0b1d44', ink: '#ffffff', soft: '#9fc2ff', faint: '#6f8fd0', gold: '#ffd54a', green: '#5be37d', op: '#ffb347' };
const CHECK: Record<Lang, string> = { en: 'Check', ml: 'പരിശോധന' };

/** Where the background formulas rest: around the edges, clear of the middle band. */
const SLOTS: Array<[number, number]> = [[96, 52], [610, 46], [70, 350], [640, 352], [262, 36], [470, 368], [330, 370], [520, 40]];

function stage(m: Motion): void {
  m.fixView(W / 2, W);
  m.poly('bg', [[-80, -80], [W + 80, -80], [W + 80, H + 80], [-80, H + 80]], 0, { color: CI_COLORS.bg, fill: CI_COLORS.bg, fillAlpha: 1, dur: 1, z: -1, silent: true, background: true });
  // The night sky is there from the first frame.
  const bg = m.get('bg');
  bg.alpha.segs = [];
  bg.alpha.init = 1;
  bg.draw.segs = [];
  bg.draw.init = 1;
  bg.fillAlpha.segs = [];
  bg.fillAlpha.init = 1;
}

/** Largest size (≤ `size`) at which the text fits `maxW`. */
function fit(text: string, size: number, maxW: number, weight = '700'): number {
  let s = size;
  while (s > 14 && tokenWidth(text, s, weight) > maxW) s -= 2;
  return s;
}

/** Formulas drift slowly in the background, dim, until the scene ends. */
function drift(m: Motion, formulas: string[], t0: number, tEnd: number): void {
  formulas.slice(0, SLOTS.length).forEach((f, i) => {
    const id = `ff${i}`;
    const [x, y] = SLOTS[i];
    m.text(id, f, x, y, { size: fit(f, 26, 200, '400'), color: CI_COLORS.faint, weight: '400', z: 1 });
    const at = t0 + i * 260;
    m.get(id).alpha.to(at, 700, 0.55, ease.soft);
    m.move(id, x + (i % 2 ? 14 : -14), y + (i % 3 === 0 ? -9 : 9), at, { dur: Math.max(3000, tEnd - at), sound: false });
  });
}

function titleCard(plan: ChapterIntroPlan, lang: Lang, title: string): MotionScene {
  const m = new Motion(title, W, H);
  stage(m);
  const name = pick(plan.title, lang);
  const shown = lang === 'en' ? name.toUpperCase() : name;
  let t = m.step(pick(plan.welcome, lang), 300, 4200);
  drift(m, plan.formulas ?? [], t + 200, t + 7000);
  const size = fit(shown, 66, 620);
  m.text('title', shown, W / 2, 150, { size, color: CI_COLORS.ink, weight: '700', z: 4 });
  t = m.write('title', t + 700, 0, 900);
  const half = tokenWidth(shown, size, '700') / 2;
  t = m.rule('uline', W / 2 - half, 150 + size * 0.62, W / 2 + half, 150 + size * 0.62, t, { color: CI_COLORS.gold, width: 5 });
  const names = plan.topics.map((x) => pick(x.name, lang));
  // One row of topic names; two rows when they would not fit at a readable size.
  const one = names.join('  •  ');
  const rows = fit(one, 22, 640, '400') >= 18 ? [one] : [names.slice(0, Math.ceil(names.length / 2)).join('  •  '), names.slice(Math.ceil(names.length / 2)).join('  •  ')];
  const subY = 150 + size * 0.62 + 50;
  const subIds = rows.map((r, i) => {
    const id = `sub${i}`;
    m.text(id, r, W / 2, subY + i * 36, { size: Math.min(...rows.map((x) => fit(x, 22, 640, '400'))), color: CI_COLORS.soft, weight: '400', z: 4 });
    return id;
  });
  t = m.appear(subIds, t + 250, 350);
  m.hold(t + 900);
  return m.build(900);
}

function topicCard(topic: IntroTopic, no: number, plan: ChapterIntroPlan, lang: Lang, title: string): MotionScene {
  const m = new Motion(title, W, H);
  stage(m);
  const name = pick(topic.name, lang);
  let t = m.step(pick(topic.say, lang), 300, 3200);
  const ex = topic.example;
  const size = fit(name, ex ? 38 : 54, 560);
  const ny = ex ? 62 : 178;
  // The chapter's formulas stay in the background on the cards that have no example of their own.
  if (!ex) drift(m, plan.formulas ?? [], t, t + 6000);
  m.dot('chip', 56, ny, t, { color: CI_COLORS.gold, r: 24 });
  m.text('no', String(no), 56, ny + 1, { size: 30, color: CI_COLORS.bg, weight: '700', z: 6 });
  t = m.appear('no', t + 100);
  m.text('name', name, W / 2 + 20, ny, { size, color: CI_COLORS.ink, weight: '700', z: 4 });
  t = m.write('name', t + 100, 0, 800);
  const half = tokenWidth(name, size, '700') / 2;
  t = m.rule('uline', W / 2 + 20 - half, ny + size * 0.62, W / 2 + 20 + half, ny + size * 0.62, t, { color: CI_COLORS.gold, width: 4 });

  if (ex?.kind === 'solve') {
    const f = solveFacts(ex);
    if (f) {
      const rows = [f.first, ...(f.moved ? [f.moved] : []), f.answer];
      const ys = rows.length === 3 ? [150, 215, 280] : [165, 245];
      const ids: string[] = [];
      rows.forEach((r, i) => {
        const last = i === rows.length - 1;
        const id = `ln${i}`;
        const rs = fit(r, 50, 420);
        m.text(id, r, W / 2, ys[i], { size: rs, color: last ? CI_COLORS.gold : CI_COLORS.ink, weight: '700', z: 4 });
        t = m.write(id, t + 350, 0, 700);
        ids.push(id);
        if (i === 0 && f.moved) {
          const b = ex.b;
          m.text('op1', `${b > 0 ? '−' : '+'} ${Math.abs(b)}`, W / 2 + tokenWidth(r, rs, '700') / 2 + 56, ys[0], { size: 26, color: CI_COLORS.op, weight: '700', z: 4 });
          t = m.appear('op1', t + 150);
        } else if (!last) {
          m.text('op2', `÷ ${ex.a}`, W / 2 + tokenWidth(r, rs, '700') / 2 + 56, ys[i], { size: 26, color: CI_COLORS.op, weight: '700', z: 4 });
          t = m.appear('op2', t + 150);
        }
      });
      const last = rows.length - 1;
      const aw = tokenWidth(rows[last], fit(rows[last], 50, 420), '700');
      t = m.box('ans', W / 2, ys[last], aw + 44, 64, t + 200, CI_COLORS.gold);
      m.text('chk', `${CHECK[lang]}: ${f.check}`, W / 2, 346, { size: fit(`${CHECK[lang]}: ${f.check}`, 26, 560, '400'), color: CI_COLORS.green, weight: '400', z: 4 });
      t = m.write('chk', t + 250, 0, 800);
      t = m.tick('tk', W / 2 + 270, 346, t + 100, 30);
    }
  } else if (ex?.kind === 'pair') {
    const f = pairFacts(ex.e1, ex.e2);
    if (f) {
      m.text('l1', f.l1, W / 2, 140, { size: fit(f.l1, 48, 440), color: CI_COLORS.ink, weight: '700', z: 4 });
      t = m.write('l1', t + 350, 0, 700);
      m.text('l2', f.l2, W / 2, 205, { size: fit(f.l2, 48, 440), color: CI_COLORS.soft, weight: '700', z: 4 });
      t = m.write('l2', t + 250, 0, 700);
      t = m.rule('sep', W / 2 - 170, 243, W / 2 + 170, 243, t + 150, { color: CI_COLORS.faint, width: 3 });
      const asize = fit(f.answer, 50, 440);
      m.text('ans1', f.answer, W / 2, 290, { size: asize, color: CI_COLORS.gold, weight: '700', z: 4 });
      t = m.write('ans1', t + 250, 0, 800);
      t = m.box('ans', W / 2, 290, tokenWidth(f.answer, asize, '700') + 44, 64, t + 150, CI_COLORS.gold);
      m.text('chk', `${CHECK[lang]}: ${f.check}`, W / 2, 346, { size: fit(`${CHECK[lang]}: ${f.check}`, 26, 560, '400'), color: CI_COLORS.green, weight: '400', z: 4 });
      t = m.write('chk', t + 250, 0, 800);
      t = m.tick('tk', W / 2 + 270, 346, t + 100, 30);
    }
  }
  m.hold(t + 700);
  return m.build(700);
}

function recap(plan: ChapterIntroPlan, lang: Lang, title: string): MotionScene {
  const m = new Motion(title, W, H);
  stage(m);
  const name = pick(plan.title, lang);
  const shown = lang === 'en' ? name.toUpperCase() : name;
  let t = m.step(pick(plan.closing, lang), 300, 3600);
  drift(m, plan.formulas ?? [], t, t + 6000);
  const size = fit(shown, 44, 600);
  m.text('title', shown, W / 2, 92, { size, color: CI_COLORS.ink, weight: '700', z: 4 });
  t = m.write('title', t + 300, 0, 800);
  const half = tokenWidth(shown, size, '700') / 2;
  t = m.rule('uline', W / 2 - half, 92 + size * 0.62, W / 2 + half, 92 + size * 0.62, t, { color: CI_COLORS.gold, width: 4 });
  const rows = plan.topics.map((x, i) => `${i + 1}   ${pick(x.name, lang)}`);
  const gap = rows.length > 4 ? 38 : 46;
  const ids = rows.map((r, i) => {
    const id = `row${i}`;
    m.text(id, r, W / 2, 168 + i * gap, { size: fit(r, 28, 560, '400'), color: i % 2 ? CI_COLORS.soft : CI_COLORS.ink, weight: '400', z: 4 });
    return id;
  });
  t = m.appear(ids, t + 300, 420);
  m.hold(t + 1200);
  return m.build(1200);
}

export function buildChapterIntro(plan: ChapterIntroPlan, lang: Lang, title: string): MotionScene[] {
  return [titleCard(plan, lang, title), ...plan.topics.map((tp, i) => topicCard(tp, i + 1, plan, lang, title)), recap(plan, lang, title)];
}
