/**
 * AI planner. For each textbook block the AI receives the block, its context,
 * the DNA chosen by the selection logic (or, when nothing fits, the instruction
 * to compose a NEW DNA from built-in segments), and returns:
 *   - read.en  : the textbook text, cleaned of layout noise
 *   - read.ml  : a faithful Malayalam translation (Kerala school Malayalam)
 *   - teach    : the filled DNA plan, every caption in English AND Malayalam
 *   - newDna   : (only when composing) name, description, keywords
 * The plan is validated (structure, both languages, buildable, maths verified)
 * and sent back with the exact errors until it passes (max 3 tries). A plan that
 * still fails falls back to the offline plan, with the reason kept as a warning.
 */

import type { BookBlock } from '../segment';
import { DNA_BY_ID, DNAS, blockFeatures, selectDna } from '../dna/registry';
import { getLearned, saveLearned, slugId, type LearnedDna } from '../dna/learned';
import type { BlockPlan, CompositePlan, DnaId, DnaSelection } from '../dna/types';
import { validatePlan } from './validate';
import { offlinePlan } from './offline';
import { textOnlyWarning } from './visual-qa';
import { qaPlan } from './qa';
import { arcProblems } from '../dna/arc-math';
import { SKETCH_DNA, SKETCH_H_DEFAULT, SKETCH_MAX_ACTIONS, SKETCH_MAX_OBJECTS, SKETCH_MAX_STEPS, SKETCH_W, type SketchPlan } from '../dna/sketch-math';
import { saveSketchCandidate, type SketchCandidate } from '../dna/sketch-library';

/** V51.9.50: how to write an "ai-sketch" (shown only when no built-in DNA fits, or a promoted sketch is reused). */
export const SKETCH_GUIDE = `"ai-sketch" PLAN (a free board; use it ONLY when no built-in segment can show the idea):
{"title":{"en","ml"}?, "height": 240–600 (default ${SKETCH_H_DEFAULT}; the board is ${SKETCH_W} wide, y grows downwards),
 "objects":[ at most ${SKETCH_MAX_OBJECTS}, each with a short unique "id":
   {"id","kind":"text","x","y","text": "12" | {"en","ml"} (words as {"en","ml"}, numbers/symbols as a string),"size"?:16–64,"color"?}
   {"id","kind":"math","x","y","tex":"a^2 + b^2 = c^2","size"?}
   {"id","kind":"line"|"arrow","x1","y1","x2","y2","color"?}
   {"id","kind":"rect","x","y","w","h","color"?,"fill"?}   (x, y = centre)
   {"id","kind":"circle","x","y","r","color"?,"fill"?}
   {"id","kind":"polygon","points":[[x,y],...],"closed"?,"dashed"?,"color"?,"fill"?}
   {"id","kind":"dot","x","y","color"?} ],
 "steps":[ at most ${SKETCH_MAX_STEPS}: {"say":{"en","ml"},"do":[ at most ${SKETCH_MAX_ACTIONS} actions:
   {"show":[ids]} (every object is shown exactly once, before anything else is done to it) | {"hide":[ids]} |
   {"move":"id","to":[x,y]} (text or dot) | {"focus":[ids]} | {"color":[ids],"to":"<colour>"} | {"dim":[ids]} |
   {"morph":"polygonId","points":[[x,y],...]} (same corner count) | {"swap":"textId","text":"..."} |
   {"box":[cx,cy,w,h],"color"?} | {"tick":[x,y]} ]} ]}
Colours (meaning, not decoration): a, b, c, carry, result, done, ink, accent. Everything must stay inside the board; text must not overlap
(Malayalam words are wider: leave room). The picture must be TRUE: draw lengths, angles and counts to scale; the app cannot check a sketch's maths,
so a teacher reviews it. One idea per step; show, then change.`;

export type Llm = (system: string, user: string, image?: { base64: string; mime: string }) => Promise<string>;

export interface PlanContext {
  bookTitle?: string;
  grade?: string;
  chapterTitle: string;
  sectionTitle: string;
  /** Text of the blocks just before / after (for coherence). */
  before?: string[];
  after?: string[];
  /** Whole page text (helps the AI repair broken layout, fractions, tables). */
  pageText?: string;
  /** Page picture for figure-based blocks (geometry, area models). */
  pageImage?: { base64: string; mime: string };
  /** A teacher's note for a regeneration ("use a smaller example", "explain slower"). */
  note?: string;
}

export interface AiPlanResult {
  /** V51.9.50: the free sketch drawn for this block (a candidate until a teacher promotes it). */
  sketch?: SketchCandidate;
  plan: BlockPlan;
  selection: DnaSelection;
  learned?: LearnedDna;
  attempts: number;
  errors: string[];
}

const GRAMMAR = `MOTION GRAMMAR (fixed; the engine animates it, you only fill plans):
- colours mean roles: first quantity red, second purple, third green, carries/borrows orange, results indigo, finished work fades.
- before anything changes it is focused (yellow halo + pulse); values never jump: they move, merge or roll into new values.
- one caption per step, synced to the voice; the board shows short labels and maths, never paragraphs.`;

