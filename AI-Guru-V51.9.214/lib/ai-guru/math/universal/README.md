# AI Guru Visual Mathematical Construction + Symbolic Transformation

This module defines the visual language for Universal Math Video-Style Teaching.

## Principle

**Animate the mathematics itself.** The supplied reference videos contribute presentation language only:

- progressive construction
- object continuity
- semantic movement
- highlighting
- grouping/separation
- smooth transformation
- write/rewrite/erase
- cause → operation → result

They do **not** contribute a mathematical method. In particular, Japanese-stick/intersection multiplication is explicitly forbidden from being transferred into lesson planning.

## Modes

- `construction`: build the concept visually.
- `transformation`: show symbolic mathematical transformations.
- `hybrid`: combine both when useful.

The AI planner chooses the mode per problem and learning objective. The deterministic compiler provides a safe fallback.

## Domain coverage

Arithmetic, fractions, decimals/percentages, ratio/proportion, algebra, linear equations, polynomials, sequences/series, coordinate geometry, functions, trigonometry, geometry, mensuration, calculus, statistics, probability, matrices, vectors, complex numbers, financial mathematics and 3D geometry.

## Rendering boundary

The visual scene is compiled to `VisualAction` and rendered by the embedded MathLikeAnim-rs WASM board. The Teaching Controller remains the timing authority; the renderer does not own pedagogy or language sequencing.


## Continuous visual construction

The Universal Visual Math layer is not a sequence of static equation screenshots. It uses a semantic visual plan:

- **semantic objects**: digits, terms, equations, points, shapes, graph elements, matrix cells, vectors and results
- **relations**: derived-from, balances, operates-on, contains, highlights
- **construction steps**: create → focus → move → transform → erase/pause
- **reference videos**: style-only; no reference-specific mathematical method is copied

A lesson can therefore make the mathematics itself appear to be constructed. Symbolic transformation is treated as a visible state change rather than a simple text replacement.

### Language rule

The semantic visual plan is language-independent. The same plan is replayed from the first step in the complete English pass and again from the first step in the complete Malayalam pass. Each pass has its own captions and TTS timing.
