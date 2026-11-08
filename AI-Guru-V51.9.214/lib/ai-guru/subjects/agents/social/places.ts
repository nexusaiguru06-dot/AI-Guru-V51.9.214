/**
 * V51.9.149 — Social-science agent · template "places": places on a map — coastlines only (land and sea, NO
 * country or state borders, so no disputed boundary is ever drawn), with a latitude/longitude grid. Places appear
 * one by one; the straight (great-circle) distance between two places is computed, and a journey or trade route can
 * be drawn from place to place. Coastlines: Natural Earth (public domain) via world-atlas (ISC).
 */
import type { MotionScene } from '../../../reels/motion/engine';
import type { Lang } from '../../../reels/motion/captions';
import { isBi, label, newScene, pick, ring, sparkle, uid, type Bi, type Pt } from '../../kit';
import type { AgentTemplate } from '../../types';
import { LAND_RINGS } from './land-data';

export interface PlacesPlan {
  title?: Bi;
  places: Array<{ name: Bi; lat: number; lon: number }>;
  steps: Array<{ op: 'show' | 'place' | 'distance' | 'route'; i?: number; j?: number; say: Bi }>;
}

/** Great-circle distance in km (Earth radius 6371 km). */
export function distanceKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const r = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lon - a.lon) / 2) ** 2;
  return Math.round(2 * 6371 * Math.asin(Math.sqrt(h)));
}

export function validatePlaces(x: unknown): string[] {
  const p = x as PlacesPlan;
  if (!p || typeof p !== 'object') return ['plan is not an object'];
  const e: string[] = [];
  if (!Array.isArray(p.places) || p.places.length < 1 || p.places.length > 8) return ['places: 1 to 8'];
  p.places.forEach((pl, i) => {
    if (!isBi(pl?.name)) e.push(`places[${i}].name needs en and ml`);
    if (!(typeof pl?.lat === 'number' && Math.abs(pl.lat) <= 85)) e.push(`places[${i}].lat is −85 to 85 (north positive)`);
    if (!(typeof pl?.lon === 'number' && Math.abs(pl.lon) <= 180)) e.push(`places[${i}].lon is −180 to 180 (east positive)`);
  });
  if (!e.length) {
    const lons = p.places.map((q) => q.lon);
    if (Math.max(...lons) - Math.min(...lons) > 180) e.push('the places span more than half the world; split them');
  }
  if (!Array.isArray(p.steps) || !p.steps.length || p.steps.length > 14) return [...e, 'steps: 1 to 14'];
  if (p.steps[0]?.op !== 'show') e.push('the first step is "show"');
  const n = p.places.length;
  const okI = (k: unknown) => Number.isInteger(k) && (k as number) >= 0 && (k as number) < n;
  p.steps.forEach((s, i) => {
    if (!['show', 'place', 'distance', 'route'].includes(s?.op)) e.push(`steps[${i}].op is show, place, distance or route`);
    if (s?.op === 'place' && !okI(s.i)) e.push(`steps[${i}].i is a place index`);
    if (s?.op === 'distance' && (!okI(s.i) || !okI(s.j) || s.i === s.j)) e.push(`steps[${i}] needs two different place indexes i and j`);
    if (s?.op === 'route' && n < 2) e.push('a route needs at least two places');
    if (!isBi(s?.say)) e.push(`steps[${i}].say needs en and ml`);
  });
  return e;
}

