# AI Guru

AI Guru is an AI classroom for Indian school students (Class 1–12, mainly mathematics and science), teaching in
**English, Malayalam, or both**. It reads a textbook, plans each paragraph, and teaches it on an animated whiteboard with a
voice. Students can ask doubts by speaking or showing their notebook, take quizzes, and make short reels. Teachers,
parents and the school office have their own portals.

The current version is in [`VERSION`](VERSION); the history is in [`CHANGELOG.md`](CHANGELOG.md).

## Who uses it

| Person | What they do | Where |
|---|---|---|
| Student | Classes from their textbook, doubts, quizzes, reels, progress | `/ai-guru/classroom`, `/ai-guru/student/*`, `/ai-guru/reels`, `/ai-guru/learn` |
| Teacher | Class codes, quizzes and question sets, attendance, results, teacher avatar and voice | `/ai-guru/teacher/*` (sign in with the class code + 6-digit key) |
| Parent | A child's results, using the code shown to the student | `/ai-guru/parent` |
| School office (admin) | Students, fees, coupons, classes, the textbook library, settings | `/ai-guru/admin` (sign in with `ADMIN_USERNAME` / `ADMIN_PASSWORD`) |

**Non-goals.** AI Guru is not a general chat assistant or a full school-management system (timetables, payroll). It does
not teach without a source: lessons come from the uploaded textbook or the question asked.

## How a lesson is made

```text
Textbook PDF ─► Material Studio: read pages (text, or OCR for scans) ─► chapters and parts ─► study materials (AI + QA gate)
                                                                                     │
Classroom: pick a paragraph ─► lesson plan (AI, or the offline maths solver) ─► maths checked with Math.js
          ─► motion "DNA" picks a visual template ─► Motion engine draws it on the whiteboard
          ─► voice reads each step (English and/or Malayalam) ─► doubts pause the class, which resumes when the doubt pane closes
```

- **Whiteboard.** The classroom draws with AI Guru's own **Motion engine** (`components/ai-guru/MotionTeachingBoard.tsx`,
  `lib/ai-guru/motion-class/`, `lib/ai-guru/reels/motion/`). The same engine makes reels and MP4s. Templates
  ("DNA") are described in [`docs/MOTION-CLASS-DNA.md`](docs/MOTION-CLASS-DNA.md) and
  [`docs/MOTION-GRAPHICS-ENGINE.md`](docs/MOTION-GRAPHICS-ENGINE.md). `MathLikeAnimBoard` draws a paragraph's visual
  steps in the classroom. The older `ThreeB1BTeachingBoard` and its manim-web canvas were removed in V51.9.179.
- **Maths checking.** Answers and steps are checked with **Math.js** (`lib/ai-guru/math/`). Mathsteps was removed in
  V51.9.173 for security. The maths branches (arithmetic … combinatorics) each have a profile in `lib/ai-guru/math/domains/`;
  see [`UNIVERSAL-MATH-ENGINE.md`](UNIVERSAL-MATH-ENGINE.md).
- **AI models.** Google Gemini by default. Students and teachers can bring their own key (Gemini, OpenRouter and others:
  `lib/ai-guru/byok-providers.ts`). On a live site the **server's own keys are used only for signed-in users**
  (`lib/ai-guru/net/server-keys.ts`).
- **Agents.** `lib/ai-guru/agents/` holds the lesson, maths, doubt, assessment, remediation, curriculum, teacher, parent,
  analytics, session-memory and voice agents.
- **Voice.** Edge (free) first; the order is in [`TTS-SETUP.md`](TTS-SETUP.md).

## Where data is kept

All saved data goes through one small layer, [`lib/ai-guru/storage/`](lib/ai-guru/storage/index.ts):

