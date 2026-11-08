# AI Guru V43 — Material Studio implementation

## Non-negotiable boundaries

- The main V43 classroom layout and existing visual/math runtime remain unchanged.
- Material Studio is a separate route: `/ai-guru/material-studio`.
- The old `/api/ai-guru/materials` and old V43 `MaterialAgent` path were removed because Material Studio is now the single creation path.
- Existing V43 classroom teaching, QA, TTS, PDF reference and MathLikeAnimBoard remain the runtime of record.

## Upload contract

The user must answer all five questions before the PDF file input is enabled:

1. Subject
2. Class
3. Syllabus/board
4. PDF language
5. Teaching language

The browser extracts the PDF text with pdf.js in worker-free mode for reliable Next.js development/production bundling. The original PDF and the extracted page text are posted together to the server. This avoids the `Setting up fake worker failed` error caused by server-side bundling of `pdf.worker.mjs`.

## Book pipeline

`PDF -> page text -> stable paragraph source IDs -> whole-book chapter understanding -> saved document index`

Every source keeps page and paragraph identity and is assigned to a chapter. No material generation reparses the PDF.

## Material pipeline

`indexed textbook/chapter -> curriculum planner -> parallel content + visual + assessment specialists -> merge -> local QA -> strict model QA -> targeted repair -> post-repair QA -> save`

Materials are not saved when they fail the final QA gate.

## Two-pass teaching contract

For every teaching unit:

1. Show/read the exact source paragraph first.
2. Explain the concept in English.
3. Use the V43 visual runtime for the explanation.
4. Explain the same concept in the selected teaching language.
5. Reuse the exact same visual actions in the second language pass.

The generated material stores both language passes and one shared visual state.

## Classroom handoff

Saved materials are loaded by the existing V43 classroom through the Study Materials dock. Selecting a material does not invoke a new renderer. It uses `MathLikeAnimBoard` and the existing V43 TTS/runtime.
