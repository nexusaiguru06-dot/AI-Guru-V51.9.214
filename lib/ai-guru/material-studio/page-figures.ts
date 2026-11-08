/**
 * V51.9.141 — the pictures on a textbook page: photos and drawings (raster images, and vector drawings such as
 * geometry figures and cartoons), found from the PDF itself, with the text written inside them (labels) and the text
 * right next to them (the caption). The classroom shows each one on the whiteboard and explains it.
 *
 * Pure geometry (no pdfjs here): `figuresFromOps` takes the page's operator list and text items; the route renders
 * the crops. Coordinates are PDF points with the origin at the TOP-left of the page.
 */

export interface Box { x: number; y: number; w: number; h: number }
export interface TextBit { str: string; box: Box }
export interface PageFigure {
  box: Box;
  /** 'image' when a photo / raster picture is in it, otherwise 'drawing'. */
  kind: 'image' | 'drawing';
  /** Text written inside the figure (labels, names). */
  inside: string;
  /** Text just above or below it (a caption, "Figure 3.2 …"). */
  near: string;
}

type M = [number, number, number, number, number, number];
const mul = (m: M, n: M): M => [
  m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5],
];
const apply = (m: M, x: number, y: number): [number, number] => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
function boxOf(m: M, x0: number, y0: number, x1: number, y1: number, pageH: number): Box {
  const pts = [apply(m, x0, y0), apply(m, x1, y0), apply(m, x0, y1), apply(m, x1, y1)];
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => pageH - p[1]);
  const x = Math.min(...xs), y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}
const area = (b: Box) => Math.max(0, b.w) * Math.max(0, b.h);
const grow = (b: Box, d: number): Box => ({ x: b.x - d, y: b.y - d, w: b.w + 2 * d, h: b.h + 2 * d });
const overlaps = (a: Box, b: Box) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const union = (a: Box, b: Box): Box => {
  const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
  return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y };
};
const inter = (a: Box, b: Box) => {
  const x0 = Math.max(a.x, b.x), y0 = Math.max(a.y, b.y), x1 = Math.min(a.x + a.w, b.x + b.w), y1 = Math.min(a.y + a.h, b.y + b.h);
  return x1 > x0 && y1 > y0 ? (x1 - x0) * (y1 - y0) : 0;
};

/** The pdfjs operator codes we need (pdfjs.OPS), passed in so this file stays free of pdfjs. */
export interface Ops { save: number; restore: number; transform: number; constructPath: number; paintImageXObject: number; paintInlineImageXObject: number; paintImageMaskXObject: number; paintFormXObjectBegin: number; paintFormXObjectEnd: number }

/**
 * The figures of a page. `fnArray` / `argsArray` = page.getOperatorList(); `text` = the page's text items in top-left
 * coordinates; `pageW` × `pageH` = the page size in points.
 */
