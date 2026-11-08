# AI Guru V51.9.15 + Universal 3B1B (all math branches) + manim-web gap-fill

## What is in this build

1. **manim-web renderer gap-fill** (`lib/ai-guru/math/manim-web/renderer.ts`)
   - Real `NumberPlane` for grid nodes
   - Continuous matrix morph for linear-algebra style transforms
   - Camera focus best-effort
   - Existing TransformMatchingTex / token motion retained

2. **Universal 3B1B policy for all 26 math branches**
   - `lib/ai-guru/math/universal/three-b1b-universal-policy.ts`
   - `lib/ai-guru/math/teaching/apply-3b1b-all-branches.ts`
   - `lib/ai-guru/math/domains/enriched-profiles.ts`
   - `template-selector.ts` always stamps `3b1b-classroom`
   - `lesson-planner.ts` defaults + `normalizeLesson` stamp
   - `domains/index.ts` `getMathDomainProfile` overlays enriched visuals

## Run (deployable)

```bash
cd src   # this directory (Next.js root)
npm install   # or pnpm install / yarn
npm run dev
# open http://localhost:3000/ai-guru
```

Production:

```bash
npm run build
npm start
```

Requirements: Node.js >= 22.19 (see package.json engines).

## Notes

- `manim-web@^0.3.24` is already listed in package.json dependencies.
- If WebGL fails, `ThreeB1BTeachingBoard` still falls back to the SVG board.
- Algebra is no longer special-cased; every domain uses the same cinematic grammar with domain-specific objects/recipes.
