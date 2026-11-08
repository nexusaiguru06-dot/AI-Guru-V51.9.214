/**
 * V51.9.95 (server only): creating study materials on the AI Guru cloud — with the school's key, for the admin and (when
 * allowed) for students who have no key of their own. One job = one material type for one part of one book. Jobs run on
 * the server two at a time; a finished material is saved to the library under who asked for it, exactly like a material
 * made in Material Studio (the same pipeline and the same QA gate).
 *
 * V51.9.177 (Cloud Run): jobs are saved records (lib/ai-guru/storage → PostgreSQL on Cloud Run), not memory. So:
 *  - every copy of the app sees the same jobs (status, the daily limit and the "already being made" check are shared);
 *  - a job is claimed with a locked change, so two copies never run the same job;
 *  - a running job writes a heartbeat every 20 s; a job whose heartbeat stops (the copy was shut down) is put back in the
 *    queue once, and any copy picks it up on its next look at the queue (every status request looks);
 *  - finished jobs older than 7 days are removed.
 * Cloud Run must keep the CPU on after a reply (`--no-cpu-throttling`, set in cloudbuild.yaml), or work stalls.
 */
import { readData } from '../admin/store';
import { docs } from '../storage';
import { entitlement, istToday } from '../admin/enrolment';
import { planViewOf } from '../admin/content-access';
import { lockedPartsOf } from '../material-studio/locks';
import { ownsBook } from './requester';
import { generateMaterial } from '../material-studio/pipeline';
import { getDocument, listMaterials, saveMaterial } from '../material-studio/store';
import { buildStudyParts, partOfMaterial } from '../material-studio/parts';
import type { MaterialType, StudyMaterial } from '../material-studio/types';
import { MATERIAL_TYPES } from '../material-studio/types';
import type { Owner } from './catalog';
import type { Guest, Requester } from './requester';

export async function cloudKeyFor(who: Requester | Guest | null): Promise<string | undefined> {
  if (!who || who.kind === 'guest') return undefined; // V51.9.107: guests never use the AI Guru cloud key
  const s = (await readData()).settings.library;
  const key = s.cloudKey || process.env.GEMINI_API_KEY || undefined;
  if (who.kind === 'admin') return key;
  return undefined; // V51.9.187: students create with their own key only (the school cloud is the office's)
}

export interface Job {
  id: string; documentId: string; part: number; type: MaterialType;
  status: 'queued' | 'running' | 'done' | 'failed'; error?: string; materialId?: string; by: Owner; createdAt: string; finishedAt?: string;
  /** V51.9.177: who is running it, when it last showed signs of life, and how many times it was started */
  runner?: string; heartbeatAt?: string; attempts?: number;
}
type Generate = typeof generateMaterial;

const DIR = 'data/ai-guru/library/jobs';
const keyOf = (id: string) => `${DIR}/${id}.json`;
const MAX_RUNNING = 2;            // jobs at once in one copy of the app
const HEARTBEAT_MS = 20_000;
const STALE_MS = 3 * 60_000;      // no heartbeat for 3 minutes = that copy is gone
const MAX_ATTEMPTS = 2;
const KEEP_MS = 7 * 86_400_000;
const RUNNER = `r_${process.pid}_${Math.random().toString(36).slice(2, 8)}`;

let running = 0;
let generate: Generate = generateMaterial;
/** Tests replace the AI call. */
export const setGenerator = (g: Generate | null) => { generate = g ?? generateMaterial; };
/** Tests: forget every job. */
export const resetJobs = async () => { for (const k of await docs.keys(DIR)) await docs.del(k); running = 0; };

