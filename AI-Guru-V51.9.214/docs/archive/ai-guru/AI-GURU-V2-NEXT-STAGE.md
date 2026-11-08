# AI Guru V2 — OpenMAIC integration stage

Implemented on top of OpenMAIC v1.0.1:

- AI Guru lesson contract compiles to native OpenMAIC Stage/Scene/Action.
- AI Guru controller can execute through an OpenMAIC runtime port.
- Cue alignment now supports word timestamps and preserves time cues.
- Math verification is an injectable boundary for the existing Math.js/Mathsteps pipeline.
- One-paragraph Grade 12 fixture demonstrates English + Malayalam text + mathematical visuals.
- `/api/ai-guru/lesson` validates and compiles lesson JSON.

Next wiring target: mount `OpenMAICTeachingPort` around the existing ActionEngine/PlaybackEngine, then connect the reference panel and real TTS provider outputs. The lesson contract intentionally keeps Malayalam text independent from TTS success.
