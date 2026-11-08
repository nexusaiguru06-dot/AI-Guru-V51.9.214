# AI Guru V2 deployment

AI Guru is built on OpenMAIC 1.0.1. The mathematical renderer is an in-process adapter: **do not configure `MATHLIKEANIM_URL`**. The classroom does not depend on a localhost MathLikeAnim server.

## Required

- Node.js >= 22.19.0
- pnpm
- Gemini API key for AI lesson generation
- Sarvam API key only when Sarvam TTS is selected

## Build

```bash
pnpm install
pnpm build
pnpm start
```

## Environment

Copy `.env.example.ai-guru` to `.env.local` and set the keys you actually use.

## Runtime architecture

PDF/document -> OpenMAIC extraction/Docling adapter -> AIGuruLesson -> Teaching Controller -> OpenMAIC actions/playback -> embedded math renderer -> whiteboard/reference panels -> Malayalam text/audio -> QA.

Malayalam text rendering is independent of TTS. A TTS failure therefore cannot remove Malayalam teaching text from the classroom.

## MathLikeAnim-rs

The application exposes a stable in-process `MathLikeAnimAdapter` boundary. The current embedded renderer is the deployment-safe renderer. When the MathLikeAnim-rs WASM/native package is vendored into this repository, replace the implementation behind that interface; no URL or deployment service is required.

## Piper

Piper is not represented as a fake remote localhost dependency. If a bundled Piper runtime/model is supplied for a target deployment, the provider can be wired through `PIPER_BIN`/`PIPER_MODEL`. Otherwise the classroom remains usable with its browser speech fallback or Sarvam.
