# Deploying AI Guru on Google Cloud (Cloud Run + PostgreSQL)

V51.9.173. This guide puts AI Guru live on the internet with Google Cloud:

| Part | Google service | What it holds |
|---|---|---|
| The app | **Cloud Run** (Mumbai, `asia-south1`) | Runs AI Guru. Scales up for a busy class and down to zero when nobody is using it. |
| Records | **Cloud SQL for PostgreSQL 16** | Students, logins, fees, classes, attendance, quiz results, question sets, messages, book and material details. |
| Files | **Cloud Storage** (private bucket) | Uploaded textbook PDFs, students' photos, teacher avatars, voices and videos. |
| Keys | **Secret Manager** | Admin password, database password, session secret, Gemini key. Never in the code. |

On your laptop nothing changes: `npm run dev` keeps saving to `./data` and `./.data`.
The app switches to PostgreSQL and Cloud Storage only when `AI_GURU_STORE=postgres` and `AI_GURU_BUCKET` are set (the
Cloud Run settings below do that).

---

## 1. Create the Google Cloud project (once, in the browser)

1. Go to <https://console.cloud.google.com> and sign in with `nexusaiguru@gmail.com`.
2. Top bar → project list → **New project**. Name it `ai-guru`. Note the **Project ID** shown under the name
   (for example `ai-guru-458213`). You need it below.
3. **Billing** → link a billing account (a card is needed; new accounts get free credit).
4. **Billing → Budgets & alerts → Create budget**: for example ₹1,500 a month, alerts at 50 %, 90 % and 100 %.
   You get an e-mail before costs surprise you.

## 2. Put this version on GitHub

The repository `nexusaiguru-afk/AI-Guru-V51_9_166` holds V51.9.166, and **a second full copy of the app inside the
folder `AI-Guru-V51_9_166/`**. Replace its contents with this version and remove that inner copy:

```bash
git clone https://github.com/nexusaiguru-afk/AI-Guru-V51_9_166.git
cd AI-Guru-V51_9_166
git rm -r -q AI-Guru-V51_9_166            # the duplicate inner copy
# copy every file of this version over the old ones (keep the .git folder), then:
git add -A
git commit -m "V51.9.173 — Google Cloud Run + PostgreSQL, security fixes"
git push
```

The new `.gitignore` keeps keys (`.env*`) and saved student data (`data/ai-guru/admin`, `.data`, …) out of GitHub.
The repository is public, so this matters.

## 3. Open Cloud Shell and get the code

In the console, press the **>_** (Activate Cloud Shell) button at the top right. A terminal opens in the browser.
It already has `gcloud`, `git`, `node` and the Cloud SQL proxy installed.

```bash
git clone https://github.com/nexusaiguru-afk/AI-Guru-V51_9_166.git ai-guru
cd ai-guru
```

## 4. Run the setup script (about 25 minutes, most of it waiting)

```bash
PROJECT_ID=ai-guru-458213 bash scripts/cloud/setup-google-cloud.sh
```

Use your own Project ID. The script asks for:

- **a database password**: make up a long one (16+ characters). You won't need to type it again.
- **the admin username and password**: this is how you sign in to the admin portal on the live site (12+ characters).
- **your Gemini key**: optional. Press Enter to skip; students and teachers can still use their own keys.

It turns on the services, makes a private bucket and a PostgreSQL database in Mumbai, stores the passwords in Secret
Manager, builds the app and deploys it. At the end it prints the address, for example
`https://ai-guru-xxxxxxxx-el.a.run.app`.

Running it again is safe. It skips what is already there and builds and deploys the current code.

## 5. Check the live site