const allJobs = async () => (await docs.values<Job>(DIR)).filter((j) => j && j.id);
export async function jobsFor(by?: { kind: 'admin' } | { kind: 'student'; id: string }): Promise<Job[]> {
  return (await allJobs()).filter((j) => !by || (by.kind === 'admin' ? true : j.by.kind === 'student' && j.by.id === by.id)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
export const getJob = async (id: string) => (/^job_[a-z0-9]+$/.test(id) ? docs.get<Job>(keyOf(id)) : null);
const active = (j: Job) => j.status === 'queued' || j.status === 'running';

/** Materials (made on the cloud) plus jobs started by this student today. */
async function usedToday(studentId: string): Promise<number> {
  const today = istToday();
  const istDay = (iso: string) => istToday(Date.parse(iso));
  const saved = (await listMaterials()).filter((m) => m.owner?.kind === 'student' && m.owner.id === studentId && m.owner.via === 'cloud' && istDay(m.createdAt) === today).length;
  const pending = (await allJobs()).filter((j) => j.by.kind === 'student' && j.by.id === studentId && active(j)).length;
  return saved + pending;
}

export type EnqueueResult = { type: MaterialType; job?: Job; existing?: string; error?: string };

/** Asks for materials; a type that already exists for that part (and is visible) is not made again. */
export async function requestCloudMaterials(who: Requester, documentId: string, part: number, types: string[]): Promise<{ ok: true; results: EnqueueResult[] } | { ok: false; error: string; status: number }> {
  const key = await cloudKeyFor(who);
  if (!key) return { ok: false, status: 403, error: who.kind === 'admin' ? 'No cloud AI key: add one in Study materials → Cloud settings (or set GEMINI_API_KEY on the server).' : 'Students create study materials with their own free Gemini key, in Material Studio.' };
  const doc = await getDocument(documentId);
  if (!doc || (doc.hidden && who.kind !== 'admin')) return { ok: false, status: 404, error: 'Book not found' };
  const parts = buildStudyParts(doc);
  if (!parts.some((p) => p.index === part && p.sourceIds.length)) return { ok: false, status: 400, error: `Part ${part} has no readable text` };
  const wanted = [...new Set(types)].filter((t): t is MaterialType => (MATERIAL_TYPES as readonly string[]).includes(t));
  if (!wanted.length) return { ok: false, status: 400, error: 'Choose at least one material type' };
  const data = await readData();
  // a student may only create for parts they can open (the free parts, or every part once enrolled, or their own upload)
  if (who.kind === 'student') {
    const e = entitlement({ settings: data.settings.access, isAdmin: false, student: who.student, invoices: data.invoices, classes: data.classes, today: istToday(), plan: planViewOf(data) });
    const { lockedParts } = lockedPartsOf(doc, data.settings.access.freeParts, e.full || ownsBook(doc, who.student.id), e.paidParts);
    if (lockedParts.includes(part)) return { ok: false, status: 403, error: `Part ${part} opens when you are enrolled` };
  }
  const have = (await listMaterials(documentId)).filter((m) => !m.hidden && !m.school); // V51.9.193: a school teacher's version is not the shared one
  const owner: Owner = who.kind === 'admin' ? { kind: 'admin', via: 'cloud' } : { kind: 'student', id: who.student.id, name: who.student.name, via: 'cloud' };
  let left = who.kind === 'student' ? data.settings.library.dailyLimit - (await usedToday(who.student.id)) : Infinity;
  const current = (await allJobs()).filter(active);
  const results: EnqueueResult[] = [];
  for (const type of wanted) {
    const existing = have.find((m) => m.type === type && partOfMaterial(m, parts) === part);
    if (existing) { results.push({ type, existing: existing.id }); continue; }
    const same = current.find((j) => j.documentId === documentId && j.part === part && j.type === type);
    if (same) { results.push({ type, job: same }); continue; }
    if (left <= 0) { results.push({ type, error: `Daily limit reached (${data.settings.library.dailyLimit} a day)` }); continue; }
    left--;
    const job: Job = { id: `job_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, documentId, part, type, status: 'queued', by: owner, createdAt: new Date().toISOString(), attempts: 0 };
    await docs.put(keyOf(job.id), job);
    current.push(job);
    results.push({ type, job });
  }
  void pump();
  return { ok: true, results };
}

/** The key a job runs with: the school's cloud key (Cloud settings) or the server's GEMINI_API_KEY. The job was approved
 *  for a signed-in admin or student when it was asked for, so the server key is allowed here. */
async function runKey(): Promise<string | undefined> {
  const s = (await readData()).settings.library;
  return s.cloudKey || process.env.GEMINI_API_KEY || undefined;
}

/** Claims one queued job for this copy of the app (a locked change: two copies never take the same job). */
async function claim(id: string): Promise<Job | null> {
  const now = new Date().toISOString();
  return docs.update<Job, Job | null>(keyOf(id), (j) => {
    if (!j) return { value: undefined, result: null }; // deleted meanwhile: write nothing
    const stale = j.status === 'running' && Date.now() - Date.parse(j.heartbeatAt ?? j.createdAt) > STALE_MS;
    if (j.status !== 'queued' && !stale) return { value: j, result: null };
    if ((j.attempts ?? 0) >= MAX_ATTEMPTS) {
      const failed: Job = { ...j, status: 'failed', error: 'The server stopped while making this. Please ask again.', finishedAt: now };
      return { value: failed, result: null };
    }
    const mine: Job = { ...j, status: 'running', runner: RUNNER, heartbeatAt: now, attempts: (j.attempts ?? 0) + 1 };
    return { value: mine, result: mine };
  });
}

let pumping = false;
/** Looks at the queue: starts queued jobs (and jobs whose copy of the app went away) up to MAX_RUNNING, and tidies old ones. */
export async function pump(): Promise<void> {
  if (pumping) return;
  pumping = true;
  try {
    const all = await allJobs();
    const now = Date.now();
    for (const j of all) if (!active(j) && now - Date.parse(j.finishedAt ?? j.createdAt) > KEEP_MS) await docs.del(keyOf(j.id)).catch(() => undefined);
    const waiting = all
      .filter((j) => j.status === 'queued' || (j.status === 'running' && now - Date.parse(j.heartbeatAt ?? j.createdAt) > STALE_MS))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    for (const j of waiting) {
      if (running >= MAX_RUNNING) break;
      const job = await claim(j.id);
      if (!job) continue;
      const key = await runKey();
      running++;
      void run(job, key).finally(() => { running--; void pump(); });
    }
  } catch (e) {
    console.error('[library] could not look at the job queue', e);
  } finally {
    pumping = false;
  }
}

// write the result unless another copy has taken the job over (after this copy looked gone)
const save = (job: Job) => docs.update<Job, void>(keyOf(job.id), (cur) => ({ value: cur && cur.runner && cur.runner !== RUNNER ? undefined : job, result: undefined }));

/** Runs one job: the same scope, pipeline and QA gate as Material Studio. */
async function run(job: Job, key: string | undefined) {
  const beat = setInterval(() => { void docs.update<Job, void>(keyOf(job.id), (cur) => ({ value: cur && cur.runner === RUNNER && cur.status === 'running' ? { ...cur, heartbeatAt: new Date().toISOString() } : undefined, result: undefined })).catch(() => undefined); }, HEARTBEAT_MS);
  try {
    if (!key) throw new Error('No cloud AI key: add one in Study materials → Cloud settings (or set GEMINI_API_KEY on the server).');
    const doc = await getDocument(job.documentId);
    if (!doc) throw new Error('Book not found');
    const part = buildStudyParts(doc).find((p) => p.index === job.part);
    if (!part) throw new Error(`Part ${job.part} not found`);
    const scope = { id: part.id, title: `${part.title} · pp. ${part.startPage}–${part.endPage}`, startPage: part.startPage, endPage: part.endPage, sourceIds: part.sourceIds };
    const m: StudyMaterial = await generate(doc.id, job.type, doc.sources, doc.teachingLanguage || 'malayalam', key, scope.id, [...doc.chapters, scope]);
    if (m.qa.status !== 'passed' || Number(m.qa.score || 0) < 85) throw new Error(`QA gate not passed (${m.qa.status}, ${m.qa.score}/100). ${m.qa.issues?.slice(0, 3).join(' ') ?? ''}`.trim());
    const review = (await readData()).settings.library.reviewStudentWork && job.by.kind === 'student';
    const saved = await saveMaterial({ ...m, owner: job.by, hidden: review || undefined });
    job.materialId = saved.id; job.status = 'done';
  } catch (e) {
    job.status = 'failed'; job.error = e instanceof Error ? e.message.slice(0, 300) : String(e);
  } finally {
    clearInterval(beat);
    job.finishedAt = new Date().toISOString();
    await save(job).catch((e) => console.error('[library] could not save the job result', e));
  }
}
