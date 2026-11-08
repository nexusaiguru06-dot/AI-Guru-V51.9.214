import { describe, expect, it } from 'vitest';
import { drawMotionFrame, evalItem, type MotionScene } from '../reels/motion';
import { tokenWidth } from '../reels/motion/metrics';
import { selectDna } from './dna/registry';
import { buildDnaScenes } from './dna/builders';
import { SPX, SPMAX } from './dna/s-builders';
import { SOLID_OPS, approx, baseLines, hypot, netGeometry, num, piVal, polyArea, slantLines, solidFacts, solidGeometry, solidProblem, surfaceLines, triples, valNumber, valText, volumeLines } from './dna/s-math';
import type { BlockPlan, SolidPlan } from './dna/types';
import type { BookBlock } from './segment';
import { validatePlan } from './plan/validate';
import { offlinePlan, offlineSolid } from './plan/offline';
import { textOnlyWarning, visualStats } from './plan/visual-qa';
import { compileClass, segmentReel } from './class';
import { SOLID_CONE_SAMPLE, SOLID_CUBOID_SAMPLE, SOLID_CYLINDER_SAMPLE, SOLID_PRISM_SAMPLE, SOLID_SPHERE_SAMPLE } from './samples/solid-figure';

const block = (text: string, kind: BookBlock['kind'] = 'prose'): BookBlock => ({ id: 'b', kind, page: 1, chapterId: 'c', sectionId: 's', lines: [{ text, math: false } as BookBlock['lines'][number]], text });
const say = { en: 'x', ml: 'എ' };
const RD = { en: 'x', ml: 'എ' };
const ALL = [SOLID_CYLINDER_SAMPLE, SOLID_CONE_SAMPLE, SOLID_CUBOID_SAMPLE, SOLID_PRISM_SAMPLE, SOLID_SPHERE_SAMPLE];
const steps = (ops: string[]) => ops.map((op) => ({ op, say }) as SolidPlan['steps'][number]);
const full = (p: Omit<SolidPlan, 'steps'>): SolidPlan => ({ ...p, steps: steps(SOLID_OPS[p.solid]) });

const BOXES: SolidPlan[] = [];
for (let a = 2; a <= 20; a += 3) for (let b = 2; b <= 20; b += 3) for (let h = 2; h <= 20; h += 3) {
  const p = full({ solid: 'cuboid', a, b, h });
  if (!solidProblem(p, 'p')) BOXES.push(p);
}
const PRISMS: SolidPlan[] = [];
for (const [x, y] of triples(24)) for (const h of [2, 6, 11]) for (const [a, b] of [[x, y], [y, x]]) {
  const p = full({ solid: 'prism', a, b, h });
  if (!solidProblem(p, 'p')) PRISMS.push(p);
}
const CYLS: SolidPlan[] = [];
for (let r = 1; r <= 14; r++) for (let h = 2; h <= 30; h += 2) { const p = full({ solid: 'cylinder', r, h }); if (!solidProblem(p, 'p')) CYLS.push(p); }
const CONES: SolidPlan[] = [];
for (let r = 1; r <= 24; r++) for (let h = 1; h <= 24; h++) { const p = full({ solid: 'cone', r, h }); if (!solidProblem(p, 'p')) CONES.push(p); }
const SPHERES: SolidPlan[] = Array.from({ length: 15 }, (_, i) => full({ solid: 'sphere', r: i + 1 }));

describe('exact values', () => {
  it('rational multiples of π print and round correctly', () => {
    expect(valText(piVal(63))).toBe('63π');
    expect(valText(piVal(1))).toBe('π');
    expect(valText(piVal(16, 3))).toBe('{16/3} π');
    expect(valText(num(40))).toBe('40');
    expect(approx(piVal(63))).toBe('197.82');
    expect(approx(piVal(12))).toBe('37.68');
    expect(approx(piVal(60))).toBe('188.4');
    expect(approx(num(40))).toBe('40');
    for (let n = 1; n <= 400; n += 7) for (const d of [1, 3]) {
      const v = piVal(n, d);
      expect(Math.abs(Number(approx(v)) - (n / d) * 3.14), `${n}/${d}`).toBeLessThanOrEqual(0.0051);
    }
  });
  it('whole-number third sides', () => {
    expect(hypot(3, 4)).toBe(5);
    expect(hypot(5, 12)).toBe(13);
    expect(hypot(4, 5)).toBe(0);
    expect(triples(24).length).toBeGreaterThan(8);
    for (const [a, b, c] of triples(24)) expect(a * a + b * b).toBe(c * c);
  });
});

