// @vitest-environment node
/** V51.9.101: every reel different — looks, seeds, openers/endings, sounds, seasons, content kinds, camera. */
import { MISTAKES } from '../../features';
import { describe, it, expect, beforeAll } from 'vitest';
import { createCanvas } from '@napi-rs/canvas';
import { buildReel, clipMs, drawReelFrame, reelVoiceCues, unvoicedSteps, voiceScript, type MotionReel } from './index';
import { setMeasurer } from './metrics';
import { CLASSIC, LOOKS, contrast, lookColor, readability, roleMap } from './look';
import { ROLE } from './grammar';
import { commonMistake, decorateReel, planStyle, quickQuestions, retimeScene, secondWay, similarSum, weeklySum, rng, type ReelStyle } from './variety';
import { parseArithmetic } from './reel';
import { buildEnding, buildOpener, ENDINGS, OPENERS, usableEnding } from './recipes/hooks';
import { seasonFor, SEASONS } from './season';
import { renderSfx } from './sfx';
import { boardFx } from './camera';
import { shareClip } from '../../share/clip';
import { SFX_RATE } from './sfx';

beforeAll(() => setMeasurer((text, px) => text.length * px * 0.55));

const evalSum = (s: string) => {
  const p = parseArithmetic(s)!;
  return p.op === 'add' ? p.nums.reduce((a, b) => a + b, 0) : p.op === 'sub' ? p.a - p.b : p.op === 'mul' ? p.a * p.b : p.a / p.b;
};

describe('looks', () => {
  it('every look is readable (maths colours on the board, captions on their card, labels, footer)', () => {
    for (const l of LOOKS) expect(readability(l), l.id).toEqual([]);
  });
  it('the classic look is exactly the old whiteboard (nothing changes for the class)', () => {
    const map = roleMap(CLASSIC);
    for (const c of Object.values(ROLE)) expect(lookColor(c, CLASSIC, map)).toBe(c);
  });
  it('dark boards turn dark ink light and keep role colours distinct', () => {
    const chalk = LOOKS.find((l) => l.id === 'chalk')!;
    const m = roleMap(chalk);
    expect(contrast(lookColor(ROLE.ink, chalk, m), chalk.palette.paper)).toBeGreaterThan(7);
    expect(new Set(['a', 'b', 'c'].map((r) => lookColor((ROLE as any)[r], chalk, m))).size).toBe(3);
    expect(lookColor('#123456', chalk, m)).toBe(chalk.palette.text); // an unknown very dark colour becomes the chalk colour
  });
  it('at least 12 looks, ids unique, all boards and shapes used', () => {
    expect(LOOKS.length).toBeGreaterThanOrEqual(12);
    expect(new Set(LOOKS.map((l) => l.id)).size).toBe(LOOKS.length);
    expect(new Set(LOOKS.map((l) => l.board))).toEqual(new Set(['whiteboard', 'blackboard', 'chalkboard', 'graph', 'notebook', 'kasavu', 'neon', 'ink', 'comic', 'cinema']));
    expect(new Set(LOOKS.map((l) => l.shape))).toEqual(new Set(['rounded', 'ribbon', 'sticky', 'bubble', 'speech']));
  });
});

