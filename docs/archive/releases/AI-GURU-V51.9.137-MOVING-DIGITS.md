# AI Guru V51.9.137 — Moving digits and a cinematic class

Built on V51.9.136 (detailed steps, two captions, step wait) → V51.9.135 (style library) → V51.9.126-CINEMATIC.

## What students see (pair of linear equations)
Each working line is built from the one above:

| Step | Motion |
|---|---|
| multiply (2) by 2 | The terms of (2) are ringed orange at the top and fly down; an orange "2 ×" pops in front of each term |
| 2 × each term | "2 × 2x" is ringed, flies together and becomes **4x** (born orange, then green); then "2 × y" becomes **2y**, and "2 × 1" becomes **2** |
| add (1) and (2) | 2y and −2y are ringed; each term flies down from its own equation into the added line |
| y cancels | The cancelling terms are ringed, struck out and dimmed; "3x + 4x" flies together into **7x**, "12 + 2" into **14** |
| ÷ 7 both sides | 7x is ringed; an orange ÷ appears; the 7 flies across the "=" |
| answer | "14 ÷ 7" flies together into **2**; green box and sparks |
| move across | "4" is ringed, an orange "−" appears on the right, the 4 jumps across the "=" |
| check | the terms of the given equation come down with the values in; each product comes out of its term; tick |

- The orange digits return to their own colour when their move is done.
- The camera leans in on the working and pulls back for the graph.
- The two captions (short "what" note on the right, spoken "why" caption at the bottom) and the 1–10 s "Next step after" control are kept from V51.9.136.

## Cinematic class
- Classroom whiteboard and Motion Classroom have a **Board** choice: 🎬 Cinematic (default) or Whiteboard.
- It is applied by the player at once, with nothing made again, and remembered on the device (`aiGuruBoardLook`).
- Reel Studio already offers the Cinematic look under More choices → Look.

## How it is built
- `lin-steps.ts`: every line is a list of tokens. Each step lists `flows`, which say which tokens of which earlier line make which token of the new line. A flow is either a `glide` (quiet) or a ring + orange move. The step also lists `hot` new tokens (orange) and `cancel` tokens. Everything is computed from the six numbers of the plan.
- `lin-builders.ts`: resolves the flows, rings and recolours the sources, flies clones on an arc with sound, gives birth to the target in orange with a glow, restores colours, strikes, and handles the answer box with sparks and the camera.
- `interactive-player.ts`: `setBoardLook('cinematic' | 'classic')`.

## Checked
- `vitest run lib/ai-guru`: 1415 passed. The same 19 failures as V51.9.126 (missing optional modules in old test files); none new.
  - `lin-steps.test.ts` now has 13 tests, including: copies fly; digits are orange and ringed while worked on; all digits back in their colour at the end of each step; camera in and out.
  - The "every flow points at a real token" check runs over 300+ systems.
- `tsc`: no new errors. ESLint clean on the changed library files.
- Rendered frame strips in both looks, and a 61 s MP4 of the elimination (`elimination-cinematic.mp4`, silent).

## Not yet done
- The moving digits are on the pair-of-linear-equations board. The single-equation balance boards already had ringed orange digits flying (V51.9.125). Quadratic, polynomial and the other boards still write whole lines.
- The Malayalam captions are drafts for a teacher to check.
- The demo MP4 has no voice. In the app the steps wait for the voice.
