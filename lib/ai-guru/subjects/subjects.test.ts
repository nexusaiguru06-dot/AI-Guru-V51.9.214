import { describe, it, expect } from 'vitest';
import { AGENTS, planSubjects, compileMixed } from './index';
import { compileClass } from '../motion-class/class';
import { parseFormula, solveCoefficients, balanceFacts } from './agents/chemistry/balance-equation';
import { runSort } from './agents/computer-science/array-sort';
import { chainEnergy, CHAIN_EXAMPLE } from './agents/biology/food-chain';
import { netForces, FORCE_EXAMPLE } from './agents/physics/force-diagram';
import type { BookBlock } from '../motion-class/segment';
import type { BlockPlan } from '../motion-class/dna/types';

const blk = (id: string, text: string, kind: BookBlock['kind'] = 'paragraph'): BookBlock => ({ id, text, kind } as BookBlock);
const ctx = { chapterTitle: 'Science', sectionTitle: 'Test' };

describe('subject agents', () => {
  for (const a of AGENTS) for (const t of a.templates) {
    it(`${a.id}/${t.id}: example validates and builds en+ml`, () => {
      expect(t.validate(t.example)).toEqual([]);
      for (const l of ['en', 'ml'] as const) {
        const s = t.build(t.example, l, 'T');
        expect(s.length).toBeGreaterThan(0);
      }
    });
  }
  it('chemistry balances CH4 + O2', () => {
    const f = balanceFacts({ reactants: ['CH4', 'O2'], products: ['CO2', 'H2O'], steps: [] });
    expect(f.coef).toEqual([1, 2, 1, 2]);
    expect(parseFormula('Ca(OH)2')!.get('O')).toBe(2);
    expect(solveCoefficients([parseFormula('H2')!, parseFormula('O2')!], [parseFormula('H2O')!])).toEqual([2, 1, 2]);
  });
  it('sort and chain and force are computed', () => {
    expect(runSort('bubble', [3, 1, 2]).sorted).toEqual([1, 2, 3]);
    expect(runSort('insertion', [5, 2, 8, 1]).sorted).toEqual([1, 2, 5, 8]);
    expect(chainEnergy(CHAIN_EXAMPLE)).toEqual([10000, 1000, 100, 10]);
    expect(netForces(FORCE_EXAMPLE)).toBeTruthy();
  });
  it('routes blocks to the right agent and leaves maths alone', async () => {
    const blocks = [
      blk('a', 'In the reaction CH4 + O2 → CO2 + H2O the reactants form products. Balance the equation.'),
      blk('b', 'A 5 kg block is pushed with a force of 20 N against friction of 5 N.'),
      blk('c', 'Sort the list 5, 2, 8, 1, 4 using bubble sort. The algorithm compares neighbours.'),
      blk('d', 'Solve 2x + 3 = 11 for x.'),
      blk('e', '2x + 3 = 11', 'math'),
    ];
    const plans = await planSubjects(blocks, ctx);
    expect(plans.get('a')?.agent).toBe('chemistry');
    expect(plans.get('b')?.agent).toBe('physics');
    expect(plans.get('c')?.agent).toBe('computer-science');
    expect(plans.has('d')).toBe(false);
    expect(plans.has('e')).toBe(false);
  });
  it('a failing llm falls back to the text; garbage never throws', async () => {
    const events: string[] = [];
    const plans = await planSubjects([blk('a', 'CH4 + O2 → CO2 + H2O is the burning of methane in a reaction.')], ctx, { llm: async () => 'nonsense', onEvent: (e) => events.push(e.stage) });
    expect(plans.get('a')?.source).toBe('text');
    expect(events).toContain('fallback');
  });
  it('with no subject plans compileMixed equals compileClass', () => {
    const b = [blk('d', 'Solve 2x + 3 = 11 for x.')];
    const p = new Map<string, BlockPlan>();
    expect(compileMixed(b, p, new Map(), { title: 'T' }).length).toBe(compileClass(b, p, { title: 'T' }).length);
  });
});

