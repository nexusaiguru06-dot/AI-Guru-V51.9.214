import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { measureAudioDuration } from '@/lib/audio/audio-duration';
import { GoogleAuth } from 'google-auth-library';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';
import { serverKey, serverKeysAllowed, SIGN_IN_FOR_SERVER_KEY } from '../net/server-keys';

export interface TTSRequest { text:string; languageCode:string; speaker?:string; model?:string; pace?:number; }
export interface TTSResult { audioBase64:string; format:string; provider:string; durationMs?:number; words?:Array<{word:string;startMs:number;endMs:number}>; }

const EDGE_VOICES: Record<string,string> = {
  'en-IN': process.env.EDGE_TTS_EN_VOICE || 'en-IN-NeerjaNeural',
  'ml-IN': process.env.EDGE_TTS_ML_VOICE || 'ml-IN-SobhanaNeural',
};

function normaliseRate(pace = 1) {
  const pct = Math.round((Math.max(0.5, Math.min(1.5, pace)) - 1) * 100);
  return `${pct >= 0 ? '+' : ''}${pct}%`;
}

/**
 * Microsoft Edge Read Aloud is the primary classroom voice. It runs server-side
 * so Chrome never falls back to window.speechSynthesis. msedge-tts is MIT and
 * talks to Microsoft's Edge Read Aloud service from Node.js.
 */
