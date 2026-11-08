import fs from 'node:fs';
import path from 'node:path';
const root = process.cwd();
const required = [
  'lib/ai-guru/contracts', 'lib/ai-guru/integration/v43-pipeline.ts',
  'lib/ai-guru/integration/sprint3-visual-pipeline.ts', 'lib/ai-guru/integration/sprint5-voice-pipeline.ts',
  'lib/ai-guru/integration/sprint6-learning-loop.ts', 'lib/ai-guru/integration/sprint7-platform.ts',
  'lib/ai-guru/runtime/agent-registry.ts', 'lib/ai-guru/runtime/execute-agent.ts',
  'lib/ai-guru/recovery/recovery-controller.ts', 'components/ai-guru/AIGuruClassroom.tsx'
];
const missing = required.filter(x => !fs.existsSync(path.join(root,x)));
const oldController = fs.existsSync(path.join(root,'lib/ai-guru/teaching/controller.ts'));
if (missing.length || oldController) { console.error(JSON.stringify({ok:false,missing,oldController},null,2)); process.exit(1); }
console.log(JSON.stringify({ok:true,missing:[],oldController:false,message:'AI Guru Sprint 8.1 integration anchors are present and legacy duplicate controller is removed.'},null,2));
