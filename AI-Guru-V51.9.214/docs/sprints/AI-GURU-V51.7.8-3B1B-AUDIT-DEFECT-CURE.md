# AI Guru V51.7.8 — 3B1B Audit Defect Cure

This release addresses the defects identified in the V51.7.7 3B1B / Video-DNA audit.

## Fixed

1. **Math verification is now authoritative for 3B1B**
   - The teaching API runs the lesson expressions through `HybridMathVerifier` with `MathJsMathstepsVerifier` as the advanced verifier.
   - The LLM cannot mark a segment as mathematically verified.
   - `UniversalMathScene.verified` is false unless lesson QA passes `math-correctness` and compiler reference checks pass.
   - The API performs up to two repair passes when QA or animation references fail.

2. **`move` is a real animation primitive**
   - `MathVisualEvent.kind` now includes `move`.
   - Compiler preserves `fromX/fromY/toX/toY`.
   - Runtime interpolates x/y with easing.

3. **Transform retention works**
   - `retainFrom:false` fades the source object during a transform.
   - Persistent object identity remains explicit.

4. **Narrative contract is rendered**
   - Opening question
   - Why it matters
   - Prerequisites
   - Running example
   - Segment intuition
   - Segment mathematics
   - Final insight
   are materialized as narrated scene beats before/around the authored visual beats.

5. **Difficulty adaptation is enforced**
   - Grade-based profiles cap segments, beats, narration length and prerequisite depth.
   - Violations trigger repair generation.

6. **Beat-mix grammar is enforced as QA**
   - Build / transform / move / remove targets from selected Video-DNA are propagated into the lesson grammar.
   - Actual authored action ratios are checked against the selected grammar.

7. **Pacing and camera grammar are executed**
   - Slow/medium/fast changes default beat/transition/pause timing.
   - Focus/cinematic camera grammar inserts target-based camera events on authored beats.

8. **Visual QA now checks geometry and frame safety**
   - safe frame
   - text readability
   - text overlap
   - geometry dimensions and coordinates
   - graph array integrity
   - Video-DNA QA rules for overlap, safe frame, insight pause and narrated highlighting

9. **Object-ID validation is temporal**
   - A target must already exist or be created before an action uses it.
   - Invalid references are surfaced as QA failures instead of being silently ignored.

10. **Chapter context reaches the 3B1B planner**
    - Classroom passes chapter title, chapter summary/topics, current textbook passage and page context.
    - The chapter-level Video-DNA selector therefore actually runs from the UI.

## Deliberate architecture decisions

- No Konva dependency was added. The 3B1B board remains browser SVG.
- No Manim runtime was added.
- The existing MathLikeAnim-rs / SVG path remains separate from the new 3B1B SVG board.
- The existing `/api/ai-guru/math/plan` verification path is untouched.
- This release does not claim that the repository contains a complete Kerala/CBSE curriculum corpus. The current textbook grounding comes from the indexed/user-supplied textbook context and existing RAG layers.

## Validation

- TypeScript syntax/transpile validation: 10 modified TS/TSX files — PASS.
- Compiler/runtime smoke test: PASS; real `move` event and interpolation verified.
- Hierarchical Video-DNA selector smoke test: PASS; chapter strategy, lesson primary archetype, 8 beat options, beat mix and QA rules returned.
- Full `npm test` / full project type-check could not be completed because the supplied archive has no `node_modules`; an attempted `npm ci --ignore-scripts` exceeded the execution window.
