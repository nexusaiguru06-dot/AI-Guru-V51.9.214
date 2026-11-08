# EGM consolidated review: AI Guru V51.9.173

> **Status (V51.9.179):**
> - **Fixed:** B1, B2, M4, M6 (V51.9.176); M1, M5 (V51.9.177); B3, M11 (V51.9.177: README and TTS-SETUP rewritten); M2, M3, N1 (V51.9.178); M7, M8, M9, M10 (V51.9.179).
> - **Open:** N2–N6 (small).
>
> One correction to M8: the classroom's board is the Motion engine (`MotionTeachingBoard`). manim-web is reachable only
> through `ThreeB1BTeachingBoard`, which no page uses.

**Method.** This follows the Elephant–Goldfish Model's `egm-review`, run in "Consolidated report" mode, plus `egm-drift-report`.
- **Reviewers.** Four Goldfish reviewers each ran in a fresh context with no knowledge of how the app was built: Zoom-out (skeptical architect), Comprehension (new team member), Design critic and Structural. Each used EGM's own persona file and document standard.
- **Target.** `README.md`, the project's only top-level description. The design critic also covered `docs/DEPLOY-GOOGLE-CLOUD.md` and `lib/ai-guru/storage/`.
- **Verification.** I checked every finding below against the code before including it.
- **Stages run.** EGM's Stage 9 (implementation readiness) was not run: the README has no implementation plan to test.

Severity: 🔴 Blocker · 🟡 Major · 🟢 Nit. Items marked **(still on `main`)** are also present in V51.9.175 on GitHub.

## 🔴 Blockers

**B1. The address check can be forged on Google Cloud (still on `main`).** `lib/ai-guru/net/client-ip.ts:9-10` trusts the `x-nf-client-connection-ip` header on every platform. Only Netlify sets it; on Cloud Run any caller can send it.
- **Effect:** an attacker changes it on each request and gets a fresh request-limit allowance and a fresh admin-lockout record every time. The "5 wrong passwords → locked" rule and the rate limit stop working.
- **This is my bug from V51.9.173.** My own test only forged `X-Forwarded-For`.
- **Fix:** read the Netlify header only when running on Netlify (`process.env.NETLIFY`); on Cloud Run use only the last X-Forwarded-For entry. Add a test that sends a forged Netlify header.

**B2. Anyone can spend the school's AI and voice credit (still on `main`).**
- **Where:** `/api/ai-guru/tts`, `/sarvam-tts`, `/generate-lesson`, `/doubt` and the maths planner (`lib/ai-guru/math/planner/gemini.ts:112`).
- **What happens:** with no sign-in at all, these routes fall back to the server's own `GEMINI_API_KEY` / `SARVAM_API_KEY`. The only guard is the per-address limit (600 AI calls a minute per server copy), and B1 removes even that.
- **Budget alert:** the Google budget alert only sends an e-mail; it does not stop spending.
- **Fix:** use the server keys only for signed-in students, teachers or admins (guests bring their own key). Add a per-user daily cap stored in the database. Set a hard spending cap in each provider's console.

**B3. The README does not describe the app that exists.** It is titled V49 and written as sprint notes. It has no statement of who the app is for, no goals or non-goals, no data or storage design, no alternatives considered and no risks. Several statements are now false: Mathsteps, `legacy-app/`, `pnpm`, "root redirects to /ai-guru", the voice order and the fonts. See `2026-11-02_DRIFT_REPORT.md`. All four reviewers raised this.
- **Fix:** a short, current README covering what AI Guru is and for whom; the architecture today; storage and hosting modes; npm run steps with Node 22 and the env file; and links to `CHANGELOG.md` and `docs/`.

## 🟡 Major

**M1. Study-material jobs live in one server's memory (still on `main`).** `lib/ai-guru/library/cloud.ts:32-97` keeps the job queue in a `Map` and runs work after the reply is sent (`void run(...)`). On Cloud Run:
- the CPU is throttled after the reply (`--no-cpu-throttling` is not set);
- a copy can shut down mid-job (`--min-instances=0`);
- with up to 5 copies, "job status" usually asks a copy that never saw the job;
- the per-student daily limit and the duplicate check count only jobs on that one copy.

On Netlify, a function stops after 60 seconds, which is worse. **Fix:** store jobs in the database and process them in a worker (Cloud Run job / Cloud Tasks), or at least set `--no-cpu-throttling` and document the limit.

**M2. One record holds the whole school (still on `main`).** Every student, address, invoice, payment, coupon and register entry is one JSON value: `data/ai-guru/admin/records.json` in the database.
- Every change, even a student opening their page for the first time (which creates a referral code), rewrites the whole thing under one school-wide lock.
- It is correct today, but write size and waiting time grow with every student.

**Fix:** split it into tables (students, invoices, payments). First, remove writes from pages that only read.

**M3. Quiz history and attendance silently drop old records (still on `main`).** `quiz/server-store.ts` keeps the last 5,000 quiz records and `attendance/server-store.ts` the last 20,000, discarding older ones without warning. With a few hundred students, progress history disappears within weeks. **Fix:** one row per record in the database, with no cap; until then, document the caps.

**M4. A brief file error on a laptop can wipe the school's records (still on `main`).** `storage/index.ts:84`: `localDocs.get` turns every error into "nothing saved", including permission errors, too many open files and Windows antivirus locks. `admin/store.update()` then starts from an empty school and saves it over the real one. The PostgreSQL store raises the error instead, so the two stores behave differently. **Fix:** return "nothing saved" only for file-not-found; raise everything else. Add a test.

