# AI Guru Sprint 8.5.7 — Reference Segmentation & Concept Metadata

The multi-concept area-formula reference is retained as a parent reference, but its teaching content is indexed as independent concept segments.

## Selection contract

`Visual Style Selector -> referenceSegmentId -> segment asset + metadata -> Visual Step Agent -> reference-specific QA`.

The selector chooses the segment from the user's paragraph/problem expression. The segment's QA profile travels with the visual actions. Recovery must preserve the same paragraph and segment QA boundary.

## Current area-formula segments

- rectangle
- square
- triangle
- parallelogram
- rhombus
- trapezium

The source timestamps and teaching beats are stored in `lib/ai-guru/math/universal/reference-segments.ts` and the public asset manifest.

The clips are style references only. AI Guru's verified math and graphics engine remains authoritative and reference content is never copied.
