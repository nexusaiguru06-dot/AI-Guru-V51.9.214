# MathLikeAnim-rs embedded integration

AI Guru now declares the real MathLikeAnim-rs WASM core and renderer as application dependencies:

- `@mathlikeanim-rs/mathlikeanim-rs@0.14.13`
- `@mathlikeanim-rs/renderer@0.14.15`

The official project documents the WASM core + renderer browser integration and exposes `SVGScene`/`CanvasScene`; the renderer operates on WASM-backed `VectorObject`s. The AI Guru adapter loads both packages client-side, initializes the WASM core, converts `VisualAction`s from the Universal Math Scene into SVG/vector objects, and renders them through `SVGScene`.

There is no `MATHLIKEANIM_URL`, localhost renderer, or second MathLikeAnim server.

The Universal Math Scene remains the source of truth. The Teaching Controller owns timing/cues; MathLikeAnim-rs owns mathematical vector rendering.
