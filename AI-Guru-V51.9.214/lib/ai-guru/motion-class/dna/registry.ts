/**
 * DNA registry and the template-selection logic.
 *
 * Selection is deterministic and explainable:
 *   1. features are read from the block (kind, numbers, equations, variables,
 *      question words, geometry words, "picture", area/rectangle, identity
 *      patterns, number-line words, tables, labelled equations…);
 *   2. every DNA scores the block 0..1 with its own rule;
 *   3. the best one wins; learned (AI-made) DNAs compete on keyword overlap;
 *   4. MANDATORY: problems, exercises, equation runs, results and any block that
 *      states a formula/equation must get a DNA. If the best built-in score is
 *      weak, the block is marked `needsAi` and the AI planner composes a new DNA
 *      (saved to the learned library, so the next similar block reuses it).
 */

import { BAL_EXCLUDE, findBalEquations } from './bal-math';
import { PAIR_EXCLUDE, findPairEquations } from './pair-math';
import { findTsFormulas } from './ts-math';
import { listIn } from './as-math';
import type { BookBlock } from '../segment';
import type { BlockFeatures, DnaDefinition, DnaId, DnaSelection } from './types';
import { getLearned, learnedDnas, scoreLearned } from './learned';
import { pinnedDna } from './teacher-dna';

