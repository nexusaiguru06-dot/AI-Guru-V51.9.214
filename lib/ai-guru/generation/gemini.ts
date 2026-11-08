import type { AIGuruLesson, ParagraphSource, VisualAction } from '../lesson/types';
import { HIGH_SCHOOL_TEACHER_PERSONA } from '../teaching/teacher-persona';
import { serverKey, SIGN_IN_FOR_SERVER_KEY } from '../net/server-keys';

const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const apiKey = () => serverKey('GEMINI_API_KEY'); // V51.9.176: signed-in users only

function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const candidate = fenced ?? text;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('Gemini did not return a JSON object.');
  return JSON.parse(candidate.slice(start, end + 1));
}

function promptFor(source: ParagraphSource): string {
  return `${HIGH_SCHOOL_TEACHER_PERSONA} For any worked mathematics, write every step (none skipped) and give each step a short caption.\nYou are the AI Guru textbook teaching planner. Return ONLY valid JSON matching this shape:
{"title":"...","english":{"text":"...","visuals":[]},"malayalam":{"text":"...","visuals":[]},"cues":[]}
Rules: explain the supplied textbook paragraph for a Grade 1-12 learner; preserve mathematical meaning; do not invent facts; use KaTeX/LaTeX in latex visuals; visual actions must use write, latex, shape, line, chart or highlight. Coordinates are 0-1000 x 0-700. Malayalam must be real Malayalam Unicode. Keep the source paragraph separate from the explanation. Create simple useful diagrams/graphs when they improve understanding. Cues use {id,paragraphId,track,startMs,endMs,trigger,triggerText,action}. The paragraph id is ${source.bookId}:${source.pageNumber}:${source.paragraphIndex}.
SOURCE PAGE: ${source.pageNumber}
SOURCE TEXT: ${source.text}`;
}

export async function generateTeachingPlan(source: ParagraphSource): Promise<Pick<AIGuruLesson['paragraphs'][number], 'english'|'malayalam'|'cues'>> {
  const key = await apiKey();
  if (!key) throw new Error(process.env.GEMINI_API_KEY ? SIGN_IN_FOR_SERVER_KEY : 'GEMINI_API_KEY is not configured.');
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`, {
    method: 'POST', headers: {'content-type':'application/json'},
    body: JSON.stringify({contents:[{role:'user',parts:[{text:promptFor(source)}]}],generationConfig:{temperature:0.2,responseMimeType:'application/json'}}),
  });
  if (!response.ok) throw new Error(`Gemini lesson generation failed: ${response.status} ${await response.text()}`);
  const json = await response.json() as any;
  const text = json?.candidates?.[0]?.content?.parts?.map((p:any)=>p.text || '').join('') || '';
  const plan = extractJson(text) as any;
  if (!plan?.english?.text || !plan?.malayalam?.text) throw new Error('Generated lesson is missing English or Malayalam teaching text.');
  return {english:{text:String(plan.english.text),visuals:(plan.english.visuals||[]) as VisualAction[]},malayalam:{text:String(plan.malayalam.text),visuals:(plan.malayalam.visuals||[]) as VisualAction[]},cues:Array.isArray(plan.cues)?plan.cues:[]};
}
