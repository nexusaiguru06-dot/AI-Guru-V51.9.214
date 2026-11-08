import { describe, it, expect } from 'vitest';
import { SOLID_INFO, facts3d, sectionAt } from './solids3d';
import { ELEMENTS, MOLECULES, PLANETS, bondAngle, orbitAngle, orbitRadius, shellsOf } from './science3d';

describe('solids 3-D numbers (same as the Solids DNA)', () => {
  it('cuboid, cylinder, cone, sphere facts', () => {
    expect(facts3d('cuboid', { a: 6, b: 4, h: 3 })).toMatchObject({ volume: '72', surface: '108' });
    const cy = facts3d('cylinder', { r: 3, h: 8 });
    expect(cy.volume).toContain('72'); expect(cy.volumeApprox).toBeTruthy();
    expect(facts3d('cone', { r: 3, h: 4 }).slant).toBe(5);
    expect(facts3d('sphere', { r: 4 }).problem).toBeNull();
  });
  it('rejects sizes that cannot be drawn', () => { expect(facts3d('cuboid', { a: 99, b: 4, h: 3 }).problem).toBeTruthy(); });
  it('every default size is valid', () => { for (const [k, i] of Object.entries(SOLID_INFO)) expect(facts3d(k as any, i.defaults).problem, k).toBeNull(); });
  it('sections: cone shrinks to a point, sphere is biggest in the middle', () => {
    const c = (t: number) => sectionAt('cone', { r: 3, h: 4 }, t);
    expect(c(0).area).toBeGreaterThan(c(0.5).area); expect(c(1).shape).toBe('point');
    const s = (t: number) => sectionAt('sphere', { r: 4 }, t).area;
    expect(s(0.5)).toBeGreaterThan(s(0.25)); expect(s(0.5)).toBeCloseTo(Math.PI * 16, 0);
    expect(sectionAt('prism', { a: 4, b: 3, h: 8 }, 0.5).area).toBe(16);
    expect(sectionAt('cuboid', { a: 6, b: 4, h: 3 }, 0.3).area).toBe(24);
  });
});

describe('science 3-D data', () => {
  it('shells follow 2-8-8-2 and add up to the atomic number', () => {
    expect(shellsOf(8)).toEqual([2, 6]); expect(shellsOf(17)).toEqual([2, 8, 7]); expect(shellsOf(19)).toEqual([2, 8, 8, 1]); expect(shellsOf(20)).toEqual([2, 8, 8, 2]);
    for (const e of ELEMENTS) expect(e.shells.reduce((a, b) => a + b, 0)).toBe(e.z);
    expect(ELEMENTS).toHaveLength(20); expect(new Set(ELEMENTS.map((e) => e.symbol)).size).toBe(20);
  });
  it('molecule geometry matches the stated angles', () => {
    const m = (id: string) => MOLECULES.find((x) => x.id === id)!;
    expect(bondAngle(m('h2o'))).toBeCloseTo(104.5, 1);
    expect(bondAngle(m('co2'))).toBeCloseTo(180, 1);
    expect(bondAngle(m('ch4'), 0, 1, 2)).toBeCloseTo(109.47, 1);
    expect(bondAngle(m('nh3'))).toBeCloseTo(107, 1);
    for (const x of MOLECULES) for (const b of x.bonds) { expect(b.a).toBeLessThan(x.atoms.length); expect(b.b).toBeLessThan(x.atoms.length); }
  });
  it('planets: Kepler\'s third law holds (period² ≈ distance³) and the drawing keeps order', () => {
    for (const p of PLANETS) expect(p.years ** 2 / p.au ** 3).toBeCloseTo(1, 1);
    for (let i = 1; i < PLANETS.length; i++) expect(orbitRadius(PLANETS[i].au)).toBeGreaterThan(orbitRadius(PLANETS[i - 1].au));
    expect(orbitAngle(PLANETS[2], 1)).toBeCloseTo(2 * Math.PI, 5);
  });
});