describe('seeds', () => {
  it('the same seed gives the same reel style; different seeds give different ones', () => {
    expect(planStyle(42)).toEqual(planStyle(42));
    const styles = Array.from({ length: 40 }, (_, i) => planStyle(i * 7919 + 1));
    const combos = new Set(styles.map((s) => `${s.look.id}|${s.opener}|${s.ending}|${s.music}|${s.camera}`));
    expect(combos.size).toBeGreaterThan(35);
    for (const k of ['look', 'opener', 'ending', 'music', 'camera', 'pack', 'pose'] as const) expect(new Set(styles.map((s) => (k === 'look' ? s.look.id : s[k]))).size, k).toBeGreaterThan(2);
  });
  it('never picks one of the last 5 looks', () => {
    const recent = LOOKS.slice(0, 5).map((l) => l.id);
    for (let i = 0; i < 60; i++) expect(recent).not.toContain(planStyle(i * 31 + 5, { recent, date: new Date('2026-10-22') }).look.id);
  });
  it('a choice fixed by hand stays; the others still come from the seed', () => {
    const a = planStyle(9, { choices: { music: 'kerala', look: 'notebook' } });
    const b = planStyle(9);
    expect(a.music).toBe('kerala');
    expect(a.look.id).toBe('notebook');
    expect(a.ending).toBe(b.ending);
    expect(a.camera).toBe(b.camera);
  });
  it('the avatar opener is only picked when a face is in the corner', () => {
    for (let i = 0; i < 80; i++) expect(planStyle(i * 13 + 3, { hasFace: false }).opener).not.toBe('avatar');
    expect(Array.from({ length: 80 }, (_, i) => planStyle(i * 13 + 3, { hasFace: true }).opener)).toContain('avatar');
  });
  it('the season switches on by date (India time) and suggests its look; the student can switch it off', () => {
    expect(seasonFor(new Date('2026-08-26T06:00:00Z'))).toBe('onam');
    expect(seasonFor(new Date('2026-04-14T06:00:00Z'))).toBe('vishu');
    expect(seasonFor(new Date('2026-12-24T06:00:00Z'))).toBe('christmas');
    expect(seasonFor(new Date('2026-11-14T06:00:00Z'))).toBe('childrens-day');
    expect(seasonFor(new Date('2026-03-01T06:00:00Z'))).toBe('exam');
    expect(seasonFor(new Date('2026-07-01T06:00:00Z'))).toBe('monsoon');
    expect(seasonFor(new Date('2026-10-22T06:00:00Z'))).toBeNull();
    expect(seasonFor(new Date('2026-08-14T19:00:00Z'))).toBe('onam'); // 00:30 on 15 Aug in India
    const onam = new Date('2026-08-26T06:00:00Z');
    const looks = Array.from({ length: 40 }, (_, i) => planStyle(i * 17 + 1, { date: onam }));
    expect(looks.every((s) => s.season === 'onam')).toBe(true);
    expect(looks.filter((s) => s.look.id === 'kasavu').length).toBeGreaterThan(20);
    expect(planStyle(1, { date: onam, choices: { season: false } }).season).toBeNull();
    expect(SEASONS.length).toBe(6);
  });
});

describe('sums for openers, endings and content kinds (always right)', () => {
  const sums = ['478 + 356', '503 − 278', '347 × 26', '1260 ÷ 12', '7385 ÷ 5', '52 + 87'];
  it('similar sums have the same kind and size', () => {
    for (const s of sums) {
      const n = similarSum(s, 5)!;
      expect(parseArithmetic(n)!.op).toBe(parseArithmetic(s)!.op);
      expect(Number.isInteger(evalSum(n))).toBe(true);
      expect(evalSum(n)).toBeGreaterThan(0);
    }
  });
  it('quick-fire questions have correct answers', () => {
    for (const s of sums) for (const [q, a] of quickQuestions(s, 3)) expect(String(evalSum(q))).toBe(a);
  });
  it('the "mistake" is a real wrong answer and differs from the right one', () => {
    expect(commonMistake('478 + 356')!.wrong).toBe('724'); // 8+6→4, 7+5→2, 4+3→7: carries forgotten
    expect(commonMistake('503 − 278')!.wrong).toBe('375'); // 8−3, 7−0, 5−2 smaller-from-bigger
    expect(commonMistake('347 × 26')!.wrong).toBe(String(347 * 6 + 347 * 2));
    expect(commonMistake('1260 ÷ 12')!.wrong).toBe('15');
    expect(commonMistake('123 + 456')).toBeUndefined(); // no carry: nothing to get wrong
    for (const s of sums) { const m = commonMistake(s); if (m) expect(Number(m.wrong)).not.toBe(evalSum(s)); }
  });
  it('the second way computes to the same answer, line by line', () => {
    for (const s of sums) {
      const w = secondWay(s);
      if (!w) continue;
      const ans = String(evalSum(s));
      expect(w.lines.at(-1)).toEqual([ans]);
      const flat = (ln: string[]) => ln.join(' ').replace(/−/g, '-').replace(/×/g, '*').replace(/÷/g, '/');
      for (const ln of w.lines) expect(Function(`return ${flat(ln)}`)()).toBe(Number(ans));
    }
    expect(secondWay('478 + 356')!.lines[1]).toEqual(['(478+2)', '+', '(356−2)']);
  });
  it('the weekly problem is the same for a class all week, different for another class or week', () => {
    const mon = new Date('2026-10-19T04:00:00Z'), fri = new Date('2026-10-23T04:00:00Z'), next = new Date('2026-10-28T04:00:00Z');
    expect(weeklySum('CLAS9A', mon)).toBe(weeklySum('CLAS9A', fri));
    expect(weeklySum('CLAS9A', mon)).not.toBe(weeklySum('CLAS9B', mon));
    expect(weeklySum('CLAS9A', mon)).not.toBe(weeklySum('CLAS9A', next));
    for (let w = 0; w < 8; w++) expect(Number.isInteger(evalSum(weeklySum('X', new Date(Date.UTC(2026, 0, 5 + w * 7)))))).toBe(true);
  });
});

