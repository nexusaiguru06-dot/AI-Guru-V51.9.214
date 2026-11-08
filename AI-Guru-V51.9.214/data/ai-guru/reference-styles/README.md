# AI Guru Reference Styles

The production application keeps the Video-DNA/style metadata here, but does not ship the large reference MP4/WebM binaries.

The binaries are optional visual-development assets. The 3B1B planner, Video-DNA selector, math verifier, browser renderer, TTS pipeline, and production lesson flow do not require the reference videos at runtime.

For local reference-video audits, restore the reference media under `public/reference-styles/`, or set `AI_GURU_REFERENCE_MEDIA_DIR` to an external directory containing the registered files.

The metadata intentionally retains the original reference paths so an external CDN/Hugging Face mirror can be introduced later without changing the visual grammar IDs.
