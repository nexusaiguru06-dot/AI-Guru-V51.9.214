/**
 * Admin data (server only): students with addresses, fee heads, invoices with payments, coupons, classes, the registers,
 * school settings.
 *
 * V51.9.178 — one record per item instead of one record for the whole school. Each student, invoice, coupon, class,
 * payout and register entry is its own row (files on a laptop, PostgreSQL on Cloud Run); the settings, counters and the
 * order of each list are one small "core" record. `update(fn)` keeps its old meaning — `fn` gets the whole school and
 * changes it — but only the rows that changed are written, in one transaction. An old single-file `records.json` is
 * split into rows the first time it is used (and kept as `records.migrated.json`).
 */
import type { SchoolTerms } from '../schools/rules';
import { docs, type DocReader, type DocTx } from '../storage';
import { inOrder, readRows, stableJson, writeRows } from '../storage/rows';
import type { Coupon, FeeHead, Invoice, Student } from './fees';
import { emptyAddress, type Address } from './address';
import { DEFAULT_GROUPS, type ClassGroup, type GroupSettings } from './groups';
import { nextCode, syncCounters } from './member-codes';
import { DEFAULT_AFFILIATE, referralCodeFor, referralCoupon, type AffiliateSettings, type Payout } from './affiliate';
import { DEFAULT_ACCESS, type AccessSettings } from './enrolment';
import { DEFAULT_PLANS, type MonthlyRecord, type PlanSettings, type YearlyRecord } from './plans';
import { DEFAULT_LIBRARY, type LibrarySettings } from '../library/settings';

const KEY = 'data/ai-guru/admin/records.json'; // V51.9.173: files on localhost, PostgreSQL on Cloud Run

export interface AdminData {
  students: Student[];
  heads: FeeHead[];
  invoices: Invoice[];
  school: { name: string; address: Address };
  receiptCounter: number;
  /** Students who asked for a new PIN (newest last); the admin answers them in the Students tab. */
  pinRequests: Array<{ studentId: string; at: string }>;
  coupons: Coupon[];
  studentCounter: number;
  /** Last number given per kind and year, e.g. { 'ST-26': 123, 'TE-26': 34 }. */
  idCounters: Record<string, number>;
  settings: { signupNeedsCoupon: boolean; affiliate: AffiliateSettings; groups: GroupSettings; /** V51.9.93: which book parts are free, and whether the rest is locked for students who have not paid. */ access: AccessSettings; /** V51.9.94: monthly fee per standard, yearly reduction %, grace days. */ plans: PlanSettings; /** V51.9.95: the study-material cloud. */ library: LibrarySettings; /** V51.9.193: default terms for a new contracted school. */ schools?: SchoolTerms };
  payouts: Payout[];
  /** Classes and tuition centres with their join codes. */
  classes: ClassGroup[];
  /** V51.9.94: the yearly register — one row per 12-month advance payment. */
  yearly: YearlyRecord[];
  /** V51.9.94: the monthly register — one row per monthly bill. */
  monthly: MonthlyRecord[];
}

/** The next student number: ST-1-26, ST-2-26 … (older AIG0042 ids keep working). */
export const nextStudentCode = (d: AdminData, now: Date = new Date()) => { syncCounters(d.idCounters, d.students.map((s) => s.studentCode)); return nextCode(d.idCounters, 'ST', now); };
/** The next teacher number: TE-1-26 … */
export const nextTeacherCode = (d: AdminData, now: Date = new Date()) => { syncCounters(d.idCounters, d.classes.map((c) => c.teacherCode)); return nextCode(d.idCounters, 'TE', now); };
const fresh = (): AdminData => ({ students: [], heads: [], invoices: [], school: { name: '', address: emptyAddress() }, receiptCounter: 0, pinRequests: [], coupons: [], studentCounter: 0, idCounters: {}, settings: { signupNeedsCoupon: false, affiliate: { ...DEFAULT_AFFILIATE }, groups: { ...DEFAULT_GROUPS, tiers: DEFAULT_GROUPS.tiers.map((t) => ({ ...t })) }, access: { ...DEFAULT_ACCESS, freeParts: [...DEFAULT_ACCESS.freeParts] }, plans: { ...DEFAULT_PLANS, prices: [] }, library: { ...DEFAULT_LIBRARY } }, payouts: [], classes: [], yearly: [], monthly: [] });

const normalise = (d: Partial<AdminData> | null): AdminData => {
  if (!d || typeof d !== 'object') return fresh();
  const f = fresh();
  return { ...f, ...d, settings: { ...f.settings, ...(d.settings ?? {}), affiliate: { ...f.settings.affiliate, ...(d.settings?.affiliate ?? {}) }, groups: { ...f.settings.groups, ...(d.settings?.groups ?? {}) }, access: { ...f.settings.access, ...(d.settings?.access ?? {}) }, plans: { ...f.settings.plans, ...(d.settings?.plans ?? {}) }, library: { ...f.settings.library, ...(d.settings?.library ?? {}) } }, classes: d.classes ?? [], yearly: d.yearly ?? [], monthly: d.monthly ?? [], idCounters: { ...(d.idCounters ?? {}) } };
};