const BILINGUAL = `LANGUAGE RULES:
- Every text field is {"en": "...", "ml": "..."}. "ml" is natural Malayalam as used in Kerala SCERT classrooms (Malayalam script; keep maths symbols, digits and letters x, y as they are). Never copy English into "ml".
- Captions are spoken: one idea, 6–22 words. Board labels ("board", "words", "phrase", "meaning") ≤ 40 characters.
- Maths tokens are language-neutral and identical for both languages: the English and Malayalam lessons share the same graphics.
- read.en = the block text exactly as in the textbook (fix only extraction noise: broken fractions as a/b, stray letters from side boxes). read.ml = a faithful Malayalam translation of read.en.`;

const ARC = `LESSON ARC (optional "arc" next to "teach"; the app draws it, you only choose where it is worth it):
A good unit follows a short arc: a hook question, the picture (your "teach"), the rule, a check, a summary. Our mascot Deepa (a little diya lamp) speaks the hook, the "why?" and the summary. Add only the parts the unit needs; skip the arc for headings, bridges and plain drills.
- "hook": {"en","ml"} a question that makes the student want the picture (at most 16 words). Deepa thinks it in a thought bubble BEFORE the picture. Example: "If both sides must stay equal, what can we do to one side?"
- "why": {"question":{en,ml},"answer":{en,ml}} use it ONCE, at the step a student would stop and ask "but why?" (a sign that flips, a rule that looks like a trick). The question is at most 16 words; the answer at most 30 words and says the REASON, not what was done. Shown AFTER the picture.
- "formal": {"tex":"<LaTeX-like formula>","say":{en,ml}} the rule or result as a typeset formula, boxed. Use after a picture that discovered the rule.
  Optional "parts":[{"match":"<piece of tex exactly as written there>","label":{en,ml},"say"?:{en,ml}}] (1–5, in reading order) to read a NEW formula term by term: it dims, then each part lights up in its own colour with a brace and a label (at most 8 words) saying what the part MEANS (e.g. "a + b" → "the two parallel sides"). Use for formulas the student meets for the first time.
- "check": {"tex":"<line with the numbers put in>","say":{en,ml}} the numbers back in the rule, with a tick. The line must be TRUE.
- "summary": {en,ml} one sentence (at most 28 words) Deepa cheers at the end.
- "mistake": {"wrong":{"tex","say"},"why":{en,ml},"right":{"tex","say"},"at":"before"|"after"} the COMMON MISTAKE students really make here (½ + ⅓ = 2/5, (a + b)² = a² + b², moving a term without changing its sign). "wrong.tex" is the wrong line exactly as a student writes it (shown in red, then struck out), "why" says the reason it fails (at most 30 words), "right.tex" is the correct line (with a tick). Every number in "right" must be TRUE. "at" "before" the picture when the picture should fix the mistake, else "after". Use it only for a real, common mistake, at most once.
- Wording: never say "obviously", "clearly", "it follows that", "of course" (or വ്യക്തമായും, തീർച്ചയായും) — say the reason instead. Keep every spoken sentence under 25 words.
Do not repeat in the arc what the picture already says. Every arc sentence is spoken: one idea, plain words, same rules as captions.`;

