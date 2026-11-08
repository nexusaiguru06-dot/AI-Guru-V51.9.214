# AI Guru V51.8.13 — General Class 3B1B Video-DNA First

## Purpose

General Class now treats the textbook/RAG source as the authority for **what** is taught and the Chapter → Lesson → Beat Video-DNA system as the authority for **how** the mathematics is visually constructed.

The interactive Mathlet/template library is no longer used by the General Class play path. It remains isolated for Material Studio / practice-oriented content such as Problems & Formulae.

## Fixes

1. **General Class starts directly from the current textbook paragraph**
   - Removed the General Class dependency on Material Studio whiteboard-note generation before teaching.
   - This removes a large startup delay caused by `generateMaterial()`.
   - The current textbook page remains the teaching reference.

2. **3B1B Video-DNA is the primary visual mechanism**
   - General Class opens the 3B1B teaching board directly.
   - Gemini receives chapter title, chapter context, topic list, current textbook passage and grade.
   - Chapter → Lesson → Beat DNA selection determines the visual grammar.

3. **Human-teacher lesson structure**
   - The planner is explicitly required to introduce the topic/heading, explain why it matters, connect it to ordinary life, define unknowns such as x/y/z, explain the solving plan, identify common mistakes, then derive the mathematics.
   - Detailed prose is carried by teacher narration/captions, not dumped onto the visual board.

4. **No prose wall on the whiteboard**
   - Compiler narrative beats are now timed voice/caption beats with pause events, not large SVG text nodes.
   - This prevents the overlapping text seen in the screenshots.

5. **Faster voice start**
   - 3B1B TTS is now lazy/streaming: the current beat is synthesized first and the next beat is prefetched while it plays.
   - The class no longer waits for every beat's audio before the first explanation starts.
   - Each TTS provider request has an 8-second client timeout.

6. **Planner timeouts / repair cap**
   - Gemini 3B1B planning has a 20-second server timeout.
   - Browser lesson request has a 23-second timeout.
   - QA repair is capped at one repair pass instead of two.

7. **Normal completion is not STOPPED**
   - General Class reports COMPLETED after the 3B1B lesson finishes.
   - STOPPED is reserved for an actual user/navigation cancellation.
   - Closing the 3B1B board or changing pages explicitly stops the lesson.

8. **Page continuity**
   - General Class no longer generates a chapter-wide material batch that can reposition the textbook to a distant section.
   - Play begins from the currently visible paragraph/page.
   - Navigation closes/stops the active 3B1B board before changing the reference page.

9. **Malayalam mathematical speech**
   - Malayalam narration is instructed to retain technical terms in English.
   - Variables x, y, z, a, b remain English letter names for speech.
   - A conservative TTS normalizer protects common terms such as variable, equation, coefficient, constant, term, expression, substitution, solution, graph and slope.

10. **General-Class strategy isolation guard**
    - `selectTeachingStrategy(..., mode: 'general-class')` explicitly refuses interactive Mathlet referrals and selects the DNA-first visual engine.

## Validation

A full project typecheck/build cannot be claimed from this archive because `node_modules` is not included. Global `tsc` was used for parser/type inspection, but dependency-resolution errors are expected without installed project dependencies.
