import { docs } from '../storage';
import type { TeacherPin } from '../motion-class/dna/teacher-dna';
import type { LearnedDna } from '../motion-class/dna/learned';

export interface TeacherDnaState { pins: TeacherPin[]; templates: LearnedDna[] }
const KEY = 'data/ai-guru/teacher/dna.json';

export async function readState(): Promise<TeacherDnaState> {
  try { const j = (await docs.get<Partial<TeacherDnaState>>(KEY)) ?? {}; return { pins: Array.isArray(j.pins) ? j.pins : [], templates: Array.isArray(j.templates) ? j.templates : [] }; } catch { return { pins: [], templates: [] }; }
}

const s = (v: unknown, n: number) => String(v ?? '').slice(0, n);

export function cleanPins(raw: unknown): TeacherPin[] {
  return (Array.isArray(raw) ? raw : []).slice(0, 2000).filter((p) => p && p.key && p.dna).map((p) => ({ key: s(p.key, 60), preview: s(p.preview, 100), dna: s(p.dna, 80), at: s(p.at, 40) || new Date().toISOString() }));
}

/** Only teacher-video templates are accepted from the network (the AI's own learned ones stay in each browser). */
export function cleanTemplates(raw: unknown): LearnedDna[] {
  const out: LearnedDna[] = [];
  for (const t of (Array.isArray(raw) ? raw : []).slice(0, 200)) {
    if (!t || t.source !== 'teacher-video' || !t.id || !Array.isArray(t.segments) || !t.segments.length) continue;
    out.push({
      id: s(t.id, 60), name: s(t.name, 80), description: s(t.description, 600), kinds: Array.isArray(t.kinds) ? t.kinds.slice(0, 8) : ['problem'], keywords: (Array.isArray(t.keywords) ? t.keywords : []).slice(0, 14).map((k: unknown) => s(k, 40)),
      segments: t.segments.slice(0, 8).map((x: unknown) => s(x, 40)), example: { segments: [] }, createdAt: s(t.createdAt, 40) || new Date().toISOString(), source: 'teacher-video',
      styleNotes: s(t.styleNotes, 1200), stepsOutline: (Array.isArray(t.stepsOutline) ? t.stepsOutline : []).slice(0, 14).map((x: unknown) => s(x, 200)), sourceName: s(t.sourceName, 120),
    } as LearnedDna);
  }
  return out;
}

/** Replace the teacher's pins and templates (one write at a time). */
export function writeState(raw: { pins?: unknown; templates?: unknown }): Promise<TeacherDnaState> {
  const state = { pins: cleanPins(raw.pins), templates: cleanTemplates(raw.templates) };
  return docs.put(KEY, state).then(() => state);
}