const GEOMETRY = /\b(line|lines|parallel|perpendicular|triangles?|angles?|squares?|rectangles?|circles?|sides?|diagonal|hypotenuse|vertex|vertices|polygon|arc|radius|segment|similar|equilateral|isosceles|bisect\w*|centimetres?|metres?)\b/gi;
const PICTURE = /\b(picture|figure|see this|see these|look at this|draw|drawn|as shown)\b/i;
const NUMBER_LINE = /\b(negative|number line|left of|right of|below zero|above zero|opposite)\b/i;
const GRAPH = /\b(graphs?|graphed|plot(?:ted|ting|s)?|curves?|parabolas?|hyperbolas?|axes|axis|x-axis|y-axis|coordinates?|ordered pairs?|slope|gradient|intercepts?|co-ordinates?)\b/gi;
const GRAPH_Y_OF_X = /\by\s*=\s*[^=,;]*\b[0-9]?x\b/;
const GRAPH_EXCLUDE = /\b(bar graph|bar chart|pie chart|histogram|frequency|tally|pictograph)\b/i;
const PLANE = /\b(matrix|matrices|vectors?|linear transformations?|reflect(?:ed|s|ion|ions)?|rotat(?:e|ed|es|ion|ions)|shear(?:ed|ing)?|dilat(?:e|ed|ion)|enlargement|transformations? of (?:the )?(?:plane|space|shape|figure|triangle|square))\b/gi;
const FRACTION_WORDS = /\b(fractions?|halves|half|quarters?|thirds?|fifths?|sixths?|eighths?|tenths?|hundredths?|numerators?|denominators?|equivalent fractions?|parts? of (?:a|the) whole)\b/gi;
const FRACTION_SYMBOL = /\{\d+\/\d+\}|(?<![\d/])\d{1,2}\s*\/\s*\d{1,2}(?![\d/])/g;
const STATS = /\b(bar graphs?|bar charts?|histograms?|frequency|frequencies|mean|median|mode|averages?|data|survey|tally|statistics|class intervals?)\b/gi;
const PROB = /\b(probabilit(?:y|ies)|chances?|likel(?:y|ihood)|outcomes?|at random|coins?|dice|die|favourable|sample space|tree diagrams?|toss(?:ed|es)?)\b/gi;
const MATRIX_WORD = /\b(matrix|matrices)\b/i;
const MATRIX_STRUCT = /\b(rows?|columns?|entries|entry|elements?|diagonal|square matrix|rectangular matrix|[mn]\s*[×x]\s*[mn]|\d\s*[×x]\s*\d\s+matrix|a_?\{?\d\d\}?)\b/gi;
/** Matrix words that mean "this is about moving things", not about the shape of the grid. */
const MATRIX_ACTION = /\b(rotat\w*|reflect\w*|shear\w*|dilat\w*|enlarg\w*|transformation\w*|vectors?|multipl\w*|determinants?|inverse|eigen\w*)\b/i;
const SHAPE_NAMES = /\b(circles?|rectangles?|squares?|triangles?|hypotenuse)\b/gi;
const SHAPE_FORMULA = /\b(area|perimeter|circumference|pythagoras|pythagorean|hypotenuse|radius|diameter|special right triangles?)\b|30\s*°?\s*[-–]\s*60\s*°?\s*[-–]\s*90|45\s*°?\s*[-–]\s*45\s*°?\s*[-–]\s*90|π\s*r|2\s*π|a²\s*\+\s*b²|a\^2\s*\+\s*b\^2/gi;
/** Drawing a figure with a compass and ruler is the construction DNA's job, not a formula sheet. */
const SHAPE_CONSTRUCT = /\b(construct\w*|bisect\w*|compass(?:es)?|perpendiculars?|parallel|arcs?|protractor)\b/i;
const SET_STRONG = /\b(venn|unions?|intersections?|complements?|universal set|de morgan\w*|subsets?|disjoint)\b|[∪∩]/gi;
const SET_CONTEXT = /\bsets?\b|\bvenn\b|[∪∩]|universal set|de morgan/i;
const TRIG = /trigonometr\w*|\b(sine|cosine|cosecant|cotangent)\b|\bsecant(?!s?\s+(?:of|to)\s+(?:a|the)\s+circle)\b|\bunit circle\b|\b(?:sin|cos|tan|cot|sec|cosec|csc)\s*(?:\(|θ|°|\d|=)/gi;
/** Words that name a pair of linear equations; two equations "ax + by = c" in the text also count (weaker). */
const LINEAR_STRONG = /\b(pairs? of linear equations?|simultaneous (?:linear )?equations?|systems? of (?:linear )?equations?|linear equations? in two (?:variables|unknowns)|(?:elimination|substitution|graphical) method|method of (?:elimination|substitution))\b/gi;
const LINEAR_EQ = /[+−-]?\s*\d*\s*x\s*[+−-]\s*\d*\s*y\s*=\s*[+−-]?\s*\d+/g;
/** Arithmetic sequences: the words, or a list of numbers with a common difference. A geometric sequence is not this DNA. */
const SEQ_STRONG = /\b(arithmetic (?:sequences?|progressions?)|common difference|(?:nth|n-th|\d+(?:st|nd|rd|th)) term|sum of (?:the )?first (?:\w+ )?terms?|terms? of (?:an? )?(?:arithmetic )?sequence|first term)\b/gi;
const SEQ_EXCLUDE = /\b(common ratio|geometric)\b/i;
/** Quadratic equations: the words, or an equation like x² − 5x + 6 = 0 (a bare "roots" or "parabola" is not enough). */
const QUAD_STRONG = /\b(quadratic(?!\s+(?:polynomial|function|expression|curve|graph))|second[- ]degree|discriminant|completing the square|factori[sz]\w*|roots? of (?:the |a |an )?(?:\w+ )?equation)\b|\d*\s*x\s*(?:\^\s*2|²)\s*(?:[+−-]\s*\d*\s*x)?\s*(?:[+−-]\s*\d+)?\s*=\s*0/gi;
/** Where the quadratic formula comes from: "derive / derivation / proof / why does …" near "quadratic formula", or completing the square leading to the formula. */
const QD_DERIVE = /\b(?:deriv\w*|prov\w*|proof|origin|where (?:does|do) .{0,30}come from|why (?:does|is|do) .{0,30}(?:work|true))\b[^.?!]{0,70}\b(?:quadratic|(?:the )?formula|completing the square)|\b(?:quadratic formula|completing the square)\b[^.?!]{0,70}\b(?:deriv\w*|proof|prov\w*|comes? from|origin)/gi;
/** HCF / LCM of whole numbers (V51.9.49). Fractions and denominators have their own lessons. */
const HL_STRONG = /\b(hcf|lcm|gcd|gcf|highest common (?:factor|divisor)|greatest common (?:factor|divisor)|lowest common multiple|least common multiple|h\.c\.f|l\.c\.m)\b/gi;
const HL_EXCLUDE = /\b(fractions?|denominators?|numerators?|common denominators?)\b/i;
/** Polynomials: the theorems and phrases (2 each); a bare "polynomial" is one hit, which is not enough on its own. */
const POLY_STRONG = /\b(remainder theorem|factor theorem|(?:zeros?|roots?|degrees?|terms?|coefficients?|divid\w*|dividing|factori[sz]\w*) of (?:a |an |the )?(?:\w+ )?polynomials?|polynomial (?:long )?division|long division of polynomials?|division algorithm|monomials?|binomials?|trinomials?|polynomials? in (?:x|one variable)|coefficients? of x|remainder (?:when|on dividing)|quotient and (?:the )?remainder)\b/gi;
const POLY_WORD = /\bpolynomials?\b|x\s*(?:\^\s*[34]|[³⁴])/gi;
/** Angles between lines, in triangles and in circles: the theorems and their names. */
const ANGLE_STRONG = /\b(transversals?|corresponding angles?|alternate (?:interior |exterior )?angles?|co-?interior angles?|allied angles?|vertically opposite angles?|linear pairs?|angle sum (?:property|of)|sum of (?:the )?(?:interior )?angles? of a triangle|(?:interior )?angles? of a triangle (?:add|sum)|exterior angles? (?:of|property|theorem)|angles? (?:at|in|subtended\w* (?:at|by)) the centre|angles? in a semi-?circle|angles? in the same segment|cyclic quadrilaterals?|inscribed angles?|angles? at the circumference)\b/gi;
/** Solids: the names of the solids and the words of their volume and surface-area rules. */
const SOLID_STRONG = /\b(cuboids?|cylinders?|cylindrical|cones?|conical|spheres?|spherical|hemispheres?|triangular prisms?|prisms?|slant heights?|(?:curved|lateral|total) surface areas?|surface areas? of (?:a|an|the)\b|volume of (?:a|an|the) (?:solid|box|tank|pipe|ball|can|pillar|room|container))\b/gi;
/** Ratios and percentages: sharing in a ratio, a percent of a quantity, increase and decrease. */
const RATIO_STRONG = /\b(in the ratio|per ?cent|percent(?:age)?s?|discounts?)\b|\d+(?:\.\d+)?\s*%|(?<![\d:.√])\d{1,3}\s*:\s*\d{1,3}(?:\s*:\s*\d{1,3})?(?![\d:])/gi;
const RATIO_EXCLUDE = /\b(trigonometric|sine|cosine|tangent|common ratio|geometric|similar (?:triangles|figures)|scale factor|probabilit\w*|hypotenuse|special right triangles?)\b|√/i;
/** Pie charts: the names of the chart. */
const PIE_STRONG = /\b(pie ?(?:charts?|diagrams?|graphs?)|circle graphs?)\b/gi;
/** Coordinate geometry: plotting points, quadrants, the distance between points and the midpoint. */
const CG_CORE = /\b(coordinates?|co-ordinates?|ordered pairs?|quadrants?|abscissa|ordinate|cartesian|x-axis|y-axis|plot(?:ted|ting|s)? (?:the |these |each )?(?:points?|pairs?))\b|\(\s*[−-]?\d+\s*,\s*[−-]?\d+\s*\)/gi;
const CG_EXTRA = /\b(distance (?:formula|between (?:the |two |these )?(?:points?|them))|mid-?points?|section formula)\b/gi;
const CG_EXCLUDE = /\b(functions?|graph of|slope|gradient|curve|parabola|equations?|vectors?|matri(?:x|ces)|transform\w*|rotat\w*|reflect\w*|f\(x\)|y\s*=)\b|y\s*=|f\(x\)/i;
/** Visual proofs of the algebraic identities (a + b)², (a − b)² and (a + b)(a − b). */
const SQID_STRONG = /\(\s*[a-z]\s*\+\s*[a-z]\s*\)\s*(?:²|\^\s*2)|\(\s*[a-z]\s*[−–-]\s*[a-z]\s*\)\s*(?:²|\^\s*2)|\(\s*[a-z]\s*\+\s*[a-z]\s*\)\s*\(\s*[a-z]\s*[−–-]\s*[a-z]\s*\)|\bsquare of (?:the |a )?(?:sum|difference) of (?:two|the) (?:numbers|terms|quantities)|\bdifference of (?:two )?squares\b|\b(?:visual|geometric(?:al)?) proof\b/gi;
const SQID_EXCLUDE = /\b(polynomials?|quadratic|remainder|factor theorem|roots?|degree|equations?)\b/i;
/** Linear equations a x + b = c (or a x = c) that a balance scale can show: one unknown, whole numbers. */
/** Area of a parallelogram or trapezium: the name of the figure together with area, height or base. */
const AFIG_NAMES = /\b(parallelograms?|trapezi(?:um|ums|a)|trapezoids?)\b/gi;
const AFIG_AREA = /\b(areas?|heights?|altitudes?|bases?|parallel sides?)\b/i;
/** Matrix products and transposes (the word "matrix" is also required). */
const MOPS_STRONG = /\b(transpose[ds]?|transposition|matrix multiplication|multipl(?:y|ying|ication|ied) (?:of )?(?:(?:a|the|two|these) )?(?:matri(?:x|ces)|\d\s*[×x]\s*\d)|product of (?:(?:the|two) )?matrices|row by column|rows? (?:of \w+ )?(?:with|by) (?:the )?columns?|(?:order|dimensions?) of the product)\b/gi;
const MOPS_EXCLUDE = /\b(vectors?|rotat\w*|reflect\w*|shear\w*|dilat\w*|enlarg\w*|transformations?|determinants?|inverse|eigen\w*|simultaneous|equations?)\b/i;
const FLINE_NL = /\bnumber lines?\b/gi;
const SEQUENCE = /\b(sequences?|series|arithmetic progressions?)\b/i;
const QUESTION = /\?|\b(how many|how much|what is|what are|what's|find|calculate|compute)\b/i;
const UNITS = /\b(rupees?|centimetres?|metres?|cm|kg|kilograms?|litres?|beads?|years?|pens?|pencils?|notebooks?|chairs?|tables?|boys?|girls?|seconds?|m\/s|%)\b/i;
const REASONING = /\b(which means|so,|so the|this means|that is|thus|because|each|remaining|altogether|twice|times)\b/i;
const CONNECTIVE = /^(that is|so|this gives|let's look at another one|another problem|one more problem|see this problem|let's start with a problem|thus|we can extract \w+ from this|and we can get \w+ from this|can you do it in your head\??)[,:.?]?$/i;

export function blockFeatures(b: BookBlock, chapterTitle = ''): BlockFeatures {
  const text = b.text;
  const mathLines = b.lines.filter((l) => l.math);
  const eqLines = b.lines.filter((l) => /=/.test(l.text));
  const variables = [...new Set((text.match(/(?<![A-Za-z])[a-z](?![A-Za-z])/g) ?? []).filter((v) => !['a', 'i'].includes(v) || /[=+−]/.test(text)))];
  const geometry = (text.match(GEOMETRY) ?? []).length;
  const graphHits = GRAPH_EXCLUDE.test(text) ? 0 : (text.match(GRAPH) ?? []).length + (b.kind !== 'math' && GRAPH_Y_OF_X.test(text) ? 1 : 0);
  const planeHits = (text.match(PLANE) ?? []).length;
  const structHits = (text.match(MATRIX_STRUCT) ?? []).length;
  const matrixHits = MATRIX_WORD.test(text) && structHits >= 2 && !MATRIX_ACTION.test(text) ? structHits + 1 : 0;
  const shapeHits = SHAPE_CONSTRUCT.test(text) ? 0 : (text.match(SHAPE_NAMES) ?? []).length + (text.match(SHAPE_FORMULA) ?? []).length;
  const trigHits = (text.match(TRIG) ?? []).length;
  const quadHits = (text.match(QUAD_STRONG) ?? []).length * 2;
  const hlHits = HL_EXCLUDE.test(text) ? 0 : (text.match(HL_STRONG) ?? []).length * 2;
  const qdvHits = /quadratic formula|completing the square|quadratic equation/i.test(text) ? (text.match(QD_DERIVE) ?? []).length * 2 : 0;
  const angleHits = (text.match(ANGLE_STRONG) ?? []).length * 2;
  const solidHits = (text.match(SOLID_STRONG) ?? []).length * 2;
  const pieHits = (text.match(PIE_STRONG) ?? []).length * 2;
  const cgCore = (text.match(CG_CORE) ?? []).length;
  const cgExtra = (text.match(CG_EXTRA) ?? []).length;
  const coordHits = cgCore >= 1 && !CG_EXCLUDE.test(text) ? cgCore * 2 + cgExtra : 0;
  const sqidHits = SQID_EXCLUDE.test(text) ? 0 : (text.match(SQID_STRONG) ?? []).length * 2;
  const balHits = BAL_EXCLUDE.test(text) ? 0 : findBalEquations(text).length * 2;
  const tsHits = findTsFormulas(text).length * 2;
  const afigNames = (text.match(AFIG_NAMES) ?? []).length;
  const afigHits = afigNames > 0 && AFIG_AREA.test(text) ? afigNames * 2 + 1 : 0;
  const mopsHits = (MATRIX_WORD.test(text) || /\[\s*\[/.test(text)) && !MOPS_EXCLUDE.test(text) ? (text.match(MOPS_STRONG) ?? []).length * 2 : 0;
  const flNl = (text.match(FLINE_NL) ?? []).length;
  const ratioHits = RATIO_EXCLUDE.test(text) ? 0 : (text.match(RATIO_STRONG) ?? []).length * 2;
  const polyHits = (text.match(POLY_STRONG) ?? []).length * 2 + (text.match(POLY_WORD) ?? []).length;
  const seqHits = SEQ_EXCLUDE.test(text) ? 0 : (text.match(SEQ_STRONG) ?? []).length * 2 + (listIn(text) ? 1 : 0);
  const pairBalHits = PAIR_EXCLUDE.test(text) ? 0 : findPairEquations(text).length;
  const linearHits = (text.match(LINEAR_STRONG) ?? []).length * 2 + ((text.match(LINEAR_EQ) ?? []).length >= 2 ? 1 : 0);
  const setHits = (text.match(SET_STRONG) ?? []).length;
  const fractionHits = (text.match(FRACTION_WORDS) ?? []).length + (text.match(FRACTION_SYMBOL) ?? []).length;
  const flineHits = flNl > 0 && fractionHits > 0 ? flNl * 2 + 1 : 0;
  const statsHits = (text.match(STATS) ?? []).length;
  const probHits = (text.match(PROB) ?? []).length;
  return {
    kind: b.kind,
    text,
    chars: text.length,
    numbers: (text.match(/\d+(?:\.\d+)?/g) ?? []).length,
    equations: eqLines.length + (b.kind !== 'math' ? (text.match(/[a-z0-9)]\s*=\s*[a-z0-9(]/gi) ?? []).length : 0),
    variables,
    question: QUESTION.test(text),
    wordProblem:
      ((b.kind === 'problem' || b.kind === 'exercise') && QUESTION.test(text) && /\d/.test(text)) ||
      (QUESTION.test(text) && UNITS.test(text) && (text.match(/\d+/g) ?? []).length >= 2),
    geometry,
    picture: PICTURE.test(text),
    area: /\b(area|rectangle)\b/i.test(text) && /×|\bsides?\b/.test(text),
    identity: /\([a-z]\s*[+−]\s*[a-z]\)\s*\(?[a-z]?/.test(text) || (/^for (any|all)/i.test(text) && /=/.test(text)),
    numberLine: NUMBER_LINE.test(text) || /negative/i.test(chapterTitle),
    graph: graphHits > 0,
    graphHits,
    plane: planeHits > 0 && matrixHits === 0,
    matrix: matrixHits > 0,
    matrixHits,
    shape: shapeHits >= 2 && (text.match(SHAPE_NAMES) ?? []).length >= 1 && (text.match(SHAPE_FORMULA) ?? []).length >= 1,
    shapeHits,
    sets: setHits >= 1 && SET_CONTEXT.test(text),
    setHits,
    trig: trigHits >= 1,
    trigHits,
    quad: quadHits > 0,
    quadHits,
    qdv: qdvHits >= 2,
    qdvHits,
    hl: hlHits >= 2,
    hlHits,
    poly: polyHits >= 2,
    polyHits,
    angle: angleHits >= 2,
    angleHits,
    solid: solidHits >= 2,
    solidHits,
    ratio: ratioHits >= 2,
    ratioHits,
    pie: pieHits >= 2,
    pieHits,
    coord: coordHits >= 3,
    coordHits,
    sqid: sqidHits >= 2,
    sqidHits,
    bal: balHits >= 2,
    balHits,
    pairBal: pairBalHits >= 1,
    pairBalHits,
    ts: tsHits >= 2,
    tsHits,
    afig: afigHits >= 3,
    afigHits,
    mops: mopsHits >= 2,
    mopsHits,
    fline: flineHits >= 3,
    flineHits,
    seq: seqHits > 0,
    seqHits,
    linear: linearHits > 0,
    linearHits,
    planeHits,
    sequence: SEQUENCE.test(text),
    fractions: fractionHits > 0,
    fractionHits,
    stats: statsHits > 0,
    statsHits,
    prob: probHits > 0,
    probHits,
    arithmeticOnly: mathLines.length > 0 && mathLines.every((l) => !/[a-z]/i.test(l.text.replace(/sq\.?\s*cm|rupees?|cm/gi, ''))),
    table: mathLines.length >= 2 && mathLines.filter((l) => /^[A-Za-z]+(\s+[A-Za-z]+){1,4}$/.test(l.text.trim()) || /^\d+(\s+\d+){2,}$/.test(l.text.trim())).length >= 2,
    labelled: b.lines.filter((l) => l.label).length >= 2,
    formulaLike: /=/.test(text) && variables.length >= 2 && /\b(any|always|general|formula|identity)\b/i.test(text),
    reasoning: REASONING.test(text) && (text.match(/\d+/g) ?? []).length >= 3 && !/=/.test(text),
    connective: text.length < 70 && (CONNECTIVE.test(text.trim()) || (/:$/.test(text.trim()) && text.length < 60)),
    chapterTitle,
  };
}

const clamp = (v: number) => Math.max(0, Math.min(1, v));

export const DNAS: DnaDefinition[] = [
  {
    id: 'bridge',
    name: 'Bridge sentence',
    description: 'A short connecting sentence ("That is,", "Another problem:"). Read aloud only; no separate teaching.',
    kinds: ['prose', 'aside'],
    score: (f) =>
      f.connective ? 0.95 : f.kind === 'aside' && f.chars < 120 ? 0.7 : (f.kind === 'prose' && f.chars < 60 && f.equations === 0 && f.numbers === 0 && !/[ഀ-ൿ]/.test(f.text) ? 0.7 : 0),
    planShape: '{}',
  },
  {
    id: 'section-intro',
    name: 'Section intro',
    description: 'Section heading written with a pen underline, then 2–4 key ideas of the section, key terms focused.',
    kinds: ['heading'],
    score: (f) => (f.kind === 'heading' ? 0.95 : 0),
    planShape: '{"heading":{"en":"","ml":""},"points":[{"board":{"en":"short line with *key term*","ml":""},"say":{"en":"","ml":""}}]}',
  },
  {
    id: 'chapter-intro',
    name: 'Chapter introduction',
    description: 'Opening of a chapter: the title card with the chapter\'s formulas drifting behind it, one card per topic (a small worked example the app computes: a x + b = c, or a pair of equations), and a recap. Placed by the class at the start of a chapter, never chosen from a passage.',
    kinds: [],
    score: () => 0,
    planShape: '{"title":{"en":"","ml":""},"formulas":["x + y = 10"],"topics":[{"name":{"en":"","ml":""},"say":{"en":"","ml":""},"example":{"kind":"solve","a":2,"b":-10,"c":100}}],"welcome":{"en":"","ml":""},"closing":{"en":"","ml":""}}',
  },
  {
    id: 'concept-board',
    name: 'Concept board',
    description: 'Explanation paragraph → 2–5 idea cards (key terms coloured and focused), or a picture that fits the ideas: balance scale (two sides weighed), bars (quantities), tree (kinds and parts), flow of steps, cycle, timeline, pyramid, two columns; cards carry small icons (any subject); the caption explains.',
    kinds: ['prose', 'aside', 'result'],
    score: (f) => (f.kind === 'prose' ? 0.5 : f.kind === 'aside' ? 0.55 : 0.3) - (f.equations > 0 ? 0.15 : 0),
    planShape: '{"layout":"cards|pyramid|columns|flow|cycle|timeline|scale|bars|tree (optional)","heading":{"en":"","ml":""},"heads":[{"en":"","ml":""},{"en":"","ml":""}],"unit":{"en":"","ml":""},"points":[{"col":0,"weight":1,"value":0,"parent":0,"icon":"sun","board":{"en":"","ml":""},"math":["optional","tokens"],"say":{"en":"","ml":""}}]}',
  },
  {
    id: 'mental-math',
    name: 'Mental-math reasoning',
    description: 'Arithmetic reasoning in words → a chain of small calculations; numbers fly from one line to the next and merge into results.',
    kinds: ['prose'],
    score: (f) => (f.reasoning && !f.sequence && !f.fractions && !f.stats && !f.prob ? clamp(0.55 + f.numbers * 0.05) : 0),
    planShape: '{"lines":[{"tokens":["100","−","10","=","90"],"caption":{"en":"","ml":""},"fresh":true}]}',
  },
  {
    id: 'word-problem',
    name: 'Word problem → equations → solve',
    description:
      'Problem card with quantities highlighted → unknowns named (x, y) → each condition translated into an equation beside its words → solved step by step (verified) → answer in words.',
    kinds: ['problem', 'exercise', 'prose'],
    score: (f) => {
      const base = f.wordProblem ? (f.kind === 'prose' ? 0.6 : 0.92) : f.kind === 'problem' || f.kind === 'exercise' ? 0.5 : 0;
      // A fractions / data / chance question with no unknowns and no equations is a picture, not an equation to solve.
      return (f.fractions || f.stats || f.prob) && f.variables.length === 0 && f.equations === 0 ? base * 0.8 : base;
    },
    planShape:
      '{"statement":{"en":"","ml":""},"highlights":["phrases of the English statement to colour"],"highlightsMl":["same phrases in the Malayalam statement"],"unknowns":[{"symbol":"x","meaning":{"en":"","ml":""}}],"equations":[{"phrase":{"en":"","ml":""},"tokens":["x","+","y","=","11000"]}],"solution":{"solver":"x + y = 11000 and 4x + y = 14000"} or {"lines":[...ChainLine]},"answer":{"en":"","ml":""},"solvedLater":false,"solutions":[{"x":1000,"y":10000}]}',
  },
  {
    id: 'equation-chain',
    name: 'Equation chain',
    description: 'A worked chain of equations: each new line is built from the previous one; terms move, signs change, numbers merge; answer boxed.',
    kinds: ['math', 'prose'],
    score: (f) => (f.kind === 'math' && f.equations >= 2 && !f.labelled && !f.table ? 0.85 : f.kind === 'math' && f.equations === 1 ? 0.6 : f.kind === 'prose' && f.equations >= 1 ? 0.62 : 0),
    planShape:
      '{"lines":[{"tokens":["2","x","−","10","=","100"],"caption":{"en":"","ml":""}},{"tokens":["2","x","=","110"],"caption":{"en":"","ml":""},"links":[[0,0],[1,1],[4,3]],"note":{"en":"+10 both sides","ml":""}}],"solutions":[{"x":55}]}',
  },
  {
    id: 'equation-pair',
    name: 'Pair of equations',
    description: 'Two equations written one below the other, numbered (1), (2); like terms coloured alike; then solved by elimination or substitution.',
    kinds: ['math'],
    score: (f) => (f.kind === 'math' && f.equations === 2 && f.variables.length >= 2 && !f.labelled ? 0.88 : 0),
    planShape: '{"lines":[...ChainLine],"solutions":[{"x":0,"y":0}]}',
  },
  {
    id: 'translate-table',
    name: 'Words → equations table',
    description: 'Each piece of information (words, left) turns into its equation (right); numbers and unknowns keep their colours across.',
    kinds: ['math'],
    score: (f) => (f.labelled ? 0.92 : 0),
    planShape: '{"rows":[{"words":{"en":"","ml":""},"tokens":["2","x","+","3","y","=","110"],"say":{"en":"","ml":""}}]}',
  },
  {
    id: 'number-table',
    name: 'Numbers-only table',
    description: 'Coefficients written as a table (no letters); a row is scaled (×2, every cell rolls to its new value), rows are subtracted to cancel a column.',
    kinds: ['math'],
    score: (f) => (f.table ? 0.9 : 0),
    planShape:
      '{"headers":[{"en":"Pencil","ml":""}],"rows":[[3,4,66],[6,3,72]],"ops":[{"op":"scale","row":0,"by":2,"say":{"en":"","ml":""}},{"op":"subtract","from":2,"minus":1,"say":{"en":"","ml":""}}]}',
  },
  {
    id: 'key-result',
    name: 'Key result',
    description: 'A general result / rule written in large type, key terms coloured and focused, then boxed with a tick (optionally its formula below).',
    kinds: ['result', 'prose'],
    score: (f) => (f.kind === 'result' ? 0.9 : 0),
    planShape: '{"statement":{"en":"","ml":""},"keyTerms":{"en":[""],"ml":[""]},"formula":["optional","tokens"],"say":{"en":"","ml":""}}',
  },
  {
    id: 'identity-formula',
    name: 'Identity / formula',
    description: 'Formula with each letter in its own colour; letters then roll into numbers (substitution), products merge, both sides shown equal.',
    kinds: ['math', 'result', 'prose'],
    score: (f) => (f.identity || f.formulaLike ? 0.9 : 0),
    planShape: '{"lines":[{"tokens":["(","x","+","y",")","(","u","+","v",")","=","x","u","+","x","v","+","y","u","+","y","v"],"caption":{"en":"","ml":""}}],"solutions":[{"x":20,"y":6,"u":10,"v":5}]}',
  },
  {
    id: 'area-model',
    name: 'Area model',
    description: 'A rectangle whose sides are split into parts; each small rectangle shows its product, the products roll into numbers and are added.',
    kinds: ['math', 'prose', 'problem'],
    score: (f) => (f.area ? 0.88 : 0),
    planShape:
      '{"widthParts":[20,6],"heightParts":[10,5],"unit":"cm","say":{"setup":{"en":"","ml":""},"split":{"en":"","ml":""},"parts":{"en":"","ml":""},"total":{"en":"","ml":""}}}',
  },
  {
    id: 'column-arithmetic',
    name: 'Column arithmetic',
    description: 'Column addition / subtraction with carries and borrows, long multiplication, long division.',
    kinds: ['math', 'prose'],
    score: (f) => (f.arithmeticOnly && /\d{2,}\s*[×+−÷]\s*\d{2,}/.test(f.text) && /one below the other|column|long division/i.test(f.text) ? 0.85 : 0),
    planShape: '{"sum":"347 × 26"}',
  },
  {
    id: 'geometry-construction',
    name: 'Geometry construction',
    description: 'The figure is built step by step with a pen: points, lines, parallels, perpendiculars, arcs, right-angle marks, equal-length ticks; the part being discussed is coloured and focused.',
    kinds: ['prose', 'problem', 'exercise', 'result'],
    score: (f) => clamp((f.geometry >= 2 ? 0.45 + f.geometry * 0.06 : 0) + (f.picture ? 0.2 : 0)),
    planShape:
      '{"title":{"en":"","ml":""},"points":{"A":[10,20],"B":[90,20]},"steps":[{"op":"segment","from":"A","to":"B","color":"a","say":{"en":"","ml":""}},{"op":"right-angle","at":"B","arms":["A","C"]},{"op":"equal-ticks","segments":[["A","B"],["C","D"]]},{"op":"polygon","points":["A","B","C"],"fill":"c"},{"op":"label","at":"A","text":"A"}]}',
  },
  {
    id: 'plane-transform',
    name: 'Plane and matrix transformation',
    description:
      'A coordinate plane with a blue grid: î (green) and ĵ (red) appear, vectors and shapes are placed, then a matrix sends the WHOLE plane somewhere new (shear, rotation, stretch, reflection) while grid lines stay parallel; the matrix columns show where î and ĵ land; the determinant is the area of the unit square. Use for vectors, matrices, reflection, rotation, dilation, shear.',
    kinds: ['prose', 'problem', 'exercise', 'result', 'aside'],
    score: (f) => (f.plane && !f.matrix ? clamp(0.84 + 0.05 * (f.planeHits - 1)) : 0),
    planShape:
      '{"title":{"en":"","ml":""},"xMax":5,"yMax":4,"steps":[{"op":"grid","say":{"en":"","ml":""}},{"op":"basis","say":{}},{"op":"vector","v":[2,1],"label":"v","say":{}},{"op":"combine","v":[2,1],"say":{}},{"op":"shape","points":[[1,1],[2,1],[2,2],[1,2]],"label":"A","say":{}},{"op":"square","say":{}},{"op":"transform","matrix":[1,1,0,1],"name":{"en":"shear","ml":""},"say":{}},{"op":"det","say":{}},{"op":"reset","say":{}}]}  (every step has "say": {"en","ml"}; matrix = [a,b,c,d] meaning [[a,b],[c,d]]: î lands at (a,c), ĵ at (b,d))',
    example:
      '{"xMax":5,"yMax":4,"steps":[{"op":"grid","say":{"en":"This is the plane. Every point has two coordinates.","ml":"ഇതാണ് തലം. ഓരോ ബിന്ദുവിനും രണ്ട് നിർദേശാങ്കങ്ങൾ ഉണ്ട്."}},{"op":"basis","say":{"en":"Green î is one step right, red ĵ is one step up.","ml":"പച്ച î ഒരു ചുവട് വലത്തേക്ക്, ചുവപ്പ് ĵ ഒരു ചുവട് മുകളിലേക്ക്."}},{"op":"transform","matrix":[1,1,0,1],"name":{"en":"shear","ml":"ചരിക്കൽ"},"say":{"en":"A shear: î stays, ĵ leans right.","ml":"ചരിക്കൽ: î മാറുന്നില്ല, ĵ വലത്തേക്ക് ചരിയുന്നു."}}]}',
  },
  {
    id: 'function-graph',
    name: 'Graph on axes',
    description:
      'Axes with numbers and a grid; points are plotted with dashed lines to the axes, a curve (line, parabola, any y = f(x)) is drawn, a dot rides along it reading coordinates, an area can be shaded, and the curve can bend into another function when a parameter changes (slope, intercept, coefficient). Use for graphs of equations, coordinates, plotting points, slope, parabola, functions.',
    kinds: ['prose', 'problem', 'exercise', 'result', 'aside', 'math'],
    score: (f) => (f.graph ? clamp(0.78 + 0.05 * (f.graphHits - 1)) : 0),
    planShape:
      '{"title":{"en":"","ml":""},"xMin":-5,"xMax":5,"yMin":-4,"yMax":8,"steps":[{"op":"axes","say":{"en":"","ml":""}},{"op":"point","at":[1,3],"label":"(1, 3)","drop":true,"say":{}},{"op":"curve","fn":"2x+1","color":"b","label":"y = 2x + 1","say":{}},{"op":"tracker","stops":[-2,0,2],"say":{}},{"op":"segment","from":[0,1],"to":[1,1],"dashed":true,"label":"1","say":{}},{"op":"shade","from":0,"to":2,"say":{}},{"op":"morph","fn":"3x+1","label":"y = 3x + 1","say":{}}]}  (fn uses x with + - * / ^ ( ) sin cos tan sqrt abs ln exp pi; the curve must stay inside yMin..yMax for its whole x range; labels are maths only, ≤ 16 characters)',
    example:
      '{"xMin":-4,"xMax":4,"yMin":-3,"yMax":9,"steps":[{"op":"axes","say":{"en":"Here are the axes: x goes across, y goes up.","ml":"ഇതാ അക്ഷങ്ങൾ: x കുറുകെ, y മുകളിലേക്ക്."}},{"op":"curve","fn":"x^2","label":"y = x^2","say":{"en":"For every x, y is x times x. That makes a curve.","ml":"ഓരോ x-നും y എന്നത് x ഗുണം x ആണ്. അത് ഒരു വക്രമാകുന്നു."}},{"op":"tracker","stops":[-2,0,2],"say":{"en":"Look: x = 2 and x = −2 give the same height.","ml":"നോക്കൂ: x = 2, x = −2 എന്നിവയ്ക്ക് ഒരേ ഉയരം."}}]}',
  },
  {
    id: 'fraction-bars',
    name: 'Fraction bars and tiles',
    description:
      'A bar is cut into equal parts and some parts are coloured; the fraction is written beside it. Cutting every part smaller shows equivalent fractions (the colour does not change, only the numbers); two bars with the same parts are joined end to end to add; a grid of tiles shows a part of a whole, with the decimal and percent when the tiles are tenths or hundredths. Use for fractions, equivalent fractions, adding fractions, parts of a whole, percent, decimals.',
    kinds: ['prose', 'problem', 'exercise', 'result', 'aside'],
    score: (f) => (f.fractions && f.fractionHits >= 1 && !(f.variables.length >= 2 && f.equations > 0) ? clamp(0.8 + 0.04 * (f.fractionHits - 1)) : 0),
    planShape:
      '{"title":{"en":"","ml":""},"steps":[{"op":"bar","n":2,"shade":1,"say":{"en":"","ml":""}},{"op":"split","bar":0,"by":2,"say":{}},{"op":"shade","bar":0,"to":3,"say":{}},{"op":"join","a":0,"b":1,"say":{}},{"op":"grid","rows":10,"cols":10,"shade":35,"say":{}}]}  (every step has "say": {"en","ml"}; bars are numbered 0,1,2… in the order drawn; the app writes every fraction, decimal and percent itself)',
    example:
      '{"steps":[{"op":"bar","n":2,"shade":1,"say":{"en":"Cut a bar into 2 equal parts and colour 1: that is one half.","ml":"ഒരു പട്ടികയെ 2 തുല്യ ഭാഗങ്ങളാക്കി 1 ഭാഗം നിറം നൽകുക: അത് പകുതിയാണ്."}},{"op":"split","bar":0,"by":2,"say":{"en":"Cut every part in two. The colour does not change: 1 of 2 is 2 of 4.","ml":"ഓരോ ഭാഗത്തെയും രണ്ടായി മുറിക്കുക. നിറം മാറുന്നില്ല: 2-ൽ 1 എന്നത് 4-ൽ 2 തന്നെ."}}]}',
  },
  {
    id: 'histogram',
    name: 'Bar chart / histogram',
    description:
      'Axes with a number scale; bars grow from zero, one per category, values written on top; one bar can be highlighted; a dashed line shows the mean or median (computed by the app) and slides when a bar changes. Use for bar graphs, histograms, frequency, mean, median, average of data, surveys.',
    kinds: ['prose', 'problem', 'exercise', 'result', 'aside'],
    score: (f) => (f.stats ? clamp(0.8 + 0.04 * (f.statsHits - 1)) : 0),
    planShape:
      '{"title":{"en":"","ml":""},"categories":["Mon","Tue","Wed"],"yMax":10,"yLabel":"marks","steps":[{"op":"axes","say":{"en":"","ml":""}},{"op":"bars","values":[4,6,5],"say":{}},{"op":"highlight","index":1,"say":{}},{"op":"mean","say":{}},{"op":"median","say":{}},{"op":"line","y":5,"label":"target","say":{}},{"op":"change","index":0,"to":9,"say":{}}]}  (≤ 12 categories, labels ≤ 8 characters, values between 0 and yMax; the app computes the mean, the median and the new values after a change)',
    example:
      '{"categories":["A","B","C","D"],"yMax":10,"yLabel":"marks","steps":[{"op":"axes","say":{"en":"Each bar will show one child\'s marks.","ml":"ഓരോ ബാറും ഓരോ കുട്ടിയുടെ മാർക്ക് കാണിക്കും."}},{"op":"bars","values":[4,8,6,6],"say":{"en":"Here are the marks of four children.","ml":"നാല് കുട്ടികളുടെ മാർക്കുകൾ ഇതാ."}},{"op":"mean","say":{"en":"The mean is the level every bar would reach if they were all made equal.","ml":"എല്ലാ ബാറുകളും തുല്യമാക്കിയാൽ എത്തുന്ന ഉയരമാണ് ശരാശരി."}}]}',
  },
  {
    id: 'probability-tree',
    name: 'Probability tree',
    description:
      'A tree grows from the start: each branch carries its probability as a fraction, outcomes are named at the ends. One path lights up and its probabilities are multiplied; several paths light up and are added to give the chance of an event; the ends add up to 1. Use for chance, probability, coins, dice, drawing from a bag, with or without replacement.',
    kinds: ['prose', 'problem', 'exercise', 'result', 'aside'],
    score: (f) => (f.prob ? clamp(0.8 + 0.04 * (f.probHits - 1)) : 0),
    planShape:
      '{"title":{"en":"","ml":""},"start":"Start","branches":[{"label":"H","p":"1/2","children":[{"label":"H","p":"1/2"},{"label":"T","p":"1/2"}]},{"label":"T","p":"1/2","children":[{"label":"H","p":"1/2"},{"label":"T","p":"1/2"}]}],"steps":[{"op":"grow","levels":1,"say":{"en":"","ml":""}},{"op":"grow","levels":2,"say":{}},{"op":"path","path":[0,0],"say":{}},{"op":"event","paths":[[0,0],[0,1],[1,0]],"say":{}},{"op":"total","say":{}}]}  (p is a fraction like "2/5"; siblings add up to exactly 1; at most 3 levels and 8 ends; labels ≤ 6 characters; path = the branch number chosen at each level, counting from 0; the app multiplies and adds the fractions itself)',
    example:
      '{"start":"Start","branches":[{"label":"H","p":"1/2"},{"label":"T","p":"1/2"}],"steps":[{"op":"grow","levels":1,"say":{"en":"Toss a coin: two outcomes, each with chance one half.","ml":"ഒരു നാണയം ടോസ് ചെയ്യുക: രണ്ട് ഫലങ്ങൾ, ഓരോന്നിനും സാധ്യത പകുതി."}},{"op":"total","say":{"en":"The chances of all outcomes add up to 1.","ml":"എല്ലാ ഫലങ്ങളുടെയും സാധ്യതകൾ കൂട്ടിയാൽ 1 കിട്ടും."}}]}',
  },
  {
    id: 'matrix-grid',
    name: 'Matrix as a grid',
    description:
      'A matrix drawn as a bracketed grid of entries a_ij. A row, a column and the diagonal are boxed in turn; the camera zooms into one entry and shows that its two subscripts are its row and column numbers; the size A ∈ ℝ^{r×c} and "r × c matrix" are written; the grid generalises to n × n and m × n with dots; the app says Square or Rectangular. Use for what a matrix is: rows, columns, entries, order, square and rectangular matrices.',
    kinds: ['prose', 'problem', 'exercise', 'result', 'aside'],
    score: (f) => (f.matrix ? clamp(0.9 + 0.02 * (f.matrixHits - 3)) : 0),
    planShape:
      '{"title":{"en":"","ml":""},"name":"A","rows":3,"cols":3,"steps":[{"op":"show","say":{"en":"","ml":""}},{"op":"row","index":0,"say":{}},{"op":"column","index":0,"say":{}},{"op":"diagonal","say":{}},{"op":"entry","i":2,"j":2,"say":{}},{"op":"indices","say":{}},{"op":"zoomOut","say":{}},{"op":"size","say":{}},{"op":"kind","say":{}},{"op":"general","rows":"n","cols":"n","say":{}},{"op":"general","rows":"m","cols":"n","say":{}}]}  (rows and cols 1–5; optional "entries": numbers, rows × cols; letters for general: single lowercase letters; the app writes every subscript, the size and Square/Rectangular itself; the board words row, column, diagonal are translated by the app)',
    example:
      '{"name":"A","rows":3,"cols":3,"steps":[{"op":"show","say":{"en":"A matrix is a grid of numbers in brackets. Entry a-one-one sits in row 1, column 1.","ml":"മാട്രിക്സ് എന്നാൽ ബ്രാക്കറ്റിനുള്ളിലെ സംഖ്യകളുടെ ഒരു ഗ്രിഡാണ്. a-ഒന്ന്-ഒന്ന് ഒന്നാം വരിയിലും ഒന്നാം നിരയിലുമാണ്."}},{"op":"row","index":0,"say":{"en":"A row goes across.","ml":"വരി കുറുകെ പോകുന്നു."}},{"op":"column","index":0,"say":{"en":"A column goes down.","ml":"നിര താഴേക്ക് പോകുന്നു."}},{"op":"kind","say":{"en":"Rows and columns are equal, so this is a square matrix.","ml":"വരികളും നിരകളും തുല്യമാണ്, അതിനാൽ ഇത് സമചതുര മാട്രിക്സ് ആണ്."}}]}',
  },
  {
    id: 'shape-formula',
    name: 'Shape with its formula',
    description:
      'A figure is drawn by pen (circle, rectangle, square, triangle, right triangle, the special 30-60-90 and 45-45-90 triangles); its sides are labelled (r; l and w; a, b, c; a, a√3, 2a), angle arcs show 30°, 60°, 45°, a dotted height appears, and the formula is written beneath it, first as the rule and then with the numbers worked out. Use for the area and perimeter of a shape, the circumference of a circle, Pythagoras, the special right triangles.',
    kinds: ['prose', 'problem', 'exercise', 'result', 'aside'],
    // Words only (no numbers to multiply): the formula sheet. With numbers it still beats nothing, but the area model / word problem win.
    score: (f) => (f.shape && !f.trig && !(f.wordProblem && f.numbers >= 2) ? (f.numbers <= 1 ? clamp(0.93 + 0.01 * (f.shapeHits - 2)) : 0.82) : 0),
    planShape:
      '{"title":{"en":"","ml":""},"steps":[{"op":"shape","kind":"right-triangle","say":{"en":"","ml":""}},{"op":"label","say":{}},{"op":"formula","what":"pythagoras","say":{}},{"op":"shape","kind":"special-30-60-90","say":{}},{"op":"label","say":{}},{"op":"angles","say":{}},{"op":"formula","what":"ratio","say":{}},{"op":"name","say":{}}]}  (kind: circle | rectangle | square | triangle | right-triangle | special-30-60-90 | special-45-45-90; optional whole-number sizes "a" (and "b" for rectangle, triangle, right-triangle) make the app write the numbers and work the formula; "formula.what": circle area|circumference, rectangle and square area|perimeter, triangle area, right-triangle pythagoras|area, special ratio; "height" only for a triangle, "angles" only for the special triangles; at most 6 shapes; the app draws to scale, writes every label and formula and the shape name)',
    example:
      '{"steps":[{"op":"shape","kind":"circle","say":{"en":"This is a circle.","ml":"ഇതൊരു വൃത്തമാണ്."}},{"op":"label","say":{"en":"The distance from the centre to the circle is the radius r.","ml":"കേന്ദ്രത്തിൽ നിന്ന് വൃത്തത്തിലേക്കുള്ള ദൂരമാണ് ആരം r."}},{"op":"formula","what":"area","say":{"en":"Its area is pi times r squared.","ml":"വിസ്തീർണം പൈ ഗുണം r വർഗം ആണ്."}},{"op":"formula","what":"circumference","say":{"en":"Its circumference is two pi r.","ml":"ചുറ്റളവ് രണ്ട് പൈ r ആണ്."}}]}',
  },
  {
    id: 'venn-sets',
    name: 'Sets and Venn diagrams',
    description:
      'The universal set is a rectangle with two or three overlapping circles A, B, C. The region of each set expression fills in colour with the expression written beneath: A ∩ B (both), A ∪ B (either), Aᶜ (outside A), A − B, De Morgan (Aᶜ ∪ Bᶜ = (A ∩ B)ᶜ). With elements the regions hold numbers or words and the app writes the lists and counts n(A ∪ B) = n(A) + n(B) − n(A ∩ B). The app decides which regions an expression is and rejects false identities. Use for sets: union, intersection, complement, difference, subsets, universal set, Venn diagrams.',
    kinds: ['prose', 'problem', 'exercise', 'result', 'aside'],
    score: (f) => (f.sets ? (/\bvenn\b|[∪∩]|universal set|de morgan/i.test(f.text) ? clamp(0.93 + 0.01 * (f.setHits - 1)) : 0.85) : 0),
    planShape:
      '{"title":{"en":"","ml":""},"sets":2,"labels":[{"en":"Tea","ml":"ചായ"},{"en":"Coffee","ml":"കാപ്പി"}],"elements":[[1,2,3,4],[3,4,5]],"outside":[6],"steps":[{"op":"show","say":{"en":"","ml":""}},{"op":"shade","expr":"A∩B","say":{}},{"op":"shade","expr":"A∪B","say":{}},{"op":"shade","expr":"A\'","say":{}},{"op":"shade","expr":"A−B","say":{}},{"op":"identity","left":"A\'∪B\'","right":"(A∩B)\'","say":{}},{"op":"list","expr":"A∩B","say":{}},{"op":"inclusion","say":{}},{"op":"clear","say":{}}]}  (sets 2 or 3, letters A B C; expressions use ∪ ∩ − and a trailing \' for the complement; mixing different operators needs brackets; "elements" and "outside" are optional, numbers or words ≤ 6 characters, at most 6 per region; "list" and "inclusion" need elements, "inclusion" needs 2 sets; "identity" must be a TRUE identity, the app checks it; the app draws, shades, writes every expression, list and count)',
    example:
      '{"sets":2,"steps":[{"op":"show","say":{"en":"The rectangle is the universal set. A and B are two sets inside it.","ml":"ചതുരം സാർവിക ഗണമാണ്. അതിനുള്ളിലെ രണ്ട് ഗണങ്ങളാണ് A-യും B-യും."}},{"op":"shade","expr":"A∩B","say":{"en":"What lies in both A and B is the intersection.","ml":"A-യിലും B-യിലും ഉള്ളത് ഛേദം."}},{"op":"shade","expr":"A∪B","say":{"en":"What lies in A or B or both is the union.","ml":"A-യിലോ B-യിലോ രണ്ടിലുമോ ഉള്ളത് യോഗം."}}]}',
  },
  {
    id: 'unit-circle',
    name: 'Trigonometric ratios on the unit circle',
    description:
      'Axes and a circle of radius 1; a point (x, y) at angle θ with its right triangle; each ratio appears as a coloured SEGMENT labelled along it (cos and sin are the legs; tan and cot are the two pieces of the tangent line at the point; sec and csc reach the axes) with its formula in the same colour; the point can slide to a new angle while the segments follow; values (exact for 30°, 45°, 60°) and the Pythagorean identities close it. The app computes every length and value. Use for sine, cosine, tangent and their reciprocals, trigonometric ratios, the unit circle.',
    kinds: ['prose', 'problem', 'exercise', 'result', 'aside'],
    score: (f) => (f.trig ? (/trigonometr|\bunit circle\b|\b(sine|cosine|tangent|cosecant|secant|cotangent)\b/i.test(f.text) ? clamp(0.95 + 0.01 * (f.trigHits - 1)) : 0.88) : 0),
    planShape:
      '{"title":{"en":"","ml":""},"angle":30,"steps":[{"op":"show","say":{"en":"","ml":""}},{"op":"point","say":{}},{"op":"legs","say":{}},{"op":"ratio","which":"cos","say":{}},{"op":"ratio","which":"sin","say":{}},{"op":"ratio","which":"tan","say":{}},{"op":"ratio","which":"cot","say":{}},{"op":"ratio","which":"sec","say":{}},{"op":"ratio","which":"csc","say":{}},{"op":"sweep","to":60,"say":{}},{"op":"values","say":{}},{"op":"identity","which":"pythagorean","say":{}},{"op":"box","say":{}}]}  (angle and every sweep target: whole degrees 20–70, keep 30–60 when sec and csc are drawn so the circle stays readable; ratio.which: cos | sin | tan | cot | sec | csc, each once, after "legs"; identity.which: pythagorean | tan-sec | cot-csc; the app draws every segment from the geometry, so each drawn length IS its ratio, writes every formula and value, and checks the identities)',
    example:
      '{"angle":30,"steps":[{"op":"show","say":{"en":"This circle has radius 1.","ml":"ഈ വൃത്തത്തിന്റെ ആരം 1 ആണ്."}},{"op":"point","say":{"en":"Pick a point on it at angle theta. Its coordinates are x and y.","ml":"θ കോണിൽ അതിലൊരു ബിന്ദു എടുക്കുക. അതിന്റെ നിർദേശാങ്കങ്ങൾ x, y."}},{"op":"legs","say":{"en":"Drop a line to the axis: a right triangle with legs x and y.","ml":"അക്ഷത്തിലേക്ക് ഒരു വര: x, y വശങ്ങളുള്ള മട്ടത്രികോണം."}},{"op":"ratio","which":"cos","say":{"en":"Cosine is the horizontal leg, x.","ml":"കോസൈൻ എന്നാൽ തിരശ്ചീന വശം x ആണ്."}},{"op":"ratio","which":"sin","say":{"en":"Sine is the vertical leg, y.","ml":"സൈൻ എന്നാൽ ലംബ വശം y ആണ്."}}]}',
  },
  {
    id: 'linear-system',
    name: 'Pair of linear equations: lines, elimination, substitution',
    description:
      'Two equations a x + b y = c are written in two colours, drawn as two lines on a plane that meet at the solution, solved by elimination (multiplied to equal coefficients, then added or subtracted) or by substitution, checked in both equations, and written in matrix form A · x = b with the coefficients flying into the matrix. The app computes every line it writes. Use for pairs of linear equations in two variables, simultaneous equations, the graphical, elimination and substitution methods.',
    kinds: ['prose', 'problem', 'exercise', 'result', 'aside', 'math'],
    score: (f) => (f.linear ? (f.linearHits >= 2 ? clamp(0.95 + 0.01 * (f.linearHits - 2)) : 0.84) : 0),
    planShape:
      '{"title":{"en":"","ml":""},"e1":{"a":2,"b":1,"c":7},"e2":{"a":1,"b":-1,"c":2},"steps":[{"op":"show","say":{"en":"","ml":""}},{"op":"graph","say":{}},{"op":"meet","say":{}},{"op":"eliminate","var":"y","say":{}},{"op":"substitute","into":1,"say":{}},{"op":"check","say":{}},{"op":"matrix","say":{}}]}  (e1 and e2 are a x + b y = c with whole numbers: a and b non-zero from −9 to 9, c from −60 to 60; the system must have ONE solution that is a pair of whole numbers between −6 and 6 – not parallel lines, not the same line; "eliminate".var is the unknown to remove (x or y) and finds the other; "substitute" (into 1 or 2) needs exactly one "eliminate" before it; "check" needs both unknowns found; "meet" needs "graph"; the app multiplies, adds or subtracts, substitutes, draws and writes every line and number – do not write equations or numbers in "say" that the board does not show)',
    example:
      '{"e1":{"a":2,"b":1,"c":7},"e2":{"a":1,"b":-1,"c":2},"steps":[{"op":"show","say":{"en":"Here are two equations with the same two unknowns, x and y.","ml":"x, y എന്നീ ഒരേ രണ്ട് അജ്ഞാതങ്ങളുള്ള രണ്ട് സമവാക്യങ്ങൾ."}},{"op":"graph","say":{"en":"Each equation is a straight line. A solution must lie on both lines.","ml":"ഓരോ സമവാക്യവും ഒരു നേർരേഖയാണ്. ഉത്തരം രണ്ട് രേഖയിലും ആയിരിക്കണം."}},{"op":"meet","say":{"en":"The lines meet at one point. Its coordinates are the solution.","ml":"രേഖകൾ ഒരു ബിന്ദുവിൽ കൂടിമുട്ടുന്നു. അതിന്റെ നിർദേശാങ്കങ്ങളാണ് ഉത്തരം."}}]}',
  },
  {
    id: 'arithmetic-sequence',
    name: 'Arithmetic sequence: terms, common difference, n-th term, sum, graph',
    description:
      'The first terms in boxes; an arrow from each term to the next carrying the common difference; the n-th term formula x_n = a + (n − 1)d with the numbers and simplified; a far term worked out; the sum of the first n terms by formula and by Gauss pairing; "is this number a term?" solved with a tick or a cross; the points (n, x_n) on a plane lying on a straight line. The app computes every number. Use for arithmetic sequences / progressions, common difference, the n-th term, the sum of the first n terms.',
    kinds: ['prose', 'problem', 'exercise', 'result', 'aside', 'math'],
    score: (f) => (f.seq ? (f.seqHits >= 2 ? clamp(0.94 + 0.01 * (f.seqHits - 2)) : 0.85) : 0),
    planShape:
      '{"title":{"en":"","ml":""},"a":3,"d":4,"terms":6,"steps":[{"op":"show","say":{"en":"","ml":""}},{"op":"diff","say":{}},{"op":"pairs","say":{}},{"op":"formula","say":{}},{"op":"term","n":20,"say":{}},{"op":"test","value":99,"say":{}},{"op":"sum","n":20,"say":{}},{"op":"graph","say":{}}]}  (a: first term, whole number −50..50; d: common difference, non-zero whole number −12..12; terms: how many terms the row shows, 4..7; "pairs" needs an EVEN number of terms and must come before "formula" and "graph"; "term".n is a term NOT in the row (terms+1 .. 100) and needs "formula"; "sum".n 2..100; "test".value is any whole number −999..999 and needs "formula" – the app solves n − 1 = (value − a) ÷ d and ticks or crosses; the app computes and writes every term, formula, sum and line – do not write numbers in "say" that the board does not show)',
    example:
      '{"a":3,"d":4,"terms":6,"steps":[{"op":"show","say":{"en":"Here is a list of numbers: 3, 7, 11, 15, 19, 23.","ml":"ഇതാ ഒരു സംഖ്യാപട്ടിക: 3, 7, 11, 15, 19, 23."}},{"op":"diff","say":{"en":"Each term is the one before it plus the same number. That number is the common difference.","ml":"ഓരോ പദവും തൊട്ടു മുമ്പത്തേതിനോട് ഒരേ സംഖ്യ കൂട്ടിയതാണ്. ആ സംഖ്യയാണ് പൊതുവ്യത്യാസം."}},{"op":"formula","say":{"en":"So the n-th term is the first term plus n minus 1 differences.","ml":"അതിനാൽ n-ാം പദം ആദ്യപദത്തോട് n − 1 വ്യത്യാസങ്ങൾ കൂട്ടിയതാണ്."}}]}',
  },
  {
    id: 'quadratic-equation',
    name: 'Quadratic equation: parabola, discriminant, factorising, formula, roots',
    description:
      'The equation a x² + b x + c = 0 and its parabola on a plane; the discriminant D = b² − 4ac with D > 0, D = 0 or D < 0; factorising by splitting the middle term and grouping, giving two linear factors; the quadratic formula worked out; the roots marked where the curve meets the x-axis; each whole-number root checked in the equation. The app computes every line. Use for quadratic / second degree equations, factorising x² + bx + c, roots, discriminant, the quadratic formula.',
    kinds: ['prose', 'problem', 'exercise', 'result', 'aside', 'math'],
    score: (f) => (f.quad && !f.qdv && !f.hl ? (f.quadHits >= 2 ? clamp(0.94 + 0.01 * (f.quadHits - 2)) : 0.85) : 0),
    planShape:
      '{"title":{"en":"","ml":""},"a":1,"b":-5,"c":6,"steps":[{"op":"show","say":{"en":"","ml":""}},{"op":"graph","say":{}},{"op":"discriminant","say":{}},{"op":"factorise","say":{}},{"op":"roots","say":{}},{"op":"check","say":{}}]}  (the equation is a x² + b x + c = 0 with whole numbers: a non-zero −6..6, b −20..20, c −36..36; "factorise" and "roots" need a discriminant that is a perfect square (the app computes D and refuses them otherwise); "formula" works for any D (D < 0 stops at "D < 0": no real roots; a D that is not a perfect square ends with ± √D); "roots" needs "graph"; "check" needs whole-number roots; each step at most once; the app computes and writes every line, root and the curve – do not write numbers in "say" that the board does not show)',
    example:
      '{"a":1,"b":-5,"c":6,"steps":[{"op":"show","say":{"en":"Here is a quadratic equation.","ml":"ഇതാ ഒരു ദ്വിമാന സമവാക്യം."}},{"op":"graph","say":{"en":"Its graph is a parabola. The solutions are where it meets the x-axis.","ml":"ഇതിന്റെ ഗ്രാഫ് ഒരു പരാബോളയാണ്. x-അക്ഷത്തെ തൊടുന്നിടങ്ങളാണ് ഉത്തരങ്ങൾ."}},{"op":"factorise","say":{"en":"Split the middle term, group, and the equation becomes a product equal to zero.","ml":"മധ്യപദത്തെ വിഭജിച്ച് ഗ്രൂപ്പ് ചെയ്താൽ ഗുണനഫലം പൂജ്യമാകുന്ന സമവാക്യം കിട്ടും."}}]}',
  },
  {
    id: 'polynomial',
    name: 'Polynomial: terms, add, multiply, divide, remainder and factor theorems, identities, graph',
    description:
      'A polynomial P(x) with its degree and coefficients; addition and subtraction in aligned columns; multiplication in an area table where like terms share a colour; long division by x − r; the remainder theorem P(r); the factor theorem (P(r) = 0 so x − r is a factor) with every factor; the identities x² − k² = (x − k)(x + k) and (x ± k)² with an area picture and a check; the curve with whole-number roots marked on the x-axis. The app computes every line. Use for polynomials, degree, coefficients, adding, multiplying and dividing polynomials, the remainder theorem, the factor theorem, factorising a cubic.',
    kinds: ['prose', 'problem', 'exercise', 'result', 'aside', 'math'],
    score: (f) => (f.poly ? clamp(0.93 + 0.01 * (f.polyHits - 2)) : 0),
    planShape:
      '{"title":{"en":"","ml":""},"p":[1,-4,1,6],"q":[1,2],"r":2,"steps":[{"op":"show","say":{"en":"","ml":""}},{"op":"add","say":{}},{"op":"subtract","say":{}},{"op":"multiply","say":{}},{"op":"divide","say":{}},{"op":"remainder","say":{}},{"op":"factor","at":2,"say":{}},{"op":"identity","say":{}},{"op":"graph","say":{}},{"op":"roots","say":{}}]}  (p = coefficients of P(x), highest power first, whole numbers −12..12, degree 2 to 4; q = second polynomial for add / subtract / multiply (degree 1 to 3, coefficients −9..9, at most 3 non-zero terms in p and q for multiply); r = the divisor is x − r (non-zero whole number −9..9) for divide and remainder; "divide" needs degree 2 or 3; "factor" needs P to start with 1 and factorise completely into (x − r) factors with whole r, and "at" must be one of the roots; "identity" needs P to be x² − k², x² + 2kx + k² or x² − 2kx + k²; "roots" needs "graph"; each step at most once; the app computes and writes every line – do not write numbers in "say" that the board does not show)',
    example:
      '{"p":[1,-4,1,6],"r":2,"steps":[{"op":"show","say":{"en":"Here is a polynomial of degree 3.","ml":"ഇതാ മൂന്നാം കൃതിയുള്ള ഒരു ബഹുപദം."}},{"op":"remainder","say":{"en":"Put x equal to 2. The value P of 2 is the remainder when we divide by x minus 2.","ml":"x = 2 എടുക്കുക. P(2) ആണ് x − 2 കൊണ്ട് ഹരിക്കുമ്പോഴുള്ള ശിഷ്ടം."}},{"op":"factor","at":2,"say":{"en":"The value is zero, so x minus 2 is a factor. Divide it out and factorise the rest.","ml":"വില പൂജ്യമാണ്, അതിനാൽ x − 2 ഒരു ഘടകമാണ്. അത് ഹരിച്ച് ബാക്കി ഘടകങ്ങളാക്കുക."}},{"op":"graph","say":{"en":"The curve crosses the x-axis at the three roots.","ml":"വക്രം മൂന്ന് മൂലങ്ങളിലും x-അക്ഷത്തെ മുറിച്ച് കടക്കുന്നു."}}]}',
  },
  {
    id: 'angle-geometry',
    name: 'Angles: parallel lines and a transversal, triangle angle sum, circle theorems',
    description:
      'Three drawn figures with angles shown as arcs and written in degrees. (1) Two parallel lines cut by a transversal: one angle is given, then its vertically opposite angle (equal), linear pair (adds to 180°), corresponding angle (equal), alternate angle (equal) and co-interior angle (adds to 180°) are marked in turn. (2) A triangle: two angles given, the third found from 180°, the angle sum written, the exterior angle shown equal to the two interior opposite angles. (3) A circle: the angle at the centre is twice the angle at the circumference on the same arc, a second point on that arc sees the same angle, an angle in a semicircle is 90°, opposite angles of a cyclic quadrilateral add to 180°. The app computes every angle and point. Use for parallel lines, transversal, corresponding / alternate / co-interior / vertically opposite angles, linear pair, angle sum and exterior angle of a triangle, angle at the centre, angle in a semicircle, cyclic quadrilateral.',
    kinds: ['prose', 'problem', 'exercise', 'result', 'aside', 'math'],
    score: (f) => (f.angle ? clamp(0.94 + 0.01 * (f.angleHits - 2)) : 0),
    planShape:
      '{"title":{"en":"","ml":""},"figure":"parallel","a":70,"at":"tr","steps":[{"op":"show","say":{"en":"","ml":""}},{"op":"given","say":{}},{"op":"vertical","say":{}},{"op":"linear","say":{}},{"op":"corresponding","say":{}},{"op":"alternate","say":{}},{"op":"cointerior","say":{}}]}  or  {"figure":"triangle","A":50,"B":60,"steps":[{"op":"show","say":{}},{"op":"angles","say":{}},{"op":"find","say":{}},{"op":"sum","say":{}},{"op":"exterior","say":{}}]}  or  {"figure":"circle","beta":40,"steps":[{"op":"show","say":{}},{"op":"centre","say":{}},{"op":"circumference","say":{}},{"op":"double","say":{}},{"op":"same-arc","say":{}},{"op":"cyclic","say":{}}]}  (parallel: a = the given angle in whole degrees 30–150 except 90, at = where it is: tl tr bl br (top line) or tl2 tr2 bl2 br2 (bottom line), default tr; the other steps work out the related angle from it; triangle: A and B in whole degrees 20–120 with A + B from 60 to 160, "find" before "sum" and "exterior" when used; circle: beta = the angle at the circumference, whole degrees 20–90 (90 is the angle in a semicircle), "double" needs "centre" and "circumference", "same-arc" and "cyclic" need "circumference"; show once first, each step at most once; the app computes and writes every angle, line and point – do not write angle values in "say" that the board does not show)',
    example:
      '{"figure":"parallel","a":70,"steps":[{"op":"show","say":{"en":"Two parallel lines are cut by a third line, a transversal.","ml":"രണ്ട് സമാന്തര രേഖകളെ മൂന്നാമതൊരു രേഖ, ഛേദകരേഖ, മുറിക്കുന്നു."}},{"op":"given","say":{"en":"One angle is 70 degrees.","ml":"ഒരു കോൺ 70° ആണ്."}},{"op":"alternate","say":{"en":"The alternate angle is equal.","ml":"ഏകാന്തര കോൺ തുല്യമാണ്."}}]}',
  },
  {
    id: 'solid-figure',
    name: 'Solids: cuboid, prism, cylinder, cone, sphere – volume and surface area',
    description:
      'A solid is drawn in 3-D (hidden edges dashed) with its sizes written in the colour of the letter that names them. The base is shaded and its area worked out (cuboid l × w, triangular prism the triangle, cylinder and cone the circle). The slant height of a cone or the third side of the prism triangle comes from Pythagoras. The volume is written line by line (base × height; cone one third; sphere four thirds π r cubed) with the decimal for π values. The surface opens into a flat net – six rectangles, two triangles and three rectangles, two circles and a rectangle, a circle and a sector – with the area of every piece, and the total surface area is the sum; for the sphere four great circles show 4 π r squared. The app computes every length, area, volume and point. Use for the volume, capacity, surface area, curved surface area and total surface area of a cuboid, cube, triangular prism, cylinder, cone or sphere, slant height and nets.',
    kinds: ['prose', 'problem', 'exercise', 'result', 'aside', 'math'],
    score: (f) => (f.solid ? clamp(0.94 + 0.01 * (f.solidHits - 2)) : 0),
    planShape:
      '{"title":{"en":"","ml":""},"solid":"cylinder","r":3,"h":7,"unit":"cm","steps":[{"op":"show","say":{"en":"","ml":""}},{"op":"base","say":{}},{"op":"volume","say":{}},{"op":"net","say":{}},{"op":"surface","say":{}}]}  (solid: cuboid with a = length, b = width, h = height, each 2–20 and the biggest at most 4 times the smallest; prism = right triangular prism with legs a, b (3–24, the third side must be a whole number: 3-4-5, 5-12-13, 6-8-10, 8-15-17, 9-12-15, 7-24-25) and length h 2–20; cylinder with r 1–14, h 2–30; cone with r and h 1–24 whose slant height is a whole number (3 and 4, 6 and 8, 5 and 12, 8 and 15, 9 and 12, 7 and 24); sphere with r 1–15; unit cm, m or mm. Steps: show once first; base (not for the sphere), slant (cone and prism only, before net and surface), volume, net (not for the sphere), surface; base, slant and volume come before net, net before surface; each step at most once; the app computes and writes every number – do not write sizes or results in "say" that the board does not show)',
    example:
      '{"solid":"cone","r":3,"h":4,"steps":[{"op":"show","say":{"en":"This is a cone with radius 3 and height 4.","ml":"ആരം 3, ഉയരം 4 ഉള്ള ഒരു സ്തൂപികയാണിത്."}},{"op":"slant","say":{"en":"The slant height comes from Pythagoras.","ml":"ചരിവുയരം പൈതഗോറസിൽ നിന്ന് കിട്ടും."}},{"op":"volume","say":{"en":"The volume is one third of the cylinder with the same base and height.","ml":"വ്യാപ്തം അതേ പാദവും ഉയരവുമുള്ള സിലിണ്ടറിന്റെ മൂന്നിലൊന്നാണ്."}},{"op":"net","say":{"en":"Open the surface: a circle and a sector.","ml":"പ്രതലം നിവർത്തുക: ഒരു വൃത്തവും ഒരു വൃത്താംശവും."}},{"op":"surface","say":{"en":"Add the two areas.","ml":"രണ്ട് പരപ്പളവുകൾ കൂട്ടുക."}}]}',
  },
  {
    id: 'ratio-percent',
    name: 'Ratio and percent: bar models for sharing, percent of a quantity, increase and decrease',
    description:
      'A bar model. (1) Sharing a quantity in a ratio such as 3 : 5: the bar in as many equal blocks as there are parts, coloured by person, the total above; one block is the total divided by the number of parts; each person gets their number of blocks times that; the parts add back to the total. (2) A percentage of a quantity: the bar in ten equal tenths labelled 10%, 20% … 100%, each tenth worth a tenth of the whole, p% shaded and its value worked out as p over 100 times the whole. (3) A percentage increase or decrease: the original bar, the extra or removed piece worth p% of it, and the new amount. The app computes every value and block. Use for ratio, sharing in a ratio, proportion by blocks, percentage, per cent, percent of a number, increase or decrease by a percent, discount.',
    kinds: ['prose', 'problem', 'exercise', 'result', 'aside', 'math'],
    score: (f) => (f.ratio ? clamp(0.94 + 0.01 * (f.ratioHits - 2)) : 0),
    planShape:
      '{"title":{"en":"","ml":""},"kind":"share","parts":[3,5],"total":240,"unit":"Rs","steps":[{"op":"show","say":{"en":"","ml":""}},{"op":"unit","say":{}},{"op":"parts","say":{}},{"op":"check","say":{}}]}  or  {"kind":"percent","whole":250,"pct":12,"steps":[{"op":"show","say":{}},{"op":"tenth","say":{}},{"op":"part","say":{}},{"op":"result","say":{}}]}  or  {"kind":"change","whole":250,"pct":20,"dir":"up","steps":[{"op":"show","say":{}},{"op":"change","say":{}},{"op":"result","say":{}}]}  (share: parts = 2 or 3 whole numbers 1–9 adding to at most 20, total a multiple of their sum; percent and change: whole 10–5000 and pct a whole number 1–100 (change down: 1–90) such that pct × whole is a multiple of 100; dir up or down; unit Rs, kg, m, cm, km or l; steps: show once first; share: unit, parts, check (unit before parts, parts before check); percent: tenth, part, result (part before result); change: change, result (change before result); each step at most once; the app computes and writes every number – do not write numbers in "say" that the board does not show)',
    example:
      '{"kind":"share","parts":[3,5],"total":240,"steps":[{"op":"show","say":{"en":"240 is shared in the ratio 3 to 5. The bar has 3 blocks for A and 5 for B.","ml":"240 എന്നത് 3 : 5 എന്ന അംശബന്ധത്തിൽ പങ്കിടുന്നു. A-ക്ക് 3 കട്ടയും B-ക്ക് 5 കട്ടയും."}},{"op":"unit","say":{"en":"All 8 blocks are worth 240, so one block is 240 divided by 8.","ml":"8 കട്ടകൾക്കും കൂടി 240 ആണ്, അതിനാൽ ഒരു കട്ട 240 ÷ 8."}},{"op":"parts","say":{"en":"A has 3 blocks and B has 5 blocks.","ml":"A-ക്ക് 3 കട്ടയും B-ക്ക് 5 കട്ടയും."}}]}',
  },
  {
    id: 'pie-chart',
    name: 'Pie chart: data, total, central angles, percentages',
    description:
      'A pie chart built from data. The categories and their values are listed beside a circle; the total is written; each central angle is value over total times 360 degrees and its sector is drawn in turn, clockwise from the top, in its own colour with the angle written outside; each share is written as a percentage; the angles are checked to make 360 degrees. The app computes every angle and percentage. Use for drawing or reading a pie chart, pie diagram or circle graph, and for turning data into angles.',
    kinds: ['prose', 'problem', 'exercise', 'result', 'aside', 'math'],
    score: (f) => (f.pie ? clamp(0.94 + 0.01 * (f.pieHits - 2)) : 0),
    planShape:
      '{"title":{"en":"","ml":""},"labels":["Maths","Art","Music"],"values":[30,50,40],"steps":[{"op":"show","say":{"en":"","ml":""}},{"op":"total","say":{}},{"op":"angle","say":{}},{"op":"percent","say":{}},{"op":"check","say":{}}]}  (values: 2 to 6 whole numbers; every angle 360 × value ÷ total must be a whole number of at least 15°, so choose a total that divides 360 × every value, such as 36, 40, 45, 60, 72, 90, 120, 180, 360; labels optional, 1–10 characters each and the same in both languages, default A, B, C …; steps: show once first, then total, angle, percent, check, each at most once, percent and check after angle; the app computes and writes every angle and percentage – do not write numbers in "say" that the board does not show)',
    example:
      '{"labels":["Maths","Art","Music"],"values":[30,50,40],"steps":[{"op":"show","say":{"en":"A class of 120 students chose a favourite subject. Here is the data.","ml":"120 കുട്ടികൾ ഇഷ്ടപ്പെട്ട വിഷയം തിരഞ്ഞെടുത്തു. ഇതാ വിവരങ്ങൾ."}},{"op":"total","say":{"en":"Add the values to get the total.","ml":"മൂല്യങ്ങൾ കൂട്ടി ആകെ കണ്ടെത്തുക."}},{"op":"angle","say":{"en":"Each sector is its share of 360 degrees.","ml":"ഓരോ സെക്ടറും 360° യുടെ അതിന്റെ പങ്കാണ്."}}]}',
  },
  {
    id: 'coordinate-geometry',
    name: 'Coordinate geometry: points and quadrants, distance, midpoint',
    description:
      'A coordinate plane with its axes, numbers and grid. (1) Points: each point (x, y) is plotted with dashed lines to the two axes, its coordinates written, and the quadrants I to IV named for every point (or the axis it lies on). (2) Distance between two points: the segment joining them, the horizontal and vertical legs of the right triangle on the grid with dx and dy worked out, then d squared equals dx squared plus dy squared and the distance (a whole number or a square root with its decimal). (3) Midpoint: the segment with equal marks on its two halves, the midpoint M with dashed lines to the axes, and each coordinate written as the sum divided by two. The app computes every position and number. Use for plotting points, ordered pairs, quadrants, the distance between two points, the distance formula, the midpoint of a segment.',
    kinds: ['prose', 'problem', 'exercise', 'result', 'aside', 'math'],
    score: (f) => (f.coord ? clamp(0.94 + 0.01 * (f.coordHits - 3)) : 0),
    planShape:
      '{"title":{"en":"","ml":""},"kind":"distance","points":[[1,2],[5,5]],"names":["A","B"],"steps":[{"op":"axes","say":{"en":"","ml":""}},{"op":"plot","say":{}},{"op":"segment","say":{}},{"op":"legs","say":{}},{"op":"formula","say":{}}]}  (every coordinate a whole number from −6 to 6; kind "points": 1–4 different points, steps axes first, then one "plot" per point with "i" (0-based, each once), then optionally quadrant; kind "distance": exactly 2 points differing in both x and y, steps axes, plot (both points at once, no i), segment, legs, formula; kind "midpoint": exactly 2 points, steps axes, plot, segment, midpoint; optional "names": one capital letter per point, all different, never "M" for a midpoint plan; each step at most once, axes first; the app computes and writes every coordinate, difference, distance and midpoint – do not write numbers in "say" that the board does not show)',
    example:
      '{"kind":"midpoint","points":[[1,2],[5,8]],"steps":[{"op":"axes","say":{"en":"A coordinate plane.","ml":"ഒരു കോ-ഓർഡിനേറ്റ് തലം."}},{"op":"plot","say":{"en":"Plot the two points A and B.","ml":"A, B എന്നീ രണ്ട് ബിന്ദുക്കൾ അടയാളപ്പെടുത്തുക."}},{"op":"segment","say":{"en":"Join them with a line segment.","ml":"അവയെ ഒരു രേഖാഖണ്ഡം കൊണ്ട് യോജിപ്പിക്കുക."}},{"op":"midpoint","say":{"en":"The midpoint has the average x and the average y.","ml":"മധ്യബിന്ദുവിന്റെ x, y എന്നിവ ശരാശരികളാണ്."}}]}',
  },
  {
    id: 'square-identity',
    name: 'Visual proofs of (a + b)², (a − b)² and (a + b)(a − b)',
    description:
      'An algebraic identity proved with areas. (1) (a + b)²: a square of side a + b with its sides braced; a corner square a², two strips a × b and a square b² are fitted in and named, then (a + b)² = a² + ab + ab + b² is written term by term, each term lighting its tile, and checked with numbers. (2) (a − b)²: a square of side a; two strips of width b are taken away along the right and the bottom, the corner b × b that was taken twice is put back, so (a − b)² = a² − 2ab + b². (3) (a + b)(a − b) = a² − b²: a square with a b × b square cut from a corner, the L cut into two rectangles, one turned and slid beside the other to make a rectangle (a + b) by (a − b). The sides a and b are whole numbers; the app draws every tile, brace and label and writes every number.',
    kinds: ['prose', 'problem', 'exercise', 'result', 'aside', 'math'],
    score: (f) => (f.sqid ? clamp(0.94 + 0.01 * (f.sqidHits - 2)) : 0),
    planShape:
      '{"title":{"en":"","ml":""},"kind":"sum","a":3,"b":2,"steps":[{"op":"square","say":{"en":"","ml":""}},{"op":"tileA","say":{}},{"op":"strips","say":{}},{"op":"tileB","say":{}},{"op":"name","say":{}},{"op":"build","say":{}},{"op":"check","say":{}}]}  (kind "sum": a and b whole numbers, different, a + b at most 12; steps square first, tileA, strips, tileB in any order after it, then name (after all three), build (after name), check (after build). Kind "difference": a 2–12, b 1 to a − 1; steps square, strips, corner, name, build, check in that order (each needs the one before). Kind "product" for (a + b)(a − b) = a² − b²: a + b at most 12, b below a; steps square, remove, cut, move, name, build, check in that order. Each step at most once, square first; the app draws the tiles, braces, labels and writes every term and number.)',
    example:
      '{"kind":"difference","a":5,"b":2,"steps":[{"op":"square","say":{"en":"A square of side a. Its area is a squared.","ml":"a വശമുള്ള ഒരു സമചതുരം. അതിന്റെ പരപ്പളവ് a² ആണ്."}},{"op":"strips","say":{"en":"Take away two strips of width b.","ml":"b വീതിയുള്ള രണ്ട് പട്ടകൾ മാറ്റുക."}},{"op":"corner","say":{"en":"The corner b by b was taken twice, so put it back once.","ml":"മൂലയിലെ b × b രണ്ടുതവണ മാറ്റപ്പെട്ടു; ഒരു തവണ തിരികെ ചേർക്കുക."}},{"op":"name","say":{"en":"What is left is the square of side a minus b.","ml":"ബാക്കിയാകുന്നത് (a − b) വശമുള്ള സമചതുരം."}},{"op":"build","say":{"en":"So a minus b, squared, is a squared minus 2ab plus b squared.","ml":"അതിനാൽ (a − b)² = a² − 2ab + b²."}}]}',
  },
  {
    id: 'balance-scale',
    name: 'Balance scale: one- and two-step linear equations',
    description:
      'A level scale with tiles. The left pan holds a tiles of x and a tile for b, the right pan a tile for c, and the equation a x + b = c is written beside it in the same colours. The b tile is moved to the other pan (its sign changes) and c − b is written; the right pan is merged into one tile; it is split into a equal tiles, one for each x, with "÷ a on both sides"; one x is left balanced against its value; the check puts the value back (a × value + b = c) with a tick. Use for a single equation with one unknown such as 2x + 5 = 25, x − 3 = 9, 4x = 28 or 2x − 10 = 100 (whole answer 1–100), and for x on both sides such as 3x + 2 = x + 10 (the same x tiles come off both pans first). Not for two unknowns, x², fractions or variables on both sides.',
    kinds: ['prose', 'problem', 'exercise', 'result', 'aside', 'math'],
    score: (f) => (f.bal ? (f.wordProblem && f.kind !== 'math' ? 0.7 : clamp(0.95 + 0.01 * (f.balHits - 2))) : 0),
    planShape:
      '{"title":{"en":"","ml":""},"a":2,"b":5,"c":25,"steps":[{"op":"show","say":{"en":"","ml":""}},{"op":"move","say":{}},{"op":"simplify","say":{}},{"op":"divide","say":{}},{"op":"answer","say":{}},{"op":"check","say":{}}]}  (a = number of x tiles 1–4; b from −12 to 12, 0 for a x = c; c − b must be a multiple of a and the answer 1–100; b = 0 has no move/simplify, a = 1 has no divide/answer; letter optional; x on both sides: add "d" (x tiles on the right pan, 1 to a − 1) and a "cancel" step right after show, then c − b must be a multiple of a − d)',
    example:
      '{"a":2,"b":5,"c":25,"steps":[{"op":"show","say":{"en":"Here is the scale. Both pans weigh the same.","ml":"ഇതാ ത്രാസ്. രണ്ട് തട്ടിനും ഒരേ ഭാരം."}},{"op":"move","say":{"en":"Take 5 from both pans.","ml":"രണ്ട് തട്ടിൽനിന്നും 5 എടുക്കുക."}},{"op":"simplify","say":{"en":"25 minus 5 is 20.","ml":"25 − 5 = 20."}},{"op":"divide","say":{"en":"Share 20 between the 2 x tiles.","ml":"20 രണ്ട് x-കൾക്കായി പങ്കിടുക."}},{"op":"answer","say":{"en":"One x is 10.","ml":"ഒരു x = 10."}},{"op":"check","say":{"en":"2 times 10 plus 5 is 25. It balances.","ml":"2 × 10 + 5 = 25. തുല്യമാണ്."}}]}',
  },
  {
    id: 'balance-pair',
    name: 'Pair of equations on two balance scales: add or subtract so one unknown cancels',
    description:
      'Two scales, one for each equation a x + b y = c: the x tiles and the y tiles (a hollow tile when y is taken away) on the left pan, the total on the right, and both equations written in colour. The two scales are put together, added or subtracted, so the tiles of one unknown cancel and one scale is left; it is solved by sharing the total between the tiles; the value is put back into an equation, the number tile comes off both pans and the other unknown is found; both scales are checked with the answers (ticks). The app computes every tile, every number and every line. Use for a pair of linear equations in two unknowns where the x coefficients are equal or the y coefficients are equal or opposite, such as x + y = 100 with x − y = 10, or x + y = 11000 with 4x + y = 14000 (whole answers). Not for a pair that needs one equation multiplied first, graphs, or matrices (use the pair-of-linear-equations lesson).',
    kinds: ['prose', 'problem', 'exercise', 'result', 'aside', 'math'],
    score: (f) => (f.pairBal ? clamp(Math.max(0.97, (f.linear ? (f.linearHits >= 2 ? 0.95 + 0.01 * (f.linearHits - 2) : 0.84) : 0) + 0.01)) : 0),
    planShape:
      '{"title":{"en":"","ml":""},"e1":{"a":1,"b":1,"c":100},"e2":{"a":1,"b":-1,"c":10},"steps":[{"op":"show","say":{"en":"","ml":""}},{"op":"combine","say":{}},{"op":"solve","say":{}},{"op":"back","say":{}},{"op":"check","say":{}}]}  (each equation is a x + b y = c: a 1–4 x tiles, b from −3 to 3 but not 0 (negative = y taken away), c a whole number; x and y must be whole numbers from 1 to 99999; one add or subtract must remove an unknown: the two a equal, or the two b equal or opposite; at least one b must be positive; steps exactly show, combine, solve, back, check; letters optional, two different letters, default x and y; the app draws both scales, cancels the tiles, solves and writes every line – do not write numbers in "say" that the board does not show)',
    example:
      '{"e1":{"a":1,"b":1,"c":100},"e2":{"a":1,"b":-1,"c":10},"steps":[{"op":"show","say":{"en":"Each equation is a scale that balances. The first has x and y against 100. The second has x, and y taken away, against 10.","ml":"ഓരോ സമവാക്യവും തുല്യമായി നിൽക്കുന്ന ഓരോ ത്രാസ്. ആദ്യത്തേതിൽ x, y എന്നിവ 100-നൊപ്പം. രണ്ടാമത്തേതിൽ x-ഉം y കുറച്ചതും 10-നൊപ്പം."}},{"op":"combine","say":{"en":"Put the two scales together. The y and the minus y cancel. What is left is two x against 110.","ml":"രണ്ട് ത്രാസുകളും ചേർക്കുക. y-ഉം −y-ഉം ഇല്ലാതാകും. ബാക്കി രണ്ട് x, 110-നൊപ്പം."}},{"op":"solve","say":{"en":"Share 110 between the two x tiles. One x is 55.","ml":"110 രണ്ട് x-കൾക്കായി പങ്കിടുക. ഒരു x = 55."}},{"op":"back","say":{"en":"Put 55 in the first scale. Take 55 off both pans. Then y is 45.","ml":"ആദ്യ ത്രാസിൽ 55 വയ്ക്കുക. രണ്ട് തട്ടിൽനിന്നും 55 എടുക്കുക. അപ്പോൾ y = 45."}},{"op":"check","say":{"en":"Check both scales with 55 and 45. Both balance.","ml":"55, 45 എന്നിവ ഉപയോഗിച്ച് രണ്ട് ത്രാസും പരിശോധിക്കാം. രണ്ടും തുല്യം."}}]}',
  },
  {
    id: 'typeset-chain',
    name: 'Typeset formulas: fractions, roots, powers and matrices, line by line',
    description: String.raw`Formulas laid out like a printed book (stacked fractions, square roots, powers, subscripts, matrices with brackets) and worked line by line. A line is written; the next line is made from it: the symbols they share glide to their new places while the rest fade and appear. A line can be added underneath (the earlier ones dim), part of a line can be lit, and the final line is boxed. Symbols can be coloured by role (x red, y purple). The planner writes each formula in LaTeX-like text (\frac{a}{b}, \sqrt{x}, x^{2}, x_{1}, \begin{bmatrix}1 & 2 \\ 3 & 4\end{bmatrix}, \color{a}{x}); the app typesets and animates it. Use for a formula or worked equation that has a square root, a stacked fraction or a matrix, such as the quadratic formula, the distance formula, simplifying a surd or a determinant.`,
    kinds: ['prose', 'result', 'aside', 'math'],
    score: (f) => (f.ts ? clamp(0.91 + 0.01 * (f.tsHits - 2)) : 0),
    planShape: String.raw`{"title":{"en":"","ml":""},"colors":{"x":"a"},"steps":[{"op":"show","tex":"x = \\frac{-b \\pm \\sqrt{b^{2} - 4ac}}{2a}","say":{"en":"","ml":""}},{"op":"focus","parts":["b"],"say":{}},{"op":"become","tex":"...","note":{"en":"","ml":""},"say":{}},{"op":"add","tex":"...","say":{}},{"op":"box","say":{}}]}  (steps[0] is "show"; "become" turns the line on the board into the new one, so keep the symbols they share the same; "add" writes a new line below, about 4 lines fit before a fresh page starts; "focus" parts are symbols or numbers already in the current line; "box" boxes the current line; at most 12 steps; tex is LaTeX-like: \\frac{a}{b}, \\sqrt{x}, x^{2}, x_{1}, \\pm, \\times, \\cdot, \\begin{bmatrix}a & b \\\\ c & d\\end{bmatrix} (also pmatrix, vmatrix), \\color{a}{x} with roles a b c carry result ink accent, \\text{words}; each formula at most 160 characters; the app typesets every formula, so do not describe its layout)`,
    example: String.raw`{"colors":{"x":"a"},"steps":[{"op":"show","tex":"\\sqrt{x + 3} = 5","say":{"en":"We want x. The unknown is under a square root.","ml":"x കണ്ടെത്തണം. അജ്ഞാത സംഖ്യ വർഗമൂലത്തിനുള്ളിലാണ്."}},{"op":"become","tex":"x + 3 = 25","note":{"en":"square both sides","ml":"ഇരുവശവും വർഗിക്കുക"},"say":{"en":"Square both sides to remove the root.","ml":"മൂലം ഒഴിവാക്കാൻ ഇരുവശവും വർഗിക്കുക."}},{"op":"become","tex":"x = 22","say":{"en":"Take 3 from both sides: x is 22.","ml":"ഇരുവശത്തുനിന്നും 3 കുറയ്ക്കുക: x = 22."}},{"op":"box","say":{"en":"So x equals 22.","ml":"അതിനാൽ x = 22."}}]}`,
  },
  {
    id: 'quadratic-derivation',
    name: 'The quadratic formula, derived by completing the square (picture and algebra)',
    description: String.raw`Where the quadratic formula comes from, shown as a picture and as algebra side by side. A square of side x and a strip of area b·x are drawn; the strip is cut in half, the two halves wrap two sides of the square, and the missing corner square (b/2)² completes it, so the figure is the square (x + b/2)². Beside it, the same steps are typeset in letters (x² + bx = −c, add (b/2)² to both sides, (x + b/2)² = (b/2)² − c, take the square root, x = −b/2 ± √((b/2)² − c)) and, below, with the numbers of one example that has whole roots. The last step writes the result as the quadratic formula, first for a = 1 and then for any a. The app computes every shape and number. Use for deriving or proving the quadratic formula, where the formula comes from, completing the square as a picture.`,
    kinds: ['prose', 'result', 'aside', 'math'],
    score: (f) => (f.qdv ? 0.99 : 0),
    planShape: String.raw`{"title":{"en":"","ml":""},"b":6,"c":5,"steps":[{"op":"show","say":{"en":"","ml":""}},{"op":"split","say":{}},{"op":"bend","say":{}},{"op":"corner","say":{}},{"op":"square","say":{}},{"op":"root","say":{}},{"op":"answer","say":{}},{"op":"formula","say":{}}]}  (the example is x² + b x + c = 0 with b an even whole number 2–16 and (b/2)² − c a perfect square from 1 to 144, so both roots are whole numbers, e.g. b 6 c 5, b 8 c 12, b 2 c −8; steps in exactly this order show, split, bend, corner, square, root, answer, and the optional last formula; the app draws the square, the strip, the corner and every typeset line and number – do not write numbers in "say" that the board does not show)`,
    example: String.raw`{"b":6,"c":5,"steps":[{"op":"show","say":{"en":"Here is x squared, a square of side x, and a strip of area b times x.","ml":"x² എന്ന x വശമുള്ള സമചതുരവും b·x പരപ്പളവുള്ള ഒരു പട്ടയും."}},{"op":"split","say":{"en":"Cut the strip in half. Each half is b over 2 wide.","ml":"പട്ടയെ പകുതിയാക്കി മുറിക്കുക. ഓരോ പകുതിയുടെയും വീതി b/2."}},{"op":"bend","say":{"en":"Wrap the halves round two sides of the square.","ml":"പകുതികൾ സമചതുരത്തിന്റെ രണ്ട് വശങ്ങളിൽ ചേർക്കുക."}},{"op":"corner","say":{"en":"One corner is missing: a small square, b over 2 squared. Add it to both sides.","ml":"ഒരു മൂല ഒഴിഞ്ഞുകിടക്കുന്നു: (b/2)² പരപ്പളവുള്ള ചെറിയ സമചതുരം. ഇരുവശത്തും കൂട്ടുക."}},{"op":"square","say":{"en":"Now the figure is one big square of side x plus b over 2.","ml":"ഇപ്പോൾ x + b/2 വശമുള്ള വലിയ സമചതുരം."}},{"op":"root","say":{"en":"Take the square root of both sides. Remember the plus and the minus.","ml":"ഇരുവശത്തിന്റെയും വർഗമൂലം എടുക്കുക. + ഉം − ഉം ഓർക്കുക."}},{"op":"answer","say":{"en":"Move b over 2 across. The two roots are minus 1 and minus 5.","ml":"b/2 മറുവശത്തേക്ക് മാറ്റുക. മൂലങ്ങൾ −1 ഉം −5 ഉം."}},{"op":"formula","say":{"en":"Put everything over 2: that is the quadratic formula.","ml":"എല്ലാം 2 കൊണ്ട് ഹരിച്ച് എഴുതിയാൽ ദ്വിമാന സൂത്രവാക്യം കിട്ടും."}}]}`,
  },
  {
    id: 'hcf-lcm',
    name: 'HCF and LCM by prime tiles',
    description: String.raw`The highest common factor (HCF, GCD) and the lowest common multiple (LCM) of two whole numbers, drawn with prime tiles. Each number splits into coloured prime tiles (12 = 2 × 2 × 3). The tiles slide so the primes the two numbers share sit in the same columns, joined by lines. The shared tiles are boxed: their product is the HCF. Every column is boxed: the product of all of them is the LCM. The check shows HCF × LCM = the product of the two numbers. The app computes every factor, product and position. Use for HCF, GCD, highest common factor, LCM, lowest common multiple, prime factorisation of two numbers.`,
    kinds: ['prose', 'problem', 'exercise', 'result', 'aside', 'math'],
    score: (f) => (f.hl ? clamp(0.93 + 0.01 * (f.hlHits - 2)) : 0),
    planShape: String.raw`{"title":{"en":"","ml":""},"a":12,"b":18,"steps":[{"op":"show","say":{"en":"","ml":""}},{"op":"factorise","say":{}},{"op":"common","say":{}},{"op":"hcf","say":{}},{"op":"lcm","say":{}},{"op":"check","say":{}}]}  (a and b are different whole numbers from 2 to 120 with a smaller than b; steps in exactly this order show, factorise, common, hcf, lcm, and the optional last check; the app splits each number into primes and writes every product – do not write numbers in "say" that the board does not show)`,
    example: String.raw`{"a":12,"b":18,"steps":[{"op":"show","say":{"en":"Find the HCF and LCM of 12 and 18.","ml":"12, 18 എന്നിവയുടെ ഉസാഘ-യും ലസാഗു-വും കണ്ടെത്തുക."}},{"op":"factorise","say":{"en":"Split each number into prime tiles.","ml":"ഓരോ സംഖ്യയെയും അഭാജ്യ സംഖ്യകളായി പിരിക്കുക."}},{"op":"common","say":{"en":"Slide the tiles so the same primes sit above each other. The shared ones are green.","ml":"ഒരേ അഭാജ്യ സംഖ്യകൾ മുകളിലും താഴെയുമായി വരുംവിധം നീക്കുക. പൊതുവായവ പച്ച."}},{"op":"hcf","say":{"en":"The HCF is the product of the shared tiles.","ml":"പൊതു അഭാജ്യങ്ങളുടെ ഗുണനഫലമാണ് ഉസാഘ."}},{"op":"lcm","say":{"en":"The LCM is the product of every column.","ml":"എല്ലാ നിരകളുടെയും ഗുണനഫലമാണ് ലസാഗു."}},{"op":"check","say":{"en":"HCF times LCM equals the two numbers multiplied.","ml":"ഉസാഘ × ലസാഗു = സംഖ്യകളുടെ ഗുണനഫലം."}}]}`,
  },
  {
    id: 'area-figure',
    name: 'Area of a parallelogram and of a trapezium',
    description:
      'A figure drawn to scale with its sizes written in colour. (1) A parallelogram: base and perpendicular height (dashed, with a right-angle mark); a right triangle is cut off one end and slides across to the other end, making a rectangle b × h, so the area is base times height. (2) A trapezium: the parallel sides a and b and the height; a second copy turned half a turn completes a parallelogram of base a + b, so the area is half of (a + b) × h; or a diagonal cuts it into two triangles, half b h and half a h, which add up to the same. The formula is then written with the numbers and the unit squared. The app computes every point and number. Use for the area of a parallelogram, a trapezium or a trapezoid, base and height, parallel sides.',
    kinds: ['prose', 'problem', 'exercise', 'result', 'aside', 'math'],
    score: (f) => (f.afig ? clamp(0.94 + 0.01 * (f.afigHits - 3)) : 0),
    planShape:
      '{"title":{"en":"","ml":""},"kind":"trapezium","b":10,"a":4,"h":6,"lean":"centre","unit":"cm","steps":[{"op":"show","say":{"en":"","ml":""}},{"op":"height","say":{}},{"op":"copy","say":{}},{"op":"triangles","say":{}},{"op":"formula","say":{}}]}  (kind "parallelogram": b base 2–20, h height 2–20, optional lean "left" or "right", steps show, height, cut, move, formula – cut after height, move after cut; kind "trapezium": b the longer parallel side 2–20, a the shorter 1 to b − 1, h height 2–20, optional lean "left" (a right angle at the left), "right" or "centre", steps show, height, copy, triangles, formula – copy and triangles are two ways to see the same area, either or both; (a + b) × h must be even, and "triangles" needs b × h and a × h even; optional unit cm, m or mm; each step at most once, show first; the app computes and writes every length, product and the area – do not write numbers in "say" that the board does not show)',
    example:
      '{"kind":"parallelogram","b":8,"h":5,"unit":"cm","steps":[{"op":"show","say":{"en":"A parallelogram with base 8 and height 5.","ml":"അടിവശം 8-ഉം ഉയരം 5-ഉം ഉള്ള ഒരു സമാന്തരീകം."}},{"op":"height","say":{"en":"The height is the perpendicular distance between the parallel sides.","ml":"സമാന്തര വശങ്ങൾ തമ്മിലുള്ള ലംബ ദൂരമാണ് ഉയരം."}},{"op":"cut","say":{"en":"Cut a triangle off one end.","ml":"ഒരറ്റത്തുനിന്ന് ഒരു ത്രികോണം മുറിച്ചെടുക്കുക."}},{"op":"move","say":{"en":"Slide it to the other end. Now it is a rectangle.","ml":"അതിനെ മറ്റേ അറ്റത്തേക്ക് നീക്കുക. ഇപ്പോൾ ഇത് ഒരു ചതുരമാണ്."}},{"op":"formula","say":{"en":"The area is base times height.","ml":"പരപ്പളവ് അടിവശം × ഉയരം ആണ്."}}]}',
  },
  {
    id: 'matrix-ops',
    name: 'Matrices: multiplication entry by entry, and the transpose',
    description:
      'Two matrix operations drawn on bracketed grids. (1) Multiplication: A and B side by side; the orders m × n and n × p are written, the two inner numbers are seen to be equal and the product has order m × p; each chosen entry of the product is made by boxing a row of A and a column of B in colour, writing the products and their sum, and placing the result in its box; the remaining entries then fill in. (2) Transpose: each row of A becomes a column of the transposed matrix, one row at a time in its own colour; an entry moves from position (i, j) to (j, i); the orders r × c and c × r are written. The app computes every entry and box. Use for multiplying two matrices, matrix product, row by column, order of a product, the transpose of a matrix.',
    kinds: ['prose', 'problem', 'exercise', 'result', 'aside', 'math'],
    score: (f) => (f.mops ? clamp(0.94 + 0.01 * (f.mopsHits - 2)) : 0),
    planShape:
      '{"title":{"en":"","ml":""},"kind":"multiply","a":[[1,2,3],[4,5,6]],"b":[[1,0],[0,1],[2,1]],"steps":[{"op":"show","say":{"en":"","ml":""}},{"op":"check","say":{}},{"op":"entry","i":0,"j":0,"say":{}},{"op":"entry","i":1,"j":1,"say":{}},{"op":"all","say":{}}]}  (kind "multiply": "a" and "b" with 1 to 3 rows and columns, whole numbers −9..9, the columns of a equal the rows of b, every entry of the product between −99 and 99; steps show first, then check, then entry (i, j) – 0-based row of a, column of b, each at most once, at most 4 – then all (fills the rest); kind "transpose": "a" with 1 to 4 rows and columns, steps show, rows, entry (i, j: the entry that moves to (j, i)), size, each at most once, rows before entry; the app computes and writes every entry, product and order – do not write numbers in "say" that the board does not show)',
    example:
      '{"kind":"transpose","a":[[1,2,3],[4,5,6]],"steps":[{"op":"show","say":{"en":"This matrix A has 2 rows and 3 columns.","ml":"ഈ മാട്രിക്സ് A-ക്ക് 2 വരിയും 3 നിരയുമുണ്ട്."}},{"op":"rows","say":{"en":"Each row of A becomes a column of the transpose.","ml":"A-യുടെ ഓരോ വരിയും ട്രാൻസ്പോസിലെ ഒരു നിരയാകുന്നു."}},{"op":"size","say":{"en":"A 2 by 3 matrix has a 3 by 2 transpose.","ml":"2 × 3 മാട്രിക്സിന്റെ ട്രാൻസ്പോസ് 3 × 2 ആണ്."}}]}',
  },
  {
    id: 'fraction-line',
    name: 'Fractions on the number line: marking, equivalent, comparing, adding',
    description:
      'A number line from 0 with its whole numbers. (1) Marking fractions: each whole is cut into equal parts (the common denominator), one part is shown as one over D, and each fraction is a dot at that many parts from zero with its label; improper fractions are also written as mixed numbers. (2) Equivalent fractions: the same point on a second line cut k times finer, joined by a dashed line, with the fraction multiplied top and bottom by k. (3) Comparing two fractions: both are marked, rewritten over the common denominator, and shown as bars whose lengths give the greater one. (4) Adding or subtracting two fractions: a jump of the second fraction along the line from the first, over the common denominator, to the answer (reduced, and as a mixed number when bigger than one). The app computes every position and number. Use for fractions on a number line, representing fractions, equivalent fractions, comparing and ordering fractions, adding and subtracting fractions.',
    kinds: ['prose', 'problem', 'exercise', 'result', 'aside', 'math'],
    score: (f) => (f.fline ? clamp(0.94 + 0.01 * (f.flineHits - 3)) : 0),
    planShape:
      '{"title":{"en":"","ml":""},"kind":"mark","fracs":[[1,2],[3,4]],"steps":[{"op":"show","say":{"en":"","ml":""}},{"op":"divide","say":{}},{"op":"mark","say":{}},{"op":"mixed","say":{}}]}  (kind "mark": 1 to 4 different fractions [numerator, denominator] in lowest terms, denominators 2–12, each at most 3, e.g. [[1,2],[3,4],[5,4]]; steps show first, then divide, mark, mixed (mixed only if some fraction is improper); kind "equivalent": "frac":[2,3] a proper fraction in lowest terms and "k": 2–6 with denominator × k at most 36, steps show, scale, result; kind "compare": "fracs":[[2,3],[3,4]] exactly two different fractions, steps show, common (only when the denominators differ), result; kind "add": "fracs":[[1,2],[1,3]] and optional "op":"sub" (first minus second, must stay positive), the sum at most 3 and the common denominator times the number of wholes shown at most 36, steps show, jump, common (only when the denominators differ), result; each step at most once, show first, result last; the app computes and writes every fraction and tick – do not write numbers in "say" that the board does not show)',
    example:
      '{"kind":"add","fracs":[[1,2],[1,3]],"steps":[{"op":"show","say":{"en":"Start at one half on the number line.","ml":"സംഖ്യാരേഖയിൽ ഒന്നിൽ രണ്ട് ഭാഗത്ത് തുടങ്ങാം."}},{"op":"jump","say":{"en":"Jump one third to the right.","ml":"ഒന്നിൽ മൂന്ന് ഭാഗം വലത്തേക്ക് ചാടുക."}},{"op":"common","say":{"en":"The line is cut in sixths, so both fractions are written in sixths.","ml":"രേഖ ആറിലൊന്നുകളായി മുറിച്ചിരിക്കുന്നു, അതിനാൽ രണ്ട് ഭിന്നസംഖ്യകളും ആറിലൊന്നുകളിൽ എഴുതാം."}},{"op":"result","say":{"en":"We land on five sixths.","ml":"നമ്മൾ ആറിൽ അഞ്ചിൽ എത്തുന്നു."}}]}',
  },
  {
    id: 'number-line',
    name: 'Number line',
    description: 'A number line with zero in the middle; points appear, jumps arc left/right, opposite numbers mirror across zero.',
    kinds: ['prose', 'problem', 'math', 'exercise'],
    score: (f) => (f.numberLine ? (/\bnumber line|left|right|opposite|negative\b/i.test(f.text) ? 0.8 : 0.4) : 0),
    planShape: '{"min":-5,"max":5,"steps":[{"op":"point","at":-3,"say":{"en":"","ml":""}},{"op":"jump","from":-3,"by":5,"say":{"en":"","ml":""}}]}',
  },
];

export const DNA_BY_ID = new Map<string, DnaDefinition>(DNAS.map((d) => [d.id, d]));

/** Blocks that MUST be taught with a DNA (problems, formulae, equations). */
export function isMandatory(f: BlockFeatures): boolean {
  return f.kind === 'problem' || f.kind === 'exercise' || f.kind === 'math' || f.kind === 'result' || f.equations > 0 || f.formulaLike;
}

const STRONG = 0.6;

export function selectDna(block: BookBlock, chapterTitle = ''): DnaSelection {
  const f = blockFeatures(block, chapterTitle);
  const mandatory = isMandatory(f);
  const ranked: Array<{ id: DnaId; score: number }> = DNAS.filter((d) => d.kinds.includes(f.kind))
    .map((d) => ({ id: d.id, score: Number(d.score(f).toFixed(3)) }))
    .concat(learnedDnas().map((l) => ({ id: `learned:${l.id}` as DnaId, score: scoreLearned(l, f) })))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score);
  const best = ranked[0];
  // The teacher chose a template for this problem: it wins over every rule (V51.9.63).
  const pin = pinnedDna(block.text);
  if (pin && (DNA_BY_ID.has(pin) || (pin.startsWith('learned:') && getLearned(pin.slice(8))))) {
    return { dna: pin as DnaId, score: 1, mandatory, needsAi: false, ranked, reason: 'chosen by the teacher' };
  }
  if (best && best.score >= STRONG) {
    return { dna: best.id, score: best.score, mandatory, needsAi: false, ranked, reason: `${best.id} fits best (${best.score.toFixed(2)})` };
  }
  if (mandatory) {
    return {
      dna: 'ai-custom',
      score: best?.score ?? 0,
      mandatory,
      needsAi: true,
      ranked,
      reason: best
        ? `mandatory ${f.kind}: best built-in DNA ${best.id} is weak (${best.score.toFixed(2)}) — AI composes a new DNA`
        : `mandatory ${f.kind}: no built-in DNA fits — AI composes a new DNA`,
    };
  }
  return {
    dna: best?.id ?? 'concept-board',
    score: best?.score ?? 0.3,
    mandatory,
    needsAi: false,
    ranked,
    reason: best ? `${best.id} (${best.score.toFixed(2)})` : 'explanation paragraph → concept board',
  };
}

/** The best built-in DNA for a mandatory block when no AI is available (still a DNA, flagged as fallback). */
export function offlineFallbackDna(f: BlockFeatures): DnaId {
  if (f.kind === 'math') return 'equation-chain';
  if (f.kind === 'result') return 'key-result';
  if (f.kind === 'problem' || f.kind === 'exercise') return f.wordProblem ? 'word-problem' : 'concept-board';
  if (f.equations > 0) return 'equation-chain';
  return 'concept-board';
}
