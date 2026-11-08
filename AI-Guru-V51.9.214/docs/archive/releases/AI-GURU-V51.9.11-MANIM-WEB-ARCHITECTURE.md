# AI Guru V51.9.11 — manim-web rendering architecture

## Goal

Replace the hand-built SVG/text animation runtime as the primary 3B1B renderer without replacing AI Guru's pedagogy, RAG, Video-DNA, math verification, TTS, or QA systems.

## Repository feature adoption

| Source | Adopt | Do not adopt | Reason |
|---|---|---|---|
| `maloyan/manim-web` | WebGL scene graph, MathTex, TransformMatchingTex/Shapes, Create/Fade/Indicate, geometry, graphs, camera/timeline model, browser React compatibility | Its authoring API as the AI contract | It is the primary browser rendering backend. |
| `johnhenry/ecmanim` | Testing ideas: deterministic Scene/animation IR, browser/headless parity, golden-frame QA, voiceover/bookmark concepts | A second runtime renderer | Avoid two competing animation engines in AI Guru. |
| `motion-canvas` | Timeline/voice-over synchronization principles | Its editor/runtime | AI Guru already owns the classroom timeline and TTS clock. |
| `MathBox` | Graphing/3D ideas only where manim-web primitives are insufficient | A second graph renderer | Keep one renderer and one coordinate system. |
| Existing AI Guru | RAG WHAT, Chapter→Lesson→Beat Video-DNA HOW, teacher planner, verified math, Scene IR, TTS, QA/repair | — | This remains the product/pedagogy layer. |

## Runtime boundary

```text
Textbook / RAG
   ↓ WHAT
Chapter → Lesson → Beat Video-DNA
   ↓ HOW
Teacher planner + math verification
   ↓
UniversalMathScene (AI Guru canonical Scene IR)
   ↓
ManimWeb renderer adapter
   ↓
WebGL full-board 3B1B animation
   ↓
Visual QA / repair / recompile / QA
```

Gemini must never emit arbitrary manim-web code. It emits constrained AI Guru Scene IR. The adapter deterministically converts that IR into mobjects and animations.

## Current V51.9.11 implementation

1. `lib/ai-guru/math/manim-web/plan.ts` performs renderer preflight.
2. `lib/ai-guru/math/manim-web/renderer.ts` maps Scene IR into manim-web mobjects and a timed `Timeline`.
3. `components/ai-guru/ManimWebTeachingCanvas.tsx` owns the browser WebGL surface.
4. `ThreeB1BTeachingBoard` remains the master clock. Its existing measured TTS loop calls `scene.seek(timeMs)` in the new renderer, so audio and animation share one clock.
5. The previous SVG runtime is retained only as an automatic fallback if WebGL initialization fails.

## 3B1B features now delegated to manim-web

- vector LaTeX/MathTex
- progressive Create/write-style reveals
- equation morphing with `TransformMatchingTex`
- shape matching with `TransformMatchingShapes`
- smooth transforms and transform-from-copy
- Indicate emphasis
- WebGL rendering and resize handling
- Manim-style world coordinates
- deterministic timeline seeking/scrubbing

## Next integration passes

### Pass A — renderer install

Run `npm install` so `manim-web@0.3.24` and its renderer dependencies are resolved into `package-lock.json`.

### Pass B — equation-token fidelity

Use `MathTex` multipart/token semantics for AI Guru's semantic term IDs so `x`, coefficients, operators and constants can move independently when the Scene IR requests token motion.

### Pass C — graphs/geometry

Map graph/plot/number-line/geometry nodes to native manim-web graphing primitives instead of the current SVG fallbacks.

### Pass D — camera DNA

Map AI Guru camera events to `MovingCamera`/camera-frame animations while keeping the full-board classroom frame as the default.

### Pass E — renderer-aware QA

Add browser QA checks for:

- full-board occupancy
- no object overlap
- no off-screen important math
- at least one genuine transformation for derivation lessons
- token matching for equation transformations
- highlight/recolor beats
- correct verified result
- stable seek/replay from arbitrary timestamps
- TTS cue alignment

A lesson is still rejected after failed QA; the new renderer does not weaken the QA gate.
