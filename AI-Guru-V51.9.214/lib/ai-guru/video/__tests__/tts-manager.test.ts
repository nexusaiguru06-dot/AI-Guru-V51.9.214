import { AIGuruTTSManager, type AIGuruTTSProvider } from '../tts-provider';
import type { SpeechSynthesisResult } from '../audio-timing-adapter';

type Lang='english'|'malayalam';
function fake(id:AIGuruTTSProvider['id'], languages:Lang[], shouldFail=false):AIGuruTTSProvider {
  return {id,displayName:id,supports:(l)=>languages.includes(l),isAvailable:async()=>true,synthesize:async(input):Promise<SpeechSynthesisResult>=>{
    if(shouldFail) throw new Error(`${id} failed`);
    return {assetUri:`${id}://${input.sceneId}`,durationMs:1000,language:input.language,wordTimings:[{word:'hello',startMs:0,endMs:500}],provider:id};
  }};
}

describe('AI Guru TTS manager',()=>{
  it('uses Malayalam order Sarvam → Google → Edge',async()=>{
    const manager=new AIGuruTTSManager({providers:[fake('sarvam',['malayalam']),fake('google-cloud',['malayalam']),fake('edge',['malayalam'])]});
    const result=await manager.synthesize({text:'hello',language:'malayalam',sceneId:'s1'});
    if(result.provider!=='sarvam') throw new Error('Expected Sarvam');
  });
  it('falls through failed provider',async()=>{
    const manager=new AIGuruTTSManager({providers:[fake('sarvam',['english'],true),fake('google-cloud',['english'])]});
    const result=await manager.synthesize({text:'hello',language:'english',sceneId:'s1'});
    if(result.provider!=='google-cloud') throw new Error('Expected Google fallback');
  });
  it('can prefer offline Piper for English',async()=>{
    const manager=new AIGuruTTSManager({providers:[fake('piper',['english']),fake('sarvam',['english'])]});
    const result=await manager.synthesizeWithPreferences({text:'hello',language:'english',sceneId:'s1'},{preferOffline:true});
    if(result.provider!=='piper') throw new Error('Expected Piper');
  });
});
