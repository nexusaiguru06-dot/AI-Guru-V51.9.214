/**
 * Sections must be taught in the order of the source they cite (paper order / textbook order),
 * whatever order the model happened to emit them in. Stable: sections with the same position keep
 * their relative order; a section that cites nothing valid stays next to the section before it.
 */
export function orderSectionsBySource<T extends { sourceIds?: string[] }>(sections: T[], sources: Array<{ id: string }>): T[] {
  const position = new Map(sources.map((s, i) => [s.id, i]));
  let previous = -1;
  const keyed = sections.map((section, i) => {
    const hits = (section.sourceIds || []).map(id => position.get(String(id))).filter((n): n is number => typeof n === 'number');
    const pos = hits.length ? Math.min(...hits) : previous;
    previous = pos;
    return { section, pos, i };
  });
  return keyed.sort((a, b) => a.pos - b.pos || a.i - b.i).map(k => k.section);
}