export function buildPlaces(raw: unknown, lang: Lang, title: string): MotionScene[] {
  const p = raw as PlacesPlan;
  const ml = lang === 'ml';
  const m = newScene(title, 640);
  // the view: the places with a margin, at least 14° tall, in a 600 × 400 box (equirectangular, x squeezed by cos lat)
  const lats = p.places.map((q) => q.lat), lons = p.places.map((q) => q.lon);
  const midLat = (Math.max(...lats) + Math.min(...lats)) / 2;
  const k = Math.cos((midLat * Math.PI) / 180);
  let spanLat = Math.max(14, (Math.max(...lats) - Math.min(...lats)) * 1.5);
  let spanLon = Math.max(14 / k, (Math.max(...lons) - Math.min(...lons)) * 1.5);
  const BW = 600, BH = 400, BX = 60, BY = 40;
  // keep the box's shape
  if (spanLon * k / spanLat > BW / BH) spanLat = (spanLon * k * BH) / BW; else spanLon = (spanLat * BW) / (BH * k);
  const lat0 = midLat + spanLat / 2, lon0 = (Math.max(...lons) + Math.min(...lons)) / 2 - spanLon / 2;
  const P = (lat: number, lon: number): Pt => [BX + ((lon - lon0) / spanLon) * BW, BY + ((lat0 - lat) / spanLat) * BH];
  const at = (i: number) => P(p.places[i].lat, p.places[i].lon);
  const shown = new Set<number>();
  let t = 300;
  let line = 0;
  const say = (text: string, when: number, color: string) => label(m, text, 360, BY + BH + 40 + 40 * line++, when, { size: 22, color, weight: '700' });
  const showPlace = (i: number, when: number) => {
    if (shown.has(i)) return;
    shown.add(i);
    const [x, y] = at(i);
    m.dot(uid('pl'), x, y, when, { color: 'accent', r: 7 });
    label(m, pick(p.places[i].name, lang), x, y - 18, when + 200, { size: 19, color: 'accent', weight: '700' });
  };

  for (const st of p.steps) {
    t = m.step(pick(st.say, lang), t, 2400);
    if (st.op === 'show') {
      // sea, then land
      m.poly(uid('sea'), [[BX, BY], [BX + BW, BY], [BX + BW, BY + BH], [BX, BY + BH]], t, { color: '#2b6cb0', fill: '#2b6cb0', fillAlpha: 0.12, closed: true, width: 2, dur: 400, z: 0, silent: true });
      let drawn = 0;
      for (const r of LAND_RINGS) {
        // only rings that reach into the view
        let inView = false;
        for (let q = 0; q < r.length; q += 2) { const la = r[q + 1], lo = r[q]; if (la <= lat0 + 2 && la >= lat0 - spanLat - 2 && lo >= lon0 - 2 && lo <= lon0 + spanLon + 2) { inView = true; break; } }
        if (!inView) continue;
        const pts: Pt[] = [];
        for (let q = 0; q < r.length; q += 2) pts.push(P(r[q + 1], r[q]));
        m.poly(uid('land'), pts, t + 200 + drawn * 20, { color: '#6b8f3a', fill: '#9cc56b', fillAlpha: 0.35, closed: true, width: 1.6, dur: 900, z: 1, silent: true, clip: [BX, BY, BW, BH] });
        drawn++;
      }
      // the grid: every 5° (or 10°/20° on a wide map)
      const g = spanLat > 60 ? 20 : spanLat > 30 ? 10 : 5;
      for (let la = Math.ceil((lat0 - spanLat) / g) * g; la <= lat0; la += g) {
        const [, y] = P(la, lon0);
        m.rule(uid('gl'), BX, y, BX + BW, y, t + 600, { color: 'done', width: 0.8 });
        label(m, `${Math.abs(la)}°${la > 0 ? 'N' : la < 0 ? 'S' : ''}`, BX - 26, y, t + 700, { size: 12, color: 'done' });
      }
      for (let lo = Math.ceil(lon0 / g) * g; lo <= lon0 + spanLon; lo += g) {
        const [x] = P(lat0, lo);
        m.rule(uid('gm'), x, BY, x, BY + BH, t + 600, { color: 'done', width: 0.8 });
        label(m, `${Math.abs(lo)}°${lo > 0 ? 'E' : lo < 0 ? 'W' : ''}`, x, BY + BH + 14, t + 700, { size: 12, color: 'done' });
      }
      if (p.title) label(m, pick(p.title, lang), BX + BW / 2, BY + 20, t + 300, { size: 22, color: 'ink', weight: '700' });
      label(m, ml ? 'തീരരേഖകൾ മാത്രം · അതിർത്തികളില്ല' : 'coastlines only · no borders', BX + BW - 90, BY + BH - 12, t + 900, { size: 11, color: 'done' });
      t += 1600;
    } else if (st.op === 'place') {
      showPlace(st.i!, t);
      const pl = p.places[st.i!];
      say(`${pick(pl.name, lang)}: ${Math.abs(pl.lat)}°${pl.lat >= 0 ? 'N' : 'S'}, ${Math.abs(pl.lon)}°${pl.lon >= 0 ? 'E' : 'W'}`, t + 300, 'accent');
      t += 1500;
    } else if (st.op === 'distance') {
      showPlace(st.i!, t);
      showPlace(st.j!, t);
      const a = at(st.i!), b = at(st.j!);
      m.poly(uid('dl'), [a, b], t + 300, { color: 'carry', closed: false, width: 3, dashed: true, dur: 700, z: 5, silent: true });
      const d = distanceKm(p.places[st.i!], p.places[st.j!]);
      label(m, `${d} km`, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - 14, t + 900, { size: 20, color: 'carry', weight: '700' });
      say(`${ml ? 'നേർദൂരം' : 'Straight-line distance'} ≈ ${d} km`, t + 1000, 'carry');
      t += 2000;
    } else if (st.op === 'route') {
      const ids = p.places.map((_, i) => i);
      ids.forEach((i) => showPlace(i, t));
      let total = 0;
      for (let i = 1; i < ids.length; i++) {
        const a = at(i - 1), b = at(i);
        m.poly(uid('rt'), [a, b], t + 300 + i * 600, { color: 'c', closed: false, width: 4, dur: 550, z: 5, silent: true });
        total += distanceKm(p.places[i - 1], p.places[i]);
      }
      const end = at(ids.length - 1);
      ring(m, end[0], end[1], 18, 18, t + 300 + ids.length * 600, 'c');
      sparkle(m, end[0], end[1], t + 500 + ids.length * 600);
      say(`${ml ? 'ആകെ ഏകദേശം' : 'about'} ${total} km${ml ? '' : ' in all'}`, t + 400 + ids.length * 600, 'c');
      t += 1200 + ids.length * 600;
    }
    t += 150;
    m.hold(t);
  }
  m.hold(t + 1400);
  return [m.build()];
}

