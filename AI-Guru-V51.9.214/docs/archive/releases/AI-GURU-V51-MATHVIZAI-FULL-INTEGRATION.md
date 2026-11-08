# AI Guru V51 — MathVizAI Full Integration Patch

This patch completes the MathVizAI visual-memory layer in the V50 application.

## Included
- Original MathVizAI FAISS video index and metadata: 5,791 entries.
- Original MathVizAI FAISS Manim index and metadata: 401 entries.
- 51 Golden Set source examples as reference data only; Python is not executed.
- TypeScript retrieval with FAISS when an embedding key is available.
- Lexical fallback when FAISS/embedding is unavailable.
- Visual Pattern Normalizer: retrieved code/text -> structured visual operations.
- Gemini planner receives the retrieved visual memory.
- Gemini can receive the selected AI Guru reference video itself, using inline video for small assets or Gemini File API upload for larger assets.
- Planner requires temporal `referenceGrounding` evidence when a reference video is attached.
- Token-level `token-move` is accepted by visual-plan validation and reaches `universalSceneToVisualActions`.
- Server-only API: `/api/ai-guru/math-rag` provides retrieval diagnostics.

## Runtime
Set:
- `GEMINI_API_KEY`
- `OPENAI_API_KEY` or `GITHUB_TOKEN` for embedding/FAISS retrieval.
- `AI_GURU_MATH_RAG_FAISS=1` (default behavior)
- `AI_GURU_MATH_RAG_WATCH_VIDEO=1` to attach selected reference video to Gemini.
- `AI_GURU_MATH_RAG_DIR` only if the data directory is relocated.

The FAISS vectors are the original MathVizAI vectors and should remain server-side. The browser must receive only selected pattern metadata/visual actions.

## Architecture

Problem -> solver/verification -> MathVizAI FAISS + AI Guru pattern catalog -> Visual Pattern Normalizer -> selected reference video -> Gemini visual grounding -> Visual plan -> token/object deltas -> Konva visual actions -> visual QA -> voice cue synchronization.

The MathVizAI examples are visual references, not mathematical authority. Mathematical correctness remains the responsibility of AI Guru's verification pipeline.
