# V51.9.0 — 3B1B feel: colour, counting, continuous motion, KaTeX, templates

## What changed
1. **New actions** (`lib/ai-guru/math/teaching/types.ts`, compiled in `animation/compiler.ts`, animated in `animation/runtime.ts`)
   - `recolor` `{target, color, durationMs}`: `target` is a node id, or `var:a` to recolour a variable everywhere (white until introduced, then its colour).
   - `count` `{objectId, from, to, durationMs, decimals, param?}`: counts a number in a text/latex node (`valueFormat: "total = {v}"`).
   - `tween` `{param, from, to, durationMs, easing?}`: a continuous parameter other objects read live.
   - Every one accepts `together: true` = start with the previous action, so a number counts, a point slides and a term changes colour at the same moment.
2. **Colour binding map** `lesson.colorBindings = {a:"gold", b:"blue", x:"red"}` -> `scene.colorBindings`. Single-letter variables inside LaTeX are coloured automatically; nodes can use `colorRole:"a"`; explicit `{\color{gold}2ab}` works for numbers/terms.
3. **Live objects**: node fields `valueExpr` (readout), `bindX/bindY/bindWidth/bindHeight` (position/size follow parameters), and a new `plot` node (curve `y=f(x)` with a marker that follows a parameter and draws the **tangent line**, so the slope updates continuously).
4. **KaTeX on the board** (`ThreeB1BTeachingBoard.tsx`): real fractions/roots, per-term colour, cached per string (colour interpolation is quantised so a recolour costs at most ~12 renders). Plain-text fallback if KaTeX rejects a string. Arrow heads added.
5. **Scene templates** (`teaching/scene-templates.ts`): the LLM names a template + numbers (`"sceneTemplates":[{"id":"area-model","params":{"p":2,"q":3}}]`); code validates, verifies with mathjs and builds the whole segment in English and Malayalam. Templates: `number-line-jump`, `area-model`, `completing-square`, `moving-point-graph`. Bad parameters are dropped with a warning, never drawn.
6. **Offline lessons** (`teaching/offline-template-lesson.ts`, used by `app/api/ai-guru/math/teaching/route.ts`): when no AI key exists, or the planner fails, problems the deterministic solver recognises become a coloured worked-solution lesson (KaTeX rows fade white -> step colour, one colour per variable). The client no longer refuses to start without a saved key.
7. **Safety**: expressions are evaluated by an in-house parser (`animation/expr.ts`), never `eval`; colours are whitelisted; own-property lookups only (`constructor`/`__proto__` cannot resolve).

## Not done / limits
- 4 scene templates, not 15. The `SceneTemplateSpec` interface is the extension point; each new template needs params validation + a mathjs check + a test case in `three-b1b-feel.test.ts`.
- One template per lesson (a template owns the whole board for its segment).
- Offline lessons only cover what `planTemplateSolution` recognises. In testing: linear equations, simultaneous equations and expression simplification worked; the quadratic phrasings tried returned no solution.
- Camera unchanged (zoom/pan/focus).
- Verified by unit tests and real KaTeX rendering; **not yet run in a browser/phone**. Please check playback of the four templates on a real device.

## Tests
`npm test` -> new: `animation/three-b1b-feel.test.ts` (26), `teaching/offline-template-lesson.test.ts` (6). The 13 failures already present in V51.8.20 (e.g. `animation/runtime.test.ts`, style-selector, strategy) are unchanged.