const voiceAll = (reel: MotionReel) => new Map(voiceScript(reel).map((s) => [s, new Float32Array(Math.round(SFX_RATE * 0.8))] as const));

describe('openers, endings and the voice', () => {
  const style = (o: Partial<ReelStyle> = {}): ReelStyle => ({ ...planStyle(3), ...o });
  it('every opener and ending builds in English and Malayalam', () => {
    for (const lang of ['en', 'ml'] as const) {
      const c = { lang, title: '478 + 356 = ?', sum: '478 + 356', wrong: '724', next: '512 + 389', quick: quickQuestions('478 + 356', 1), name: 'Anu Thomas', toffees: 120, streak: 5 };
      for (const k of OPENERS) expect(buildOpener(k, c).captions.length, k).toBeGreaterThan(0);
      for (const k of ENDINGS) expect(buildEnding(k, c).captions.length, k).toBeGreaterThan(0);
    }
    expect(usableEnding('streak', { lang: 'en', title: 'x' })).toBe('tag');
    expect(usableEnding('comment', { lang: 'en', title: 'x' })).toBe('tag');
  });
  it('the opener, the ending, the end card and the QR card are all voiced (they were silent before V51.9.101)', () => {
    const base = buildReel({ kind: 'arithmetic', text: '478 + 356', lang: 'en' });
    const d0 = shareClip(decorateReel(base, { style: style({ opener: 'challenge', ending: 'comment' }), kind: 'normal', lang: 'en', sum: '478 + 356' }), { link: 'https://x/j/ANU1', lang: 'en' });
    const clips = voiceAll(d0);
    const vm = (t: string) => (clips.has(t) ? clipMs(clips.get(t)!) : undefined);
    const voiced = buildReel({ kind: 'arithmetic', text: '478 + 356', lang: 'en' }, { voiceMs: vm });
    const d = shareClip(decorateReel(voiced, { style: style({ opener: 'challenge', ending: 'comment' }), kind: 'normal', lang: 'en', sum: '478 + 356', voiceMs: vm }), { link: 'https://x/j/ANU1', lang: 'en', voiceMs: vm });
    expect(d.parts[0].group).toBe('opener');
    expect(d.parts.map((p) => p.group)).toEqual(expect.arrayContaining(['ending', 'end-card', 'qr-card']));
    expect(unvoicedSteps(d, clips)).toEqual([]);
    expect(reelVoiceCues(d).length).toBe(d.parts.reduce((n, p) => n + p.captions.length, 0));
  });
  it('content kinds add their own scenes', () => {
    const base = buildReel({ kind: 'arithmetic', text: '478 + 356', lang: 'en' });
    const groups = (k: Parameters<typeof decorateReel>[1]['kind']) => decorateReel(base, { style: style({ opener: 'none', ending: 'none' }), kind: k, lang: 'en', sum: '478 + 356', name: 'Anu Thomas', className: 'Class 9A' }).parts.map((p) => p.group ?? '');
    if (MISTAKES) expect(groups('spot-mistake')).toEqual(expect.arrayContaining(['opener', 'reveal']));
    else expect(groups('spot-mistake')).toEqual(groups('normal')); // V51.9.123: switched off → a normal reel
    expect(groups('two-ways')).toContain('way-2');
    expect(groups('duet')[0]).toBe('duet-ask');
    expect(groups('weekly')).toEqual(expect.arrayContaining(['opener', 'ending']));
    expect(groups('bilingual')[0]).toBe('opener');
    expect(groups('normal')).toEqual(base.parts.map((p) => p.group ?? ''));
  });
  it('a speed run plays the same lesson faster (every time scaled, nothing else changed)', () => {
    const scene = buildReel({ kind: 'arithmetic', text: '347 × 26', lang: 'en' }).parts[0];
    const fast = retimeScene(scene, 0.5);
    expect(fast.durationMs).toBe(Math.ceil(scene.durationMs * 0.5));
    expect(fast.items.length).toBe(scene.items.length);
    expect(fast.captions.map((c) => c.text)).toEqual(scene.captions.map((c) => c.text));
    const it0 = scene.items.find((i) => i.alpha.segs.length)!;
    const f0 = fast.items.find((i) => i.id === it0.id)!;
    expect(f0.alpha.segs[0].t0).toBeCloseTo(it0.alpha.segs[0].t0 * 0.5);
    expect(it0.alpha.segs[0].t0).toBeGreaterThan(0); // the original is untouched
    expect(f0.alpha.at(it0.alpha.segs[0].t1 * 0.5)).toBeCloseTo(it0.alpha.at(it0.alpha.segs[0].t1));
  });
});