describe('geography templates', () => {
  it('cycle / orbit / latlong examples are computed correctly', async () => {
    const { stagePos } = await import('./agents/earth/cycle');
    const { daysPerQuarter, degPerDay } = await import('./agents/earth/orbit');
    const { minutesFromGreenwich, clockDiff, gx, gy } = await import('./agents/earth/latlong');
    expect(stagePos(0, 4)[1]).toBeLessThan(stagePos(2, 4)[1]);
    expect(daysPerQuarter()).toBe(91.3);
    expect(degPerDay()).toBe(0.99);
    expect(minutesFromGreenwich(76)).toBe(304);
    expect(clockDiff(76)).toBe('5 h 4 min ahead of Greenwich');
    expect(clockDiff(-75)).toBe('5 h 0 min behind Greenwich');
    expect(clockDiff(0)).toBe('same as Greenwich');
    expect(gx(0)).toBe(360);
    expect(gy(0)).toBe(290);
  });
  it('validators reject bad plans', async () => {
    const { validateCycle } = await import('./agents/earth/cycle');
    const { validateOrbit } = await import('./agents/earth/orbit');
    const { validateLatLong, LATLONG_EXAMPLE } = await import('./agents/earth/latlong');
    expect(validateCycle({ stages: [], steps: [] }).length).toBeGreaterThan(0);
    expect(validateOrbit({ places: [1, 2] }).length).toBeGreaterThan(0);
    expect(validateLatLong({ ...LATLONG_EXAMPLE, places: [{ name: LATLONG_EXAMPLE.places[0].name, lat: 120, lon: 0 }] }).length).toBeGreaterThan(0);
  });
  it('reads each topic straight from the text', async () => {
    const earth = AGENTS.find((a) => a.id === 'earth')!;
    const t = (s: string) => earth.fromText(blk('g', s), ctx);
    expect(t('Evaporation and condensation drive the water cycle.')?.template).toBe('cycle');
    expect(t('The rock cycle changes igneous rock into sedimentary rock.')?.template).toBe('cycle');
    expect(t('Seasons occur because the Earth axis has a tilt as it goes in orbit.')?.template).toBe('orbit');
    const ll = t('Kochi lies at 10° N, 76° E on the map.');
    expect(ll?.template).toBe('latlong');
    expect((ll!.teach as { places: Array<{ lat: number; lon: number }> }).places[0]).toMatchObject({ lat: 10, lon: 76 });
    expect(t('Parallels of latitude and meridians of longitude form the grid.')?.template).toBe('latlong');
    expect(t('The crust, mantle and core are layers of the Earth.')?.template).toBe('layers');
  });
  it('routes a geography block to the earth agent and builds scenes', async () => {
    const plans = await planSubjects([blk('w', 'In the water cycle, evaporation lifts water as vapour and condensation forms clouds before precipitation.')], ctx);
    expect(plans.get('w')?.agent).toBe('earth');
    expect(plans.get('w')?.template).toBe('cycle');
  });
});

