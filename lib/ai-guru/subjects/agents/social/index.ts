/**
 * V51.9.149 — the social-science agent (history and geography of places): time lines and places on a coastline map.
 * Claims blocks about history (years, centuries, kings, movements, revolts) and journeys/places; reads year–event
 * pairs and well-known places straight from the text when there is no AI.
 */
import type { BookBlock } from '../../../motion-class/segment';
import type { SubjectAgent } from '../../types';
import { score } from '../../claim';
import { timelineTemplate, type TimelinePlan } from './timeline';
import { placesTemplate, type PlacesPlan } from './places';

const WORDS: Array<[RegExp, number]> = [
  [/\b(Kozhikode|Calicut|Kochi|Cochin|Muziris|Goa|Lisbon|Malindi|Cape of Good Hope|Dandi|Meerut|Surat|Hormuz|Aden|Alexandria|Colombo|Kerala|Malabar|Arabian Sea|Bay of Bengal|Indian Ocean)\b/, 0.3],
  [/\b(century|centuries|dynasty|empire|kingdom|king|queen|sultan|emperor|revolt|rebellion|revolution|movement|independence|freedom struggle|colonial|british|portuguese|mughal|war|treaty|reign|ruled|ancient|medieval)\b/i, 0.35],
  [/\b(1[0-9]{3}|20[0-2][0-9])\b/, 0.15],
  [/\b(BCE|BC|CE|AD)\b/, 0.3],
  [/\b(voyage|sailed|route|trade route|journey|port|coast|explorer|travell?ed)\b/i, 0.25],
  [/\b(history|historical|historian|civili[sz]ation)\b/i, 0.2],
];

/** Well-known places of Kerala / India / the old trade routes (for reading places straight from the text). */
const PLACES: Record<string, [number, number, string]> = {
  kozhikode: [11.25, 75.78, 'കോഴിക്കോട്'], calicut: [11.25, 75.78, 'കോഴിക്കോട്'], kochi: [9.93, 76.27, 'കൊച്ചി'], cochin: [9.93, 76.27, 'കൊച്ചി'],
  thiruvananthapuram: [8.52, 76.94, 'തിരുവനന്തപുരം'], kollam: [8.89, 76.61, 'കൊല്ലം'], kannur: [11.87, 75.37, 'കണ്ണൂർ'], muziris: [10.17, 76.21, 'മുസിരിസ്'],
  goa: [15.5, 73.83, 'ഗോവ'], mumbai: [19.08, 72.88, 'മുംബൈ'], delhi: [28.61, 77.21, 'ഡൽഹി'], kolkata: [22.57, 88.36, 'കൊൽക്കത്ത'], chennai: [13.08, 80.27, 'ചെന്നൈ'],
  madras: [13.08, 80.27, 'ചെന്നൈ'], surat: [21.17, 72.83, 'സൂറത്ത്'], dandi: [20.89, 72.8, 'ദണ്ഡി'], ahmedabad: [23.02, 72.57, 'അഹമ്മദാബാദ്'], meerut: [28.98, 77.71, 'മീററ്റ്'],
  lisbon: [38.72, -9.14, 'ലിസ്ബൺ'], malindi: [-3.22, 40.12, 'മലിന്ദി'], 'cape of good hope': [-34.36, 18.47, 'ഗുഡ്ഹോപ്പ് മുനമ്പ്'], london: [51.51, -0.13, 'ലണ്ടൻ'],
  colombo: [6.93, 79.86, 'കൊളംബോ'], aden: [12.79, 45.02, 'ഏദൻ'], hormuz: [27.1, 56.45, 'ഹോർമുസ്'], alexandria: [31.2, 29.92, 'അലക്സാണ്ട്രിയ'],
};

function timelineFromText(text: string): TimelinePlan | null {
  const t = text.replace(/\s+/g, ' ');
  const out: TimelinePlan['events'] = [];
  // "In 1857, …" / "… in 1885." — the clause around each year is its label
  for (const m of t.matchAll(/\b(?:in|by|from|of)?\s*(\d{3,4})\s*(BCE|BC|CE|AD)?\b/g)) {
    let y = Number(m[1]);
    if (y < 300 && !m[2]) continue;
    if (m[2] && /^BC/.test(m[2])) y = -y;
    const before = t.slice(0, m.index).split(/[.;!?]/).pop() ?? '';
    const after = t.slice((m.index ?? 0) + m[0].length).split(/[.;!?]/)[0] ?? '';
    const clause = (after.replace(/^[\s,]+/, '').length > 6 ? after : before).replace(/^[\s,]+|[\s,]+$/g, '').replace(/^(the|a|an)\s+/i, '');
    const label = clause.split(/\s+/).slice(0, 5).join(' ');
    if (!label || out.some((e) => e.year === y)) continue;
    out.push({ year: y, label: { en: label.charAt(0).toUpperCase() + label.slice(1), ml: label } });
  }
  if (out.length < 3 || out.length > 8) return null;
  out.sort((a, b) => a.year - b.year);
  return {
    events: out,
    steps: [
      { op: 'show', say: { en: 'Let us put these events on a time line.', ml: 'ഈ സംഭവങ്ങളെ ഒരു കാലരേഖയിൽ അടയാളപ്പെടുത്താം.' } },
      ...out.map((e, i) => ({ op: 'event' as const, i, say: { en: `${e.year < 0 ? `${-e.year} BCE` : e.year}: ${e.label.en}.`, ml: `${e.year < 0 ? `${-e.year} ബി.സി.ഇ.` : e.year}: ${e.label.ml}.` } })),
      { op: 'gap', i: 0, j: out.length - 1, say: { en: 'How many years are there from the first event to the last?', ml: 'ആദ്യ സംഭവം മുതൽ അവസാനത്തേതുവരെ എത്ര വർഷം?' } },
    ],
  };
}

