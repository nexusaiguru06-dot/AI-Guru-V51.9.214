/** Server only: what a link preview may say about an invite code (never the student's name). */
import { readData } from '../admin/store';
import { couponLabel, couponProblem } from '../admin/fees';
import { SITE_URL } from '../site';
import { isCode } from './join-code';
import type { InviteInfo } from './invite-preview';

export async function inviteInfo(code: string): Promise<InviteInfo> {
  if (!isCode(code)) return { code: '' };
  try {
    const data = await readData();
    const c = data.coupons.find((x) => x.code === code);
    if (couponProblem(c)) return { code: '' };
    const grp = c!.ownerClassId ? data.classes.find((g) => g.id === c!.ownerClassId) : undefined;
    return { code, group: grp?.name, offer: c!.value > 0 ? couponLabel(c!) : undefined };
  } catch {
    return { code: '' };
  }
}

/** The public origin for absolute preview URLs: NEXT_PUBLIC_SITE_URL when set (behind a proxy the request URL may be internal), else the request's own. */
export const publicOrigin = (req: Request): string => (process.env.NEXT_PUBLIC_SITE_URL ? SITE_URL : new URL(req.url).origin);
