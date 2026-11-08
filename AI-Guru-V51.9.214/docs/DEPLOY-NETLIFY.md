# AI Guru on Netlify for free (Neon PostgreSQL + Netlify Blobs)

V51.9.175. This is the free way to put AI Guru online:

| Part | Service (free plan) | What it holds |
|---|---|---|
| The app | **Netlify** | Pages and API, built from GitHub on every push. |
| Records | **Neon PostgreSQL** | Students, logins, fees, attendance, quiz results, question sets, messages, book and material details. |
| Files | **Netlify Blobs** | Uploaded PDFs, students' photos, teacher avatars, voices and videos. |

On your laptop nothing changes: `npm run dev` still saves into `./data` and `./.data`.

## Know the free-plan limits first

- **Netlify credits.** You get 300 credits a month, roughly 15 GB of traffic or 20 deploys. Netlify e-mails you at
  50 %, 75 % and 100 %. **At 100 % the site stops serving until next month.** Don't deploy for every small change.
- **60 seconds per request.** A very long AI request (a big lesson or a whole book of study materials at once) is cut
  off. Make study materials a part or two at a time.
- **Each request up to about 4.5 MB.** Since V51.9.204 a bigger textbook PDF is sent in 3 MB pieces, so any size
  uploads. Reading a very large book can still take longer than the 60 seconds below: upload one chapter per PDF then.
- **"Make on the AI Guru cloud" does not work well here.** Netlify stops a function as soon as it replies, so study
  materials can't be made in the background; such jobs end with "Please ask again". Make study materials in
  Material Studio one part at a time instead.
- **Lesson plans for students (V51.9.209).** Set `GEMINI_API_KEY` (or the Cloud settings key). In the Admin portal open
  **🧠 Lesson plans** and press *Prepare lesson plans* for each material: the page makes the whiteboard plans in short
  steps (it fits the 60 seconds) while it stays open. Students then need no AI key for the classroom.
- **Neon sleeps after 5 minutes idle.** The first request after a quiet spell is about a second slower.

For a full school (many classes all day), Google Cloud Run is the safer choice (docs/DEPLOY-GOOGLE-CLOUD.md),
because it never pauses mid-month.

## 1. Make the free database on Neon (5 minutes)

1. Go to <https://neon.com> → **Sign up**, using GitHub or nexusaiguru@gmail.com.
2. **Create project**:
   - Name: `ai-guru`
   - Postgres version: 16 or newer
   - Region: **AWS US East 2 (Ohio)**. Netlify's functions run in Ohio by default, so the two are close and fast.
3. On the project's **Dashboard**, click **Connect**. Switch **Connection pooling ON**, then copy the connection string.
   It looks like `postgresql://neondb_owner:…@ep-…-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require`.
   Keep it private: it contains the password.

The app creates its table (`ai_guru_docs`) by itself on first use.

## 2. Connect Netlify to GitHub

At <https://app.netlify.com>:

- **If you already have the AI Guru site on Netlify:** open it → **Site configuration → Build & deploy →
  Link repository** → GitHub → `nexusaiguru-afk/AI-Guru-V51_9_166`, branch `main`.
- **For a new site:** **Add new site → Import an existing project → GitHub →** `AI-Guru-V51_9_166`, branch `main`.

Leave the build settings empty. `netlify.toml` in the repo sets them (`npm run build`, Node 22).
**Base directory** must be empty, because the app is at the top of the repo now.

## 3. Add the settings (Environment variables)

**Site configuration → Environment variables → Add a variable**. Add each of these, with scope "All" or at least
"Functions" and "Builds":

| Key | Value |
|---|---|
| `AI_GURU_STORE` | `postgres` |
| `DATABASE_URL` | the Neon pooled connection string from step 1 |
| `AI_GURU_PG_POOL` | `2` |
| `AI_GURU_BLOBS` | `netlify` |
| `ADMIN_USERNAME` | your admin username |
| `ADMIN_PASSWORD` | a strong password (12+ characters) |
| `ADMIN_SESSION_SECRET` | a long random string, e.g. 40 random letters and digits |
| `GEMINI_API_KEY` | optional; your server Gemini key |
| `AI_GURU_PLATFORM` | `netlify` (so the sign-in lockout uses the visitor's real address) |

Mark `DATABASE_URL`, `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET` and `GEMINI_API_KEY` as **secret** (the "Contains secret
values" box). The development sign-in `xxx / yyy` does not work on the live site.
The server's own keys (`GEMINI_API_KEY`, `SARVAM_API_KEY`, …) are used only for signed-in admins, teachers and students;
visitors who are not signed in use their own key or the free voices.

Netlify Blobs needs no setting: Netlify gives the site its own private file store.

## 4. Deploy

**Deploys → Trigger deploy → Deploy site**. The build takes about 5–10 minutes. Your address is shown at the top of
the site page, for example `https://ai-guru-nexus.netlify.app`. Change the name under **Site configuration → Change
site name**.

Check that it works:

1. Open the address. The home page with the globe appears.
2. Sign in with `ADMIN_USERNAME` and `ADMIN_PASSWORD`.
3. Material Studio → upload a small PDF (under 4.5 MB) → open it in the classroom.

From now on, every push to `main` deploys by itself. Each deploy costs 15 credits.

## 5. Copy your existing data from your PC (optional)

Only if you already have real students or books on your PC. You need:

- **Site ID**: Netlify → your site → **Site configuration → General → Site details → Site ID**.
- **Personal access token**: Netlify → your avatar → **User settings → Applications → Personal access tokens → New
  access token**. Copy it, and delete it after copying the data.

In the app folder on your PC (PowerShell):

```powershell
$env:DATABASE_URL="the Neon connection string"
$env:AI_GURU_BLOBS="netlify"
$env:NETLIFY_SITE_ID="your site id"
$env:NETLIFY_BLOBS_TOKEN="your personal access token"
npx tsx scripts/cloud/copy-data-to-cloud.ts --dry-run    # shows what will be copied
npx tsx scripts/cloud/copy-data-to-cloud.ts              # copies it
```

Records go to Neon and files go to Netlify Blobs, under the same names the app uses.

## When something goes wrong

- **Build failed**: Deploys → the failed deploy → read the last lines of the log, and send them to Claude.
- **Errors on the live site**: Netlify → **Logs → Functions**.
- `no admin sign-in is set`: `ADMIN_USERNAME` / `ADMIN_PASSWORD` are missing. Add them and deploy again.
- `password authentication failed` or `ENOTFOUND`: `DATABASE_URL` was copied wrongly. Copy the pooled string again.
- **The site says it is paused**: the month's credits are used up. Wait for next month, or add credits / move to
  Google Cloud Run.
- **Roll back**: Deploys → pick the last good deploy → **Publish deploy**.


## The demo admin sign-in (V51.9.214)
Until you set `ADMIN_USERNAME` and `ADMIN_PASSWORD` in Netlify, **xxx / yyy** opens the Admin portal on the live site (also from the School teacher sign-in box). As soon as both are set (and the site is redeployed) xxx / yyy stops working. Set `AI_GURU_NO_DEMO_ADMIN=1` to turn the demo sign-in off even when nothing is set. Do not leave it on while real students use the site.
