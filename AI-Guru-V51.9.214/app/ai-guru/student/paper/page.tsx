'use client';
/**
 * V51.9.98 — "Ask about your paper": hold notes, homework or a question paper in front of the camera
 * (or choose a photo) and ask about it. Works with the student's own Gemini key; no sign-in needed.
 */
import { useEffect, useState } from 'react';
import { AiGuruTopNav } from '@/components/ai-guru/AiGuruTopNav';
import { PaperDoubt } from '@/components/ai-guru/doubt/PaperDoubt';
import { loadProfile } from '@/lib/ai-guru/student/profile';

export default function PaperDoubtPage() {
  const [grade, setGrade] = useState('8');
  const [language, setLanguage] = useState<'english' | 'malayalam'>('english');
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const std = parseInt(q.get('std') || loadProfile().standard, 10);
    if (std >= 1 && std <= 12) setGrade(String(std));
    if (q.get('lang') === 'ml') setLanguage('malayalam'); // English by default; the sheet has an EN / ML switch
    setReady(true);
  }, []);
  return (
    <div className="min-h-screen bg-[#050915]">
      <AiGuruTopNav activeLabel="Ask my paper" />
      {ready && <PaperDoubt grade={grade} language={language} mode="page" />}
    </div>
  );
}
