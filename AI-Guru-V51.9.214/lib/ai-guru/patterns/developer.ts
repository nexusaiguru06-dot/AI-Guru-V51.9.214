import type { VisualAction } from '../lesson/types';
import { buildPattern, getPattern, matchesSignals } from './catalog';
import { describePattern, libraryIndex } from './context';
import { searchPatterns } from './search';
import { fitTiming, formatIssues, verifyVisualActions } from './verify';
import type { Params, PatternHit, VerifyIssue } from './types';

/**
 * Visual Developer agent for AI Guru.
 *
 *   step  ->  (1) look up patterns (auto-seeded + LLM "QUERY:" rounds, then "FINISH")
 *         ->  (2) LLM chooses patterns + parameters (or writes a few custom actions)
 *         ->  (3) build with the tested pattern functions
 *         ->  (4) dry-run verify; on errors the LLM gets the exact problems and retries
 *         ->  (5) fit the animation to the narration length
 *
 * The maths is never decided here: the step (before / operation / after) is already verified by the solver.
 * The agent only decides HOW TO SHOW it.
 */
export type LlmFn = (system: string, prompt: string, o?: { json?: boolean }) => Promise<string>;

export interface DevelopStepInput {
  id: string;
  before: string;
  operation: string;
  after: string;
  caption?: string;
  /** The textbook problem this step belongs to (helps pick the right picture). */
  problem?: string;
  domainHint?: string;
  narrationMs?: number;
  /** Ids already on the board (earlier steps of the same answer). */
  knownIds?: string[];
}

export interface DeveloperDeps {
  llm: LlmFn;
  /** LLM search rounds (MathVizAI used 3). Default 2. */
  maxSearchRounds?: number;
  /** Generation retries after a failed dry run. Default 2. */
  maxRetries?: number;
}

export interface DevelopResult {
  ok: boolean;
  actions: VisualAction[];
  patternIds: string[];
  attempts: number;
  issues: VerifyIssue[];
  /** What happened, for logs and for the QA report. */
  trace: string[];
}

const SEARCH_SYSTEM = 'You are the AI Guru visual librarian. You help a teacher find the right picture pattern for one maths step. Reply with exactly one line.';
const DEVELOP_SYSTEM = `You are AI Guru's Visual Developer. You draw the picture for ONE already-verified maths step so that a high-school student can SEE why the step is true. You never change the maths.
You do not write code. Prefer choosing library patterns and giving their parameters; write custom actions only for something no pattern covers.
Rules:
1. Use the REAL numbers and letters of the step. Never invent data, never copy example numbers.
2. Board is 1000x700. Keep everything inside x 30..970, y 30..670. Labels are language-neutral (numbers, letters, symbols) - no sentences on the board; explanations belong to the caption.
3. If no picture would help (pure arithmetic on the rows already shown), return {"uses":[],"actions":[]}.
4. Custom actions must be VisualAction objects: line {startX,startY,endX,endY,stroke,strokeWidth,style}, shape {shape:"rectangle"|"circle"|"triangle",x,y,width,height,fill,stroke}, write {content,x,y,fontSize,placement:"absolute",anchor:"middle",color}.
Return ONLY JSON: {"summary":"one line","uses":[{"pattern":"<id>","params":{...}}],"actions":[...custom...]}`;

function extractJson(text: string): any {
  const t = String(text || '').trim();
  const fenced = t.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1] ?? t;
  const a = fenced.indexOf('{'), b = fenced.lastIndexOf('}');
  if (a < 0 || b <= a) throw new Error('The model did not return a JSON object.');
  return JSON.parse(fenced.slice(a, b + 1));
}

function stepText(s: DevelopStepInput): string {
  return `Problem: ${s.problem ?? '(not given)'}\nStep: ${s.before}  --[${s.operation}]-->  ${s.after}\nCaption: ${s.caption ?? ''}`;
}

/** First line decides: "QUERY: ..." or "FINISH". Anything else counts as FINISH (as in MathVizAI). */
export function parseSearchReply(reply: string): { query?: string } {
  const line = String(reply || '').split('\n').map((l) => l.trim()).find(Boolean) ?? '';
  const m = line.match(/^query\s*:\s*(.+)$/i);
  return m ? { query: m[1].trim().slice(0, 120) } : {};
}

