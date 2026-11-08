# AI Guru V51.9.6 — QA regeneration fix

## Screenshot diagnosis
The Page 7 run reached the visual QA gate correctly, but the Gemini-unavailable local Teacher-Reading fallback had no regeneration loop. The fallback built one lesson, QA rejected it (`text/LaTeX node pairs overlap`), and the API returned HTTP 422 immediately.

## Fix
The local Teacher-Reading fallback now:
1. Builds the textbook-grounded fallback lesson.
2. Runs visual/mathematical QA.
3. On failure, regenerates the fallback lesson from the textbook and applies deterministic full-board visual layout repair.
4. Re-runs QA and compilation.
5. Repeats up to 3 regeneration/repair passes.
6. Returns 422 only if all 3 passes fail.
7. Returns a `regeneration` array so the UI/server log can expose each attempt.

## Layout repair
`repairTeacherVisualLayout()` reflows text/LaTeX drawable nodes across the 1000x700 teaching board safe area, keeping the reading/explanation/source-cue data unchanged. It prevents overlapping text/LaTeX pairs while preserving the deterministic solver visuals and recolor/motion actions.

## Important
The QA gate remains fail-closed. A failed scene is never presented as a successful lesson.

## Browser acceptance test
Use the Page 7 beads problem:
- `b + w = 100`
- `b = w + 10`
- `b = 55`
- `w = 45`

If the first generated scene fails QA, the log must show regeneration/repair attempt(s). A later successful attempt must render actual equations/visuals across the whiteboard. If all 3 fail, the class must show an explicit error rather than an empty/text-only board.
