# AI Guru V51.9.20 — Interactive Motion Class

**Ask:** "Is it possible interactive class like pause, restart, slow teaching (speed control)? Use the attached manim-web rendering app. Keep the MP4 also."

**Done:** Motion Class plays live on manim-web's player controls; MP4 export is unchanged.

## Files
- NEW `lib/ai-guru/motion-class/interactive-player.ts`: `buildClassTimeline`, `ClassPlayer` (manim-web `PlayerUI` + `PlayerController`).
- `lib/ai-guru/reels/motion/audio.ts`: `encodeWav()`; the mixer resamples voice clips to the mix rate.
- `components/ai-guru/MotionClassroom.tsx`: whole section prepared once, then played interactively; speed chips, pause after each step, replay step, restart part/class, other-language switch, transcript, Save MP4 + subtitles.
- Test: `motion-class.test.ts` checks timeline marks (56 tests pass).

## Controls
Space/K play-pause · ←/→ or ⏮/⏭ previous/next step · Shift+←/→ seek 1 s · Home/End · S pause after each step · R replay step · [ ] speed · F full screen. Speeds 0.25×–2×, voice pitch preserved.

## Notes
- manim-web's bar and keyboard controller both handle a click on the player; the class player ignores the duplicate toggle.
- The bar is placed below the board (not over it), so the caption box is never covered.
- Details: docs/MOTION-CLASS-DNA.md §7.