| Kind | On a laptop (default) | Google Cloud Run | Netlify |
|---|---|---|---|
| Records (students, fees, attendance, quizzes, books, materials, messages, study-material jobs) | `./data`, `./.data` (JSON files) | Cloud SQL PostgreSQL | Neon PostgreSQL |
| Files (PDFs, photos, voices, videos) | `./data`, `./.data` | Cloud Storage | Netlify Blobs |

Switches: `AI_GURU_STORE=postgres` + `DATABASE_URL` for records; `AI_GURU_BUCKET` (Cloud Storage) or
`AI_GURU_BLOBS=netlify` for files.

**Each item is its own record** (V51.9.178):
- **School records.** Every student, invoice, coupon, class, payout and register entry is stored separately. A change
  writes only what changed, in one database transaction. With 2,000 students and 4,000 invoices on PostgreSQL, reading
  the school takes about 60 ms and a one-invoice change about 110 ms.
- **History.** Quiz results and attendance visits are one record each, and nothing old is dropped.

Each change still reads the whole school before writing. That is fine for a school, but a site serving many schools
would need per-school storage.

## Run it on your computer

Needs **Node.js 22.19 or newer**.

```bash
npm install
cp .env.example.ai-guru .env.local     # then add your GEMINI_API_KEY (optional: students can use their own keys)
npm run dev
```

Open <http://localhost:3000>. The front page links to the classroom. On a laptop the admin sign-in is `xxx / yyy`
until you change it. A live site never accepts it.

```bash
npm test             # unit tests (vitest)
npx tsc --noEmit     # type check
npm run build        # production build
npm run eval:curriculum   # maths routing check on Class 1–12 cases
```

## Put it online

- **Google Cloud Run + PostgreSQL** (recommended for schools): [`docs/DEPLOY-GOOGLE-CLOUD.md`](docs/DEPLOY-GOOGLE-CLOUD.md)
- **Netlify + Neon, free plan** (for trials; 60-second and 4.5 MB limits): [`docs/DEPLOY-NETLIFY.md`](docs/DEPLOY-NETLIFY.md)

## Security in short

- **Admin sign-in.** Only from `ADMIN_USERNAME` / `ADMIN_PASSWORD` on a live site. Passwords are stored as scrypt
  hashes, and the session is a signed, http-only cookie lasting 8 hours.
- **Teachers and students.** Teachers sign in with a class code and key; students with their Student ID (or admission number) and PIN.
- **Lockout.** 5 wrong tries lock an address for 15 minutes. The count is shared by every copy of the app, and the
  address cannot be faked.
- **Request limits.** Per address, in `proxy.ts`.
- **Server keys.** Used only for signed-in users.
- **Secrets.** Kept in environment variables / Secret Manager, never in the repository (`.gitignore`).

## Documentation map

| Topic | Document |
|---|---|
| Release history | [`CHANGELOG.md`](CHANGELOG.md) |
| Voices | [`TTS-SETUP.md`](TTS-SETUP.md) |
| Maths engine and branches | [`UNIVERSAL-MATH-ENGINE.md`](UNIVERSAL-MATH-ENGINE.md) |
| Whiteboard templates (DNA) | [`docs/MOTION-CLASS-DNA.md`](docs/MOTION-CLASS-DNA.md) |
| Motion engine | [`docs/MOTION-GRAPHICS-ENGINE.md`](docs/MOTION-GRAPHICS-ENGINE.md) |
| Deploying | [`docs/DEPLOY-GOOGLE-CLOUD.md`](docs/DEPLOY-GOOGLE-CLOUD.md), [`docs/DEPLOY-NETLIFY.md`](docs/DEPLOY-NETLIFY.md) |
| Latest design review | [`docs/reviews/2026-11-02-egm/`](docs/reviews/2026-11-02-egm/) |
| Every document, current or historical | [`docs/README.md`](docs/README.md) |

Notes from individual releases are in [`docs/archive/releases/`](docs/archive/releases/). They describe the app as it was
then; `CHANGELOG.md` is the running record.
