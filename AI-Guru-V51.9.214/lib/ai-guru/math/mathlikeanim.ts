/**
 * AI Guru embedded mathematical renderer boundary.
 *
 * There is deliberately NO HTTP/localhost dependency here.  The classroom
 * calls this renderer in-process.  The command IR is intentionally compatible
 * with the MathLikeAnim-rs adapter boundary so a WASM/native implementation can
 * replace EmbeddedMathLikeAnimRenderer without changing the teaching engine.
 */
export interface MathLikeAnimScene { id:string; width?:number; height?:number; commands:Array<Record<string,unknown>>; }
export interface MathLikeAnimRenderResult { svg:string; events:Array<Record<string,unknown>>; renderer:'embedded-mathlikeanim'; }
export interface MathLikeAnimAdapter { render(scene:MathLikeAnimScene):Promise<MathLikeAnimRenderResult>; }

const esc=(v:unknown)=>String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

/** Lightweight in-process SVG renderer. It is the production-safe fallback
 * and the integration seam for the MathLikeAnim-rs WASM renderer. */
export class EmbeddedMathLikeAnimRenderer implements MathLikeAnimAdapter {
  async render(scene:MathLikeAnimScene):Promise<MathLikeAnimRenderResult>{
    const width=scene.width??1000, height=scene.height??700;
    const body=scene.commands.map((c,i)=>{
      const type=String(c.type??c.kind??'');
      const x=Number(c.x??60), y=Number(c.y??80);
      if(type==='text'||type==='write'||type==='latex') return `<text data-command="${i}" x="${x}" y="${y}" font-size="${Number(c.fontSize??32)}" font-family="${esc(c.fontFamily??'Noto Sans, sans-serif')}" fill="${esc(c.fill??'#fff')}">${esc(c.content??c.text??c.latex)}</text>`;
      if(type==='line') return `<line data-command="${i}" x1="${Number(c.x1??c.startX??x)}" y1="${Number(c.y1??c.startY??y)}" x2="${Number(c.x2??c.endX??x+100)}" y2="${Number(c.y2??c.endY??y)}" stroke="${esc(c.stroke??'#67e8f9')}" stroke-width="${Number(c.strokeWidth??4)}"/>`;
      if(type==='circle') return `<circle data-command="${i}" cx="${Number(c.cx??x)}" cy="${Number(c.cy??y)}" r="${Number(c.r??40)}" fill="none" stroke="${esc(c.stroke??'#67e8f9')}" stroke-width="${Number(c.strokeWidth??4)}"/>`;
      if(type==='rect') return `<rect data-command="${i}" x="${x}" y="${y}" width="${Number(c.width??120)}" height="${Number(c.height??80)}" fill="${esc(c.fill??'none')}" stroke="${esc(c.stroke??'#67e8f9')}" stroke-width="${Number(c.strokeWidth??4)}"/>`;
      return '';
    }).join('');
    return {renderer:'embedded-mathlikeanim',events:scene.commands.map((c,i)=>({index:i,...c})),svg:`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">${body}</svg>`};
  }
}

export const createMathLikeAnimRenderer=()=>new EmbeddedMathLikeAnimRenderer();
