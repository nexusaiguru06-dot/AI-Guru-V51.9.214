# AI Guru V51.9.9 — 3B1B Visual Primitive Engine

## Purpose
Use ManimGL as a visual specification, not as a runtime. AI Guru remains browser/SVG/TypeScript based.

## Changes
- Mandatory worked-solution lessons now use `3b1b-classroom` visual grammar.
- Full-board composition: equation transformations occupy the central canvas; geometric intuition is a lower visual band rather than a right-side text panel.
- Equation rows now compile into continuous transform events. The runtime cross-fades/interpolates source -> destination geometry for a 3Blue1Brown-style transformation.
- Teacher speech/caption is a small top-left overlay so it does not consume the teaching canvas.
- Added deterministic browser primitives inspired by ManimGL:
  - grid
  - number line
  - vector
  - arc / sector
  - matrix
  - bar chart
  - sample space
- Added rendering support for those primitives in the 3B1B teaching board.
- Mandatory board QA now requires at least one executable transform in addition to created objects and motion.
- Video-DNA/template grammar now explicitly adds transform-matching-equation, token-motion, focus-arc and full-board-composition motifs for mandatory worked solutions.
- Kept ManimGL itself out of the runtime: no Python/OpenGL/FFmpeg dependency was added.

## Expected Page 7 behaviour
For the Class 8 beads/table-chair examples:
1. Textbook reading remains in the teacher voice layer.
2. The board starts with the mathematical relationship.
3. Each next equation visibly transforms from the previous equation.
4. Active terms are colour-bound.
5. Camera focus follows the current mathematical step.
6. The answer is constructed and checked on the same board.
7. A failed mandatory board is rejected by QA rather than silently becoming text-only.

## Validation
Full project type-check/build requires installed project dependencies (`npm ci`). The source changes were checked with TypeScript; existing dependency-missing diagnostics remain because this uploaded project does not contain `node_modules`.
