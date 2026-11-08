# AI Guru Universal Math Curriculum Evaluation Harness

This harness is the regression/evaluation layer for Universal Math Video-Style Teaching for Classes 1–12.

## Coverage

It includes representative Kerala/CBSE cases across Grades 1–12 and the major Universal Math domains currently defined by AI Guru.

## What it checks

- domain classification
- compilation success
- grade-band correctness
- mathematical verification status
- minimum visual/event coverage
- unique visual IDs
- coordinate integrity
- event target integrity
- expected visual strategy for the case

## Run

```bash
npm run eval:curriculum
```

Reports are written to:

- `eval/curriculum-universal-math/results/report.json`
- `eval/curriculum-universal-math/results/report.md`

The harness intentionally does **not** equate domain classification with production readiness. A domain can compile while still failing its expected visual strategy; those gaps are reported so the visual compiler can be improved without weakening the regression suite.
