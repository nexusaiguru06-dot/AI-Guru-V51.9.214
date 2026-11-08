# MathLikeAnim-rs embedded smoke contract

This smoke contract verifies the source-level integration points:

1. `package.json` declares the MathLikeAnim-rs WASM core and renderer.
2. `components/ai-guru/MathLikeAnimBoard.tsx` dynamically imports both packages only in the browser.
3. The WASM core is initialized before creating the `SVGScene`.
4. Universal `VisualAction`s are converted to SVG and passed to `VectorObjectBuilder.from_svg`.
5. `SVGScene.play()` owns the render pass while the AI Guru teaching controller remains the cue/timing authority.
6. No `MATHLIKEANIM_URL` or localhost MathLikeAnim service is required.
