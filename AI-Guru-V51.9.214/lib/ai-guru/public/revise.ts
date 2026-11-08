import type { PublicLesson } from './lessons';

export interface RevisePack { slug: string; title: PublicLesson['title']; minutes: Array<{ min: number; what: string }>; points: PublicLesson['steps']; examples: Array<{ q: string; a: string; why: string }> }
/** "Revise in 10 minutes": the key points, worked examples from the quiz, and a 10-minute plan. Built from the lesson, so it never disagrees with it. */
export function revisePack(l: PublicLesson): RevisePack {
  return {
    slug: l.slug, title: l.title, points: l.steps,
    examples: l.quiz.map((x) => ({ q: x.q.en, a: x.options[x.answer].en, why: x.why.en })),
    minutes: [{ min: 3, what: 'Read the key points aloud once, then cover them and say them again' }, { min: 4, what: 'Do the worked examples without looking at the answers' }, { min: 3, what: 'Check, then redo any you missed with the quiz on the lesson page' }],
  };
}
