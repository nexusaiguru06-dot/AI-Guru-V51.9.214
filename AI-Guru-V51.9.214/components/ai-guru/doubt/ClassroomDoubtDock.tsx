'use client';
/**
 * ClassroomDoubtDock — mounts the RAG Classroom's camera / mic / text doubt pane (components/DoubtCameraMic.tsx, copied
 * as it was) inside AI Guru's classroom. The pane keeps its own look and behaviour; this wrapper only gives it the
 * student's class and language, and keeps a failure in the pane from ever stopping the lesson.
 * Inside a Motion class the pane also sees the board, reads the chapter and can start a micro class
 * (lib/ai-guru/doubt/lesson-bridge.ts).
 */
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { DoubtCameraMic } from '@/components/DoubtCameraMic';

class DoubtDockBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Camera/microphone doubt pane failed without interrupting the lesson', error, info);
  }
  render() {
    if (this.state.failed) {
      return <div role="status" className="fixed bottom-4 right-4 z-[9999] rounded-xl border border-amber-400/40 bg-[#0b1017] px-4 py-3 text-xs text-white shadow-xl">Camera/mic pane needs a refresh. Your lesson is safe.</div>;
    }
    return this.props.children;
  }
}

export function ClassroomDoubtDock({ grade, language, boardId = 'kerala' }: { grade: number | string; language: 'english' | 'malayalam'; boardId?: string }) {
  return (
    <DoubtDockBoundary>
      <DoubtCameraMic grade={String(grade)} boardId={boardId} languageId={language} teachingStyle="target_with_english_terms" />
    </DoubtDockBoundary>
  );
}
