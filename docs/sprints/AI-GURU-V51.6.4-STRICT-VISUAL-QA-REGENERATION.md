# AI Guru V51.6.4 — Strict Visual QA Regeneration

General Classroom visual QA is now a generation contract, not a fallback trigger.

- QA thresholds are unchanged, including `spatialNodes >= ceil(symbolic/3)`.
- Gemini gets up to 3 total generation passes.
- Passes 2 and 3 receive the exact previous QA failures and counts.
- Repair prompts require meaningful concrete/pictorial teaching visuals, not decorative nodes.
- Duplicate symbolic nodes should be reduced by reuse/transformation; narration stays in TTS/captions.
- Successful plans carry QA-attempt metadata so Teaching Pipeline Log shows PASS/FAIL for every pass.
- After 3 failures, General Class stops with an explicit error instead of silently switching to the old plain derivation fallback.
- Problems & Formulae remains separate and unchanged.
