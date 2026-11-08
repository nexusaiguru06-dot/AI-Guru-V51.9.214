# AI Guru Motion Graphics Engine (V51.9.18)

Every maths reel in AI Guru (column sums, long division, algebra, fractions, geometry, calculus and the rest) is animated by **one engine with one motion grammar**. A long-division reel and a Pythagoras reel use the same colours, timings and moves, so every branch of maths gets the same video quality.

Code: `lib/ai-guru/reels/motion/` · UI: **Reel Studio** (`/ai-guru/reels`) · Tests: `motion.test.ts`

---

## 1. The grammar

### Colours carry meaning (never decoration)

| Role | Colour | Used for |
|---|---|---|
| `a` | red `#d22d2d` | first operand / what we start from |
| `b` | purple `#9d3bc8` | second operand / what acts on it |
| `c` | green `#13a018` | third operand, constants moved across, new numbers |
| `carry` | orange `#f08a00` | carries, borrows, remainders, helper digits |
| `result` | indigo `#150b55` | the value a step produces |
| `done` | lavender `#b4b1d1` | finished work, kept on the board but pushed back |
| `accent` | red `#c0262d` | answer box, strikes, headings |
| halo | yellow `#ffe76a` | focus glow |

### Verbs (each is a fixed, timed motion)

| Verb | What the viewer sees | ms |
|---|---|---|
| appear | pops in (scale 0.4 → 1 with a small overshoot) + pop sound | 350 |
| write | pen reveal left → right + scribble sound | 450 |
| **focus** | yellow halo + pulse 1 → 1.15 → 1 + tick | 500 |
| **recolor** | smooth colour change into a role colour | 350 |
| **move** | glides along an arc to a new place + swoosh | 650 |
| **hop** | small high jump (carry / borrow) + two-note bounce | 550 |
| **swap** (digit transformation) | old value rolls up and out, new value rolls up and in | 420 |
| **merge** | pieces fly together, shrink, vanish; the result pops out | 700 |
| strike | red pen line through a value that changes | 300 |
| dim | finished work fades to `done` | 400 |
| box / tick | pen-drawn answer box, green tick + ding | 600 / 450 |
| look (camera) | board pans or zooms to follow the working | 700 |

### Rules of focus

1. Only what is being worked on is coloured. Everything finished is `done`.
2. Before anything changes, it is **focused** first, so the eye gets there before the motion.
3. Values never jump: they **move**, **merge** or **swap**. The viewer always sees where a number came from and what it turned into.
4. One caption per step, with the step number in the pill, synced to the motion.
5. The answer always ends with box + tick + ding.

---

## 2. The four operations

### Addition: column method with carries
| | |
|---|---|
| Focus | the digits of one column and the carry above it glow and pulse |
| Colour | operand 1 red, operand 2 purple, operand 3 green; carry orange; sum indigo; finished columns fade |
| Digit movement | chalk copies of the column digits fly down to the answer row |
| Digit transformation | the copies **merge** into the column sum (8 + 6 → 14); the tens digit **hops** up into the next column's carry row and shrinks |

### Subtraction: borrowing
| | |
|---|---|
| Focus | top and bottom digit of the column; then the neighbour we borrow from |
| Colour | top red, bottom purple, borrowed values orange, answer indigo |
| Digit movement | a small orange **1 hops** from the neighbour to the needy column; copies fly down to the answer |
| Digit transformation | the neighbour is **struck** and its new value (one less, or **9** for a passing zero) pops above it; the needy digit and the hopping 1 **merge** into its new value (3 → 13) |
| Edge cases | borrowing across zeros (503 − 278), negative answers (52 − 87 = −35), no leading zeros (700 − 700 = 0) |

### Multiplication: long multiplication
| | |
|---|---|
| Focus | the multiplier digit in use stays lit for its whole pass; each multiplicand digit lights up with it, plus the waiting carry |
| Colour | multiplicand red, multiplier purple, carries orange, products indigo, placeholder zeros grey |
| Digit movement | copies of both digits and the carry fly into the product slot; the tens of the product hops into the carry row |
| Digit transformation | 7 × 6 **merge** into 42; the carry is swallowed by the next product; partial rows are then added by the addition routine (same motion as addition reels) |

### Division: long division
| | |
|---|---|
| Focus | the part of the dividend being divided and the divisor glow together; the camera follows the working downwards |
| Colour | dividend red, divisor purple, quotient indigo, products green, remainders orange |
| Digit movement | quotient digit × divisor copies fly down and merge into the product; the next digit is **brought down** along an orange arrow |
| Digit transformation | number and product **merge** into the remainder, which then grows with the brought-down digit; 0 in the quotient when the divisor doesn't go |

---

## 3. All other branches: the derivation recipe

Anything written as a chain of lines uses `buildDerivation`. Each new line is built **from** earlier lines:

