'use client';

/**
 * Step strip (V51.9.50): one cell per step of the class, as wide as the step is long. Click any cell
 * to jump there. Cells the student has already seen are filled; Teach / Read and the language are
 * shown by colour; a dot marks a step with a question inside the animation.
 */

import { useMemo } from 'react';
import type { ClassTimeline } from '@/lib/ai-guru/motion-class/interactive-player';

export function StepStrip(props: {
  timeline: ClassTimeline;
  current: number;
  visited: ReadonlySet<number>;
  /** step index → answered? (true = right, false = not yet / wrong) */
  questionSteps: ReadonlyMap<number, boolean | null>;
  onJump: (step: number) => void;
  /** Only the bar (no legend): for a board that has its own small controls (V51.9.57). */
  compact?: boolean;
}) {
  const { timeline: tl, current, visited, questionSteps } = props;
  const total = Math.max(1, tl.reel.durationMs);
  const cells = useMemo(
    () =>
      tl.steps.map((s) => {
        const seg = tl.segments[s.segment];
        return { s, seg, w: Math.max(0.15, ((s.t1 - s.t0) / total) * 100) };
      }),
    [tl, total],
  );
  return (
    <div className={props.compact ? '' : 'mt-2'} aria-label="Steps">
      <div className="flex h-5 w-full overflow-hidden rounded-md bg-white/[0.04]">
        {cells.map(({ s, seg, w }) => {
          const teach = seg?.phase === 'teach';
          const ml = seg?.lang === 'ml';
          const base = teach ? (ml ? 'bg-cyan-500' : 'bg-violet-500') : ml ? 'bg-cyan-300/60' : 'bg-violet-300/60';
          const seen = visited.has(s.index);
          const q = questionSteps.get(s.index);
          const first = tl.steps[s.index - 1]?.segment !== s.segment;
          return (
            <button
              key={s.index}
              type="button"
              onClick={() => props.onJump(s.index)}
              title={`${s.index + 1}. ${seg?.label ?? ''} — ${s.text}`}
              aria-label={`Go to step ${s.index + 1}: ${s.text}`}
              aria-current={current === s.index ? 'step' : undefined}
              className={`relative h-full min-w-[3px] ${first ? 'border-l-2 border-[#04101c]' : 'border-l border-[#04101c]/60'} ${base} ${seen ? 'opacity-100' : 'opacity-30'} ${current === s.index ? 'ring-2 ring-inset ring-white' : ''} hover:opacity-100`}
              style={{ width: `${w}%` }}
            >
              {q !== undefined && (
                <span className={`absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full ${q === true ? 'bg-emerald-300' : q === false ? 'bg-rose-300' : 'bg-amber-300'}`} />
              )}
            </button>
          );
        })}
      </div>
      {!props.compact && <div className="mt-1 flex flex-wrap gap-3 text-[10px] text-white/45">
        <span><i className="mr-1 inline-block h-2 w-2 rounded-sm bg-violet-500" />Teach EN</span>
        <span><i className="mr-1 inline-block h-2 w-2 rounded-sm bg-cyan-500" />Teach ML</span>
        <span><i className="mr-1 inline-block h-2 w-2 rounded-sm bg-violet-300/60" />Read</span>
        <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-amber-300" />Question</span>
        <span>Faded = not seen yet · click any step to jump</span>
      </div>}
    </div>
  );
}
