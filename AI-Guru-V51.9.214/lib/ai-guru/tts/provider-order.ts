/**
 * Which voice provider the classroom tries first. One source of truth for the General Class voice and the
 * 3B1B Teacher-Reading board, so Settings -> Local TTS applies to both.
 *
 * Edge Read Aloud is the primary voice for English AND Malayalam (see TTS-SETUP.md). Local Piper stays right behind it,
 * so a network that blocks Edge still gets a voice. Choosing "Local Piper" in Settings puts Piper first instead.
 */
/** V51.9.160: 'rasa' = the Malayalam voice a student downloaded to this device (answered in the browser, see tts-fetch.ts). */
export type TtsProvider = 'edge' | 'google-cloud' | 'sarvam' | 'piper' | 'rasa';
export type TtsTrack = 'english' | 'malayalam';
export type TtsPreference = 'auto' | 'edge' | 'local-piper';

export const EDGE_MALAYALAM_VOICES = ['ml-IN-SobhanaNeural', 'ml-IN-MidhunNeural'] as const;
export type EdgeMalayalamVoice = (typeof EDGE_MALAYALAM_VOICES)[number];

const PREF_KEY = 'ai-guru-tts-preferred';
const ML_VOICE_KEY = 'ai-guru-edge-ml-voice';
const DOWN_MS = 5 * 60 * 1000;
const down = new Map<TtsProvider, number>();

const read = (key: string): string | null => {
  try { return typeof localStorage === 'undefined' ? null : localStorage.getItem(key); } catch { return null; }
};

export function readTtsPreference(): TtsPreference {
  const v = read(PREF_KEY);
  return v === 'edge' || v === 'local-piper' || v === 'auto' ? v : 'auto';
}

/** The Edge voice for a language code. Malayalam can be switched between the female and male voice in Settings. */
export function edgeVoiceFor(languageCode: string): string {
  if (!languageCode.toLowerCase().startsWith('ml')) return 'en-IN-NeerjaNeural';
  const saved = read(ML_VOICE_KEY);
  return (EDGE_MALAYALAM_VOICES as readonly string[]).includes(saved ?? '') ? (saved as string) : EDGE_MALAYALAM_VOICES[0];
}

/** A provider that just failed to synthesise is tried last for a few minutes, so a blocked network does not stall every sentence. */
// V51.9.160: the on-device voice is never sent to the back: it steps aside per sentence (English) and remembers a broken engine itself
export function markTtsProviderDown(provider: TtsProvider, now = Date.now()): void { if (provider !== 'rasa') down.set(provider, now); }
export function clearTtsProviderDown(): void { down.clear(); }

/** The student downloaded the on-device Malayalam voice and left it on (Settings → Local TTS). */
// V51.9.162: …and this device has not been found too slow for it (then Edge reads Malayalam for 30 minutes, see rasa-voice.ts)
export const rasaOnDevice = (now = Date.now()): boolean => read('ai-guru-rasa-voice') === 'on' && !(Number(read('ai-guru-rasa-slow-until')) > now);

export function ttsProviderOrder(track: TtsTrack, pref: TtsPreference | string | null = readTtsPreference(), now = Date.now(), rasa: boolean = rasaOnDevice()): TtsProvider[] {
  const base: TtsProvider[] = pref === 'local-piper'
    ? ['piper', 'edge', 'google-cloud', 'sarvam']
    : ['edge', 'piper', 'google-cloud', 'sarvam'];
  // V51.9.160: Malayalam could be read by the downloaded on-device voice; English never is.
  // V51.9.165: Edge reads Malayalam first (fast, never freezes the page); the on-device voice comes right after it,
  // so it speaks when Edge cannot (offline, blocked network) — or first when "Local Piper first" is chosen.
  if (track === 'malayalam' && rasa) base.splice(pref === 'local-piper' ? 0 : 1, 0, 'rasa');
  const isDown = (p: TtsProvider) => { const at = down.get(p); return at !== undefined && now - at < DOWN_MS; };
  return [...base.filter(p => !isDown(p)), ...base.filter(isDown)];
}
