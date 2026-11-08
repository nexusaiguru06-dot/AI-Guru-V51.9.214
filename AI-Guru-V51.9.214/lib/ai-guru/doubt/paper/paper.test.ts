import { describe, expect, it } from 'vitest';
import { answerSystemPrompt, chatContents, editLine, insertLine, jsonFrom, linesMentioned, liveNote, mustRetake, paperText, parseAnswer, parseReading, qualityNote, quickAsk, QUICK_ASKS, readingSystemPrompt, type AnswerContext } from './paper';
import { brightness, cleanUp, fitSize, motion, readiness, sharpness, steadyStep, toGrey, LIMITS } from './image';

const READ = `Here you go:
\`\`\`json
{"quality":"good","subject":"maths","language":"english","title":"Linear equations","summary":"Homework: solving 2x + 5 = 15",
 "lines":[
  {"page":1,"text":"Linear equations","kind":"heading"},
  {"page":1,"text":"2x + 5 = 15","kind":"math"},
  {"page":1,"text":"2x = 15 + 5","kind":"math"},
  {"page":1,"text":"2x = 20","kind":"math"},
  {"page":1,"text":"x = 10","kind":"math"},
  {"page":1,"text":"Diagram: number line from 0 to [?]","kind":"diagram","unclear":true},
 ]}
\`\`\``;

const ctx: AnswerContext = { grade: '8', boardName: 'Kerala State Board', gradeGuidance: 'Use short sentences.', languageLine: 'Respond entirely in clear, simple English.', lang: 'english' };

