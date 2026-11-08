# AI Guru V51.3 — Teaching Pipeline Log & Playback Status

## Added
- Persistent classroom status: CLASS PLAYING / PAUSED / STOPPED / ERROR.
- Current pipeline stage in the whiteboard header.
- Show Log / Hide Log panel inside RAG Classroom.
- Timestamped tracing for strategy selection, video grounding, grounded-plan node counts, each video beat, renderer action, verified math steps, TTS, completion and errors.
- Copy, Download and Clear controls for the diagnostic log.
- 250-event in-memory diagnostic history.

## Safety/fallback for the reported "some text only" symptom
A video-grounded board plan that contains no spatial visual nodes and no math/LaTeX nodes is rejected for board playback. AI Guru logs the rejection and falls back to the verified math renderer rather than displaying a few positioned prose strings as the lesson.

## Diagnostic intent
The log makes the full chain observable in the UI on desktop and mobile:
PDF/current source → strategy/RAG → selected reference video → Gemini grounding evidence → generated beats/nodes → renderer actions → TTS → completion/error.
