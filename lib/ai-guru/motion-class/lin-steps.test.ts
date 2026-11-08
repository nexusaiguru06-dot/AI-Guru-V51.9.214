// V51.9.136 — the pair of linear equations worked step by step (two captions), and the speed controller.
import { describe, expect, it } from 'vitest';
import { evalItem, Motion, withStepPause, withVoice, type MotionScene } from '../reels/motion';
import { tokenWidth } from '../reels/motion/metrics';
import { buildDnaScenes } from './dna/builders';
import { checkSteps, eliminationSteps, substitutionSteps, type LinSub } from './dna/lin-steps';
import { eliminate, solve, type Eq } from './dna/lin-math';
import type { LinPlan } from './dna/types';
import { segmentReel, compileClass } from './class';
import { LIN_FULL_SAMPLE } from './samples/linear-system';

const say = { en: 'x', ml: 'എ' };
/** Many clean systems (whole solutions in ±6, coefficients up to 9 in size, c within ±60). */
function systems(): Array<{ e1: Eq; e2: Eq; x: number; y: number }> {
  const out: Array<{ e1: Eq; e2: Eq; x: number; y: number }> = [];
  for (const x of [-5, -1, 0, 2, 6]) for (const y of [-6, -2, 0, 1, 4]) for (const a1 of [-7, -2, 1, 3, 9]) for (const b1 of [-5, -1, 2, 4]) for (const a2 of [-3, 1, 2, 6]) for (const b2 of [-9, -2, 1, 3, 7]) {
    const e1 = { a: a1, b: b1, c: a1 * x + b1 * y };
    const e2 = { a: a2, b: b2, c: a2 * x + b2 * y };
    if (Math.abs(e1.c) > 60 || Math.abs(e2.c) > 60 || a1 * b2 - a2 * b1 === 0) continue;
    out.push({ e1, e2, x, y });
  }
  return out;
}
const ALL = systems();
/** "x = −3" → -3 */
const valueOf = (subs: LinSub[], v: 'x' | 'y') => {
  const w = [...subs].reverse().find((s) => s.write?.color === 'result' && s.write.big && s.write.text.startsWith(`${v} = `));
  return w ? Number(w.write!.text.split('= ')[1].replace('−', '-')) : NaN;
};

describe('the detailed steps are true for every system', () => {
  it('elimination ends with the right value, and every step has both captions in both languages', () => {
    expect(ALL.length).toBeGreaterThan(300);
    for (const s of ALL) for (const v of ['x', 'y'] as const) {
      const subs = eliminationSteps(s, v);
      const left = v === 'x' ? 'y' : 'x';
      expect(valueOf(subs, left), `${JSON.stringify(s)} eliminate ${v}`).toBe(left === 'x' ? s.x : s.y);
      for (const sub of subs) {
        expect(sub.why.en.length).toBeGreaterThan(8);
        expect(sub.why.ml).toMatch(/[ഀ-ൿ]/);
        expect(sub.note.en.length).toBeGreaterThan(0);
        expect(sub.note.en.length).toBeLessThan(30);
        expect(sub.why.en).not.toMatch(/NaN|undefined|Infinity|−0\b/);
      }
      // the multiplied lines are what the elimination really used
      const el = eliminate(s, v);
      const simplified = subs.filter((x) => /^mul\db$/.test(x.key));
      expect(simplified.length).toBe((el.m1 > 1 ? 1 : 0) + (el.m2 > 1 ? 1 : 0));
      // V51.9.137: every line is made of tokens, and every flow points at a real token of the new line
      for (const sub of subs) if (sub.write) {
        expect(sub.write.text).toBe(sub.write.tokens.join(' '));
        for (const f of sub.write.flows ?? []) expect(f.to).toBeLessThan(sub.write.tokens.length);
      }
      expect(subs.find((x) => x.key === 'combine')!.rule).toBe(el.op);
    }
  }, 60000);
  it('substitution ends with the right value; moving a number across always says why', () => {
    for (const s of ALL) for (const known of ['x', 'y'] as const) for (const into of [1, 2] as const) {
      const e = into === 1 ? s.e1 : s.e2;
      const kv = known === 'x' ? s.x : s.y;
      const subs = substitutionSteps(s, known, kv, into);
      const left = known === 'x' ? 'y' : 'x';
      expect(valueOf(subs, left), `${JSON.stringify(s)} ${known} into ${into}`).toBe(left === 'x' ? s.x : s.y);
      const k = (known === 'x' ? e.a : e.b) * kv;
      const move = subs.find((x) => x.key === 'sub-move');
      if (k === 0) expect(move).toBeUndefined();
      else expect(move!.why.en).toMatch(/both sides stay equal/);
      for (const sub of subs) expect(sub.why.en + sub.note.en).not.toMatch(/NaN|undefined|−0\b/);
    }
  }, 60000);
  it('the check lines are true arithmetic', () => {
    for (const s of ALL) {
      const subs = checkSteps(s, s.x, s.y);
      for (const sub of subs.filter((x) => x.write?.tick)) {
        const parts = sub.write!.text.split(' = ');
        expect(parts.length).toBe(3);
        const [p1, rest] = [parts[1].split(/ [+−] /)[0], parts[1]];
        const sum = Number(p1.replace('−', '-')) + (rest.includes(' + ') ? 1 : -1) * Number(rest.split(/ [+−] /)[1]);
        expect(sum).toBe(Number(parts[2].replace('−', '-')));
      }
    }
  });
});

