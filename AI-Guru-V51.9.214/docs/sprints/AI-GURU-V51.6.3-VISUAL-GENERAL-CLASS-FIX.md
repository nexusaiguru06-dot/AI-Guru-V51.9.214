# AI Guru V51.6.3 — Visual General Classroom Fix

- General Classroom planner is now required to build a concrete/pictorial model before symbolic algebra where appropriate.
- Plans dominated by PDF prose/text + LaTeX are rejected.
- Visual QA requires at least 3 spatial nodes and 2 spatial kinds (shape/line/arrow/graph/highlight/transform), with no long text nodes.
- If Gemini's first plan fails visual QA, one corrective re-plan is attempted with explicit visual requirements.
- Classroom playback independently enforces the same visual gate.
- Whiteboard text nodes longer than 60 characters are suppressed; full explanations remain in narration/TTS/captions.
- Problems & Formulae remains isolated from General Classroom.