describe('volumes and surface areas are true, checked against other facts', () => {
  it('cuboid: volume, and the net area equals the surface area', () => {
    expect(BOXES.length).toBeGreaterThan(100);
    for (const p of BOXES) {
      const f = solidFacts(p);
      expect(valNumber(f.volume)).toBe(p.a! * p.b! * p.h!);
      const net = netGeometry(p)!;
      const flat = net.pieces.reduce((s, q) => s + polyArea(q.pts), 0) / (net.scale * net.scale);
      expect(flat, `${p.a} ${p.b} ${p.h}`).toBeCloseTo(valNumber(f.surface), 6);
      expect(f.pieces.reduce((s, q) => s + q.count * valNumber(q.area), 0)).toBe(valNumber(f.surface));
      expect(net.pieces.length).toBe(6);
    }
  });
  it('prism: base is the drawn triangle, volume is half the box, net area is the surface area', () => {
    expect(PRISMS.length).toBeGreaterThan(40);
    for (const p of PRISMS) {
      const f = solidFacts(p);
      const g = solidGeometry(p);
      const tri = polyArea([g.key.f0, g.key.f1, g.key.f2]) / (g.scale * g.scale); // the front face is not foreshortened
      expect(tri, `${p.a} ${p.b}`).toBeCloseTo(valNumber(f.base), 6);
      expect(valNumber(f.volume)).toBe((p.a! * p.b! * p.h!) / 2);
      const net = netGeometry(p)!;
      const flat = net.pieces.reduce((s, q) => s + polyArea(q.pts), 0) / (net.scale * net.scale);
      expect(flat, `${p.a} ${p.b} ${p.h}`).toBeCloseTo(valNumber(f.surface), 6);
      expect(f.slant * f.slant).toBe(p.a! * p.a! + p.b! * p.b!);
    }
  });
  it('cylinder: net rectangle is as long as the circle is round; areas add up', () => {
    for (const p of CYLS) {
      const f = solidFacts(p);
      const net = netGeometry(p)!;
      const rect = net.pieces.find((x) => x.id === 'rc')!;
      const xs = rect.pts.map((q) => q[0]);
      const width = (Math.max(...xs) - Math.min(...xs)) / net.scale;
      expect(width, `${p.r}`).toBeCloseTo(2 * Math.PI * p.r!, 6);
      const circ = net.pieces.find((x) => x.id === 'c1')!;
      let per = 0;
      for (let i = 0; i < circ.pts.length; i++) { const a = circ.pts[i]; const b = circ.pts[(i + 1) % circ.pts.length]; per += Math.hypot(a[0] - b[0], a[1] - b[1]); }
      expect(per / net.scale / width).toBeGreaterThan(0.998); // a 72-sided circle
      expect(per / net.scale / width).toBeLessThanOrEqual(1);
      const flat = net.pieces.reduce((s, q) => s + polyArea(q.pts), 0) / (net.scale * net.scale);
      expect(Math.abs(flat / valNumber(f.surface) - 1)).toBeLessThan(0.002);
      expect(valNumber(f.volume)).toBeCloseTo(Math.PI * p.r! * p.r! * p.h!, 8);
    }
  });
  it('cone: slant height, sector arc = circle round, volume is a third of the cylinder', () => {
    expect(CONES.length).toBeGreaterThan(10);
    for (const p of CONES) {
      const f = solidFacts(p);
      expect(f.slant * f.slant, `${p.r} ${p.h}`).toBe(p.r! * p.r! + p.h! * p.h!);
      expect(valNumber(f.volume)).toBeCloseTo((Math.PI * p.r! * p.r! * p.h!) / 3, 8);
      const net = netGeometry(p)!;
      const sec = net.pieces.find((x) => x.id === 'sec')!;
      const arc = sec.pts.slice(1);
      let len = 0;
      for (let i = 1; i < arc.length; i++) len += Math.hypot(arc[i][0] - arc[i - 1][0], arc[i][1] - arc[i - 1][1]);
      expect(Math.abs(len / net.scale / (2 * Math.PI * p.r!) - 1), `${p.r} ${p.h}`).toBeLessThan(0.002); // the arc is the circle's circumference
      expect(Math.hypot(arc[0][0] - sec.pts[0][0], arc[0][1] - sec.pts[0][1]) / net.scale).toBeCloseTo(f.slant, 6); // its radius is l
      const flat = net.pieces.reduce((s, q) => s + polyArea(q.pts), 0) / (net.scale * net.scale);
      expect(Math.abs(flat / valNumber(f.surface) - 1), `${p.r} ${p.h}`).toBeLessThan(0.004);
    }
  });
  it('sphere: Archimedes (⅔ of the cylinder around it), S is the cylinder wall, S = dV/dr', () => {
    for (const p of SPHERES) {
      const r = p.r!;
      const f = solidFacts(p);
      expect(valNumber(f.volume)).toBeCloseTo((2 / 3) * Math.PI * r * r * (2 * r), 8);
      expect(valNumber(f.surface)).toBeCloseTo(2 * Math.PI * r * (2 * r), 8);
      const dV = (v: number) => (4 / 3) * Math.PI * v * v * v;
      expect((dV(r + 1e-5) - dV(r - 1e-5)) / 2e-5).toBeCloseTo(valNumber(f.surface), 3);
      expect(netGeometry(p)).toBeNull();
    }
  });
});

