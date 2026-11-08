import { describe, expect, it } from 'vitest';
import { AnalyticsAgent, ModelRouterAgent, SessionMemoryAgent } from '../index';
describe('Sprint 7 platform agents',()=>{
 it('routes by capability',async()=>{const r=await new ModelRouterAgent().execute({agent:'model-router',context:{runId:'agentRun_test'},input:{task:'math'}});expect(r.output?.model).toBe('deterministic-math-verifier');});
 it('computes analytics',async()=>{const r=await new AnalyticsAgent().execute({agent:'analytics',context:{runId:'agentRun_test'},input:{events:[{type:'lesson_started',lessonId:'l',studentId:'s'},{type:'lesson_completed',lessonId:'l',studentId:'s'}]}});expect(r.output?.completionRate).toBe(1);});
 it('persists and loads session state',async()=>{const a=new SessionMemoryAgent();await a.execute({agent:'session-memory',context:{runId:'agentRun_test'},input:{action:'save',studentId:'s',lessonId:'l',state:{paragraphId:'p'}}});const r=await a.execute({agent:'session-memory',context:{runId:'agentRun_test'},input:{action:'load',studentId:'s',lessonId:'l'}});expect(r.output?.paragraphId).toBe('p');});
});
