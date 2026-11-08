# AI Guru Sprint 8.5 — Visual Style Selector + Reference Style Library

The style system selects a teaching animation style from the mathematical situation. Reference videos are treated as style-only references; their mathematical technique/content is never copied.

## Flow

Paragraph/question → Math Agent → Math Verification → Visual Style Selector → Visual Step Agent → Universal Visual Compiler → existing AI Guru renderer → 15-point Visual Step QA → targeted recovery.

## Built-in/reference styles
- AI Guru Standard
- Easy Equation Transformation (reference-video)
- Concept Explanation (reference-video)
- Geometry Construction
- Graph Explorer
- Fraction Visual
- Trigonometry Visual
- Calculus Cinematic
- Calculus Slope Explorer — Reference (progressive tangent/slope style)
- Statistics Build
- 3D Math Explorer

## Selection
A teacher may explicitly choose a style. Otherwise selection scores domain, visual mode, mathematical keywords and bilingual caption support. The result is stored in `UniversalMathScene.visualStyle` so the UI, logs and video renderer can use the same decision.

## API
- `GET /api/ai-guru/visual-style` lists profiles.
- `POST /api/ai-guru/visual-style` selects a profile.
- `/api/ai-guru/math/compile` accepts `preferredStyle` and `bilingual`.
- `/api/ai-guru/math/plan` accepts `preferredStyle` and `bilingual`.

## Added reference
- `public/reference-styles/calculus-slope-explorer.webm` is a style-only reference. It is used to guide presentation characteristics (progressive tangent movement, point tracking, slope-value emphasis and graph comparison), not to copy mathematical content.

The Calculus Slope Explorer reference is previewable in Universal Math Studio when selected/returned by the compiler. The selector gives it extra weight for slope, tangent, secant, gradient, derivative and rate-of-change situations.

## Sprint 8.5.1 — Geometry-proof reference + direct style enforcement

The Visual Step/Planner path now selects a style before Gemini planning and passes the selected style's video prompt and required Visual Step QA checks into the generation prompt. The new Geometry Proof / Theorem Construction reference is stored at `public/reference-styles/geometry-proof-construction.mp4`.

Style selection is paragraph/problem aware and gives the geometry-proof reference priority for theorem, proof, congruence, similarity, Pythagoras, bisector and construction situations. The planner returns `visualStyleId` and per-step `visualChecks`; the Visual Step Agent records the selected style and required checks on paragraph-scoped actions. Visual Step QA enforces only the checks declared for that generated step and failures remain paragraph/step scoped for targeted recovery.


## Sprint 8.5.2 — Trigonometry + Riemann-sum references
- `public/reference-styles/trigonometry-unit-circle-reference.mp4` — dynamic unit-circle / trigonometric identity teaching reference.
- `public/reference-styles/calculus-riemann-sum-area-reference.mp4` — curve-to-rectangles / Riemann-sum / definite-integral conceptual reference.

The selector gives the unit-circle reference priority for trigonometric identities, unit-circle, angle and projection situations, and gives the Riemann-sum reference priority for definite-integral, partition, rectangle-sum and area-under-curve conceptual situations. Both references are style-only; lesson mathematics remains generated and verified by AI Guru.
