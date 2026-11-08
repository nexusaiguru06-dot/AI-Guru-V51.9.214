import { ids, type AgentRequest, type AgentResult, type Lesson, type Paragraph } from '../../contracts';
import { compileUniversalMath, detectMathDomain, universalSceneToVisualActions } from '../../math/universal';
import { HybridMathVerifier } from '../../math/verifier';
import type { MathVerifier } from '../../math/adapter';
import type { MathDomain, UniversalMathScene, UniversalMathStep } from '../../math/universal/types';
import { generateMathSteps } from '../../math/adapters/mathsteps';
import { selectTeachingStrategy } from '../../teaching/strategy';

export interface MathAgentInput { lesson: Lesson; paragraphId?: string; }
export interface MathAgentOutput { lesson: Lesson; paragraphIds: string[]; }

/**
 * Math Agent: verifies mathematical expressions and compiles verified mathematics
 * through the existing Universal Math Visual Compiler. It is paragraph-scoped.
 */
export class MathAgent {
  readonly name = 'math' as const;

  constructor(private readonly verifier: MathVerifier = new HybridMathVerifier()) {}

  async execute(request: AgentRequest<MathAgentInput>): Promise<AgentResult<MathAgentOutput>> {
    const target = request.input.paragraphId;
    const paragraphs = await Promise.all(request.input.lesson.paragraphs.map((paragraph) => {
      if (target && paragraph.id !== target) return paragraph;
      return this.processParagraph(paragraph);
    }));
    return {
      ok: true,
      agent: 'math',
      runId: request.context.runId,
      output: { lesson: { ...request.input.lesson, paragraphs }, paragraphIds: paragraphs.filter(p => !target || p.id === target).map(p => p.id) },
    };
  }

  private async processParagraph(paragraph: Paragraph): Promise<Paragraph> {
    const expressions = extractExpressions(paragraph);
    if (!expressions.length) {
      return { ...paragraph, math: { domain: 'general', expressions: [], verifiedExpressions: [], scenes: [], failures: [], status: 'not-applicable' } };
    }

    const scenes: UniversalMathScene[] = [];
    const structuredSteps: UniversalMathStep[] = [];
    const verifiedExpressions: string[] = [];
    const strategy = selectTeachingStrategy({ question: paragraph.source.text, domain: detectMathDomain(paragraph.source.text), grade: inferGrade(paragraph) });
    const failures: string[] = [];
    let domain: MathDomain = 'general';

    for (const expression of expressions) {
      const verification = await this.verifier.verify(expression);
      if (!verification.valid) {
        failures.push(`${expression}: ${verification.errors.join('; ') || 'verification failed'}`);
        continue;
      }
      verifiedExpressions.push(expression);
      domain = detectMathDomain(expression);
      if (domain === 'algebra' || domain === 'linear_equations' || domain === 'polynomials' || domain === 'fractions') {
        const stepResult = await generateMathSteps(expression, paragraph.id);
        structuredSteps.push(...stepResult.steps);
      }
      try {
        const scene = await compileUniversalMath(expression, {
          id: ids.agentRun(`math-scene-${paragraph.id}-${scenes.length}`),
          grade: inferGrade(paragraph),
          domain,
          verify: true,
        }, this.verifier);
        if (!scene.verified) {
          failures.push(`${expression}: universal compiler verification failed`);
          continue;
        }
        scenes.push(scene);
      } catch (error) {
        failures.push(`${expression}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    return {
      ...paragraph,
      math: { domain, expressions, verifiedExpressions, scenes, failures, steps: structuredSteps, strategy: strategy.strategy, status: failures.length ? 'failed' : 'passed' },
      teachingStrategy: strategy.strategy,
    };
  }
}

function extractExpressions(paragraph: Paragraph): string[] {
  const candidates = [
    ...paragraph.visualSteps.flatMap(step => extractFromAction(step.action)),
    ...extractFromText(paragraph.source.text),
    ...Object.values(paragraph.explanation ?? {}).flatMap(extractFromText),
    ...paragraph.problems.flatMap(problem => [problem.sourceText, ...(problem.solution?.steps ?? []), problem.solution?.finalAnswer ?? ''].flatMap(extractFromText)),
  ];
  return [...new Set(candidates.map(cleanExpression).filter(isLikelyMathExpression))].slice(0, 12);
}

function extractFromAction(action: unknown): string[] {
  if (!action || typeof action !== 'object') return [];
  const a = action as Record<string, unknown>;
  return ['latex', 'expression', 'content', 'text'].flatMap(key => typeof a[key] === 'string' ? extractFromText(a[key] as string) : []);
}

function extractFromText(text: string): string[] {
  const out: string[] = [];
  const fenced = text.match(/\\\[[\s\S]*?\\\]|\$\$[\s\S]*?\$\$|\$[^$]+\$/g) ?? [];
  for (const item of fenced) out.push(item.replace(/^\\\[|\\\]$|^\$\$?|\$\$?$|\$$/g, '').trim());
  const equations = text.match(/[A-Za-z0-9()]+(?:\s*[+\-*/^×÷=]\s*[A-Za-z0-9().]+)+/g) ?? [];
  out.push(...equations);
  return out;
}

function cleanExpression(value: string): string {
  return value.replace(/\\left|\\right/g, '').replace(/\s+/g, ' ').trim();
}

function isLikelyMathExpression(value: string): boolean {
  if (!value || value.length > 180) return false;
  return /[=^+\-*/×÷]|\\frac|\\sqrt|\b(sin|cos|tan|log|ln|lim)\b/i.test(value) && /\d|[a-zA-Z]/.test(value);
}

function inferGrade(paragraph: Paragraph): number {
  const raw = paragraph.source.sourceLocator ?? '';
  const match = raw.match(/(?:class|grade)[-_ ]?(\d{1,2})/i);
  return match ? Math.min(12, Math.max(1, Number(match[1]))) : 12;
}

export function mathScenesToVisualActions(paragraph: Paragraph) {
  return (paragraph.math?.scenes ?? []).flatMap(universalSceneToVisualActions);
}
