# AI Guru V51.9.10 — QA → Repair → Recompile → QA

## Runtime contract

A 3B1B teaching candidate must pass this gate before the browser receives a scene:

```text
Generate
  ↓
Compile + QA
  ↓ FAIL
Deterministic repair
  ↓
Recompile + QA
  ↓ FAIL
Fresh AI regeneration (if provider available)
  ↓
Recompile + QA
  ↓
PASS → classroom
FAIL → next repair pass
  ↓
After 3 repair passes → HTTP 422
```

A failed scene is never returned as `ok:true`.

## QA failures used for repair

- text/LaTeX overlap
- safe-frame violations
- geometry/graph integrity
- missing visual presence/motion
- beat-mix drift
- narrative contract
- Teacher-Reading coverage
- selected Video-DNA QA rules
- mandatory 3B1B board gate

## Browser acceptance test

Use Class 8 Page 7 (Pairs of Equations / beads). Force or reproduce the overlap QA failure. The server console should show:

`[AI Guru][3B1B][QA] FAIL -> REPAIR`

followed by:

`[AI Guru][3B1B][QA] ... repair-1-qa ...`

If AI regeneration is available, also:

`[AI Guru][3B1B][QA] fresh regeneration complete`

A successful response contains `regeneration.attempts`. A final failure returns HTTP 422 only after the three repair passes are exhausted.
