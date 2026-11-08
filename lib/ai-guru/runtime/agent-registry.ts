import type { AgentName } from '../contracts/agent-contracts';

export type AgentCapability = 'read-source'|'read-lesson'|'write-lesson'|'write-paragraph'|'write-problem'|'write-visual'|'write-audio'|'verify-math'|'assess'|'read-student'|'write-student'|'create-material'|'teacher-tools'|'parent-report'|'analytics'|'session'|'route-model'|'recover';
export type AgentTool = 'rag'|'lesson-generator'|'math-verifier'|'visual-compiler'|'tts'|'assessment'|'student-profile'|'materials'|'teacher'|'parent'|'analytics'|'session-store'|'model-registry'|'recovery';

export interface AgentDefinition { name: AgentName; capabilities: readonly AgentCapability[]; tools: readonly AgentTool[]; scopes: readonly ('lesson'|'paragraph'|'problem'|'session'|'student')[]; maxRetries?: number; }

const definitions: Record<AgentName, AgentDefinition> = {
  'teaching-controller': {name:'teaching-controller', capabilities:['read-lesson','write-lesson'], tools:['rag','lesson-generator','recovery'], scopes:['lesson','paragraph','problem']},
  curriculum:{name:'curriculum',capabilities:['read-source','read-lesson'],tools:['rag'],scopes:['lesson']},
  'rag-book':{name:'rag-book',capabilities:['read-source','write-paragraph'],tools:['rag'],scopes:['lesson','paragraph']},
  lesson:{name:'lesson',capabilities:['read-source','read-lesson','write-lesson','write-paragraph'],tools:['lesson-generator'],scopes:['lesson','paragraph']},
  'visual-step':{name:'visual-step',capabilities:['read-lesson','write-visual'],tools:['visual-compiler'],scopes:['paragraph','problem']},
  math:{name:'math',capabilities:['read-lesson','write-paragraph','verify-math'],tools:['math-verifier','visual-compiler'],scopes:['paragraph','problem']},
  graph:{name:'graph',capabilities:['read-lesson','write-visual'],tools:['visual-compiler'],scopes:['paragraph','problem']},
  geometry:{name:'geometry',capabilities:['read-lesson','write-visual','verify-math'],tools:['math-verifier','visual-compiler'],scopes:['paragraph','problem']},
  voice:{name:'voice',capabilities:['read-lesson','write-audio'],tools:['tts'],scopes:['paragraph','problem']},
  sync:{name:'sync',capabilities:['read-lesson','write-audio'],tools:['tts'],scopes:['paragraph','problem']},
  assessment:{name:'assessment',capabilities:['read-lesson','assess'],tools:['assessment'],scopes:['paragraph','problem','student']},
  'student-intelligence':{name:'student-intelligence',capabilities:['read-student','write-student'],tools:['student-profile'],scopes:['student','paragraph','problem']},
  remediation:{name:'remediation',capabilities:['read-student','read-lesson','write-student'],tools:['student-profile','recovery'],scopes:['student','paragraph','problem']},
  doubt:{name:'doubt',capabilities:['read-source','read-lesson'],tools:['rag'],scopes:['paragraph','problem','student']},
  material:{name:'material',capabilities:['read-lesson','create-material'],tools:['materials'],scopes:['lesson','paragraph','problem']},
  teacher:{name:'teacher',capabilities:['read-lesson','teacher-tools'],tools:['teacher'],scopes:['lesson','paragraph','problem']},
  parent:{name:'parent',capabilities:['read-student','parent-report'],tools:['parent'],scopes:['student','lesson']},
  analytics:{name:'analytics',capabilities:['analytics'],tools:['analytics'],scopes:['lesson','paragraph','problem','student','session']},
  'session-memory':{name:'session-memory',capabilities:['session'],tools:['session-store'],scopes:['session','student','lesson']},
  'model-router':{name:'model-router',capabilities:['route-model'],tools:['model-registry'],scopes:['session','lesson','paragraph','problem','student']},
  recovery:{name:'recovery',capabilities:['recover','write-paragraph','write-problem','write-visual','write-audio'],tools:['recovery'],scopes:['paragraph','problem','lesson']},
};

export function getAgentDefinition(name: AgentName): AgentDefinition { return definitions[name]; }
export function listAgentDefinitions(): AgentDefinition[] { return Object.values(definitions); }

export function assertAgentPermission(name: AgentName, capability: AgentCapability, scope: AgentDefinition['scopes'][number]) {
  const def = definitions[name];
  if (!def.capabilities.includes(capability)) throw new Error(`Agent ${name} is not permitted to ${capability}`);
  if (!def.scopes.includes(scope)) throw new Error(`Agent ${name} is not permitted at ${scope} scope`);
}
