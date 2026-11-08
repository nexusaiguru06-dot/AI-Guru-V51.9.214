import type { CueEvent, WordCue } from '../lesson/types';

export type CueLike = Pick<CueEvent, 'id' | 'trigger' | 'triggerText' | 'startMs' | 'endMs'>;

const normalize=(s:string)=>s.toLocaleLowerCase().normalize('NFKC').replace(/[.,!?;:'"()\[\]{}]+/g,'').trim();

export function alignCuesToWords<T extends CueLike>(cues:T[], words:WordCue[]):T[]{
  return cues.map(cue=>{
    if(cue.trigger==='time'||!cue.triggerText) return cue;
    const wanted=cue.triggerText.trim().split(/\s+/).map(normalize).filter(Boolean);
    for(let i=0;i<words.length;i++){
      const got=normalize(words[i].word);
      if(wanted.length===1 && got===wanted[0]) return {...cue,startMs:words[i].startMs,endMs:words[i].endMs};
      if(wanted.length>1){
        const slice=words.slice(i,i+wanted.length).map(w=>normalize(w.word));
        if(slice.join(' ')===wanted.join(' ')) return {...cue,startMs:words[i].startMs,endMs:words[i+wanted.length-1].endMs};
      }
    }
    return cue;
  });
}
export function buildWordCues(text:string,boundaries:Array<{word:string;startMs:number;endMs?:number}>):WordCue[]{return boundaries.map((b,i)=>({id:`word:${i}`,word:b.word,startMs:b.startMs,endMs:b.endMs??b.startMs+250}));}
export class AIGuruCueEngine {private fired=new Set<string>(); constructor(private readonly runtime:{nowMs:()=>number;fire:(cue:CueEvent)=>void}){} reset(){this.fired.clear();} tick(cues:CueEvent[]){const now=this.runtime.nowMs();const due=cues.filter(c=>!this.fired.has(c.id)&&c.startMs<=now);due.forEach(c=>{this.fired.add(c.id);this.runtime.fire(c)});return due;}}
