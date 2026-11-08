# AI Guru — Universal Math Video-Style Teaching

The Universal Math Engine is the canonical AI Guru TypeScript mathematics visual layer. V49 makes its branch routing explicit while preserving the existing renderer and verification boundaries.

## Runtime contract

`math question → domain detection → verified math → UniversalMathScene → timed visual events → AI Guru whiteboard (Motion engine)`

## Domains

The compiler recognizes and has a dedicated strategy boundary for:

- arithmetic
- number systems
- fractions
- decimals & percentages
- ratio & proportion
- algebra
- linear equations
- inequalities
- polynomials
- sequences & series
- coordinate geometry
- functions
- trigonometry
- geometry
- mensuration
- calculus
- statistics
- probability
- matrices
- vectors
- complex numbers
- financial mathematics
- 3D geometry
- sets & logic
- combinatorics

Unknown material safely falls back to `general` rather than inventing a specialized visualization.

## Important implementation rule

The compiler is deterministic and produces a visual plan. AI lesson generation can supply richer semantic steps later, but the renderer never treats unverified generated mathematics as verified. `Math.js` is the verification boundary (Mathsteps was removed in V51.9.173 for security).

## Video-style timing

Each visual node receives an event with `atMs` and `durationMs`. The same scene can therefore drive an interactive classroom and a video renderer without maintaining separate teaching logic.

## Curriculum evaluation harness

The repository now includes `eval/curriculum-universal-math/`, a regression harness for representative Kerala/CBSE Class 1–12 mathematics. It checks domain routing, scene compilation, grade bands, verification status, visual-plan contract integrity, lesson QA, cue monotonicity/targets, and expected visual strategy. Run `npm run eval:curriculum`. V49 also provides `GET /api/ai-guru/math/domains` for runtime branch coverage.


## Visual construction contract

AI Guru now uses **Visual Mathematical Construction + Symbolic Transformation**. Reference videos supply motion/pacing inspiration only. Mathematical methods remain selected from the verified curriculum solution. Semantic visual objects and relationships are compiled into progressive create/highlight/move/transform actions, then replayed identically in English and Malayalam.
