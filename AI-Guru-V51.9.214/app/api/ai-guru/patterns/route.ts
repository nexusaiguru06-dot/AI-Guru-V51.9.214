import { NextResponse } from 'next/server';
import { PATTERNS, actionsToSvg, buildPattern, getPattern, searchPatterns, verifyVisualActions } from '@/lib/ai-guru/patterns';

/** GET /api/ai-guru/patterns?q=pythagoras+hypotenuse&k=3   (no q: the whole library) */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = (url.searchParams.get('q') || '').slice(0, 400);
  const k = Math.max(1, Math.min(14, Number(url.searchParams.get('k')) || 3));
  const meta = (p: (typeof PATTERNS)[number]) => ({ id: p.id, name: p.name, summary: p.summary, whenToUse: p.whenToUse, domains: p.domains, concepts: p.concepts, params: p.params, example: p.example });
  if (!q) return NextResponse.json({ ok: true, count: PATTERNS.length, patterns: PATTERNS.map(meta) });
  const hits = searchPatterns(q, { k, domain: url.searchParams.get('domain') || undefined });
  return NextResponse.json({ ok: true, query: q, hits: hits.map((h) => ({ score: h.score, matched: h.matched, direct: h.direct, ...meta(h.pattern) })) });
}

/** POST {pattern, params?, idPrefix?} -> the built actions, their dry-run result and an SVG preview. */
export async function POST(req: Request) {
  let body: { pattern?: string; params?: Record<string, unknown>; idPrefix?: string } = {};
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'Send JSON: {"pattern":"number-line","params":{...}}' }, { status: 400 }); }
  const pattern = getPattern(String(body.pattern || ''));
  if (!pattern) return NextResponse.json({ ok: false, error: `Unknown pattern. Available: ${PATTERNS.map((p) => p.id).join(', ')}` }, { status: 404 });
  const actions = buildPattern(pattern.id, body.params ?? pattern.example, body.idPrefix);
  const check = verifyVisualActions(actions);
  return NextResponse.json({ ok: check.ok, pattern: pattern.id, actions, errors: check.errors, warnings: check.warnings, svg: actionsToSvg(actions) });
}
