# AI Guru V51.1 — Whiteboard Text-Wall Fix

This patch enforces separation between narration/captions and the mathematical whiteboard.

## Fixed
- `playStepBar()` no longer copies spoken `caption` prose into the whiteboard row label.
- Step-only rows now show only a compact `Step N` marker (or Malayalam equivalent) plus a math line when one exists.
- Removed the fallback that manufactured a whiteboard `write` action from `section.heading + section.content`.
- Legacy materials suppress prose `write`/`latex` actions. Only math-like text or short explicitly positioned diagram labels may reach the board.
- Source/problem pinning is clipped more tightly to avoid large question blocks.
- Narration and the caption panel continue to receive the full explanatory text; TTS behavior is unchanged.

## Runtime contract
- TTS/caption: full explanation.
- Whiteboard: equations, transformations, shapes/graphs, arrows/highlights, short diagram labels, compact step controls.
- Long explanatory prose: never rendered as a whiteboard row.

## Validation note
A regression expectation was updated for `playStepBar`. Automated Vitest execution could not run in the packaging environment because `node_modules`/`vitest` is not installed in the supplied deployable ZIP.
