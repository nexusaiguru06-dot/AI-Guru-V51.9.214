# AI Guru V51.9.12 — Token-Level Equation Animation

## Purpose

V51.9.12 makes equations behave as collections of semantic visual tokens instead of one large text object.

For a derivation such as:

```text
x + (x - 10) = 100
        ↓
2x - 10 = 100
        ↓
2x = 110
        ↓
x = 55
```

matching variables, constants, operators and structural symbols are allowed to travel to their new positions. Unmatched pieces fade or morph according to the selected Manim-Web matching strategy.

## Implementation

- `lib/ai-guru/math/manim-web/tokenize.ts` — deterministic presentation-level LaTeX tokenizer.
- `MathVisualNode.tokenParts` — optional stable token decomposition in the canonical Scene IR.
- `animation/compiler.ts` — automatically attaches token parts to LaTeX/transform nodes when the planner did not provide them.
- `manim-web/renderer.ts` — uses multipart `MathTex`, glyph-level semantic metadata, and `TransformMatchingTex`.
- `ManimWebTeachingCanvas.tsx` — waits for MathTex rendering before the first seek, preventing a race between WebGL startup and token matching.
- Algebraic transforms default to token matching unless `retainFrom: true` explicitly requests a transform-from-copy.
- `transformMismatches: true` enables closest unmatched pairing for operations such as combining repeated terms.
- `visualActions[].atMs` provides explicit timing for a separately moving digit/operator/term.

## QA contract

A renderer QA pass should verify:

1. At least one genuine equation transform exists for a derivation.
2. Source equation remains visible until the transform begins.
3. Matching tokens visibly move instead of whole-equation replacement.
4. Important tokens remain inside the board frame.
5. Final expression equals the verified mathematical result.
6. Seek/replay at arbitrary timestamps is deterministic.
7. TTS uses the same scene clock; no independent animation clock is introduced.