describe('geography templates, second set', () => {
  it('computes drift, wind direction, slope and ground distance', async () => {
    const { driftKm } = await import('./agents/earth/plates');
    const { windFrom, tempGap } = await import('./agents/earth/monsoon');
    const { slope, steepest, RIVER_EXAMPLE } = await import('./agents/earth/river');
    const { groundKm, kmPerCm } = await import('./agents/earth/mapscale');
    expect(driftKm(5)).toBe(50);
    expect(driftKm(2.5)).toBe(25);
    expect(windFrom({ landTemp: 42, seaTemp: 28 })).toBe('sea');
    expect(windFrom({ landTemp: 16, seaTemp: 26 })).toBe('land');
    expect(tempGap({ landTemp: 42, seaTemp: 28 })).toBe(14);
    expect(slope(RIVER_EXAMPLE.courses[0])).toBe(24);
    expect(slope(RIVER_EXAMPLE.courses[2])).toBeCloseTo(0.1667, 3);
    expect(steepest(RIVER_EXAMPLE)).toBe(0);
    expect(kmPerCm(50000)).toBe(0.5);
    expect(groundKm({ denominator: 50000, mapCm: 6 })).toBe(3);
    expect(groundKm({ denominator: 250000, mapCm: 4.4 })).toBe(11);
  });
  it('validators reject bad plans', async () => {
    const { validatePlates, PLATES_EXAMPLE } = await import('./agents/earth/plates');
    const { validateMonsoon, SUMMER_MONSOON } = await import('./agents/earth/monsoon');
    const { validateRiver, RIVER_EXAMPLE } = await import('./agents/earth/river');
    const { validateMapScale, MAPSCALE_EXAMPLE } = await import('./agents/earth/mapscale');
    expect(validatePlates({ ...PLATES_EXAMPLE, boundary: 'sideways' }).length).toBeGreaterThan(0);
    expect(validatePlates({ ...PLATES_EXAMPLE, rate: 99 }).length).toBeGreaterThan(0);
    expect(validateMonsoon({ ...SUMMER_MONSOON, seaTemp: 42 }).length).toBeGreaterThan(0);
    const bad = { ...RIVER_EXAMPLE, courses: [RIVER_EXAMPLE.courses[0], { ...RIVER_EXAMPLE.courses[1], startM: 500 }] };
    expect(validateRiver(bad).some((x) => x.includes('previous endM'))).toBe(true);
    expect(validateMapScale({ ...MAPSCALE_EXAMPLE, mapCm: 50 }).length).toBeGreaterThan(0);
  });
  it('reads each topic straight from the text', () => {
    const earth = AGENTS.find((a) => a.id === 'earth')!;
    const t = (s: string) => earth.fromText(blk('g', s), ctx);
    const p = t('At a divergent boundary the plates move apart.');
    expect(p?.template).toBe('plates');
    expect((p!.teach as { boundary: string }).boundary).toBe('divergent');
    expect((t('The San Andreas fault is a transform boundary.')!.teach as { boundary: string }).boundary).toBe('transform');
    expect(t('Plate tectonics explains continental drift.')?.template).toBe('plates');
    expect(t('The summer monsoon brings rain to Kerala.')?.template).toBe('monsoon');
    expect((t('During the north-east monsoon in winter the wind blows from land.')!.teach as { landTemp: number }).landTemp).toBe(16);
    expect(t('In its lower course the river forms a delta.')?.template).toBe('river');
    const sc = t('On a map with scale 1 : 250,000 two towns are 4.4 cm apart.');
    expect(sc?.template).toBe('mapscale');
    expect(sc!.teach).toMatchObject({ denominator: 250000, mapCm: 4.4 });
  });
  it('routes blocks to the earth agent', async () => {
    const plans = await planSubjects([
      blk('a', 'Plate tectonics says the crust is split into plates; at a convergent boundary plates collide.'),
      blk('b', 'The monsoon is a seasonal wind; in summer land heats faster than the sea.'),
      blk('c', 'The map scale tells how many centimetres on the ground one centimetre on the map stands for.'),
    ], ctx);
    expect(plans.get('a')?.template).toBe('plates');
    expect(plans.get('b')?.template).toBe('monsoon');
    expect(plans.get('c')?.template).toBe('mapscale');
    expect(['a', 'b', 'c'].every((k) => plans.get(k)?.agent === 'earth')).toBe(true);
  });
});

