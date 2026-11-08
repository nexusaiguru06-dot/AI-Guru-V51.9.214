# AI Guru documentation

Start with the project [README](../README.md). This page lists every document and whether it describes the app as it is now.

## Current — kept up to date

| Topic | Document |
|---|---|
| What AI Guru is, how it works, how to run it | [`README.md`](../README.md) |
| Release history (newest first) | [`CHANGELOG.md`](../CHANGELOG.md) |
| Voices and their order | [`TTS-SETUP.md`](../TTS-SETUP.md) |
| Maths engine and branches | [`UNIVERSAL-MATH-ENGINE.md`](../UNIVERSAL-MATH-ENGINE.md) |
| Whiteboard templates (motion "DNA") | [`MOTION-CLASS-DNA.md`](MOTION-CLASS-DNA.md) |
| Motion engine (classroom board, reels, MP4) | [`MOTION-GRAPHICS-ENGINE.md`](MOTION-GRAPHICS-ENGINE.md) |
| Deploying on Google Cloud Run + PostgreSQL | [`DEPLOY-GOOGLE-CLOUD.md`](DEPLOY-GOOGLE-CLOUD.md) |
| Deploying on Netlify + Neon (free plan) | [`DEPLOY-NETLIFY.md`](DEPLOY-NETLIFY.md) |
| Latest design review (EGM) and what was fixed | [`reviews/2026-11-02-egm/`](reviews/2026-11-02-egm/) |
| Third-party licences | [`licenses/`](licenses/), [`../NOTICE-motion-core.md`](../NOTICE-motion-core.md), [`../third-party-licenses/`](../third-party-licenses/) |

## Topic notes — correct when written, check against the code

| Topic | Document |
|---|---|
| Scanned-page OCR (OpenDataLoader) | [`ODL-OCR-INTEGRATION.md`](ODL-OCR-INTEGRATION.md) |
| Reference-video analyser | [`REFERENCE-ANALYZER.md`](REFERENCE-ANALYZER.md) |
| Teacher reading mode | [`TEACHER-READING-MODE.md`](TEACHER-READING-MODE.md) |

## History — how the app was at one release

These describe the app as it was at that release. Later releases may have changed or removed what they describe;
`CHANGELOG.md` is the running record.

- [`archive/releases/`](archive/releases/) — one note per release or fix (`AI-GURU-V51.9.*`, `PREDEPLOY-*`, sprint notes),
  moved here from the repository root and `docs/` in V51.9.179.
- [`sprints/`](sprints/) — sprint write-ups (V46–V50).
- [`archive/ai-guru/`](archive/ai-guru/) — early design notes.

## Where new documents go

- **A change to how the app works:** update the matching current document above, and add a line to `CHANGELOG.md`.
- **A design for something not built yet:** `docs/designs/<name>.md`.
- **Notes about one release:** `docs/archive/releases/`, not the repository root.
