# AI Guru V51.9.4 — Visual Template/DNA + QA Wiring Audit

## Root defect found in V51.9.1
The 3B1B Teacher-Reading route could successfully generate narration/read/translate/explain beats while returning only `pause` animation actions. The classroom therefore looked as if Video-DNA planning was active, but the whiteboard remained empty.

## Fixes
1. Added a hard `visual-presence` QA check: at least 2 executable visual beats, at least 1 created object, and at least 1 teaching-motion action.
2. Added deterministic visual recovery from textbook equations and common NCERT/SCERT word-problem patterns (linear equations, simultaneous table/chair, beads).
3. Recovery preserves the selected Chapter → Lesson → Beat Video-DNA IDs and attaches the selected DNA to recovered beats.
4. General 3B1B teaching now performs up to 3 generation/repair passes. It returns HTTP 422 instead of `ok:true` if visual QA still fails.
5. Material Studio QA is fail-closed: no `needs_review` material is deployable; up to 3 repair passes are attempted.
6. Repaired Material Studio visuals are passed through the Visual Developer again before the final QA gate.

## Expected Page-7 behavior
For equations such as `x + (x - 10) = 100`, the board must visibly construct:
- starting equation
- equivalent transformation(s)
- variable isolation
- final value
- answer check

For the table/chair paragraph, the deterministic recovery can construct:
`t + c = 11000`
`t + 4c = 14000`
then eliminate/substitute to reach `c = 1000`, `t = 10000`, followed by a check.

## Fail-closed behavior
A narration-only lesson is no longer accepted as a successful classroom lesson. If AI regeneration cannot produce valid visuals after 3 passes and deterministic recovery cannot help, the API returns an error rather than displaying an empty board.

## Validation performed in this environment
- TypeScript transpilation check: modified TS/TSX files = 0 syntax diagnostics.
- Static wiring review: Teacher Reading → `/api/ai-guru/math/teaching` → Video-DNA selector → planner → deterministic recovery → QA → compiler → runtime snapshot.
- Material Studio wiring review: content + visual + assessment → normalization → Visual Developer → local QA → final model QA → up to 3 repairs → final pass/fail.

## Remaining deployment validation
Run after `npm ci` on the deployment machine:
- `npm run build`
- `npm test`
- browser/E2E classroom test
- deliberately force one QA failure and verify a replacement visual lesson is generated
