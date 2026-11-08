# AI Guru V51.8.7 — Class Start/Stop + Template Visual Fix

## Fixes
- Reuse an already loaded General Class material immediately instead of regenerating it.
- Reduce first Lesson Architect context from 64/36 paragraphs to 16/8 to reduce startup latency while preserving chapter context.
- Add timing diagnostics for Lesson Architect generation.
- Do not show `STOPPED / Complete` between material batches when the lesson is auto-continuing.
- Only mark the class stopped when the lesson really reaches its final paragraph.
- General Class solvable pair-of-linear-equations word problems can use the deterministic derivation template even if Material Studio omitted `mathSteps`.
- Suppress isolated generic rectangle/placeholder visuals in legacy fallback playback.
- Remove visible empty figure border/background so the visual container itself cannot look like a teaching square.

## Separation
Problems & Formulae remains on its dedicated visual grammar. Whiteboard Notes / General Class remains separate.
