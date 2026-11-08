# AI Guru Sprint 8.3.1 — Build Repair

This patch repairs the application shell and build-facing integration defects found after Sprint 8.3.

## Fixed

- Added the mandatory Next.js App Router root layout with `<html>` and `<body>`.
- Added Tailwind v4 global CSS and the PostCSS plugin configuration.
- Added `next-env.d.ts` for the Next/TypeScript toolchain.
- Added ESLint flat configuration for Next 16.
- Self-hosted Chilanka through `@fontsource/chilanka`; runtime Google Fonts injection was removed.
- Added the missing `/public/demo/page-27.png` textbook reference generated from the demo PDF.
- Repaired teaching tests to use the canonical `AIGuruClassroomController` rather than a removed duplicate controller.
- Added `/api/ai-guru/voice/health` for non-secret Sarvam/Piper/browser fallback readiness reporting.
- Added agent `name` contracts to Math, Visual Step, and Voice agents.
- Unified cue alignment typing so both canonical `AudioCue` and legacy classroom `CueEvent` can be aligned without unsafe casts.
- Repaired Sprint 5 provider typing and Sprint 6 assessment evaluation auditing.
- Added a full build-repair audit script.

## Architectural rule preserved

The existing AI Guru Universal Visual/Math Graphics Engine remains the canonical renderer. Sprint 8.3.1 only repairs the application shell and integration contracts; it does not replace or remove the graphics engine.

## Verification

`node scripts/ai-guru-build-repair-audit.mjs` passes with zero failures and zero warnings.

A full dependency installation/build could not be executed in the packaging environment because the npm registry was unavailable. The Windows machine should run `pnpm install` and then `pnpm run build` as the final environment-level verification.
