# Motion Class: textbook → bilingual 3B1B-style class with DNA templates (V51.9.19, interactive V51.9.20)

Page: **Motion Class** (`/ai-guru/motion-class`) · Code: `lib/ai-guru/motion-class/` · Tests: `motion-class.test.ts`

## 1. What a class looks like

For every **teaching unit** (a paragraph, a problem, a worked solution, a result) of the section:

| # | Segment | What happens |
|---|---|---|
| 1 | **Read · English** | The textbook text on the board, read aloud sentence by sentence. The sentence being read turns dark with its numbers coloured; equations are centred as in the book; captions highlight word by word. |
| 2 | **Teach · English** | The unit's DNA on the whiteboard (motion grammar: focus, colour roles, moving and transforming digits), explained step by step. |
| 3 | **Read · മലയാളം** | The Malayalam translation, read aloud the same way. |
| 4 | **Teach · മലയാളം** | The **same plan** built again in Malayalam: identical board graphics, Malayalam captions and voice. |

The order can be switched to "both readings first". Bridge sentences ("Let's start with a problem:") are read together with the next unit. Side boxes are optional. A Malayalam pass is only made when the plan has Malayalam; it is never filled with English.

## 2. Reading the textbook (`layout.ts`, `segment.ts`)

pdf.js gives positioned text runs. The layout reader:
- repairs Symbol-font glyphs (Private Use Area → − × ÷ ∠ ≈ …);
- finds the body font size, then tags each run: body, heading, chapter title, side box, cartoon speech, running head/folio;
- turns stacked numerators/denominators into `{a/b}` fraction tokens inside their line;
- keeps "words → equation" rows together (`Price of 2 pens… → 2x + 3y = 110`) and number tables.

The segmenter builds chapters → sections → blocks: `heading`, `prose`, `problem` (indented problem box), `math` (equation runs), `result` (after "We state this as a general result:", "In general," "For any…"), `exercise` (numbered "(3) …", continuation lines kept), `aside`. Front matter before the first chapter opening is skipped. **Teaching units** then merge a worked solution spread over small blocks (lead-in "…altogether," + equation + "We can extract x from this:" + equations + "Thus we get…") into one unit.

On SCERT Kerala Mathematics IX Part 1 (144 pages): 7 chapters found, 1,155 teaching units, 414 mandatory.

## 3. DNA templates and selection logic (`dna/registry.ts`)

Features read from each unit: kind, numbers, equations, letters, question words, units (rupees, cm…), geometry words, "picture/draw", area + rectangle, identity patterns `(x + y)(u + v)`, "For any…", number-line words, numbers-only tables, labelled rows, reasoning words, graph words (graph, plot, parabola, coordinates, slope, "y = …x"; not bar graphs), plane words (matrix, vector, reflect, rotate, shear, dilate), sequences.

| DNA | Picked when | Board |
|---|---|---|
| bridge | short connecting sentence | read only |
| section-intro | heading | heading + key ideas, key terms focused |
| concept-board | explanation paragraph | 2–5 short board lines, key terms coloured |
| mental-math | arithmetic reasoning in words | chain of small calculations; numbers fly line to line |
| word-problem | problem / exercise with data and a question | problem card, quantities highlighted → unknowns x, y → each condition → its equation → solved (verified) → answer |
| equation-chain | ≥ 2 equations, or a worked solution | each line built from the previous one: move, swap, merge, split, cancel |
| equation-pair | two equations in two unknowns | numbered (1), (2), like terms coloured alike |
| translate-table | rows of words with their equation | words → equation, letters keep colours |
| number-table | numbers-only table | row ×2 (every cell rolls), rows subtracted |
| key-result | highlighted general result | statement, key terms focused, boxed, tick |
| identity-formula | identity / formula | letters in role colours, substitution, products merge |
| area-model | area + rectangle + product | rectangle split, part products roll into numbers, sum |
| column-arithmetic | written column sums | carries, borrows, long division |
| geometry-construction | geometry words / picture | points, lines, parallels, perpendiculars, arcs, right-angle marks, equal ticks, shaded triangles |
| fraction-bars | fractions, halves/quarters, numerator/denominator, "3/4", parts of a whole | bar cut into equal parts and coloured; cutting shows equivalent fractions; joining adds; 10×10 tiles give decimal and percent |
| histogram | bar graph, histogram, frequency, mean, median, data, survey | bars grow from zero; dashed mean / median lines computed by the app slide when a bar changes |
| probability-tree | probability, chance, coin, dice, outcomes, tree diagram | tree with exact-fraction branches; a path multiplies, an event adds, the ends total 1 |
| matrix-grid | what a matrix is: matrix + rows, columns, entries, a12, order, square | bracketed grid; row / column / diagonal boxed; camera zooms into one entry and its subscripts; size A ∈ ℝ^{r×c}; n × n and m × n with dots; Square / Rectangular |
| number-line | negative numbers, left/right | points, jumps, opposites |
| plane-transform | matrix, vector, reflection, rotation, shear, dilation | coordinate plane, î / ĵ, vectors, shapes, **the whole plane moves**, matrix columns, determinant |
| function-graph | graph, coordinates, plot, curve, parabola, slope, "y = …x" | axes, plotted points, curve, tracker reading (x, y), shaded area, curve that bends when a parameter changes |

Every DNA scores the unit 0–1; the best wins (scores and the reason are shown per unit in Motion Class).

**Mandatory rule.** Problems, exercises, equation runs, results and any unit stating an equation or formula *must* be taught with a DNA. If the best built-in score is below 0.6, the unit is marked **needs AI DNA**: the AI planner composes a **new DNA** from built-in segments (e.g. figure → equation chain), it is validated, named, given keywords and **saved to the learned library** (`dna/learned.ts`, exportable JSON). The next similar unit selects the learned DNA, and the AI fills its structure again. In this book, 71 units need a new DNA (mostly in geometry and negative numbers); everything else maps to a built-in DNA. Without AI, mandatory units still get the closest built-in DNA, flagged as a fallback.

## 4. Planning (`plan/ai.ts`, `plan/offline.ts`, `plan/validate.ts`)

**AI planner** (Gemini, BYOK key rotation; page picture attached for figure-based units). For one unit it returns
```json
{"dna":"word-problem","read":{"en":"…textbook text…","ml":"…Malayalam translation…"},"teach":{ …DNA plan, every caption {"en","ml"}… }}
```
plus `newDna` when composing. Prompt rules: Kerala-classroom Malayalam, identical maths tokens in both languages, short spoken captions, short board labels, every equation true with `solutions` given, follow the textbook's own method, model a problem (no solving) when the book solves it next.

**Validator** (every plan, AI or not): structure, Malayalam present and in Malayalam script, tokens well formed, every equation line true for the given values (safe evaluator), word-problem equations true, solver inputs solvable, and the plan must build in both languages. Errors go back to the AI word for word (max 3 tries); a plan that still fails falls back to the offline plan with the reason shown.

