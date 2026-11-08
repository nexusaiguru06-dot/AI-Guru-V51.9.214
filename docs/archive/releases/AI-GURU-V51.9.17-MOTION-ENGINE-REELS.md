# AI Guru V51.9.17: Motion Graphics Engine + Reel Studio

No new npm packages (uses `mp4-muxer` from V51.9.16). Run `npm install` if you have not since V51.9.16.

## What changed
| Area | File | Change |
|---|---|---|
| Motion engine | `lib/ai-guru/reels/motion/engine.ts`, `grammar.ts`, `draw.ts`, `metrics.ts`, `sfx.ts` (new) | Time-pure tracks for position, colour, scale, halo, pen progress, text swaps and camera. Grammar verbs: appear, write, focus, recolor, move, hop, swap, merge, strike, dim, box, tick, look. Reel frame with title pill, @handle, step caption (EN/ML). Procedural sound. |
| Arithmetic | `recipes/addition.ts`, `subtraction.ts`, `multiplication.ts`, `division.ts`, `column.ts` | Carries hop, borrows hop through zeros, long multiplication with partial rows, long division with bring-down arrows and camera follow. Self-checking. |
| All branches | `recipes/derivation.ts`, `branches.ts`, `verify.ts` | Line-to-line morphing (move / swap / merge / split / cancel) with auto token matching; 12 verified branch examples; safe maths checker. |
| Chapter intros | `recipes/intro.ts`, `chapters.ts` | "What is this chapter?" reels + worked example. Pair of Linear Equations, Quadratic Equations, Pythagoras, Fractions, in English and Malayalam. |
| Reels | `reel.ts`, `export.ts`, `fonts.ts`, `index.ts` | `buildReel(request)`, multi-part reels, browser MP4 export (WebCodecs), Noto Serif + Noto Sans Malayalam fonts in `public/fonts/reel/`. |
| Shared probe | `video-export/mp4-probe.ts` (new) | WebCodecs probe split out of `mp4-export.ts` (re-exported, no API change) so the reel page does not load the manim-web renderer. |
| UI | `components/ai-guru/MotionReelStudio.tsx`, `app/ai-guru/reels/page.tsx`, nav | **Reel Studio**: type a sum, pick a topic example or chapter intro; language EN/മലയാളം; 9:16 / 1:1 / 16:9; play/scrub preview; ⬇ Download MP4; 📱 Share + ready caption with hashtags. |
| Docs | `docs/MOTION-GRAPHICS-ENGINE.md` | Full motion grammar per operation and branch. |

## Verified
- `motion.test.ts`: 25 tests pass (240 random arithmetic reels, every branch line proven true, wrong line rejected, determinism, caption coverage, all reels < 60 s, chapter intros in both languages).
- Real Chromium: reels exported to MP4 by the browser code path (VP9 + Opus in headless Chromium; Chrome/Edge on desktop and Android pick H.264). Files decode cleanly.
- TypeScript: new files are clean under TS 5.9 strict.

## Limits
- Malayalam captions are machine-written. Ask a Malayalam maths teacher to proof-read them, especially the chapter titles (`recipes/chapters.ts`, `recipes/branches.ts`, `captions.ts`).
- Arithmetic limits keep reels under about 60 s: + up to 4 numbers × 6 digits, × up to 4 × 3 digits, ÷ up to 6 ÷ 2 digits.
- The LLM planner is not yet wired to emit `DerivationInput` for arbitrary problems. The format, link conventions and checker are ready for it (see docs §6).
- Reels have sound effects and music but no voice-over yet.
