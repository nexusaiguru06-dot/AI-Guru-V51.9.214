import { readFile } from 'node:fs/promises';
import { lessonToVideoTimeline } from '../lib/ai-guru/video/ncert-video-timeline';
import { buildAIGuruVideoHtml } from '../lib/ai-guru/video/render-html';
const source = JSON.parse(await readFile(new URL('../data/ncert-e2e/class10-quadratic.json', import.meta.url), 'utf8'));
const malayalam = source.malayalam_steps.map((text:string, i:number)=>({text, durationMs:2100}));
const lesson = { paragraphs: [{ page: source.page, sourceText: source.paragraph, teachingSteps: source.steps.map((s:string,i:number)=>({text:s, explanation:[
  'Focus on the middle term 4x.',
  'Add 4 and subtract 4 to complete the square.',
  'Group the perfect square and simplify.',
  'Take the square root of both sides.',
  'The two solutions are 1 and −5.'
][i], latex:s, visualId:`eq-${i+1}`, durationMs:2100})), malayalam: { text: malayalam.map(x=>x.text).join(' '), steps: malayalam, durationMs:2100 } }] } as any;
const timeline=lessonToVideoTimeline(lesson);
const html=buildAIGuruVideoHtml(timeline);
if(!html.includes('AI GURU WHITEBOARD') || !html.includes('NCERT REFERENCE')) throw new Error('video contract failed');
console.log(JSON.stringify({ok:true,durationMs:timeline.durationMs,cues:timeline.cues.length,constructionCues:timeline.cues.filter(c=>c.kind==='construction').length},null,2));
