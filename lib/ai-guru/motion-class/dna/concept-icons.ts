/**
 * Small pictures for the concept board (V51.9.52): a sun, a drop, a cloud, a leaf, a coin, a book…
 * Each icon is a few pen strokes in a 100 × 100 box; the app scales and places them. The planner may
 * name an icon, or the app picks one from the words of the point (iconFor); no match means no icon.
 */

export type Pt = [number, number];
export interface Stroke {
  pts: Pt[];
  closed: boolean;
  /** Soft fill in the icon's colour. */
  fill?: boolean;
}

const rad = (d: number) => (d * Math.PI) / 180;
/** Points of an arc (degrees, maths orientation: 90 = up on the screen), from a0 to a1. */
function arc(cx: number, cy: number, r: number, a0: number, a1: number, n = 10): Pt[] {
  return Array.from({ length: n + 1 }, (_, i) => {
    const a = rad(a0 + ((a1 - a0) * i) / n);
    return [cx + r * Math.cos(a), cy - r * Math.sin(a)] as Pt;
  });
}
const ring = (cx: number, cy: number, r: number, n = 20): Pt[] => arc(cx, cy, r, 0, 360, n).slice(0, n);
const quad = (p0: Pt, c: Pt, p1: Pt, n = 8): Pt[] =>
  Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n;
    return [(1 - t) * (1 - t) * p0[0] + 2 * (1 - t) * t * c[0] + t * t * p1[0], (1 - t) * (1 - t) * p0[1] + 2 * (1 - t) * t * c[1] + t * t * p1[1]] as Pt;
  });

function gearPts(): Pt[] {
  const pts: Pt[] = [];
  const teeth = 8;
  for (let i = 0; i < teeth; i++) {
    const a = (i / teeth) * 360;
    const w = 360 / teeth / 4;
    for (const [da, r] of [[-w * 1.4, 28], [-w * 0.7, 40], [w * 0.7, 40], [w * 1.4, 28]] as Array<[number, number]>) {
      const t = rad(a + da);
      pts.push([50 + r * Math.cos(t), 50 - r * Math.sin(t)]);
    }
  }
  return pts;
}

function heartPts(): Pt[] {
  return Array.from({ length: 28 }, (_, i) => {
    const t = (i / 28) * Math.PI * 2;
    const x = 16 * Math.sin(t) ** 3;
    const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
    return [50 + x * 2.6, 46 - y * 2.6] as Pt;
  });
}

export const ICONS = {
  sun: [{ pts: ring(50, 50, 18), closed: true, fill: true }, ...Array.from({ length: 8 }, (_, i) => {
    const a = rad(i * 45);
    return { pts: [[50 + 28 * Math.cos(a), 50 - 28 * Math.sin(a)], [50 + 42 * Math.cos(a), 50 - 42 * Math.sin(a)]] as Pt[], closed: false };
  })],
  drop: [{ pts: [[50, 8], ...arc(50, 62, 26, 150, 390, 16)] as Pt[], closed: true, fill: true }],
  cloud: [{ pts: [...arc(30, 58, 16, 270, 90, 8), ...arc(52, 42, 22, 160, 30, 8), ...arc(74, 58, 16, 90, -90, 8)] as Pt[], closed: true, fill: true }],
  leaf: [
    { pts: [...quad([18, 84], [14, 14], [86, 16]), ...quad([86, 16], [90, 86], [18, 84])] as Pt[], closed: true, fill: true },
    { pts: [[18, 84], [60, 40]] as Pt[], closed: false },
  ],
  tree: [
    { pts: ring(50, 36, 26), closed: true, fill: true },
    { pts: [[44, 62], [56, 62], [58, 92], [42, 92]] as Pt[], closed: true, fill: true },
  ],
  flame: [{ pts: [[50, 6], [64, 30], [76, 54], [72, 78], [50, 92], [28, 78], [24, 56], [36, 40], [42, 54]] as Pt[], closed: true, fill: true }],
  coin: [
    { pts: ring(50, 50, 38), closed: true, fill: true },
    { pts: ring(50, 50, 27), closed: true },
    { pts: [[50, 36], [50, 64]] as Pt[], closed: false },
  ],
  book: [
    { pts: [[8, 24], [48, 32], [48, 84], [8, 76]] as Pt[], closed: true, fill: true },
    { pts: [[92, 24], [52, 32], [52, 84], [92, 76]] as Pt[], closed: true, fill: true },
  ],
  house: [
    { pts: [[12, 52], [50, 14], [88, 52]] as Pt[], closed: true, fill: true },
    { pts: [[22, 52], [78, 52], [78, 88], [22, 88]] as Pt[], closed: true },
    { pts: [[43, 88], [43, 66], [57, 66], [57, 88]] as Pt[], closed: true, fill: true },
  ],
  person: [
    { pts: ring(50, 26, 15), closed: true, fill: true },
    { pts: [[24, 92], [24, 68], [36, 54], [64, 54], [76, 68], [76, 92]] as Pt[], closed: true, fill: true },
  ],
  clock: [
    { pts: ring(50, 50, 38, 24), closed: true },
    { pts: [[50, 50], [50, 24]] as Pt[], closed: false },
    { pts: [[50, 50], [68, 60]] as Pt[], closed: false },
  ],
  mountain: [
    { pts: [[6, 86], [36, 26], [52, 52], [64, 36], [94, 86]] as Pt[], closed: true, fill: true },
    { pts: [[28, 40], [36, 26], [44, 40], [38, 36]] as Pt[], closed: false },
  ],
  wave: [
    { pts: Array.from({ length: 21 }, (_, i) => [8 + i * 4.2, 38 + 12 * Math.sin((i / 20) * Math.PI * 4)] as Pt), closed: false },
    { pts: Array.from({ length: 21 }, (_, i) => [8 + i * 4.2, 64 + 12 * Math.sin((i / 20) * Math.PI * 4)] as Pt), closed: false },
  ],
  bolt: [{ pts: [[58, 6], [24, 54], [46, 54], [40, 94], [76, 42], [54, 42]] as Pt[], closed: true, fill: true }],
  bulb: [
    { pts: ring(50, 38, 26), closed: true, fill: true },
    { pts: [[40, 66], [60, 66], [58, 82], [42, 82]] as Pt[], closed: true },
    { pts: [[44, 90], [56, 90]] as Pt[], closed: false },
  ],
  heart: [{ pts: heartPts(), closed: true, fill: true }],
  flag: [
    { pts: [[24, 8], [24, 94]] as Pt[], closed: false },
    { pts: [[24, 14], [82, 14], [66, 32], [82, 50], [24, 50]] as Pt[], closed: true, fill: true },
  ],
  earth: [
    { pts: ring(50, 50, 38, 24), closed: true, fill: true },
    { pts: arc(50, 50, 38, 90, 270, 12).map(([x, y]) => [50 + (x - 50) * 0.4, y] as Pt), closed: false },
    { pts: [[12, 50], [88, 50]] as Pt[], closed: false },
  ],
  gear: [
    { pts: gearPts(), closed: true, fill: true },
    { pts: ring(50, 50, 10, 12), closed: true },
  ],
} satisfies Record<string, Stroke[]>;

