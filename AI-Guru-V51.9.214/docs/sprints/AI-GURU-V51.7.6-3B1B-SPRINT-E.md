# AI Guru V51.7.6 — 3B1B Sprint E

## Audio-clock / cue synchronization

Sprint E keeps the Sprint D browser renderer and existing classroom TTS architecture, but adds a measured-audio synchronization layer.

- TTS provider responses now expose measured `durationMs` when the returned WAV/MP3 can be parsed.
- The TTS route returns word timings. Provider timestamps are preferred; otherwise word positions are estimated from the measured audio duration and explicitly marked `measured-audio`.
- `ThreeB1BTeachingBoard` prepares narration clips per teaching beat, plays the real audio, and maps the browser visual timeline to `HTMLAudioElement.currentTime`.
- `TeachingBeat.cueWords` are matched against returned word timings and surfaced through the existing `onCue` classroom caption path.
- English and Malayalam use the existing provider order (Malayalam Piper → Edge → Google Cloud → Sarvam; English Edge → Piper → Google Cloud → Sarvam).
- Manual visual playback remains available if voice preparation fails.
- No Manim runtime is introduced. Existing RAG, Gemini planner, Video-DNA, persistent-object animation, and math verification remain unchanged.

## Important timing distinction

The audio clip duration is measured from the actual returned audio bytes. If a provider does not supply acoustic word boundaries, Sprint E estimates individual word positions over that measured duration; it does not claim those positions are phoneme/acoustic boundaries.
