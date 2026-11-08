/** A textbook passage (any subject) → teaching blocks for the Motion Class pipeline (V51.9.51). */

import { teachingUnits, type BookBlock } from './segment';
import { sentences } from './reading';

/** A passage → teaching blocks (about four sentences each) the Motion Class pipeline understands. */
export function passageBlocks(passage: string, heading: string | undefined, key: string): BookBlock[] {
  const clean = passage.replace(/\s+/g, ' ').trim();
  const list = sentences(clean);
  const groups: string[] = [];
  for (let i = 0; i < list.length; i += 4) groups.push(list.slice(i, i + 4).join(' '));
  if (!groups.length && clean) groups.push(clean);
  const blocks: BookBlock[] = groups.map((text, i) => ({
    id: `${key}-b${i}`,
    kind: text.includes('?') && text.length < 240 ? 'problem' : 'prose',
    page: 1,
    chapterId: 'c',
    sectionId: 's',
    lines: [{ text, math: false }],
    text,
  }));
  return teachingUnits(blocks);
}