describe('the board for many systems', () => {
  const visible = (sc: MotionScene, t: number) => sc.items.filter((i) => i.kind === 'text').map((i) => evalItem(i, t)).filter((st) => st.alpha > 0.5);
  it('builds, keeps every line inside the board, and nothing on a row overlaps', () => {
    for (const s of ALL.filter((_, i) => i % 40 === 0)) {
      const plan: LinPlan = { e1: s.e1, e2: s.e2, steps: [{ op: 'show', say }, { op: 'graph', say }, { op: 'eliminate', var: 'x', say }, { op: 'substitute', into: 2, say }, { op: 'check', say }, { op: 'meet', say }] };
      expect('error' in solve(plan)).toBe(false);
      for (const lang of ['en', 'ml'] as const) {
        const [sc] = buildDnaScenes('linear-system', plan, lang, 'T');
        for (const t of sc.captions.map((c) => c.t1 - 40)) {
          // the working page (and the equations at its top); the graph's own axis labels are checked elsewhere
          const box = visible(sc, t).filter((q) => /^(w[lkt]|nt|sg|e[12]t|tg)/.test(q.id)).map((q) => { const w = tokenWidth(q.text, q.size); return { q, l: q.x - w / 2, r: q.x + w / 2 }; });
          for (const b of box) {
            expect(b.l, `${b.q.text} ${JSON.stringify(s)}`).toBeGreaterThan(2);
            expect(b.r, `${b.q.text} ${JSON.stringify(s)}`).toBeLessThan(718);
          }
          for (let i = 0; i < box.length; i++) for (let j = i + 1; j < box.length; j++) {
            if (Math.abs(box[i].q.y - box[j].q.y) > 12) continue;
            expect(Math.max(box[i].l, box[j].l) - Math.min(box[i].r, box[j].r), `${box[i].q.text} / ${box[j].q.text}`).toBeGreaterThanOrEqual(-1e-6);
          }
        }
      }
    }
  }, 60000);
  it('a caption is never cut short: the next small step waits until it can be read', () => {
    const [sc] = buildDnaScenes('linear-system', LIN_FULL_SAMPLE, 'en', 'T');
    const subs = sc.captions.filter((c) => c.note);
    expect(subs.length).toBeGreaterThan(15);
    for (const c of subs) expect(c.t1 - c.t0, c.text).toBeGreaterThanOrEqual(2600);
  });
  it('with a voice, each step lasts at least as long as its voice clip', () => {
    const [sc] = withVoice({ lang: 'en', clipMs: (s) => 200 + s.length * 55 }, () => buildDnaScenes('linear-system', LIN_FULL_SAMPLE, 'en', 'T'));
    for (const c of sc.captions) if (c.voiceMs) expect(c.t1).toBeGreaterThanOrEqual(c.voiceT0! + c.voiceMs);
  });
});

