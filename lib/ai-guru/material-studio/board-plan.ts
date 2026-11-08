/**
 * V51.9.209 (server only) — whiteboard lesson plans made on the AI Guru server.
 *
 * The classroom used to plan every section in the student's browser with the student's own AI key. For students that is
 * too hard (no key, no patience), so the office now makes the plans here, once, with the server's Gemini key (Cloud
 * settings or GEMINI_API_KEY). A plan is saved per material section (data/ai-guru/board-plans/<material>/<section>.json) and
 * the classroom asks for it before it plans anything itself.
 *
 * Work is done in short steps — one block of one section per request — so it fits a host that stops a request after about
 * 60 seconds (Netlify). The office page drives the steps and can stop and carry on later: finished blocks are kept.
 */
import { docs } from '../storage';
import { readData } from '../admin/store';
import { passageBlocks } from '../motion-class/passage';
import { blockKeyOf, passageHash } from '../motion-class/plan-hash';
import { aiPlanBlock } from '../motion-class/plan/ai';
import { selectDna } from '../motion-class/dna/registry';
import type { BlockPlan } from '../motion-class/dna/types';
import { planSubjects, type SubjectPlan } from '../subjects';
import { geminiTextServer } from '../generation/gemini-text-server';
import type { StudyMaterial, StudyMaterialSection } from './types';

export interface BoardPlanRecord {
  v: 1; materialId: string; sectionId: string; passageHash: number; blockIds: string[];
  plans: Record<string, BlockPlan>; subjects?: Array<[string, SubjectPlan]>; madeAt: string;
}
export interface SectionStatus { index: number; id: string; heading: string; blocks: number; planned: number; /** block numbers still to plan */ todo: number[]; subjects: boolean; complete: boolean }

const DIR = 'data/ai-guru/board-plans';
const safe = (s: string) => String(s).replace(/[^A-Za-z0-9._~-]/g, '_').slice(0, 120) || '_';
export const planKeyOf = (materialId: string, sectionId: string) => `${DIR}/${safe(materialId)}/${safe(sectionId)}.json`;

export const passageOf = (s: StudyMaterialSection) => String(s.sourceText || s.content || '').trim();
export function blocksOfSection(s: StudyMaterialSection) {
  const passage = passageOf(s);
  return passage ? passageBlocks(passage, s.heading || undefined, blockKeyOf(passage)) : [];
}

/** The key the server plans with: the office's Cloud settings key, or GEMINI_API_KEY. */
export async function serverGeminiKey(): Promise<string | undefined> {
  const s = (await readData()).settings.library;
  return s.cloudKey || process.env.GEMINI_API_KEY || undefined;
}

type Llm = (system: string, user: string) => Promise<string>;
const llmWith = (key: string): Llm => (system, user) => geminiTextServer(system, user, { json: true, maxOutputTokens: 12000, geminiKey: key, task: 'lesson plan' });

const statusOf = (s: StudyMaterialSection, index: number, rec: BoardPlanRecord | null): SectionStatus => {
  const blocks = blocksOfSection(s);
  const same = rec && rec.passageHash === passageHash(passageOf(s));
  const todo = blocks.map((b, i) => (same && rec.plans[b.id] ? -1 : i)).filter((i) => i >= 0);
  const planned = blocks.length - todo.length;
  const subjects = !!(same && rec.subjects);
  return { index, id: s.id, heading: s.heading, blocks: blocks.length, planned, todo, subjects, complete: blocks.length > 0 && !todo.length && subjects };
};

export async function planStatus(m: StudyMaterial): Promise<SectionStatus[]> {
  const out: SectionStatus[] = [];
  for (let i = 0; i < m.sections.length; i++) out.push(statusOf(m.sections[i], i, await docs.get<BoardPlanRecord>(planKeyOf(m.id, m.sections[i].id))));
  return out;
}

/** One step of the work: plan block `blockIndex` of the section, or (step "subjects") let the subject agents read the section. */
export async function planStep(m: StudyMaterial, sectionIndex: number, step: 'block' | 'subjects', blockIndex: number, key: string, llm: Llm = llmWith(key)): Promise<SectionStatus> {
  const sec = m.sections[sectionIndex];
  if (!sec) throw new Error('No such section');
  const blocks = blocksOfSection(sec);
  if (!blocks.length) throw new Error('This section has no text to teach.');
  const hash = passageHash(passageOf(sec));
  const chapterTitle = m.title;
  const sectionTitle = sec.heading || m.title;
  const k = planKeyOf(m.id, sec.id);
  const fresh = (): BoardPlanRecord => ({ v: 1, materialId: m.id, sectionId: sec.id, passageHash: hash, blockIds: blocks.map((b) => b.id), plans: {}, madeAt: new Date().toISOString() });
  let patch: (r: BoardPlanRecord) => void;
  if (step === 'block') {
    const b = blocks[blockIndex];
    if (!b) throw new Error('No such block');
    const r = await aiPlanBlock(b, { chapterTitle, sectionTitle, before: blocks.slice(Math.max(0, blockIndex - 1), blockIndex).map((x) => x.text), after: blocks.slice(blockIndex + 1, blockIndex + 2).map((x) => x.text) }, llm, { maxAttempts: 1, selection: selectDna(b, chapterTitle), ephemeral: true });
    // the AI's plan is kept only when it really is the AI's: a built-in fallback is not saved (the office page tries again)
    if (r.plan.source !== 'ai') throw new Error(`The AI plan for block ${blockIndex + 1} was not accepted: ${r.errors.slice(-2).join(' | ').slice(0, 220) || 'no answer'}`);
    patch = (rec) => { rec.plans[b.id] = r.plan; };
  } else {
    const failed: string[] = [];
    const found = await planSubjects(blocks, { chapterTitle, sectionTitle }, { llm, onEvent: (e) => { if (e.stage === 'skip' && !e.ok && !/nothing drawable/i.test(e.note)) failed.push(e.note); } });
    if (failed.length) throw new Error(`A subject agent could not finish: ${failed[0].slice(0, 200)}`); // not saved: the office page tries again
    patch = (rec) => { rec.subjects = [...found]; };
  }
  let result: SectionStatus = statusOf(sec, sectionIndex, null);
  await docs.update<BoardPlanRecord, void>(k, (cur) => {
    const rec = cur && cur.passageHash === hash ? cur : fresh(); // a changed passage starts again
    patch(rec);
    rec.madeAt = new Date().toISOString();
    result = statusOf(sec, sectionIndex, rec);
    return { value: rec, result: undefined };
  });
  return result;
}

/** What the classroom may have: only a section whose every block and subject step is done, and whose text is unchanged. */
export async function readBoardPlan(m: StudyMaterial, sectionId: string, hash: number): Promise<{ plans: Array<[string, BlockPlan]>; subjects: Array<[string, SubjectPlan]> } | null> {
  const i = m.sections.findIndex((s) => s.id === sectionId);
  if (i < 0) return null;
  const rec = await docs.get<BoardPlanRecord>(planKeyOf(m.id, sectionId));
  if (!rec || rec.passageHash !== hash || hash !== passageHash(passageOf(m.sections[i]))) return null;
  if (!statusOf(m.sections[i], i, rec).complete) return null;
  return { plans: Object.entries(rec.plans), subjects: rec.subjects ?? [] };
}
