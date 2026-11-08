import { describe, expect, it } from 'vitest';
import { StudentIntelligenceAgent } from './student-intelligence-agent';
import { ids } from '../../contracts';
const lesson:any={id:ids.lesson('s6'),paragraphs:[]};
describe('StudentIntelligenceAgent',()=>{it('flags weak concepts',async()=>{const a=new StudentIntelligenceAgent();const r=await a.execute({agent:'student-intelligence',context:{runId:ids.agentRun('x')},input:{lesson,studentId:'s',attempts:[{studentId:'s',itemId:'q',paragraphId:'p',conceptId:'p:q',correct:false,score:0}]}});expect(r.output?.weakConcepts).toContain('p:q');});});
