# AI Guru V51.7.7 — Hierarchical Video-DNA Selector

## Upgrade
The Video-DNA layer now uses a three-stage selection model:

`Chapter → Chapter Visual Strategy → Lesson DNA → Beat DNA`

### Retrieval
- Uses the existing concept-index as a fast candidate seed.
- Falls back to the full 231-entry corpus when the index has too few candidates.
- Filters non-portable, duplicate, style-only and character-driven entries.

### Reranking
Each candidate is scored across:
- mathematical concept overlap
- lexical overlap
- domain/branch compatibility
- visual-operation compatibility
- pedagogical goal compatibility
- grade suitability
- corpus quality/portability

### Diversity
Results are diversified by archetype instead of returning three near-duplicates.

### Chapter strategy
`selectChapterVideoDna()` produces 3–6 reusable archetypes, construction patterns, motifs, pacing and camera guidance.

### Lesson strategy
`selectLessonVideoDna()` reranks the problem against the chapter strategy and exposes:
- 3 lesson-level archetypes
- 8 beat-level options
- chapter archetype context
- primary selection

A problem can therefore inherit the chapter's visual language while overriding it when its mathematical/visual requirements differ.

## Compatibility
`retrieveGeneralVideoDna(query, topK)` remains available and returns the same `MathRagHit[]` shape. Existing callers do not need to change.

## Planner integration
The 3B1B planner now uses the hierarchical selector. The teaching API additionally accepts optional:
- `chapterTitle`
- `chapterSummary`
- `chapterTopics`

If chapter context is not supplied, the existing problem-level flow still works.

## Renderer safety
Video-DNA remains visual grammar only. The selector never exposes executable source code and continues to adapt grammar to AI Guru's browser renderer.
