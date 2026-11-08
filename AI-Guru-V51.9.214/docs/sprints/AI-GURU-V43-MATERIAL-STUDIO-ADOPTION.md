# AI Guru V43 — Material Studio adoption

## Boundary
The V43 main classroom UI, MathLikeAnimBoard, teaching controller, paragraph state machine, voice/cue system, RAG classroom visuals and existing teaching endpoints remain the source of truth.

V35 was used only as a reference for the material pipeline: single textbook indexing, specialist generation, grounding/source IDs, visual specialist, assessment specialist, final QA and targeted repair.

## Flow
PDF upload → one-time page/paragraph index → material generation → QA/repair → persistent material registry → Classroom Study Materials dock → existing V43 visual engine.

## Removed legacy material path
- `app/api/ai-guru/materials/route.ts`
- `lib/ai-guru/agents/material/*`
- MaterialAgent export from `lib/ai-guru/index.ts`
- `createMaterial` export from `lib/ai-guru/integration/sprint7-platform.ts`

The shared Sprint 7 integration remains because teacher, parent, analytics, session and model-router APIs still use it.