describe('sound and camera', () => {
  it('each music bed and sound pack sounds different and stays quiet under the voice', () => {
    const ev = [{ t: 100, kind: 'pop' as const }, { t: 400, kind: 'ding' as const }, { t: 900, kind: 'hop' as const }];
    const rms = (x: Float32Array) => Math.sqrt(x.reduce((a, b) => a + b * b, 0) / x.length);
    const outs = (['calm', 'upbeat', 'kerala', 'lofi'] as const).map((m) => renderSfx([], 6000, { rate: 16000, musicKind: m }));
    for (const o of outs) { expect(rms(o)).toBeGreaterThan(0.002); expect(rms(o)).toBeLessThan(0.08); }
    for (let i = 0; i < outs.length; i++) for (let j = i + 1; j < outs.length; j++) expect(rms(outs[i].map((v, k) => v - outs[j][k]))).toBeGreaterThan(0.002);
    const packs = (['classic', 'soft', 'arcade'] as const).map((p) => renderSfx(ev, 2000, { rate: 16000, music: false, pack: p }));
    expect(rms(packs[1])).toBeLessThan(rms(packs[0]));
    expect(rms(packs[2].map((v, k) => v - packs[0][k]))).toBeGreaterThan(0.001);
  });
  it('the camera moves only the board: punch-in at each step, close-ups on focused work, steady = nothing', () => {
    const scene = buildReel({ kind: 'arithmetic', text: '478 + 356', lang: 'en' }).parts[0];
    expect(boardFx('steady', scene, 1000)).toEqual({ scale: 1, dx: 0, dy: 0 });
    const c1 = scene.captions[1];
    expect(boardFx('punch', scene, c1.t0 + 400).scale).toBeGreaterThan(1.03);
    const focusAt = Array.from({ length: 200 }, (_, i) => (i * scene.durationMs) / 200).find((t) => boardFx('focus', scene, t).scale > 1.05);
    expect(focusAt).toBeDefined();
    expect(boardFx('drift', scene, scene.durationMs).scale).toBeCloseTo(1.06);
  });
});

