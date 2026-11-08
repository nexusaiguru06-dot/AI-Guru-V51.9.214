# AI Guru V51.8.18 — General Class Play/Start Hardening

## Defects addressed

1. **Page 7 → page 9 jump** — a physical PDF page can have no extracted paragraph. Play no longer advances the reference pane to the next extracted page. The requested physical page remains locked while the nearest readable paragraph is retained as context.
2. **Class does not start after a Gemini timeout** — the 3B1B planner now times out earlier and General Class receives a deterministic textbook-grounded fallback lesson instead of a 504.
3. **Prompt latency** — teacher-reading page/context payloads are bounded before the Gemini call.
4. **Material synchronization** — explicit page selections are protected from the selected-material auto-positioning effect during Play startup.

## Teaching behavior

The normal path remains:
`Textbook → Teacher Reading → Chapter/Lesson/Beat Video-DNA → Gemini 3B1B → Math QA → browser SVG/MathLikeAnim → bilingual TTS`.

The emergency path is only used when Gemini is unavailable/too slow:
`Textbook page/cues → deterministic Teacher-Reading lesson → Math QA → browser SVG/MathLikeAnim → bilingual TTS`.

Problems & Formulae is not changed by this fallback.

## Validation

- Modified TS/TSX syntax/transpilation: PASS for the five changed core files.
- `resolvePlayStart()` smoke test: requested page 7 remains page 7 when no paragraph exists.
- Full project typecheck/build was not run because this uploaded archive does not contain installed `node_modules`.
