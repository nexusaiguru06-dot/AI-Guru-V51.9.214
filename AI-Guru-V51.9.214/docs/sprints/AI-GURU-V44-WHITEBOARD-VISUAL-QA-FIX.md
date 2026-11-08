# AI Guru V44 — Whiteboard Visual QA Fix

## Fixed
- Normalizes Gemini visual output into the canonical V43 VisualAction union before QA/runtime.
- Repairs common wrappers and aliases such as action/visual, text/content, formula/latex, x1/y1/x2/y2 and objectId.
- Generates deterministic unique visual IDs when Gemini omits them.
- Applies safe defaults for render-required numeric fields.
- Drops only unrecognizable visual objects instead of allowing malformed objects to reach the renderer.
- Re-applies normalization after material/source reconciliation.
- Ensures `section.visuals` is the single shared visual array used by `teachingPass.visuals` for English and the selected teaching language.
- QA now checks canonical visual types and duplicate visual IDs, rather than only checking whether `type` exists.

## Original V43 architecture preserved
BYOK, PDF worker, Materials Studio, source indexing, planner/content/assessment generation and final QA flow are unchanged apart from the visual-action normalization boundary.
