import { synchronizeSpeechToScene, type SpeechSynthesisResult } from '../audio-timing-adapter';
import type { GuruScene } from '../scene-contracts';

function scene(): GuruScene {
  return {
    schemaVersion:'1.0', id:'s1', lessonId:'l1', segmentId:'seg', title:'Test', domain:'algebra' as never,
    grade:8, gradeBand:'6-8', language:'malayalam', durationMs:3000, teachingGoal:'test',
    objects:[], actions:[], cameras:[], keyframes:[], timelineCues:[],
    audioCues:[
      {id:'w1',atMs:0,language:'malayalam',text:'ആദ്യം',word:'ആദ്യം'},
      {id:'w2',atMs:500,language:'malayalam',text:'x',word:'x'}
    ], generative:{enabled:false,purpose:'background',conditions:[],durationMs:3000,forbiddenOutputs:['equations','graphs','geometry-truth','verified-labels','mathematical-transformations']},
    layers:[], rendererPolicy:{math:{renderer:'math-engine',deterministic:true},generative:{renderer:'none',enabled:false,deterministic:false},composition:{renderer:'composition',deterministic:true}}, verificationRefs:[]
  };
}

const speech: SpeechSynthesisResult = {assetUri:'audio.wav',durationMs:1800,language:'malayalam',provider:'sarvam',wordTimings:[{word:'ആദ്യം',startMs:120,endMs:420},{word:'x',startMs:700,endMs:900}]};
const cues=synchronizeSpeechToScene(scene(),speech);
if(cues.find(c=>c.id==='w1')?.atMs!==120) throw new Error('word cue was not synchronized');
if(cues.find(c=>c.id==='w2')?.atMs!==700) throw new Error('second word cue was not synchronized');
console.log('Sprint F speech sync smoke: PASS');
