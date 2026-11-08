# AI Guru V51.3.1 — Token-move / Video-template whiteboard fix

## Problem fixed
Classroom log showed:
```
Video-grounded planner unavailable: Invalid token-move action. · using verified fallback
```
Browser console: repeated `500` on `api/ai-guru/math/plan`.

Root cause: `lib/ai-guru/math/planner/validate.ts` rejected the entire Gemini plan
when any `visualActions[]` entry was an incomplete `token-move` (missing `id`,
empty `token`, or out-of-range coordinates). The classroom then fell back to the
verified-math renderer and the whiteboard never received the reference-video
visual beats (text-only board).

Additionally, node `kinds` did not include `'token-move'` even though
`MathVisualKind` and the Gemini prompt allow it, so a node with
`kind: "token-move"` also produced 500.

## Changes
1. **`lib/ai-guru/math/planner/validate.ts`** (rewrite)
   - `kinds` now includes `token-move` (schema parity with `MathVisualKind`).
   - Full domain list aligned with `MathDomain`.
   - Bad `token-move` actions are **repaired or dropped**, never throw.
   - Missing `id` / `token` recovered from `content`/`text`/`value` when possible.
   - Coordinates clamped to [-200, 1200].
   - Step `visualIds` that point at missing nodes are filtered, not rejected.
   - Unknown node kinds aliased (`equation`→`latex`, `token_move`→`token-move`, …).
   - Plan always returns at least one step when nodes exist.

2. **`lib/ai-guru/math/planner/gemini.ts`**
   - Prompt strengthened: every token-move must have non-empty `id`, `token`, and
     finite `fromX/fromY/toX/toY`.

3. **`lib/ai-guru/math/planner/validate.test.ts`**
   - New cases for token-move repair, kind aliases, missing refs, domain fallback.

## Install
Copy the files over your running app (paths relative to project root):

```bash
cp lib/ai-guru/math/planner/validate.ts       <your-app>/lib/ai-guru/math/planner/
cp lib/ai-guru/math/planner/validate.test.ts  <your-app>/lib/ai-guru/math/planner/
cp lib/ai-guru/math/planner/gemini.ts         <your-app>/lib/ai-guru/math/planner/
# route.ts is unchanged behaviour-wise; included for completeness
cp app/api/ai-guru/math/plan/route.ts         <your-app>/app/api/ai-guru/math/plan/
```

Restart the Next.js dev server (`npm run dev` / `pnpm dev`).

## Verify
1. Open RAG Classroom with the same PDF / material.
2. Press Play.
3. Teaching Pipeline Log should now show something like:
   - `Visual template selected: polynomial-roots.html` (or your template)
   - `Reference video watched ✓` **or** grounded plan received with spatial/math nodes
   - **No** `Invalid token-move action` / no 500 on `/api/ai-guru/math/plan`
4. Whiteboard mode may still be “Step-by-step derivation” for pure algebra, but
   video-grounded beats will play when the plan contains spatial or math nodes.
5. Optional: `npx vitest run lib/ai-guru/math/planner/validate.test.ts`

## Notes
- Requires a valid `GEMINI_API_KEY` (or BYOK key in the classroom).
- Keep `AI_GURU_MATH_RAG_WATCH_VIDEO=1` for real video grounding.
- If a plan still has zero spatial and zero math nodes, V51.3 safety still
  rejects it for the board and uses the verified renderer — that is intentional.
