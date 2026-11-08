# AI-Guru V51.7.1 — Agnes fallback + Gemini Get Key fix

## Fixes

1. Material Studio no longer gates material creation on Gemini alone.
   - If Gemini is unavailable but Agnes AI is active, study-material generation proceeds with Agnes.
   - If Agnes is unavailable, Sarvam is tried next.
   - Provider order remains Gemini → Agnes → Sarvam.

2. Material Studio now passes configured Agnes/Sarvam keys to the textbook-understanding step as well.
   - Chapter understanding uses Gemini first, then Agnes, then Sarvam.
   - If no AI provider can respond, the existing deterministic chapter heuristic remains the final fallback.

3. Whiteboard Notes therefore use the same fallback chain as every other Material Studio material.
   - The existing detailed General Class / Whiteboard Notes prompt remains unchanged.
   - Agnes does not invoke Manim and does not require physical reference-video watching.
   - The existing browser whiteboard renderer remains responsible for rendering the generated VisualAction objects.

4. Gemini BYOK now has `Get key` buttons again.
   - Opens the official Google AI Studio API-key page in a new tab.
   - Added to the Gemini section header and each empty key slot.

5. Material Studio status text now distinguishes Gemini from fallback availability instead of reporting that Gemini must be active when Agnes/Sarvam is ready.

## Validation

- TypeScript/TSX syntax transpilation check passed for all modified source files.
- AI-Guru integration audit passed.
- Full production Next.js build was not run because the environment did not contain a completed dependency installation.
