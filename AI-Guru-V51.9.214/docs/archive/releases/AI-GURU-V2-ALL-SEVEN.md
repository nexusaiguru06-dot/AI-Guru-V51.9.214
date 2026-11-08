# AI Guru V2 — all 7 integrations

1. **AI lesson generation** — `POST /api/ai-guru/generate-lesson`; Gemini creates an `AIGuruLesson` from a paragraph. Set `GEMINI_API_KEY` and optionally `GEMINI_MODEL`.
2. **Math.js + Mathsteps** — `MathJsMathstepsVerifier` is the advanced verifier; `HybridMathVerifier` keeps a safe fallback. The root package manifest now declares both dependencies.
4. **Piper + Sarvam TTS** — `/api/ai-guru/piper-tts` and `/api/ai-guru/sarvam-tts`. Sarvam uses `POST /text-to-speech`; Piper expects a local HTTP service configured with `PIPER_TTS_URL`.
5. **Word/cue synchronization** — `AIGuruCueEngine`, cue alignment API, and browser speech-boundary execution. A future Piper/Sarvam/Whisper service can supply precise timestamps without changing the lesson schema.
6. **Exact PDF reference page + spotlight** — `/api/ai-guru/reference/render-page` rasterizes the selected PDF page; `pageImage` is displayed in the left panel and `boundingBox` is overlaid without moving the page.
7. **Automated lesson QA** — `/api/ai-guru/qa` checks source, page, Malayalam Unicode, cue targets, IDs and lesson integrity. Math checks are included during lesson generation.

## Runtime contract

`AIGuruLesson -> AIGuruTeachingController -> OpenMAIC actions/playback -> reference + whiteboard + audio`.

No second player, whiteboard engine, or TTS framework is introduced.
