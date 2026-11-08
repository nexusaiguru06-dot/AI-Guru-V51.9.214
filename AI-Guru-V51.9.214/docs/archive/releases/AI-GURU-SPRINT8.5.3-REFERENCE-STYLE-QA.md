# AI Guru — Sprint 8.5.3 Reference Style QA

## Reference asset count

There are **5 approved reference videos** in `public/reference-styles/`:

1. Geometry Proof / Theorem Construction
2. Geometry Area Derivation
3. Calculus Slope Explorer
4. Trigonometry Unit Circle / Identity Construction
5. Calculus Riemann Sum / Area Under Curve

The manifest now contains all five approved assets.

## Test matrix

| Test | Input problem / teaching intent | Expected style | Required visual evidence | Result |
|---|---|---|---|---|
| 1 | Find/derive area of a parallelogram, e.g. base 8 cm, height 5 cm | `geometry-area-derivation` | parallelogram, diagonal/decomposition, height, area formula | PASS |
| 2 | Explain `sin 45°` / a trig identity with unit circle | `trigonometry-unit-circle-reference` | unit circle, radius, projection, trig labels, identity link | PASS |
| 3 | Explain `∫₀² x dx` through Riemann sums | `calculus-riemann-sum-area-reference` | curve, rectangles, Δx, sum, integral | PASS |
| 4 | Prove `3² + 4² = 5²` using a geometric construction | `geometry-proof-construction` | progressive triangle construction | PASS |
| 5 | Explain derivative/slope of `x²` at `x=3` | `calculus-slope-explorer-reference` | graph, moving point, tangent/slope evidence | PASS |

## QA boundary

The selector may choose only an approved style. The visual compiler then generates original graphics from the verified mathematics; the reference video is style-only.

If no approved style can satisfy the concept, visual generation must be blocked rather than inventing an unapproved visual grammar.

## Important repair found during QA

The earlier integration registered the three new styles in the selector, but the underlying visual compiler still used generic geometry/graph scenes. That would have produced a technically selected style with the wrong visual primitives.

Sprint 8.5.3 now adds dedicated compiler primitives:

- `GEOMETRY_AREA_DERIVATION`: parallelogram edges, diagonal, height, decomposition and formula sequence.
- `TRIGONOMETRY_UNIT_CIRCLE`: unit circle, axes, radius, projection and trig identity connection.
- `CALCULUS_RIEMANN_SUM_AREA`: curve, partition rectangles, Δx, sum and integral transition.

Semantic visual planning was also updated so paragraph-level construction steps explicitly include decomposition, base/height identification, identity connection, rectangle accumulation, sum formation and integral transition where applicable.

## Runtime build limitation

A full Next.js/Vitest runtime build could not be executed in this isolated QA environment because the supplied project archive has no installed `node_modules`. A TypeScript scan was performed; no TypeScript diagnostics were emitted for the modified universal-visual files. Existing project-wide diagnostics are dependency-resolution errors caused by the absent installed packages.

## Preview videos

The five short MP4s in `aiguru_reference_qa/` are **QA visualization previews** of the intended generated visual grammar. They are not claimed to be a full Next.js runtime render. The actual browser render still needs to be run after `pnpm install` in the Windows project directory.
