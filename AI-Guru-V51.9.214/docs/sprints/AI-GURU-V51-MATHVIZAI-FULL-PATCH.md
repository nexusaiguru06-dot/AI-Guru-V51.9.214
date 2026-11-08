# AI Guru V51 — MathVizAI Full Patch

Integrated into the V50 application.

## Defects corrected
1. Replaced the 2,000/310 curated RAG corpus with the original MathVizAI FAISS indexes and metadata:
   - 3b1b_videos: 5,791 entries
   - 3b1b_manim: 401 entries
   - Golden Set: 51 examples
2. Added native TypeScript FAISS retrieval using `@faiss-node/native`.
3. Added embedding query generation compatible with the original `text-embedding-3-large` vector space.
4. Added lexical fallback so the application still works without an embedding key/native FAISS.
5. Added Visual Pattern Normalizer that converts retrieved examples into reusable operations such as move-token, fade-token, transform, highlight, geometry and plot.
6. Added real reference-video grounding to the Gemini planner:
   - inline video for smaller assets
   - Gemini Files API upload + processing for larger assets
   - planner is required to return temporal referenceGrounding evidence when a video is attached
7. Connected MathVizAI retrieval + Visual Pattern Normalizer + reference-video grounding to the existing Gemini math planner.
8. Kept mathematical verification separate: MathVizAI references are visual memory, never mathematical authority.
9. Kept V48 token-level animation as an executable VisualAction (`token-move`) and added `token-move` to the universal math visual-node type/validation.
10. Added `/api/ai-guru/math-rag` for server-side retrieval diagnostics.
11. Added `npm run audit:math-rag`.

## Server-side security
FAISS indexes, metadata and API keys are server-side. They are not sent to the browser.

## Runtime environment
Use Node 22+. Install dependencies before building. Native FAISS availability depends on the host platform; lexical fallback remains available.

## Environment
- `GEMINI_API_KEY` — required for Gemini visual planning.
- `OPENAI_API_KEY` or `GITHUB_TOKEN` — used for query embeddings.
- `AI_GURU_MATH_RAG_FAISS=1` — use the original FAISS indexes.
- `AI_GURU_MATH_RAG_WATCH_VIDEO=1` — attach selected reference video to Gemini.
- `AI_GURU_MATH_RAG_DIR` — optional custom data directory.