1. Open the address. The home page with the globe should appear.
2. Sign in with the admin username and password from step 4 (any portal's sign-in box).
3. Material Studio → upload a small PDF → open it in the classroom. This proves the database and the bucket work.

The development sign-in `xxx / yyy` does **not** work on the live site. That is on purpose.

## 6. Add more keys (optional)

The server's own keys are used only for people who are signed in (admin, teachers, students). Visitors who are not
signed in use their own key or the free voices, so they can't spend the school's credit. Set `AI_GURU_SERVER_KEYS=everyone`
only if you really want to allow that.

Any key the server should have, for example Sarvam:

```bash
printf '%s' 'YOUR-SARVAM-KEY' | gcloud secrets create ai-guru-sarvam-key --data-file=-
gcloud run services update ai-guru --region=asia-south1 --update-secrets=SARVAM_API_KEY=ai-guru-sarvam-key:latest
```

Plain settings (not secret), for example voices:

```bash
gcloud run services update ai-guru --region=asia-south1 --update-env-vars=EDGE_TTS_ML_VOICE=ml-IN-SobhanaNeural
```

These stay through later deploys.

## 7. Copy your existing data (students, books, …) from your PC

Only needed if you already have real data on your PC (in the app's `data/` and `.data/` folders).

1. On your PC, make a zip of just these folders, from inside the app folder:
   `data/ai-guru/admin`, `data/ai-guru/attendance`, `data/ai-guru/progress`, `data/ai-guru/messages`,
   `data/ai-guru/teacher`, `data/ai-guru/reel-looks`, `.data/ai-guru-material-studio`.
   Name it `ai-guru-data.zip`.
2. In Cloud Shell: **⋮ → Upload** → choose the zip. Then:

```bash
cd ~/ai-guru && npm ci --no-audit --no-fund
mkdir -p ~/old && unzip -o ~/ai-guru-data.zip -d ~/old

# a private tunnel to the database (leave it running in this tab)
cloud-sql-proxy --port 5432 "$(gcloud config get-value project):asia-south1:ai-guru-db" &

DB_PASS='the database password from step 4'
export DATABASE_URL="postgresql://aiguru:$DB_PASS@127.0.0.1:5432/aiguru"
export AI_GURU_BUCKET="ai-guru-files-$(gcloud config get-value project)"

npx tsx scripts/cloud/copy-data-to-cloud.ts --from=$HOME/old --dry-run   # shows what will be copied
npx tsx scripts/cloud/copy-data-to-cloud.ts --from=$HOME/old             # copies it
```

JSON records go to PostgreSQL and PDFs, photos and voices go to the bucket, under the same names the app already uses.
Older laptop data (one `records.json` for the whole school, and one list each for quiz results and attendance) is split
into one record per student, invoice, quiz result or visit the first time the live site reads it. Copy your data
**before** people start using the live site: once the live site has its own school records, a copied
`records.json` is only kept as a backup.
Running it again overwrites with the copy from your PC. Your PC's admin sign-in (`auth.json`) is **not** copied: the live
site signs in only with the username and password from Secret Manager (step 4).

Delete the zip afterwards: `rm -rf ~/old ~/ai-guru-data.zip`.

## 8. Your own domain (optional)

Cloud Run → **ai-guru** → **Integrations / Custom domains** → add `aiguru.example.com` and follow the DNS
instructions. The HTTPS certificate is free and automatic.

## 9. Deploy automatically on every `git push`

Cloud Build → **Triggers** → **Connect repository** → GitHub → `nexusaiguru-afk/AI-Guru-V51_9_166` →
**Create trigger**:

- Event: push to branch `^main$`
- Configuration: `cloudbuild.yaml`
- Substitution variables: `_BUCKET` = `ai-guru-files-<your project id>`

From then on, every push to `main` builds and deploys in about 15–25 minutes. Cloud Build → History shows each build.

---

## 10. Daily fee reminders (V51.9.186)

Every morning AI Guru sends the fee reminders that are due that day into the students' Messages. This needs a small
daily job, Cloud Scheduler, which calls the app once a day:

- **Before the due date:** a reminder 3 days before, and one on the due date.
- **During the grace period:** a reminder **every day**, from the day after the due date to the last grace day, for
  example "day 2 of 5 · 3 days left". The number of grace days is set in Admin → Monthly & yearly.
- **After the grace period:** "Your grace period is over, please make payment to continue", once, the day after the
  grace period ends. Parts 2–5 then lock until the fee is paid.

`setup-google-cloud.sh` now sets this up at the end. To set it up (or change the time) on a site that is already live,
run in Cloud Shell:

```bash
cd AI-Guru-V51_9_166 && git pull
PROJECT_ID=your-project-id REMINDER_TIME=09:00 bash scripts/cloud/setup-daily-reminders.sh
```

The script does four things:

1. Turns on Cloud Scheduler.
2. Keeps a random secret in Secret Manager (`ai-guru-cron-secret`).
3. Gives the secret to the app as `AI_GURU_CRON_SECRET`.
4. Creates the job `ai-guru-fee-reminders` (every day at `REMINDER_TIME`, India time) and runs it once to try it.

The office's **Students management → ⏰ Fees due** page shows when the daily run last happened and how many reminders
it sent. Running the job twice on the same day sends nothing twice. Cloud Scheduler gives 3 jobs a month free, so this
one costs nothing.

**On Netlify or any other host:** set `AI_GURU_CRON_SECRET` (at least 16 characters) on the site. Then have any daily
scheduler (cron-job.org, or a GitHub Actions `schedule:` workflow) send
`POST https://<your-site>/api/ai-guru/cron/fee-reminders` with the header `x-cron-secret: <the same secret>`.

## Costs (approximate; check the console's Billing page and the pricing calculator)

- **Cloud SQL `db-f1-micro`** is the largest fixed cost, about US$10 a month, always on, plus a little for storage
  and backups. When classes grow, move up a size with `gcloud sql instances patch ai-guru-db --tier=db-g1-small`.
- **Cloud Run** is billed only while it answers requests, and a monthly free allowance covers a small school's
  traffic. Cold start: the first visit after a quiet spell takes a few seconds. To avoid that, run
  `gcloud run services update ai-guru --region=asia-south1 --min-instances=1`, which keeps one copy always
  running and adds a monthly cost.
- **Background work keeps the CPU on.** Cloud Run keeps the CPU on for the whole time a copy of the app is running,
  not just during requests, so study materials keep being made after the reply. A copy still shuts down after a quiet
  spell. This costs a little more than request-only billing.
- **Cloud Storage** costs a few cents per GB a month.
- **Cloud Build**: builds on the default machine fall within the free monthly build minutes.

## Limits to know

- **Large textbooks (V51.9.179).** Cloud Run accepts at most 32 MB in one request, so Material Studio sends a PDF
  larger than 8 MB straight from the browser into the private bucket, using a link that works for 15 minutes. The
  limit is then `AI_GURU_MAX_PDF_MB` (default 200 MB). Uploads that were never indexed are deleted after a day. **If
  you set up before V51.9.179, run the setup script once more**: it adds the bucket rules and the permission that
  direct upload needs.
- **PDF work is limited per server copy.** At most 2 page renders or OCR runs happen at once
  (`AI_GURU_PDF_CONCURRENCY`), and recently used books stay in a 150 MB cache (`AI_GURU_PDF_CACHE_MB`). Full-access
  PDF downloads are streamed, not loaded into memory.
- **Local Piper voices and the Piper installer** are not used on Cloud Run. Edge, Google and Sarvam voices work, and
  the on-device Rasa voice runs in the student's browser.
- **The rate limit** is per server copy and generous (600 AI requests a minute from one address), because a whole
  class can share one school internet address. Change it with `AI_GURU_RATE_AI_PER_MIN`.

- **Database connections.** Each copy of the app uses up to 3 (`AI_GURU_PG_POOL`), with up to 5 copies
  (`_MAX_INSTANCES` in `cloudbuild.yaml`), so 15 in all. The smallest database size allows about 25. If you raise
  `_MAX_INSTANCES`, move to a bigger database size first, or lower the pool. Errors saying "timeout exceeded when
  trying to connect" mean the connections ran out.
- **Study-material jobs** are shared by all copies. If a copy stops mid-job, another restarts it within about 3
  minutes; after two stops the job ends with "Please ask again".

## When something goes wrong

- **Logs**: Cloud Run → ai-guru → **Logs**, or run `gcloud run services logs read ai-guru --region=asia-south1 --limit=100`.
- `no admin sign-in is set`: the admin secrets are missing. Run step 4 again.
- `password authentication failed` / `ECONNREFUSED /cloudsql/…`: the database URL or the `--add-cloudsql-instances`
  setting is wrong. Run step 4 again, which rewrites the secret.
- `403` on the bucket: the app's account lacks bucket access. Run step 4 again.
- **Roll back** to the previous version: Cloud Run → ai-guru → **Revisions** → pick the last good one →
  **Manage traffic → 100 %**.

## Trying the PostgreSQL mode on your PC (optional)

```bash
# with a local PostgreSQL running
AI_GURU_STORE=postgres DATABASE_URL=postgresql://postgres@localhost:5432/aiguru npm run dev
# storage tests against it:
TEST_DATABASE_URL=postgresql://postgres@localhost:5432/aiguru npx vitest run lib/ai-guru/storage
```

Leave `AI_GURU_BUCKET` unset and files still go to `./.data` and `./data`.

## 11. UPI payments confirmed automatically (V51.9.190)

Families pay the school's UPI ID (⚙ Settings → UPI, e.g. `manojkrish70@okhdfcbank`) and type the 12-digit UPI reference
their app shows. AI Guru confirms the payment by itself when **the bank's own alert** has the same UPI reference **and**
the same amount, then sends the student "🎉 Congratulations" with the receipt in Messages (receipt number, date, amount,
AI Guru transaction ID, UPI reference). Anything that does not match exactly waits on the office's Fees page.

1. HDFC NetBanking or the HDFC app → **InstaAlerts**: e-mail alerts for UPI credits, to your Gmail.
2. In Cloud Shell: `PROJECT_ID=project-c5a9001c-2043-41d4-b68 bash scripts/cloud/setup-bank-alerts.sh`
   It makes the secret, gives it to the app, and prints `AI_GURU_URL` and `AI_GURU_SECRET`.
3. [script.google.com](https://script.google.com) with the same Gmail → New project → paste
   `scripts/payments/gmail-bank-alerts.gs` → Project Settings → Script properties → add the two values → run `install`.
   It reads only HDFC alert e-mails, every 5 minutes, and labels each one `ai-guru-sent`.

The office's **Fees** page shows "Bank alerts reach AI Guru · last one …". Without the script it still works: upload the
bank statement (CSV) on the Fees page and every UPI credit in it is matched the same way, or confirm by hand.

Any other bank, or an SMS forwarder on the school phone: POST the alert text to `/api/ai-guru/payments/bank-alert`
with the header `x-alert-secret` (`{ "text": "…", "source": "sms" }`).