describe('the pictures follow the sizes', () => {
  it('cuboid edges: lengths in proportion, depth along the oblique direction, hidden edges meet at one corner', () => {
    for (const p of BOXES.filter((_, i) => i % 5 === 0)) {
      const g = solidGeometry(p);
      const k = g.key;
      const len = (u: number[], v: number[]) => Math.hypot(u[0] - v[0], u[1] - v[1]);
      expect(len(k.f00, k.f10) / g.scale).toBeCloseTo(p.a!, 6);
      expect(len(k.f00, k.f01) / g.scale).toBeCloseTo(p.h!, 6);
      expect((k.b00[0] - k.f00[0]) / g.scale).toBeCloseTo(0.42 * p.b!, 6);
      expect((k.f00[1] - k.b00[1]) / g.scale).toBeCloseTo(0.35 * p.b!, 6);
      const hidden = g.edges.filter((e) => e.dashed);
      expect(hidden.length).toBe(3);
      for (const e of hidden) expect(e.pts.some((q) => q[0] === k.b00[0] && q[1] === k.b00[1]) || e.pts.some((q) => q[0] === k.f00[0] && q[1] === k.f00[1])).toBe(true);
      const xs = g.edges.flatMap((e) => e.pts.map((q) => q[0]));
      const ys = g.edges.flatMap((e) => e.pts.map((q) => q[1]));
      expect(Math.min(...xs)).toBeGreaterThan(40);
      expect(Math.max(...xs)).toBeLessThan(425);
      expect(Math.min(...ys)).toBeGreaterThan(110);
      expect(Math.max(...ys)).toBeLessThan(415);
    }
  });
  it('cylinder and cone: radius and height drawn to scale, inside the area', () => {
    for (const p of [...CYLS, ...CONES].filter((_, i) => i % 7 === 0)) {
      const g = solidGeometry(p);
      expect((g.key.botR[0] - g.key.botC[0]) / g.scale, `${p.solid} ${p.r} ${p.h}`).toBeCloseTo(p.r!, 6);
      expect((g.key.botC[1] - g.key.topC[1]) / g.scale).toBeCloseTo(p.h!, 6);
      const xs = g.edges.flatMap((e) => e.pts.map((q) => q[0]));
      const ys = g.edges.flatMap((e) => e.pts.map((q) => q[1]));
      expect(Math.min(...xs)).toBeGreaterThan(30);
      expect(Math.max(...xs)).toBeLessThan(425);
      expect(Math.min(...ys)).toBeGreaterThan(110);
      expect(Math.max(...ys)).toBeLessThan(415);
    }
  });
  it('nets fit the left of the board', () => {
    for (const p of [...BOXES.slice(0, 40), ...PRISMS.slice(0, 40), ...CYLS.filter((_, i) => i % 5 === 0), ...CONES]) {
      const net = netGeometry(p)!;
      for (const q of net.pieces) for (const [x, y] of q.pts) {
        expect(x).toBeGreaterThanOrEqual(29);
        expect(x).toBeLessThanOrEqual(411);
        expect(y).toBeGreaterThanOrEqual(129);
        expect(y).toBeLessThanOrEqual(406);
      }
    }
  });
});

