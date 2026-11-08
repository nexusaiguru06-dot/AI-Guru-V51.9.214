# AI Guru Classroom TTS

## Runtime order

The classroom tries the voices in this order and moves to the next one when a voice fails. A voice that fails is skipped
for 5 minutes. Source of truth: `lib/ai-guru/tts/provider-order.ts`.

| Order | English | Malayalam |
|---|---|---|
| 1 | Microsoft Edge Read Aloud (`en-IN-NeerjaNeural`) | Microsoft Edge Read Aloud (`ml-IN-SobhanaNeural` or `ml-IN-MidhunNeural`, chosen in Settings) |
| 2 | Piper (local) | **On-device Malayalam voice ("Rasa")**, if the student downloaded it in Settings → Local TTS |
| 3 | Google Cloud Text-to-Speech | Piper (local) |
| 4 | Sarvam | Google Cloud Text-to-Speech |
| 5 | — | Sarvam |

- **Cost.** Edge, Piper and the on-device voice are free. Google Cloud and Sarvam are paid; on a live site the server's
  keys for them are used only for signed-in users.
- **Piper first.** Choosing "Local Piper first" in Settings puts Piper (and, for Malayalam, the on-device voice) first.
- **Slow devices.** If the on-device voice is too slow on a device, Edge reads Malayalam there for 30 minutes.
- **Browser voice.** The classroom never falls back to the browser's own `SpeechSynthesis` voice. The doubt pane
  (`components/DoubtCameraMic.tsx`) still uses it to read replies aloud.

## Edge TTS

The server uses `msedge-tts` (MIT) and the voices:

- English: `en-IN-NeerjaNeural`
- Malayalam: `ml-IN-SobhanaNeural`

No Microsoft account or API key is required by the Edge Read Aloud service. The synthesis is performed server-side.

## Google Cloud TTS

Cloud TTS is also called server-side. Configure either:

- `GOOGLE_CLOUD_TTS_API_KEY`, or
- Google Application Default Credentials (`GOOGLE_APPLICATION_CREDENTIALS` / local `gcloud auth application-default login`).

A Gemini Developer / Google AI Studio API key is **not automatically a Google Cloud Text-to-Speech credential**. If the key stored in `GEMINI_API_KEY` is actually a Google Cloud API key authorized for Cloud TTS, you may set `GOOGLE_CLOUD_TTS_USE_GEMINI_KEY=true`; otherwise use a Cloud TTS credential.

Cloud Text-to-Speech requires the API to be enabled and billing configured for the Google Cloud project. See Google's current authentication guidance before production deployment.
