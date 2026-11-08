# AI Guru V45 Classroom Teaching Runtime Fix

Fixes the regression where the textbook reference moved correctly but saved Material Studio lessons produced no whiteboard animation and no audible narration.

## Root causes addressed
- MathLikeAnim board could receive `reveal()` before its WASM scene/core was ready; the old implementation silently returned, leaving a blank board.
- `hostRef.current.replaceChildren(scene.svg)` removed the renderer status element and made runtime readiness invisible.
- The main Play button could generate/teach a separate paragraph lesson instead of the already-created Material Studio material selected in the classroom.
- TTS playback failures were swallowed without exposing which provider failed.

## Runtime flow now
Material Studio material → exact source paragraph → reference page → wait for whiteboard readiness → draw source/visuals → Edge TTS → Google Cloud TTS → Sarvam → Piper.

Browser SpeechSynthesis remains disabled.