export function figuresFromOps(fnArray: number[], argsArray: unknown[][], OPS: Ops, text: TextBit[], pageW: number, pageH: number): PageFigure[] {
  const pageA = pageW * pageH;
  let ctm: M = [1, 0, 0, 1, 0, 0];
  const stack: M[] = [];
  const marks: Array<{ box: Box; image: boolean }> = [];
  for (let i = 0; i < fnArray.length; i++) {
    const fn = fnArray[i];
    const args = (argsArray[i] ?? []) as unknown[];
    if (fn === OPS.save) stack.push(ctm);
    else if (fn === OPS.restore) ctm = stack.pop() ?? ctm;
    else if (fn === OPS.transform) ctm = mul(ctm, args as unknown as M);
    else if (fn === OPS.paintFormXObjectBegin) {
      stack.push(ctm);
      const mat = args[0] as M | null;
      if (Array.isArray(mat) && mat.length === 6) ctm = mul(ctm, mat);
    } else if (fn === OPS.paintFormXObjectEnd) ctm = stack.pop() ?? ctm;
    else if (fn === OPS.paintImageXObject || fn === OPS.paintInlineImageXObject || fn === OPS.paintImageMaskXObject) {
      const b = boxOf(ctm, 0, 0, 1, 1, pageH);
      if (area(b) > 400) marks.push({ box: b, image: true });
    } else if (fn === OPS.constructPath) {
      // pdfjs 4.x: [ops, coords, minMax]; minMax = [minX, minY, maxX, maxY] in the path's own space
      const mm = args[2] as number[] | null | undefined;
      if (Array.isArray(mm) && mm.length === 4 && mm.every(Number.isFinite) && mm[2] >= mm[0] && mm[3] >= mm[1]) {
        const b = boxOf(ctm, mm[0], mm[1], mm[2], mm[3], pageH);
        // a page-wide rule or frame says nothing about a picture
        if (b.w > pageW * 0.9 || b.h > pageH * 0.9) continue;
        if (b.w < 0.5 && b.h < 0.5) continue;
        marks.push({ box: b, image: false });
      }
    }
  }
  // group the marks that touch (a drawing is many small paths)
  type G = { box: Box; image: boolean; n: number; ink: number };
  let groups: G[] = marks.map((m) => ({ box: m.box, image: m.image, n: 1, ink: area(m.box) }));
  for (let changed = true; changed; ) {
    changed = false;
    outer: for (let a = 0; a < groups.length; a++) {
      for (let b = a + 1; b < groups.length; b++) {
        if (overlaps(grow(groups[a].box, 6), groups[b].box)) {
          groups[a] = { box: union(groups[a].box, groups[b].box), image: groups[a].image || groups[b].image, n: groups[a].n + groups[b].n, ink: groups[a].ink + groups[b].ink };
          groups.splice(b, 1);
          changed = true;
          break outer;
        }
      }
    }
  }
  const textIn = (b: Box) => text.filter((t) => inter(t.box, b) > area(t.box) * 0.5);
  groups = groups.filter((g) => {
    const a = area(g.box);
    if (a > pageA * 0.85) return false; // the page's own background
    if (g.box.w < 36 || g.box.h < 30) return false; // a bullet, an underline, a small icon
    if (a < pageA * (g.image ? 0.012 : 0.02)) return false;
    if (g.image) return true;
    // a drawing needs several strokes (one rectangle is a box around text, not a picture)
    if (g.n < 4) return false;
    // a shaded box with mostly text in it is a text panel, not a figure
    const covered = textIn(g.box).reduce((s, t) => s + inter(t.box, g.box), 0);
    return covered / a < 0.3;
  });
  // the picture's own short labels just outside its lines (A, B, C at the corners of a triangle) belong to it
  for (const g of groups) {
    for (const t of text) {
      const str = t.str.trim();
      if (!str || str.length > 3) continue;
      if (overlaps(grow(g.box, 14), t.box)) g.box = union(g.box, t.box);
    }
  }
  groups.sort((p, q) => p.box.y - q.box.y || p.box.x - q.box.x);
  return groups.slice(0, 6).map((g) => {
    const inside = textIn(g.box).map((t) => t.str.trim()).filter(Boolean).join(' ').replace(/\s+/g, ' ').slice(0, 300);
    const band: Box = { x: g.box.x - 20, y: g.box.y - 28, w: g.box.w + 40, h: g.box.h + 56 };
    const near = text
      .filter((t) => inter(t.box, band) > 0 && !(inter(t.box, g.box) > area(t.box) * 0.5))
      .map((t) => t.str.trim()).filter(Boolean).join(' ').replace(/\s+/g, ' ').slice(0, 300);
    return { box: g.box, kind: g.image ? 'image' : 'drawing', inside, near };
  });
}

/** pdfjs text items (transform in PDF space) → boxes with the origin at the top-left. */
export function textBits(items: Array<{ str?: string; transform?: number[]; width?: number; height?: number }>, pageH: number): TextBit[] {
  const out: TextBit[] = [];
  for (const it of items) {
    if (!it.str || !it.transform) continue;
    const [, , , d, e, f] = it.transform;
    const h = Math.abs(it.height || d || 10);
    out.push({ str: it.str, box: { x: e, y: pageH - f - h, w: Math.max(1, it.width || 0), h } });
  }
  return out;
}
