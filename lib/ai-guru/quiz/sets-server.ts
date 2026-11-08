import { docs } from '../storage';
import { cleanSet, type QuestionSet } from './sets';

const KEY = 'data/ai-guru/teacher/question-sets.json';

export async function readSets(): Promise<QuestionSet[]> {
  const a = await docs.get<QuestionSet[]>(KEY);
  return Array.isArray(a) ? a : [];
}

function write(fn: (all: QuestionSet[]) => QuestionSet[]): Promise<QuestionSet[]> {
  return docs.update<QuestionSet[], QuestionSet[]>(KEY, (cur) => {
    const all = fn(Array.isArray(cur) ? cur : []).slice(-200);
    return { value: all, result: all };
  });
}

/** Adds or replaces a set (same id). Returns null when the set is not valid. */
export async function upsertSet(raw: unknown): Promise<QuestionSet | null> {
  const set = cleanSet(raw);
  if (!set) return null;
  await write((all) => { const old = all.find((s) => s.id === set.id); return [...all.filter((s) => s.id !== set.id), old ? { ...set, createdAt: old.createdAt } : set]; });
  return set;
}

export const deleteSet = (id: string) => write((all) => all.filter((s) => s.id !== id));
