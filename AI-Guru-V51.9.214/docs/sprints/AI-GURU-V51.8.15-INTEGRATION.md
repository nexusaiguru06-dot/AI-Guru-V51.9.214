# AI Guru V51.8.15 — Teacher Reading Mode Integration

## General Class contract

Textbook = WHAT is taught.

Chapter → Lesson → Beat Video-DNA = HOW the idea is visually constructed.

Problems & Formulae keeps its separate practice DNA and playback path.

## Teacher Reading sequence

For each textbook section:

1. Topic/heading introduction
2. English textbook reading
3. Malayalam translation
4. English teacher explanation
5. Malayalam teacher explanation
6. 3B1B visual construction
7. Optional bilingual check question
8. Continue to the next textbook section

The whiteboard is not a textbook transcription surface. Detailed prose belongs to the teacher voice/caption layer. The visual board contains equations, diagrams, transformations, highlights and concise labels.

## Textbook cue contract

`TextbookPage` provides stable IDs such as `p7-para1-s1`. The planner receives a reading manifest and must return `sourceCueId`, verbatim `read.en`, Malayalam `read.ml`, and bilingual `explain` fields for every readable cue.

QA rejects missing/invalid cues, altered source sentences, incomplete bilingual fields, and missing bilingual topic framing.

## Class continuity

General Class sections advance through the Teacher Reading board without entering `STOPPED`. `STOPPED` is reserved for explicit user/navigation cancellation. Page overrides are cleared before automatic progression so the reference pane follows the actual textbook source.

## Malayalam speech

Malayalam explanation remains Malayalam while mathematics/technical vocabulary remains English. Variable names are protected for English pronunciation: `x` → `ex`, `y` → `why`, `z` → `zee`, `a` → `ay`, `b` → `bee`.

## Validation

Modified TypeScript/TSX files passed TypeScript `transpileModule` syntax diagnostics. A full project typecheck was not claimed because the supplied archive has no installed `node_modules`; project-wide dependency-resolution errors are expected until dependencies are installed.
