'use client';

/**
 * A question inside the animation (V51.9.50): drawn over the paused board.
 *   tap    — the student taps an object on the board itself; the board shows which ones were right.
 *   choice — the student picks one answer before the board reveals it.
 * Pointer events stop here, so a tap never also toggles the player underneath.
 */

import { useMemo, useState } from 'react';
import type { FrameTarget, PlacedQuestion } from '@/lib/ai-guru/motion-class/interactive/questions';
import { gradeChoice, gradeTap, pickBi } from '@/lib/ai-guru/motion-class/interactive/questions';

const ML_FONT = '"Chilanka", "Noto Sans Malayalam", "Nirmala UI", system-ui, sans-serif';

export interface QuestionAnswer {
  correct: boolean;
  skipped: boolean;
  picked: string | null;
}

export function ClassQuestionOverlay(props: {
  question: PlacedQuestion;
  /** Tap targets in frame pixels (empty for choice questions). */
  targets: FrameTarget[];
  /** Frame size the targets are in (the canvas width/height attributes). */
  frame: { width: number; height: number };
  /** Called once, with the first answer (or a skip). */
  onAnswer: (a: QuestionAnswer) => void;
  /** Close the card and carry on teaching. */
  onContinue: () => void;
}) {
  const { question: q, targets, frame } = props;
  const lang = q.lang;
  const [result, setResult] = useState<QuestionAnswer | null>(null);
  const [miss, setMiss] = useState(false);
  const font = lang === 'ml' ? { fontFamily: ML_FONT } : undefined;
  const pct = (v: number, of: number) => `${(v / of) * 100}%`;
  const shown = useMemo(() => targets, [targets]);
  // Keep the card off the tap targets: when they all sit in the upper part of the board, the card goes to the bottom.
  const cardAtBottom = shown.length > 0 && Math.max(...shown.map((t) => t.y + t.h / 2)) < frame.height * 0.6;

  const answer = (a: QuestionAnswer) => {
    if (result) return;
    setResult(a);
    props.onAnswer(a);
  };

  const onBoardTap = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (q.kind !== 'tap' || result) return;
    const r = e.currentTarget.getBoundingClientRect();
    const fx = ((e.clientX - r.left) / r.width) * frame.width;
    const fy = ((e.clientY - r.top) / r.height) * frame.height;
    const g = gradeTap(shown, fx, fy);
    if (!g.picked) {
      // Tapped empty board: not an answer yet, just a hint to tap a tile.
      setMiss(true);
      return;
    }
    answer({ correct: g.correct, skipped: false, picked: g.picked });
  };

  const say = (en: string, ml: string) => (lang === 'ml' ? ml : en);

  return (
    <div
      className="absolute inset-0 z-20"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        // Space / arrows must not reach the player's keyboard controller while a question is open.
        if (e.key !== 'Tab') e.stopPropagation();
      }}
      role="dialog"
      aria-label={say('Question', 'ചോദ്യം')}
    >
      {/* Tap layer over the board (frame-aligned). */}
      {q.kind === 'tap' && (
        <div className={`absolute inset-0 ${result ? '' : 'cursor-pointer'}`} onPointerUp={onBoardTap}>
          {shown.map((t) => {
            const picked = result?.picked === t.id;
            const reveal = !!result;
            const ring = reveal ? (t.correct ? 'ring-4 ring-emerald-500 bg-emerald-400/15' : picked ? 'ring-4 ring-rose-500 bg-rose-400/15' : '') : 'ring-2 ring-violet-400/50 hover:bg-violet-400/10';
            return (
              <div
                key={t.id}
                className={`pointer-events-none absolute rounded-md transition ${ring}`}
                style={{ left: pct(t.x - t.w / 2, frame.width), top: pct(t.y - t.h / 2, frame.height), width: pct(t.w, frame.width), height: pct(t.h, frame.height) }}
              />
            );
          })}
        </div>
      )}

      {/* Question card (top of the board, over the title area). */}
      <div
        className={`pointer-events-auto absolute left-1/2 w-[min(92%,760px)] -translate-x-1/2 rounded-2xl border-2 border-[#b3202a] bg-white/95 p-3 text-[#150b55] shadow-xl ${cardAtBottom ? 'bottom-2' : 'top-2'}`}
        style={font}
      >
        <div className="flex items-start gap-2">
          <span className="rounded-full bg-[#b3202a] px-2 py-0.5 text-[11px] font-bold text-white">{say('YOUR TURN', 'നിങ്ങളുടെ ഊഴം')}</span>
          <p className="flex-1 text-sm font-semibold leading-snug sm:text-base">{pickBi(q.prompt, lang)}</p>
        </div>

        {q.kind === 'choice' && (
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {q.options?.map((o) => {
              const picked = result?.picked === o.id;
              const cls = result ? (o.correct ? 'bg-emerald-500 text-white' : picked ? 'bg-rose-500 text-white' : 'bg-[#efeefa] text-[#150b55]/60') : 'bg-[#efeefa] hover:bg-violet-200';
              return (
                <button
                  key={o.id}
                  type="button"
                  disabled={!!result}
                  className={`rounded-xl px-3 py-2 text-base font-bold ${cls}`}
                  onClick={() => answer({ ...gradeChoice(q, o.id), skipped: false })}
                >
                  {pickBi(o.text, lang)}
                </button>
              );
            })}
          </div>
        )}

        {q.kind === 'tap' && !result && (
          <p className="mt-1 text-xs text-[#150b55]/70">{miss ? say('Tap one of the tiles on the board.', 'ബോർഡിലെ ഒരു ഓട് തൊടുക.') : say('Tap it on the board.', 'ബോർഡിൽ തൊടുക.')}</p>
        )}

        {result && (
          <p className={`mt-2 text-sm ${result.correct ? 'text-emerald-700' : result.skipped ? 'text-[#150b55]/80' : 'text-rose-700'}`}>
            <b>{result.skipped ? say('Answer: ', 'ഉത്തരം: ') : result.correct ? say('Correct! ', 'ശരി! ') : say('Not quite. ', 'അല്ല. ')}</b>
            {pickBi(q.explain, lang)}
          </p>
        )}

        <div className="mt-2 flex justify-end gap-2">
          {!result && (
            <button type="button" className="rounded-lg px-3 py-1 text-xs text-[#150b55]/70 hover:bg-black/5" onClick={() => answer({ correct: false, skipped: true, picked: null })}>
              {say('Show answer', 'ഉത്തരം കാണിക്കുക')}
            </button>
          )}
          {result && (
            <button type="button" autoFocus className="rounded-lg bg-[#150b55] px-4 py-1.5 text-sm font-bold text-white" onClick={props.onContinue}>
              {say('Continue ▶', 'തുടരുക ▶')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
