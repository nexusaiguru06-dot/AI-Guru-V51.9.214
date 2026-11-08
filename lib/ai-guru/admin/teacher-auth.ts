import { NextResponse } from 'next/server';
import { clientIp, lockedOut, noteMiss, verifyPin } from './auth';
import { readData, type AdminData } from './store';
import { normaliseCode } from './fees';
import type { ClassGroup } from './groups';

/** A teacher proves who they are with the class code and the 6-digit key. Wrong tries are counted per address. */
export async function openClass(request: Request, b: { code?: unknown; key?: unknown }): Promise<{ g: ClassGroup; data: AdminData } | { error: Response }> {
  const ip = clientIp(request);
  if (await lockedOut(`t:${ip}`)) return { error: NextResponse.json({ ok: false, error: 'Too many tries. Wait a few minutes.' }, { status: 429 }) };
  const data = await readData();
  const g = data.classes.find((x) => x.code === normaliseCode(b.code));
  if (!g || !verifyPin(String(b.key ?? '').trim(), g.key)) { await noteMiss(`t:${ip}`); return { error: NextResponse.json({ ok: false, error: 'The class code or key is not right' }, { status: 401 }) }; }
  return { g, data };
}