const BOARD = `BOARD RULES (the 3Blue1Brown look):
- Concept boards and section intros are drawn as idea CARDS by default; set "layout" when the ideas have a shape: "pyramid" (3–5 levels, FIRST point = the base/widest level, e.g. number systems; each "board" at most 28 characters) or "columns" ("heads" = two column titles of at most 22 characters, and every point has "col": 0 or 1, e.g. mean vs median), "flow" (2–6 steps in order, an arrow between each; a process such as photosynthesis, digestion, a method; "board" at most 70 characters), "cycle" (3–5 stages whose last leads back to the first, e.g. the water cycle; "board" at most 60 characters), "timeline" (2–6 events in time order; put the date/year in stars as the key, e.g. "*1857* Revolt begins"; "board" at most 70 characters). For Science, Social Science, English and Malayalam lessons choose one of these whenever the paragraph describes steps, a loop, or dates. Cards: at most 5 points, "board" at most 80 characters, with *key terms* in stars. The app measures and places everything.
- PICTURES FIRST (V51.9.52): a concept board must show a picture, not only words. Choose the layout by what the paragraph says: two sides weighed against each other (demand vs supply, cause vs effect, pros vs cons, before vs after) → "scale" ("heads" = the two pan titles of at most 22 characters; every point has "col" 0 or 1 and may have "weight" 1–9, the beam tips toward the heavier pan; at most 2 points per pan; "board" at most 30 characters; make the last weights match the story, e.g. equal weights when the paragraph ends in balance); quantities to compare (populations, rainfall, prices, marks) → "bars" (every point has a numeric "value", "board" = the label of at most 28 characters, optional "unit": {"en","ml"}); a topic split into kinds or parts (types of triangles, parts of a plant, kinds of rocks) → "tree" (2–4 first-level points, then sub-points with "parent" = the index of their first-level point, at most 3 under each; "board" at most 30 characters; the heading is the root); steps → "flow"; a loop → "cycle"; dates → "timeline"; levels → "pyramid"; two groups → "columns". Use idea CARDS only when none of these fits.
- Every card, flow step or cycle stage may carry an "icon" (one of: sun, drop, cloud, leaf, tree, flame, coin, book, house, person, clock, mountain, wave, bolt, bulb, heart, flag, earth, gear); leave it out when none fits. The app also picks one from the words.
- Every unit except a heading or a bridge must show a PICTURE the viewer watches change: a graph, a plane, a figure, a number line, a table, an area. Choose "concept-board" ONLY when nothing at all can be drawn.
- For graphs ("function-graph") and transformations ("plane-transform") the app computes every number it writes (matrix entries, determinant, coordinates read by the tracker). You choose ranges, formulas and matrices; the app rejects a curve that leaves the picture or a matrix that throws a point off the plane.
- Fractions ("fraction-bars"), data ("histogram") and chance ("probability-tree"): you choose the parts, the values and the branch probabilities; the app writes every fraction, mean, median, path product and sum itself, and rejects a plan whose branch probabilities do not add up to 1.
- Pair of equations on two balance scales ("balance-pair"): each equation a x + b y = c is a scale that balances; the two scales are added or subtracted so one unknown cancels, the one scale left is solved, the value is put back to find the other unknown, and both scales are checked. Use it for a pair of linear equations in two unknowns (x + y = 100 with x − y = 10; x + y = 11000 with 4x + y = 14000) whose x coefficients are equal or whose y coefficients are equal or opposite, with whole answers from 1 to 99999. You give e1 and e2 ({"a":1,"b":1,"c":100}: a 1–4 x tiles, b −3…3 but not 0 (negative = y taken away), c), at least one b positive, and the steps exactly show, combine, solve, back, check with a spoken caption each. The app draws both scales, cancels the tiles and writes every number; do not write numbers in "say" that the board does not show. A pair that needs an equation multiplied first, the graphical method or matrices belong to "linear-system".
- Balance scale ("balance-scale"): the scale TIPS when one pan is heavier and swings level when the same is done to both pans. Use it for ONE-unknown equations, also in the middle of a word problem or a pair of equations (e.g. after subtracting the equations leaves 3x = 3000): put a \"word-problem\" with \"solvedLater\": true first, then balance-scale segments in an \"ai-custom\" plan; optional \"scale\" (10, 100 or 1000) writes every value times it for prices (3 tiles, 3000 written). For ONE equation with one unknown, a x + b = c (or a x = c) with whole numbers; you give a (1–4 x tiles), b (−12…12), c and the steps (show, move, simplify, divide, answer, check, each once, only those that apply); the app draws the scale, moves the tile across, merges and splits the right pan and writes every line. c − b must be a multiple of a with an answer from 1 to 100. With x on BOTH sides (3x + 2 = x + 10) also give d (x tiles on the right pan, 1 to a − 1) and the step "cancel" right after show; then c − b must be a multiple of a − d. Do not write equations or results yourself.
- HCF and LCM ("hcf-lcm"): the highest common factor and lowest common multiple of two whole numbers by prime tiles. You give two different numbers a < b (2–120) and a spoken caption for each of the fixed steps show, factorise, common, hcf, lcm and the optional last check. The app splits the numbers, lines up the shared primes and writes every product; do not write numbers in "say" that the board does not show.
- The quadratic formula derived ("quadratic-derivation"): where the formula comes from, drawn as completing the square. You give an example x² + b x + c = 0 with b even (2–16) and (b/2)² − c a perfect square from 1 to 144 (so both roots are whole numbers; e.g. b 6 c 5, b 8 c 12, b 2 c −8) and a spoken caption for each of the fixed steps show, split, bend, corner, square, root, answer and the optional last formula. The app draws the square, the strip, the missing corner and every typeset line; do not write numbers in "say" that the board does not show.
- Typeset formulas ("typeset-chain"): for a formula or worked equation with a square root, a stacked fraction or a matrix. You write each formula as LaTeX-like text (\\frac{a}{b}, \\sqrt{x}, x^{2}, x_{1}, \\pm, \\begin{bmatrix}a & b \\\\ c & d\\end{bmatrix}, \\color{a}{x}); the app typesets it. Steps: "show" (first, writes a formula), "become" (the line turns into the next; symbols they share glide, so keep them the same), "add" (a new line below), "focus" (lights listed symbols), "box" (boxes the line). Optional "colors" by symbol, e.g. {"x":"a"}, and a short "note" under a line. Every line must be correct maths; each "say" explains the step in words.
- Shapes with formulas ("shape-formula"): you choose the shape and the steps (label, angles, height, formula); with whole-number sizes a (and b) the app writes the numbers and works the formula (π(5)² = 25π, 3² + 4² = 25, c = 5, a√3), and it rejects a step that does not fit the shape. Do not write sides or formulas yourself.\n- Sets ("venn-sets"): you choose 2 or 3 sets, optional elements and the set expressions to shade (A∩B, A∪B, A', A−B, De Morgan identities); the app works out which regions an expression covers, writes every list and count (n(A ∪ B) = 5 + 4 − 2 = 7) and rejects an "identity" that is not true. Do not write lists or counts yourself.\n- Trigonometric ratios ("unit-circle"): you choose the angle (whole degrees 20–70), which ratios to draw and in what order, optional sweeps to a new angle, values and identities; the app places every point, draws each ratio as the segment whose length IS that ratio (cos, sin legs; tan, cot, sec, csc from the tangent line), writes every formula and value (exact for 30°, 45°, 60°) and checks the identities. Do not write values yourself.\n- Pair of linear equations ("linear-system"): you give the six whole numbers of a x + b y = c twice (a, b non-zero −9 to 9, c −60 to 60; ONE solution that is a pair of whole numbers between −6 and 6) and the steps (show, graph, meet, eliminate x or y, substitute into equation 1 or 2, check, matrix); the app draws both lines, multiplies and adds or subtracts the equations, substitutes, checks and writes every line, and rejects parallel lines, a repeated line or a non-whole solution. Do not write equations or results yourself.\n- Arithmetic sequences ("arithmetic-sequence"): you give the first term a, the common difference d, how many terms the row shows (4–7) and the steps (show, diff, pairs, formula, term n, sum n, test value, graph); the app writes every term, the n-th term formula, each worked term and sum (n ÷ 2 × (first + last)), solves "is this number a term?" with a tick or a cross, and plots the points on a line. Do not write numbers yourself.\n- Quadratic equations ("quadratic-equation"): you give whole numbers a, b, c of a x² + b x + c = 0 (a non-zero −6..6, b −20..20, c −36..36) and the steps (show, graph, discriminant, factorise, formula, roots, check, each once); the app draws the parabola, works out D = b² − 4ac, splits the middle term and groups, writes the factors, the formula and the roots (exact fractions), marks the roots on the x-axis and checks whole-number roots. "factorise" and "roots" need a perfect-square discriminant; the app refuses them otherwise. Do not write numbers yourself.\n- Polynomials ("polynomial"): you give P as whole-number coefficients, highest power first (p: [1,-4,1,6] is x³ − 4x² + x + 6; degree 2 to 4, coefficients −12..12), optionally a second polynomial q (degree 1 to 3, coefficients −9..9) and a divisor x − r (r non-zero −9..9), and the steps (show, add, subtract, multiply, divide, remainder, factor with "at", identity, graph, roots, each once); the app writes the degree and coefficients, adds and subtracts in aligned columns, fills the multiplication table, does the long division, works out P(r), applies the factor theorem and writes every factor, writes the square identities with an area picture, draws the curve and marks whole-number roots. "factor" needs P to start with 1 and factorise completely into whole-number roots; "identity" needs P to be x² − k² or (x ± k)²; "divide" needs degree 2 or 3. Do not write numbers yourself.\n- Angles ("angle-geometry"): figure "parallel" (two parallel lines and a transversal: you give one angle a, 30–150 except 90, and where it is, then the steps show, given, vertical, linear, corresponding, alternate, cointerior), figure "triangle" (A and B, 20–120 each with A + B from 60 to 160; steps show, angles, find, sum, exterior) or figure "circle" (beta = the angle at the circumference, 20–90; steps show, centre, circumference, double, same-arc, cyclic); each step at most once; the app draws every arc, works out every other angle (vertically opposite and corresponding angles are equal, a linear pair and co-interior angles add to 180°, the third angle is 180° − A − B, the exterior angle is A + B, the centre angle is 2 × beta, a cyclic quadrilateral has opposite angles adding to 180°) and writes every number in degrees. Do not write angle values yourself.\n- Solids ("solid-figure"): "solid" is cuboid (a length, b width, h height, each 2–20, biggest at most 4× the smallest), prism (right triangular prism: legs a, b from 3–24 with a whole third side such as 3-4-5, 5-12-13, 6-8-10, 8-15-17, 9-12-15, 7-24-25, and length h 2–20), cylinder (r 1–14, h 2–30), cone (r, h 1–24 with a whole slant height) or sphere (r 1–15), optional unit cm, m or mm; steps: show first, then base, slant (cone and prism only), volume, net (not for the sphere) and surface, each once, with base, slant and volume before net and net before surface; the app draws the solid in 3-D with hidden edges dashed, shades the base, works out the slant height, the volume (π values exact, with a decimal for π ≈ 3.14), unfolds the surface into a net with the area of every piece and adds them up (the sphere: four great circles). Do not write sizes or results yourself.\n- Ratio and percent ("ratio-percent"): "kind" is share (parts: 2 or 3 whole numbers 1–9 adding to at most 20, and a total that is a multiple of their sum; steps show, unit, parts, check), percent (whole 10–5000 and pct 1–100 whole, with pct × whole a multiple of 100; steps show, tenth, part, result) or change (the same whole and pct plus dir "up" or "down" (down: pct at most 90); steps show, change, result); optional unit Rs, kg, m, cm, km or l; each step at most once, in the order given; the app draws the bar in equal blocks, works out one part, each share, a tenth, p% of the whole, the extra or removed piece and the new amount, and writes every number. Do not write numbers yourself.\n- Pie charts ("pie-chart"): you give 2 to 6 whole-number values (optional labels, 1–10 characters each, the same in both languages) such that every angle 360 × value ÷ total is a whole number of at least 15° (totals like 36, 40, 45, 60, 72, 90, 120, 180, 360), and the steps (show, total, angle, percent, check, each once, percent and check after angle); the app lists the data, adds the total, works out each angle and draws the sectors clockwise from the top with their angles, then the percentages and the check that the angles make 360°. Do not write numbers yourself.\n- Visual proofs of identities ("square-identity"): "kind" is sum for (a + b)² (a and b different whole numbers, a + b at most 12; steps square first, then tileA, strips, tileB in any order, then name, build, check), difference for (a − b)² (a 2–12, b 1 to a − 1; steps square, strips, corner, name, build, check in that order) or product for (a + b)(a − b) = a² − b² (a + b at most 12, b below a; steps square, remove, cut, move, name, build, check in that order); each step at most once; the app draws the square, the tiles, the curly braces and the labels, lights each tile as its term is written, and checks the identity with the numbers. Do not write sizes or terms yourself.\n- Coordinate geometry ("coordinate-geometry"): "kind" is points (1–4 different points [x, y], each coordinate a whole number −6..6; steps axes first, then one "plot" per point with "i" (0-based, each once), then optionally quadrant), distance (exactly two points differing in both x and y; steps axes, plot (both at once), segment, legs, formula) or midpoint (exactly two points; steps axes, plot, segment, midpoint); optional "names": one capital letter per point, all different, never "M" for midpoint; each step at most once; the app draws the axes, grid and numbers, plots the points with dashed lines to the axes, names the quadrants, draws the right triangle on the grid, works out dx, dy, d² and d (whole number or square root with a decimal) and the midpoint, and writes every number. Do not write coordinates, distances or results yourself.\n- Area of a parallelogram or trapezium ("area-figure"): "kind" is parallelogram (base b and height h, each 2–20; optional lean "left" or "right"; steps show, height, cut, move, formula – cut after height, move after cut) or trapezium (b the longer parallel side 2–20, a the shorter 1 to b − 1, h 2–20, optional lean "left" for a right angle, "right" or "centre"; steps show, height, copy, triangles, formula – copy and triangles are two ways to see the same area; (a + b) × h even, and "triangles" needs b × h and a × h even); optional unit cm, m or mm; each step at most once, show first; the app draws the figure to scale, cuts the right triangle off and slides it across (parallelogram), joins the turned copy or splits it into two triangles (trapezium), and writes every number and the area. Do not write sizes or results yourself.\n- Matrix operations ("matrix-ops"): "kind" is multiply ("a" and "b" with 1 to 3 rows and columns, whole numbers −9..9, the columns of a equal the rows of b, every product entry within ±99; steps show, check, then up to four "entry" steps with i = row of a and j = column of b (0-based, each pair once), then all) or transpose ("a" with 1 to 4 rows and columns; steps show, rows, "entry" with i, j (that entry moves to (j, i)), size, each once, rows before entry); the app draws the brackets and entries, writes the orders, boxes the row and column in colour, writes every product and sum, fills the rest, and moves rows into columns. Do not write entries or results yourself.\n- Fractions on the number line ("fraction-line"): "kind" is mark (1 to 4 different fractions [n,d] in lowest terms, denominators 2–12, each at most 3; steps show, divide, mark, mixed – mixed only with an improper fraction), equivalent ("frac" a proper fraction and "k" 2–6, denominator × k at most 36; steps show, scale, result), compare (exactly two different fractions "fracs"; steps show, common – only if the denominators differ – and result) or add (two fractions, optional op "sub" for first minus second; the answer at most 3 and the common denominator times the wholes shown at most 36; steps show, jump, common – only if the denominators differ – and result); each step at most once, show first, result last; the app cuts the line into equal parts, places every dot and jump, writes every fraction, the common denominator, the sum reduced and as a mixed number, and the comparison sign. Do not write fractions or results yourself.\n- Text written on the board by these DNAs (labels, names) is maths symbols only and identical in both languages; all explanation goes in "say".
- Show change, not a finished picture: build it step by step, then change ONE thing (a coefficient, a matrix) and let the viewer watch what moves.`;