describe('drawing every look', () => {
  it('draws every look, frame, transition, season, badge and the stopwatch without errors', () => {
    const base = buildReel({ kind: 'arithmetic', text: '478 + 356', lang: 'en' });
    const reel = decorateReel(base, { style: { ...planStyle(1), opener: 'countdown', ending: 'quiz' }, kind: 'normal', lang: 'en', sum: '478 + 356' });
    const c = createCanvas(360, 640);
    const ctx = c.getContext('2d') as unknown as CanvasRenderingContext2D;
    const r = rng(5);
    for (const look of LOOKS) {
      for (const season of [null, ...SEASONS.map((s) => s.id)]) {
        const t = r() * reel.durationMs;
        expect(() => drawReelFrame(ctx, reel, t, { format: 'vertical', footer: true, download: true, look, season, camera: 'focus', badges: ['120 TOFFEES', 'Class 9A'], stopwatch: { from: 0, to: 5000 } })).not.toThrow();
      }
      // just after a part boundary: the transition is drawn
      expect(() => drawReelFrame(ctx, reel, reel.parts[0].durationMs + 120, { format: 'landscape', footer: true, download: true, look })).not.toThrow();
    }
  });
  it('the QR card keeps black on white on a dark look (a re-coloured QR would not scan)', () => {
    const reel = shareClip(buildReel({ kind: 'arithmetic', text: '12 + 7', lang: 'en' }), { link: 'https://x/j/ANU1', lang: 'en' });
    const qrStart = reel.parts.slice(0, -1).reduce((a, p) => a + p.durationMs, 0);
    const c = createCanvas(540, 960);
    const ctx = c.getContext('2d') as unknown as CanvasRenderingContext2D;
    drawReelFrame(ctx, reel, qrStart + 2000, { format: 'vertical', look: LOOKS.find((l) => l.id === 'night') });
    const px = ctx.getImageData(0, 0, 540, 960).data;
    let black = 0;
    for (let i = 0; i < px.length; i += 4) if (px[i] < 30 && px[i + 1] < 30 && px[i + 2] < 30) black++;
    let white = 0;
    for (let i = 0; i < px.length; i += 4) if (px[i] > 240 && px[i + 1] > 240 && px[i + 2] > 240) white++;
    expect(white).toBeGreaterThan(20000); // the QR's white box
    expect(black).toBeGreaterThan(20000); // black modules (and the night board)
  });
});

/* ---------------- V51.9.102 ---------------- */
import { cleanPins, topicOf, TOPIC_FIT } from './variety';
import { endCardScene, END_CARD_VARIANTS } from '../../share/clip';

describe('V51.9.102: the style fits the lesson', () => {
  it('knows the kind of maths from the sum, the topic branch or the chapter intro', () => {
    expect(topicOf({ kind: 'arithmetic' })).toBe('arithmetic');
    expect(topicOf({ kind: 'intro' })).toBe('intro');
    expect(topicOf({ kind: 'branch', branch: 'Geometry · Pythagoras theorem' })).toBe('geometry');
    expect(topicOf({ kind: 'branch', branch: 'Trigonometry' })).toBe('geometry');
    expect(topicOf({ kind: 'branch', branch: 'Statistics · mean' })).toBe('data');
    expect(topicOf({ kind: 'branch', branch: 'Calculus · differentiation' })).toBe('calculus');
    expect(topicOf({ kind: 'branch', branch: 'Quadratic equations' })).toBe('algebra');
  });
  it('good matches come up far more often, but every look still appears', () => {
    const styles = Array.from({ length: 400 }, (_, i) => planStyle(i * 7919 + 11, { topic: 'geometry', date: new Date('2026-10-22') }));
    const fitShare = styles.filter((s) => TOPIC_FIT.geometry.looks.includes(s.look.id)).length / styles.length;
    expect(fitShare).toBeGreaterThan(0.6); // ≈ 12/17 with weight 3
    expect(new Set(styles.map((s) => s.look.id)).size).toBe(LOOKS.length);
    const camFit = styles.filter((s) => TOPIC_FIT.geometry.cameras.includes(s.camera)).length / styles.length;
    expect(camFit).toBeGreaterThan(0.6);
    const none = Array.from({ length: 400 }, (_, i) => planStyle(i * 7919 + 11, { date: new Date('2026-10-22') }));
    expect(none.filter((s) => TOPIC_FIT.geometry.looks.includes(s.look.id)).length / none.length).toBeLessThan(0.6);
  });
  it('the last-5 rule still wins over the topic', () => {
    const recent = TOPIC_FIT.geometry.looks;
    for (let i = 0; i < 60; i++) expect(recent).not.toContain(planStyle(i * 31 + 5, { recent, topic: 'geometry', date: new Date('2026-10-22') }).look.id);
  });
});

