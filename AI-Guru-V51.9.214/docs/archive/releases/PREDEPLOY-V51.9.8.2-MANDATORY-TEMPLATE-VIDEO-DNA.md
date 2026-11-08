# V51.9.8.2 — Mandatory template + Video-DNA board wiring

## Root cause of blank / text-only whiteboard
1. Video-DNA was only injected into the **Gemini prompt**. Offline/fallback never applied DNA grammar.
2. `ai-guru-visual-template-registry.json` was never consulted at runtime.
3. `teacherReadingMode` blocked `offlineSolverResponse`, so equation pages fell back to label text.
4. No gate required create+recolor board actions — text-only lessons could pass QA.

## Fix
### `template-selector.ts` (new)
- `selectTeachingTemplate()` — hierarchical Video-DNA + equation family + style catalog
- `mandatoryBoard: true` when `planTemplateSolution` recognizes the problem (beads, simultaneous, linear, …)
- `applyTemplateSelectionGrammar()` stamps archetype, dnaIds, constructionPattern, motifs onto the lesson

### `route.ts` (rewired)
1. **Always** run template selection first (online or offline)
2. If `mandatoryBoard` → build worked-solution template **before** Gemini; reject text-only boards
3. If planner returns empty board → override with mandatory solver template
4. Response includes `template: { archetype, dnaIds, constructionPattern, motifs }`

### `offline-template-lesson.ts`
- Focus circle marks on changed spans (3B1B visible construction)

### Board order
- Solver segments first → coloured equations appear immediately

## Expected Page 7
- Template family: worked-solution-simultaneous (`b + w = 100`, `b = w + 10`)
- Video-DNA primary archetype applied to visualGrammar
- Board shows KaTeX rows + recolor + focus marks, not prose labels
