# AI Guru Sprint 8.5.4 — Reference-Quality Animation Repair

## Goal
Move the five approved reference styles from category-level selection toward slower, clearer, teacher-like visual teaching while preserving AI Guru's own verified mathematics and graphics engine.

## Defects found and repaired

1. **Animation too fast** — draw actions were effectively ~320 ms in MathLikeAnimBoard and the compiler used short generic event durations.
   - Repaired with style-specific pacing profiles and action-level duration propagation.
   - Reference-derived styles now use deliberate 1.35–1.65 s step pacing with longer emphasis gaps.

2. **Style selection was not authoritative in AI planning** — `/math/plan` used `general` when no explicit domain was supplied.
   - Repaired by detecting the mathematical domain from the question before style selection.

3. **AI planning route hard-coded a 3-second verification compile**.
   - Removed the hard-coded duration so the selected style controls pacing.

4. **Renderer ignored compiler timing** — `MathLikeAnimBoard` used a hard-coded 320 ms draw duration.
   - Repaired: every generated draw action carries its event duration to the renderer.

5. **No deliberate pauses between visual beats**.
   - Repaired: event gaps are converted to paragraph-scoped pause actions.

6. **Reference style selected but visual appearance remained generic**.
   - Repaired with style-aware palettes and reference-specific emphasis/fill treatment.

7. **Geometry area derivation was too skeletal**.
   - Repaired with vertex labels, base/height labels, diagonal emphasis, right-angle marker, decomposition note and formula emergence.

8. **Riemann reference was represented as one fixed rectangle set**.
   - Repaired with coarse-to-fine partition stages, Δx emphasis, summation and integral transition.

9. **Bilingual visual narration was missing from universal scene cues**.
   - Added English + Malayalam cue text; the existing Chilanka font path remains the Malayalam handwriting font.

10. **Reference asset/selector/compiler drift risk**.
   - Added `audit:reference-quality` to verify all approved assets, selector coverage, pacing, renderer duration and domain-aware planning.

## Approved reference count

Five approved videos remain in `public/reference-styles/`:

- Geometry Proof / Theorem Construction
- Geometry Area Derivation
- Calculus Slope Explorer
- Trigonometry Unit Circle / Identity Construction
- Calculus Riemann Sum / Area Under Curve

## QA boundary

Reference videos are style-only. They do not supply mathematical answers or copied content. Math verification remains authoritative. Visual Step QA remains paragraph/visual-step scoped, and recovery must not regenerate unrelated paragraphs.

## Runtime requirement

The archive still requires `pnpm install` on the Windows development machine before `pnpm run build`, `pnpm test` and browser/E2E testing can be executed. Static audits do not replace the final browser render QA.