const MATHS = `MATHS RULES:
- Tokens: one number, one letter, one symbol per token: ["2","x","−","10","=","100"]. Use "−" for minus, "×", "÷". Fractions as one token "{3/4}" or "{x+1/y}" (last "/" splits). Powers "x^2", "2^{3+4}". Square root "√2".
- Every equation shown must be TRUE. Give "solutions": [{"x":55}] with the values that make every line true; the app checks every line and rejects wrong maths.
- Follow the textbook's own method and numbers; do not invent a different problem.
- A problem that the textbook goes on to solve in the next blocks (see JUST AFTER) is MODELLED only: quantities, unknowns, equations, "solvedLater": true. Exercises and problems the book leaves to the student are solved fully, with the answer in words.`;

function dnaCatalogue(): string {
  return DNAS.filter((d) => d.id !== 'bridge' && d.id !== 'chapter-intro')
    .map((d) => `- ${d.id}: ${d.description}\n  plan: ${d.planShape}`)
    .join('\n');
}

function systemPrompt(): string {
  return `You are AI Guru's motion-class planner. AI Guru teaches Kerala SCERT / CBSE school maths as 3Blue1Brown-style whiteboard animations, first in English, then the same graphics again in Malayalam.
For ONE textbook block you return ONLY JSON:
{"dna":"<dna id>","read":{"en":"...","ml":"..."},"teach":{...plan for that DNA...},"arc":{...optional lesson arc...}}
${GRAMMAR}
${ARC}
${BILINGUAL}
${BOARD}
${MATHS}
DNA CATALOGUE (built-in templates):
${dnaCatalogue()}`;
}

