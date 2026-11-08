import type { AIGuruLesson, VisualAction } from '@/lib/ai-guru/lesson/types';
export const NCERT_CLASS10_CH4_SOURCE='https://www.ncert.nic.in/textbook/pdf/jemh104.pdf';

const visuals: VisualAction[] = [
  {type:'latex',id:'eq-start',latex:'x^2+4x-5=0',x:90,y:95,width:700,fontSize:48},
  {type:'highlight',id:'focus-4x',targetId:'eq-start'},
  {type:'write',id:'add-4-subtract-4',content:'+4  −4',x:330,y:180,fontSize:34},
  {type:'latex',id:'eq-complete',latex:'x^2+4x+4-9=0',x:90,y:285,width:700,fontSize:46},
  {type:'transform',id:'complete-square',fromId:'eq-start',toId:'eq-complete',retainFrom:true,derivedLineIndex:1},
  {type:'highlight',id:'focus-square',targetId:'eq-complete'},
  {type:'latex',id:'eq-factor',latex:'(x+2)^2=9',x:90,y:400,width:700,fontSize:50},
  {type:'transform',id:'factor-transform',fromId:'eq-complete',toId:'eq-factor',retainFrom:true,derivedLineIndex:2},
  {type:'highlight',id:'focus-factor',targetId:'eq-factor'},
  {type:'latex',id:'eq-roots',latex:'x+2=\\pm3',x:90,y:515,width:700,fontSize:48},
  {type:'transform',id:'root-transform',fromId:'eq-factor',toId:'eq-roots',retainFrom:true,derivedLineIndex:3},
  {type:'latex',id:'eq-answer',latex:'x=1\\quad\\text{or}\\quad x=-5',x:90,y:625,width:700,fontSize:48},
  {type:'highlight',id:'final-highlight',targetId:'eq-answer'},
];

export const ncertClass10QuadraticLesson:AIGuruLesson={schemaVersion:'1.0',teachingMode:'two-pass',id:'ncert-class10-ch4-quadratic-e2e',title:'Class 10 · Quadratic Equations · Completing the Square',language:{source:'english',target:'malayalam'},paragraphs:[{id:'ncert-ch4-p9',source:{bookId:'NCERT-Class10-Mathematics',chapterIndex:4,paragraphIndex:1,pageNumber:9,text:'NCERT Chapter 4 demonstrates rewriting x² + 4x − 5 = 0 by completing the square.',pageImage:`${NCERT_CLASS10_CH4_SOURCE}#page=9&view=FitH`,boundingBox:{x:8,y:34,width:84,height:18},formulas:['x^2+4x-5=0']},english:{text:'Start with x² + 4x − 5 = 0. First, add and subtract 4 to complete the square. This gives x² + 4x + 4 − 9 = 0. Rewrite it as (x + 2)² = 9. Then x + 2 = ±3, so x = 1 or x = −5.',visuals,captions:{
  'eq-start':'Start with x² + 4x − 5 = 0.',
  'focus-4x':'Focus on the middle term 4x and prepare to complete the square.',
  'add-4-subtract-4':'Add 4 and subtract 4 so the expression stays equivalent.',
  'eq-complete':'Now the first three terms form a perfect square.',
  'complete-square':'Transform the expression into the equivalent completed-square form.',
  'focus-square':'The perfect-square expression is now the focus.',
  'eq-factor':'Rewrite the perfect square: (x + 2)² = 9.',
  'factor-transform':'The equivalent equation is transformed into a square form.',
  'focus-factor':'Focus on the square before taking the square root.',
  'eq-roots':'Take the square root of both sides: x + 2 = ±3.',
  'root-transform':'The square equation transforms into two possible root cases.',
  'eq-answer':'Therefore, x = 1 or x = −5.',
  'final-highlight':'These are the two verified solutions.'
}},malayalam:{text:'x² + 4x − 5 = 0 ൽ നിന്ന് തുടങ്ങാം. ആദ്യം പൂർണ്ണവർഗ്ഗം ഉണ്ടാക്കാൻ 4 ചേർത്ത് 4 കുറയ്ക്കാം. അങ്ങനെ x² + 4x + 4 − 9 = 0 ലഭിക്കും. ഇത് (x + 2)² = 9 എന്ന് എഴുതാം. തുടർന്ന് x + 2 = ±3, അതിനാൽ x = 1 അല്ലെങ്കിൽ x = −5.',visuals:[],captions:{
  'eq-start':'x² + 4x − 5 = 0 ൽ നിന്ന് തുടങ്ങാം.',
  'focus-4x':'4x എന്ന മധ്യപദത്തിൽ ശ്രദ്ധ കേന്ദ്രീകരിച്ച് പൂർണ്ണവർഗ്ഗം ഉണ്ടാക്കാം.',
  'add-4-subtract-4':'തുല്യത നിലനിർത്താൻ 4 ചേർത്ത് 4 കുറയ്ക്കാം.',
  'eq-complete':'ഇപ്പോൾ ആദ്യത്തെ മൂന്ന് പദങ്ങൾ ഒരു പൂർണ്ണവർഗ്ഗം ആകുന്നു.',
  'complete-square':'സമമായ രൂപം പൂർണ്ണവർഗ്ഗ രൂപത്തിലേക്ക് മാറ്റാം.',
  'focus-square':'ഇപ്പോൾ പൂർണ്ണവർഗ്ഗ രൂപത്തിലാണ് ശ്രദ്ധ.',
  'eq-factor':'പൂർണ്ണവർഗ്ഗം എഴുതുമ്പോൾ (x + 2)² = 9 ലഭിക്കുന്നു.',
  'factor-transform':'തുല്യമായ സമവാക്യം വർഗ്ഗരൂപത്തിലേക്ക് മാറ്റുന്നു.',
  'focus-factor':'വർഗ്ഗമൂലം എടുക്കുന്നതിന് മുമ്പ് ഈ രൂപത്തിൽ ശ്രദ്ധിക്കുക.',
  'eq-roots':'രണ്ടു വശങ്ങളുടെയും വർഗ്ഗമൂലം എടുക്കുമ്പോൾ x + 2 = ±3.',
  'root-transform':'വർഗ്ഗസമവാക്യം രണ്ട് സാധ്യമായ മൂലങ്ങളായി മാറുന്നു.',
  'eq-answer':'അതിനാൽ x = 1 അല്ലെങ്കിൽ x = −5 ആണ്.',
  'final-highlight':'ഇവയാണ് പരിശോധിച്ച് ഉറപ്പാക്കിയ രണ്ട് ഉത്തരങ്ങൾ.'
}},cues:[],verified:true}]};
ncertClass10QuadraticLesson.paragraphs[0].malayalam.visuals=ncertClass10QuadraticLesson.paragraphs[0].english.visuals;