describe('what is written', () => {
  const lines = (sc: MotionScene, k: number, title: boolean): string[] => {
    const time = sc.captions[k + (title ? 1 : 0)].t1 - 40;
    const vis = sc.items.filter((it) => it.kind === 'text').map((it) => evalItem(it, time)).filter((st) => st.alpha > 0.5 && st.x >= SPX - 4);
    const rows = new Map<number, Array<{ x: number; text: string }>>();
    for (const v of vis) { const key = Math.round(v.y); rows.set(key, [...(rows.get(key) ?? []), { x: v.x, text: v.text }]); }
    return [...rows.entries()].sort((a, b) => a[0] - b[0]).map(([, r]) => r.sort((a, b) => a.x - b.x).map((q) => q.text).join(' '));
  };
  const [cyl] = buildDnaScenes('solid-figure', SOLID_CYLINDER_SAMPLE, 'en', 'T');
  const [cone] = buildDnaScenes('solid-figure', SOLID_CONE_SAMPLE, 'en', 'T');
  const [box] = buildDnaScenes('solid-figure', SOLID_CUBOID_SAMPLE, 'en', 'T');
  const [pri] = buildDnaScenes('solid-figure', SOLID_PRISM_SAMPLE, 'en', 'T');
  const [sph] = buildDnaScenes('solid-figure', SOLID_SPHERE_SAMPLE, 'en', 'T');
  it('cylinder r = 3, h = 7', () => {
    expect(lines(cyl, 0, true)).toEqual(['r = 3 cm', 'h = 7 cm']);
    expect(lines(cyl, 1, true)).toEqual(['Base = π r^2', '= π × (3)^2', '= 9π cm^2']);
    expect(lines(cyl, 2, true)).toEqual(['V = π r^2 h', '= π × (3)^2 × 7', '= 63π cm^3', '≈ 197.82 cm^3']);
    expect(lines(cyl, 3, true)[0]).toBe('Two circles: 2 × 9π');
    expect(lines(cyl, 4, true)).toEqual(['S = 2π r^2 + 2π r h', '= 2π × (3)^2 + 2π × (3) × 7', '= 18π + 42π', '= 60π cm^2', '≈ 188.4 cm^2']);
  });
  it('cone r = 3, h = 4 → l = 5', () => {
    expect(lines(cone, 2, false)).toEqual(['l^2 = r^2 + h^2', 'l^2 = 3^2 + 4^2 = 25', 'l = 5 cm']);
    expect(lines(cone, 3, false)).toEqual(['V = {1/3} π r^2 h', '= {1/3} × π × (3)^2 × 4', '= 12π cm^3', '≈ 37.68 cm^3']);
    expect(lines(cone, 5, false)).toEqual(['S = π r^2 + π r l', '= π × (3)^2 + π × 3 × 5', '= 9π + 15π', '= 24π cm^2', '≈ 75.36 cm^2']);
  });
  it('cuboid 8 × 5 × 4 and prism 3-4-5 × 10', () => {
    expect(lines(box, 1, false)).toEqual(['Base = l × w', '= 8 × 5', '= 40 cm^2']);
    expect(lines(box, 2, false)).toEqual(['V = base × height', '= 40 × 4', '= 160 cm^3']);
    expect(lines(box, 4, false)).toEqual(['S = 2(l w + w h + l h)', '= 2(40 + 20 + 32)', '= 184 cm^2']);
    expect(lines(pri, 2, false)).toEqual(['c^2 = a^2 + b^2', 'c^2 = 3^2 + 4^2 = 25', 'c = 5 cm']);
    expect(lines(pri, 3, false)).toEqual(['V = base × height', '= 6 × 10', '= 60 cm^3']);
    expect(lines(pri, 5, false)).toEqual(['S = 2 × base + (a + b + c) × h', '= 2 × 6 + (3 + 4 + 5) × 10', '= 12 + 120', '= 132 cm^2']);
  });
  it('sphere r = 3', () => {
    expect(lines(sph, 1, false)).toEqual(['V = {4/3} π r^3', '= {4/3} × π × (3)^3', '= 36π cm^3', '≈ 113.04 cm^3']);
    expect(lines(sph, 2, false)).toEqual(['S = 4π r^2', '= 4 × π × (3)^2', '= 36π cm^2', '≈ 113.04 cm^2']);
  });
  it('every line of every solid agrees with the facts', () => {
    for (const p of [...BOXES.slice(0, 30), ...PRISMS.slice(0, 30), ...CYLS.slice(0, 30), ...CONES, ...SPHERES]) {
      const f = solidFacts(p);
      const s = surfaceLines(p).map((l) => l[0]).join('|');
      expect(s).toContain(`= ${valText(f.surface)} ${f.unit}^2`);
      const v = volumeLines(p, true).map((l) => l[0]).join('|');
      expect(v).toContain(`= ${valText(f.volume)} ${f.unit}^3`);
      if (p.solid !== 'sphere') expect(baseLines(p).map((l) => l[0]).join('|')).toContain(`= ${valText(f.base)} ${f.unit}^2`);
      if (p.solid === 'cone' || p.solid === 'prism') expect(slantLines(p).map((l) => l[0]).join('|')).toContain(`= ${f.slant} ${f.unit}`);
    }
  });
});