function blockDescription(b: BookBlock, ctx: PlanContext): string {
  const lines = b.lines.map((l) => (l.label ? `  [words] ${l.label}  →  [maths] ${l.text}` : `  ${l.math ? '[maths] ' : ''}${l.text}`)).join('\n');
  return `BOOK: ${ctx.bookTitle ?? 'School mathematics'}${ctx.grade ? `, class ${ctx.grade}` : ''}
CHAPTER: ${ctx.chapterTitle}
SECTION: ${ctx.sectionTitle}
BLOCK KIND: ${b.kind}  (page ${b.page})
BLOCK TEXT:
${lines}
${ctx.before?.length ? `JUST BEFORE:\n${ctx.before.map((t) => `  ${t}`).join('\n')}\n` : ''}${ctx.after?.length ? `JUST AFTER:\n${ctx.after.map((t) => `  ${t}`).join('\n')}\n` : ''}${ctx.pageText ? `WHOLE PAGE TEXT (for repairing layout only):\n${ctx.pageText.slice(0, 2500)}\n` : ''}`;
}

function taskPrompt(sel: DnaSelection, b: BookBlock): string {
  if (sel.dna.startsWith('learned:')) {
    const l = getLearned(sel.dna.slice(8));
    if (l) {
      return `${l.segments.includes(SKETCH_DNA) ? `${SKETCH_GUIDE}\n` : ''}USE THE LEARNED DNA "${l.name}" (${l.description}).
It is a composite: {"segments":[${l.segments.map((s) => `{"dna":"${s}","plan":{...}}`).join(',')}]} — fill each segment's plan for THIS block (shapes as in the catalogue).
${l.source === 'teacher-video' ? `THIS TEMPLATE WAS LEARNED FROM A TEACHER'S OWN VIDEO. Teach this problem the way that video does:\n${l.stepsOutline?.length ? `Steps of the video, in order: ${l.stepsOutline.map((x, i) => `${i + 1}) ${x}`).join(' ')}\n` : ''}${l.styleNotes ? `How the video teaches: ${l.styleNotes}\n` : ''}Use only the built-in segments listed, with THIS problem's own numbers; never copy the video's problem.\n` : `Example of this DNA filled for another block:\n${JSON.stringify(l.example).slice(0, 2500)}\n`}Return {"dna":"${sel.dna}","read":{...},"teach":{"segments":[...]}}.`;
    }
  }
  if (sel.needsAi) {
    return `NO BUILT-IN DNA FITS THIS ${b.kind.toUpperCase()} WELL (${sel.reason}).
This block is mandatory: it states a problem, formula or equations, so it must be taught with a DNA.
Compose a NEW DNA from built-in segments (in teaching order), e.g. a figure then the equations, or a table then a chain.
Return {"dna":"ai-custom","newDna":{"name":"Short template name","description":"what it shows and when to use it","keywords":["5-10 words that identify blocks like this"]},"read":{...},"teach":{"segments":[{"dna":"<built-in id>","plan":{...}}, ...]}}
ONLY IF no combination of built-in segments can show the idea (the picture it needs is not in the catalogue), draw a free sketch instead:
Return {"dna":"ai-sketch","newDna":{"name":"...","description":"...","keywords":[...]},"read":{...},"teach":{...sketch plan...}}
${SKETCH_GUIDE}`;
  }
  const d = DNA_BY_ID.get(sel.dna)!;
  const alt = sel.ranked
    .slice(1, 4)
    .map((r) => r.id)
    .join(', ');
  return `SELECTED DNA: ${d.id} — ${d.name}. ${d.description}
Plan shape: ${d.planShape}
${d.example ? `Example of a filled plan (note the pace: one idea per step, then one change):\n${d.example}\n` : ''}${d.id === 'bridge' ? 'Return "teach": null.' : ''}If this DNA clearly cannot teach the block, you may instead use one of: ${alt || 'none'} and say why in "dnaReason".`;
}