function placesFromText(text: string): PlacesPlan | null {
  const found: PlacesPlan['places'] = [];
  const low = text.toLowerCase();
  const hits = Object.keys(PLACES).map((k) => ({ k, at: low.search(new RegExp(`\\b${k}\\b`)) })).filter((h) => h.at >= 0).sort((a, b) => a.at - b.at);
  for (const { k } of hits) {
    const [lat, lon, ml] = PLACES[k];
    if (found.some((f) => f.lat === lat && f.lon === lon)) continue;
    found.push({ name: { en: k.replace(/\b\w/g, (c) => c.toUpperCase()), ml }, lat, lon });
  }
  if (found.length < 2 || found.length > 6) return null;
  const lons = found.map((f) => f.lon);
  if (Math.max(...lons) - Math.min(...lons) > 180) return null;
  const journey = /(voyage|sailed|route|journey|travell?ed|marched|reached)/i.test(text);
  return {
    places: found,
    steps: [
      { op: 'show', say: { en: 'Let us find these places on the map.', ml: 'ഈ സ്ഥലങ്ങൾ ഭൂപടത്തിൽ കണ്ടെത്താം.' } },
      ...found.map((f, i) => ({ op: 'place' as const, i, say: { en: `${f.name.en}.`, ml: `${f.name.ml}.` } })),
      journey
        ? { op: 'route' as const, say: { en: 'This is the route, place by place.', ml: 'ഇതാണ് യാത്രാപഥം, സ്ഥലങ്ങൾ ക്രമത്തിൽ.' } }
        : { op: 'distance' as const, i: 0, j: 1, say: { en: 'How far apart are they in a straight line?', ml: 'നേർരേഖയിൽ ഇവ തമ്മിൽ എത്ര ദൂരം?' } },
    ],
  };
}

export const socialAgent: SubjectAgent = {
  id: 'social',
  name: 'Social science agent',
  templates: [timelineTemplate, placesTemplate],
  claim: (b: BookBlock, ctx) => score(b, ctx, WORDS, 'history') + (/(social|history|geography)/i.test(`${ctx.subjectHint ?? ''} ${ctx.chapterTitle}`) ? 0.15 : 0),
  fromText(b) {
    const pl = placesFromText(b.text);
    if (pl && /(voyage|sailed|route|journey|port|coast|marched|reached)/i.test(b.text)) return { template: 'places', teach: pl };
    const tl = timelineFromText(b.text);
    if (tl) return { template: 'timeline', teach: tl };
    return pl ? { template: 'places', teach: pl } : null;
  },
  system: `You are the SOCIAL SCIENCE planning agent (history and the places of history) of a school classroom (Kerala / CBSE, classes 6–10). You turn ONE textbook block into a plan for ONE of two fixed picture templates. The app draws everything and computes every number (years between events, centuries, distances); you choose the template, give the data from the block (and well-known facts it relies on) and write the captions.
Reply with ONE JSON object: {"template":"<id>","teach":{...},"read":{"en":"<the block text>","ml":"<faithful Malayalam translation>"}}. Every step is {"op":"...","say":{"en":"...","ml":"..."}}.
- "timeline": {"title":{en,ml},"events":[{"year":1857,"label":{"en":"First War of Independence","ml":"..."}}] (2–8, earliest first; BCE years negative, no year 0; labels at most 5 words),"steps":[show, then "event" (with "i"), "gap" (with "i","j": years between two events), "century" (with "i")]}.
- "places": {"title":{en,ml},"places":[{"name":{en,ml},"lat":11.25,"lon":75.78}] (1–8; north and east positive; correct coordinates of the real places),"steps":[show, then "place" (with "i"), "distance" (with "i","j"), "route" (joins the places in order)]}. The map shows coastlines only, never borders.
Use only facts the block states or that are standard textbook knowledge; never invent dates. Captions are spoken: one idea, 6–22 words, natural Malayalam. Do not write computed numbers in captions unless sure.
If the block is not about events in time or places, reply {"template":null}.`,
};
