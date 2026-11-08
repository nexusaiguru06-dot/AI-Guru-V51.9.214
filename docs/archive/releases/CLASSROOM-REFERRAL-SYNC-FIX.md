# AI Guru Classroom + Material Studio Navigation / Reference Sync Fix

## Changes
- Added the global AI Guru navigation bar to Material Studio so it is no longer a dead-end page.
- Kept Material Studio's Gemini BYOK and PDF controls available in the navigation bar.
- Changed classroom material playback from page-only reference matching to paragraph-aware source matching.
- A material section now resolves its indexed source by source id, page-local paragraph number, and exact source text fallback.
- When a new material paragraph starts, the textbook reference panel moves to the exact source paragraph/page before source narration begins.
- Added Study Progress (unit/total) to the textbook reference panel.
- When teaching crosses to another textbook page, the reference image and lesson cursor follow the new paragraph.
- Existing RAG, Math, whiteboard, TTS, BYOK, material generation and QA paths are preserved.
