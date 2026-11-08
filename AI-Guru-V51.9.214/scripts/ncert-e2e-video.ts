import { readFile } from 'node:fs/promises';
import { lessonToVideoTimeline } from '../lib/ai-guru/video/ncert-video-timeline';
import { buildAIGuruVideoHtml } from '../lib/ai-guru/video/render-html';

const source = JSON.parse(await readFile(new URL('../data/ncert-e2e/class10-quadratic.json', import.meta.url), 'utf8'));
const lesson = { paragraphs: [{ page: source.page, sourceText: source.paragraph, teachingSteps: source.steps.map((s: string, i: number) => ({ text: s, explanation: s, latex: s, durationMs: 1800 + i * 150 })), malayalam: { text: 'ഇത് പൂർത്തിയാക്കുന്ന ചതുരം രീതി ഉപയോഗിച്ച് പരിഹരിക്കാം.', durationMs: 2600 }, audio: { durationMs: 2600 } }] } as any;
const timeline = lessonToVideoTimeline(lesson);
if (!timeline.cues.length || timeline.durationMs <= 0) throw new Error('No video timeline generated');
const html = buildAIGuruVideoHtml(timeline);
if (!html.includes('AI GURU WHITEBOARD') || !html.includes('NCERT REFERENCE')) throw new Error('Video HTML contract failed');
console.log(JSON.stringify({ ok: true, durationMs: timeline.durationMs, cues: timeline.cues.length }, null, 2));
