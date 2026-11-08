# AI Guru V51.9.136 — Detailed solving steps, two captions, step-wait control

Built on V51.9.135 (style library), which was built on V51.9.126-CINEMATIC.

## 1. Every step shown and explained (pair of linear equations)
Before this release, one "eliminate" step wrote the multiplied equations, the sum and the answer together under one caption.
Now each piece of algebra gets its own **working page**:
- The two given equations glide to the top in a frame.
- The graph fades and comes back when the lesson returns to it, with x and y written in its panel.

Example: 3x + 2y = 12, 2x − y = 1 (the sample lesson) now has 22 captioned steps instead of 8.

| Step | Board line | Right note (what) | Bottom caption, spoken (why / how) |
|---|---|---|---|
| aim | rings 2y and −y | remove y | First we make one unknown disappear… Look at the y terms… |
| multiply | 2 × 2x − 2 × y = 2 × 1 | multiply (2) by 2 | 2 is the smallest number both 2 and 1 divide (LCM)… every term, on both sides… keeps the equation true |
| simplify | → 4x − 2y = 2 | 2 × each term | 2 × 2x = 4x, 2 × (−y) = −2y, 2 × 1 = 2 |
| add | 3x + 4x + 2y − 2y = 12 + 2 | add (1) and (2) | same size, opposite signs… 2y + (−2y) = 0… equal added to equal |
| cancel | 7x = 14 (2y terms struck out) | y cancels | collect x terms 3x + 4x = 7x; numbers 12 + 2 = 14 |
| divide | x = 14 ÷ 7 | ÷ 7 both sides | 7x means 7 times x… do the opposite… divide both sides |
| answer | x = 2 | 14 ÷ 7 = 2 | |
| substitute | 2x − y = 1 → 2(2) − y = 1 → 4 − y = 1 → −y = 1 − 4 → −y = −3 → y = −3 ÷ (−1) → y = 3 | take (2) / put x = 2 / 2 × 2 = 4 / − 4 both sides / … | why each move keeps both sides equal |
| check | 3(2) + 2(3) = 6 + 6 = 12 ✓ | left side = right side | |

- **Subtraction** cases explain the sign change.
- **Negative numbers** get "a minus times a minus gives a plus".
- When the coefficient is already 1, the redundant divide step is skipped.

Files: `lib/ai-guru/motion-class/dna/lin-steps.ts` (new, pure: every line and sentence) and `lin-builders.ts` (working page, notes column, strike-outs, page changes).

## 2. Two captions
- `Caption.note`: the short "what to do" text.
- `Caption.boardNote`: the board already wrote that note beside the line.
- `Motion.step(text, t, min, say, { note, boardNote })`.
- On the problem board, the step notes (V51.9.110) now show the short note, or nothing when the board already wrote it, instead of repeating the long caption.

## 3. Speed controller: "Next step after" (1–10 s)
- **Classroom whiteboard** (`MotionTeachingBoard`, next to Speed) and **Motion Classroom**:
  - Applied by the player at once on the class already prepared. Nothing is planned or voiced again.
  - After each step, the board and caption stay for the chosen seconds with a "Next step in N s" countdown, then the next step starts by itself.
  - Play skips the wait; Pause stops it.
  - Default is 2 s, remembered on the device (`aiGuruStepGapSec`).
- **Reel Studio** (Style & voice → Next step after):
  - The wait is built into the reel timeline, so the downloaded MP4 has it too. Checked: a 20.9 s reel became 38.9 s with 3 s.
  - Default is "no wait", remembered on the device (`aiGuruReelStepGapSec`).
- **Engine:** `withStepPause(ms, fn)` and `buildReel(req, { stepPauseMs })`, 0–10 s. The wait is never added before the first step.

## Checked
- `vitest run lib/ai-guru`: 1416 passed. The 19 failures are the same ones that already failed in V51.9.126; none are new.
  - New `lin-steps.test.ts` (9 tests): over 300 systems, elimination and substitution reach the right value; every step has an English + Malayalam why and a short note; check lines are true arithmetic; no text overlaps or leaves the board; captions are never cut short; voice clips are respected; the step pause adds exactly the chosen time.
  - `linear-system.test.ts` was rewritten for the new pages (12 tests).
- `tsc`: no new errors (the same 71 old ones in old test files).
- ESLint clean on the changed library files.
- Rendered frames checked by eye.
- Reel Studio checked in a browser.

## Not yet done
- Only the **pair of linear equations** board was rebuilt in this much detail.
  - The single-equation balance boards already had note + principle captions since V51.9.125.
  - Quadratic, polynomial and the other boards still use one caption per step. The new `note` field and the speed controller already work for them, but their steps are not split further yet.
- The classroom's step-wait is a playback control, so a class section downloaded as MP4 from the classroom does not include it (the Reel Studio MP4 does).
- The NCERT **cross-multiplication method** (x/(b₁c₂ − b₂c₁) = …) is not added. "Multiply each equation by the other's coefficient" (elimination) is fully shown.
- The Malayalam sentences are my drafts: please have a teacher read them.
