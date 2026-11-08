# AI Guru V51.9.21 — Plane and graph DNAs

**Ask:** "Find any gap to fill — my aim is 3B1B-style class." Biggest gap found in V51.9.20: the Motion engine could draw text, lines, boxes, polygons and dots only, so a unit about a graph, a coordinate plane or a transformation fell back to a few lines of text (or to a wrong DNA).

**Done (steps 1–3 of the plan):**
1. Engine primitives: `morph`, `vector`, `moveVector`, clip, `background`, `fixView` (engine.ts, draw.ts) and `reels/motion/plane.ts`.
2. DNAs `plane-transform` and `function-graph` (`motion-class/dna/plane-builders.ts`, types, registry), validator, offline graph planner, AI prompt rules + examples, bilingual samples.
3. Selector fix + `plan/visual-qa.ts` (text-only warning per unit).

**Files:** NEW `reels/motion/plane.ts`, `motion-class/dna/plane-builders.ts`, `motion-class/plan/visual-qa.ts`, `motion-class/samples/plane-graph.ts`, `motion-class/plane-graph.test.ts`. CHANGED `reels/motion/{engine,draw,speech,index}.ts`, `motion-class/dna/{types,registry,builders}.ts`, `motion-class/plan/{validate,offline,ai}.ts`, docs, CHANGELOG, VERSION.

**Tests:** `npx vitest run lib/ai-guru/motion-class lib/ai-guru/reels/motion` → 88 pass (56 before + 32 new). The new tests check the maths on screen (î/ĵ/v tips, unit-square corners, grid-line direction, matrix numbers, det, tracker readings, morphed curve), the validator's rejections, selection, offline graph, English/Malayalam board identity, drawing in all three formats. Two mutations (transform ignored, wrong y readout) were caught.

**Known limits**
- Still text-only (flagged): probability, statistics, fractions, sequences, and any unit with nothing to draw. Next DNAs: bar/array, tile/area fractions, histogram/probability tree, unit circle.
- The plane has no translation (not a linear map) and no eigenvector step yet.
- Malayalam captions were not rendered with a Malayalam font here; check line breaks in the app.
- Real-browser playback (manim-web player) and MP4 export of these scenes were not run; scenes go through the same `drawMotionFrame` and timeline as every other DNA.
