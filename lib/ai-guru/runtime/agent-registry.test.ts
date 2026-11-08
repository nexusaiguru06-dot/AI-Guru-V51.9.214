import { describe, expect, it } from 'vitest';
import { getAgentDefinition, listAgentDefinitions, assertAgentPermission } from './agent-registry';
describe('AI Guru agent registry',()=>{
 it('contains all platform agents',()=>expect(listAgentDefinitions().length).toBeGreaterThanOrEqual(21));
 it('permits paragraph visual writes only to visual agent',()=>{expect(()=>assertAgentPermission('visual-step','write-visual','paragraph')).not.toThrow();expect(()=>assertAgentPermission('voice','write-visual','paragraph')).toThrow();});
 it('keeps recovery scoped',()=>expect(getAgentDefinition('recovery').scopes).toContain('paragraph'));
});
