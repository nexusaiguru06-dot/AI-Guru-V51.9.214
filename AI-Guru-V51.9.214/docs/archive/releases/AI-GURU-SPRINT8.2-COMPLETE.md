# Sprint 8.2 — Dependency Isolation & Native Runtime

Implemented against the uploaded Sprint 8.1 package.

## Native runtime boundary
The active Next.js application is now AI Guru-only. Legacy non-AI-Guru routes remain under `legacy-app/` and are not compiled by Next.js.

OpenMAIC is not an active package dependency and no active AI Guru source imports `@openmaic/*`.

## Native agent/runtime boundary
- Agent execution and audit are dependency-free.
- Session memory is dependency-free and in-process.
- Lesson/Paragraph/Problem canonical contracts remain authoritative.
- Visual Step QA and targeted visual recovery remain paragraph/problem/step scoped.
- Math verification and Universal Math Compiler remain active.
- Native classroom uses the existing MathLikeAnim adapter.
- Malayalam classroom text uses Chilanka with Noto Sans Malayalam fallbacks.
- TTS remains Sarvam → Piper → device fallback.

## Build boundary
`tsconfig.json` includes only the active AI Guru app/runtime and excludes `legacy-app` and OpenMAIC workspace directories.
