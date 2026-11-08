# AI Guru V51.9.8.1 — Mixed-language TTS + template board + false-stop fix

Built on V51.9.8 TEMPLATE-BOARD-PAGING. Fixes observed on Page 7 (beads) Teacher Reading:

## 1. English words in Malayalam paragraphs
- `AIGuruClassroom.tsx`: `splitMixedLanguageSegments` — Latin runs (≥2 letters) spoken with English TTS when the track is Malayalam.
- `ThreeB1BTeachingBoard.tsx`: `expandMixedSpeech` — same for 3B1B bilingual speech cues (read/explain/check).

## 2. Templates not used (text-only board) / no colour motion
- `AIGuruClassroom.tsx` `buildTeacherReadingPage`: sends **all paragraphs on the same page** so `deriveDeterministicProblem` still sees the beads/table problem after section 1.
- `lesson-planner.ts`:
  - broader beads algebra pattern (`x + (x-10) = 100`);
  - local fallback always pairs `create` + `recolor` (teaching-motion=true);
  - insight pause for Video-DNA QA rule;
  - `expression` set from extracted equations.

## 3. Class stopped without user stop
- `onClose` only calls `stop('…closed by user')` when status is PLAYING/PAUSED.
- Error path stays ERROR (not STOPPED) so Play can retry.

## Deploy
Replace these three paths from this package (or use the full zip):
- `ai/components/ai-guru/AIGuruClassroom.tsx`
- `ai/components/ai-guru/ThreeB1BTeachingBoard.tsx`
- `ai/lib/ai-guru/math/teaching/lesson-planner.ts`

Restart Next.js, re-run Teacher Reading on Page 7.
