export type ModelCapability='lesson'|'math'|'visual'|'voice'|'material'|'assessment'|'doubt';
export interface ModelStatus { id:string; downloaded:boolean; ready:boolean; capabilities:ModelCapability[]; source?:string; }
const state=new Map<string,ModelStatus>();
export function registerModel(status:ModelStatus){state.set(status.id,status);return status;}
export function getModel(id:string){return state.get(id);}
export function listModels(){return [...state.values()];}
export function isModelReady(id:string,capability?:ModelCapability){const m=state.get(id);return !!m?.downloaded&&!!m.ready&&(!capability||m.capabilities.includes(capability));}
export function chooseReadyModel(capability:ModelCapability, preferred?:string){if(preferred&&isModelReady(preferred,capability))return preferred;return listModels().find(m=>isModelReady(m.id,capability))?.id;}