function extractJson(text: string): Record<string, unknown> {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1] ?? text;
  const a = fenced.indexOf('{');
  const b = fenced.lastIndexOf('}');
  if (a < 0 || b <= a) throw new Error('The answer was not JSON.');
  return JSON.parse(fenced.slice(a, b + 1));
}

export async function aiPlanBlock(block: BookBlock, ctx: PlanContext, llm: Llm, o: { maxAttempts?: number; selection?: DnaSelection; task?: string; ephemeral?: boolean } = {}): Promise<AiPlanResult> {
  const sel = o.selection ?? selectDna(block, ctx.chapterTitle);
  const f = blockFeatures(block, ctx.chapterTitle);
  const wantsImage = !!ctx.pageImage && (f.picture || f.geometry >= 2 || f.area || sel.dna === 'geometry-construction' || sel.dna === 'area-model' || sel.needsAi);
  const system = systemPrompt();
  const base = `${blockDescription(block, ctx)}\n${o.task ?? taskPrompt(sel, block)}${ctx.note ? `\nTEACHER NOTE (follow it): ${ctx.note.slice(0, 600)}` : ''}${wantsImage ? '\nThe page picture is attached: use it for figure coordinates and labels.' : ''}`;
  const errors: string[] = [];
  const max = o.maxAttempts ?? 3;
  let lastJson = '';
  const qaNotes: string[] = [];
  for (let attempt = 1; attempt <= max; attempt++) {
    const user =
      attempt === 1
        ? base
        : `${base}\n\nYOUR PREVIOUS ANSWER:\n${lastJson.slice(0, 6000)}\n\nIT WAS REJECTED FOR THESE REASONS — fix all of them and return the full corrected JSON:\n- ${errors.slice(-12).join('\n- ')}`;
    let json: Record<string, unknown>;
    try {
      const raw = await llm(system, user, wantsImage ? ctx.pageImage : undefined);
      lastJson = raw;
      json = extractJson(raw);
    } catch (e) {
      errors.push(`Attempt ${attempt}: ${(e as Error).message}`);
      continue;
    }
    let dna = String(json.dna ?? sel.dna) as DnaId;
    if (dna === 'chapter-intro' || !(DNA_BY_ID.has(dna) || dna === 'ai-custom' || dna.startsWith('learned:') || (dna === SKETCH_DNA && sel.needsAi))) dna = sel.dna;
    const read = json.read as BlockPlan['read'];
    const teach = dna === 'bridge' ? null : json.teach;
    const arc = json.arc === null ? undefined : json.arc;
    const problems = [...validatePlan(dna, teach, read, true), ...arcProblems(arc, 'arc', true)];
    if (problems.length) {
      errors.push(...problems.map((p) => `Attempt ${attempt}: ${p}`));
      continue;
    }
    let learned: LearnedDna | undefined;
    if (dna === 'ai-custom' && !o.ephemeral) {
      const nd = (json.newDna ?? {}) as { name?: string; description?: string; keywords?: string[] };
      const name = String(nd.name || `Template for ${block.kind}`);
      learned = saveLearned({
        id: slugId(name),
        name,
        description: String(nd.description || ''),
        kinds: [block.kind],
        keywords: (nd.keywords ?? []).map(String).slice(0, 12),
        segments: (teach as CompositePlan).segments.map((s) => s.dna),
        example: teach as CompositePlan,
        createdAt: new Date().toISOString(),
      });
      dna = `learned:${learned.id}`;
    }
    // Quality gate: the plan is valid, but would the viewer meet overlapping text, a paragraph for a caption, English in the Malayalam?
    const dnaKey: string = dna;
    const qa = dnaKey === 'bridge' || dnaKey === 'ai-custom' || dnaKey.startsWith('learned:') ? [] : qaPlan(dna, teach, read);
    if (qa.length && attempt < max) {
      errors.push(...qa.map((p) => `Attempt ${attempt}: quality check — ${p}`));
      qaNotes.push(...qa);
      continue;
    }
    const plan: BlockPlan = { blockId: block.id, dna, read, teach, ...(arc ? { arc: arc as BlockPlan['arc'] } : {}), source: 'ai', warnings: json.dnaReason ? [`AI changed DNA: ${String(json.dnaReason)}`] : undefined };
    // V51.9.50: a free sketch is kept as a candidate (not reused) until a teacher promotes it.
    let sketch: SketchCandidate | undefined;
    if (dnaKey === SKETCH_DNA && !o.ephemeral) {
      const nd = (json.newDna ?? {}) as { name?: string; description?: string; keywords?: string[] };
      sketch = saveSketchCandidate({
        name: String(nd.name || `Sketch for ${block.kind}`),
        description: String(nd.description || ''),
        keywords: (nd.keywords ?? []).map(String),
        kinds: [block.kind],
        plan: teach as SketchPlan,
        blockText: block.text,
        blockId: block.id,
      });
      plan.warnings = [...(plan.warnings ?? []), 'Free sketch (no template fitted): the app checked its layout but not its maths — review it, then promote it to reuse it.'];
    }
    const textOnly = textOnlyWarning(plan);
    if (textOnly) plan.warnings = [...(plan.warnings ?? []), textOnly];
    if (qa.length) plan.warnings = [...(plan.warnings ?? []), `Quality check still open after ${attempt} tries: ${qa.join(' | ')}`];
    else if (qaNotes.length) plan.warnings = [...(plan.warnings ?? []), `Regenerated ${attempt - 1} time(s) after the quality check: ${[...new Set(qaNotes)].slice(0, 3).join(' | ')}`];
    plan.qa = { attempts: attempt, passed: qa.length === 0, notes: qa.length ? qa : [...new Set(qaNotes)].slice(0, 6) };
    return {
      plan,
      selection: sel,
      learned,
      ...(sketch ? { sketch } : {}),
      attempts: attempt,
      errors,
    };
  }
  // Still failing: keep the class going with the offline plan and say why.
  const fallback = offlinePlan(block, ctx.chapterTitle, ctx.sectionTitle);
  fallback.warnings = [...(fallback.warnings ?? []), `AI plan rejected after ${max} tries: ${errors.slice(-3).join(' | ')}`];
  return { plan: fallback, selection: sel, attempts: max, errors };
}

