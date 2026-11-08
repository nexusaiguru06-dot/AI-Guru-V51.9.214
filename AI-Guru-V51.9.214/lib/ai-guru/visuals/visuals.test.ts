/** V51.9.96: picture catalogues and the paragraph → pictures matcher. */
import { describe, expect, it } from 'vitest';
import { CURATED, findVisuals, keywordWeights, searchVisuals, subjectsFor } from './match';
import { MOLECULES } from './molecules';
import { PHET, phetUrl } from './phet';
import type { Visual } from './types';

const bio: Visual[] = [
  { kind: 'bioicon', id: 'human-physiology-heart', subject: 'biology', title: 'heart', category: 'Human physiology', keywords: ['heart'], file: '/x.svg', author: 'A', licence: 'CC0' },
  { kind: 'bioicon', id: 'human-physiology-heart-section', subject: 'biology', title: 'heart section', category: 'Human physiology', keywords: ['heart', 'section'], file: '/x.svg', author: 'A', licence: 'CC0' },
  { kind: 'bioicon', id: 'intracellular-mitochondrion', subject: 'biology', title: 'mitochondrion', category: 'Intracellular components', keywords: ['mitochondrion'], file: '/x.svg', author: 'B', licence: 'CC BY 4.0' },
  { kind: 'bioicon', id: 'cell-types-animal-cell', subject: 'biology', title: 'animal cell', category: 'Cell types', keywords: ['animal', 'cell'], file: '/x.svg', author: 'B', licence: 'CC BY 4.0' },
  ...Array.from({ length: 30 }, (_, i): Visual => ({ kind: 'bioicon', id: `cell-${i}`, subject: 'biology', title: `cell ${i}`, category: 'Cell types', keywords: ['cell', `x${i}`], file: '/x.svg', author: 'C', licence: 'CC0' })),
  { kind: 'bioicon', id: 'lab-beaker', subject: 'chemistry', title: 'beaker', category: 'Lab apparatus', keywords: ['beaker'], file: '/x.svg', author: 'D', licence: 'MIT' },
];
const ids = (text: string, o = {}) => findVisuals(text, { bio, ...o }).map((m) => m.visual.id);

describe('catalogues', () => {
  it('ids are unique and every entry has keywords', () => {
    const all = [...CURATED, ...bio];
    expect(new Set(all.map((v) => v.id)).size).toBe(all.length);
    expect(CURATED.every((v) => v.keywords.length > 0)).toBe(true);
    expect(MOLECULES.length).toBeGreaterThanOrEqual(60);
    expect(PHET.length).toBeGreaterThanOrEqual(45);
  });
  it('every SMILES parses', async () => {
    (globalThis as any).window ??= globalThis;
    const mod: any = await import('smiles-drawer');
    const SD = mod.default ?? mod;
    for (const m of MOLECULES) expect(() => SD.Parser.parse(m.smiles), m.id).not.toThrow();
  });
  it('PhET links use the HTML5 path and locale', () => {
    expect(phetUrl('ohms-law', 'ml')).toBe('https://phet.colorado.edu/sims/html/ohms-law/latest/ohms-law_all.html?locale=ml');
  });
});

describe('pictures for a paragraph', () => {
  it('chemistry: names in the paragraph become molecules', () => {
    const r = ids('In photosynthesis, plants make glucose from carbon dioxide and water.');
    expect(r.slice(0, 4)).toEqual(expect.arrayContaining(['mol-glucose', 'mol-carbon-dioxide', 'mol-water']));
    expect(ids('Vinegar contains ethanoic acid')[0]).toBe('mol-ethanoic-acid');
  });
  it('physics: topics open the right simulation', () => {
    expect(ids('A convex lens forms a real image; draw the ray diagram')).toContain('phet-geometric-optics');
    expect(ids("State Ohm's law. Resistance of a wire")[0]).toBe('phet-ohms-law');
    expect(ids('The time period of a simple pendulum')[0]).toBe('phet-pendulum-lab');
  });
  it('geography: map terms, countries and states', () => {
    expect(ids('The Equator and the Prime Meridian divide the Earth')[0]).toBe('map-latlong');
    expect(ids('The torrid zone lies between the Tropic of Cancer and the Tropic of Capricorn')[0]).toBe('map-zones');
    expect(ids('The Nile flows through Egypt')).toContain('map-country-egypt');
    expect(ids('Tamil Nadu and Karnataka share the Kaveri')).toEqual(expect.arrayContaining(['map-state-tamil-nadu', 'map-state-karnataka']));
  });
  it('Malayalam text works too', () => {
    expect(ids('ഹൃദയം രക്തം പമ്പ് ചെയ്യുന്നു')).toContain('human-physiology-heart');
    expect(ids('അക്ഷാംശവും രേഖാംശവും')[0]).toBe('map-latlong');
    expect(ids('പ്രകാശസംശ്ലേഷണത്തിൽ ഗ്ലൂക്കോസ് ഉണ്ടാകുന്നു')).toContain('mol-glucose');
  });
  it('biology: rare words win over common ones; nothing for an unrelated paragraph', () => {
    const r = findVisuals('Mitochondria are the powerhouse of the cell', { bio, weights: keywordWeights(bio) });
    expect(r[0].visual.id).toBe('intracellular-mitochondrion');
    expect(ids('Add the two fractions and simplify')).toEqual([]);
  });
  it('the book’s subject comes first', () => {
    expect(subjectsFor('Social Science')).toEqual(['geography']);
    expect(subjectsFor('Basic Science')).toEqual(['biology', 'chemistry', 'physics']);
    expect(subjectsFor('Mathematics')).toBeNull();
    const geo = findVisuals('Water covers most of the Earth; oceans and continents', { subject: 'Social Science' });
    expect(geo[0].visual.id).toBe('map-continents');
  });
  it('gallery search in English and Malayalam', () => {
    const all = [...CURATED, ...bio];
    expect(searchVisuals(all, 'beaker').map((v) => v.id)).toContain('lab-beaker');
    expect(searchVisuals(all, 'ഹൃദയം').map((v) => v.id)).toContain('human-physiology-heart');
    expect(searchVisuals(all, 'H₂O').map((v) => v.id)).toContain('mol-water');
  });
});