const DIR = 'data/ai-guru/admin';
const CORE = `${DIR}/core.json`;
const LEGACY = KEY;
const LOCK = 'admin-records';

/** The lists kept as rows, with the field that names each item. */
const LISTS = {
  students: (x: Student) => x.id,
  heads: (x: FeeHead) => x.id,
  invoices: (x: Invoice) => x.id,
  coupons: (x: Coupon) => x.code,
  payouts: (x: Payout) => x.id,
  classes: (x: ClassGroup) => x.id,
  yearly: (x: YearlyRecord) => x.id,
  monthly: (x: MonthlyRecord) => x.id,
  pinRequests: (x: { studentId: string; at: string }) => x.studentId,
} as const;
type ListName = keyof typeof LISTS;
const LIST_NAMES = Object.keys(LISTS) as ListName[];
const dirOf = (l: ListName) => `${DIR}/${l === 'pinRequests' ? 'pin-requests' : l}`;

type Core = Omit<AdminData, ListName> & { order?: Partial<Record<ListName, string[]>>; layout?: 'rows-v1' };

interface Loaded { data: AdminData; before: Record<ListName, Map<string, string>>; coreJson: string | null }

async function load(tx: DocReader): Promise<Loaded> {
  const core = await tx.get<Core>(CORE);
  const before = {} as Record<ListName, Map<string, string>>;
  const lists = {} as Record<ListName, unknown[]>;
  for (const l of LIST_NAMES) {
    const rows = await readRows<unknown>(tx, dirOf(l));
    before[l] = new Map([...rows].map(([k, v]) => [k, stableJson(v)]));
    lists[l] = inOrder(rows, core?.order?.[l]);
  }
  const { order: _o, layout: _l, ...rest } = core ?? ({} as Core);
  return { data: normalise({ ...(rest as Partial<AdminData>), ...(lists as Partial<AdminData>) }), before, coreJson: core ? stableJson(core) : null };
}

async function save(tx: DocTx, d: AdminData, loaded: Loaded): Promise<void> {
  const order = {} as Record<ListName, string[]>;
  for (const l of LIST_NAMES) {
    const items = (d[l] ?? []) as unknown[];
    order[l] = await writeRows(tx, dirOf(l), loaded.before[l], items, LISTS[l] as (x: unknown) => string);
  }
  const rest: Record<string, unknown> = { ...d };
  for (const l of LIST_NAMES) delete rest[l];
  const core: Core = { ...(rest as Omit<AdminData, ListName>), order, layout: 'rows-v1' };
  const json = stableJson(core);
  if (json !== loaded.coreJson) await tx.put(CORE, core);
}

/** The first time: an old single-record school (records.json) becomes rows. Runs inside the write lock. */
async function migrate(tx: DocTx): Promise<void> {
  const old = await tx.get<Partial<AdminData>>(LEGACY); // a damaged file throws here and nothing is changed
  if (!old) return;
  const empty: Loaded = { data: fresh(), before: Object.fromEntries(LIST_NAMES.map((l) => [l, new Map()])) as Loaded['before'], coreJson: null };
  if (await tx.get(CORE)) {
    // rows already exist (e.g. data copied again from a laptop): the rows win, the old file is only kept as a backup
  } else {
    await save(tx, normalise(old), empty);
  }
  await tx.put(`${DIR}/records.migrated.json`, old);
  await tx.del(LEGACY);
}

export async function readData(): Promise<AdminData> {
  try {
    const first = await docs.snapshot(async (tx) => ((await tx.get(LEGACY)) ? null : load(tx)));
    if (first) return first.data;
    await docs.transaction(LOCK, async (tx) => { await migrate(tx); }); // an old records.json is still there: split it once
    return (await docs.snapshot((tx) => load(tx))).data;
  } catch (e) { console.error('[admin] could not read records', e); throw e; }
}

/** Read, change, write — one at a time (locked, also across Cloud Run instances), so two clicks never overwrite each
 *  other. V51.9.178: only the students, invoices, … that changed are written, all in one transaction. */
export async function update<T>(fn: (d: AdminData) => T | Promise<T>): Promise<T> {
  const r = await docs.transaction(LOCK, async (tx) => {
    await migrate(tx);
    const loaded = await load(tx);
    const out = await fn(loaded.data);
    await save(tx, loaded.data, loaded);
    return out;
  });
  return r;
}
export const newId = (p: string) => `${p}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;


/** Gives the student a personal affiliate code (and the coupon that carries it). Returns true if anything was added. */
export function ensureReferral(d: AdminData, st: Student): boolean {
  if (st.referralCode && d.coupons.some((c) => c.ownerStudentId === st.id)) return false;
  if (!st.referralCode) st.referralCode = referralCodeFor(st.name, new Set([...d.coupons.map((c) => c.code), ...d.students.map((s) => s.referralCode ?? '')]));
  if (!d.coupons.some((c) => c.ownerStudentId === st.id)) d.coupons.push(referralCoupon(st, d.settings.affiliate));
  return true;
}
