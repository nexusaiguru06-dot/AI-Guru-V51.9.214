# AI Guru V51.9.16 — native 3B1B visuals, real camera, MP4 export

Install after unzipping: `npm install` (adds `mp4-muxer`; the lockfile will update).

## What changed
| Area | File | Change |
|---|---|---|
| Graphs / charts | `lib/ai-guru/math/manim-web/primitives.ts` (new) | `plot`, `graph`, `matrix`, `barChart` nodes now render as native manim-web objects (Axes + FunctionGraph with marker/tangent, polyline graph, Matrix with LaTeX entries, BarChart) instead of plain text. Bad input falls back to text. |
| Camera | `lib/ai-guru/math/manim-web/camera.ts` (new) | pan / zoom / focus drive the real manim-web camera. One scene-long animation reads `createRuntimeSnapshot(...).camera`, so it matches the SVG board and scrubs backwards correctly. |
| Camera bug | `lib/ai-guru/math/animation/runtime.ts` | Initial camera was `{0,0,1}` (shifted the board by half a screen and made the first move sweep from the corner). Now `{500,350,1}` = board centre. |
| Renderer wiring | `lib/ai-guru/math/manim-web/renderer.ts` | Uses the primitives and the camera track; old 8 % "focus pulse" removed. |
| MP4 export | `lib/ai-guru/video-export/*` (new) | Browser-only, frame-stepped (not real-time): WebCodecs + `mp4-muxer`. Same scene and same narration timeline as the live class; voices mixed into one audio track; burned-in captions. Picks H.264 + AAC when the browser can encode them, else VP9/AV1 and/or Opus in MP4. |
| UI | `components/ai-guru/ThreeB1BTeachingBoard.tsx` | `⬇ MP4` button in the header (tap again while exporting to cancel). |

## Using it
Generate a lesson, tap **⬇ MP4**. It fetches every voice clip, renders offscreen at 1280×720 / 30 fps and downloads `<lesson title>.mp4`.

## Known limits
- Browser SpeechSynthesis voices cannot be captured: those clips are silent in the MP4 (a notice says so). Server voices (Edge / Gemini / etc.) are captured.
- Needs WebCodecs: Chrome / Edge 94+, Safari 16.4+, recent Firefox. Long lessons are held in memory (~25 MB per minute at the default bitrate).
- `sampleSpace` still falls back to text. Matrix-morph events read `event.matrix`, which the IR type does not define; check that your planner emits it.
- `renderer.ts` still has pre-existing type errors (grid/matrix event fields not in the IR types); none were added.

## Tests added
`primitives.test.ts`, `camera.test.ts` (camera parity with the runtime at 13 times incl. backward scrubs), `video-export/export-timeline.test.ts`.
