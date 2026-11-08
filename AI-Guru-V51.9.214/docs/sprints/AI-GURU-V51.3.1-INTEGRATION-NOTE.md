# AI Guru V51.3.1 — Token Move Integration

This full build merges the supplied `AI-Guru-V51.3.1-token-move-fix` patch into the V51.3 Teaching Pipeline Log application.

Integrated files:
- `app/api/ai-guru/math/plan/route.ts`
- `lib/ai-guru/math/planner/gemini.ts`
- `lib/ai-guru/math/planner/validate.ts`
- `lib/ai-guru/math/planner/validate.test.ts`

The V51.3 PDF/video/page fixes, whiteboard text-wall guard, class status, and Teaching Pipeline Log remain in the full application.

Validation performed in packaging environment:
- AI Guru integration audit: PASS
- Reference video library: PASS (20 assets)
- Visual template library: PASS (18 templates)
- Math RAG audit: ready (5,791 video entries; 401 Manim entries; 28 golden-set files)

Full npm/Vitest execution was not possible because the source archive does not include installed `node_modules`.
