# AI Guru V45 — Math Teaching Integration Plan

## Objective
Integrate structured mathematical solving with the existing AI Guru referral-video library and MathLikeAnim/Konva/video presentation without replacing the existing Visual Steps QA or classroom pipeline.

## 1. Teaching Strategy Selector
Choose one strategy per teaching request/section:
- `referral_video`: approved concept-matched referral is the primary concept aid.
- `step_by_step`: actual problem is solved through verified mathematical transformations.
- `specialized_visual`: graph/geometry/statistics-style visual engine is primary.
- `hybrid`: approved referral concept aid followed by verified solution of the actual problem.

Selection uses domain, grade, problem-vs-concept intent, and the registered referral-video metadata.

## 2. Mathematical Solver Layer
- Preserve Math.js as the existing verification foundation.
- Use the installed MathSteps package for structured algebra/equation transformations.
- Normalize solver output into `UniversalMathStep` so renderers do not need to understand mathematical logic.
- Add an optional SymPy HTTP adapter through `SYMPY_VERIFIER_URL`; it is used only when configured and does not become a browser dependency.

## 3. Universal Math Step IR
Every verified step has stable identity and contains:
- before / after
- operation
- purpose
- solver source
- verification state
- optional explanation, source page/source IDs, visual actions and audio cue ID

## 4. Visual Planning
The Gemini visual planner receives the selected teaching strategy and must obey it. Referral videos remain style/concept aids; their exact mathematics, wording and artwork are not copied.

## 5. Existing Presentation Layer
Keep and reuse:
- MathLikeAnim-rs
- Konva/whiteboard actions
- graph/geometry visual engines
- existing referral-video library
- existing textbook reference/page synchronization
- existing bilingual teaching flow
- existing Edge/Google/Piper/Sarvam TTS pipeline

## 6. QA Gates
Add:
- Teaching Strategy QA
- Math Steps QA

Continue to run the existing:
- Content QA
- Lesson QA
- Visual Steps QA
- Classroom QA
- rendered visual/video QA where available

A selected referral must have a valid matching registered asset. Solver/hybrid strategies must have verified mathematical steps or verified expressions. Every step must have before/after state, operation, source and `verified=true`.

## 7. Classroom UX
The classroom shows the selected strategy and, when available, the matched referral video. The video is available as an explicit classroom teaching aid; the actual mathematical problem remains independently solved and verified.

## 8. Failure / Recovery
No QA gate is silently bypassed. Strategy mismatch, missing referral, missing steps or unverified steps are reported as recoverable failures with an appropriate regeneration/reselection action.