export async function edgeTTS(input:TTSRequest):Promise<TTSResult>{
  const voice = input.speaker || EDGE_VOICES[input.languageCode] || (input.languageCode.startsWith('ml') ? 'ml-IN-SobhanaNeural' : 'en-IN-NeerjaNeural');
  const rate = normaliseRate(input.pace);
  const text = String(input.text || '').trim();
  if (!text) throw new Error('Edge TTS requires non-empty text.');

  const timeoutMs = Number(process.env.EDGE_TTS_TIMEOUT_MS || 18000);

  const run = async (): Promise<TTSResult> => {
    const tts = new MsEdgeTTS();
    // setMetadata opens a websocket to Microsoft — often the hang point behind network/firewall blocks.
    try {
      await Promise.race([
        tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3, {
          wordBoundaryEnabled: false,
          sentenceBoundaryEnabled: false,
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Edge TTS setMetadata timed out (blocked path to speech.platform.bing.com?)')), Math.min(10000, timeoutMs)),
        ),
      ]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new Error(`Edge TTS metadata/handshake failed: ${msg}`);
    }

    let streamResult: any;
    try {
      streamResult = await (tts as any).toStream(text, rate);
    } catch {
      streamResult = await tts.toStream(text);
    }
    const audioStream = streamResult.audioStream ?? streamResult;
    const audioChunks: Buffer[] = [];

    await new Promise<void>((resolve, reject) => {
      if (!audioStream || typeof audioStream.on !== 'function') {
        reject(new Error('Edge TTS returned no audio stream.'));
        return;
      }
      const t = setTimeout(() => reject(new Error('Edge TTS audio stream timed out')), timeoutMs);
      audioStream.on('data', (chunk: Buffer) => audioChunks.push(Buffer.from(chunk)));
      audioStream.on('end', () => { clearTimeout(t); resolve(); });
      audioStream.on('error', (err: Error) => { clearTimeout(t); reject(err); });
    });

    const audio = Buffer.concat(audioChunks);
    if (!audio.length) throw new Error('Edge TTS returned empty audio (Microsoft may have refused the voice/request).');
    return {
      audioBase64: audio.toString('base64'),
      format: 'mpeg',
      provider: 'edge',
      durationMs: Math.round((measureAudioDuration(audio, 'mpeg') ?? 0) * 1000) || undefined,
      words: [],
    };
  };

  try {
    return await Promise.race([
      run(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Edge TTS timed out after ${timeoutMs}ms — server cannot reach Microsoft Read Aloud`)), timeoutMs + 2000),
      ),
    ]);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // Re-throw with actionable hint for teaching log
    throw new Error(msg.includes('Edge TTS') ? msg : `Edge TTS failed: ${msg}`);
  }
}

function parseEdgeMetadata(_bytes: Buffer): Array<{word:string;startMs:number;endMs:number}> {
  // Metadata formats differ between package releases. Keep this deliberately
  // conservative: audio playback is authoritative and cue timing is optional.
  return [];
}

/**
 * Google Cloud Text-to-Speech is the secondary cloud voice. It is server-side
 * only. It can use a dedicated Cloud API key, or ADC/service-account credentials.
 * A Gemini Developer API key is NOT automatically a Cloud TTS credential.
 * If the user intentionally uses a Google Cloud API key for both services,
 * set GOOGLE_CLOUD_TTS_API_KEY to that key.
 */
export async function googleCloudTTS(input:TTSRequest):Promise<TTSResult>{
  const endpoint = process.env.GOOGLE_CLOUD_TTS_ENDPOINT || 'https://texttospeech.googleapis.com/v1/text:synthesize';
  const headers: Record<string,string> = { 'content-type':'application/json' };
  // V51.9.176: Google Cloud TTS is paid — only for signed-in users (this also covers the server's own Google login, ADC)
  if (!(await serverKeysAllowed())) throw new Error(SIGN_IN_FOR_SERVER_KEY);
  const apiKey = process.env.GOOGLE_CLOUD_TTS_API_KEY || (process.env.GOOGLE_CLOUD_TTS_USE_GEMINI_KEY === 'true' ? process.env.GEMINI_API_KEY : undefined);

  if (apiKey) {
    headers['x-goog-api-key'] = apiKey;
  } else {
    const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
    const client = await auth.getClient();
    const token = await client.getAccessToken();
    if (!token.token) throw new Error('Google Cloud TTS needs GOOGLE_CLOUD_TTS_API_KEY or Google ADC/service-account credentials.');
    headers.Authorization = `Bearer ${token.token}`;
  }

  const voiceName = input.speaker || (input.languageCode === 'ml-IN' ? process.env.GOOGLE_TTS_ML_VOICE || 'ml-IN-Standard-A' : process.env.GOOGLE_TTS_EN_VOICE || 'en-IN-Neural2-A');
  const r = await fetch(endpoint, {
    method:'POST',
    headers,
    body:JSON.stringify({
      input:{ text:input.text },
      voice:{ languageCode:input.languageCode, name:voiceName },
      audioConfig:{ audioEncoding:'MP3', speakingRate:input.pace ?? 1 },
    }),
  });
  if (!r.ok) throw new Error(`Google Cloud TTS failed: ${r.status} ${await r.text()}`);
  const data = await r.json() as any;
  if (!data.audioContent) throw new Error('Google Cloud TTS returned no audio.');
  const bytes = Buffer.from(data.audioContent, 'base64');
  return { audioBase64:data.audioContent, format:'mpeg', provider:'google-cloud', durationMs: Math.round((measureAudioDuration(bytes, 'mpeg') ?? 0) * 1000) || undefined };
}

export async function sarvamTTS(input:TTSRequest, ownKey?:string):Promise<TTSResult>{
  // V51.9.176: the visitor's own Sarvam key, or the server's key only for signed-in users
  const apiKey = ownKey || await serverKey('SARVAM_API_KEY');
  if(!apiKey) throw new Error(process.env.SARVAM_API_KEY ? SIGN_IN_FOR_SERVER_KEY : 'SARVAM_API_KEY is not configured.');
  const r=await fetch(`${process.env.SARVAM_BASE_URL||'https://api.sarvam.ai'}/text-to-speech`,{method:'POST',headers:{'content-type':'application/json','api-subscription-key':apiKey},body:JSON.stringify({text:input.text,language_code:input.languageCode,speaker:input.speaker||'shubh',model:input.model||'bulbul:v3',pace:input.pace??1,output_audio_codec:'wav',speech_sample_rate:24000})});
  if(!r.ok) throw new Error(`Sarvam TTS failed: ${r.status} ${await r.text()}`);
  const data=await r.json() as any; const audioBase64=data.audios?.[0]||'';
  if(!audioBase64) throw new Error('Sarvam TTS returned no audio.');
  const bytes = Buffer.from(audioBase64, 'base64'); return {audioBase64,format:'wav',provider:'sarvam',durationMs:Math.round((measureAudioDuration(bytes,'wav') ?? 0) * 1000) || undefined};
}

export async function piperTTS(input:TTSRequest):Promise<TTSResult>{
  const url=process.env.PIPER_TTS_URL;
  if(url){
    const r=await fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({text:input.text,language:input.languageCode,voice:input.speaker,speed:input.pace??1})});
    if(!r.ok) throw new Error(`Piper TTS failed: ${r.status} ${await r.text()}`);
    const contentType=r.headers.get('content-type')||'audio/wav'; const bytes=new Uint8Array(await r.arrayBuffer());
    const audioBase64 = Buffer.from(bytes).toString('base64'); return {audioBase64,format:contentType.includes('mpeg')?'mp3':'wav',provider:'piper-http',durationMs:Math.round((measureAudioDuration(bytes, contentType.includes('mpeg')?'mp3':'wav') ?? 0) * 1000) || undefined};
  }
  const dataRoot = process.env.PIPER_DATA_DIR || join(process.cwd(), 'data', 'piper');
  const modelsDir = process.env.PIPER_MODELS_DIR || join(dataRoot, 'voices');
  const isWin = process.platform === 'win32';
  let bin = process.env.PIPER_BIN || '';
  const binExists = (p: string) => Boolean(p) && existsSync(p);
  const tryWinExe = (p: string) => {
    if (!p) return '';
    if (binExists(p)) return p;
    if (isWin && !p.toLowerCase().endsWith('.exe') && binExists(p + '.exe')) return p + '.exe';
    if (isWin) {
      const alt = join(p.endsWith('piper') || p.endsWith('piper.exe') ? join(p, '..') : p, 'piper.exe');
      // dirname via join path
    }
    return binExists(p) ? p : '';
  };
  if (!binExists(bin)) {
    const hint = join(dataRoot, 'piper-bin-path.txt');
    if (existsSync(hint)) {
      try { bin = readFileSync(hint, 'utf8').trim(); } catch { bin = ''; }
    }
    if (bin && !binExists(bin) && isWin && !bin.toLowerCase().endsWith('.exe') && binExists(bin + '.exe')) {
      bin = bin + '.exe';
    }
  }
  if (!binExists(bin)) {
    const candidates = isWin
      ? [join(dataRoot, 'bin', 'piper.exe'), join(dataRoot, 'bin', 'piper'), join(dataRoot, 'piper.exe')]
      : [join(dataRoot, 'bin', 'piper'), join(dataRoot, 'bin', 'piper.exe'), '/usr/local/bin/piper', '/usr/bin/piper'];
    bin = candidates.find(binExists) || '';
  }
  if (!binExists(bin)) bin = '';
  const lang = String(input.languageCode || 'en-IN');
  const preferredIds = lang.startsWith('ml')
    ? ['ml_IN-meera-medium', 'ml_IN-arjun-medium']
    : ['en_US-lessac-medium', 'en_GB-alan-medium'];
  let model = input.model || process.env.PIPER_MODEL || '';
  if (!model) {
    for (const id of preferredIds) {
      const candidate = join(modelsDir, `${id}.onnx`);
      if (existsSync(candidate)) { model = candidate; break; }
    }
  }
  if (!bin || !model) throw new Error(`Piper is not configured (bin=${bin || 'missing'}, model=${model || 'missing'}). Open Settings → Local TTS → Install Piper + Malayalam + English. On Windows the file must be piper.exe.`);
  const dir=await mkdtemp(join(tmpdir(),'ai-guru-piper-')); const output=join(dir,'speech.wav');
  try{
    await new Promise<void>((resolve,reject)=>{
      const args=['--model',model,'--output_file',output];
      if(input.pace && Number.isFinite(input.pace)) args.push('--length_scale',String(1/Math.max(.1,input.pace)));
      const child=spawn(bin,args,{windowsHide:true,stdio:['pipe','ignore','pipe'],shell:false});
      let stderr=''; child.stderr.on('data',d=>{stderr+=String(d)});
      child.on('error',(err: NodeJS.ErrnoException)=>{
        if (err?.code === 'ENOENT') reject(new Error(`Piper binary not found at "${bin}". On Windows use piper.exe. Re-run Settings → Local TTS → Install.`));
        else reject(err);
      });
      child.on('close',code=>code===0?resolve():reject(new Error(`Piper exited with code ${code}: ${stderr.trim()}`)));
      child.stdin.write(input.text,'utf8'); child.stdin.end();
    });
    const bytes=await readFile(output); return {audioBase64:bytes.toString('base64'),format:'wav',provider:'piper-local',durationMs:Math.round((measureAudioDuration(bytes,'wav') ?? 0) * 1000) || undefined};
  } finally { await rm(dir,{recursive:true,force:true}).catch(()=>undefined); }
}
