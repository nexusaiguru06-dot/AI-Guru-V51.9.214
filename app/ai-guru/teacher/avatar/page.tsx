'use client';
import { Shell, TeacherNav } from '@/components/ai-guru/quiz/ReportBits';
import { AvatarSetup } from '@/components/ai-guru/teacher/AvatarSetup';
import { AVATARS } from '@/lib/ai-guru/features';

/** V51.9.100 — Teacher portal · My avatar: your face (and voice) in the corner of reels, lips moving with the voice. */
export default function TeacherAvatarPage() {
  // V51.9.122: avatars are switched off app-wide (lib/ai-guru/features.ts); this page only says so
  if (!AVATARS) {
    return (
      <Shell title="My avatar" sub="Not used in AI Guru now">
        <TeacherNav current="results" />
        <p className="max-w-xl rounded-2xl border border-white/10 bg-white/[.04] p-4 text-sm text-slate-300">Avatars (a face in the corner of reels and classes) are turned off in AI Guru, to keep it simple. Reels and classes use the voice, the captions and the board.</p>
      </Shell>
    );
  }
  return (
    <Shell title="My avatar" sub="Your face in the corner of reels and videos, lips moving with the voice — your own voice too, if you like.">
      <TeacherNav current="avatar" />
      <AvatarSetup />
    </Shell>
  );
}