describe('V51.9.102: My style (pinned favourites)', () => {
  it('keeps only known values', () => {
    expect(cleanPins({ look: 'chalk', music: 'kerala', pose: 'cheer', ending: 'none', camera: 'zoomzoom', hack: 'x' })).toEqual({ look: 'chalk', music: 'kerala', pose: 'cheer', ending: 'none' });
    expect(cleanPins(null)).toEqual({});
  });
  it('a pinned choice stays on every new reel while the rest still changes', () => {
    const styles = Array.from({ length: 30 }, (_, i) => planStyle(i * 101 + 7, { choices: { look: 'chalk', music: 'lofi' } }));
    expect(styles.every((s) => s.look.id === 'chalk' && s.music === 'lofi')).toBe(true);
    expect(new Set(styles.map((s) => s.opener)).size).toBeGreaterThan(2);
    expect(new Set(styles.map((s) => s.ending)).size).toBeGreaterThan(2);
  });
});

describe('V51.9.102: closing cards in rotation', () => {
  const heading = (v: number, lang: 'en' | 'ml', name?: string) => endCardScene({ link: 'https://x/j/ANU1', lang, variant: v, name }).items.filter((i) => i.id.startsWith('heading')).map((i) => i.text).join('');
  it('five different cards in English and Malayalam, each with the join link and spoken lines', () => {
    for (const lang of ['en', 'ml'] as const) {
      expect(new Set(Array.from({ length: END_CARD_VARIANTS }, (_, v) => heading(v, lang, 'Anu Thomas'))).size).toBe(END_CARD_VARIANTS);
      for (let v = 0; v < END_CARD_VARIANTS; v++) {
        const sc = endCardScene({ link: 'https://x/j/ANU1', lang, variant: v, name: 'Anu Thomas' });
        expect(JSON.stringify(sc.items.map((i) => i.text))).toContain('x/j/ANU1');
        expect(sc.captions.length).toBe(3);
        expect(sc.group).toBe('end-card');
      }
    }
    expect(heading(3, 'en', 'Anu Thomas')).toBe('Made by Anu with AI Guru');
    expect(heading(3, 'en')).toBe('Learn with AI Guru'); // no name: the original card
    expect(heading(-7, 'en', 'Anu')).toBe(heading(3, 'en', 'Anu')); // any seed works
  });
  it('the share clip uses the variant it is given', () => {
    const reel = buildReel({ kind: 'arithmetic', text: '12 + 7', lang: 'en' });
    const end = (v: number) => shareClip(reel, { link: 'https://x/j/A', lang: 'en', variant: v }).parts.find((p) => p.group === 'end-card')!;
    expect(end(1).items.find((i) => i.id === 'heading')!.text).toBe('Liked this trick?');
    expect(end(0).items.find((i) => i.id === 'heading')!.text).toBe('Learn with AI Guru');
  });
});

/* ---------------- V51.9.105 ---------------- */
import { ACCENTS, withAccent, lookById } from './look';
import { classWeight, LEVEL_FIT, levelOf } from './variety';
import { addLook, classCounts } from '../class-looks';

describe('V51.9.105 new looks', () => {
  it('neon, paper & ink and comic are readable and draw on every frame shape', () => {
    for (const id of ['neon', 'ink', 'comic']) {
      const l = lookById(id);
      expect(l.id).toBe(id);
      expect(readability(l), id).toEqual([]);
    }
    expect(lookById('neon').palette.glow).toBe(true);
    expect(lookById('comic').palette.outline).toBeGreaterThan(1);
  });
});

