'use client';

/**
 * V51.9.115 — the main menu on every AI Guru page. Pages that already draw the menu themselves (inside their own
 * full-height layout) are left as they are; every other page (sign-in, sign-up, student, teacher, parent, library,
 * 3D Lab, quizzes, safety, admin …) gets it at the top, so no page is a dead end.
 */
import { usePathname } from 'next/navigation';
import { AiGuruTopNav } from './AiGuruTopNav';
import { RewardCelebration } from './quiz/RewardCelebration';

/** Pages that render <AiGuruTopNav /> themselves. */
export const OWN_NAV = ['/ai-guru/classroom', '/ai-guru/reels', '/ai-guru/material-studio', '/ai-guru/settings', '/ai-guru/student/paper', '/ai-guru/teacher-notes'];

export const hasOwnNav = (pathname: string) => OWN_NAV.some((p) => pathname === p || pathname.startsWith(`${p}/`));

export function AiGuruShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || '';
  return (
    <>
      {!hasOwnNav(pathname) && <AiGuruTopNav />}
      {children}
      {/* V51.9.117: the flying chilli / toffee, its sound and voice, wherever a reward is earned */}
      <RewardCelebration />
    </>
  );
}
