import { repairVisualActions, type LlmFn } from './developer';
import { verifyVisualActions } from './verify';
import type { VerifyIssue } from './types';

export interface SectionVisualsLike {
  heading?: string;
  visuals?: any[];
  mathSteps?: Array<{ visualIds?: string[] } & Record<string, any>>;
  teachingPass?: ({ visuals?: any[] } & Record<string, any>) | undefined;
}

export interface DryRunReport { checked: number; removed: number; repaired: boolean; issues: VerifyIssue[] }

/**
 * Generation-time dry run for one section: verify every visual with the board's own renderer, let the model fix
 * errors when an llm is given (retry with the exact problems), and as a last resort DROP the undrawable actions so a
 * broken visual can never reach a student. Steps that pointed at a dropped visual are unlinked. Never throws.
 */
export async function dryRunSectionVisuals<T extends SectionVisualsLike>(section: T, o: { llm?: LlmFn; maxRetries?: number } = {}): Promise<{ section: T; report: DryRunReport }> {
  const visuals = Array.isArray(section.visuals) ? section.visuals : [];
  if (!visuals.length) return { section, report: { checked: 0, removed: 0, repaired: false, issues: [] } };
  let current = visuals;
  let repaired = false;
  let res = verifyVisualActions(current);
  if (!res.ok && o.llm) {
    try {
      const fix = await repairVisualActions(current, { llm: o.llm, maxRetries: o.maxRetries ?? 2, context: section.heading });
      if (fix.ok) { current = fix.visuals; repaired = true; res = verifyVisualActions(current); }
      else current = fix.visuals.length ? fix.visuals : current;
    } catch { /* fall through to dropping */ }
  }
  let removed = 0;
  if (!res.ok) {
    const bad = new Set(res.errors.map((e) => e.actionId).filter((x): x is string => Boolean(x)));
    const wholeArrayBroken = res.errors.some((e) => !e.actionId);
    const kept = wholeArrayBroken ? [] : current.filter((v) => !bad.has(v?.id));
    removed = current.length - kept.length;
    current = kept;
    res = verifyVisualActions(current);
  }
  const alive = new Set(current.map((v) => v?.id));
  const changed = current !== visuals;
  const next = !changed ? section : {
    ...section,
    visuals: current,
    mathSteps: section.mathSteps?.map((s) => ({ ...s, visualIds: (s.visualIds ?? []).filter((id) => alive.has(id)) })),
    teachingPass: section.teachingPass ? { ...section.teachingPass, visuals: current } : section.teachingPass,
  };
  return { section: next as T, report: { checked: visuals.length, removed, repaired, issues: res.issues } };
}