describe('V51.9.105 class level', () => {
  it('reads the standard however it is written', () => {
    expect(levelOf('3')).toBe('young');
    expect(levelOf('LKG')).toBe('young');
    expect(levelOf('Std 7')).toBe('middle');
    expect(levelOf('Class 10')).toBe('senior');
    expect(levelOf('IX')).toBe('senior');
    expect(levelOf('')).toBeNull();
    expect(levelOf('college')).toBeNull();
  });
  it('little ones get playful looks, seniors calmer ones — often, never always', () => {
    const count = (level: 'young' | 'senior') => {
      const looks = new Set<string>();
      let fit = 0;
      for (let s = 1; s <= 400; s++) {
        const st = planStyle(s * 7919, { level, date: new Date('2026-10-22T06:00:00Z') });
        looks.add(st.look.id);
        if (LEVEL_FIT[level].looks.includes(st.look.id)) fit++;
      }
      return { fit: fit / 400, looks: looks.size };
    };
    const young = count('young'), senior = count('senior');
    expect(young.fit).toBeGreaterThan(0.55);
    expect(senior.fit).toBeGreaterThan(0.55);
    expect(young.looks).toBe(LOOKS.length); // every look can still turn up
    expect(senior.looks).toBe(LOOKS.length);
    // without a level the same seeds are as before (the level only weighs, it never shifts the draws)
    expect(planStyle(42, { date: new Date('2026-10-22T06:00:00Z') })).toEqual(planStyle(42, { level: null, date: new Date('2026-10-22T06:00:00Z') }));
  });
});

describe('V51.9.105 classmates spread across the looks', () => {
  const day = new Date('2026-10-22T06:00:00Z');
  it('a look many classmates used today becomes rare', () => {
    const busy: Record<string, number> = { classic: 6, notebook: 6, chalk: 6 };
    let hits = 0;
    for (let s = 1; s <= 600; s++) if (['classic', 'notebook', 'chalk'].includes(planStyle(s * 104729, { date: day, classLooks: busy }).look.id)) hits++;
    expect(hits / 600).toBeLessThan(0.06); // 3 of 12 looks would be 25 % without the class
    expect(classWeight(0)).toBe(1);
    expect(classWeight(2)).toBeLessThan(0.3);
  });
  it('at Onam the class does not all post kasavu', () => {
    const onam = new Date('2026-08-28T06:00:00Z');
    const kasavu = (cl: Record<string, number>) => Array.from({ length: 400 }, (_, i) => planStyle((i + 1) * 15485863, { date: onam, classLooks: cl }).look.id).filter((x) => x === 'kasavu').length / 400;
    expect(kasavu({})).toBeGreaterThan(0.6);
    expect(kasavu({ kasavu: 8 })).toBeLessThan(0.15);
  });
  it('the class record: one count per classmate per look, my own reels left out, a new day starts empty', () => {
    let d = addLook(null, '2026-10-22', 'c1', 'anu', 'neon');
    d = addLook(d, '2026-10-22', 'c1', 'anu', 'neon');
    d = addLook(d, '2026-10-22', 'c1', 'ravi', 'neon');
    d = addLook(d, '2026-10-22', 'c1', 'ravi', 'comic');
    d = addLook(d, '2026-10-22', 'c2', 'joel', 'ink');
    d = addLook(d, '2026-10-22', 'c1', 'anu', 'not-a-look');
    expect(classCounts(d, '2026-10-22', 'c1')).toEqual({ neon: 2, comic: 1 });
    expect(classCounts(d, '2026-10-22', 'c1', 'anu')).toEqual({ neon: 1, comic: 1 });
    expect(classCounts(d, '2026-10-23', 'c1')).toEqual({});
    expect(addLook(d, '2026-10-23', 'c1', 'anu', 'ink').classes).toEqual({ c1: { anu: ['ink'] } });
  });
});

describe('V51.9.105 my colour', () => {
  it('colours the outline, the spoken word and the face ring on every look, readably; the maths keeps its colours', () => {
    for (const look of LOOKS) for (const a of ACCENTS) {
      const l = withAccent(look, a.id);
      expect(readability(l), `${look.id} + ${a.id}`).toEqual([]);
      expect(contrast(l.palette.teal, l.palette.paper)).toBeGreaterThanOrEqual(3);
      expect(l.palette.roles).toEqual(look.palette.roles);
      expect(l.id).toBe(look.id);
    }
    expect(withAccent(CLASSIC, null)).toBe(CLASSIC);
    expect(withAccent(CLASSIC, 'blue').palette.cap.now).not.toBe(CLASSIC.palette.cap.now);
  });
});
