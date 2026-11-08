# AI Guru V51.4 — K-12 Reference Library

## Purpose
AI Guru now separates **problem solving** references from **general classroom** visual-pattern RAG.

### Problem-solving reference videos (20 physical assets)
These are the only physical MP4/WebM reference assets. They live under `public/reference-styles/problem-solving/` and are organised by branch:

- Geometry: 10
- Calculus: 5
- Algebra: 2
- Trigonometry: 1
- Arithmetic / general mathematics: 2

Normal classroom requests do **not** upload these videos to Gemini. The planner reads `data/ai-guru/video-dna/problem-solving-video-dna.json` instead. Set `AI_GURU_MATH_RAG_WATCH_VIDEO=1` only for deliberate one-time enrichment/diagnostics.

### General-classroom MathVizAI RAG
The old 2,361-entry fallback corpus and 1,911 FAISS chunks were excessive for a Classes 1–12 classroom. V51.4 removes those FAISS stores and replaces the runtime corpus with a curated K-12 set of **69 unique visual-pattern entries**. They are code/animation references, not physical videos.

The organised branch files are in `data/math-rag/general-classroom/`:

- arithmetic
- algebra
- geometry
- trigonometry
- functions-graphs
- calculus
- probability-statistics
- number-theory
- linear-algebra-vectors

Each branch contains at most 18 selected references. A single useful source can appear in more than one branch, so the branch memberships total more than 69 while the unique runtime corpus remains 69.

### Master catalogue
`data/math-rag/AI-GURU-K12-VIDEO-AND-RAG-CATALOG.json` is the single organised inventory of both libraries.

### Quota policy
`AI_GURU_MATH_RAG_WATCH_VIDEO=0` is now the default. The 20 physical references are not repeatedly sent to Gemini. Local Visual DNA plus the curated general-classroom RAG are used during normal teaching.
