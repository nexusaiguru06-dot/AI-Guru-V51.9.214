/**
 * Textbook page layout → reading-order lines.
 *
 * pdf.js gives positioned text runs. Textbook pages mix several things on the
 * same baseline: body text, a side box in the margin, a speech bubble, a
 * stacked fraction, a running head. Teaching needs them apart, so this file:
 *
 *  1. repairs Symbol-font glyphs (Private Use Area codes → − × ÷ ∠ ≈ …);
 *  2. finds the body font size (the most common height, by characters);
 *  3. splits each baseline into fragments at large horizontal gaps;
 *  4. turns stacked numerator / denominator runs into "{a/b}" fraction tokens
 *     placed inside the line they belong to;
 *  5. tags every fragment: body, heading, chapter-title, aside (side box),
 *     bubble (cartoon speech), furniture (running head, folio).
 *
 * Pure functions: works on pdf.js TextContent in the browser and in Node tests.
 */

export interface RawItem {
  str: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Font family reported by pdf.js ("serif", "sans-serif", "monospace"). */
  family?: string;
  fontName?: string;
}

export type FragmentRole = 'body' | 'heading' | 'chapter-title' | 'aside' | 'bubble' | 'furniture';

export interface Fragment {
  page: number;
  x0: number;
  x1: number;
  y: number;
  /** Text height (font size) of the fragment. */
  size: number;
  text: string;
  role: FragmentRole;
  /** Looks like a display formula (mostly symbols, an "=" or operators). */
  math: boolean;
}

export interface PageLayout {
  page: number;
  bodySize: number;
  /** Left edge of ordinary body text on this page. */
  bodyLeft: number;
  fragments: Fragment[];
}

/* ---------------- glyph repair ---------------- */

/** Symbol-font code points (pdf.js maps them to U+F0xx) → Unicode. */
const SYMBOL: Record<number, string> = {
  0x20: ' ', 0x21: '!', 0x28: '(', 0x29: ')', 0x2b: '+', 0x2c: ',', 0x2d: '−', 0x2e: '.', 0x2f: '/',
  0x30: '0', 0x31: '1', 0x32: '2', 0x33: '3', 0x34: '4', 0x35: '5', 0x36: '6', 0x37: '7', 0x38: '8', 0x39: '9',
  0x3a: ':', 0x3c: '<', 0x3d: '=', 0x3e: '>', 0x44: 'Δ', 0x50: 'Π', 0x53: 'Σ', 0x57: 'Ω',
  0x61: 'α', 0x62: 'β', 0x67: 'γ', 0x64: 'δ', 0x71: 'θ', 0x6c: 'λ', 0x6d: 'μ', 0x70: 'π', 0x73: 'σ', 0x66: 'φ',
  0xa2: '′', 0xa3: '≤', 0xa5: '∞', 0xab: '↔', 0xac: '←', 0xad: '↑', 0xae: '→', 0xaf: '↓', 0xb0: '°', 0xb1: '±',
  0xb3: '≥', 0xb4: '×', 0xb5: '∝', 0xb8: '÷', 0xb9: '≠', 0xba: '≡', 0xbb: '≈', 0xd0: '∠', 0xd6: '√', 0xd7: '·',
  0xde: '⇒', 0xdb: '⇔', 0xa7: '♣',
};

export function repairGlyphs(s: string): string {
  let out = '';
  for (const ch of s) {
    const k = ch.codePointAt(0)!;
    if (k >= 0xf000 && k <= 0xf0ff) out += SYMBOL[k - 0xf000] ?? ' ';
    else if (k >= 0xe000 && k <= 0xf8ff) out += ' ';
    else if (ch === '–' || ch === '−') out += '−';
    else if (ch === '’') out += "'";
    else out += ch;
  }
  return out;
}

/* ---------------- helpers ---------------- */

function mode(values: Array<[number, number]>): number {
  const m = new Map<number, number>();
  for (const [v, w] of values) m.set(v, (m.get(v) ?? 0) + w);
  let best = 0;
  let bw = -1;
  for (const [v, w] of m) if (w > bw) [best, bw] = [v, w];
  return best;
}

const WORD = /[A-Za-zഀ-ൿ]{3,}/g;

/** Mostly symbols / short tokens with an operator → display maths. */
export function looksLikeMath(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  const words = (t.match(WORD) ?? []).filter((w) => !/^(and|or|sq|cm|kg|m)$/i.test(w));
  const ops = (t.match(/[=+−×÷<>≤≥≈]/g) ?? []).length;
  if (/^\(\d+\)\s+[A-Z]/.test(t)) return false; // exercise "(1) The price…"
  return ops >= 1 && words.length <= 1 && /[=<>≤≥≈]|[0-9a-z)]\s*[+−×÷]\s*[0-9a-z(]/.test(t);
}

/* ---------------- main ---------------- */

interface Run {
  x0: number;
  x1: number;
  y: number;
  h: number;
  text: string;
  family?: string;
}