describe('chemistry V51.9.147: exact balancer, periodic table, molar mass', async () => {
  const { solveCoefficients: solve } = await import('./agents/chemistry/balance-equation');
  const { findElement, shells, valencyOf, fullConfig, ELEMENTS } = await import('./agents/chemistry/elements');
  const { massFacts } = await import('./agents/chemistry/molar-mass');
  const { validateTable } = await import('./agents/chemistry/periodic-table');
  const eq = (s: string) => s.split('=').map((side) => side.split('+').map((x) => parseFormula(x.trim())!)) as [Array<Map<string, number>>, Array<Map<string, number>>];
  it('balances big equations exactly (test equations of kongnet/chem)', () => {
    expect(solve(...eq('KMnO4 + HCl = KCl + MnCl2 + H2O + Cl2'))).toEqual([2, 16, 2, 2, 8, 5]);
    expect(solve(...eq('K4FeC6N6 + KMnO4 + H2SO4 = KHSO4 + Fe2S3O12 + MnSO4 + HNO3 + CO2 + H2O'))).toEqual([10, 122, 299, 162, 5, 122, 60, 60, 188]);
    expect(solve(...eq('C + O2 = CO + CO2'))).toBeNull(); // two independent ways
    expect(solve(...eq('H2 = O2'))).toBeNull();
  });
  it('element facts are computed', () => {
    const na = findElement('sodium')!;
    expect([na.z, na.group, na.period]).toEqual([11, 1, 3]);
    expect(shells(na)).toEqual([2, 8, 1]);
    expect(fullConfig(findElement('Cl')!)).toBe('1s² 2s² 2p⁶ 3s² 3p⁵');
    expect(valencyOf(findElement('O')!)).toEqual({ valence: 6, valency: 2, gains: true });
    expect(valencyOf(findElement('Fe')!)).toBeNull();
    for (const e of ELEMENTS) expect(shells(e).reduce((a, b) => a + b, 0)).toBe(e.z);
    expect(validateTable({ element: 'Fe', steps: [{ op: 'show', say: { en: 'x', ml: 'x' } }, { op: 'valency', say: { en: 'x', ml: 'x' } }] })).toHaveLength(1);
  });
  it('molar mass and moles use school masses', () => {
    const f = massFacts({ formula: 'H2SO4', massG: 49, steps: [] });
    expect(f.M).toBe(98);
    expect(f.moles).toBe(0.5);
    expect(massFacts({ formula: 'NaCl', steps: [] }).M).toBe(58.5);
    expect(massFacts({ formula: 'Ca(OH)2', steps: [] }).M).toBe(74);
  });
  it('reads chemistry problems from the text without AI', async () => {
    const plans = await planSubjects([
      blk('m', 'Calculate the gram molecular mass of H2SO4. How many moles are present in 49 g of H2SO4?'),
      blk('p', 'Write the electronic configuration of sodium and find its position in the periodic table. What is its valency?'),
      blk('k', 'Balance the equation KMnO4 + HCl → KCl + MnCl2 + H2O + Cl2 in this reaction.'),
    ], ctx);
    expect(plans.get('m')?.template).toBe('molar-mass');
    expect(plans.get('p')?.template).toBe('periodic-table');
    expect(plans.get('k')?.template).toBe('balance-equation');
  });
});

