# AI Guru Sprint 8.1 — Full Integration & Cleanup

## Runtime rule
- Server-side TeachingController is the canonical orchestration controller.
- `teaching/classroom-controller.ts` is the client-only playback adapter; it is not a second lesson orchestrator.
- Canonical Lesson/Paragraph contracts remain the boundary between pipeline stages.
- Math compiler scenes are merged into paragraph `visualSteps` before Visual Step QA.
- Visual and Voice agents execute through the production agent gateway.
- Visual QA remains paragraph/problem/visual-step scoped.
- Recovery must re-run QA before acceptance.

## Cleanup
- Removed generated TypeScript build artifacts.
- Archived historical AI Guru planning/validation documents.
- Kept legacy lesson/QA/math adapters that still serve explicit API compatibility paths.