export type IconName = keyof typeof ICONS;
export const ICON_NAMES = Object.keys(ICONS) as IconName[];
export const isIcon = (x: unknown): x is IconName => typeof x === 'string' && x in ICONS;

/** Words that suggest an icon (first match wins; the more specific ones come first). */
const KEYWORDS: Array<[IconName, RegExp]> = [
  ['cloud', /\b(cloud\w*|condens\w*|vapou?r\w*|atmospher\w*|rain\w*|monsoon)\b/i],
  ['sun', /\b(sun\w*|solar|sunlight|daylight|heat\w*|warm\w*|summer)\b/i],
  ['drop', /\b(water|drops?|river\w*|rivers?|sea|ocean|liquid|irrigat\w*|flood\w*)\b/i],
  ['leaf', /\b(plants?|leaf|leaves|photosynth\w*|crops?|seeds?|grow\w*|chlorophyll|agricultur\w*|farm\w*)\b/i],
  ['tree', /\b(trees?|forests?|wood\w*|vegetation)\b/i],
  ['flame', /\b(fire|burn\w*|combust\w*|flame\w*|fuel)\b/i],
  ['bolt', /\b(electric\w*|current|battery|voltage|lightning|power|energy)\b/i],
  ['coin', /\b(money|rupees?|price\w*|cost\w*|profit|loss|bank\w*|tax\w*|income|trade|econom\w*|market\w*|wage\w*|saving\w*)\b/i],
  ['mountain', /\b(mountains?|hills?|plateau\w*|himalay\w*|peaks?|valley\w*|relief)\b/i],
  ['wave', /\b(waves?|sound|tides?|vibrat\w*|frequency)\b/i],
  ['heart', /\b(heart|blood|pulse|circulat\w*|health\w*)\b/i],
  ['flag', /\b(nation\w*|independen\w*|freedom|government|constitution\w*|republic|democra\w*|rights?|law\w*|congress|revolt|movement)\b/i],
  ['clock', /\b(century|centuries|years?|decade\w*|period|clock|hours?|minutes?|time)\b/i],
  ['earth', /\b(earth|globe|world|planet\w*|continent\w*|latitude|longitude|climate)\b/i],
  ['house', /\b(house\w*|homes?|family|families|villages?|cit(?:y|ies)|settlement\w*|shelter)\b/i],
  ['person', /\b(people|person|students?|citizens?|population|child\w*|human\w*|leaders?|farmers?|workers?|teachers?)\b/i],
  ['book', /\b(books?|read\w*|writ\w*|stor(?:y|ies)|poems?|poet\w*|grammar|words?|sentences?|language\w*|noun\w*|verbs?|vocabular\w*)\b/i],
  ['bulb', /\b(ideas?|thinks?|thought\w*|invent\w*|discover\w*|brain|mind|concept\w*)\b/i],
  ['gear', /\b(machine\w*|force\w*|motion|engine\w*|work|mechanis\w*|industr\w*|factory|factories)\b/i],
];

/** The icon that fits some words, or undefined when none does. */
export function iconFor(text: string): IconName | undefined {
  for (const [name, re] of KEYWORDS) if (re.test(text)) return name;
  return undefined;
}