describe('physics V51.9.148: projectile, pendulum, wave, circuit, optics', async () => {
  const { projFacts } = await import('./agents/physics/projectile');
  const { pendFacts } = await import('./agents/physics/pendulum');
  const { waveFacts } = await import('./agents/physics/wave');
  const { circuitFacts } = await import('./agents/physics/circuit');
  const { opticsFacts, validateOptics, OPTICS_EXAMPLE } = await import('./agents/physics/optics');
  it('computes the numbers', () => {
    expect(projFacts({ u: 20, angle: 30, steps: [] })).toMatchObject({ ux: 17.32, uy: 10, T: 2, H: 5, R: 34.64 });
    expect(pendFacts({ lengthM: 1, steps: [] }).T).toBe(1.99);
    expect(pendFacts({ lengthM: 1, g: 9.8, steps: [] }).T).toBe(2.01);
    expect(waveFacts({ f: 500, lambda: 0.68, steps: [] }).v).toBe(340);
    expect(waveFacts({ v: 340, f: 170, steps: [] }).lambda).toBe(2);
    expect(circuitFacts({ voltage: 12, resistors: [2, 4], connection: 'series', steps: [] })).toMatchObject({ R: 6, I: 2, share: [4, 8], P: 24 });
    expect(circuitFacts({ voltage: 12, resistors: [3, 6], connection: 'parallel', steps: [] })).toMatchObject({ R: 2, I: 6, share: [4, 2] });
  });
  it('lens and mirror formulas with the sign convention', () => {
    expect(opticsFacts({ kind: 'convex-lens', focalCm: 10, objectCm: 30, steps: [] })).toMatchObject({ v: 15, m: -0.5, real: true, erect: false });
    expect(opticsFacts({ kind: 'convex-lens', focalCm: 10, objectCm: 5, steps: [] })).toMatchObject({ v: -10, m: 2, real: false, erect: true });
    expect(opticsFacts({ kind: 'concave-lens', focalCm: 15, objectCm: 30, steps: [] })).toMatchObject({ v: -10, real: false, erect: true });
    expect(opticsFacts({ kind: 'concave-mirror', focalCm: 15, objectCm: 30, steps: [] })).toMatchObject({ v: -30, m: -1, real: true, same: true });
    expect(opticsFacts({ kind: 'convex-mirror', focalCm: 15, objectCm: 30, steps: [] })).toMatchObject({ v: 10, real: false, erect: true });
    expect(validateOptics({ ...OPTICS_EXAMPLE, objectCm: 10 })).not.toEqual([]); // object at F
  });
  it('reads physics problems from the text without AI', async () => {
    const plans = await planSubjects([
      blk('o', 'An object is placed 30 cm in front of a convex lens of focal length 10 cm. Find the position of the image and the magnification.'),
      blk('c', 'Two resistors of 3 ohm and 6 ohm are connected in parallel to a 12 V battery. Find the current.'),
      blk('w', 'A sound wave has a frequency of 500 Hz and a wavelength of 0.68 m. Find the speed of the wave.'),
      blk('p', 'A simple pendulum of length 1 m oscillates. Find its time period.'),
      blk('j', 'A ball is projected with a velocity of 20 m/s at an angle of 30 degrees with the horizontal. Find its range.'),
    ], ctx);
    expect(plans.get('o')?.template).toBe('optics');
    expect(plans.get('c')?.template).toBe('circuit');
    expect(plans.get('w')?.template).toBe('wave');
    expect(plans.get('p')?.template).toBe('pendulum');
    expect(plans.get('j')?.template).toBe('projectile');
  });
});

