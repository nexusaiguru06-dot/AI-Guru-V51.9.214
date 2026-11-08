# AI Guru V51.6.6 — Malayalam Caption + Detailed General Class

## Fixes
- Malayalam narration now has an always-visible synchronized live caption overlay on the teaching board.
- Malayalam caption uses Malayalam-capable font fallbacks and `lang="ml"`.
- Removed the false `user/navigation stop` event from the normal General Class Play/generation path.
- Added General Class depth control: **Standard / Detailed**. Detailed is the default.
- Detailed mode gives Lesson Architect up to 64 chapter paragraphs and requests 10–16 coherent teaching sections when source context supports them.
- Detailed lessons must teach meaning, intuition, usefulness, visual models and connections before worked exercises, followed by applications, recap and understanding check.
- Detailed narration may be rich, while whiteboard text remains short and visual.
- General Class cache is keyed by class depth so switching Standard/Detailed regenerates the correct lesson.
- English text is no longer silently substituted as a Malayalam translation placeholder; missing Malayalam must be repaired by the generation/QA pipeline.

## Runtime separation retained
- General Classroom: K-12 General Teaching Visual DNA.
- Problems & Formulae: separate problem-solving DNA/practice mode.

## Validation
- `node scripts/ai-guru-integration-audit.mjs` passes.
