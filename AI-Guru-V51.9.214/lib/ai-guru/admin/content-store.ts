/** Teachers' notes, templates, exams and the students' exam answers, saved through lib/ai-guru/storage (server only). */
import { docs } from '../storage';
import type { Attempt, ClassItem } from './class-content';

const KEY = 'data/ai-guru/admin/class-content.json';
export interface ContentData { items: ClassItem[]; attempts: Attempt[] }

export async function readContent(): Promise<ContentData> {
  return norm(await docs.get<Partial<ContentData>>(KEY));
}
const norm = (d: Partial<ContentData> | null): ContentData => ({ items: d?.items ?? [], attempts: d?.attempts ?? [] });
export function updateContent<T>(fn: (d: ContentData) => T | Promise<T>): Promise<T> {
  return docs.update<Partial<ContentData>, T>(KEY, async (cur) => { const d = norm(cur); const r = await fn(d); return { value: d, result: r }; });
}
