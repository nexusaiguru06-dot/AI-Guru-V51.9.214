# V51.9.11 — manim-web installation / verification

This build makes `manim-web@0.3.24` the primary 3B1B renderer.

## First run

From the project root:

```bash
npm install
npm run build
npm run dev
```

`npm install` is intentional: the supplied development environment did not have `node_modules`, and the dependency lockfile could not be refreshed without registry access. npm will resolve `manim-web` and its transitive dependencies and update `package-lock.json` locally.

## What to test

1. Open `/ai-guru`.
2. Start the Class 8 Page 7 lesson.
3. Confirm the board is a WebGL canvas (`data-renderer="manim-web"`).
4. Confirm equations are rendered as vector MathTex, not ordinary SVG/HTML text.
5. Confirm equation transformations visibly morph/match terms.
6. Confirm highlights scale/color and return to the original state.
7. Drag the timeline backwards and forwards; the WebGL scene must seek without duplicating objects.
8. Confirm the existing Malayalam/English TTS clock continues to drive the same visual time.
9. If WebGL cannot initialize, the old deterministic SVG board is used as a fallback and a warning is written to the classroom log.

## Important

Do not let Gemini emit manim-web code. Gemini continues to emit the constrained AI Guru Scene IR. The renderer adapter is the only place that knows the manim-web API.
