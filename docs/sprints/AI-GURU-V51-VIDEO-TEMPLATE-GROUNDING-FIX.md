# AI Guru V51 — Video Template Grounding Fix

This corrected V51 package repairs the reference-video teaching pipeline.

## Fixed
- Reference-video grounding is enabled by default; set `AI_GURU_MATH_RAG_WATCH_VIDEO=0` only to opt out.
- `.env.example.ai-guru` now explicitly enables video grounding and documents the inline upload threshold.
- The two incomplete reference registry records now contain verified media metadata plus `selectionTerms` and `teachingMethods`.
- Gemini receives an explicit ATTACHED/NOT ATTACHED state so it cannot legitimately confuse template selection with actual video inspection.
- If no video is attached, any model claim of `watched=true` is forcibly reset to false.
- If a video is attached, the planner requires temporal grounding evidence (`tStartMs`, `tEndMs`, visual beat, adaptation) before accepting the generated visual plan.

## Audits
- Reference video library: PASS — 20 assets.
- Visual template library: PASS — 18 templates.
- Math RAG audit: PASS — 5,791 3b1b video entries, 401 Manim entries, 28 golden-set files, Gemini video grounding supported.

## Deployment
Provide a valid `GEMINI_API_KEY`. Keep `AI_GURU_MATH_RAG_WATCH_VIDEO=1` for the intended Video Template → Gemini inspection → temporal beat extraction → lesson-specific visual-plan flow.
