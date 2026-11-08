# AI Guru Sprint I — Multi-Provider TTS

Sprint I replaces the single-provider speech dependency with a language-aware TTS manager.

## Default order

### Malayalam
1. Sarvam
2. Google Cloud TTS
3. Microsoft Edge TTS

### English
1. Sarvam
2. Google Cloud TTS
3. Microsoft Edge TTS
4. Piper

For explicitly offline English, `preferOffline: true` changes the order to Piper first.

## Provider contract

Every provider returns the same renderer-neutral `SpeechSynthesisResult`, including word-level timings. Sprint F/G therefore do not care which provider generated the audio.

## Environment

- `AI_GURU_SARVAM_TTS_BASE_URL`
- `SARVAM_API_KEY`
- `AI_GURU_GOOGLE_TTS_API_KEY` or `AI_GURU_GOOGLE_TTS_ACCESS_TOKEN`
- `AI_GURU_GOOGLE_TTS_EN_VOICE`
- `AI_GURU_GOOGLE_TTS_ML_VOICE`
- `AI_GURU_EDGE_TTS_BASE_URL`
- `AI_GURU_EDGE_TTS_API_KEY`
- `AI_GURU_EDGE_TTS_EN_VOICE`
- `AI_GURU_EDGE_TTS_ML_VOICE`
- `AI_GURU_PIPER_TTS_BASE_URL`
- `AI_GURU_PIPER_TTS_API_KEY`
- `AI_GURU_PIPER_EN_VOICE`
- `AI_GURU_PIPER_LANGUAGES=english`

Edge and Piper are isolated behind local HTTP bridges so the browser bundle does not need server-only runtimes. The same provider contract can later be backed by native Edge/Piper processes.

## Google timing

The Google adapter uses SSML marks (`w_0`, `w_1`, ...) and requests `SSML_MARK` timepoints. The returned timepoints are normalized into word timings for Sprint F/G.

## Safety

TTS provider selection never changes mathematical rendering authority. Math Engine remains authoritative for equations, graphs, geometry and transformations. TTS only supplies audio and timing.
