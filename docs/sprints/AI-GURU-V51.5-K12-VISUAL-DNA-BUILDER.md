# AI-Guru V51.5 — K-12 Visual DNA Builder

## Separation
- **Problem solving:** 20 physical MP4/WebM reference videos remain in `public/reference-styles/problem-solving/` and use `data/ai-guru/video-dna/problem-solving-video-dna.json` during normal runtime.
- **General classroom:** 69 curated, unique Manim/code references are stored as compact Visual DNA in `data/math-rag/general-teaching-visual-dna.json`.

## Runtime policy
General classroom retrieval reads the 69-pattern DNA library first, returns at most four patterns, and does not query the former thousands-entry FAISS pool. Source MP4 is not required and is not sent to Gemini. Gemini receives current lesson/PDF content plus compact visual grammar only.

## Builder
Run `node scripts/ai-guru-build-k12-visual-dna.mjs` to rebuild the 69-pattern library from the curated catalogue/code corpus. It extracts reusable object and animation grammar and assigns each unique reference to one branch.

## Branches
Arithmetic, Algebra, Geometry, Trigonometry, Functions & Graphs, Calculus, Probability & Statistics, Number Theory, Linear Algebra & Vectors.

## Safety/ownership rule
The runtime adapts animation techniques and teaching grammar. It does not redistribute or replay third-party finished videos. Keep provenance/license metadata when adding new source patterns.
