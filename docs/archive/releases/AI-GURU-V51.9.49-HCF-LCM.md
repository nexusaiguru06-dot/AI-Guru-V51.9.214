# V51.9.49 — HCF and LCM by prime tiles

Why: HCF and LCM were a missing branch (the standing permission is to add missing DNAs). Prime factorisation is easiest to see as tiles that line up.
- **New DNA `hcf-lcm`** (`dna/hl-math.ts`, `dna/hl-builders.ts`): two numbers split into coloured prime tiles (12 = 2 × 2 × 3), tiles slide so shared primes sit in the same columns and are joined by green lines, the shared tiles are boxed (HCF = product), every column is boxed (LCM = product), and an optional check shows HCF × LCM = a × b. Typeset lines under the tiles; co-prime numbers give HCF 1 and no joining lines.
- **Plan** is just `a < b` (2–120) and a caption per fixed step (show, factorise, common, hcf, lcm, optional check); the app computes every factor, product and position and validates numbers, order, repeats and missing captions.
- **Selection**: HCF / LCM / GCD / "highest common factor" / "least common multiple" wording scores 0.93+; text about fractions or denominators is left to the fraction lessons. "Factorisation" no longer sends HCF text to the quadratic lesson.
- **Offline planner** takes the first two different numbers from the text (smaller first), else 12 and 18. Samples: 12/18, 36/48, 8/15 (co-prime), 6/12. Malayalam captions are drafts for a teacher to review.
- Tests: 16 new (prime factors for every n to 120, HCF/LCM from the tiles equal the true values for 300+ pairs, HCF × LCM = a × b, shared tiles in the same column in both rows, nothing overlaps or leaves the board at any step, three formats × light/dark, English = Malayalam pictures, validator, selector, offline planner). 706 motion-class tests pass.
- Seen by eye: frames of every step and day/night MP4s (12/18, 36/48, 8/15).
- Not run here: real voice, the Malayalam font, the app's own MP4 export, a real chapter run. Only two numbers are supported (not three), and numbers above 120 are rejected.