describe('validation', () => {
  const ok = (p: SolidPlan) => validatePlan('solid-figure', p, RD);
  it('the samples are valid', () => {
    for (const p of ALL) expect(ok(p), p.solid).toEqual([]);
  });
  it('sizes: ranges, whole numbers, drawable proportions, whole slant', () => {
    expect(solidProblem(full({ solid: 'cuboid', a: 1, b: 5, h: 4 }), 'p')).toMatch(/from 2 to 20/);
    expect(solidProblem(full({ solid: 'cuboid', a: 2, b: 20, h: 5 }), 'p')).toMatch(/too much/);
    expect(solidProblem(full({ solid: 'cuboid', a: 2.5, b: 5, h: 4 }), 'p')).toMatch(/whole number/);
    expect(solidProblem(full({ solid: 'prism', a: 4, b: 5, h: 6 }), 'p')).toMatch(/third side/);
    expect(solidProblem(full({ solid: 'cylinder', r: 3, h: 30 }), 'p')).toMatch(/differ too much/);
    expect(solidProblem(full({ solid: 'cylinder', r: 15, h: 10 }), 'p')).toMatch(/from 1 to 14/);
    expect(solidProblem(full({ solid: 'cone', r: 4, h: 5 }), 'p')).toMatch(/not a whole number/);
    expect(solidProblem(full({ solid: 'sphere', r: 16 }), 'p')).toMatch(/from 1 to 15/);
    expect(solidProblem(full({ solid: 'sphere', r: 3, unit: 'km' as 'cm' }), 'p')).toMatch(/unit/);
    expect(solidProblem({ solid: 'cube' as 'cuboid', steps: [] }, 'p')).toMatch(/solid must be/);
  });
  it('steps: belong to the solid, in an order that works', () => {
    const base = { solid: 'cone', r: 3, h: 4 } as const;
    expect(ok({ ...base, steps: steps(['volume']) }).join()).toMatch(/needs \{"op":"show"\}/);
    expect(ok({ ...base, steps: steps(['show', 'show']) }).join()).toMatch(/only once/);
    expect(ok({ ...base, steps: steps(['show', 'net']) }).join()).toMatch(/needs "slant"/);
    expect(ok({ ...base, steps: steps(['show', 'slant', 'net', 'volume']) }).join()).toMatch(/"volume" must come before it/);
    expect(ok({ ...base, steps: steps(['show', 'slant', 'surface', 'net']) }).join()).toMatch(/"net" must come before "surface"/);
    expect(ok({ ...base, steps: steps(['show', 'volume', 'base']) }).join()).toMatch(/"base" must come before "volume"/);
    expect(ok({ solid: 'sphere', r: 3, steps: steps(['show', 'net']) }).join()).toMatch(/not one of show, volume, surface/);
    expect(ok({ solid: 'cylinder', r: 3, h: 7, steps: steps(['show', 'slant']) }).join()).toMatch(/not one of/);
    expect(ok({ solid: 'cylinder', r: 3, h: 7, steps: [{ op: 'show', say: { en: '', ml: '' } }] }).join()).toMatch(/say is required/);
    expect(ok({ solid: 'cylinder', r: 3, h: 7, steps: [] }).join()).toMatch(/steps must list/);
    expect(ok({ solid: 'cylinder', r: 3, h: 7, steps: steps(['show', 'volume']) })).toEqual([]);
    expect(ok({ solid: 'cone', r: 3, h: 4, steps: steps(['show', 'volume']) })).toEqual([]);
  });
});

