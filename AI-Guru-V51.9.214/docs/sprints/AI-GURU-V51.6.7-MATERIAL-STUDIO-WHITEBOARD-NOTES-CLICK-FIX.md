# AI Guru V51.6.7 — Material Studio Whiteboard Notes click fix

## Defect
After a textbook was already indexed, Material Studio rendered all material-type buttons (including Whiteboard Notes) as disabled whenever the React BYOK state was false/stale. This made the feature look broken and prevented the click handler from explaining the actual requirement.

## Fix
- Material type buttons are enabled whenever an indexed textbook is loaded and Material Studio is not busy.
- Gemini BYOK is validated at click time by `byokGate()`.
- `byokGate()` re-reads the current key pool so returning from Settings does not leave stale disabled controls.
- If no valid BYOK key exists, clicking Whiteboard Notes now shows an actionable setup message instead of doing nothing.
- Empty-state copy now correctly says that Whole textbook is already selected by default and tells the user to click a material type.
- The same UX correction applies to MCQ, Q&A, Revision Notes, Worksheet, Problems & Formulae, and the other Material Studio generators.

This changes only Material Studio control gating; the V51.6.6 Malayalam caption, detailed-class, visual-DNA, and Problems & Formulae separation remain intact.
