# AI Guru V51.7.5 — 3B1B Sprint D

## Classroom integration

Sprint D connects the Sprint C browser animation runtime to the existing AI Guru RAG Classroom without replacing the existing MathLikeAnimBoard playback.

### Added
- `components/ai-guru/ThreeB1BTeachingBoard.tsx`
  - Calls `POST /api/ai-guru/math/teaching`.
  - Sends the current textbook paragraph/question, grade, language, and the existing Gemini BYOK key.
  - Renders the compiled `UniversalMathScene` directly in the browser.
  - Uses Sprint C `createRuntimeSnapshot()` for persistent object state, interpolation and camera motion.
  - Provides Play/Pause, Reset, timeline seeking and Regenerate.
  - Displays lesson title, domain, segment/beat count and warnings.
  - Sends every active narration cue back to the classroom caption layer through `onCue`.
  - Supports English and Malayalam cue typography.

- `AIGuruClassroom.tsx`
  - Adds a `3B1B ▶` button to the existing whiteboard toolbar.
  - Opens the 3B1B teaching surface as an overlay inside the current classroom board.
  - Keeps the existing textbook reference pane and old classroom playback intact.
  - Reuses the current BYOK key order; the key is sent only with the lesson request.

### Runtime refinement
- `lib/ai-guru/math/animation/runtime.ts`
  - Nodes controlled by draw/transform events start hidden and become visible through their timeline events.
  - This prevents future scene objects from appearing before their teaching beat.

## Deliberately unchanged
- `/api/ai-guru/math/plan`
- Existing MathLikeAnimBoard / V43 classroom playback
- Math verification and Mathsteps
- Video-DNA retrieval and Gemini lesson planning
- No Manim runtime

## Validation
- TypeScript transpile/syntax check: passed for new/modified TS/TSX files.
- Full project `tsc`: expected pre-existing dependency errors because this source package has no `node_modules`.
- Runtime deterministic test: passed for draw interpolation, delayed object visibility, camera focus and scene duration.
