/**
 * Point lists for round and angular marks (V51.9.25). The engine draws every figure as a pen-drawn
 * polyline, so a circle, an angle arc and a right-angle mark are just well-chosen points: they get
 * the same pen animation, dark theme, camera and export as every other shape.
 */

export type Pt = [number, number];

/** A closed circle as a many-sided polygon (96 sides is round at any size this board uses). */
export function circlePts(cx: number, cy: number, r: number, n = 96): Pt[] {
  const pts: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return pts;
}

/** An open arc of radius r about (cx, cy) from angle a0 to a1 (radians, screen coordinates: y points down). */
export function arcPts(cx: number, cy: number, r: number, a0: number, a1: number, n = 24): Pt[] {
  const pts: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return pts;
}

/** The small square that marks a right angle at v, between directions u1 and u2 (unit vectors), size s. */
export function rightAnglePts(v: Pt, u1: Pt, u2: Pt, s: number): Pt[] {
  const p1: Pt = [v[0] + u1[0] * s, v[1] + u1[1] * s];
  const p2: Pt = [p1[0] + u2[0] * s, p1[1] + u2[1] * s];
  const p3: Pt = [v[0] + u2[0] * s, v[1] + u2[1] * s];
  return [p1, p2, p3];
}

/** The arc between the two rays v→p and v→q (the shorter sweep), plus where its label should sit. */
export function angleArc(v: Pt, p: Pt, q: Pt, r: number, labelGap = 20): { arc: Pt[]; label: Pt; degrees: number } {
  const a0 = Math.atan2(p[1] - v[1], p[0] - v[0]);
  let a1 = Math.atan2(q[1] - v[1], q[0] - v[0]);
  let d = a1 - a0;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  a1 = a0 + d;
  const mid = a0 + d / 2;
  return {
    arc: arcPts(v[0], v[1], r, a0, a1),
    label: [v[0] + (r + labelGap) * Math.cos(mid), v[1] + (r + labelGap) * Math.sin(mid)],
    degrees: Math.abs(d) * (180 / Math.PI),
  };
}
