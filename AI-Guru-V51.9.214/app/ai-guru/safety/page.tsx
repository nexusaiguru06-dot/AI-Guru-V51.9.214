import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'How your child’s data is kept safe', description: 'What AI Guru stores about students, who can see it, and how it is protected.', alternates: { canonical: '/ai-guru/safety' } };

const rows: Array<[string, string]> = [
  ['What we ask for', 'Name, class, school, place and a password. No photo, no phone number and no email is needed to learn.'],
  ['Passwords', 'Never stored as typed. They are stored as a one-way scrambled value, so even the office cannot read them.'],
  ['Who can see a student’s results', 'The student, the parent who has the parent code, the teacher of the class, and the school office. Nobody else.'],
  ['What other students see', 'On class and school leaderboards only a first name and the first letter of the last name, with star points. Never a phone number, address or full name.'],
  ['What parents get', 'A weekly summary they can read or forward on WhatsApp. Parents choose whether to share it.'],
  ['Sharing pictures', 'The score card and clips a child shares carry only the name they choose to show and an invite link. Nothing else about the child leaves the app.'],
  ['Class codes and teacher keys', 'A class code only lets a student join. A teacher’s private key opens only that teacher’s class page, and the office can replace it at any time.'],
  ['Asking us to delete', 'A parent can ask the school office to remove a child’s account and records.'],
];
export default function SafetyPage() {
  return (
    <main className="min-h-screen bg-[#06101c] px-4 py-10 text-slate-100 sm:px-8"><div className="mx-auto max-w-3xl">
      <a href="/ai-guru/learn" className="rounded-lg border border-white/15 px-3 py-2 text-xs font-bold">← Free lessons</a>
      <h1 className="mt-6 text-3xl font-extrabold">How your child’s data is kept safe</h1>
      
      <dl className="space-y-4">{rows.map(([k, v]) => <div key={k} className="rounded-2xl border border-white/10 bg-white/[.04] p-4"><dt className="font-extrabold text-cyan-300">{k}</dt><dd className="mt-1 text-slate-200">{v}</dd></div>)}</dl>
    </div></main>
  );
}
