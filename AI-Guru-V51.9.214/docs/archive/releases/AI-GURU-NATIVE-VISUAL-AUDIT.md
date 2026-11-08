# Native Visual Audit — 2026-09-14

Source comparison: `AI-Guru-Two-Pass-Cumulative-Derivation-v6.zip` vs the Sprint 8.1 application.

## Reused from v6
- Cumulative derivation / persistent transform behavior in `MathLikeAnimBoard`.
- Two-pass English/Malayalam visual concept already present in the NCERT E2E demo.
- MathLikeAnim-rs renderer dependency and action vocabulary.

## Existing Sprint 8.1 kept
- Canonical IDs, Lesson/Paragraph/Problem contracts.
- Teaching Controller and paragraph state machine.
- Visual Step QA and paragraph-scoped recovery.
- Math Agent, mathjs/mathsteps verification and Universal Math Compiler.
- Voice Agent, synchronization contracts and Classroom QA.
- Sprint 6/7 agents and APIs.

## New native runtime integration
- `components/ai-guru/AIGuruClassroom.tsx` now renders the actual MathLikeAnim board.
- `lib/ai-guru/tts/providers.ts` supports direct local Piper execution.
- Classroom QA checks actual rendered SVG object presence.

## Important dependency boundary
The application still contains legacy OpenMAIC infrastructure outside the AI Guru visual path. This sprint does not claim that the entire repository is OpenMAIC-free. The new AI Guru visual path does not add another OpenMAIC runtime dependency.
