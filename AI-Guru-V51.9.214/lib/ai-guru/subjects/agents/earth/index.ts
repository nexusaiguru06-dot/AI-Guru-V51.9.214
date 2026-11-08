/** The earth-science / geography agent: layered structures (Earth interior, atmosphere), curated + AI-planned. */
import type { SubjectAgent } from '../../types';
import { score } from '../../claim';
import { layersTemplate, LAYERS_EXAMPLE, type LayersPlan } from './layers';
import { cycleTemplate, WATER_CYCLE, ROCK_CYCLE, CARBON_CYCLE } from './cycle';
import { orbitTemplate, SEASONS } from './orbit';
import { latLongTemplate, LATLONG_EXAMPLE, type LatLongPlan } from './latlong';
import { platesTemplate, PLATES_EXAMPLE, type PlatesPlan } from './plates';
import { monsoonTemplate, SUMMER_MONSOON, type MonsoonPlan } from './monsoon';
import { riverTemplate, RIVER_EXAMPLE } from './river';
import { mapScaleTemplate, MAPSCALE_EXAMPLE, type MapScalePlan } from './mapscale';

const WORDS: Array<[RegExp, number]> = [
  [/\b(crust|mantle|core|atmosphere|troposphere|stratosphere|mesosphere|thermosphere|lithosphere|layers? of)\b/i, 0.5],
  [/\b(earthquake|volcano|plate|rock|mineral|soil|continent|ocean|monsoon|climate|weather|latitude|longitude|river|erosion)\b/i, 0.3],
  [/\b(plate tectonics|tectonic|continental drift|plate boundary|monsoon|land breeze|sea breeze|map scale|scale of (?:a |the )?map|representative fraction|river course|upper course|lower course|meanders?|floodplain|delta)\b/i, 0.5],
  [/\b(geograph\w*|map|season|rotation|revolution|solar system|planet)\b/i, 0.2],
  [/\b(water cycle|rock cycle|carbon cycle|equinox|solstice|latitudes?|longitudes?|equator|prime meridian|time zones?|greenwich)\b/i, 0.5],
];
const s = (en: string, ml: string) => ({ en, ml });
const ATMOS: LayersPlan = {
  title: s('Layers of the atmosphere', 'അന്തരീക്ഷത്തിന്റെ പാളികൾ'),
  unit: 'km',
  layers: [
    { name: s('Troposphere', 'ട്രോപ്പോസ്ഫിയർ'), thickness: 12 },
    { name: s('Stratosphere', 'സ്ട്രാറ്റോസ്ഫിയർ'), thickness: 38 },
    { name: s('Mesosphere', 'മീസോസ്ഫിയർ'), thickness: 30 },
    { name: s('Thermosphere', 'തെർമോസ്ഫിയർ'), thickness: 400 },
  ],
  steps: [
    { op: 'show', say: s('The atmosphere has layers, starting with the troposphere where we live.', 'അന്തരീക്ഷത്തിന് പാളികളുണ്ട്; നാം ജീവിക്കുന്ന ട്രോപ്പോസ്ഫിയർ ആദ്യത്തേത്.') },
    { op: 'layer', i: 0, say: s('Weather happens in this thin lowest layer.', 'കാലാവസ്ഥ ഈ നേർത്ത താഴത്തെ പാളിയിലാണ്.') },
    { op: 'layer', i: 3, say: s('The thermosphere is by far the thickest.', 'തെർമോസ്ഫിയർ ആണ് ഏറ്റവും കട്ടിയുള്ളത്.') },
    { op: 'total', say: s('Add the thicknesses for the height covered.', 'കനങ്ങൾ കൂട്ടിയാൽ മൊത്തം ഉയരം കിട്ടും.') },
    { op: 'answer', say: s('Together these layers reach about this high.', 'ഈ പാളികൾ ഒരുമിച്ച് ഇത്രയും ഉയരത്തിലെത്തുന്നു.') },
  ],
};

