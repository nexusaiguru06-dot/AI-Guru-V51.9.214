'use client';
import { useEffect, useState } from 'react';
import { Shell, TeacherNav } from '@/components/ai-guru/quiz/ReportBits';
import { SelectionLab } from '@/components/ai-guru/teacher/SelectionLab';
import { DnaLibrary } from '@/components/ai-guru/teacher/DnaLibrary';
import { VideoLearner } from '@/components/ai-guru/teacher/VideoLearner';
import { VideoMaker } from '@/components/ai-guru/teacher/VideoMaker';
import { pullTeacherDna } from '@/lib/ai-guru/teacher/sync';

const TABS = [['select', 'Selection test'], ['library', 'DNA library'], ['learn', 'Learn from a video'], ['make', 'Make videos']] as const;
type Tab = (typeof TABS)[number][0];

/** Teacher portal · templates (DNAs): see how a problem is matched to a template, choose one, learn from your own video, make videos. */
export default function TeacherDnaPage() {
  const [tab, setTab] = useState<Tab>('select');
  const [version, setVersion] = useState(0);
  const bump = () => setVersion((v) => v + 1);
  useEffect(() => { void pullTeacherDna().then(bump); }, []);
  return (
    <Shell title="Teacher portal · Templates" sub="How problems are matched to teaching templates (DNAs), and videos in your own style">
      <TeacherNav current="dna" />
      <nav className="mb-6 flex flex-wrap items-center gap-2" aria-label="Template tools">
        {TABS.map(([id, label]) => <button key={id} onClick={() => setTab(id)} aria-current={tab === id} className={`rounded-full px-4 py-2 text-sm font-extrabold ${tab === id ? 'bg-cyan-400 text-[#04121f]' : 'border border-white/15 text-slate-200 hover:bg-white/5'}`}>{label}</button>)}
      </nav>
      {tab === 'select' && <SelectionLab version={version} onChange={bump} />}
      {tab === 'library' && <DnaLibrary version={version} onChange={bump} />}
      {tab === 'learn' && <VideoLearner onSaved={() => { bump(); setTab('make'); }} />}
      {tab === 'make' && <VideoMaker version={version} />}
    </Shell>
  );
}