**M5. Database connections can run out on the smallest Cloud SQL size (still on `main`).**
- **Supply:** `db-f1-micro` allows about 25 connections.
- **Demand:** each Cloud Run copy opens up to 5 (`AI_GURU_PG_POOL`), with up to 5 copies, plus the Cloud SQL proxy and the copy script.
- **Pile-up:** with 40 requests per copy queued behind 5 connections, a class signing in at once can hit "too many connections".

**Fix:** set the pool from the database's limit ÷ max copies (for example 3 or 4), and say in the guide what to watch.

**M6. Copying data can bring the development password to the live site (still on `main`).**
- **Cause:** Step 7 of the guide copies the PC's `auth.json` (often xxx / yyy) into the database. `auth.ts` `load()` accepts any saved record before checking whether development logins are allowed.
- **Effect:** if the `ADMIN_*` secrets ever go missing, the live site accepts the PC password instead of refusing.

**Fix:** skip `auth.json` in the copy script, and in production ignore saved sign-in records unless they were created there.

**M7. Large files are held whole in memory.** Blob get/put and OCR load whole PDFs, and Cloud Run's temporary disk also uses memory. With 2 GB per copy and 40 requests at once, several textbook uploads or OCR runs together can run out of memory and take down every request on that copy. **Fix:** upload PDFs straight to storage with signed links; run OCR with lower concurrency or as a separate service; document memory per request.

**M8. Two drawing engines, and the README names the less-used one as the main renderer.**
- **README:** names the "native MathLikeAnim whiteboard" as the canonical renderer.
- **Code:** manim-web (WebGL) appears in 16 files and MathLikeAnim in 3. `docs/AI-GURU-V51.9.11-MANIM-WEB-ARCHITECTURE.md` makes manim-web the primary renderer.

**Fix:** name one renderer and either retire the other or label it a fallback.

**M9. Unused legacy code (about 1,200 type errors).** These folders are never imported by the app and are the source of all 1,242 type errors in a full check:
- `components/scene-renderers`, `components/workbench`, `components/edit`, `components/stage`, `components/whiteboard`;
- `lib/server` (60 files, which also read `OPENMAIC_*` settings);
- `mathsteps` leftovers.

**Fix:** delete them, which shrinks the repo and the attack surface, and widen the type check to cover `proxy.ts`, `app/layout.tsx` and `components/DoubtCameraMic.tsx`, which run but are not checked today.

**M10. The documentation has no map.**
- **Sprawl:** 66 Markdown files in the repo root and about 40 in `docs/`, plus `docs/sprints/` and `docs/archive/`.
- **No links:** the README links to none of them.
- **Duplicates:** several topics have two or three overlapping files (reference library v1 and v2; three Sprint 8.2 files).

**Fix:** keep the root to README, CHANGELOG and LICENSE; move version notes to `docs/archive/`; add `docs/README.md` as an index.

**M11. The voice documents contradict the code and each other.**
- **README:** Sarvam → Piper → device.
- **TTS-SETUP:** Edge → Google → Sarvam/Piper, with browser speech "disabled".
- **Code:** Edge → Rasa (Malayalam) → Piper → Google → Sarvam, and browser speech is still used in the doubt pane.

**Fix:** one table in TTS-SETUP, linked from the README.

## 🟢 Nits

- **N1.** `storage/index.ts:144` removes `\u0000` from the finished JSON text. A text containing a literal backslash followed by "u0000" would then produce broken JSON. Strip NUL characters from values before converting instead.
- **N2.** Admin sessions last 8 hours and cannot be revoked short of changing the secret. Document it, or add a session version number.
- **N3.** A book's PDF and its record are saved in two steps with no rollback. A failure in between leaves a stray file.
- **N4.** About 50 environment variables the code reads are missing from `.env.example.ai-guru`.
- **N5.** `app/layout.tsx` loads Chilanka from Google Fonts under a comment that says "Self-hosted", so the class needs internet for that font.
- **N6.** `/api/ai-guru/math/domains` still reports `version: 'V49'`.

## Traceability (reviewer → item)

| Item | Zoom-out | Comprehension | Design critic | Structural | Drift (Elephant) | Verified in code |
|---|---|---|---|---|---|---|
| B1 | | | ✔ | | | ✔ client-ip.ts:9-10 |
| B2 | | | ✔ | | | ✔ 4 routes, 0 auth checks |
| B3 | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| M1 | | | ✔ | | ✔ | ✔ cloud.ts:32-97 |
| M2 | | | ✔ | | | ✔ |
| M3 | | | ✔ | | ✔ | ✔ |
| M4 | | | ✔ | | | ✔ storage/index.ts:84 |
| M5 | | | ✔ | | | ✔ pool 5 × 5 copies |
| M6 | | | ✔ | | ✔ | ✔ auth.ts load() |
| M7 | | | ✔ | | | ✔ |
| M8 | ✔ | ✔ | | | | ✔ file counts |
| M9 | ✔ | ✔ | | | ✔ | ✔ full type check |
| M10 | ✔ | ✔ | | ✔ | | ✔ |
| M11 | ✔ | ✔ | | ✔ | ✔ | ✔ provider-order.ts |

## Suggested order

1. **B1, B2, M4, M6.** Security and data-safety bugs; small code changes. Fix these before real students use either live site.
2. **M1, M5.** Make study-material jobs and database connections safe on Cloud Run.
3. **B3, M10, M11.** Rewrite the README and voice documents, and index the docs.
4. **M2, M3, M7.** Database tables instead of whole-school files, streaming uploads. Larger work, needed as schools grow.
5. **M8, M9.** Pick one renderer and delete the legacy code.