export async function developStepVisuals(step: DevelopStepInput, deps: DeveloperDeps): Promise<DevelopResult> {
  const trace: string[] = [];
  const maxRounds = deps.maxSearchRounds ?? 2, maxRetries = deps.maxRetries ?? 2;

  /* 1. look up patterns */
  const found = new Map<string, PatternHit>();
  const remember = (hits: PatternHit[]) => { for (const h of hits) if (!found.has(h.pattern.id)) found.set(h.pattern.id, h); };
  remember(searchPatterns(`${step.problem ?? ''} ${step.operation} ${step.before} ${step.after} ${step.caption ?? ''}`, { k: 3, domain: step.domainHint }));
  trace.push(`auto-search: ${[...found.keys()].join(', ') || 'no match'}`);
  for (let round = 0; round < maxRounds; round++) {
    let reply = '';
    try {
      reply = await deps.llm(SEARCH_SYSTEM, `${stepText(step)}\n\nPatterns found so far: ${[...found.keys()].join(', ') || 'none'}\nAll patterns:\n${libraryIndex()}\n\nDo you need to look up a different picture technique? Reply "QUERY: <what to look for>" or "FINISH".`);
    } catch (e) { trace.push(`search round ${round + 1} failed: ${e instanceof Error ? e.message : String(e)}`); break; }
    const { query } = parseSearchReply(reply);
    if (!query) { trace.push(`search round ${round + 1}: FINISH`); break; }
    const hits = searchPatterns(query, { k: 3, domain: step.domainHint });
    remember(hits);
    trace.push(`search round ${round + 1}: "${query}" -> ${hits.map((h) => h.pattern.id).join(', ') || 'nothing'}`);
  }
  const context = [...found.values()].slice(0, 5).map((h) => describePattern(h.pattern)).join('\n\n');

  /* 2-4. generate, build, verify, retry with the exact problems */
  let feedback = '';
  let lastIssues: VerifyIssue[] = [];
  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    let plan: any;
    try {
      const raw = await deps.llm(DEVELOP_SYSTEM, `${stepText(step)}\n\nPATTERNS YOU MAY USE:\n${context || '(none matched - write custom actions or return nothing)'}${feedback ? `\n\nYour previous answer failed the dry run:\n${feedback}\nFix exactly these problems.` : ''}`, { json: true });
      plan = extractJson(raw);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      trace.push(`attempt ${attempt}: bad reply (${msg})`);
      feedback = `Reply with valid JSON only. (${msg})`;
      lastIssues = [{ severity: 'error', code: 'BAD_JSON', message: msg }];
      continue;
    }
    const actions: VisualAction[] = [];
    const used: string[] = [];
    const problems: VerifyIssue[] = [];
    (Array.isArray(plan?.uses) ? plan.uses : []).slice(0, 4).forEach((u: any, i: number) => {
      const id = String(u?.pattern ?? '');
      if (!getPattern(id)) { problems.push({ severity: 'error', code: 'UNKNOWN_PATTERN', message: `Pattern "${id}" does not exist.` }); return; }
      const built = buildPattern(id, (u?.params && typeof u.params === 'object' ? u.params : {}) as Params, `${step.id}-${id}-${i + 1}`);
      if (!built.length) problems.push({ severity: 'error', code: 'PATTERN_EMPTY', message: `Pattern "${id}" produced nothing for these params.` });
      actions.push(...built); used.push(id);
    });
    (Array.isArray(plan?.actions) ? plan.actions : []).slice(0, 24).forEach((a: any, i: number) => {
      if (a && typeof a === 'object') actions.push({ ...a, id: `${step.id}-custom-${i + 1}` } as VisualAction);
    });

    if (!actions.length && !problems.length) {
      trace.push(`attempt ${attempt}: the model decided no picture is needed`);
      return { ok: true, actions: [], patternIds: [], attempts: attempt, issues: [], trace };
    }
    const timed = step.narrationMs ? fitTiming(actions, step.narrationMs) : actions;
    const check = verifyVisualActions(timed, { knownIds: step.knownIds, narrationMs: step.narrationMs });
    lastIssues = [...problems, ...check.issues];
    const errors = lastIssues.filter((i) => i.severity === 'error');
    trace.push(`attempt ${attempt}: ${actions.length} actions, ${errors.length} errors, ${check.warnings.length} warnings`);
    if (!errors.length) return { ok: true, actions: timed, patternIds: used, attempts: attempt, issues: lastIssues, trace };
    feedback = formatIssues(errors);
  }
  return { ok: false, actions: [], patternIds: [], attempts: maxRetries + 1, issues: lastIssues, trace };
}

/* ------------------------------- section level --------------------------------- */

