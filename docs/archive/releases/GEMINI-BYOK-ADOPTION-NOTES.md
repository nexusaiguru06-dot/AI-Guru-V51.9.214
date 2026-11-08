# Gemini BYOK adoption into V43

## What the V43 zip already had

The uploaded V43 build already contained `lib/student-key.ts` copied **byte-for-byte
identical** to the v35 build — the full 5-slot key pool with automatic rotation,
daily-quota benching, cooldowns and `callGeminiClient`. It also already had a Material
Studio page, an indexing route and a generation pipeline.

What it did **not** have was any of that pool actually being used:

- the settings page exposed exactly **one** key (`studentKey.save` / `getSaved`)
- `pipeline.ts` bypassed the pool entirely with its own single-key `fetch()`
- the server-side chapter planner depended on a server `GEMINI_API_KEY`
- materials could only be created one at a time

So this change wires the v35 BYOK system through, rather than copying files that
were already there.

## Files changed (5) and added (1)

| File | Change |
| --- | --- |
| `components/ai-guru/GeminiKeySetup.tsx` | **new** — 5-slot key-pool manager, styled in the existing V43 dark theme |
| `app/ai-guru/settings/gemini/page.tsx` | now renders the pool manager instead of the single-key form; same route, so every existing link still works |
| `lib/ai-guru/material-studio/pipeline.ts` | `callGemini()` now goes through `callGeminiClient()` → key rotation; model pinned to `GEMINI_TEXT_MODEL` so it matches what keys are validated against |
| `lib/ai-guru/material-studio/book-understanding.ts` | model default matches the BYOK model; still honours a server `GEMINI_API_KEY` if one is configured |
| `app/api/ai-guru/material-studio/index/route.ts` | accepts a `geminiKey` form field and forwards it to `understandBook()` |
| `app/ai-guru/material-studio/page.tsx` | forwards the BYOK key when indexing; BYOK gate checks the pool; added "Create all 10 study materials" with per-material status |

Nothing else in the app was touched — the classroom, math studio, whiteboard, agents,
TTS and every other route are unchanged.

## Behaviour

- Paste up to 5 keys at **Settings → Gemini BYOK** (`/ai-guru/settings/gemini`). Each is
  validated against Google before being marked Active.
- A key that returns a daily-quota error is benched until the next day; a rate-limited key
  gets a 60s cooldown; an invalid key is marked invalid. Generation continues on the next key.
- Batch generation runs with `min(3, usable key count)` lanes — one key stays sequential so it
  does not rate-limit itself; more keys genuinely run faster.
- Per-material buttons show pending / running / done / failed. A failed material keeps its
  real error message (hover) and can be retried by tapping it.
- The QA gate is unchanged: a material is still only saved when `qa.status === 'passed'`.

## Not verified

`node_modules` were not available here, so this was checked with esbuild parse/transform
only — not a full `tsc --noEmit` or a live browser run. Worth running `npm run build` once
before deploying.