**Offline planner** (no key): headings, bridges, equation chains with step captions in English and Malayalam (from AI Guru's verified template solver), equation pairs, words → equations tables, results, and word problems the solver recognises. Malayalam reading needs the AI.

Plans are cached per unit text, so a planned chapter opens instantly next time.

## 5. Voice, captions, export

Voice comes through the classroom TTS chain (Edge → Piper → Google → Sarvam). Each step waits for its clip; captions highlight word by word, with a READ / STEP (വായന / ഘട്ടം) pill numbered per segment. A whole section exports as one MP4 (1280×720) plus `.srt` subtitles (kept alongside the interactive player, §7).

## 6. Sample

`samples/scert9-ch1-s1.ts`: bilingual plans for the first units of Chapter 1 "Pairs of Equations" (section intro, beads problem, mental math, algebra board, worked solution, table-and-chair problem, mental math), hand-written in the planner's JSON format and passed by the same validator. They load automatically when that section is opened, and are the golden examples for the AI.

## 7. Interactive class (`interactive-player.ts`, V51.9.20)

The class is no longer only a video. `buildClassTimeline()` joins the prepared segments into one timeline: the joined reel, one WAV voice track (24 kHz), **step marks** (one per caption: t0, t1, text, segment) and **segment marks** (Read/Teach · language). `ClassPlayer` draws the board as a pure function of the audio clock (`drawReelFrame` at `audio.currentTime`), so every control is exact and scrubbing is instant.

| Control | How |
|---|---|
| Play / pause | ▶ on manim-web's bar, click on the board, Space / K |
| Seek | progress bar (Read/Teach parts marked on it), Shift+← / →, Home / End |
| Speed (slow teaching) | 0.25×–2× in the bar or the chips (0.5×…1.5×), `[` / `]`; `preservesPitch` keeps the voice natural |
| Step by step | ⏭ / ⏮ (or → / ←) jump to next / previous step; ⏮ goes to the start of the current step if more than 1.2 s in |
| Pause after each step | slides mode (bar button, S, or the checkbox): the class stops at the end of every step; ▶ plays the next |
| Replay / restart | R replays the step; "Restart this part", "Restart class" |
| Language switch | "Hear it in മലയാളം / English" jumps to the same block and phase in the other language |
| Transcript | every step listed; click to jump; follows playback |
| MP4 | "Save MP4 + subtitles" and the bar's export menu render the same timeline to MP4 + .srt |

manim-web's PlayerUI and PlayerController both listen for clicks on the player, so one click arrives twice; `ClassPlayer.toggle()` ignores a second toggle within 120 ms. Tested in Chromium: pause holds time, 0.5× advances at half speed with pitch preserved, step jumps land on step starts, slides mode stops within 20 ms of a step end, segment jump, click and Space toggle once, restart.

## 8. The coordinate board (V51.9.21): plane-transform and function-graph

The Motion engine gained the primitives a 3Blue1Brown board needs, all still pure functions of time (so pause, scrub, speed, MP4 stay exact):

| Primitive | What it does |
|---|---|
| `morph` | A polygon's vertices travel to new places (same vertex count). Grid lines shear, shapes reflect, curves bend. Every vertex moves in a straight line, which is exactly how a matrix transformation is interpolated. |
| `vector` / `moveVector` | Arrow with a head, drawn by pen; both ends can move. |
| `clip`, `background`, `fixView` | Items stay inside the plane's box; grid lines do not stretch the view; the view can be fixed. |
| `Plane` (`reels/motion/plane.ts`) | Maths coordinates → board pixels. Everything placed on it remembers its maths coordinates, so `setMatrix(M)` sends the **whole space** (grid, axes, vectors, labels, shapes) to M in one call; the 2×2 matrix on the board rolls to the new numbers, its columns coloured like î (green) and ĵ (red). Labels ride along the vectors, not at fixed pixel offsets. |

**plane-transform** steps: `grid`, `basis`, `vector`, `combine` (v = x·î + y·ĵ), `shape`, `square`, `matrix`, `transform` (composes with what is already applied), `det`, `reset`. **function-graph** steps: `axes`, `curve`, `point`, `tracker`, `shade`, `morph`, `segment`.

**Everything numeric is computed by the app**, not written by the planner: matrix entries, the determinant, the coordinates read by the tracker, the curve itself. The validator rejects a curve that leaves the picture, a formula that is not defined, a matrix that throws a vector off the plane, a tracker without a curve, unknown steps. The samples (`samples/plane-graph.ts`) are bilingual golden examples and pass the same validator.

**Visual QA** (`plan/visual-qa.ts`): every unit that is not a heading or bridge is measured for drawings and for the share of the time a drawing is on screen. A text-only board gets a "Text-only board…" warning in the unit list, from both the offline and the AI planner, so the remaining gaps (probability, statistics, fractions, sequences) are visible instead of silent.

**Offline**: a unit that states `y = …x` gets a graph without AI (range chosen so the whole curve fits). Plane units need the AI planner. Plans cached before this version are not reused (cache key `v2`).

Speech: î and ĵ are read "i hat" / "j hat" (Malayalam ഐ ഹാറ്റ് / ജെ ഹാറ്റ്).

## 9. Fractions, data and chance (V51.9.22)

Same principle as §8: the planner chooses **what to show**, the app computes **every number**.

| DNA | Plan inputs | Computed by the app | Rejected by the validator |
|---|---|---|---|
| `fraction-bars` | `bar{n,shade}`, `split{bar,by}`, `shade{bar,to}`, `join{a,b}`, `grid{rows,cols,shade}` | fraction labels, shaded widths, joined fractions; decimal and percent only when the tiles are tenths/hundredths (percent when N divides 100) | n outside 1–24, shade > n, > 5 bars, joins of unequal parts or sums above 1, splits beyond 24 parts, grid > 100 tiles, bars mixed with a grid |
| `histogram` | `categories`, `yMax`, `bars{values}`, `highlight`, `mean`, `median`, `line{y}`, `change{index,to}` | bar heights, value labels, mean, median; after `change` the lines and their labels move to the new values | 2–12 categories, labels ≤ 8 characters, values outside 0…yMax, bars drawn twice, mean/median/change before bars |
| `probability-tree` | `branches[{label,p,children}]`, `grow`, `path`, `event`, `total` | exact products along a path, sums over an event, the total of all ends | p not a fraction in 0…1, siblings not adding to exactly 1, depth > 3, > 8 ends, paths that stop before an end or use a missing branch, steps before the tree is grown |

Samples (`samples/fractions-stats.ts`) are bilingual and pass the same validator as AI plans. English and Malayalam builds are identical in items and positions; only captions differ.

**Offline.** One bar per fraction found in the text (at most three, proper fractions, ≤ 24 parts). Data and chance need the AI planner; offline they fall back to a flagged concept board.

**Not covered yet:** pie charts, number-line fractions, frequency polygons, grouped class intervals, probability with more than 3 stages.

## 10. Semantic DNA selection (V51.9.23)

The keyword rules in `dna/registry.ts` read English. Malayalam paragraphs, and English ones that avoid the usual words, can fall through to a text-only concept board. `dna/semantic.ts` adds a second opinion by meaning.

**How it decides** (`decide()`): embed the paragraph (first 700 characters) → cosine against every sentence of every DNA card (`dna/cards.ts`, English and Malayalam) → best card per DNA. The closest DNA wins only if its similarity ≥ `minCos`, it stands ≥ `minZ` standard deviations above the others, and it leads the runner-up by ≥ `margin`; **and** the rules were not sure (score < 0.8, or concept board, or needing the AI). Headings, bridges, equation runs and any embedder failure leave the rule-based answer untouched. The result carries `semantic: { dna, cos, z, used }` so the DNA Studio can show why.

**Use**
```ts
const emb = ollamaEmbedder({ model: 'embeddinggemma-2', dims: 768 });   // check the tag with `ollama list`
const index = await buildDnaIndex(emb);                                  // embeds the cards once, cached
const selections = await hybridSelections(blocks, chapterTitle, index, emb); // one call per section
const plans = await planSection(blocks, ctx, llm, { selections });
```
From a browser, Ollama must allow the page's origin (`OLLAMA_ORIGINS`), or call it from a server route.

**Evaluate** (`scripts/dna-embed-eval.ts`): runs the rules, rules + hashed n-grams, and (if Ollama answers) rules + EmbeddingGemma at several thresholds, on 24 English + 24 Malayalam paragraphs; `--show` lists every wrong answer. Pick `minCos` from the sweep for your model and dimension. The default (0.45) is a guess until you have run it.

**What was and was not verified.**
- Verified in the build sandbox: the selection logic, fallbacks, request shape, caching, and the harness, with test doubles and the hashed embedder.
- Rules alone on the set: English 67 %, Malayalam 17 % (the only Malayalam hits are concept-board paragraphs that correctly stay text).
- Rules + hashed n-grams (similarity threshold 0.4, chosen from the sweep; 0.2–0.3 sends three plain paragraphs to a picture): English 75 %, Malayalam 63 %. Treat the Malayalam figure as optimistic: the cards and the evaluation paragraphs were written by the same author in similar vocabulary, so shared letters flatter it.
- NOT run: the real EmbeddingGemma 2 model (Hugging Face and Ollama are unreachable from the build sandbox). The model tag (`embeddinggemma-2`) and prompt prefixes (`task: search result | query: …`, `title: none | text: …`) come from third-party write-ups, not from a first-party model card I could read; confirm both.
- The Malayalam cards and evaluation sentences were drafted by the assistant; have a Malayalam teacher read them.

**Not wired:** no screen switches this on yet; `planSection` accepts the selections, the Motion Class page does not pass them.

## 11. Matrix as a grid, deep zoom, dark board (V51.9.24)

Built after the user shared a 27-second vertical clip of a matrix introduction (rows, columns, diagonal, zoom into a₃₃, size, n × n, m × n). AI Guru's own version, not a copy of the clip's frames.

| Step | What the viewer sees | Computed by the app |
|---|---|---|
| `show` | `A =` and the bracketed grid | every entry a_{ij} (or the plan's numbers); cell positions |
| `row` / `column` | pen-drawn box and its label | the box sits on the chosen row / column |
| `diagonal` | tilted box along a₁₁ … a_kk | the box follows the line through the first and last diagonal cell |
| `entry` | camera zooms into the entry, which turns green | zoom centre = the entry |
| `indices` | arrows from "# of rows" / "# of columns" to the two subscript digits | digit positions from the text metrics |
| `zoomOut` | camera back, colours restored | – |
| `size` | `A ∈ ℝ^{r×c}` and "r × c matrix" | r and c from the grid |
| `kind` | Square Matrix / Rectangular Matrix | rows = columns? |
| `general` | the grid becomes a_{11} a_{12} … a_{1c} / ⋮ ⋱ / a_{r1} … a_{rc} with letters r and c | letters from the plan (single lowercase), dots drawn as shapes |

Validator: size 1–5, entries rectangular, `show` first and once, indices and zoom only after `entry`, no highlight on the dots row / column, at most two `general` steps.

**Engine additions.** Subscripts in board text (`a_{12}`). `Motion.look(t, y, h, dur, x)`: giving `x` switches on deep zoom (`scene.camX`): the board scales by height/camH without the old 1.6× cap, centred on (x, y). Scenes that never pass `x` draw exactly as before. `DrawOptions.theme: 'dark'`: black board, light ink (very dark navy/near-black items and card text become light, role colours stay, the focus halo is softened).

**Language.** The words on the board (row, column, diagonal, # of rows, # of columns, matrix, Square / Rectangular Matrix, and the histogram's mean / median) come from small two-language dictionaries in the builders; positions and numbers are identical in both languages. The Malayalam words are a draft for a teacher to check.

**Not done.** The Motion Class page has no dark-theme switch yet (pass `theme: 'dark'` to `drawMotionFrame` / the player options). Matrix multiplication and transposition are not drawn. Real browser playback, voice and MP4 of this DNA are untested; frames were rendered with a sandbox font (no Malayalam glyphs).



## 12. Shapes with their formulas (V51.9.25)

Built after the user shared a 53-second vertical clip of a formula sheet (circle with r, rectangle with l and w, right triangle with a, b, c and a² + b² = c², a triangle with its height h, the special 30-60-90 and 45-45-90 triangles with angle arcs). Written fresh for AI Guru.

| Step | What the viewer sees | Computed by the app |
|---|---|---|
| `shape` (kind, optional a, b) | the old figure fades, the new one is drawn by pen, right angles get the small square | proportions: 30-60-90 from a, a√3, 2a; 45-45-90 from a, a, a√2; numeric legs keep their ratio |
| `label` | side labels (circle: the radius line and r) | letters, or the numbers: hypotenuse √(a²+b²) in exact form |
| `height` | dotted height with a right-angle mark and h (triangle only) | foot of the height under the apex |
| `angles` | arcs with 30° 60° / 45° 45° (special triangles only) | the arc really spans that angle (tested) |
| `formula` (area, perimeter, circumference, pythagoras, ratio) | the rule, then the worked numbers (last line green) | every number and root; only formulas that belong to the shape are accepted |
| `name` | the shape's name under the figure | two-language dictionary |

Validator: figure first; kind in the list; `a`, `b` whole numbers 1-50, `b` only for rectangle / triangle / right-triangle and then required together with `a`; height only on triangle; angles only on special triangles; at most 6 shapes, 24 steps.

**Engine.** `√` is drawn (the Noto Serif board font has no √, ∠, △ or ⊥; it does have π, °, ², ½, ×). Rich text grammar: `√3`, `5√2`, `√{x+1}` (radicand = digits/letters or braces). Circles, arcs and right-angle marks are polylines (`reels/motion/shapes.ts`).

**Language.** Shape names and captions change language; geometry, labels and formulas are identical in English and Malayalam. The Malayalam is a draft for a teacher to check.

**Not done / not checked.** `∈` and `⋱` (matrix size line, V51.9.24) are also missing from the board font and rely on the browser's fallback font; not verified in a real browser. No Malayalam font, voice or MP4 run in the build sandbox. Not built: pie charts, unit circle, similar triangles, area of a trapezium or parallelogram, 3-D solids.


## 13. Sets and Venn diagrams (V51.9.26)

Built after the user shared a 22-second vertical "Set Operations" clip (universe rectangle, two circles, a shaded region for each of ∩, ∪, Aᶜ, A − B, B − A, Aᶜ ∪ B, A ∪ Bᶜ and De Morgan's laws) and a three-set recipe clip (used only for the idea of naming overlaps). Written fresh for AI Guru.

| Step | What the viewer sees | Computed by the app |
|---|---|---|
| `show` | U rectangle, circles A B (C), letters, optional words, elements | positions; each element's region from the lists |
| `shade` expr | the region fills; the expression is written beneath | which of the 2^n regions the expression covers |
| `identity` left right | left is shaded, then `left = right` is written | both sides are the same set (checked; a false identity is refused) |
| `list` expr | region shaded, its elements lit, `A ∩ B = {2, 4}` | the elements, from the lists |
| `inclusion` | `n(A ∪ B) = n(A) + n(B) − n(A ∩ B)` then the counted numbers | n(A), n(B), n(A ∩ B), n(A ∪ B) |
| `clear` | shading and line removed | – |

Expressions: letters A B (C), `∪` `∩` `−` and a trailing `'` (also `^c`, ᶜ, `U`, `-`). The complement binds tightest; chains of one operator are fine, mixing operators needs brackets.

**Engine.** `Motion.region(id, {rect, circles, codes}, t, opts)`; membership code: bit i = inside circle i, 0 = outside all. Drawn by clipping, so shading is exact (checked against real pixels). Symbols ∪ ∩ ∅ ∈ are strokes (`drawSymbol`).

**Limits.** At most 6 elements per region and few in the small regions (the validator says which); inclusion–exclusion only for two sets; no three-set element counts; no subset (⊂) or power-set pictures; word problems with numbers ("40 students, 25 like tea …") still go to the word-problem DNA (they could be modelled as Venn counts later). Malayalam terms (ഛേദം, യോഗം, പൂരകം, സാർവിക ഗണം) are my draft and need a teacher; no Malayalam font, voice or MP4 was run in the build sandbox.

## 14. Trigonometric ratios on the unit circle (V51.9.27)

Built after the user shared a "Trigonometric Ratios" clip (unit circle with a tangent line and each ratio shown as a coloured segment). Written fresh for AI Guru.

| Step | What the viewer sees | Computed by the app |
|---|---|---|
| `show` | axes, unit circle (and angle θ) | circle radius so every segment fits |
| `point` | P on the circle, radius, θ arc, (x, y) | P = (cos θ, sin θ) |
| `legs` | x leg (green) and y leg (red), right-angle mark | foot of P on the x-axis |
| `ratio` which | segment of that ratio, label turned along it, formula line | endpoints from the tangent at P; length = ratio |
| `sweep` to | θ moves; segments, point, labels follow | geometry at every frame |
| `values` | cos, sin, tan at the angle; exact at 30°/45°/60° | exact table or decimals |
| `identity` which | the identity is written | checked true at the current angle |
| `box` | frame round the formulas | – |

Lengths: cos = horizontal distance, sin = vertical, tan = |PX|, cot = |PY| (X, Y where the tangent at P meets the axes), sec = |OX|, csc = |OY|.

**Engine.** `Motion.turn(id, radians, t, dur)` rotates a text item; drawn with `ctx.rotate`.

**Limits.** First quadrant only, angles 20–70°; no general unit circle (negative angles, radians, graphs of sin and cos); no trig word problems (heights and distances) – those still go to the word-problem DNA. Malayalam captions are my draft and need a teacher; no Malayalam font, voice or MP4 was run in the build sandbox.

## 15. A pair of linear equations (V51.9.28)

Built after the user shared a 12-second "System to Matrix" clip (three equations with coloured unknowns whose coefficients fly into a matrix, ending in A · x = b). The Std IX textbook has no matrices, so the DNA teaches the pair of equations first (lines, elimination, substitution) and keeps the matrix form as the optional last step. Written fresh for AI Guru.

| Step | What the viewer sees | Computed by the app |
|---|---|---|
| `show` | (1) and (2) written token by token, red and green | – |
| `graph` | plane ±8 with numbers, both lines, labels (1) (2) | the visible part of each line |
| `meet` | dot at the crossing, label (2, 3) | the solution; a label spot clear of the lines |
| `eliminate` var | equations multiplied (tag "(2)×2"), rule, + or −, `7x = 14`, `x = 2` | multipliers (lcm), add or subtract, the one-unknown equation, its value |
| `substitute` into | `2(2) − y = 1`, `y = 3` | the equation with the value put in; the other unknown |
| `check` | `3(2) + 2(3) = 12` and a tick, for both equations | true by construction |
| `matrix` | brackets, coefficients fly in, `x y`, `=`, right-hand sides | the same numbers as the equations |

Accepted systems: coefficients a, b non-zero whole numbers from −9 to 9, c from −60 to 60, one solution that is a pair of whole numbers from −6 to 6.

**Limits.** Only two equations in two unknowns (no three-unknown systems, no matrix solving by inverse or row reduction); no parallel or coincident lines (the "no solution / infinitely many solutions" cases are not drawn); no fractional solutions; word problems with numbers ("the sum of two numbers …") still go to the word-problem DNA. Malayalam captions are my draft and need a teacher; no Malayalam font, voice or MP4 was run in the build sandbox.

## 16. Arithmetic sequences (V51.9.29)

The first DNA written for a branch the engine did not cover at all (sequences had no DNA; the selector only kept them out of mental-math). Written fresh for AI Guru in the style of the earlier DNAs.

| Step | What the viewer sees | Computed by the app |
|---|---|---|
| `show` | the first terms in boxes, x₁ x₂ … beneath | the terms from a and d |
| `diff` | arrows between boxes labelled +d | the common difference |
| `formula` | x_n = a + (n − 1)d → with numbers → 4n − 1 | the simplified formula |
| `term` n | x_n worked out in three lines | the value |
| `pairs` | brackets first–last …, each labelled with the same sum; pairs × sum | the sums (all equal) and the total |
| `sum` n | S_n = n ÷ 2 × (first + last) … (4 lines for odd n) | S_n |
| `test` v | v = a + (n − 1)d → n − 1 = … → n = 25 ✓ or n = 1/3 ✗ | whether n is a whole number ≥ 1 |
| `graph` | points (n, x_n), dashed line | the plane window and points |

Limits: arithmetic only (no geometric sequences, no series notation, no sequences given by a rule such as n² + 1); a and d whole numbers; n up to 100; the row shows at most 7 terms. Malayalam captions are my draft and need a teacher; no Malayalam font, voice or MP4 was run in the build sandbox.

## 17. Quadratic equations (V51.9.30)

| Step | What the viewer sees | Computed by the app |
|---|---|---|
| `show` | the equation a x² + b x + c = 0, pinned at the top | the text from a, b, c |
| `graph` | the parabola on a plane, caption y = … | the window and the curve |
| `discriminant` | D = b² − 4ac → with numbers → D, and D > 0 / D = 0 / D < 0 | D |
| `factorise` | split the middle term, group, (…)(…) = 0, x = r₁ or x = r₂ | m, n with m + n = b, mn = ac, the grouping |
| `formula` | x = (−b ± √D) / 2a, the numbers, the roots (or "no real root") | the fraction and its simplification |
| `roots` | dots on the x-axis with their values | exact rational roots |
| `check` | each root put into the equation, ticked | only whole-number roots |

Limits: ax² + bx + c = 0 with whole numbers only (|a| ≤ 6, |b| ≤ 20, |c| ≤ 36); no completing the square, no complex roots, no word problems (the planner may use them in the title). When D is not a perfect square the formula ends with ± √D and no dots are placed. Malayalam captions are my draft and need a teacher; no Malayalam font, voice or MP4 was run in the build sandbox. A root label close to the y-axis can touch the axis tick numbers (seen once, with root −1/2).

## 18. Polynomials (V51.9.31)

Built from the "Polynomials" reference clip (terms and degree, adding, multiplying, long division, remainder and factor theorems, difference of two squares, roots on the graph). The clip's glowing background, complex roots (x² + 4 = 0 → ±2i) and the stock-style bar chart were left out: they are not in the school course and the board style is clearer.

| Step | What the viewer sees | Computed by the app |
|---|---|---|
| `show` | P(x), degree, coefficients, leading and constant term | from the coefficient list |
| `add` / `subtract` | columns by power: P, Q (or −Q), rule, sum; the result line | column sums |
| `multiply` | area table; like powers in one colour; the product | every cell, the collected product |
| `divide` | long division by x − r, line by line; q and R | quotient terms, products, what is left |
| `remainder` | P(r) with brackets → values → result, boxed (tick when 0) | P(r) |
| `factor` at a | P(a) = 0 ✓, P(x) = (x − a)(…), every factor | the quotient and all whole-number roots |
| `identity` | lines, area picture, product check | which identity P is, k |
| `graph` | the curve y = P(x) | window with all real roots and turning points |
| `roots` | dots at the whole-number roots | integer roots |

Limits: P of degree 2–4 with coefficients −12..12; Q of degree 1–3 with coefficients −9..9; divisor x − r only (monic, so the quotient stays whole); `divide` up to degree 3 (the lines must fit the board); `factor` needs a monic P with whole-number roots; no complex roots, no non-monic division, no factoring by grouping of polynomials with other shapes. Malayalam captions are my draft and need a teacher; no Malayalam font, voice or MP4 was run in the build sandbox. The tick labels of the two axes can touch at the origin corner (the plane's own placement, under half a pixel).

## 19. Angle geometry (V51.9.32)

Three figures, each with one given angle; the app computes and draws everything else. Angles are drawn as arcs with degree labels (the board font has no ∠ sign).

| Figure | Steps | What the viewer sees |
|---|---|---|
| `parallel` | `show`, `given`, `vertical`, `linear`, `corresponding`, `alternate`, `cointerior` | two lines with chevrons, a transversal, the given angle in red, each partner arc with its value and the rule in words on the right |
| `triangle` | `show`, `angles`, `find`, `sum`, `exterior` | triangle ABC, arcs at A and B, "?" at C turning into 180 − A − B, the sum, the extended side and the exterior angle |
| `circle` | `show`, `centre`, `circumference`, `double`, `same-arc`, `cyclic` | circle, centre angle on a chord, circumference angle (right-angle square at 90°), second point on the same arc, opposite point of the cyclic quadrilateral (centre group fades to keep the picture clear) |

Limits: parallel angle 30–150 except 90; triangle angles 20–120 with A + B between 60 and 160; circle angle 20–90 (the centre angle 40–180). No proofs with unknown letters, no tangent-chord angle, no several transversals. Malayalam captions are my draft and need a teacher; no Malayalam font, voice or MP4 was run in the build sandbox.

## 20. Solids (V51.9.33)

Five solids, each drawn in oblique projection (depth runs up and to the right, hidden edges dashed). The sizes are written next to the edges in the colour of the letter used in the formulas on the right.

| Step | What the viewer sees | Computed by the app |
|---|---|---|
| `show` | the solid, its sizes, the sizes listed on the side | scale to fit, every point |
| `base` | the base shaded; its area | l × w, ½ a b, π r² |
| `slant` | cone: the slant side, l² = r² + h²; prism: c² = a² + b² | whole-number third side |
| `volume` | formula, numbers, result (and the decimal for π values) | base × h, ⅓ π r² h, ⁴⁄₃ π r³ |
| `net` | the surface opened flat, the area in every piece | cross of 6 rectangles; 3 rectangles + 2 triangles; 2 circles + rectangle 2πr × h; circle + sector of radius l and arc 2πr |
| `surface` | the pieces added; the sphere shows four great circles | sum of the pieces; 4π r² |

Limits: cuboid sides 2–20 (biggest at most 4× the smallest); prism legs 3–24 with a whole hypotenuse and length 2–20; cylinder r 1–14, h 2–30; cone r, h 1–24 with a whole slant height; sphere r 1–15; every size a whole number (so r = 3.5 or l = √41 needs the planner to choose other sizes). π ≈ 3.14 for the decimals. No hemisphere, frustum, composite solid or cube-as-special-case step, and no "find r from the volume" (the planner may use such problems for the title only). Malayalam captions are my draft and need a teacher; no Malayalam font, voice or MP4 was run in the build sandbox. The pictures are small on the landscape board (the same design space as the other DNAs).

## 21. Ratio and percent (V51.9.34)

A bar model: the same picture a teacher draws on the board for sharing and for percentages.

| Kind | Steps | What the viewer sees |
|---|---|---|
| `share` | `show`, `unit`, `parts`, `check` | blocks per ratio part, total bracket; the value of one block in each block; each share under its group; shares added with a tick |
| `percent` | `show`, `tenth`, `part`, `result` | ten tenths, whole bracket; a tenth in each block, 10% … 90% below; p% shaded with its bracket; the answer |
| `change` | `show`, `change`, `result` | original bar; the extra (green) or removed (purple) p% piece with its value; the new amount in a bracket, original ± piece, "(100 ± p)% of the original" |

Limits: ratio of 2–3 whole numbers 1–9 (at most 20 blocks), total up to 5000 and a multiple of the sum; whole 10–5000, percentage a whole number 1–100 (decrease 1–90), and p × whole a multiple of 100 so every answer is whole (the tenth may have one decimal). No fractional percentages, no reverse problems (find the whole from the percentage), no compound change, no profit-and-loss or interest chains, no ratio simplification step. Malayalam captions are my draft and need a teacher; no Malayalam font, voice or MP4 was run in the build sandbox.

## 22. Pie chart (V51.9.35)

| Step | What the viewer sees | Computed by the app |
|---|---|---|
| `show` | the circle; the data listed in the sector colours | — |
| `total` | the data with "Total = a + b + c = n" | the sum |
| `angle` | {value/total} × 360° = …° for each; the sectors drawn clockwise from the top, angle outside, name inside | every angle and sector |
| `percent` | {value/total} × 100% = …% (≈ when rounded to two places); the labels change to percentages | every percentage |
| `check` | the angles added to 360°, a tick | the sum |

Limits: 2–6 values; every angle a whole number of degrees and at least 15° (so the total must divide 360 × each value); total up to 1000; names up to 10 characters, the same text in English and Malayalam (the planner may write them in Malayalam, but no Malayalam font was tried here). No reading questions ("which sector is largest"), no reverse problems (angles given, find the values), no pie charts with percentages given instead of counts. Malayalam captions are my draft and need a teacher; no Malayalam font, voice or MP4 was run in the build sandbox.

## 23. Number-line fractions (V51.9.36)

| Kind | Steps | What the viewer sees |
|---|---|---|
| `mark` | `show`, `divide`, `mark`, `mixed` | the line with wholes; each whole cut in D parts, one part {1/D}; a dot and label per fraction, {n/d} = n × {1/D}; improper fractions as mixed numbers |
| `equivalent` | `show`, `scale`, `result` | the fraction on a line of d parts; a second line of d × k parts with a dashed link to the same point; {n/d} = {nk/dk}; both stretches shaded |
| `compare` | `show`, `common`, `result` | both fractions marked; rewritten over the common denominator (only when the denominators differ); two bars from 0 and the sign |
| `add` (op `sub`) | `show`, `jump`, `common`, `result` | the first fraction; an arc as long as the second, right (left to subtract); the common denominator; the answer reduced, and as a mixed number above one |

Limits: denominators 2–12, lowest terms, values at most 3; at most 36 parts on the line (common denominator × wholes shown); k 2–6; 1–4 fractions to mark, exactly two to compare or add; fractions must be far enough apart to label (18 px, 40 px for every third one); subtraction must stay positive. No negative fractions, no decimals, no ordering of three or more fractions by bars, no fractions of a quantity. Malayalam captions are my draft and need a teacher; no Malayalam font, voice or MP4 was run in the build sandbox.

## 24. Matrix multiplication and transpose (V51.9.37)

| Kind | Steps | What the viewer sees |
|---|---|---|
| `multiply` | `show`, `check`, `entry` (i, j), `all` | A × B; the orders and n = n with a tick, the empty product; row i of A and column j of B boxed, the products and sum, the result in its cell; the other entries |
| `transpose` | `show`, `rows`, `entry` (i, j), `size` | A and an empty Aᵀ; each row of A copied as a column in its own colour; an entry and its new place, (i, j) → (j, i); the orders r × c and c × r |

Limits: multiplication of matrices up to 3 × 3 with whole entries −9..9 and product entries within ±99; transpose up to 4 × 4; at most four `entry` steps. No scalar multiplication, addition, determinants, inverses or powers; no check that AB ≠ BA; no matrices with fractions or symbols. Malayalam captions are my draft and need a teacher; no Malayalam font, voice or MP4 was run in the build sandbox.

## 25. Area of a parallelogram and a trapezium (V51.9.38)

| Kind | Steps | What the viewer sees |
|---|---|---|
| `parallelogram` | `show`, `height`, `cut`, `move`, `formula` | the figure with b and h; the dashed height with a right-angle mark; a triangle shaded at one end; it slides across and a dashed rectangle b × h appears; A = b × h with the numbers |
| `trapezium` | `show`, `height`, `copy`, `triangles`, `formula` | a, b, h; a half-turned copy making a parallelogram of base a + b (2 × A = (a + b) × h); or a diagonal and two shaded triangles (½ b h and ½ a h, added); A = ½ × (a + b) × h with the numbers and the unit squared |

Limits: sizes 2–20 (a from 1 to b − 1), whole areas only ((a + b) × h even; `triangles` also needs b × h and a × h even), unit cm, m or mm. No rhombus, kite or general quadrilateral; no slant sides labelled; no reverse problems (area given, find a side); no composite figures. Malayalam captions are my draft and need a teacher; no Malayalam font, voice or MP4 was run in the build sandbox.

## 26. Coordinate geometry (V51.9.39)

| Kind | Steps | What the viewer sees |
|---|---|---|
| `points` | `axes`, `plot` (with `i`), `quadrant` | the grid with numbers; dashed drops, a dot and a letter for each point with A = (3, 2); I–IV and A (3, 2) : I |
| `distance` | `axes`, `plot`, `segment`, `legs`, `formula` | two points joined; dashed legs with dx and dy and a right-angle mark; d² = dx² + dy², the numbers, d = √25 = 5 (or ≈ for a surd) |
| `midpoint` | `axes`, `plot`, `segment`, `midpoint` | two points joined; drops to the axes, dot M, equal marks on the halves; x = (a + b) ÷ 2, y = …, M = (…) |

Limits: whole-number points from −6 to 6; at most four points; distance needs points that differ in both x and y; the midpoint may be a half-integer. No lines by equation, slope, section formula, area of a triangle from coordinates or collinearity; no non-integer inputs. Malayalam captions are my draft and need a teacher; no Malayalam font, voice or MP4 was run in the build sandbox.

## 27. Visual proofs of the square identities (V51.9.40)

Built from the "(a + b)² = a² + 2ab + b², a visual proof" clip; the picture, steps and wording are written fresh for AI Guru.

| Kind | Steps (each needs the one before it) | What the viewer sees |
|---|---|---|
| `sum` | `square`, `tileA`, `strips`, `tileB` (any order after `square`), `name`, `build`, `check` | square of side a + b with braces; a², two ab strips, b² fitted in; the tiles named; (a + b)² = a² + ab + ab + b² written term by term, each term lighting its tile; = a² + 2ab + b² |
| `difference` | `square`, `strips`, `corner`, `name`, `build`, `check` | square of side a; two strips of width b along the right and the bottom, their shared corner b² put back; (a − b)² = a² − ab − ab + b² = a² − 2ab + b² |
| `product` | `square`, `remove`, `cut`, `move`, `name`, `build`, `check` | square with a b × b corner cut out; the L cut in two; the lower piece turned and slid beside the upper one; braces a + b and a − b; a² − b² = (a + b)(a − b) |

`check` writes a and b, the left side with the numbers and the right side with the numbers (for example 25 − 20 + 4 = 9).

Limits: whole-number sides; sum: a ≠ b, a + b ≤ 12; difference: 2 ≤ a ≤ 12, b < a, and b large enough for the labels (b = 1 with a = 12 is refused); product: a + b ≤ 12, b < a. No (x + y + z)², no cubes, no (x + a)(x + b), no use of the identity to evaluate numbers such as 102². Malayalam captions are my draft and need a teacher; no Malayalam font, voice or MP4 was run in the build sandbox.

## 28. Quality gate and automatic regeneration (V51.9.41)

The planner (`plan/ai.ts`) asks the AI for a plan and checks it in two stages, sharing three tries:

1. **Validation** (`plan/validate.ts`): structure, both languages, the maths, a test build. A plan that fails is sent back with the exact reasons.
2. **Quality gate** (`plan/qa.ts`): layout (no text overlapping or leaving the board at any step), pace (captions of one idea, units under four minutes), language (no English phrase inside the Malayalam), variety (no caption repeated on three steps). A plan that fails is sent back with each problem as a sentence.

After the last try: a valid plan with open quality notes is kept with a warning; an invalid one falls back to the offline plan. `plan.qa` holds the asks and the notes. `regenerateBlock` and the "Regenerate this unit" button run the same loop for one unit, with an optional teacher note.

Limits: the gate does not judge teaching quality or the quality of the Malayalam, only the rules above; layout QA runs only for DNAs whose layouts are tested; it uses the English picture (the Malayalam picture is identical). Not run against a live Gemini model in the build sandbox (no key or network): the retry loop is tested with scripted answers. The button was type-checked but not clicked in a browser.

## 29. Balance scale (V51.9.43)

**What it teaches.** One equation with one unknown, a x + b = c, as a level scale (the model is the reel the team shared). The left pan holds a tiles of x and a tile for b, the right pan a tile for c. The equation is written under the scale line by line in the same colours.

**Plan.** `{a, b, c, letter?, steps}`: a is 1–4, b is −12…12 (0 for a x = c), c − b is a multiple of a and the answer is a whole number from 1 to 20. Steps, each at most once and in this order: `show`, `move` (b ≠ 0), `simplify` (after `move`), `divide` (a ≥ 2), `answer` (a ≥ 2), `check`. With one x, `simplify` already ends in x = value, so there is no `divide` or `answer`; with b = 0 there is no `move` or `simplify`.

**Pictures.** The tile that moves fades on the left and arrives on the right with the sign changed (−5 for +5, +3 for −3); the right pan merges into one tile (c − b or c + b); it splits into a equal tiles; the extra tiles fade and one x and one value are lit; the answer is boxed; the check ends with a tick.

**Where the numbers come from.** Everything written is computed in `dna/bal-math.ts` from a, b and c, so the picture and the working always agree. English and Malayalam classes draw the same picture.

**Selector.** `findBalEquations` finds equations `2x + 5 = 25`, `x − 3 = 9`, `4x = 28` (letters x y z n m p t) whose answer fits; texts that mention two unknowns, squares, roots, functions, sequences, slopes, matrices or inequalities, or that have variables on both sides, are left to other DNAs. A story problem keeps the word-problem DNA.

**Not done / not checked.** No real browser, Malayalam font, voice or MP4 run. The scale stays level (it does not tilt), and nothing is dragged across the pivot: the tile fades and reappears on the other pan. Malayalam captions are a draft for a teacher.


## 30. Problem card and the word-problem flow (V51.9.44)
`MotionScene.problem` pins the textbook problem in a card at the top; `layoutFor(format, fit)` moves the board below it (vertical, landscape, square; light and dark). `problemFor(block, plan, lang)` decides when a class carries it (problem/exercise blocks up to 320 characters, and every word-problem plan); `withProblem` applies it. `word-problem` = unknowns → equations → solver chain → check (`dna/wp-check.ts`, only if all equations hold) → answer. `offlineWordProblem` covers table/chair pairs, bead pairs and sum/difference without AI.


## 31. Typeset maths (V51.9.45)
`reels/motion/typeset.ts` lays formulas out as ordinary engine items. `parseMath` (LaTeX-like or plain maths) → `layoutMath` (glyphs with keys, strokes for bars, roots and brackets) → `placeMath` / `showMath` (items on the board) → `becomeMath` (the line on the board turns into the next; matched symbols glide). Any builder can call these. The `typeset-chain` DNA uses them: steps show, become, add, focus, box; formulas are validated with `mathProblem` and must contain some structure (fraction, root, power, subscript, vector, matrix).


## 32. Mascot, lesson arc, visual boards and review (V51.9.46)
- **Mascot** (`reels/motion/mascot.ts`): `drawMascot(m, prefix, x, y, scale, t, pose, look)`, `setPose` (idle, think, ask, cheer; a morph), `hopMascot`, `speechBubble`, `thoughtBubble`. Outline-only bubbles (day/night safe).
- **Lesson arc**: `plan.arc = { hook?, why?{question,answer}, formal?{tex,say}, check?{tex,say}, summary? }`. Hook comes before the unit's picture; why, formal, check, summary after it. Built in `dna/arc-builders.ts`, checked in `dna/arc-math.ts`, compiled in `class.ts`. The planner decides where a "why?" is worth asking; the app draws it.
- **Concept board layouts**: `layout` cards | pyramid | columns (`heads`, `col` per point). `dna/concept-builders.ts`, `dna/concept-math.ts`.
- **Key result / identity / equation pair**: `buildKeyResult` (pill, typeset formula, box, tick), `dna/visual-builders.ts` (`buildIdentityTry`, `buildPairBrace`).
- **Review**: render with `npx tsx scripts/ai-guru-render-review.ts --plans class.json --out review/`; the teacher opens `review/review.html`, marks each video and downloads `review.json`; `--apply review.json --plans class.json` merges it, lists stale approvals and change notes, and exits 0 only when every video is approved and current.


## 33. The tipping balance scale (V51.9.47)
- `bal-math.ts`: `SC` (pivot, beam, pans), `tiltFor(left, right)`, `beamShape`, `panTop`, `stringsOf`, `rowLayout`; `scale` (×10/100/1000) multiplies every written value.
- `bal-builders.ts`: pan members move rigidly with the beam; each step changes the tiles, then `retilt` animates the beam, strings, pans and tiles to the new angle. Equation panel: four slots.
- Table and chair: `ai-custom` = `word-problem` (`solvedLater: true`) + `balance-scale` (`BAL_CHAIR_SAMPLE`, `BAL_TABLE_SAMPLE`).

## 34. The quadratic formula, derived (V51.9.48)

DNA id `quadratic-derivation`. Files: `dna/qd-math.ts` (plan rules, numbers, geometry), `dna/qd-builders.ts` (animation), `samples/quadratic-derivation.ts`, `quadratic-derivation.test.ts`.

- Plan: `{ b, c, steps }` with `b` even 2–16 and `(b/2)² − c` a perfect square r² with 1 ≤ r ≤ 12, so the example x² + bx + c = 0 has whole roots −b/2 ± r. Steps in exactly this order, each once: `show, split, bend, corner, square, root, answer`, and optionally `formula` last. Every step needs a `say` caption (English; Malayalam optional).
- Picture (left, 720-wide design space): square side `QD_S` = 140 at (`QD_X0`, `QD_Y0`), strip of width 2·`QD_H` (`QD_H` = 40) to its right. `split` cuts it in two halves; `bend` morphs the right half a quarter turn under the square (`qdBendPts`); `corner` draws the missing `QD_H`×`QD_H` square; `square` fills it and braces the whole (x + b/2)². The strip is symbolic: the same size for every b.
- Algebra (right, `QD_PX` = 534, width `QD_PW` = 330): two typeset rows, "in letters" and "with numbers", each turned into the next line with `becomeMath`. Lines come from `qdLines(b, c)`; the tests check each numeric line against the algebra for every valid example.
- Selection: `QD_DERIVE` in `dna/registry.ts` (derive/prove/origin near "quadratic formula" or "completing the square"); score 0.99, and `quadratic-equation` steps aside when it fires.
- Also in V51.9.48: the numeric `quadratic-equation` formula step is typeset.
- Add a new variant by extending `qdLines` (the algebra) and the pieces in `QD_PIECES` (the picture); keep both in the test that fills the big square.

## 35. HCF and LCM by prime tiles (V51.9.49)

DNA id `hcf-lcm`. Files: `dna/hl-math.ts` (rules, factors, lines, columns), `dna/hl-builders.ts` (animation), `samples/hcf-lcm.ts`, `hcf-lcm.test.ts`.

- Plan: `{ a, b, steps }`, a < b, each 2–120. Steps exactly `show, factorise, common, hcf, lcm`, optionally `check` last; each needs a `say`.
- Picture: row a at y 104, row b at y 186, tiles 54 px on a 74 px pitch from x 198 (at most 7 columns). `hlColumns` gives each tile's natural column and its aligned column (shared primes first, then each number's leftovers). `common` morphs tiles to the aligned columns, joins shared pairs with lines, fills them green. `hcf` boxes the shared columns, `lcm` boxes all columns. Typeset lines sit at y 296 / 352 / 408.
- Selection: `HL_STRONG` / `HL_EXCLUDE` in `dna/registry.ts`; `quadratic-equation` steps aside when `hl` fires (its regex matches "factorisation").

## 36. Motion polish (V51.9.50)

- Curves live in `reels/motion/curves.ts` and are exposed on `ease`: `land`, `glide`, `exit`, `soft`. New verbs should use them: things that land use `land` or `glide`, things that leave use `exit`, blends use `soft`. `inOut` and `out` stay for the camera and old recipes.
- Stagger: `m.appear(ids, t, STAGGER_TEXT)` or any list of gap lengths in ms (the last gap repeats); a plain number still means a uniform gap.
- End of a unit: do not pad with long `m.hold(...)`; `build()` limits the rest after the last movement to `END_HOLD_MAX` (1.2 s) and keeps the last caption's time and voice clip.
- `plan/timeline-qa.ts`: `timelineReport(scene)` and `timelineProblems(scenes)`; `qaLayout` calls it for the DNAs in `LAYOUT_QA_DNAS`.

## 37. Subject-neutral boards and the RAG Classroom (V51.9.51)

- Concept-board layouts: `cards`, `pyramid`, `columns`, `flow`, `cycle`, `timeline`. `flow` = 2–6 steps with arrows; `cycle` = 3–5 stages round a ring, the last arrow returns to the first; `timeline` = 2–6 events, the *starred* key of each point is the date. Placement is computed from measured text; the planner supplies words only.
- `offlineConceptBoard(text, heading)` chooses the layout from the wording; `visual-qa` no longer treats these layouts as text-only.
- `components/ai-guru/MotionTeachingBoard.tsx` is the RAG Classroom's board: `passageBlocks` → `selectDna` → `offlinePlan` / `aiPlanBlock` → `compileClass` → `prepareSegment` → `ClassPlayer`. It reports planning / ready / playing / completed / error like the old board.
- Malayalam captions need an AI plan (or the textbook's Malayalam for a single-block passage); without it the built-in plan speaks English and says so.

## 38. Picture layouts of the concept board (V51.9.52)

- `scale`: `heads` = the two pan titles, every point has `col` (0 left / 1 right) and optional `weight` 1–9; at most 2 tiles per pan. The beam tips by the sum of the weights (`tiltFor`), equal sums level it. Geometry comes from `bal-math.ts`, hung 44 px lower so the tipped beam clears the title.
- `bars`: every point has a numeric `value`; `board` is the label; optional `unit`. Bars grow with `ease.land`, the largest value is focused at the end.
- `tree`: the heading is the root; points without `parent` are first-level branches (2-4); a point with `parent` = index of an earlier first-level point hangs under it (at most 3 each).
- `icon` on a point (cards, flow, cycle): one of `ICON_NAMES`; otherwise `iconFor(board, then say)` picks from the English words, so both languages show the same picture. Icons are pen strokes in a 100 x 100 box (`concept-icons.ts`), drawn by `drawIcon` (`concept-kit.ts`).
- The concept board is in `LAYOUT_QA_DNAS`.

## 39. Balance method for pairs of equations (V51.9.55)
- `balance-scale` now takes answers up to 100 and x on both sides (`d`, step `cancel`).
- `balance-pair` draws two compact scales. Plan: `{e1:{a,b,c}, e2:{a,b,c}, letters?, steps:[show, combine, solve, back, check]}`. The app adds or subtracts the scales (the x coefficients equal, or the y coefficients equal or opposite), solves the one scale left, substitutes into an equation that has a positive y term and checks both. Everything written is computed in `pair-math.ts`.
- Not drawn here: pairs that need an equation multiplied first, graphs, matrices (use `linear-system`).
