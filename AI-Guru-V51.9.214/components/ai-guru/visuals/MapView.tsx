'use client';
/**
 * V51.9.96: colourful maps with d3-geo from Natural Earth (public domain; India point-of-view edition, so India's border
 * follows India's claim). Views: continents, heat zones, latitudes and longitudes, one country, India's states, one state.
 */
import { useEffect, useMemo, useState } from 'react';
import { geoArea, geoEqualEarth, geoGraticule10, geoMercator, geoPath, geoCentroid, type GeoPermissibleObjects } from 'd3-geo';
import { feature } from 'topojson-client';
import { CONTINENT_COLOURS, MAP_FILES, STATE_PALETTE } from '@/lib/ai-guru/visuals/maps';
import type { MapSpec } from '@/lib/ai-guru/visuals/types';

type F = { type: 'Feature'; properties: Record<string, string | number>; geometry: unknown };
const cache: Record<string, Promise<F[]>> = {};
function load(url: string, layer: string): Promise<F[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  cache[url] ??= fetch(url).then((r) => r.json()).then((t: any) => (feature(t, t.objects[layer]) as unknown as { features: F[] }).features);
  return cache[url];
}
const OCEAN = '#bae6fd';

export function MapView({ spec, width = 640, compact = false }: { spec: MapSpec; width?: number; compact?: boolean }) {
  const [world, setWorld] = useState<F[] | null>(null);
  const [states, setStates] = useState<F[] | null>(null);
  const india = spec.view === 'india' || spec.view === 'state';
  useEffect(() => { void load(MAP_FILES.world, 'countries').then(setWorld); if (india) void load(MAP_FILES.states, 'states').then(setStates); }, [india]);
  const height = Math.round(width * (india ? 1.08 : 0.56));
  const drawn = useMemo(() => {
    if (!world || (india && !states)) return null;
    const ind = world.find((f) => f.properties.iso === 'IND');
    const projection = india ? geoMercator().fitExtent([[12, 12], [width - 12, height - 12]], ind as unknown as GeoPermissibleObjects) : geoEqualEarth().fitExtent([[8, 8], [width - 8, height - 8]], { type: 'Sphere' });
    const path = geoPath(projection);
    const d = (f: unknown) => path(f as GeoPermissibleObjects) ?? '';
    return { path, d, projection, ind };
  }, [world, states, india, width, height]);
  if (!drawn || !world) return <div style={{ width: '100%', aspectRatio: `${width}/${height}` }} className="animate-pulse rounded-xl bg-sky-100" />;
  const { d, projection, ind } = drawn;
  const sw = compact ? 0.4 : 0.7;
  const label = (lonlat: [number, number], text: string, o: { size?: number; fill?: string } = {}) => { const p = projection(lonlat); return p && !compact ? <text x={p[0]} y={p[1]} textAnchor="middle" fontSize={o.size ?? 11} fontWeight={700} fill={o.fill ?? '#0f172a'} stroke="#fff" strokeWidth={3} paintOrder="stroke">{text}</text> : null; };

  let body: React.ReactNode;
  if (spec.view === 'india' || spec.view === 'state') {
    const target = spec.view === 'state' ? spec.name.toLowerCase() : '';
    body = <>
      {world.filter((f) => ['PAK', 'CHN', 'NPL', 'BTN', 'BGD', 'MMR', 'LKA', 'AFG'].includes(String(f.properties.iso))).map((f, i) => <path key={i} d={d(f)} fill="#f1f5f9" stroke="#cbd5e1" strokeWidth={sw} />)}
      <path d={d(ind)} fill={target ? '#fef3c7' : '#fde68a'} stroke="#b45309" strokeWidth={compact ? 1 : 1.6} />
      {states!.map((f, i) => { const name = String(f.properties.state); const hit = target && name.toLowerCase() === target; return <path key={i} d={d(f)} fill={target ? (hit ? '#ef4444' : '#fef3c7') : STATE_PALETTE[i % STATE_PALETTE.length]} stroke="#ffffff" strokeWidth={sw}><title>{name}</title></path>; })}
      {!compact && states!.filter((f) => !target || String(f.properties.state).toLowerCase() === target).map((f, i) => { const c = geoCentroid(f as unknown as GeoPermissibleObjects); const name = String(f.properties.state); return name.length < 22 || target ? <g key={`l${i}`}>{label(c, name, { size: target ? 14 : 8.5, fill: target ? '#7f1d1d' : '#1e293b' })}</g> : null; })}
    </>;
  } else {
    const grat = geoGraticule10();
    const lines: Array<[number, string, string]> = [[0, 'Equator', '#dc2626'], [23.44, 'Tropic of Cancer', '#ea580c'], [-23.44, 'Tropic of Capricorn', '#ea580c'], [66.56, 'Arctic Circle', '#2563eb'], [-66.56, 'Antarctic Circle', '#2563eb']];
    // d3 reads a ring the wrong way round as "everything except it": flip the ring when its area is more than half the globe.
    const band = (a: number, b: number) => { const ring = [...Array.from({ length: 73 }, (_, i) => [-180 + i * 5, a]), ...Array.from({ length: 73 }, (_, i) => [180 - i * 5, b]), [-180, a]]; const poly = { type: 'Polygon' as const, coordinates: [ring] }; return geoArea(poly) > 2 * Math.PI ? { type: 'Polygon' as const, coordinates: [[...ring].reverse()] } : poly; };
    const hit = spec.view === 'country' ? spec.name.toLowerCase() : '';
    body = <>
      <path d={d({ type: 'Sphere' })} fill={OCEAN} />
      {spec.view === 'zones' && <>
        <path d={d(band(-23.44, 23.44))} fill="#fca5a5" opacity={0.55} />
        <path d={d(band(23.44, 66.56))} fill="#fde68a" opacity={0.6} /><path d={d(band(-66.56, -23.44))} fill="#fde68a" opacity={0.6} />
        <path d={d(band(66.56, 89.9))} fill="#bfdbfe" opacity={0.8} /><path d={d(band(-89.9, -66.56))} fill="#bfdbfe" opacity={0.8} />
      </>}
      {(spec.view === 'latlong' || spec.view === 'zones') && <path d={d(grat)} fill="none" stroke="#0369a1" strokeOpacity={0.35} strokeWidth={0.5} />}
      {world.map((f, i) => { const name = String(f.properties.name).toLowerCase(); const isInd = f.properties.iso === 'IND'; const fill = spec.view === 'continents' ? CONTINENT_COLOURS[String(f.properties.continent)] ?? '#94a3b8' : hit ? (name === hit || (hit === 'united states of america' && f.properties.iso === 'USA') ? '#ef4444' : isInd ? '#fcd34d' : '#e7e5e4') : spec.view === 'zones' ? '#a8a29e' : isInd ? '#fbbf24' : '#86efac'; return <path key={i} d={d(f)} fill={fill} stroke="#ffffff" strokeWidth={sw} opacity={spec.view === 'zones' ? 0.75 : 1}><title>{String(f.properties.name)}</title></path>; })}
      {(spec.view === 'latlong' || spec.view === 'zones') && lines.map(([lat, name, col]) => <g key={name}><path d={d({ type: 'LineString', coordinates: Array.from({ length: 73 }, (_, i) => [-180 + i * 5, lat]) })} fill="none" stroke={col} strokeWidth={compact ? 1 : 1.8} strokeDasharray={lat ? '6 4' : undefined} />{label([-150, lat + 2.5], `${name} ${lat ? `${Math.abs(lat).toFixed(1)}°${lat > 0 ? 'N' : 'S'}` : '0°'}`, { size: 10, fill: col })}</g>)}
      {spec.view === 'latlong' && <><path d={d({ type: 'LineString', coordinates: Array.from({ length: 37 }, (_, i) => [0, -90 + i * 5]) })} fill="none" stroke="#16a34a" strokeWidth={compact ? 1 : 1.8} />{label([6, 52], 'Prime Meridian 0°', { size: 10, fill: '#15803d' })}<path d={d({ type: 'LineString', coordinates: Array.from({ length: 37 }, (_, i) => [82.5, -90 + i * 5]) })} fill="none" stroke="#7c3aed" strokeWidth={compact ? 0.8 : 1.4} strokeDasharray="3 3" />{label([82.5, -12], 'IST 82½°E', { size: 10, fill: '#6d28d9' })}</>}
      {spec.view === 'continents' && <>{label([90, 45], 'ASIA', { size: 13 })}{label([20, 5], 'AFRICA', { size: 13 })}{label([15, 52], 'EUROPE', { size: 11 })}{label([-100, 45], 'NORTH AMERICA', { size: 12 })}{label([-60, -15], 'SOUTH AMERICA', { size: 12 })}{label([134, -25], 'AUSTRALIA', { size: 11 })}{label([0, -80], 'ANTARCTICA', { size: 11 })}{label([-40, 25], 'Atlantic Ocean', { size: 10, fill: '#0369a1' })}{label([75, -20], 'Indian Ocean', { size: 10, fill: '#0369a1' })}{label([-150, 5], 'Pacific Ocean', { size: 10, fill: '#0369a1' })}</>}
      {spec.view === 'zones' && <>{label([20, 12], 'Torrid zone', { size: 12, fill: '#b91c1c' })}{label([20, 45], 'North Temperate zone', { size: 11, fill: '#a16207' })}{label([20, -45], 'South Temperate zone', { size: 11, fill: '#a16207' })}{label([20, 74], 'North Frigid zone', { size: 11, fill: '#1d4ed8' })}</>}
      {hit && (() => { const f = world.find((x) => String(x.properties.name).toLowerCase() === hit || (hit === 'united states of america' && x.properties.iso === 'USA')); return f ? label(geoCentroid(f as unknown as GeoPermissibleObjects), String(f.properties.name), { size: 13, fill: '#7f1d1d' }) : null; })()}
    </>;
  }
  return <svg role="img" aria-label="Map" viewBox={`0 0 ${width} ${height}`} className="h-auto w-full rounded-xl" style={{ background: india ? '#e0f2fe' : 'transparent' }}>{body}</svg>;
}
