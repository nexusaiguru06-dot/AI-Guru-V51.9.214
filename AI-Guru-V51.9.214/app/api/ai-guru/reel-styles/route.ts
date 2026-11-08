import { NextResponse } from 'next/server';
import raw from '@/data/ai-guru/opus-style-library.json';
import { PRO_TEMPLATES } from '@/lib/ai-guru/reels/opus/pro-templates';
import { OPUS_CATEGORIES, OpusLibrarySchema, searchRecipes, STUDIO_MODES, toCard, type OpusCategory, type OpusLibrary, type StudioMode } from '@/lib/ai-guru/reels/opus/library';

/**
 * V51.9.135 — the Opus-inspired style library, served from the server so phones never download all of it.
 *
 *   GET /api/ai-guru/reel-styles?view=recommended|all&q=space&category=science&mode=explainer&offset=0&limit=24
 *       → { total, counts, source, items: [card…] }          (cards: name, look, credit … no long text)
 *   GET /api/ai-guru/reel-styles?id=opus-…
 *       → { recipe }                                          (with the inspiration text, for the details view)
 */
let cached: OpusLibrary | null = null;
function library(): OpusLibrary {
  // checked once per server start: a bad file cannot put an unknown look, camera or font into a reel
  // V51.9.156: the Pro templates (after HyperFrames) come first, checked like the rest
  if (!cached) { const lib = OpusLibrarySchema.parse(raw); const pro = PRO_TEMPLATES.map((r) => OpusLibrarySchema.shape.recipes.element.parse(r)); cached = { ...lib, recipes: [...pro, ...lib.recipes], counts: { ...lib.counts, kept: lib.counts.kept + pro.length, recommended: lib.counts.recommended + pro.length } }; }
  return cached;
}

export async function GET(req: Request) {
  let lib: OpusLibrary;
  try {
    lib = library();
  } catch (e) {
    return NextResponse.json({ ok: false, error: `Style library file is not valid: ${(e as Error).message.slice(0, 300)}` }, { status: 500 });
  }
  const url = new URL(req.url);
  const id = url.searchParams.get('id');
  if (id) {
    const recipe = lib.recipes.find((r) => r.id === id);
    if (!recipe) return NextResponse.json({ ok: false, error: 'No such style.' }, { status: 404 });
    return NextResponse.json({ ok: true, recipe }, { headers: { 'cache-control': 'public, max-age=3600' } });
  }
  const category = url.searchParams.get('category') as OpusCategory | 'all' | null;
  const mode = url.searchParams.get('mode') as StudioMode | null;
  const res = searchRecipes(lib.recipes, {
    q: (url.searchParams.get('q') || '').slice(0, 120),
    category: category && (category === 'all' || OPUS_CATEGORIES.includes(category)) ? category : 'all',
    mode: mode && STUDIO_MODES.includes(mode) ? mode : undefined,
    view: url.searchParams.get('view') === 'all' ? 'all' : 'recommended',
    offset: Number(url.searchParams.get('offset')) || 0,
    limit: Number(url.searchParams.get('limit')) || 24,
  });
  return NextResponse.json(
    { ok: true, total: res.total, counts: lib.counts, source: lib.source, items: res.items.map(toCard) },
    { headers: { 'cache-control': 'public, max-age=600' } },
  );
}
