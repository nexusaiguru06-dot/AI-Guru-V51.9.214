import {ncertClass10QuadraticLesson} from '../lib/ai-guru/e2e/ncert-class10';
import {validateLesson} from '../lib/ai-guru/lesson/validate';
import {validateAIGuruLesson} from '../lib/ai-guru/qa/validator';
const errors=[...validateLesson(ncertClass10QuadraticLesson).filter(x=>x.severity==='error'),...validateAIGuruLesson(ncertClass10QuadraticLesson).filter(x=>x.severity==='error')];
if(errors.length){console.error(errors);process.exit(1)}
console.log(JSON.stringify({ok:true,source:'NCERT Class X Mathematics Chapter 4',paragraphs:ncertClass10QuadraticLesson.paragraphs.length,englishVisuals:ncertClass10QuadraticLesson.paragraphs[0].english.visuals.length,malayalamVisuals:ncertClass10QuadraticLesson.paragraphs[0].malayalam.visuals.length},null,2));
