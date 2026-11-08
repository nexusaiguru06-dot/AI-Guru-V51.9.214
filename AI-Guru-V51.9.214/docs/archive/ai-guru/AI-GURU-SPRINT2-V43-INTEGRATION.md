# AI Guru — Sprint 2 v43 Integration

This slice connects the Sprint 2 canonical multi-agent contracts to the existing v43 implementation instead of creating a second lesson/RAG/runtime stack.

## Existing systems reused

- `lib/ai-guru/generation/gemini.ts` remains the v43 Gemini teaching-plan generator.
- `lib/ai-guru/document/normalize.ts` remains the v43 document-to-paragraph source normalizer used by `/api/ai-guru/book`.
- `lib/ai-guru/lesson/types.ts` remains the legacy classroom-facing lesson contract.
- `lib/ai-guru/lesson/validate.ts` remains the legacy lesson validator.
- `lib/ai-guru/qa/validator.ts` remains the legacy compatibility QA validator.
- Existing OpenMAIC compilation/runtime remains unchanged.
- Existing generic `/api/agent/*` runtime remains the application agent runtime; no duplicate runtime was introduced.

## New integration boundary

`lib/ai-guru/integration/legacy-adapter.ts` converts the v43 lesson shape to/from the canonical Sprint 1/2 contract.

`lib/ai-guru/integration/v43-pipeline.ts` injects the existing Gemini generator into the new Lesson Agent and runs:

Curriculum -> RAG/Book -> Content QA -> existing Gemini Lesson Generation -> Lesson QA.

## API behavior

`POST /api/ai-guru/generate-lesson` is still the same public endpoint and request shape. It now executes through the canonical Teaching Controller and returns the generated legacy-compatible lesson plus pipeline QA information.

`POST /api/ai-guru/book` keeps its existing `book` response and additionally exposes `canonicalLesson` so the new pipeline can consume the same v43 extracted source without a second extraction path.

## Important invariant

The legacy contract is only an API/runtime compatibility boundary. New agents and future Visual Step QA should operate on the canonical paragraph/problem contracts. No agent should directly mutate React classroom state.