export interface SectionLike {
  heading?: string;
  sourceText?: string;
  visuals?: any[];
  mathSteps?: Array<{ id: string; before: string; operation: string; after: string; captionEnglish?: string; visualIds?: string[] }>;
  teachingPass?: { visuals?: any[] } & Record<string, any>;
}

export interface EnrichOptions extends DeveloperDeps {
  /** Only steps whose best pattern scores at least this are drawn (skips pure arithmetic). */
  minScore?: number;
  /** Hard cap on LLM-developed steps per section. */
  maxSteps?: number;
  onTrace?: (line: string) => void;
}

/**
 * For a section that has verified steps but no pictures, develop pictures for the steps that a library pattern fits.
 * Sections that already have visuals are left alone. Never throws.
 */
export async function developSectionVisuals<T extends SectionLike>(section: T, o: EnrichOptions): Promise<T> {
  const steps = section.mathSteps ?? [];
  if (!steps.length || (section.visuals?.length ?? 0) > 0) return section;
  const visuals: any[] = [];
  const mapped = new Map<string, string[]>();
  let developed = 0;
  for (const s of steps) {
    if (developed >= (o.maxSteps ?? 6)) break;
    // Gate on the STEP itself (plus its caption): a section about balancing must not make "12 + 15 = 27" draw a scale.
    // A pattern is only tried when the step's own words carry one of the pattern's strong signals.
    const q = `${s.operation} ${s.before} ${s.after} ${s.captionEnglish ?? ''}`;
    const best = searchPatterns(q, { k: 3 }).find((h) => h.score >= (o.minScore ?? 1.5) && matchesSignals(h.pattern, q));
    if (!best) continue;
    developed++;
    try {
      const res = await developStepVisuals({ id: s.id.replace(/[^a-zA-Z0-9_-]+/g, '-'), before: s.before, operation: s.operation, after: s.after, caption: s.captionEnglish, problem: section.sourceText?.slice(0, 400) || section.heading, knownIds: visuals.map((v) => v.id) }, o);
      o.onTrace?.(`${s.id}: ${res.ok ? 'ok' : 'failed'} ${res.trace.join(' | ')}`);
      if (res.ok && res.actions.length) { visuals.push(...res.actions); mapped.set(s.id, res.actions.map((a) => a.id)); }
    } catch (e) { o.onTrace?.(`${s.id}: error ${e instanceof Error ? e.message : String(e)}`); }
  }
  if (!visuals.length) return section;
  return {
    ...section,
    visuals,
    mathSteps: steps.map((s) => (mapped.has(s.id) && !(s.visualIds?.length) ? { ...s, visualIds: mapped.get(s.id) } : s)),
    teachingPass: section.teachingPass ? { ...section.teachingPass, visuals } : section.teachingPass,
  };
}

/* ------------------------- repair of already-authored visuals ------------------------- */

const REPAIR_SYSTEM = `You repair AI Guru VisualAction arrays that failed a dry run. Change as little as possible: keep every id and every meaning, fix only the listed problems.
Board is 1000x700; keep everything inside x 30..970, y 30..670. Return ONLY JSON: {"actions":[...the complete corrected array...]}`;

export interface RepairResult { ok: boolean; visuals: any[]; attempts: number; issues: VerifyIssue[] }

/**
 * The retry loop of MathVizAI applied to visuals the material author already wrote: show the model the exact
 * dry-run problems and ask for a corrected array, up to `maxRetries` times.
 */
export async function repairVisualActions(visuals: any[], deps: { llm: LlmFn; maxRetries?: number; context?: string; knownIds?: string[] }): Promise<RepairResult> {
  let current = visuals;
  let issues: VerifyIssue[] = [];
  const max = deps.maxRetries ?? 2;
  for (let attempt = 1; attempt <= max; attempt++) {
    issues = verifyVisualActions(current, { knownIds: deps.knownIds }).issues;
    const errors = issues.filter((i) => i.severity === 'error');
    if (!errors.length) return { ok: true, visuals: current, attempts: attempt - 1, issues };
    try {
      const raw = await deps.llm(REPAIR_SYSTEM, `${deps.context ? `Context: ${deps.context}\n` : ''}Problems:\n${formatIssues(errors, 12)}\n\nCurrent actions:\n${JSON.stringify(current)}`, { json: true });
      const fixed = extractJson(raw)?.actions;
      if (Array.isArray(fixed)) current = fixed;
    } catch { /* keep the current array and try again */ }
  }
  issues = verifyVisualActions(current, { knownIds: deps.knownIds }).issues;
  return { ok: !issues.some((i) => i.severity === 'error'), visuals: current, attempts: max, issues };
}