/**
 * Plan one unit again (a teacher pressed "Regenerate", optionally with a note). The same checks and
 * automatic retries run; a successful AI plan replaces the cached one so a reload keeps it.
 */
export async function regenerateBlock(block: BookBlock, ctx: PlanContext, llm: Llm, o: { selection?: DnaSelection; maxAttempts?: number } = {}): Promise<AiPlanResult> {
  const r = await aiPlanBlock(block, ctx, llm, o);
  if (r.plan.source === 'ai') {
    const cache = readCache();
    cache[cacheKey(block, ctx)] = r.plan;
    writeCache(cache);
  }
  return r;
}

/* ---------------- section planning ---------------- */

export interface SectionPlanProgress {
  done: number;
  total: number;
  blockId?: string;
  message?: string;
}

/** v2: plans made before the graph / plane DNAs (text-only boards) are not reused. */
const CACHE_KEY = 'ai-guru-motion-plans-v2';

function cacheKey(b: BookBlock, ctx: PlanContext): string {
  let h = 2166136261;
  for (const ch of `${ctx.chapterTitle}|${b.kind}|${b.text}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return (h >>> 0).toString(36);
}

function readCache(): Record<string, BlockPlan> {
  try {
    return typeof localStorage === 'undefined' ? {} : JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
  } catch {
    return {};
  }
}

function writeCache(c: Record<string, BlockPlan>) {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(CACHE_KEY, JSON.stringify(c));
  } catch {
    /* full: plans stay in memory for this session */
  }
}

/**
 * Plan every block of a section. With `llm` the AI fills plans (cached per block text);
 * without it, the offline planner runs. Bridges never call the AI.
 */
export async function planSection(
  blocks: BookBlock[],
  ctx: Omit<PlanContext, 'before' | 'after'>,
  llm: Llm | null,
  o: { selections?: Map<string, DnaSelection>; onProgress?: (p: SectionPlanProgress) => void; signal?: AbortSignal; useCache?: boolean; pageText?: (page: number) => string | undefined; pageImage?: (page: number) => Promise<{ base64: string; mime: string } | undefined> } = {},
): Promise<Map<string, BlockPlan>> {
  const plans = new Map<string, BlockPlan>();
  const cache = o.useCache === false ? {} : readCache();
  let done = 0;
  for (let i = 0; i < blocks.length; i++) {
    if (o.signal?.aborted) break;
    const b = blocks[i];
    const sel = o.selections?.get(b.id) ?? selectDna(b, ctx.chapterTitle);
    o.onProgress?.({ done, total: blocks.length, blockId: b.id, message: `${b.kind} → ${sel.dna}` });
    const key = cacheKey(b, ctx);
    if (cache[key]) {
      plans.set(b.id, { ...cache[key], blockId: b.id });
    } else if (!llm) {
      plans.set(b.id, offlinePlan(b, ctx.chapterTitle, ctx.sectionTitle, sel));
    } else {
      const pctx: PlanContext = {
        ...ctx,
        before: blocks.slice(Math.max(0, i - 2), i).map((x) => x.text.slice(0, 300)),
        after: blocks.slice(i + 1, i + 3).map((x) => x.text.slice(0, 300)),
        pageText: o.pageText?.(b.page),
        pageImage: o.pageImage ? await o.pageImage(b.page).catch(() => undefined) : undefined,
      };
      const r = await aiPlanBlock(b, pctx, llm, { selection: sel });
      plans.set(b.id, r.plan);
      if (r.plan.source === 'ai') {
        cache[key] = r.plan;
        writeCache(cache);
      }
    }
    done++;
    o.onProgress?.({ done, total: blocks.length, blockId: b.id });
  }
  return plans;
}