/** "10°N, 76°E" (or "10 N 76 E") written in the text → a one-place plan; null when no pair is found. */
function coords(text: string): LatLongPlan | null {
  const m = text.match(/(\d{1,2}(?:\.\d+)?)\s*°?\s*([NS])\b[\s,;and]*(\d{1,3}(?:\.\d+)?)\s*°?\s*([EW])\b/);
  if (!m) return null;
  const lat = Number(m[1]) * (m[2] === 'S' ? -1 : 1);
  const lon = Number(m[3]) * (m[4] === 'W' ? -1 : 1);
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  return { ...LATLONG_EXAMPLE, places: [{ name: { en: 'This place', ml: 'ഈ സ്ഥലം' }, lat, lon }] };
}

const sayB = (en: string, ml: string) => ({ en, ml });
/** The boundary type named in the text (convergent unless the words say otherwise). */
function platesFor(text: string): PlatesPlan {
  if (/diverg|rift|mid-?ocean|spreading|moving apart/i.test(text)) {
    return { ...PLATES_EXAMPLE, title: sayB('When plates move apart', 'ഫലകങ്ങൾ അകലുമ്പോൾ'), boundary: 'divergent', left: sayB('African plate', 'ആഫ്രിക്കൻ ഫലകം'), right: sayB('South American plate', 'ദക്ഷിണ അമേരിക്കൻ ഫലകം'), rate: 2.5, result: sayB('New crust forms: a mid-ocean ridge', 'പുതിയ ഭൂവൽക്കം: സമുദ്രമധ്യ പർവതനിര'),
      steps: [
        { op: 'show', say: sayB('Plates rest side by side on the mantle.', 'ഫലകങ്ങൾ മാന്റിലിൽ അടുത്തടുത്തു കിടക്കുന്നു.') },
        { op: 'move', say: sayB('At a divergent boundary the plates move apart.', 'വിഭിന്ന അതിർത്തിയിൽ ഫലകങ്ങൾ അകലുന്നു.') },
        { op: 'result', say: sayB('Magma rises into the gap and makes new crust.', 'വിടവിലേക്ക് മാഗ്മ ഉയർന്ന് പുതിയ ഭൂവൽക്കം ഉണ്ടാകുന്നു.') },
        { op: 'answer', say: sayB('Slow movement adds up over millions of years.', 'സാവധാനത്തിലുള്ള ചലനം ദശലക്ഷം വർഷങ്ങളിൽ വലുതാകുന്നു.') },
      ] };
  }
  if (/transform|slide past|san andreas|sideways/i.test(text)) {
    return { ...PLATES_EXAMPLE, title: sayB('When plates slide past', 'ഫലകങ്ങൾ ഉരസിനീങ്ങുമ്പോൾ'), boundary: 'transform', left: sayB('Pacific plate', 'പസഫിക് ഫലകം'), right: sayB('North American plate', 'വടക്കേ അമേരിക്കൻ ഫലകം'), rate: 4, result: sayB('Earthquakes along the fault', 'ഭ്രംശരേഖയിൽ ഭൂകമ്പങ്ങൾ'),
      steps: [
        { op: 'show', say: sayB('Two plates meet along a line.', 'രണ്ട് ഫലകങ്ങൾ ഒരു രേഖയിൽ ചേരുന്നു.') },
        { op: 'move', say: sayB('At a transform boundary they slide past each other.', 'പരിവർത്തന അതിർത്തിയിൽ അവ പരസ്പരം ഉരസി നീങ്ങുന്നു.') },
        { op: 'result', say: sayB('They stick, then jerk free: that makes an earthquake.', 'അവ ഒട്ടിപ്പിടിച്ച് പെട്ടെന്ന് വിട്ടുമാറുന്നു: ഭൂകമ്പം ഉണ്ടാകുന്നു.') },
        { op: 'answer', say: sayB('Yearly slips add up to a long distance.', 'വാർഷിക നീക്കങ്ങൾ കൂടി വലിയ ദൂരമാകുന്നു.') },
      ] };
  }
  return PLATES_EXAMPLE;
}
function monsoonFor(text: string): MonsoonPlan {
  if (/winter monsoon|north[- ]?east monsoon|retreating|land breeze/i.test(text)) {
    return { ...SUMMER_MONSOON, title: sayB('The winter monsoon', 'ശീതകാല മൺസൂൺ'), landTemp: 16, seaTemp: 26,
      steps: [
        { op: 'show', say: sayB('In winter the land and sea swap roles.', 'ശൈത്യത്തിൽ കരയും കടലും പങ്ക് മാറുന്നു.') },
        { op: 'heat', say: sayB('Now the land cools faster than the sea.', 'ഇപ്പോൾ കര കടലിനേക്കാൾ വേഗം തണുക്കുന്നു.') },
        { op: 'flow', say: sayB('Air over the warm sea rises, so wind blows from land to sea.', 'ചൂടുള്ള കടലിനു മുകളിൽ വായു ഉയരുന്നു; കാറ്റ് കരയിൽ നിന്ന് കടലിലേക്ക് വീശുന്നു.') },
        { op: 'rain', say: sayB('This wind comes from land, so it is dry.', 'ഈ കാറ്റ് കരയിൽ നിന്നായതിനാൽ വരണ്ടതാണ്.') },
        { op: 'answer', say: sayB('The wind direction reverses with the seasons.', 'ഋതുക്കൾക്കനുസരിച്ച് കാറ്റിന്റെ ദിശ മാറുന്നു.') },
      ] };
  }
  return SUMMER_MONSOON;
}
/** "scale 1 : 50,000 … 6 cm" in the text → a plan with those numbers; the bare topic → the example. */
function scaleFor(text: string): MapScalePlan | null {
  const sm = text.match(/1\s*:\s*(\d[\d,]*)/);
  const cm = text.match(/(\d+(?:\.\d+)?)\s*cm/i);
  if (sm && cm && /scale|map/i.test(text)) {
    const den = Number(sm[1].replace(/,/g, ''));
    const len = Number(cm[1]);
    if (den >= 1000 && den <= 100_000_000 && len > 0 && len <= 12) return { ...MAPSCALE_EXAMPLE, denominator: den, mapCm: len };
  }
  if (/map scale|scale of (a |the )?map|representative fraction/i.test(text)) return MAPSCALE_EXAMPLE;
  return null;
}

