/**
 * Page layouts → book structure: chapters → sections → teaching blocks.
 *
 * A block is the unit the class teaches (read EN → teach EN → read ML → teach ML).
 * Block kinds (what the text IS, decided from layout + wording):
 *
 *   heading   section title ("Mental math and algebra")
 *   prose     explanation paragraph
 *   problem   a stated problem (indented problem box, or a question with data)
 *   math      a run of display equations (a worked chain, a pair of equations,
 *             or a "words → equation" table)
 *   result    a highlighted general result / rule / formula statement
 *   exercise  one numbered exercise "(3) The perimeter of a rectangle…"
 *   aside     side box / margin note (optional reading)
 */

import { layoutPage, type Fragment, type PageLayout, type RawItem } from './layout';

export type BlockKind = 'heading' | 'prose' | 'problem' | 'math' | 'result' | 'exercise' | 'aside';

export interface BlockLine {
  text: string;
  math: boolean;
  /** Words written to the left of an equation on the same row ("Price of 2 pens… → 2x + 3y = 110"). */
  label?: string;
}

export interface BookBlock {
  id: string;
  kind: BlockKind;
  page: number;
  chapterId: string;
  sectionId: string;
  lines: BlockLine[];
  /** Readable text (math lines included, one per line). */
  text: string;
}

export interface BookSection {
  id: string;
  title: string;
  page: number;
  blocks: BookBlock[];
}

export interface BookChapter {
  id: string;
  number?: number;
  title: string;
  startPage: number;
  sections: BookSection[];
}

export interface BookStructure {
  chapters: BookChapter[];
  /** Blocks in reading order (flattened). */
  blocks: BookBlock[];
}

interface Line {
  page: number;
  x0: number;
  y: number;
  size: number;
  text: string;
  math: boolean;
  label?: string;
  role: Fragment['role'];
}

