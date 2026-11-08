/**
 * Question-paper aware splitting.
 *
 * A worksheet / test paper is a numbered list: 1. ... 2. ... 3. ... Its natural
 * teaching unit is ONE QUESTION. The generic paragraph splitter (index-pdf.ts)
 * merges short blocks and re-cuts long ones at sentence ends, which on a real
 * 20-question paper produced 9 arbitrary chunks that mixed 4-5 questions in one
 * unit and even cut Q19 in half across two units. Teaching then answered a few
 * questions per "paragraph", lost its place and repeated.
 *
 * Here every question becomes exactly one unit, in paper order, numbered
 * exactly as printed ("3. Solve using the quadratic formula: ...").
 * Anything before question 1 (title / instructions) and any labelled trailing
 * note after the last question ("Student instruction: ...") become their own
 * units so they never contaminate a question.
 */
export interface QuestionUnit {
  page: number;
  text: string;
  kind: 'instructions' | 'question' | 'closing';
  /** Printed question number (questions only). */
  number?: number;
}

interface Line { page: number; text: string }

const START = /^(\d{1,3})\s*[.)]\s*(\S.*)$/;
// A "13. ...steps.14. In two ..." glue: the NEXT expected number, right after a sentence end.
const INLINE_START = (n: number) => new RegExp(`(?<=[.?!])\\s*(${n})\\s*[.)]\\s+(?=[A-Z(\\u2212\\-\\d])`);
const CLOSING_LABEL = /^[A-Z][A-Za-z ]{2,30}:\s+\S/;

export function splitQuestionPaper(pages: Array<{ page: number; text: string }>): QuestionUnit[] | null {
  const lines: Line[] = [];
  for (const p of pages) {
    for (const raw of String(p.text || '').split(/\n+/)) {
      const t = raw.replace(/\s+/g, ' ').trim();
      if (t) lines.push({ page: Number(p.page) || 1, text: t });
    }
  }
  if (!lines.length) return null;

  let expected = 1;
  const preamble: Line[] = [];
  const questions: { number: number; page: number; parts: string[] }[] = [];

  const pushLine = (line: Line) => {
    // 1) a line that STARTS a question with the next expected number
    const m = START.exec(line.text);
    if (m && Number(m[1]) === expected) {
      questions.push({ number: expected, page: line.page, parts: [] });
      expected += 1;
      consume(line.page, `${m[1]}. ${m[2]}`);
      return;
    }
    consume(line.page, line.text);
  };

  // Splits glued questions ("...steps.14. In two...") and appends text to the current unit.
  const consume = (page: number, text: string) => {
    let rest = text;
    for (;;) {
      const glue = questions.length ? INLINE_START(expected).exec(rest) : null;
      if (!glue || glue.index === undefined) break;
      const head = rest.slice(0, glue.index).trim();
      if (head) questions[questions.length - 1].parts.push(head);
      questions.push({ number: expected, page, parts: [] });
      rest = `${expected}. ${rest.slice(glue.index + glue[0].length).trim()}`;
      expected += 1;
    }
    if (!questions.length) { preamble.push({ page, text: rest }); return; }
    questions[questions.length - 1].parts.push(rest);
  };

  for (const line of lines) pushLine(line);

  // Require a real numbered list: at least 3 questions, numbered from 1 with no gaps.
  if (questions.length < 3) return null;

  const units: QuestionUnit[] = [];
  const pre = preamble.map(l => l.text).join(' ').trim();
  if (pre.length >= 25) units.push({ page: preamble[0].page, text: pre, kind: 'instructions' });

  questions.forEach((q, i) => {
    let body = q.parts.join(' ').replace(/\s+/g, ' ').trim();
    let closing = '';
    if (i === questions.length - 1) {
      // Split a labelled trailing note ("Student instruction: ...") off the last question.
      const idx = q.parts.findIndex((part, k) => k > 0 && CLOSING_LABEL.test(part));
      if (idx > 0) {
        body = q.parts.slice(0, idx).join(' ').replace(/\s+/g, ' ').trim();
        closing = q.parts.slice(idx).join(' ').replace(/\s+/g, ' ').trim();
      }
    }
    units.push({ page: q.page, text: body, kind: 'question', number: q.number });
    if (closing) units.push({ page: q.page, text: closing, kind: 'closing' });
  });
  return units;
}