export const PLACES_EXAMPLE: PlacesPlan = {
  title: { en: 'Vasco da Gama reaches India', ml: 'വാസ്കോ ഡ ഗാമ ഇന്ത്യയിലെത്തുന്നു' },
  places: [
    { name: { en: 'Malindi', ml: 'മലിന്ദി' }, lat: -3.2, lon: 40.1 },
    { name: { en: 'Kozhikode', ml: 'കോഴിക്കോട്' }, lat: 11.25, lon: 75.78 },
  ],
  steps: [
    { op: 'show', say: { en: 'Here is the Arabian Sea between Africa and India.', ml: 'ആഫ്രിക്കയ്ക്കും ഇന്ത്യയ്ക്കുമിടയിലുള്ള അറബിക്കടൽ.' } },
    { op: 'place', i: 0, say: { en: 'Vasco da Gama sailed from Malindi on the African coast.', ml: 'ആഫ്രിക്കൻ തീരത്തെ മലിന്ദിയിൽ നിന്ന് വാസ്കോ ഡ ഗാമ യാത്ര തിരിച്ചു.' } },
    { op: 'place', i: 1, say: { en: 'In 1498 he reached Kozhikode on the Malabar coast.', ml: '1498-ൽ അദ്ദേഹം മലബാർ തീരത്തെ കോഴിക്കോട്ടെത്തി.' } },
    { op: 'route', say: { en: 'His route across the sea opened a new trade path to Europe.', ml: 'കടലിലൂടെയുള്ള ഈ യാത്ര യൂറോപ്പിലേക്ക് പുതിയ വ്യാപാരപാത തുറന്നു.' } },
  ],
};

export const placesTemplate: AgentTemplate = {
  id: 'places',
  title: 'Places on the map',
  about: 'Places on a coastline map (no borders) with a latitude/longitude grid; straight-line distances and routes computed in km.',
  example: PLACES_EXAMPLE,
  validate: validatePlaces,
  build: buildPlaces,
};