describe('reading the paper', () => {
  it('parses the reader reply (fences, trailing comma) into numbered lines, keeping the mistake', () => {
    const r = parseReading(READ);
    expect(r.quality).toBe('good');
    expect(r.subject).toBe('maths');
    expect(r.lines.map((l) => l.n)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(r.lines[2].text).toBe('2x = 15 + 5'); // copied as written, not corrected
    expect(r.lines[5]).toMatchObject({ kind: 'diagram', unclear: true });
    expect(r.diagrams).toEqual(['Diagram: number line from 0 to [?]']);
    expect(mustRetake(r)).toBe(false);
  });

  it('a reply that is not JSON still becomes lines; nothing read means retake', () => {
    const r = parseReading('Photosynthesis\nPlants make food using sunlight\nCO2 + H2O → glucose');
    expect(r.lines.length).toBe(3);
    expect(mustRetake(parseReading(''))).toBe(true);
    const bad = parseReading('{"quality":"not-paper","lines":[]}');
    expect(bad.quality).toBe('not-paper');
    expect(mustRetake(bad)).toBe(true);
    expect(parseReading('{"quality":"good","lines":[]}').quality).toBe('empty');
  });

  it('keeps Malayalam and page numbers from several photos', () => {
    const r = parseReading('{"subject":"biology","lines":[{"page":1,"text":"പ്രകാശസംശ്ലേഷണം"},{"page":2,"text":"ഇലകളിൽ ഹരിതകം"},{"page":9,"text":"x"}]}', 2);
    expect(r.lines[0].text).toBe('പ്രകാശസംശ്ലേഷണം');
    expect(r.lines.map((l) => l.page)).toEqual([1, 2, 2]);
    expect(paperText(r)).toContain('p2 L2: ഇലകളിൽ ഹരിതകം');
    expect(readingSystemPrompt(2)).toContain('there are 2 photos');
  });

  it('the student fixes, removes and adds lines; numbers stay in order', () => {
    const r = parseReading(READ);
    const fixed = editLine(r, 6, 'Diagram: number line from 0 to 20');
    expect(fixed.lines[5]).toMatchObject({ text: 'Diagram: number line from 0 to 20', edited: true, unclear: false });
    const removed = editLine(fixed, 1, '');
    expect(removed.lines.length).toBe(5);
    expect(removed.lines[0]).toMatchObject({ n: 1, text: '2x + 5 = 15' });
    const added = insertLine(removed, 4, 'Check: 2(10) + 5 = 25');
    expect(added.lines[4]).toMatchObject({ n: 5, text: 'Check: 2(10) + 5 = 25', edited: true });
    expect(paperText(added)).toContain('L5: Check: 2(10) + 5 = 25 (corrected by the student)');
  });

  it('photo problems get a plain message in English and Malayalam', () => {
    expect(qualityNote('good', 'english')).toBeNull();
    expect(qualityNote('blurry', 'english')).toMatch(/blurry/);
    expect(qualityNote('dark', 'malayalam')).toMatch(/വെളിച്ച/);
  });
});

describe('answering about the paper', () => {
  const r = parseReading(READ);

  it('the teacher prompt carries the numbered paper, the rules and the JSON shape', () => {
    const p = answerSystemPrompt(r, { ...ctx, lessonNote: 'Chapter: "Linear Equations".', extracts: [{ page: 42, text: 'Transposing a term changes its sign.' }] });
    expect(p).toContain('L3 [math]: 2x = 15 + 5');
    expect(p).toContain('Class 8');
    expect(p).toContain('[page 42] Transposing a term changes its sign.');
    expect(p).toContain('In class right now: Chapter: "Linear Equations".');
    expect(p).toMatch(/"mistakes"/);
    expect(p).toMatch(/never claim the paper says something it does not/);
  });

  it('parses an answer with lines, a mistake and follow-ups; drops line numbers that do not exist', () => {
    const a = parseAnswer('{"answer":"In line 3 you added 5, but it should be subtracted.","lines":[3,99],"mistakes":[{"line":3,"wrote":"2x = 15 + 5","correct":"2x = 15 − 5","why":"Moving +5 across the equals sign makes it −5."},{"line":77,"wrote":"x","correct":"y"}],"next":["Why does the sign change?","Can you check x = 5?"]}', r);
    expect(a.lines).toEqual([3]);
    expect(a.mistakes).toEqual([{ line: 3, wrote: '2x = 15 + 5', correct: '2x = 15 − 5', why: 'Moving +5 across the equals sign makes it −5.' }]);
    expect(a.next.length).toBe(2);
  });

  it('a plain-text answer still works, and its line mentions are found', () => {
    const a = parseAnswer('Look at lines 3 to 5: the sign is wrong in L3.', r);
    expect(a.answer).toMatch(/^Look at lines 3 to 5/);
    expect(a.lines).toEqual([3, 4, 5]);
    expect(linesMentioned('വരി 2 നോക്കൂ', r)).toEqual([2]);
    expect(linesMentioned('line 2 and 4', r)).toEqual([2, 4]);
  });

  it('the conversation sends the photo once, with the first question, and keeps earlier answers', () => {
    const photo = { base64: 'AAAA', mimeType: 'image/jpeg' };
    const c = chatContents([
      { role: 'student', text: 'Is this right?' },
      { role: 'guru', text: 'Line 3 is wrong.', answer: { answer: 'Line 3 is wrong.', lines: [3], mistakes: [], next: [] } },
      { role: 'student', text: 'Why?' },
    ], [photo]);
    expect(c.map((t) => t.role)).toEqual(['user', 'model', 'user']);
    expect(c[0].parts[0]).toEqual({ inline_data: { mime_type: 'image/jpeg', data: 'AAAA' } });
    expect(c[2].parts).toEqual([{ text: 'Why?' }]);
    expect(String(c[1].parts[0].text)).toContain('"lines":[3]');
  });

  it('one-tap questions exist in both languages, and the live voice session gets the page as a note', () => {
    expect(QUICK_ASKS.map((q) => q.id)).toEqual(['explain', 'check', 'hint', 'summary', 'quiz', 'meaning']);
    expect(quickAsk('check', 'malayalam')).toMatch(/തെറ്റ/);
    expect(liveNote(r)).toContain('L4 [math]: 2x = 20');
  });

  it('jsonFrom finds the object inside prose and returns null when there is none', () => {
    expect(jsonFrom('Sure! {"a": 1} hope that helps')).toEqual({ a: 1 });
    expect(jsonFrom('no json here')).toBeNull();
  });
});

describe('camera picture checks', () => {
  const W = 320, H = 240;
  const page = (blur: boolean, shade = 235) => {
    const px = new Uint8ClampedArray(W * H * 4).fill(shade);
    for (let y = 20; y < H - 20; y += 12) for (let x = 20; x < W - 20; x++) {
      if ((x * 7 + y) % 11 < 6) {
        const p = (y * W + x) * 4;
        px[p] = px[p + 1] = px[p + 2] = 30;
        if (!blur) continue;
      }
    }
    if (blur) {
      // smear: average each pixel with its neighbours a few times
      for (let k = 0; k < 6; k++) for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
        const p = (y * W + x) * 4;
        const v = (px[p - 4] + px[p + 4] + px[p - W * 4] + px[p + W * 4] + px[p]) / 5;
        px[p] = px[p + 1] = px[p + 2] = v;
      }
    }
    return px;
  };

  it('sharp writing scores high, blurred writing low; dark is dark', () => {
    const sharp = toGrey(page(false), W, H);
    const soft = toGrey(page(true), W, H);
    expect(sharpness(sharp)).toBeGreaterThan(LIMITS.sharp);
    expect(sharpness(soft)).toBeLessThan(sharpness(sharp) / 3);
    expect(readiness({ sharp: sharpness(sharp), bright: brightness(sharp), moved: 1 })).toBe('ready');
    expect(readiness({ sharp: 500, bright: 30, moved: 0 })).toBe('dark');
    expect(readiness({ sharp: 500, bright: 200, moved: 9 })).toBe('moving');
    expect(motion(sharp, sharp)).toBe(0);
    expect(motion(null, sharp)).toBe(Infinity);
  });

  it('auto-capture fires only after the page has been ready long enough', () => {
    let s: { since: number | null } = { since: null };
    let r = steadyStep(s, 'ready', 0); s = r; expect(r.fire).toBe(false);
    r = steadyStep(s, 'ready', 800); s = r; expect(r.fire).toBe(false);
    r = steadyStep(s, 'moving', 900); s = r; expect(r.since).toBeNull();
    r = steadyStep(s, 'ready', 1000); s = r;
    r = steadyStep(s, 'ready', 2300); expect(r.fire).toBe(true);
  });

  it('keeps the shape when scaling, and stretches grey paper to white without touching full-range images', () => {
    expect(fitSize(4000, 3000)).toEqual({ w: 2048, h: 1536 });
    expect(fitSize(1920, 1080)).toEqual({ w: 1920, h: 1080 });
    const px = page(false, 170); // greyish paper, ink at 30
    const { hi } = cleanUp(px, W, H);
    expect(hi).toBe(170);
    expect(px[0]).toBe(255); // the paper is now white
    expect(px[(20 * W + 21) * 4]).toBe(0); // the ink is black
    const full = new Uint8ClampedArray([0, 0, 0, 255, 255, 255, 255, 255]);
    cleanUp(full, 2, 1);
    expect(Array.from(full)).toEqual([0, 0, 0, 255, 255, 255, 255, 255]);
  });
});
