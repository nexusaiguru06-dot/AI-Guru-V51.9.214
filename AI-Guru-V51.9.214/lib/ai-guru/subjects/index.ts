/** Registry of the subject agents. Maths is NOT here: it stays in motion-class and is never touched by this layer. */
import type { SubjectAgent, SubjectId } from './types';
import { physicsAgent } from './agents/physics';
import { chemistryAgent } from './agents/chemistry';
import { biologyAgent } from './agents/biology';
import { earthAgent } from './agents/earth';
import { computerScienceAgent } from './agents/computer-science';
import { socialAgent } from './agents/social';
import { economicsAgent } from './agents/economics';
import { englishAgent } from './agents/english';

export const AGENTS: SubjectAgent[] = [physicsAgent, chemistryAgent, biologyAgent, earthAgent, computerScienceAgent, socialAgent, economicsAgent, englishAgent];
export const agentById = (id: SubjectId) => AGENTS.find((a) => a.id === id);
export { planSubjects } from './orchestrator';
export { compileMixed } from './compile';
export type * from './types';