const TERMINAL = /[.?!:;)]["']?$/;
const RESULT_CUE = /(general result|in general|result below|state (this|it)|we have the result|following result|the rule|thus we (get|have)|we can say)[^.]*[:,]?\s*$/i;
const EXERCISE = /^\(?(\d{1,2})[).]\s+\S/;
const PROBLEM_WORDS = /\?|\b(how many|how much|what is|what are|find|calculate|compute|what's)\b/i;

function titleCase(s: string): string {
  const t = s.replace(/\s+/g, ' ').trim();
  if (t !== t.toUpperCase()) return t;
  return t.toLowerCase().replace(/\b([a-z])/g, (m) => m.toUpperCase()).replace(/\b(Of|And|The|In|On|A|An)\b(?!$)/g, (m, w, i) => (i === 0 ? m : m.toLowerCase()));
}

/** Rows of a page in reading order, with same-row "label → equation" pairs merged. */
function pageLines(L: PageLayout): Line[] {
  const out: Line[] = [];
  const frags = L.fragments.filter((f) => f.role !== 'furniture');
  const rows: Fragment[][] = [];
  for (const f of frags) {
    const row = rows.find((r) => Math.abs(r[0].y - f.y) < L.bodySize * 0.45 && r[0].role === f.role);
    if (row) row.push(f);
    else rows.push([f]);
  }
  for (const row of rows) {
    row.sort((a, b) => a.x0 - b.x0);
    const role = row[0].role;
    if (row.length === 1) {
      const f = row[0];
      out.push({ page: L.page, x0: f.x0, y: f.y, size: f.size, text: f.text, math: f.math, role });
      continue;
    }
    const prose = row.filter((f) => !f.math);
    const maths = row.filter((f) => f.math);
    if (prose.length === 1 && maths.length >= 1 && prose[0].x0 < maths[0].x0) {
      out.push({ page: L.page, x0: prose[0].x0, y: row[0].y, size: row[0].size, text: maths.map((m) => m.text).join('   '), label: prose[0].text, math: true, role });
    } else if (row.every((f) => f.text.length < 24)) {
      // Table row ("Pencil Pen Price", "3 4 66").
      out.push({ page: L.page, x0: row[0].x0, y: row[0].y, size: row[0].size, text: row.map((f) => f.text).join('   '), math: true, role });
    } else {
      for (const f of row) out.push({ page: L.page, x0: f.x0, y: f.y, size: f.size, text: f.text, math: f.math, role });
    }
  }
  return out;
}

export interface SegmentOptions {
  /** Page height in PDF units (default A4-ish 792). */
  pageHeight?: number;
  /** First page that holds lesson content (skip covers, anthem, contents…). */
  firstContentPage?: number;
}

/** Segment a whole book. `pages[i]` = raw pdf.js items of page i+1. */
export function segmentBook(pages: RawItem[][], o: SegmentOptions = {}): BookStructure {
  const layouts = pages.map((items, i) => layoutPage(i + 1, items, o.pageHeight ?? 792));
  // One body size for the book keeps fraction/aside detection stable on sparse pages.
  const sizes = new Map<number, number>();
  for (const L of layouts) sizes.set(L.bodySize, (sizes.get(L.bodySize) ?? 0) + 1);
  const bookBody = [...sizes].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 13;
  const fixed = pages.map((items, i) => (layouts[i].bodySize === bookBody ? layouts[i] : layoutPage(i + 1, items, o.pageHeight ?? 792, bookBody)));
  return segmentLayouts(fixed, o);
}

export function segmentLayouts(layouts: PageLayout[], o: SegmentOptions = {}): BookStructure {
  const chapters: BookChapter[] = [];
  const blocks: BookBlock[] = [];
  let chapter: BookChapter | null = null;
  let section: BookSection | null = null;
  let seq = 0;
  let prevProse: BookBlock | null = null;

  const ensure = (page: number) => {
    if (!chapter) {
      chapter = { id: `ch${chapters.length + 1}`, title: 'Introduction', startPage: page, sections: [] };
      chapters.push(chapter);
    }
    if (!section) {
      section = { id: `${chapter.id}.s${chapter.sections.length + 1}`, title: chapter.title, page, blocks: [] };
      chapter.sections.push(section);
    }
    return { chapter: chapter!, section: section! };
  };

  const push = (kind: BlockKind, page: number, lines: BlockLine[]) => {
    const { chapter: c, section: s } = ensure(page);
    const b: BookBlock = {
      id: `b${++seq}`,
      kind,
      page,
      chapterId: c.id,
      sectionId: s.id,
      lines,
      text: lines.map((l) => (l.label ? `${l.label} → ${l.text}` : l.text)).join(kind === 'math' ? '\n' : ' ').replace(/[ \t]+/g, ' ').trim(),
    };
    s.blocks.push(b);
    blocks.push(b);
    return b;
  };

  // Front matter (cover, anthem, preface, contents) comes before the first chapter title.
  // A real chapter opening has a big title AND lesson text (a cover or a contents page has little).
  const firstTitled = layouts.find(
    (L) =>
      L.fragments.some((f) => f.role === 'chapter-title' && /[A-Za-z]{3,}/.test(f.text)) &&
      L.fragments.filter((f) => f.role === 'body' && !f.math).reduce((n, f) => n + f.text.length, 0) >= 400,
  )?.page;
  const firstPage = o.firstContentPage ?? firstTitled ?? 1;
  for (const L of layouts) {
    if (L.page < firstPage) continue;
    const lines = pageLines(L);

    // Chapter title (large letters, often split "P AIRS OF E QUATIONS").
    const big = lines.filter((l) => l.role === 'chapter-title');
    if (big.length) {
      const title = titleCase(
        big
          .filter((l) => /[A-Za-z]/.test(l.text))
          .map((l) => l.text)
          .filter((t, i, a) => a.indexOf(t) === i)
          .join(' ')
          .replace(/\b([A-Z])\s+([A-Z]{2,})\b/g, '$1$2'),
      );
      const num = big.map((l) => /^\d{1,2}$/.exec(l.text.trim())?.[0]).find(Boolean);
      chapter = { id: `ch${chapters.length + 1}`, number: num ? Number(num) : chapters.length + 1, title, startPage: L.page, sections: [] };
      chapters.push(chapter);
      section = null;
      prevProse = null;
    }

    // Walk the body flow.
    let para: Line[] = [];
    let mathRun: Line[] = [];
    let aside: Line[] = [];
    const flushAside = () => {
      if (aside.length) push('aside', aside[0].page, aside.map((l) => ({ text: l.text, math: l.math })));
      aside = [];
    };
    const flushMath = () => {
      if (!mathRun.length) return;
      push('math', mathRun[0].page, mathRun.map((l) => ({ text: l.text, math: true, label: l.label })));
      mathRun = [];
      prevProse = null;
    };
    const flushPara = () => {
      if (!para.length) return;
      const text = para.map((l) => l.text).join(' ');
      const first = para[0];
      const indent = first.x0 - L.bodyLeft;
      let kind: BlockKind = 'prose';
      if (EXERCISE.test(text) && indent >= 3) kind = 'exercise';
      else if (indent >= 5 && indent < 60 && PROBLEM_WORDS.test(text) && para.every((l) => l.x0 - L.bodyLeft >= 4)) kind = 'problem';
      else if (prevProse && RESULT_CUE.test(prevProse.text) && para.length <= 4) kind = 'result';
      else if (/^for (any|all|every)\b/i.test(text)) kind = 'result';
      // A paragraph that ran off the previous page continues there.
      if (kind === 'prose' && prevProse && prevProse.page === first.page - 1 && !TERMINAL.test(prevProse.text) && /^[a-z(]/.test(text)) {
        prevProse.lines.push(...para.map((l) => ({ text: l.text, math: false })));
        prevProse.text = `${prevProse.text} ${text}`;
      } else {
        const b = push(kind, first.page, para.map((l) => ({ text: l.text, math: false })));
        prevProse = kind === 'prose' ? b : null;
      }
      para = [];
    };

    let last: Line | null = null;
    for (const l of lines) {
      if (l.role === 'chapter-title' || l.role === 'bubble') continue;
      if (l.role === 'aside') {
        aside.push(l);
        continue;
      }
      if (l.role === 'heading') {
        flushPara();
        flushMath();
        flushAside();
        const { chapter: c } = ensure(L.page);
        section = { id: `${c.id}.s${c.sections.length + 1}`, title: l.text, page: L.page, blocks: [] };
        c.sections.push(section);
        push('heading', L.page, [{ text: l.text, math: false }]);
        prevProse = null;
        last = null;
        continue;
      }
      const gap = last ? last.y - l.y : 0;
      // Lines carrying stacked fractions get extra leading.
      const lead = /\{[^{}]+\}/.test(l.text) || (last && /\{[^{}]+\}/.test(last.text)) ? L.bodySize * 0.9 : 0;
      // Continuation lines of a numbered exercise / indented problem are indented further: keep them together.
      const prevLine = para[para.length - 1];
      const hanging =
        para.length > 0 &&
        ((EXERCISE.test(para[0].text) && l.x0 >= para[0].x0 + 8 && gap < L.bodySize * 2.3) ||
          (para[0].x0 - L.bodyLeft >= 5 && Math.abs(l.x0 - para[0].x0) < 4 && gap < L.bodySize * 1.9 && !TERMINAL.test(prevLine.text)));
      // A new left edge after a finished sentence starts a new paragraph (problem box ends, "Now try these…").
      const shifted = !!prevLine && Math.abs(l.x0 - prevLine.x0) > 6 && TERMINAL.test(prevLine.text) && !hanging;
      const newPara = !last || shifted || (!hanging && gap > L.bodySize * 1.55 + lead) || (EXERCISE.test(l.text) && Math.abs(l.x0 - (para[0]?.x0 ?? l.x0)) < 12);
      if (l.math) {
        flushPara();
        if (mathRun.length && gap > L.bodySize * 3.2) flushMath();
        mathRun.push(l);
      } else {
        flushMath();
        if (newPara) flushPara();
        para.push(l);
      }
      last = l;
    }
    flushPara();
    flushMath();
    flushAside();
  }

  // "Words, then its equation" layouts (a one-line statement above each equation) become one
  // labelled math block, the same as when the words sit to the left of the equation.
  for (const c of chapters) {
    for (const s of c.sections) {
      const out: BookBlock[] = [];
      for (let i = 0; i < s.blocks.length; i++) {
        const b = s.blocks[i];
        const n = s.blocks[i + 1];
        const isLabel = b.kind === 'prose' && b.lines.length === 1 && b.text.length <= 70 && !/[:?]$/.test(b.text);
        if (isLabel && n?.kind === 'math' && n.lines.length <= 2 && !n.lines[0].label) {
          n.lines[0].label = b.text;
          const prev = out[out.length - 1];
          if (prev?.kind === 'math' && prev.lines.every((l) => l.label || prev.lines.indexOf(l) > 0)) {
            prev.lines.push(...n.lines);
            prev.text = prev.lines.map((l) => (l.label ? `${l.label} → ${l.text}` : l.text)).join('\n');
            i++;
            continue;
          }
          n.text = n.lines.map((l) => (l.label ? `${l.label} → ${l.text}` : l.text)).join('\n');
          continue; // the label block is absorbed
        }
        out.push(b);
      }
      s.blocks = out;
    }
  }
  const kept = new Set(chapters.flatMap((c) => c.sections.flatMap((s) => s.blocks.map((b) => b.id))));
  for (let i = blocks.length - 1; i >= 0; i--) if (!kept.has(blocks[i].id)) blocks.splice(i, 1);

  for (const c of chapters) c.sections = c.sections.filter((s) => s.blocks.length);
  // Drop empty "Introduction" chapter made of front matter when real chapters exist.
  const real = chapters.filter((c) => c.sections.some((s) => s.blocks.length));
  return { chapters: real, blocks: blocks.filter((b) => real.some((c) => c.id === b.chapterId)) };
}

/* ---------------- teaching units ---------------- */

const LEAD_IN = /[:,]$/;
const CONCLUSION = /^(thus|so|hence|therefore|that is|this gives|from this|and so|now we (?:can )?(?:get|compute))\b/i;
/** A new idea starts a new unit even when it ends with a colon. */
const NEW_IDEA = /^(there's another way|another way|another problem|let's (?:look|do|see|try)|now let's|now try|one more)/i;

/**
 * Groups a worked solution that the book spreads over several small blocks
 * ("Taking … as x, … altogether," / x + (x − 10) = 100 / "We can extract x from this:" /
 * 2x − 10 = 100 … / "Thus we get …") into ONE teaching unit, so it is read and
 * taught as one piece instead of five tiny lessons.
 */
export function teachingUnits(blocks: BookBlock[]): BookBlock[] {
  const out: BookBlock[] = [];
  let i = 0;
  while (i < blocks.length) {
    const start = blocks[i];
    const group: BookBlock[] = [start];
    const opens = start.kind === 'math' || (start.kind === 'prose' && LEAD_IN.test(start.text) && blocks[i + 1]?.kind === 'math');
    if (opens) {
      let j = i + 1;
      while (j < blocks.length && group.length < 7) {
        const b = blocks[j];
        const prev = group[group.length - 1];
        if (b.kind === 'math') group.push(b);
        else if (b.kind === 'prose' && !NEW_IDEA.test(b.text) && LEAD_IN.test(b.text) && b.text.length < 160 && blocks[j + 1]?.kind === 'math') group.push(b);
        else if (b.kind === 'prose' && prev.kind === 'math' && CONCLUSION.test(b.text) && b.text.length < 260) {
          group.push(b);
          j++;
          break;
        } else break;
        j++;
      }
    }
    if (group.length === 1) out.push(start);
    else {
      const lines = group.flatMap((g) => g.lines.map((l) => ({ ...l, math: g.kind === 'math' ? true : l.math })));
      out.push({
        ...start,
        id: group.map((g) => g.id).join('+'),
        kind: 'math',
        lines,
        text: group.map((g) => g.text).join('\n'),
      });
    }
    i += group.length;
  }
  return out;
}
