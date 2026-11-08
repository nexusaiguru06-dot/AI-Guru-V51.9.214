import type { SpeechSynthesisResult } from '../audio-timing-adapter';
import type { GuruLanguage } from '../scene-contracts';
import type { AIGuruTTSProvider } from '../tts-provider';
import type { GoogleCloudTTSRequest, GoogleCloudTTSResponse } from './GoogleCloudTTSRequest';

export interface GoogleCloudTTSClientOptions {
  baseUrl?:string;
  apiKey?:string;
  accessToken?:string;
  timeoutMs?:number;
  voices?:Partial<Record<GuruLanguage,string>>;
  speakingRate?:number;
}

function escapeXml(value:string):string {
  return value.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
}
function words(text:string):string[] { return text.trim().split(/\s+/).filter(Boolean); }
function buildMarkedSsml(text:string):string {
  return words(text).map((word,index)=>`<mark name="w_${index}"/>${escapeXml(word)}`).join(' ');
}

export class GoogleCloudTTSClient implements AIGuruTTSProvider {
  readonly id='google-cloud' as const;
  readonly displayName='Google Cloud Text-to-Speech';
  constructor(private readonly options:GoogleCloudTTSClientOptions={}) {}
  supports(_language:GuruLanguage):boolean { return true; }
  async isAvailable():Promise<boolean> { return Boolean(this.options.apiKey || this.options.accessToken); }

  async synthesize(input:{text:string;language:GuruLanguage;sceneId:string;outputUri?:string}):Promise<SpeechSynthesisResult> {
    const request:GoogleCloudTTSRequest={text:input.text,language:input.language,voice:this.options.voices?.[input.language] || undefined,speakingRate:this.options.speakingRate,outputUri:input.outputUri,sceneId:input.sceneId};
    const languageCode=input.language==='malayalam'?'ml-IN':'en-IN';
    const body={
      input:{ssml:buildMarkedSsml(input.text)},
      voice:{languageCode,name:request.voice || undefined},
      audioConfig:{audioEncoding:'LINEAR16',speakingRate:request.speakingRate ?? 1},
      enableTimePointing:['SSML_MARK'],
    };
    const base=this.options.baseUrl ?? 'https://texttospeech.googleapis.com/v1/text:synthesize';
    const url=new URL(base);
    if(this.options.apiKey) url.searchParams.set('key',this.options.apiKey);
    const controller=new AbortController(); const timer=setTimeout(()=>controller.abort(),this.options.timeoutMs??120000);
    try {
      const response=await fetch(url,{method:'POST',headers:{'content-type':'application/json',...(this.options.accessToken?{authorization:`Bearer ${this.options.accessToken}`}:{})},body:JSON.stringify(body),signal:controller.signal});
      if(!response.ok) throw new Error(`Google Cloud TTS HTTP ${response.status}: ${await response.text()}`);
      const data=(await response.json()) as GoogleCloudTTSResponse;
      const timing=data.timepoints ?? [];
      const durationMs=this.estimateDurationMs(timing, words(input.text).length);
      const wordTimings=timing.filter((p)=>/^w_\d+$/.test(p.markName)).map((p,index)=>({word:words(input.text)[index] ?? '',startMs:Math.round(p.timeSeconds*1000),endMs:Math.round((timing[index+1]?.timeSeconds ?? durationMs/1000)*1000),tokenIndex:index}));
      return {assetUri:`data:audio/wav;base64,${data.audioContent}`,durationMs,language:input.language,wordTimings,provider:'google-cloud',metadata:{requestId:data.requestId ?? '',voice:request.voice ?? '',languageCode}};
    } finally { clearTimeout(timer); }
  }

  private estimateDurationMs(timepoints:GoogleCloudTTSResponse['timepoints'], count:number):number {
    if(timepoints && timepoints.length>0) return Math.max(1,Math.round((timepoints[timepoints.length-1].timeSeconds+0.25)*1000));
    return Math.max(250, count*180);
  }
}