describe('V51.9.149: biology, social, economics, English', async () => {
  const { punnettFacts, gametes } = await import('./agents/biology/punnett');
  const { yearsBetween, centuryOf } = await import('./agents/social/timeline');
  const { distanceKm } = await import('./agents/social/places');
  const { sdFacts } = await import('./agents/economics/supply-demand');
  const { flowFacts } = await import('./agents/economics/circular-flow');
  const { sentenceFacts, validateSentence, SENTENCE_EXAMPLE } = await import('./agents/english/sentence');
  const { splitSentence } = await import('./agents/english');
  const tr = (L: string) => ({ letter: L, dominant: { en: 'd', ml: 'd' }, recessive: { en: 'r', ml: 'r' } });
  it('Punnett squares give Mendel’s ratios', () => {
    expect(gametes('RrYy')).toEqual(['RY', 'Ry', 'rY', 'ry']);
    expect(punnettFacts({ traits: [tr('T')], parent1: 'Tt', parent2: 'Tt', steps: [] }).pheno.map(([, n]) => n)).toEqual([3, 1]);
    expect(punnettFacts({ traits: [tr('T')], parent1: 'Tt', parent2: 'Tt', steps: [] }).geno).toEqual([['Tt', 2], ['TT', 1], ['tt', 1]]);
    expect(punnettFacts({ traits: [tr('R'), tr('Y')], parent1: 'RrYy', parent2: 'RrYy', steps: [] }).pheno.map(([, n]) => n)).toEqual([9, 3, 3, 1]);
    expect(punnettFacts({ traits: [tr('T')], parent1: 'Tt', parent2: 'tt', steps: [] }).pheno.map(([, n]) => n)).toEqual([1, 1]);
  });
  it('years, centuries and distances', () => {
    expect(yearsBetween(1857, 1947)).toBe(90);
    expect(yearsBetween(-50, 50)).toBe(99);
    expect([centuryOf(1857), centuryOf(1900), centuryOf(1901), centuryOf(-326)]).toEqual([19, 19, 20, 4]);
    const d = distanceKm({ lat: 11.25, lon: 75.78 }, { lat: 9.93, lon: 76.27 }); // Kozhikode – Kochi
    expect(d).toBeGreaterThan(140); expect(d).toBeLessThan(170);
  });
  it('equilibrium, shifts and saving', () => {
    expect(sdFacts({ demand: { a: 100, b: 2 }, supply: { c: 10, d: 1 }, shift: { curve: 'demand', by: 30 }, steps: [] })).toEqual({ e1: { P: 30, Q: 40 }, e2: { P: 40, Q: 50 } });
    expect(flowFacts({ income: 1000, consumption: 750, tax: 100, steps: [] })).toEqual({ disposable: 900, saving: 150 });
  });
  it('sentence parts, pattern and kind', () => {
    expect(validateSentence(SENTENCE_EXAMPLE)).toEqual([]);
    expect(sentenceFacts(SENTENCE_EXAMPLE).pattern).toBe('S + V + O + A + A');
    expect(validateSentence({ ...SENTENCE_EXAMPLE, parts: SENTENCE_EXAMPLE.parts.slice(1) })).not.toEqual([]);
    expect(splitSentence('My mother is a teacher.')?.map((p) => p.role)).toEqual(['subject', 'verb', 'complement']);
    expect(splitSentence('The children played football in the park.')?.map((p) => p.role)).toEqual(['subject', 'verb', 'object', 'adverbial']);
    expect(splitSentence('Close the door.')?.map((p) => p.role)).toEqual(['verb', 'object']);
  });
  it('routes blocks to the new agents without AI, and leaves maths alone', async () => {
    const plans = await planSubjects([
      blk('b1', 'Mendel crossed pure tall and dwarf pea plants. In the F2 generation the cross Tt × Tt gave tall and dwarf plants. T for tall, t for dwarf.'),
      blk('b2', 'A plant cell has a cell wall, a cell membrane, a nucleus, chloroplasts and a large vacuole.'),
      blk('h1', 'The revolt of 1857 shook the British rule. In 1885 the Indian National Congress was formed. In 1947 India won independence after a long freedom struggle.'),
      blk('h2', 'Vasco da Gama sailed from Lisbon and reached Kozhikode on the coast of Kerala, opening a sea route for trade.'),
      blk('e1', 'If the demand is Qd = 100 − 2P and supply is Qs = 10 + P, find the equilibrium price in the market.'),
      blk('g1', 'Identify the subject, verb and object in the sentence "The children played football in the park."'),
      blk('m1', 'A shopkeeper bought 20 pens at a price of ₹15 each in 2019. Find the total cost.'),
    ], ctx);
    expect(plans.get('b1')?.template).toBe('punnett');
    expect(plans.get('b2')?.template).toBe('cell');
    expect(plans.get('h1')?.template).toBe('timeline');
    expect(plans.get('h2')?.template).toBe('places');
    expect(plans.get('e1')?.template).toBe('supply-demand');
    expect(plans.get('g1')?.template).toBe('sentence');
    expect(plans.has('m1')).toBe(false);
  });
});
