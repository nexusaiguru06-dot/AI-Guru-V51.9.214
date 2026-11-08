# AI Guru V43 — Gemini BYOK for Material Studio

## Purpose
Material Studio uses the student's own Gemini API key for study-material creation, following the V35 browser-BYOK pattern without changing the V43 classroom UI.

## Flow
1. Open `/ai-guru/settings/gemini`.
2. Paste a Gemini API key and validate it against Gemini.
3. The key is stored only in browser localStorage and shown masked.
4. Material Studio requires a validated BYOK key before material creation is enabled.
5. `generateMaterial()` runs in the browser and calls Gemini directly for planning, authoring, visual specialist, assessment, final QA and repair/post-repair QA.
6. Only the completed, QA-passed material is posted to `/api/ai-guru/material-studio/materials` for persistence.
7. The API save endpoint never receives or stores the Gemini key.

## V43 preservation
- Main RAG Classroom UI is unchanged.
- Existing V43 visual runtime remains the material teaching renderer.
- Existing PDF indexing and textbook source registry remain intact.
- Material types and bilingual English + selected teaching-language contract remain intact.

## Error handling
Gemini HTTP errors include the provider's returned message when available. Invalid/missing keys block material creation with a direct link to the BYOK page.