describe('selection', () => {
  const pick = (text: string, kind: BookBlock['kind'] = 'prose') => selectDna(block(text, kind)).dna;
  it('solid talk → solid-figure', () => {
    expect(pick('The volume of a cylinder is π r² h.')).toBe('solid-figure');
    expect(pick('The curved surface area of a cone is π r l, where l is the slant height.')).toBe('solid-figure');
    expect(pick('Find the volume of a cuboid of length 8 cm, width 5 cm and height 4 cm.', 'exercise')).toBe('solid-figure');
    expect(pick('The surface area of a sphere is 4π r².')).toBe('solid-figure');
    expect(pick('A cylindrical tank has radius 3 m and height 7 m. How much water does it hold?', 'problem')).toBe('solid-figure');
    expect(pick('The net of a triangular prism has two triangles and three rectangles.')).toBe('solid-figure');
  });
  it('the same words elsewhere stay elsewhere', () => {
    expect(pick('Find the area of a circle of radius 5 cm.', 'exercise')).not.toBe('solid-figure');
    expect(pick('The circumference of a circle is 2π r.')).not.toBe('solid-figure');
    expect(pick('The sum of the angles of a triangle is 180°.')).toBe('angle-geometry');
    expect(pick('Solve x² − 5x + 6 = 0 by factorising.', 'exercise')).toBe('quadratic-equation');
    expect(pick('The sine of 30° is 1/2 and the cosine is √3/2.')).toBe('unit-circle');
    expect(pick('Draw a triangle whose sides are 3 cm, 4 cm and 5 cm.')).not.toBe('solid-figure');
  });
});

describe('offline planner', () => {
  it('cylinder, cone, sphere, cuboid and prism from the words and numbers', () => {
    const c = offlineSolid('A cylinder has radius 3 cm and height 7 cm. Find its volume and surface area.')!;
    expect(c).toMatchObject({ solid: 'cylinder', r: 3, h: 7 });
    expect(c.steps.map((x) => x.op)).toEqual(['show', 'base', 'volume', 'net', 'surface']);
    expect(validatePlan('solid-figure', c, RD)).toEqual([]);
    const k = offlineSolid('A cone has radius 3 cm and height 4 cm. Find its volume.')!;
    expect(k.steps.map((x) => x.op)).toEqual(['show', 'base', 'slant', 'volume']);
    expect(validatePlan('solid-figure', k, RD)).toEqual([]);
    const s = offlineSolid('Find the surface area of a sphere of radius 3 cm.')!;
    expect(s.steps.map((x) => x.op)).toEqual(['show', 'surface']);
    expect(validatePlan('solid-figure', s, RD)).toEqual([]);
    const b = offlineSolid('A box has length 8 cm, breadth 5 cm and height 4 cm. Find the volume.')!;
    expect(b).toMatchObject({ solid: 'cuboid', a: 8, b: 5, h: 4 });
    expect(validatePlan('solid-figure', b, RD)).toEqual([]);
    const p = offlineSolid('A prism is 10 cm long and its end is a right triangle with sides 3 cm, 4 cm and 5 cm. Find the surface area.')!;
    expect(p).toMatchObject({ solid: 'prism', a: 3, b: 4, h: 10 });
    expect(p.steps.map((x) => x.op)).toEqual(['show', 'base', 'slant', 'net', 'surface']);
    expect(validatePlan('solid-figure', p, RD)).toEqual([]);
  });
  it('null when the sizes do not fit', () => {
    expect(offlineSolid('A cone has radius 4 cm and height 5 cm.')).toBeNull();
    expect(offlineSolid('A cylinder holds water.')).toBeNull();
    expect(offlineSolid('A cuboid has length 8 cm.')).toBeNull();
    expect(offlineSolid('Find the area of a circle.')).toBeNull();
  });
  it('falls back with a warning when there are no sizes', () => {
    const pl = offlinePlan(block('The volume of a cylinder depends on its radius and height.'), '', '');
    expect(pl.dna).toBe('concept-board');
    expect(pl.warnings?.join()).toMatch(/AI planner needed/);
    expect(offlinePlan(block('A cylinder has radius 3 cm and height 7 cm. Find its volume.', 'exercise'), '', '').dna).toBe('solid-figure');
  });
});