export const earthAgent: SubjectAgent = {
  id: 'earth',
  name: 'Earth science agent',
  templates: [layersTemplate, cycleTemplate, orbitTemplate, latLongTemplate, platesTemplate, monsoonTemplate, riverTemplate, mapScaleTemplate],
  claim: (b, ctx) => score(b, ctx, WORDS, 'geograph'),
  fromText(b) {
    if (/troposphere|stratosphere|atmosphere/i.test(b.text) && /layer/i.test(b.text)) return { template: 'layers', teach: ATMOS };
    if (/\bcrust\b/i.test(b.text) && /\b(mantle|core)\b/i.test(b.text)) return { template: 'layers', teach: LAYERS_EXAMPLE };
    if (/plate tecton|tectonic|continental drift|plate boundar|convergent|divergent|transform (?:fault|boundary)/i.test(b.text)) return { template: 'plates', teach: platesFor(b.text) };
    if (/monsoon|land breeze|sea breeze/i.test(b.text)) return { template: 'monsoon', teach: monsoonFor(b.text) };
    if (/\b(upper|middle|lower) course|river profile|meander|floodplain|\bdelta\b/i.test(b.text)) return { template: 'river', teach: RIVER_EXAMPLE };
    const sc = scaleFor(b.text);
    if (sc) return { template: 'mapscale', teach: sc };
    if (/water cycle|hydrological cycle/i.test(b.text)) return { template: 'cycle', teach: WATER_CYCLE };
    if (/rock cycle/i.test(b.text)) return { template: 'cycle', teach: ROCK_CYCLE };
    if (/carbon cycle/i.test(b.text)) return { template: 'cycle', teach: CARBON_CYCLE };
    if (/\bseasons?\b/i.test(b.text) && /\b(tilt|axis|orbit|revolution|equinox|solstice)\b/i.test(b.text)) return { template: 'orbit', teach: SEASONS };
    const ll = coords(b.text);
    if (ll) return { template: 'latlong', teach: ll };
    if (/latitude/i.test(b.text) && /longitude/i.test(b.text)) return { template: 'latlong', teach: LATLONG_EXAMPLE };
    return null;
  },
  system: `You are the EARTH-SCIENCE / GEOGRAPHY planning agent of a school classroom. You turn ONE textbook block into a plan for ONE of these fixed templates (the app draws everything and computes every number):
1. "layers" — stacked bands to scale (Earth's interior, atmosphere): {"title":{en,ml},"unit":"km","layers":[{"name":{en,ml},"thickness":35}],"steps":[{"op":"show"},{"op":"layer","i":0},{"op":"total"},{"op":"answer"}]}. 2 to 6 layers, outermost first; steps start with "show".
2. "cycle" — stages round a ring (water, rock, carbon, nitrogen cycles): {"title":{en,ml},"stages":[{"name":{en,ml},"process":{en,ml}}],"steps":[{"op":"show"},{"op":"flow","i":0},{"op":"loop"},{"op":"answer"}]}. 3 to 6 stages in order; "process" is what carries a stage to the next one (the last returns to the first); "flow" i is the 0-based stage.
3. "orbit" — Earth at four places round the Sun (seasons): {"title":{en,ml},"tilt":23.5,"places":[{"name":{en,ml},"when":{en,ml}}],"steps":[{"op":"show"},{"op":"place","i":1},{"op":"tilt"},{"op":"answer"}]}. Exactly 4 places in this order: autumn equinox, northern summer, spring equinox, northern winter.
4. "latlong" — degree grid with places: {"title":{en,ml},"places":[{"name":{en,ml},"lat":10,"lon":76}],"steps":[{"op":"show"},{"op":"place","i":0},{"op":"time"},{"op":"answer"}]}. 1 to 3 places; lat -90..90 (north +), lon -180..180 (east +), values from the text or well-known.
5. "plates" — plate tectonics: {"title":{en,ml},"boundary":"convergent|divergent|transform","left":{en,ml},"right":{en,ml},"rate":5,"result":{en,ml},"steps":[{"op":"show"},{"op":"move"},{"op":"result"},{"op":"answer"}]}. rate in cm a year (0.1–20); result = the landform or hazard formed.
6. "monsoon" — land/sea heating and wind: {"title":{en,ml},"landTemp":42,"seaTemp":28,"steps":[{"op":"show"},{"op":"heat"},{"op":"flow"},{"op":"rain"},{"op":"answer"}]}. Give both temperatures in °C; the app works out pressure and wind direction itself.
7. "river" — long profile of a river: {"title":{en,ml},"courses":[{"name":{en,ml},"landform":{en,ml},"lengthKm":100,"startM":3000,"endM":600}],"steps":[{"op":"show"},{"op":"course","i":0},{"op":"gradient"},{"op":"answer"}]}. 2–4 courses source to mouth; each startM equals the previous endM and falls.
8. "mapscale" — map distance to ground distance: {"title":{en,ml},"denominator":50000,"mapCm":6,"from":{en,ml},"to":{en,ml},"steps":[{"op":"show"},{"op":"ruler"},{"op":"convert"},{"op":"answer"}]}. Scale is 1 : denominator; mapCm up to 12.
Every step also has "say":{en,ml}. Captions: one idea, 6–22 words, natural Malayalam; do not write computed numbers in captions.
Reply with ONE JSON object: {"template":"<id>","teach":{…},"read":{"en":"<the block text>","ml":"<faithful Malayalam translation>"}}.
If the block fits none of the templates, reply {"template":null}.`,
};
