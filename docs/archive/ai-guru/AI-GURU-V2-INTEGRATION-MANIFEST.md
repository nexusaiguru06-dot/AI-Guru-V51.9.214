# AI Guru V2 integration manifest

## Adopt from OpenMAIC 1.0.1
- `@openmaic/dsl` Action/Scene contracts
- `lib/playback/*` playback and navigation
- `lib/action/engine.ts` action execution
- `lib/choreography/*` timing and timeline
- `lib/whiteboard/runtime/*` whiteboard runtime
- `lib/api/stage-api-whiteboard.ts` whiteboard API
- `lib/document/*` document extraction/storage interfaces
- `lib/document-store/*` persistent document store
- `lib/audio/*` TTS/audio abstractions and duration utilities
- `lib/server/agent-runtime/*` durable agent/material workflows
- `render-service/*` rendering/export infrastructure

## Add from the selected external repositories
- Docling: PDF/OCR/layout/formula extraction adapter (server-side)
- MathLikeAnim-rs: math visual renderer adapter
- Math.js + Mathsteps: math verification adapter
- Whisper/faster-whisper: optional word timestamp provider
- Whiteboard Animator: optional hand-drawn image effect
- Xberg: document-parser benchmark/fallback only
- Cubecubed: advanced 3D fallback only
- Manim: offline/server material-rendering option only
- create-whiteboard-video: workflow/QA ideas only; do not duplicate its player

## New AI Guru layer
- `lib/ai-guru/lesson/types.ts`: canonical lesson contract
- `lib/ai-guru/lesson/validate.ts`: lesson QA contract
- `lib/ai-guru/teaching/controller.ts`: pedagogical state machine
- `lib/ai-guru/teaching/openmaic-port.ts`: OpenMAIC runtime bridge
- `lib/ai-guru/cues/engine.ts`: cue scheduling boundary
- `lib/ai-guru/math/adapter.ts`: math verification boundary
- `lib/ai-guru/document/normalize.ts`: normalized paragraph source model
- `lib/ai-guru/reference/panel-model.ts`: fixed PDF reference/spotlight model

## First vertical slice
PDF paragraph -> reference page/spotlight -> source reading -> English explanation -> math whiteboard -> Malayalam text -> Malayalam visuals -> Malayalam audio -> next paragraph.