| Change between lines | Motion |
|---|---|
| same token | flies to its new place, keeps its colour |
| changed token (+ → −, 20/2 → 10, π → 22/7) | flies, then **swaps** into the new value and turns indigo |
| several → one (25 − 5 → 20) | pieces fly together and **merge** |
| one → several (5x → 2x + 3x, power rule's 3 comes down) | the piece **splits**; a copy flies to each place |
| new token | pops in after the moves (green numbers, ink symbols) |
| cancelled token (+y and −y) | **struck** in red on the old line |
| older lines | fade to `done` and stay as the written record; the camera keeps source lines in view and pulls back at the end |

Links are found automatically (longest common subsequence of tokens). Explicit `links` (`[from, to]` or `[line, from, to]`) express merges, splits and changes.

Token format: `"{a/b}"` fraction, `"x^2"` / `"2^{3+4}"` powers, `"√25"`, `"20%"`, `"sin 30°"`, `"π"`.

### Branch catalogue (all verified line by line)

| Branch | Example | Key motions |
|---|---|---|
| Linear equations | 2x + 5 = 25 | +5 swaps to −5 as it crosses; 25 − 5 merges to 20; 2 and 20 merge into 20/2 |
| Pair of linear equations | x + y = 10, x − y = 2 | +y / −y struck; x's merge to 2x; x = 6 flies into the first equation |
| Fractions | 1/2 + 1/3 | fractions swap to 3/6, 2/6; merge into (3+2)/6 → 5/6 |
| Percentage | 20% of 150 | "of" swaps to ×; 20/100 → 1/5; merge into 150/5 → 30 |
| Exponents | 2³ × 2⁴ | powers merge to 2^(3+4) → 2⁷ → 128 |
| Quadratics | x² + 5x + 6 = 0 | 5 splits into 2 and 3; brackets pop; roots −2, −3 |
| Calculus | d/dx x³ | power splits: 3 comes down, exponent becomes 3−1 → 2 |
| Pythagoras | a = 3, b = 4 | substitution swaps; 9 + 16 merge to 25; √ |
| Mensuration | area of circle r = 7 | π swaps to 22/7; 7 cancels; 22 × 7 merges to 154 |
| Statistics | mean of 4, 8, 6, 10 | sum merges, 28/4 → 7 |
| Probability | P(even) | 3/6 → 1/2 |
| Trigonometry | sin 30° + cos 60° | table values swap in; merge to 1 |

### Chapter intros
`buildIntro` writes the chapter heading with a pen underline, then one key idea per step; `*key terms*` take role colours and get focused. A worked example follows (`buildReel({ kind: 'intro', … })`). Built in: Pair of Linear Equations, Quadratic Equations, Pythagoras Theorem, Adding Fractions (English + Malayalam).

---

## 4. Voice-over and captions (English / Malayalam)

Every step can be explained aloud, in the language of the reel.

| | How it works |
|---|---|
| Script | Each caption has a spoken version (`speech.ts`): maths is read as words. English: "25 minus 5 equals 20", "x squared", "1 over 2". Malayalam (Kerala classroom style): "25 മൈനസ് 5 സമം 20", "എക്സ് സ്ക്വയർ", "1 ബൈ 2", "എക്സിനെ". One table per language, so a teacher can tune it. Derivation lines can override with `say`. |
| Voices | The classroom's own TTS chain via `/api/ai-guru/tts`, in the same order with the same voice settings as the live class: Edge (`en-IN-NeerjaNeural`, `ml-IN-SobhanaNeural`/`MidhunNeural`), then local Piper, Google Cloud, Sarvam. Clips are trimmed, normalised and cached. |
| Timing | Two passes. Build once to get the script, synthesise, then rebuild with each clip's length (`buildReel(req, { voiceMs })`). A step never starts before the previous clip ends, and its caption stays up for the whole clip, so the voice is never cut off and the motion follows the explanation. |
| Captions | Words light up as they are spoken (karaoke: spoken dark, current word red, the rest pale), with a small speaking indicator. Optional second line in the other language (`subtitleFrom`). |
| Sound | Music bed and effects duck under the voice (music to 30 %, effects to 45 %, 150 ms ramps). |
| Files | `.srt` / `.vtt` subtitle download (both lines when the second line is on), timed to the voice. |
| Fallback | If no provider answers, the reel is still made with music and captions only, and Reel Studio says why. |

## 5. Safety: no wrong maths in a published video

* Arithmetic recipes re-compute every partial row, sum, difference and quotient while animating, and throw if the screen would show a wrong number.
* `verifyDerivation` evaluates every derivation line (safe parser, no `eval`) against the solution values; `buildReel` refuses to build a reel with a false line.
* `motion.test.ts`: 30 tests, including 240 random sums, proof of every branch line, a deliberately broken line that must be rejected, determinism, and caption coverage.

## 6. Output
* Formats: Reel/Short 1080×1920, Square 1080×1080, YouTube 1280×720.
* Preview and MP4 use the same draw function and clock (pure function of time), so they are frame-identical.
* MP4 export in the browser (`export.ts`): WebCodecs + mp4-muxer, H.264 or VP9 video, AAC or Opus audio. Procedural sound effects plus a soft music bed, no audio files.
* Fonts: Noto Serif + Noto Sans Malayalam (OFL) in `public/fonts/reel/`.

## 7. Adding a new topic
1. Write the lines as tokens (as in `recipes/branches.ts`).
2. Add `links` where pieces merge, split or change.
3. Add `solutions` so the checker can prove every line.
4. `buildReel({ kind: 'derivation', input, solutions })`.

The planner/LLM can emit the same `DerivationInput` JSON for any problem; the checker blocks it if any line is false.
