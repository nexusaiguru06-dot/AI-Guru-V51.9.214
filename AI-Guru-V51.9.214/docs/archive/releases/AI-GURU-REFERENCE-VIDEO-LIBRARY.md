# AI Guru — Reference Video Library Additions (V44)

Three user-supplied reference videos were added as **teaching-style references**. Their mathematical content, wording, scenes, branding and artwork must not be copied into generated lessons. The videos define presentation grammar only.

## Common grammar

All three use `visual-derivation-explanation-v1`:
- one mathematical idea per beat;
- visual/concrete relationship before symbolic compression;
- preserve object/term continuity;
- concise annotations, arrows and highlights;
- deliberate pauses at reasoning insights;
- final formula/result only after verified reasoning;
- active teaching language only.

## Reference 1 — First Principles

- Asset: `/public/reference-styles/calculus-first-principles-reference.mp4`
- Style: `calculus-first-principles-reference`
- QA: `calculus-first-principles-v1`
- Domains: calculus, functions, coordinate geometry
- Suggested grades: 11–12
- Grammar: function → two points → secant slope → Δx/h → point convergence → tangent → limit → derivative.

### Generation prompt
Use the uploaded reference as a first-principles calculus teaching grammar: begin with a visible function and two points, establish the secant slope using change in y over change in x, label the horizontal change as h or Δx, move the second point toward the first while preserving the curve and point identity, show the secant approaching a tangent, connect the geometric slope to the limit definition of the derivative, and reveal the verified derivative expression only after the limit-to-tangent insight. Use a clean dark graph-first board, restrained arrows/highlights, progressive construction, deliberate pauses, and synchronized cue words. Generate original mathematics for the current lesson; never copy the reference video's exact equation, scene, narration, branding, or artwork.

### QA
Require graph construction, visible secant/tangent reasoning, Δx/h and Δy semantics, transformation continuity, pause ≥800 ms, voice-cue evidence, and a verified final derivative after the reasoning.

## Reference 2 — Slope to Derivative

- Asset: `/public/reference-styles/calculus-slope-to-derivative-reference.mp4`
- Style: `calculus-slope-to-derivative-reference`
- QA: `calculus-slope-to-derivative-v1`
- Domains: calculus, functions, coordinate geometry
- Suggested grades: 10–12
- Grammar: axes/function → two points → rise/run → Δy/Δx → secant → moving point → tangent → derivative.

### Generation prompt
Use the uploaded reference as a graph-first slope-to-derivative teaching grammar: draw the coordinate axes and function progressively, introduce two points and the secant slope as Δy/Δx, visibly track the second point toward the first, transition the secant into the tangent at the chosen point, connect the tangent slope to f'(x), and then show the derivative relationship. Preserve the curve and point continuity, use concise handwritten-style annotations, restrained highlights and arrows, and pause on the slope insight. Generate original lesson-specific mathematics; never copy exact scenes, equations, narration, branding, or artwork from the reference.

### QA
Require axes/function before slope reasoning, visible rise/run, Δy/Δx tied to the secant, continuous point movement, tangent before derivative notation, pause ≥750 ms, voice-cue evidence, and independent mathematical verification.

## Reference 3 — Quadratic Formula

- Asset: `/public/reference-styles/quadratic-formula-derivation-reference.mp4`
- Style: `quadratic-formula-derivation-reference`
- QA: `quadratic-formula-derivation-v1`
- Domains: algebra, linear equations, polynomials
- Suggested grades: 9–12
- Grammar: standard form → coefficient roles → transformation → square-root/± → discriminant → formula → worked example → sign check.

### Generation prompt
Use the uploaded reference as a quadratic-formula teaching grammar: write the quadratic equation cleanly, transform it step by step while preserving the identity of a, b, c and x, reveal the square-root and ± structure only when justified, introduce the discriminant as a meaningful quantity, then verify the formula with an original worked example. Highlight the active term or operation, use arrows and concise annotations, briefly pause after important transformations, explicitly flag sign-handling mistakes when relevant, and finish with a verified result. Never copy the reference video's exact example, wording, branding, or artwork.

### QA
Require coefficient identity preservation, explicit equation transformations, correct ± and square-root sequencing, discriminant semantics, pause ≥750 ms, voice-cue evidence, an original worked example, sign handling where applicable, and a verified final result.