describe('the speed controller (step pause)', () => {
  const build = () => { const m = new Motion('t'); let t = m.step('one', 0, 1000); t = m.step('two', t + 1000, 1000); m.step('three', t + 1000, 1000); return m.build(); };
  it('adds the chosen time between steps, never before the first', () => {
    const a = build();
    const b = withStepPause(3000, build);
    expect(b.captions[0].t0).toBe(a.captions[0].t0);
    expect(b.captions[1].t0 - a.captions[1].t0).toBe(3000);
    expect(b.captions[2].t0 - a.captions[2].t0).toBe(6000);
    expect(b.durationMs - a.durationMs).toBe(6000);
    // the finished step's caption stays on screen through the wait
    expect(b.captions[0].t1).toBe(b.captions[1].t0);
  });
  it('is limited to 0–10 s and is switched off again after the build', () => {
    expect(withStepPause(99999, build).captions[1].t0 - build().captions[1].t0).toBe(10000);
    expect(withStepPause(-5, build).captions[1].t0).toBe(build().captions[1].t0);
  });
  it('a whole class part gets longer by the pause on every step', () => {
    const plan = { blockId: 'b', dna: 'linear-system' as const, read: say, teach: LIN_FULL_SAMPLE, source: 'fixture' as const };
    const block = { id: 'b', kind: 'prose' as const, page: 1, chapterId: 'c', sectionId: 's', lines: [], text: 'A pair of linear equations.' };
    const [seg] = compileClass([block], new Map([['b', plan]]), { title: 'T' }).filter((s) => s.phase === 'teach');
    const a = segmentReel(seg);
    const b = withStepPause(2000, () => segmentReel(seg));
    const steps = a.parts.reduce((n, p) => n + Math.max(0, p.captions.length - 1), 0);
    expect(steps).toBeGreaterThan(15);
    expect(b.durationMs - a.durationMs).toBeGreaterThanOrEqual((steps - 1) * 2000);
    expect(b.durationMs - a.durationMs).toBeLessThanOrEqual(steps * 2000);
  });
});

describe('V51.9.137: the digits move (ring, orange, fly, become)', () => {
  const [sc] = buildDnaScenes('linear-system', LIN_FULL_SAMPLE, 'en', 'T');
  const ORANGE = '#f08a00';
  const cap = (re: RegExp) => sc.captions.find((c) => re.test(c.text))!;
  const during = (c: { t0: number; t1: number }, f: number) => c.t0 + (c.t1 - c.t0) * f;
  it('copies of the digits fly from the line above to the new line', () => {
    const flyers = sc.items.filter((i) => i.id.startsWith('fl'));
    expect(flyers.length).toBeGreaterThan(30);
    // a flyer ends where its token lands, and is gone afterwards
    const f = flyers[0];
    expect(evalItem(f, sc.durationMs).alpha).toBeLessThan(0.05);
  });
  it('while 2 × 2x becomes 4x, the digits worked on are orange and ringed', () => {
    const c = cap(/^Multiply each term: 2 × 2x/);
    let sawOrange = false, sawRing = false;
    for (let f = 0.05; f < 0.6; f += 0.03) {
      const t = during(c, f);
      const st = sc.items.map((i) => evalItem(i, t)).filter((x) => x.alpha > 0.5);
      if (st.some((x) => x.kind === 'text' && x.color.toLowerCase() === ORANGE)) sawOrange = true;
      if (st.some((x) => x.kind !== 'text' && x.color.toLowerCase() === ORANGE)) sawRing = true;
    }
    expect(sawOrange).toBe(true);
    expect(sawRing).toBe(true);
  });
  it('after each step every digit is back in its own colour', () => {
    for (const re of [/^Multiply each term: 2 × 2x/, /^The y terms cancel/, /^14 divided by 7/]) {
      const c = cap(re);
      const st = sc.items.filter((i) => i.kind === 'text' && /^wk/.test(i.id)).map((i) => evalItem(i, c.t1 - 30)).filter((x) => x.alpha > 0.5);
      expect(st.filter((x) => x.color.toLowerCase() === ORANGE).map((x) => x.text), String(re)).toEqual([]);
    }
  });
  it('the camera leans in on the working and comes back for the graph', () => {
    const work = cap(/^The y terms cancel/);
    expect(sc.camH.at(work.t1 - 30)).toBeLessThan(sc.height);
    expect(sc.camH.at(sc.durationMs)).toBe(sc.height);
  });
});
