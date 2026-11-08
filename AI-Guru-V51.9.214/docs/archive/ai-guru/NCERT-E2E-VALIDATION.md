# AI Guru first real end-to-end NCERT lesson

Route: `/ai-guru/e2e`

Source: official NCERT Class X Mathematics Chapter 4, Quadratic Equations: `https://www.ncert.nic.in/textbook/pdf/jemh104.pdf`.

Implemented flow:

1. NCERT PDF reference (left 50%).
2. NCERT chapter/page metadata.
3. Verified quadratic expression.
4. In-process mathematical visual sequence on the right 50%.
5. English narration with browser word-boundary cues when available.
6. Malayalam narration and Malayalam whiteboard text.
7. Malayalam text remains visible independently of TTS.
8. Teaching state is controlled by the lesson playback controller.
9. `pnpm e2e:ncert` validates the lesson contract and QA rules.

The official NCERT PDF is intentionally loaded at runtime rather than redistributed inside the ZIP.

MathLikeAnim-rs note: its official repository documents a Rust/WebAssembly core and browser Canvas/SVG renderer. This build keeps the AI Guru renderer in-process and keeps the adapter boundary ready for the actual MathLikeAnim-rs WASM package. The supplied build environment could not retrieve GitHub/NPM packages, so no unverified Rust/WASM binary is claimed as bundled.