/**
 * Lay out one page. `pageWidth`/`pageHeight` in PDF units (for furniture zones).
 */
export function layoutPage(page: number, rawItems: RawItem[], pageHeight = 792, bodyHint?: number): PageLayout {
  // Repair glyphs, drop empty runs and duplicated "shadow" text (titles are often printed twice).
  const items: RawItem[] = [];
  for (const it0 of rawItems) {
    if (!it0.str || it0.h <= 0.5) continue;
    const str = repairGlyphs(it0.str);
    if (!str.trim()) continue;
    const w = it0.w > 0.5 ? it0.w : str.length * it0.h * 0.5;
    if (items.some((o) => o.str === str && Math.abs(o.x - it0.x) < 3 && Math.abs(o.y - it0.y) < 3)) continue;
    items.push({ ...it0, str, w });
  }

  const bodySize = bodyHint ?? mode(items.map((it) => [Math.round(it.h), it.str.length] as [number, number]));
  const small = (h: number) => h < bodySize * 0.93;

  // ---- stacked fractions (item level) ----
  // Fraction parts: digits, single-letter variables and operators only ("x + 1", "12", "y").
  const isFracItem = (it: RawItem) =>
    small(it.h) && it.h >= bodySize * 0.6 && it.str.trim().length <= 10 && /^[\s\d.a-zA-Z+−=×÷()]+$/.test(it.str) && !/[A-Za-z]{2,}/.test(it.str);
  const fracItems = items.filter(isFracItem);
  // Group small items on the same baseline that touch each other ("x", "+", "1" → "x + 1").
  const groups: Array<{ x0: number; x1: number; y: number; text: string; members: RawItem[] }> = [];
  // Same baseline first (within 1.5 units), then left to right.
  const byRow = [...fracItems].sort((a, b) => b.y - a.y);
  const rowKey = new Map<RawItem, number>();
  let rk = 0;
  byRow.forEach((it, i) => {
    if (i && Math.abs(byRow[i - 1].y - it.y) > 1.5) rk++;
    rowKey.set(it, rk);
  });
  for (const it of [...fracItems].sort((a, b) => rowKey.get(a)! - rowKey.get(b)! || a.x - b.x)) {
    const g = groups.find((g) => Math.abs(g.y - it.y) < 1.5 && it.x - g.x1 < bodySize * 0.55 && it.x >= g.x0 - 1);
    if (g) {
      g.text += (it.x - g.x1 > bodySize * 0.1 ? ' ' : '') + it.str;
      g.x1 = Math.max(g.x1, it.x + it.w);
      g.members.push(it);
    } else groups.push({ x0: it.x, x1: it.x + it.w, y: it.y, text: it.str, members: [it] });
  }
  const consumed = new Set<RawItem>();
  const synthetic: RawItem[] = [];
  const pairedGroups = new Set<number>();
  groups.forEach((top, i) => {
    if (pairedGroups.has(i)) return;
    let best = -1;
    let bestD = Infinity;
    groups.forEach((b, j) => {
      if (j === i || pairedGroups.has(j)) return;
      const dy = top.y - b.y;
      if (dy < bodySize * 0.45 || dy > bodySize * 1.35) return;
      const overlap = Math.min(top.x1, b.x1) - Math.max(top.x0, b.x0);
      if (overlap < -2) return;
      const d = dy + Math.abs((top.x0 + top.x1) / 2 - (b.x0 + b.x1) / 2);
      if (d < bestD) [best, bestD] = [j, d];
    });
    if (best < 0) return;
    const b = groups[best];
    // A numerator or denominator never contains "=": that is a small equation in a side box.
    if (/=/.test(top.text) || /=/.test(b.text)) return;
    pairedGroups.add(i);
    pairedGroups.add(best);
    top.members.forEach((m) => consumed.add(m));
    b.members.forEach((m) => consumed.add(m));
    synthetic.push({
      str: `{${top.text.trim()}/${b.text.trim()}}`,
      x: Math.min(top.x0, b.x0),
      y: (top.y + b.y) / 2,
      w: Math.max(top.x1, b.x1) - Math.min(top.x0, b.x0),
      h: bodySize,
      family: top.members[0].family,
    });
  });
  // Snap each fraction onto the body baseline it sits in (if any), so it joins that line in x order.
  const work: RawItem[] = items.filter((it) => !consumed.has(it));
  for (const f of synthetic) {
    const host = work
      .filter((it) => !small(it.h) && Math.abs(it.y - f.y) < bodySize * 0.75)
      .sort((a, b) => Math.abs(a.y - f.y) - Math.abs(b.y - f.y))[0];
    // Unpaired small symbols on the fraction's centre line ("=") join it too.
    if (host) f.y = host.y;
    else for (const it of work) if (small(it.h) && Math.abs(it.y - f.y) < bodySize * 0.4 && it.str.trim().length <= 2) it.h = bodySize;
    work.push(f);
  }

  // Baselines (rows), top to bottom.
  const sorted = [...work].sort((a, b) => b.y - a.y || a.x - b.x);
  const rows: Array<{ y: number; items: RawItem[] }> = [];
  for (const it of sorted) {
    const row = rows.find((r) => Math.abs(r.y - it.y) < Math.max(2.2, it.h * 0.25));
    if (row) row.items.push(it);
    else rows.push({ y: it.y, items: [it] });
  }

  // Split each row into runs at large gaps; never merge different sizes or families into one run.
  const runs: Run[] = [];
  for (const row of rows) {
    row.items.sort((a, b) => a.x - b.x);
    let cur: Run | null = null;
    for (const it of row.items) {
      const gap = cur ? it.x - cur.x1 : 0;
      const sizeJump = cur ? Math.abs(it.h - cur.h) > bodySize * 0.06 : false;
      // Cartoon speech is set in a sans face; symbol glyphs (− × from the Symbol font) also report sans, so only words count.
      const famJump = cur ? (it.family ?? '') !== (cur.family ?? '') && /sans/.test(it.family ?? '') && /[A-Za-z]{3,}/.test(it.str) : false;
      if (!cur || gap > Math.max(24, bodySize * 1.9) || sizeJump || famJump) {
        cur = { x0: it.x, x1: it.x + it.w, y: row.y, h: it.h, text: it.str, family: it.family };
        runs.push(cur);
      } else {
        const frac = /^\{/.test(it.str) || /\}$/.test(cur.text);
        const glue = (gap > bodySize * 0.12 || frac) && !/\s$/.test(cur.text) && !/^\s/.test(it.str) ? ' ' : '';
        cur.text += glue + it.str;
        cur.x1 = Math.max(cur.x1, it.x + it.w);
      }
    }
  }

  const frags: Fragment[] = runs.map((r) => ({
    page,
    x0: r.x0,
    x1: r.x1,
    y: r.y,
    size: r.h,
    text: r.text.replace(/\s+/g, ' ').trim(),
    role: 'body' as FragmentRole,
    math: false,
  }));

  // Body left edge = the leftmost x0 shared by at least two long body-size lines
  // (exercise lists are indented and can outnumber ordinary lines on a page).
  const lefts = new Map<number, number>();
  for (const f of frags) if (Math.abs(f.size - bodySize) < 0.6 && f.text.length > 40) lefts.set(Math.round(f.x0), (lefts.get(Math.round(f.x0)) ?? 0) + 1);
  const bodyLeft = [...lefts].filter(([, n]) => n >= 2).map(([x]) => x).sort((a, b) => a - b)[0] ?? 0;

  for (const f of frags) {
    const relSize = f.size / bodySize;
    const edge = f.y > pageHeight - 90 || f.y < 50;
    if (edge && (f.text.length < 40 || /^\d+$/.test(f.text))) f.role = 'furniture';
    else if (relSize >= 1.9) f.role = 'chapter-title';
    else if (relSize >= 1.15 && f.text.length < 80 && /[A-Za-z\u0D00-\u0D7F]{3,}/.test(f.text)) f.role = 'heading';
    else if (f.size < bodySize * 0.6) f.role = 'furniture';
    else if (/sans/i.test(rawFamily(f, items)) && small(f.size)) f.role = 'bubble';
    else if (small(f.size) && !/^\{.*\}$/.test(f.text)) f.role = 'aside';
    f.math = looksLikeMath(f.text) || /^\{[^{}]+\}$/.test(f.text);
  }
  // A short body-size title sitting right above an aside block belongs to that side box.
  for (const f of frags) {
    if (f.role !== 'body' || f.math || f.text.length > 34 || /[.?:,]$/.test(f.text)) continue;
    const below = frags.find((g) => g.role === 'aside' && f.y - g.y > 4 && f.y - g.y < bodySize * 2.4 && Math.abs(g.x0 - f.x0) < 60);
    if (below && f.x0 > (bodyLeft || 57) + 40) f.role = 'aside';
  }
  frags.sort((a, b) => b.y - a.y || a.x0 - b.x0);
  return { page, bodySize, bodyLeft: bodyLeft || 57, fragments: frags };
}

function rawFamily(f: Fragment, raw: RawItem[]): string {
  const hit = raw.find((r) => Math.abs(r.y - f.y) < 1 && r.x >= f.x0 - 1 && r.x <= f.x1);
  return hit?.family ?? '';
}

/** Convert pdf.js getTextContent() output to RawItems. */
export function rawItemsFromPdfjs(content: {
  items: Array<{ str?: string; transform?: number[]; width?: number; height?: number; fontName?: string }>;
  styles?: Record<string, { fontFamily?: string }>;
}): RawItem[] {
  return content.items
    .filter((it) => typeof it.str === 'string' && it.transform)
    .map((it) => ({
      str: it.str!,
      x: it.transform![4],
      y: it.transform![5],
      w: Number(it.width ?? 0),
      h: Number(it.height ?? 0),
      fontName: it.fontName,
      family: it.fontName ? content.styles?.[it.fontName]?.fontFamily : undefined,
    }));
}
