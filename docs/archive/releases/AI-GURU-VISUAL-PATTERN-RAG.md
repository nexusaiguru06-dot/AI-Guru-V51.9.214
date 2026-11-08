# Visual Pattern RAG + Visual Developer (V50)

Adopted from the design of MathVizAI (retrieve proven visual techniques before generating, verify by a real dry run,
retry with the exact error, sync the picture to the narration). Nothing is copied from that repository: its Manim
golden set is a different engine and API. This is the same idea in AI Guru's own format (`VisualAction[]`, 1000x700 board).

## Pieces (lib/ai-guru/patterns)
| file | job |
|---|---|
| `catalog.ts` | 14 tested recipes (number line, jumps, right triangle, triangle angles, parallel lines, auxiliary line, coordinate plane, fraction bar, bar chart, balance scale, area model, circle parts, Venn, callout). Pure functions: params in, actions out. |
| `search.ts` | BM25 + phrase (bigram) + small maths synonym table. Offline, instant, deterministic. |
| `verify.ts` | Dry run: structure, board bounds, references, overlapping labels AND every action is rendered through the board's own `actionSvg`. Also `fitTiming` / `estimateSpeechMs` (timing contract). |
| `developer.ts` | Visual Developer agent: auto-search + LLM `QUERY:`/`FINISH` rounds -> pick patterns + params -> build -> dry run -> retry with the exact problems. `repairVisualActions` does the same for visuals the author already wrote. |
| `section-visuals.ts` | Per-section dry run used by the material pipeline: repair by the model, then drop anything still undrawable. |
| `context.ts` | Whole-pattern text for prompts (no mid-JSON cuts). |

## Where it runs
- Material pipeline (`material-studio/pipeline.ts`): the visual specialist prompt gets the best-matching patterns; after generation `refineVisuals` develops pictures for steps without one (only steps whose own words carry a pattern's strong signal, at most 4 per section) and dry-runs every visual.
- Classroom: diagram labels (`placement: 'absolute'`) play in every board mode; a step's picture is drawn while its caption is spoken, fitted to the speech length.
- Board: each answer has one 1000x700 "figure" for lines/shapes/labels; captions and the # √ ® ^ icons flow around it.
- `GET /api/ai-guru/patterns?q=...` search, `POST` build + preview. `npm run patterns:gallery` writes `public/pattern-gallery.html`.

## Switches
`NEXT_PUBLIC_AI_GURU_VISUAL_DEVELOPER=0` turns off the extra model calls (the dry run of existing visuals stays on).

## Adding a pattern
Add an entry to `PATTERNS` with `signals`, `example`, and a `build` that only uses `Builder`. The catalog tests then check it
(example is clean, empty/garbage params never throw, everything inside the board) and the search tests should get a case.