describe('picture and class', () => {
  it('samples are real pictures', () => {
    for (const teach of ALL) {
      expect(textOnlyWarning({ dna: 'solid-figure', teach })).toBeUndefined();
      expect(visualStats(buildDnaScenes('solid-figure', teach, 'en', 'T')).graphics).toBeGreaterThanOrEqual(5);
    }
  });
  it('compiles into a class with one caption per step', () => {
    for (const teach of ALL) {
      const plan: BlockPlan = { blockId: 'b', dna: 'solid-figure', read: RD, teach, source: 'fixture' };
      const segs = compileClass([block('Solids.')], new Map([['b', plan]]), { title: 'T' });
      for (const seg of segs.filter((x) => x.phase === 'teach')) expect(segmentReel(seg).parts[0].captions.length).toBe(teach.steps.length + (teach.title ? 1 : 0));
    }
  });
  it('draws without error in every format and theme', () => {
    const noop = new Proxy({}, { get: (_t, k) => (k === 'measureText' ? (x: string) => ({ width: x.length * 10 }) : () => undefined), set: () => true }) as unknown as CanvasRenderingContext2D;
    for (const teach of ALL) {
      const sc = buildDnaScenes('solid-figure', teach, 'ml', 'T')[0];
      for (const format of ['landscape', 'vertical', 'square'] as const) for (const theme of ['light', 'dark'] as const) for (const f of [0.1, 0.4, 0.7, 0.99]) drawMotionFrame(noop, sc, sc.durationMs * f, { format, theme } as never);
    }
  });
  it('nothing overlaps or leaves its area', () => {
    for (const teach of ALL) {
      const sc = buildDnaScenes('solid-figure', teach, 'en', 'T')[0];
      for (let k = 0; k < sc.captions.length; k++) {
        const time = sc.captions[k].t1 - 40;
        const st = sc.items.filter((it) => it.kind === 'text').map((it) => evalItem(it, time)).filter((s) => s.alpha > 0.5).map((q) => {
          const w = tokenWidth(q.text, q.size);
          return { q, l: q.x - w / 2, r: q.x + w / 2 };
        });
        for (const b of st) {
          expect(b.l, b.q.text).toBeGreaterThan(2);
          expect(b.r, b.q.text).toBeLessThan(718);
          if (b.l > SPX - 4) expect(b.r, `${teach.solid} ${b.q.text}`).toBeLessThanOrEqual(SPX + SPMAX + 1);
        }
        for (let i = 0; i < st.length; i++) for (let j = i + 1; j < st.length; j++) {
          if (Math.abs(st[i].q.y - st[j].q.y) > 14) continue;
          const gap = Math.max(st[i].l, st[j].l) - Math.min(st[i].r, st[j].r);
          expect(gap, `${teach.solid} ${st[i].q.text} / ${st[j].q.text} at step ${k}`).toBeGreaterThanOrEqual(-1e-6);
        }
      }
    }
  });
  it('English and Malayalam pictures are identical; only captions differ', () => {
    const en = buildDnaScenes('solid-figure', SOLID_CONE_SAMPLE, 'en', 'T')[0];
    const ml = buildDnaScenes('solid-figure', SOLID_CONE_SAMPLE, 'ml', 'T')[0];
    expect(ml.items.map((it) => `${it.id}:${it.kind}:${it.text}`)).toEqual(en.items.map((it) => `${it.id}:${it.kind}:${it.text}`));
    expect(ml.captions.map((x) => x.text)).not.toEqual(en.captions.map((x) => x.text));
  });
  it('builds and validates every solid in range', { timeout: 120000 }, () => {
    for (const p of [...BOXES.filter((_, i) => i % 6 === 0), ...PRISMS.filter((_, i) => i % 4 === 0), ...CYLS.filter((_, i) => i % 9 === 0), ...CONES, ...SPHERES]) {
      expect(validatePlan('solid-figure', p, RD), `${p.solid} ${p.a} ${p.b} ${p.h} ${p.r}`).toEqual([]);
      expect(() => buildDnaScenes('solid-figure', p, 'en', 'T')).not.toThrow();
    }
  });
});
