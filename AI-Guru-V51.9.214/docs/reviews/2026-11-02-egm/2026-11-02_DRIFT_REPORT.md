# Drift report: AI Guru V51.9.173 documents vs code (EGM `egm-drift-report`)

Checked on 2026-11-02 against `AI-Guru-V51_9_173_1.zip`. Only differences are listed.

## README.md

- **Version.** The title says "V49". `VERSION` says V51.9.173, `package.json` says 1.0.2, `VERSION-3B1B` says V51.9.16-3B1B, and `app/api/ai-guru/math/domains/route.ts` returns `version: 'V49'`.
- **Mathsteps.** Lines 36 and 47 say verification is "mathjs + Mathsteps". Mathsteps was removed in V51.9.173 for security. `lib/ai-guru/math/adapters/mathsteps.ts:14` still runs `import('mathsteps')`, which can only fail (fixed later in V51.9.174 on GitHub).
- **Legacy code.** "Legacy routes live under `legacy-app/`" is wrong: that folder does not exist. The legacy code is still in the tree as unused folders: `components/scene-renderers`, `components/workbench`, `components/edit`, `components/stage` and `lib/server` (60 files). Nothing under `app/` imports them.
- **Run commands.** The README says `pnpm install` / `pnpm run dev`. The repo has only `package-lock.json`, and the Dockerfile and guides use npm. Node ≥ 22.19 and `.env.example.ai-guru` are not mentioned.
- **Front page.** "The root route redirects to `/ai-guru`" is wrong: `app/page.tsx` renders the front page (V51.9.169).
- **Fonts.** The README says the Malayalam font is a runtime Google webfont. Fonts are now hosted with the app (`public/fonts/ag`), except Chilanka, which `app/layout.tsx:30` still loads from `fonts.googleapis.com` under a comment that says "Self-hosted".
- **Voice order.** The README says Sarvam → Piper → device speech. `lib/ai-guru/tts/provider-order.ts:47-53` uses Edge → on-device Rasa (Malayalam) → Piper → Google Cloud → Sarvam.
- **Not mentioned at all:** storage modes (files / PostgreSQL / Cloud Storage), the admin, teacher, student and parent sign-ins, Material Studio, reels, the doubt pane, model providers (BYOK / OpenRouter), and deployment.
- **Pipeline diagram.** It lists a "Learning" agent that does not exist. The real agents in `lib/ai-guru/agents/` (doubt, remediation, curriculum, session-memory, …) are missing from it.

## UNIVERSAL-MATH-ENGINE.md

- **Whiteboard.** The runtime contract ends at "OpenMAIC whiteboard/actions". The classroom renders with AI Guru's own boards (`MotionTeachingBoard`, `ThreeB1BTeachingBoard`, manim-web).
- **Mathsteps.** "`Math.js`/`Mathsteps` remain the verification boundary": Mathsteps is gone (see README).
- **Missing script.** "Run `pnpm eval:curriculum`": there is no `eval:curriculum` script in `package.json` (the `eval/curriculum-universal-math/` folder exists).
- **Style routing.** The style-selector claims for area derivation disagree with the code. `reference-style-qa.test.ts` and `style-selector.test.ts` expect `geometry-area-derivation` but the selector returns `area-formula-visual-derivation-reference…`, so those tests fail. This is part of the 21 tests that already failed before V51.9.173.

## TTS-SETUP.md

- **Voice order.** It says Edge → Google Cloud → Sarvam/Piper. The code puts the on-device Rasa voice second for Malayalam and Piper before Google. Rasa is not documented anywhere.
- **Browser speech.** It says browser `SpeechSynthesis` is "disabled". It is still used by the doubt pane (`components/DoubtCameraMic.tsx:890`) and the NCERT demo (`components/ai-guru/NCERTEndToEndDemo.tsx:103`). The README contradicts this document by listing "device speech" as the last fallback.

## docs/DEPLOY-GOOGLE-CLOUD.md

- **Step 4 cannot finish as written for V51.9.173.** `@faiss-node/native` is a required dependency that compiles C++ during `npm ci`, and the slim build image has no compiler, so Cloud Build fails at step 0. Fixed in V51.9.174 (PR #3).
- **Step 7 has the same problem.** Its `npm ci` in Cloud Shell needs the same faiss build.
- **Step 7 can carry the development password to the live site.** It copies the PC's `data/ai-guru/admin/auth.json`, which is often the development sign-in xxx / yyy, into PostgreSQL. If the `ADMIN_*` secrets are ever missing, `auth.ts` `load()` accepts that saved record instead of showing "no admin sign-in is set". The guide promises the opposite in two places.
- **"Limits to know" is incomplete.** It omits in-memory work that Cloud Run does not keep or share between copies: study-material jobs (`lib/ai-guru/library/cloud.ts:32-97`), the request limits and the doubt-pane message limit. It also omits the history caps of 5,000 quiz records and 20,000 attendance records.

## .env.example.ai-guru

- **Undocumented settings.** The code reads 89 environment variables; the example names about 40. About 50 are undocumented, for example `AI_GURU_ALLOW_DEV_ADMIN`, `AI_GURU_DATA_ROOT`, `AI_GURU_PG_POOL`, `OPENAI_API_KEY`, `SYMPY_VERIFIER_URL`, `NEXT_PUBLIC_SITE_URL`, the `AI_GURU_EDGE_TTS_*`, `AI_GURU_GOOGLE_TTS_*`, `AI_GURU_PIPER_*` and `AI_GURU_SARVAM_*` groups, `AIGURU_LIPSYNC_URL` and `AIGURU_TEACHER_VOICE_URL`.

## tsconfig.json (the type check)

- **Some app files are never type-checked.** `npm run build` checks only the folders in `include`. Several files the app runs are outside it: `proxy.ts`, `app/layout.tsx`, `components/DoubtCameraMic.tsx`, `lib/web-speech`, `lib/offline-ai`, `lib/student-key`, `lib/teacher-prompts-client`, `lib/audio/audio-duration`, `lib/document/types`. These have no type errors today.
- **The unused legacy folders don't type-check.** A full type check of every source file finds 1,242 errors, all in the legacy folders above (`components/scene-renderers` 270, `components/workbench` 231, `lib/server` 230, `components/edit` 115, …).
