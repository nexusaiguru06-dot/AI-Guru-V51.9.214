# AI Guru Universal Math — AI Visual Planner

This layer makes visual teaching problem-specific rather than selecting one hard-coded template per domain.

## Runtime flow

Question → Gemini Visual Planner → validated `AIGuruMathVisualPlan` → Math.js/Mathsteps verification (when an exact expression is supplied) → `UniversalMathScene` → OpenMAIC playback/whiteboard.

The planner is constrained to a safe declarative visual vocabulary. It cannot return executable code, HTML, URLs, SVG markup, or external assets. The server validates node kinds, IDs, coordinates, graph sizes, and step references before compilation.

## API

`POST /api/ai-guru/math/plan`

```json
{"question":"Solve x^2 - 5x + 6 = 0 by factorisation","grade":10}
```

The planner returns both the generated plan and a compiled `UniversalMathScene`.

## Why this is not a fixed-template system

The model chooses the teaching representation and constructs the actual visual nodes/steps for the supplied problem. Examples include symbolic transformations, number lines, area/fraction models, geometry constructions, graph samples, data displays, vector diagrams, matrix layouts, and financial-growth diagrams. The same domain may therefore use different scenes for different problems.

## Production requirements

Set `GEMINI_API_KEY`. Keep the deterministic `/api/ai-guru/math/compile` route as a development/offline fallback. Mathematical claims should be considered verified only when an exact expression is successfully checked by the configured Math.js/Mathsteps verifier.
