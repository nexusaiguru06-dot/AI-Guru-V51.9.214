## V51.9.215 — "New Schools" in the Portals menu
- The **Portals** menu has a new entry, **New Schools**, which opens the office sign-in (the same page the Admin portal was). The page heading, the sign-in title and the portal sign-in link now say **New Schools** instead of "Admin".
- The sign-in is still the office username and password (xxx / yyy on the demo until real ones are set, see V51.9.214).

## V51.9.214 — The demo admin sign-in (xxx / yyy) works on the Netlify demo
- On a live site, **xxx / yyy now opens the Admin portal as long as no real admin sign-in is set** (no `ADMIN_USERNAME` + `ADMIN_PASSWORD`). Use it in the Admin portal or the School teacher sign-in box.
- The moment `ADMIN_USERNAME` and `ADMIN_PASSWORD` are set on Netlify, xxx / yyy **stops working by itself**. `AI_GURU_NO_DEMO_ADMIN=1` switches it off even when nothing is set.
- Needs one deploy to take effect (Netlify deploys are paused while credits are used up; a Deploy Preview does not count as the live site).
- **Do not keep xxx / yyy on a site that holds real student data.**

## V51.9.213 — Reel Studio: a fifth way, Google Omni 1.2
- **Google Omni 1.2 (AI video)** joins the four ways (Reel Studio → Choose Google Omni 1.2). Omni 1.2 Flash is Google's newest video model (announced 5 Nov 2026): 3–15 s clips (10 by default), 9:16 for reels, made **with its own sound**; it cannot keep a recorded voice, so the page tells students to join the clip with their reel in a phone editor.
- The page has the ready prompt (look, part, music; editable), links to **Google Vids** (free with a Google account: 3 videos a month, 15 s, pictures), **Flow** and **Google AI Studio** (MP4 in; paid API), the parent/teacher warning, "check every number", and **My Google Omni videos** to keep the result.
- **Raw reels** work with it: an MP4 ticked in the tray opens on the Omni page (whiteboard parts do not fit it, as with Flow).
- This version also **includes V51.9.206 (Windows-safe file names) and V51.9.207 (raw reels tray)**, which the V51.9.211/212 zips had missed.

## V51.9.212 — A photo at sign-up, shown at the bottom of the reels
- The **student sign-up page** has an optional **Your photo** box: take a selfie or pick a photo, move/zoom it into a square, and tick the two switches (a parent agrees; show it on reels).
- When the account is made, the photo is saved **on the account** (the office sees it, it follows the student to another phone) and **on this device**, where the reel maker reads it. If the upload fails, the student page sends the device copy later.
- **Reels:** the photo is drawn at the bottom, beside the student's name, on every reel they download or share (and "Shared by" on the closing cards). It shows only when both switches are on, as before.

## V51.9.211 — Pay by month: ten parts, one for each academic month
- **Ten parts, not five.** Every textbook is split into ten parts. The office links each part to a month (Settings → Free trial & part fees; default June–March for Kerala, any state can change it).
- **Part 1 is free for everyone.** Every later part is one month's fee (default ₹800, editable). Paying a month opens that part in every book at once; paid parts stay open. An all-at-once price is still offered until the first month is paid. Bills have no due dates; they and the receipts carry the month name.
- **Material Studio is gone from the student side.** No menu tab, no student uploads (the server refuses them), and the library says study materials come from the teachers and the office. The Studio stays for the admin and teachers.
- **Doubt clearing.** The office sets free **minutes a day** for students without a key (default 10, handed out in slices of up to 5). A student's own API key means unlimited doubts.
- **Front page and start flow.** "Download your textbook" is removed; the student start has four steps; the API key page and home page say the API setting is for unlimited doubt clearing.
- **Tutorial video** (45 s, with an English voice-over) above the Gemini key box on the API key page: how to make the key and paste it.

## V51.9.210 — The School teacher sign-in box opens the Admin portal too
- Type the office user name and password in the **School teacher portal** sign-in (the Teacher ID box) and the **Admin portal**
  opens. The top-bar "Sign in" of every page already did this. A real teacher ID (TS-…) is never tried as an office sign-in, and
  a wrong try shows only the ordinary message, so the box never says that an office sign-in exists.
- On a live site (Netlify) the office name and password still come only from `ADMIN_USERNAME` / `ADMIN_PASSWORD`; xxx / yyy
  works only on a computer (`npm run dev`, or `AI_GURU_ALLOW_DEV_ADMIN=1`).

## V51.9.209 — Whiteboard lesson plans made on the server (students need no AI key)
- **The classroom no longer needs the student's own AI key.** The office makes each section's whiteboard lesson plan once, on
  the server, with the server's Gemini key (Study materials → Cloud settings, or `GEMINI_API_KEY`). The classroom asks the
  server for that plan first and plays at once ("Planning the lesson…" is skipped); the plan is also kept on the device after
  the first open, so the class opens again without the network. A section the server has no plan for is planned in the
  browser as before.
- **New office page: Admin portal → 🧠 Lesson plans.** Pick a material and press *Prepare lesson plans*. It works in short
  steps (one block per request, up to 5 at once), so it fits Netlify's 60-second limit; keep the page open. Stop any time:
  finished blocks are kept. A plan the AI did not really make (a built-in fallback) is never saved; the step is tried again.
- A student gets a plan only for a part they may open (locked parts get none); a changed passage makes a new plan.
- API: `GET/POST /api/ai-guru/admin/board-plan` (office only) and `GET /api/ai-guru/board-plan` (classroom).
- Tests: `lib/ai-guru/material-studio/board-plan.test.ts`.

## V51.9.208 — Classroom: bigger whiteboard, and the lesson plan is remembered
- **Bigger whiteboard.** The board now fills its half of the screen (it was held to 896 px wide and a short height) and is
  taller, so on a computer it is about half the height of the textbook page beside it. Phones are unchanged.
- **No more "Planning the lesson" every visit.** The classroom builds the animated whiteboard lesson from the textbook text
  (the AI plans each paragraph, then the voice and drawings are prepared). The plan was kept only in memory, so every new visit
  planned the same section again. It is now saved on this device (newest 24 sections), so the next time the lesson starts
  playing at once. The first time a section is opened it is still planned once.
- Tests: `lib/ai-guru/motion-class/plan-store.test.ts`.
## V51.9.206 — Windows: upload no longer fails with "EINVAL: invalid argument, rename"
- Book ids look like `doc:3SAq…`, and Windows does not allow `:` in a file name. On Windows the app now saves such files
  with `%3A` in place of `:` and reads them back as before. Nothing changes on Mac, Linux, Netlify or Cloud Run.
- Test added in `lib/ai-guru/storage/storage.test.ts`.
## V51.9.207 — Reel Studio: raw reels
- **New "Raw reels" tray** under the four ways on the Reel Studio page.
  - Upload one or several videos from the device (button or drag and drop), up to 300 MB each.
  - The videos and parts sent from the whiteboard appear in the same tray. Tick one or more (they stay ticked if you press Back).
  - Under each way's Choose button it says how many ticked reels will open there. An MP4 fits Google Flow and Stock video; a whiteboard part fits Design, Style and Stock video.
- **On each way's page** a "Your raw reel" panel shows the reels that were moved there: watch, download, remove from the page.
  - **Google Flow:** the raw reel plays beside an editable prompt (with Copy and "Back to the made prompt"). The finished video from Google Flow can be dragged onto the page; it is kept in the app (My Google Flow videos) and can be downloaded.
  - **Stock video:** a raw MP4 becomes the video behind the lesson.
  - **Design / Style / Stock:** a raw whiteboard part opens in the editor by itself; Preview & post then saves the reel in My reels and offers Download.
- Tests: `lib/ai-guru/reels/raw-reels.test.ts`.

## V51.9.205 — Upload only Part 1 of a book (for demonstrations and short host time limits)
- **Material Studio now uploads only Part 1 of a textbook by default.** That is the first fifth of the pages, the free
  part.
  - The browser cuts the PDF itself, so the file is about a fifth of the size and is read well inside Netlify's time
    limit.
  - The book is saved as "… (Part 1 of 5).pdf" and all of it is free, so every study material can be made from it.
  - **Upload the whole book** (a tick box under Choose PDF) sends the full PDF as before.
- **Smaller upload pieces:** 1 MB instead of 3 MB.
- The piece route now reports its own errors (for example a file storage problem).
- A 502 or 500 now says "the server stopped with an error", not only "took too long".
- Tests: `lib/ai-guru/material-studio/chunked-upload.test.ts` updated.

## V51.9.204 — Large PDFs upload on Netlify; clear upload errors
- **Fixed: "Unexpected end of JSON input" when uploading a textbook PDF.** Netlify accepts at most about 4.5 MB in one
  request. A bigger PDF was cut off, Netlify answered with an empty page, and the app tried to read that page as data.
- **The fix:** a PDF over 3 MB is now sent in 3 MB pieces (`/api/ai-guru/material-studio/upload-chunk`).
  - The last piece joins them into one file, which is then read exactly like a direct upload.
  - A dropped piece is sent again, up to three times.
  - A joined file that is not a PDF is refused.
- **Clear messages instead of "Unexpected end of JSON input":**
  - "the file is too large for the server in one piece" (413);
  - "the server took too long and stopped (the host allows about 60 seconds)… upload one chapter at a time" (502 or 504);
  - otherwise, the server's own reply code.
- On Google Cloud the direct upload is unchanged. Netlify guide updated.
- Tests: `lib/ai-guru/material-studio/chunked-upload.test.ts`.

## V51.9.203 — Front page back to the V51.9.201 design
- The V51.9.202 redesign is undone at the owner's request. The front page is again the V51.9.201 design: globe, headline,
  how it works, what you get, parents and teachers, Get started after each part, and the Day / Night switch.

## V51.9.201 — Day mode back on the front page
- The **Day / Night switch** (sun and moon) is back in the top-right corner of the front page. It had been taken away
  with the menu bar in V51.9.198, so the front page could only be shown at night.
- The choice is kept on the device and applies to every page. The steps after "Get started" already have the switch in
  their top bar.

## V51.9.200 — Doubts with an OpenRouter key, and a front page that tells the story
- **OpenRouter now clears doubts.** Before, a student with only an OpenRouter key saw "OpenRouter cannot do live talk". Now
  the camera, microphone and typed doubts all work with it. OpenRouter has no live voice, so a doubt goes turn by turn:
  - the student speaks (the browser turns speech into text), types, or shows the camera;
  - the question and a photo of the page go to a free OpenRouter model that can see pictures;
  - the answer appears as it is written, is read aloud, and is followed by a concept picture when one fits;
  - the last few turns are kept, so follow-up questions work;
  - listening pauses while the answer is read aloud.
- OpenRouter is also used when every Gemini key fails, before the on-device fallback.
- "Read this page" (Gemini only) is hidden in OpenRouter mode.
- Fixed: a camera started before the doubt box was on screen showed a black picture.
- **Front page:** "How it works" (three steps), "What you get" (six features), "For parents" and "For teachers and
  schools", and a closing line, with a **Get started** button after each part. Every button on the page is Get started;
  the cards are not links.
- Tests: `lib/ai-guru/doubt/openrouter-doubt.test.ts`.

## V51.9.199 — The API key page: Get key only beside a paste box, one Gemini box
- **"What is an API key?"** no longer has the blue "Get a … key" buttons. It now says: scroll down to **Your Gemini key**,
  press its **Get key**, make the key on Google AI Studio, then come back, paste it and press Save.
- The separate "1 · Open Google AI Studio / Get my free key" box is gone.
- **Get key appears only beside a paste box:** Gemini (in its box), OpenRouter (in its steps) and OpenAI (new, beside its
  box).
- **Students get one Gemini paste box** instead of five. The office still sees the five-key pool.

## V51.9.198 — For students everywhere: English screens and a new "Get started"
- **No Malayalam letters on the screens or in the messages.** The Malayalam half of every bilingual label, button, notice,
  receipt, reminder and message is removed, and language buttons read "Malayalam".
  - Malayalam stays as a **teaching language**: a student who chooses it still gets lessons, voice, quizzes and doubt
    answers in Malayalam.
- **Front page:** only one button, **Get started**. The menu bar, the "Start a class / Upload a textbook / Make my
  account" buttons and the "Animated class / Ask a doubt / Share a reel" tiles are gone. The globe now shows English,
  हिन्दी, Español and العربية.
- **Get started** asks **Student, Teacher or Parent**.
  - **Student** — five steps:
    1. New? Sign up.
    2. Set your API key.
    3. Download your textbook.
    4. Material Studio.
    5. Classroom.
  - **Teacher** — school teacher sign-up, school teacher sign-in, and the class teacher portal.
  - **Parent** — the parent page.
- **Set your API key:** what an API key is, what each one looks like (`AIzaSy…`, `sk-or-v1-…`, `sk-proj-…`), where to get
  it, and what to do.
  - Students see three key slots only: **Gemini, OpenRouter and OpenAI**.
  - Agnes, Sarvam and the voice tools show only to the office.
- **Download your textbook:** official free textbook sites.
  - NCERT (CBSE), ePathshala, DIKSHA, Kerala (KITE Samagra), Tamil Nadu (DIKSHA), Karnataka (KTBS), Maharashtra
    (Balbharati), Andhra Pradesh and Telangana, plus a note for ICSE.
  - **Your syllabus is not here?** A web search for the board, class and subject.
- **Back arrows:** every step has one, and the top bar of every other page has one (back to the page before, or the main
  page).
- The installed app now opens on the front page ("Get started").
- Tests: `lib/ai-guru/start/textbooks.test.ts`; updated `pwa/manifest.test.ts` and `review-fixes-195.test.ts`.

## V51.9.197 — "Download the AI Guru app?" from an invite link
- **Opened from a friend's invite link** (`/j/CODE` or `?ref=CODE`), the sign-up page asks **"Download the AI Guru
  app?"** (English and Malayalam), with **Yes, download** and **Not now**.
- **Yes** puts AI Guru on the home screen **with the AI Guru logo**. It opens full screen, like an app, with no Play
  Store needed.
  - **Android Chrome, Edge, Samsung Internet and computers:** the phone's own "Install" box opens at once.
  - **iPhone / iPad (Safari):** two steps with pictures (Share → Add to Home Screen). Apple does not let a page add
    itself.
  - **Inside WhatsApp's or Instagram's own browser:** **Open in Chrome** first (they cannot add apps), then Yes again.
- **The friend's code goes with the app**, so the invite still counts when they sign up inside it, even on an iPhone.
- **Not now** hides the question on that phone for 7 days. Nothing shows once AI Guru runs as the app.
- New: the app manifest (`/app-manifest`), home-screen icons from the logo (`public/app-icons/`, including a round-safe
  "maskable" one for Android), the iPhone icon, and the app colour.
- Tests: `lib/ai-guru/pwa/manifest.test.ts`.

## V51.9.196 — Security check
A security check using the ECC security-review checklist (report: `docs/reviews/2026-11-03-security/report.md`).
No critical or high problems were found. Fixed:
- **Guessing one account from many addresses:** 20 wrong tries on one student or school-teacher account, from any
  address, lock it for 15 minutes.
- **Forged bank e-mails:** the Gmail script sends only e-mails that Gmail verified as really from HDFC (DMARC / DKIM).
- **Secret headers** with unusual characters are refused (401) instead of crashing (500).
- **HSTS and a content policy** on every page.
- A school teacher's save must name the material's own book.
- Dependencies: hono 4.13.16, @hono/node-server 2.1.6, ip-address 10.7.5 (moderate advisories).
- Tests: `lib/ai-guru/security-196.test.ts`.

## V51.9.195 — Fixes from the review of V51.9.186–194
The Elephant–Goldfish review (`docs/reviews/2026-11-03-today/`) found four blockers and a list of major problems. All are
fixed here.

**Blockers**
- **A school teacher's sign-in no longer opens class-teacher pages.** Progress, attendance, question sets, teacher-dna
  and the paid AI keys accept only a class teacher. A school teacher sees in full only the books of their own subject
  and standards.
- **Students who paid the old way are not locked** when paying by part is switched on. The part plan applies only to
  students who have not paid a bill the old way.
- **The receipt and messages say exactly what opened.** After one part: "Part 2 of every book is open for you now" and
  "Still to pay when you are ready: Parts 3, 4, 5 (₹5,400)". "Balance on this bill" reads "Nil — this bill is paid",
  never "fully paid". The receipt labels are in English and Malayalam, with new "Now open" and "Still to pay" rows. The
  pay panel no longer says "All parts are open".
- **A free doubt that could not start is not counted.** If AI Guru's key cannot make the session, the student's count
  (and the school's) is given back.

**Money**
- **A different amount needs a second yes.** When the bank shows another amount for the UPI reference, Confirm shows
  both amounts and asks again. The bank alert is then marked as settled.
- **Paying all at once cannot half-fail.** If the ₹7,000 price changed, or anything else goes wrong, nothing is saved
  and the part bills stay as they were.
- **One claim per UPI reference**, held under its own lock, so two claims sent at the same moment cannot share one. A
  rejected claim frees the reference.
- **The bank parser is stricter.** It refuses mandates, autopay, collect requests, reversals, refunds and failed
  payments. It never guesses a bare 12-digit number. "Received" counts only when it is about the account.
- **The Gmail script sends in batches of 50.** Each thread is labelled only after its batch arrived, so nothing is
  dropped.
- **School commission** is recorded on every confirmation, and the daily job adds any that were missed (once per
  payment).
- The bank-alert status says "set up" (not "reach AI Guru"), warns when no alert has come yet, and a statement upload
  no longer counts as the last alert.

**One trial, one set of dates**
- With paying by part on, the free doubt trial **is** the part plan's trial: the same days and the same last day.
  Part 2 is due on the last free day (day 7), not day 8.
- Paying no longer ends the free doubts early.
- ⚙ Settings shows this, and the doubt-trial days follow the part plan.
- Material Studio shows the part price **with the school discount**.
- The classroom lock card says "opens when you pay for it" and "Parts 1, 2 are open for you".
- A part with no due date says "pay when you are ready" (not "due .").
- The library marks a paid part "paid ✓", not "free".

**Exams**
- **The clock is kept by the server** from the first time the student opens the exam. Reopening the page does not
  restart it. Handing in after the time (plus 90 seconds' grace) records the attempt as late, with no answers counted.
- **Right answers are shown only after the exam closes**, so the first student cannot pass them on.
- **The office sees every exam and each student's score** on the Schools page.
- When a teacher sets an exam from an MCQ material, they are warned that students can see that material's answers in
  the classroom.

**Office and teachers**
- **Office sign-in at `/ai-guru/admin`**: a signed-out visitor sees the office sign-in form, not the classroom.
- **Registers:** a school's student shows as "Contracted school · St. Joseph's · 10% off", not "Signed up directly ·
  SC126 (no discount)". With paying by part on, the status shows the parts paid.
- My account says "Pay by UPI above…" instead of "go to the school office".
- The class-teacher reward texts no longer offer "free premium months".
- The old Fees, UPI and Enrolment tabs link to ⚙ Settings.
- **Approving a teacher** gives a ready WhatsApp message with their teacher ID.
- **The teachers' record says what changed**: the title, the overview, and which sections were changed, added or
  removed.
- After saving a material, the teacher is told who sees it (for Part 2 and later: students who have paid that part).

**Free doubts**
- **A daily cap for all students together** on AI Guru's key (⚙ Settings, default 200; 0 = no cap). When it is reached,
  students are told to try tomorrow or add their own free key.

- Tests: `lib/ai-guru/review-fixes-195.test.ts`. Tests changed for the new rules: `part-plan-191`, `trial-188`,
  `after-trial-189`.

## V51.9.194 — Fees by part only
- **No monthly or yearly plans.** Fees are paid only by part: one part at a time (₹2,000), or all the paid parts at
  once (₹7,000), with the school discount for a contracted school's students.
  - The office's "Monthly & yearly" tab is gone.
  - ⚙ Settings → "Payment grace days" keeps only the grace days. Saving it clears any old monthly prices.
  - With the part plan on, the pay screen never offers a month or a year, even if old monthly prices are still saved.
- **A locked part asks for the right amount.** It shows the **next part's** fee (not every unpaid part added up) and no
  monthly offer: "the next part opens in every book at once (or pay for all parts together and save)".
- The office can still make a bill by hand on the Fees tab for any other charge.
- Tests: `lib/ai-guru/admin/parts-only-194.test.ts`.

## V51.9.193 — Schools on contract, and their teachers
- **🏫 Schools page for the office** (`/ai-guru/admin/schools`). It keeps a separate record (`data/ai-guru/schools/…`)
  apart from the ordinary students.
  - **Adding a school** (e.g. St. Joseph's School) gives it a **school ID** (`SC-1-26`) and its own terms: the school's
    commission %, the teacher's commission %, and the students' discount %, each taken from every fee its students pay.
    Default terms are in ⚙ Settings → Schools.
  - **For each school** it lists the teachers (approve, switch off, new password; students, exams and edits for each),
    the students, and the **commission account**: every fee with the school's and the teacher's share and payout day,
    and "paid" for the school and for each teacher.
  - **Teachers' activity:** every sign-up, approval, material made, edited or removed, and exam set, filtered by
    teacher.
- **Teacher sign-up** (`/ai-guru/school-teacher/join`). A teacher signs up with the school ID, their subject and
  standards (e.g. James, Physics, Std 8–10). They get a **teacher ID** (`TS-1-26`) at once and can sign in once the
  office approves. Their power covers **that subject and those standards only**, in the school's syllabus.
- **School teacher portal** (`/ai-guru/school-teacher`, also in Portals):
  - **Study materials:** every AI material of their books, opened in full.
    - **Edit** makes the **school's own version**: their students see it **instead of** the AI one, other schools keep
      the AI one, and the AI one is never changed.
    - **＋ New** adds a material to a part.
    - They can edit or remove their own versions.
  - **Exams:** questions come from an MCQ material and can be corrected or left out. The teacher chooses one of their
    standards, opening and closing dates and a time limit, then sees each student's score.
  - **Students:** their school's students in their standards.
  - **My record:** what the office sees about them.
- **Students of a school** join with the **school ID or the teacher's ID** in the code box at sign-up; the school's
  name is filled in. They are linked to the school and the teacher.
  - They get the school's discount on the part fees (₹2,000 → ₹1,800 at 10%; ₹7,000 → ₹6,300).
  - Each fee they pay adds the school's and the teacher's commission to the schools account.
  - They see their teachers' versions of the study materials, and their exams under "📝 Exams from your teachers" on
    My account: one go, a timer, then the score and the right answers.
  - They still have their own invite link, make reels and earn the ordinary commission, exactly as before.
- Teacher versions never count as the shared materials, so the AI ones are still made for everyone else.
- Tests: `lib/ai-guru/schools/schools-193.test.ts`; `nav.test.ts` is updated (16 menu items).

## V51.9.192 — Pay to open, and study materials made for paid parts
- **No instalment schedule.** Part 2 is still due the day the free trial ends, with reminders and grace days. Parts 3–5
  have **no due date**: no reminders and no lock beyond the part itself. The student pays when ready to go on, and the
  part opens at once. The "Days between instalments" setting is gone.
- **An unpaid part cannot be used to make study materials**, not even with the student's own AI key and not for their
  own upload.
  - **Material Studio:** unpaid parts show 🔒 "Pay ₹2,000 to open this part" and cannot be ticked. Tapping one shows
    "Part 3 opens when its fee (₹2,000) is paid" with a 💳 Pay now button.
  - **The server:** it refuses to save such a material (402 with the same message). The book sent to the student says
    which parts are closed for making materials (`access.createLocked`) and the price of a part.
  - **Not limited:** the office, and students who have paid every part.
- **Paying a part makes its study materials.** When a part is paid (by UPI or at the counter, one part or all at once),
  every missing study-material type for that part is made on AI Guru's cloud with the school key. This covers each of
  the student's books: the books in My books, their own uploads, and the books of their syllabus and standard. The
  materials are saved in the shared library, ready for the next student of the class too. The student gets "📚 Part 3 is
  open in all your books! … being made for you now"; tapping it opens My books. Materials a student makes with their
  own key also go to the shared library, as before.
- Tests: `lib/ai-guru/admin/pay-to-open-192.test.ts`; `part-plan-191.test.ts` is updated.

## V51.9.191 — Pay by part
- **The plan.** It is set in ⚙ Settings → Free trial & part fees; turning it on also turns the lock on.
  - Part 1 of every book is free (the trial).
  - Each next part costs **₹2,000**: Parts 2–5 come to ₹8,000 by instalments.
  - Paid **all at once, before any part is paid**, Parts 2–5 cost **₹7,000**.
  - All four numbers can be changed: the part price, the all-at-once price, the free trial days (7) and the days
    between instalments (30). The all-at-once price is never allowed above the instalment total.
- **Bills and due dates.** Each new student (and each student who has paid nothing yet) gets a bill for every paid
  part.
  - **Part 2** is due **the day the free trial ends**: joining day = day 1, so a 7-day trial means due on day 8.
  - **Parts 3, 4 and 5** are due 30, 60 and 90 days later.
  - The bills are made at sign-up, when the plan is switched on, when a student opens My account or Pay, and in the
    daily run.
  - The usual "due soon", "due today", grace-day and "grace period is over" reminders apply.
- **Paying opens the part in every book.**
  - Paying Part 2 opens Part 2 of every textbook at once, then Part 3 is next.
  - Parts open in order: the pay screen offers only the next part, plus "Parts 2–5 (all at once) — save ₹1,000" until
    the first part is paid.
  - Paid parts stay open. An unpaid instalment keeps only the next part locked.
  - Paying the ₹7,000 replaces the four part bills with one bill and opens Parts 2–5.
  - It works by UPI (automatic confirmation from the bank, and the 🎉 receipt) and at the counter. The office's payment
    box has "Instead: all remaining parts at once".
  - A free seat from the office, or a centre's pilot, still opens everything.
- **The student sees their parts.** My account shows "📚 Your parts": Part 1 free ✓, paid parts open ✓, the next part
  with its amount and due date, the free-trial end, and the all-at-once offer with the saving.
- How it works inside: `lib/ai-guru/admin/part-plan.ts`. Per-student paid parts are passed through the content access
  (`Entitlement.paidParts` → `lockedPartsOf(…, paidParts)`) to the book, page, PDF, figure, material and library routes.
- Tests: `lib/ai-guru/admin/part-plan-191.test.ts`; `enrolment.test.ts` is updated.

## V51.9.190 — UPI payments confirmed automatically, with a receipt
- **AI Guru transaction ID.** Each payment choice gets one (`AGT-261103-Q8QBA`). It is shown with the QR and written in
  the UPI note (`AI Guru AGT-… ST-12-26`), so the payer's app and the school's bank both carry it. The money goes
  straight to the school's UPI ID (⚙ Settings → UPI).
- **Confirmed automatically from the bank.** The family types the 12-digit UPI reference their app shows. AI Guru
  confirms the payment by itself when the bank's own record of the credit has the same UPI reference **and** the same
  amount. Either can arrive first. A different amount is never confirmed, and the office sees "The bank shows ₹70 …".
  The bank's record can come from:
  - **an e-mail alert:** `scripts/payments/gmail-bank-alerts.gs` runs in the school's Gmail every 5 minutes and sends
    HDFC "credited" alerts to `POST /api/ai-guru/payments/bank-alert`. The door is protected by
    `AI_GURU_BANK_ALERT_SECRET`, which `scripts/cloud/setup-bank-alerts.sh` sets up (docs step 11).
  - **an SMS forwarder:** the same door, sending `{ text, source: "sms" }`.
  - **a bank statement:** a CSV upload on the Fees page (HDFC NetBanking format: Narration, Ref No, Deposit Amt).

  The bank texts are read by AI Guru's own parser in `lib/ai-guru/payments/bank-alert.ts`, with no code taken from
  other payment projects. Each UPI reference is kept once. "Confirm automatically" can be switched off in ⚙ Settings →
  UPI or on the Fees page; matches then wait for the office.
- **UPI on the office's Fees page.** A "💳 UPI payments" panel sits above the payments list, and the UPI tab uses the
  same panel. It shows:
  - whether bank alerts reach AI Guru, and the last one;
  - payments waiting, with Confirm and Not found;
  - payments confirmed lately, and by whom (bank alert, statement or office);
  - bank credits to look at: a different amount, or no family claim yet;
  - the statement upload.

  The payments list has a "Transaction ID · UPI ref" column, and the CSV export adds Transaction ID, UPI reference and
  Confirmed by.
- **"🎉 Congratulations" with a receipt in Messages.** After every recorded payment (UPI confirmed by the bank or the
  office, or paid at the counter) the student gets: "🎉 Congratulations, Arjun! Your payment of ₹900 for 'Term 2' is
  successful. All five parts of every book are open for you now — happy learning! 📚", in English and Malayalam. A
  receipt card comes with it, showing:
  - the amount;
  - receipt number, AI Guru transaction ID and UPI reference (UTR);
  - date, student and Student ID, standard;
  - what it paid for, the payment mode, who it was paid to;
  - bill total and balance;
  - who confirmed it.

  "🖨 Print / save as PDF" opens a printable receipt with the same details. Each payment's receipt is sent once.
- **On the student's side:** the pay panel shows the transaction ID. After paying, a payment the bank has already
  confirmed shows "🎉 Congratulations! Payment confirmed" at once; otherwise it says it will be confirmed when the bank
  tells the school.
- Tests: `lib/ai-guru/payments/upi-auto-190.test.ts`; `pipeline-183.test.ts` is updated for the transaction ID in the
  UPI note.

## V51.9.189 — ⚙ Settings, and doubts that always work (within limits)
- **⚙ Settings (`/ai-guru/admin/settings`).** Every office setting is on one page, in ten sections, and each section
  saves on its own through the same address as before, so the same checks apply:
  - school name and address, and whether a coupon is needed to sign up;
  - the free trial: free parts and locking the paid parts;
  - free doubt clearing;
  - the AI key, making the free part on upload, and checking students' work;
  - fees: monthly fee per standard, yearly reduction and grace days;
  - referral commission: on or off, commission %, friend's discount and payout day;
  - class & centre groups: discount and teacher rewards;
  - UPI ID and payee name;
  - daily reminders: status only;
  - the office password.

  There is a "⚙ Settings" button in the office header and in the admin menu. `GET /api/ai-guru/admin/all-settings`
  reads everything at once, with the AI key masked.
- **Doubts without a key always work, within limits.** After the trial, and for enrolled students without a key, there
  is now a smaller allowance on the app key. The office sets it: sessions a day and minutes a session (default 1 a day,
  5 minutes; 0 = own key only). The trial allowance (days, sessions a day, minutes) is unchanged. A student's own key is
  always used first and has no limits.
- **Notifications while the app is open.** Each time a student without a key uses doubt clearing, a notification pops
  up at the top of the screen. It says "Free doubt on AI Guru's key · up to 5 min · 0 of 1 left today. Tap to add your
  own free Gemini key and ask without limits", and tapping it opens Settings → Your AI keys. A warning version appears
  when today's free doubts are used, when a free session ends, or when there is no key and no allowance. The reminder
  card and the Messages reminders now mention the after-trial allowance.
- Tests: `lib/ai-guru/doubt/after-trial-189.test.ts`; `trial-188.test.ts` is updated.

## V51.9.188 — Free doubts in the trial, then the student's own key
- **Free doubt clearing in the trial, with limits.** The office sets three numbers in Study materials → Cloud settings:
  trial days from joining, sessions a day, and minutes a session (default 7 days, 5 a day, 10 minutes). Inside them, a
  signed-in student who is not yet enrolled can ask doubts by camera, voice or typing on the app key, even without a key
  of their own. Each session gets a one-use pass from the server that ends after its minutes, and the app key never
  reaches the browser. The pane shows "🎓 Free trial doubt · up to 10 min · 4 more today · trial until …".
- **Otherwise, the student's own key.** A student's own key is always used first when they have one. After the trial,
  and once a student is enrolled, doubts use only their own key. The app key still makes the common study materials.
- **"🔑 Add your free Gemini key" reminders that open Settings.**
  - **In Messages:** the office sends a welcome at sign-up, explaining the free trial and how to get a key. It writes
    again on the last trial day, the day after the trial ends, and then once a week. An enrolled student gets one
    message saying doubts now use their own key. Tapping one of these messages, or its button, opens Settings → Your AI
    keys. They are sent by the daily job and when the student opens My account.
  - **On screen:** a card in the classroom and on My account shows what the trial still gives and opens Settings when
    tapped. "Later" hides it until tomorrow.
  - **In the doubt pane:** when the trial is over, or today's free sessions are used, it shows a "🔑 Add my free Gemini
    key" button.
  - **When they stop:** once the student's browser has their own key, the reminders stop. The app records only that a
    key exists, never the key.
- **Settings → Your AI keys** shows three steps when no key is saved: open Google AI Studio ("Get my free key ↗"),
  press "Create API key", and paste it here. The steps are in English and Malayalam.
- Messages can now carry an action (`Message.action`), which the chat shows as a tappable message with a button.
- Tests: `lib/ai-guru/doubt/trial-188.test.ts`.

## V51.9.187 — The library, and whose AI key
- **Sign-in opens "Download your study materials" until a textbook is downloaded.** The sign-up form already asks for
  syllabus, medium and standard, and the library lists the books that match them. The student checks the first four
  pages, then downloads books one by one. After sign-up, "📥 Download my textbooks" is now the first button.
- **The classroom shelf is the student's own downloaded books.** Click one to start the class. A signed-in student with
  no book yet sees "📥 Download your textbooks first". "📥 More books" goes back to the library. A book downloaded
  before any material was made for it still appears, and is taught from its text. The office and visitors still see
  every ready book.
- **Study materials sit above the textbook page and the whiteboard.** Notes, slides, MCQ, worksheet, flashcards and the
  rest are a row at the top of the classroom.
- **Students make study materials with their own free Gemini key only.** The library shows two steps: "1 · Add your
  own free Gemini key" and "2 · Make the study materials". The school cloud key is now only for the office (making
  materials, and the free part on upload). The old "Students may create on the cloud" switch is gone.
- **Whose key, in one rule.** The school (cloud) key makes only the common syllabus study materials: the office's
  uploads, and each book's free part made on upload. Students use their own free Gemini key for everything else, which
  means making study materials and clearing doubts by camera, voice or typing. Cloud settings says so.
- **What a student makes is shared.** Materials a signed-in student makes with their own key are saved in the shared
  library, so others of the same syllabus and standard can download them, and the student's name is never shown. With
  "Check students' books and materials before others see them" on, they wait for the office to show them. This was
  already how it worked; it is unchanged.
- Tests: `lib/ai-guru/library/library-187.test.ts`; the library tests are updated for own-key-only creation.

## V51.9.186 — A reminder every day of the grace period
- **Every day of the grace period.** From the day after the due date to the last grace day, the student gets one
  reminder a day in Messages: "⏳ Arjun, grace period day 2 of 5: ₹900 for “Term 2” was due on 2026-11-10. 3 days
  left — please pay by 2026-11-15 to keep Parts 2–5 open." The last day says "Last day". The day after grace ends,
  "Your grace period is over, please make payment to continue" is sent once, and the daily reminders stop. "Due soon"
  and "due today" are still sent once each. Paying, or extra days from the office, stops them at once.
- **Never twice a day.** Each day's reminder has its own key, so opening pages or running the job again the same day
  sends nothing more.
- **A daily job on Google Cloud.** `POST /api/ai-guru/cron/fee-reminders` runs the reminders for every student. It
  only answers when the server has `AI_GURU_CRON_SECRET` (16+ characters) and the caller sends it in `x-cron-secret`.
  `scripts/cloud/setup-daily-reminders.sh` sets up Cloud Scheduler (09:00 Asia/Kolkata by default, `REMINDER_TIME` to
  change it), keeps the secret in Secret Manager and runs the job once to check it. `setup-google-cloud.sh` now calls
  it too. See docs step 10.
- **"⏰ Fees due"** shows when the daily job last ran and how many reminders it sent, or that it is not set up yet.
- Tests: `lib/ai-guru/messages/daily-186.test.ts`.

## V51.9.185 — When a fee is not paid
- **One rule for every bill.** It applies whether the bill is by term or by month / year:
  - **soon:** a bill due within 3 days gets a reminder;
  - **today:** due today;
  - **grace:** past its due date but within the grace days (5 by default, set in "Monthly & yearly"); Parts 2–5 stay
    open;
  - **over:** after the grace days, Parts 2–5 lock again. Part 1, progress, quizzes and the Student ID are kept, and
    paying opens everything again at once.

  Term bills used to stay open for good after the first payment; they now follow the same rule. A bill made without a
  due date falls due 30 days after it was made (`lib/ai-guru/admin/dues.ts`).
- **The banner.** In the classroom and on "My account", a signed-in student sees **"Your grace period is over, please
  make payment to continue."** (red, with the amount and due date, in English and Malayalam, and "💳 Pay by UPI").
  Earlier stages show a gentler reminder. The locked-part notice in the classroom uses the same words.
- **Reminders in Messages.** The AI Guru office's thread in the student's Messages gets a reminder at each stage: due
  soon, due today, in grace and grace over. Each is sent once per bill and stage. They are sent when the student opens
  their account and when the office opens "Fees due".
- **Messages to the referrer.**
  - When someone joins with a student's link: "🎉 Congratulations, Anjali! Arjun Nair (Std 7, GHSS Aluva) joined AI
    Guru with your link …", with how many friends have joined.
  - When that friend pays (at the counter or by UPI): "💰 … you gained ₹90 commission", with when it is paid (or
    "ready to collect now"), the total gained, the amount waiting and the amount already paid.
- **"⏰ Fees due"**, a fifth page in Students management with the same country, state, district, school and teacher
  filters. It lists every student who owes money, worst first: grace over (locked), in grace, today, soon. It shows
  the amount, due date, grace end, days overdue and the bills, and marks "inactive" after 60 days overdue. Per
  student:
  - **📩 Remind** sends the reminder to their Messages now;
  - **WhatsApp** opens a ready message to the parent's number;
  - **Extra days** keeps Parts 2–5 open until a date (up to 3 months), and **Undo** takes them back;
  - **Record payment** opens the Fees tab.

  Also in the Admin ▾ menu.
- **Teachers** see a small "fee pending" mark beside a student in their class list. They never see an amount.

## V51.9.184 — Students management: four registers for the school office
- **Four pages** under "📋 Students management" (on the office page and in the Admin ▾ menu), each with dropdowns
  Country → State → District → School and Teacher (each narrows the next), a search box (name, Student ID, phone,
  e-mail) and a CSV download of what is shown:
  1. **Students** (`/ai-guru/admin/students`): Student ID, name, class, joining date, country, state, district, place,
     school, phone / WhatsApp (tap to open WhatsApp), e-mail, mother tongue, the coupon or class code joined with,
     and the teacher.
  2. **Activities** (`/ai-guru/admin/activities`): trial started, enrolled on, study materials downloaded (date ·
     book), study materials created (date · type · title), attendance (each date and time the app was used, with
     minutes), last active and total time.
  3. **Fees** (`/ai-guru/admin/fees`): every payment, newest first — Student ID, name, payment date, amount, mode,
     receipt, what it was for, the coupon code joined with — and the total.
  4. **Affiliate** (`/ai-guru/admin/affiliate`): each student who brought others in — the students joined under them,
     each one's payments and the commission on each, commission pending for the next payout day (the 4th) and the
     earlier months' payouts.
- **Sign-up collects the rest of the raw record.** Country (India, the Gulf countries and others; outside India the
  state and district are typed), mother tongue (Malayalam, Tamil, Kannada, Telugu, Hindi, English and others),
  e-mail (optional), and "Phone / WhatsApp" for the parent's number. The office's student edit keeps these.
- **Safe spreadsheets.** A name or school typed as a formula (=, +, -, @) stays plain text in the CSV.
- Code: `lib/ai-guru/admin/registers.ts` (pure), `GET /api/ai-guru/admin/registers?sheet=…`,
  `components/ai-guru/admin/RegisterPage.tsx`. The office's existing tabs (adding students, recording payments,
  payouts) are unchanged; the registers are for looking, sorting and exporting.

## V51.9.183 — From a friend's link to a paid class
- **Pay the fee by UPI.**
  - **Office set-up:** the school sets its UPI ID once (new office tab "💳 UPI payments").
  - **The family pays:** on "My account", or from a locked part in the classroom ("💳 Pay by UPI"), the family sees
    the amount (a bill, or one month / 12 months from the school's monthly fees, with any friend's or class
    discount). They get a UPI QR code and an "Open UPI app" button, with the amount and the note "AI Guru <Student ID>
    <name>" filled in.
  - **Telling the office:** after paying, they type the 12-digit UPI reference (UTR).
  - **The office checks:** the tab shows "UPI payments (n to check)". The office finds the reference in its
    statement, then presses **Confirm** or **Not found** (with a reason the family sees).
  - **Confirm** records the payment like a counter payment: receipt, the referrer's commission, and enrolment, so
    Parts 2–5 open. A month or year chosen by the family becomes its plan record and bill.
  - The money goes straight to the school's UPI account; no payment company is involved.
  - Shared code: `lib/ai-guru/payments/upi.ts`, `student-portal/pay`, `admin/upi`. Recording a payment and making a
    plan record are now shared library code (`record-payment.ts`, `plan-records.ts`), used by the Fees tab, the plans
    and UPI.
- **A complete free Part 1 for every subject.**
  - When the office uploads a textbook, every study-material type for its free part(s) is made at once on the cloud
    key: whiteboard notes, PPT, MCQ, Q&A, revision notes, flashcards, worksheet, question paper, mind map, knowledge
    base, problems & formulae. Material Studio says so.
  - A switch in Study materials → Cloud settings turns it off.
  - The classroom now opens a ready textbook of the student's own standard (its free Part 1 is open to all, and the
    classroom's reels can be made from it), instead of the quadratic-equations sample. The sample stays only while the
    school has no ready textbook.
- **"Invite your friends" for children.**
  - "Refer & earn" on a student's page is now "🤝 Invite your friends", in English and Malayalam: the link, the
    friend's discount and how many friends have joined.
  - The money part (commission, payouts, each payment) is folded under "For parents: Refer & earn rewards".
- **Checked end to end:** an API test (referral code → sign-up → free trial → UPI claim → wrong / duplicate reference
  refused → the office confirms → receipt, enrolment, ₹45 commission → a second claim rejected with a reason →
  office upload queues 11 materials for Part 1), and a phone walk-through of the same path with the office confirming
  in its tab.

## V51.9.182 — The newcomer journey (fixes from the Elephant–Goldfish newcomer review)
See `docs/reviews/2026-11-02-newcomer/`.
- **Student ID screen.** After sign-up the student sees their Student ID in large type, in English and Malayalam, with
  "Send the ID to my parent on WhatsApp", the class and teacher they joined, and "I have written down my Student ID"
  before going on to the class. The browser is offered the ID and password to remember. "My account" shows the ID
  large too.
- **No more class-wide lockouts.** Wrong passwords lock that account from that address (5 tries), and the address as a
  whole only at 60, so a class on one school Wi-Fi no longer locks itself out. Only failed sign-ups count. The header
  sign-in box tries the student sign-in first and never sends a Student ID to the admin sign-in. Lock messages say
  "15 minutes", in English and Malayalam.
- **Signed in means it shows.** The header shows the student's name, Student ID, My account, My class, Teachers Notes
  and Sign out (it said "Sign in" all the time). The header box links to "Forgot your password or Student ID?".
- **Class codes.** The box is "Class code from your teacher". A teacher's invite says "Lekha Teacher invited you to
  Std 7 Maths A" (not "a friend"), the code check names the teacher, and a stopped class is said plainly. A student
  can join a class after signing up (`POST /api/ai-guru/student-portal/join`, a box on "My account" and on Teachers
  Notes), and an invite link opened while signed in joins instead of showing sign-up. The classroom header shows
  "🏫 Std 7 Maths A · Lekha Teacher".
- **Help when the ID is lost.** Sign-up asks for the parent's mobile (optional). "I forgot my Student ID too" asks the
  office with full name, standard and school (one exact match only). The office's Students tab shows how many are
  waiting. Two children with the same name, standard and school get "Is this you?" instead of a refusal.
- **Malayalam.** Every label, button and message on sign-up, sign-in, forgot password, the Student ID screen, the join
  box and the front page's new "New student?" panel. The classroom opens in Malayalam for Malayalam-medium students.
- **One child per phone.** Sign-in and sign-up tie the phone to the account at once, and quizzes done before signing
  in move to the account (only random visitor ids, never another account's). Sign-out unties the phone: the next
  child starts as a new visitor, and the sign-up form is not pre-filled with the last child's details.
- **After the Goldfish re-check.** The "add a free Gemini key" note no longer sits over the whiteboard (only after a
  camera / mic doubt is tried); teacher-only footer buttons are behind Teacher tools; a student in a class is not asked
  to upload books; "Teach in" reads in the order taught (മലയാളം + English); full Malayalam in forgot-password, which
  also accepts the parent's mobile without the ID; the wrong-password message warns about the 15-minute wait; the
  header updates at once after sign-up; sign-out says so; the class panel sits above fees and "Join a class" is in the
  header menu; joining another standard's class shows a note; the front page welcomes a signed-in student back.
- **Smaller fixes.** Passwords are 6–30 characters on both sign-up and sign-in (31–60 were accepted but could never
  sign in). Invite links keep the address they were opened on. "Go to a class without an account" opens the classroom.
  The sign-up card uses the full width on phones. The sample lesson is "Sample lesson — Quadratic equations".

## V51.9.181 — The rest of the UX review (items 5–10)
- **Material Studio in three steps (item 5).** 1 · About the textbook (the five questions), 2 · Choose the textbook PDF
  (a large button right under the questions; it says "answer step 1 first" until they are answered), 3 · **Start a
  class with this book**, a large button when the book is ready, which opens it in the classroom. The greyed-out
  "Choose PDF" at the top of the page is gone, and the cloud and private-book notices moved under the page title.
- **One slim classroom bar (item 6).** Under the site menu there is one thin bar: the page name, the teaching language,
  the quiz and the reward counts.
- **Phones (item 7).** Under 640 px wide, buttons, selects, chip links and text fields are at least 44 px tall (icon
  buttons 44 px wide), sliders have a taller grip, and text set below 12 px shows at 12 px. On the 32 audited pages:
  controls under 32 px went from 249 to 18 (the rest are checkboxes and links inside sentences), text under 12 px from
  367 to 0, and no page scrolls sideways. A part can opt out with `.ag-size-as-drawn`.
- **Accessibility (item 8).** Labels for the reel position slider and the Google Flow prompt; the speed and other
  player controls get real names; darker violet, cyan and orange where text was too faint; headings on Teachers Notes
  and the 3D Lab in order; `<main>` on Messages and Maths, and no `<main>` inside `<main>` on the whole-textbook view.
  axe-core finds 0 problems on the 32 pages (it found 82 in V51.9.179).
- **No needless requests (item 9).** A readable cookie, `aig_hint`, kept by `proxy.ts`, says which sign-ins this
  browser has (never their contents). Page code checks it before asking the server about admin, student or teacher
  data, so a visitor no longer gets a 404 from `/api/ai-guru/admin/session` on every page or 401s from the student
  portal. The server still checks the real cookie every time. An empty `public/ai-guru/intros/manifest.json` is
  shipped, and a missing one is let go at once; the whole-textbook page now settles in about 3 seconds (it never did).
  Chilanka loads only from the app (the extra Google Fonts copy is gone). Errors in the browser console over the 128
  audited page views: 320 → 28; the student, library and subscribers pages were fixed after that run, and what is left
  is the voice server being offline in the test.
- **Night mode on Pictures and Credits (item 10).** These pages now turn dark in Night like the rest of the app; the
  picture cards, the colourful header and the picture window stay as drawn (`.ag-light-page`, `.ag-keep-light`).

## V51.9.180 — Classroom fixes from the hands-on UX review (items 1–4)
- **The lesson is in view on a phone.** The whiteboard now comes first and the textbook page follows it. When the class
  starts and the board is off screen, the page scrolls to it.
- **Nothing floats on top of anything else.** The quiz button and the toffee and chilli counts moved into the classroom
  header, as one quiz button and one small pill. "Ask AI a doubt" moved into the whiteboard's own bar; it used to sit in
  the board's corner, under the camera/mic pane and the key reminder. On a phone the Play button sits above the whole
  camera/mic pane, its notes included. The lesson board's Close button is in its control row, not on top of
  "Regenerate". The page leaves room at the bottom so the last controls can be scrolled clear of the floating ones.
  While a quiz is open the counts also float above it, so each toffee still has somewhere to land.
- **Plain words for students.** "3B1B Teacher", "CLASS STOPPED", "idle", "MathLikeAnim-rs WASM ready", "Index", "Show
  Log", "Auto-created from the RAG source", "NEXUS LINK · OFFLINE", "AI BYOK Settings", "Back to RAG Classroom",
  "Settings · Gemini BYOK" and the maths page's "V49 · OpenMAIC whiteboard runtime" are gone. In their place: "Not
  started / Class is on / Paused / Finished", "Whiteboard ready", "Contents", "Made from your textbook", "Doubt helper ·
  OFF", "Your AI keys", "Maths, step by step".
- **Teacher tools.** The engine status, the teaching log, the QA check and (on the whole-textbook page) the learned
  templates with Export/Import and the AI sketch review sit behind a "Teacher tools" switch, off at first and remembered
  on the device.
- **Only true things on screen.** The sample profile "Arjun · Class 9", the notification badge, the search box, the second
  theme switch, the "00:00 / 08:24" timer and the dead Notes/Bookmarks tabs did nothing and are removed. The
  language button in the classroom header now changes the teaching language. When a book of this browser's own is open,
  the shelf shows it ("Open now") instead of "No textbook is ready yet". Material Studio asks the server whether the
  visitor is signed in (`/api/ai-guru/material-studio/whoami`, which returns only the kind) and says in one sentence,
  under the page title, where their book will go.
- **Also.** The classroom has an `<h1>`; the maths question box has a label; the camera/mic key reminder links to
  Settings.

## V51.9.179 — Large textbooks, unused code removed, documentation tidied
- **Large textbooks (EGM review M7).** On Google Cloud, Material Studio sends a PDF over 8 MB straight to the private
  bucket with a 15-minute signed link, so books up to 200 MB (`AI_GURU_MAX_PDF_MB`) work despite Cloud Run's 32 MB
  request limit. The server moves the file into place inside storage, fingerprints it as a stream, and reads it into
  memory only if a page needs OCR.
- **PDF memory.** Full-access PDF downloads are streamed. Page images, figures, page repair, OCR and redaction run at
  most 2 at a time per server copy, with a 150 MB cache of recently used books. Re-reading one page no longer uploads
  the whole PDF again.
- **Unused code removed (M8, M9).** 368 files that no page, API route, script or test could reach are deleted: the old
  workbench, scene renderers, editor, stage, `lib/server`, the media and document libraries, `ThreeB1BTeachingBoard`
  with its manim-web canvas, and two scratch scripts. 91 npm packages used only by that code are removed. A type check
  of every remaining file now finds 0 errors (it found 1,242 before).
- **Documentation tidied (M10).** The 61 release notes in the repository root and 30 in `docs/` moved to
  `docs/archive/releases/`. `docs/README.md` lists every document and says which are current.

## V51.9.178 — Every student, invoice and quiz result is its own record
- **School records.** Students, invoices, coupons, classes, payouts, the yearly and monthly registers and PIN requests
  are now one record each. The settings and counters are one small record. A change writes only what changed, in one
  transaction (PostgreSQL). With 2,000 students and 4,000 invoices: reading the school takes about 60 ms, and changing
  one invoice about 110 ms writes one record instead of the whole school.
- **No more dropped history.** Quiz results and attendance visits are one record each. The old caps (5,000 quiz results
  and 20,000 visits) are gone, and the student page reads only that student's results.
- **Moving old data.** Old single-file data (`records.json`, `progress/sessions.json`, `attendance/sessions.json`) is
  moved into records the first time it is used and kept as `*.migrated.json`.
- **Storage.** New `transaction()` (several changes, all or nothing) and `snapshot()` (a consistent read that does not
  block writers). NUL characters are stripped from strings themselves (review item N1).

## V51.9.177 — Study-material jobs and database connections fit Google Cloud; README rewritten
- **Shared jobs.** Study-material jobs ("make on the AI Guru cloud") are saved records, shared by every copy of the app.
  A job is claimed once and writes a heartbeat. If its server copy stops, another copy restarts it once; after two
  stops it ends with a clear message. Finished jobs are removed after 7 days.
- **Cloud Run settings.** The CPU stays on after a reply (`--no-cpu-throttling`), so background work keeps going.
- **Cloud jobs fixed.** "Make on the AI Guru cloud" never worked on a live server: the material pipeline called a
  browser-only module (`byok-providers.ts`). On the server it now calls Gemini directly with the job's key
  (`lib/ai-guru/generation/gemini-text-server.ts`); Material Studio in the browser is unchanged.
- **Database connections.** 3 per server copy (5 copies = 15, under the smallest Cloud SQL limit of about 25). A request
  waits at most 10 s for a connection, then fails clearly.
- **Documentation.** The README is rewritten for the app as it is today. `TTS-SETUP.md` has the real voice order. The
  EGM review reports are in `docs/reviews/2026-11-02-egm/`.

## V51.9.176 — Security and data-safety fixes from the EGM review
- **Addresses.** The visitor's address can no longer be faked on Google Cloud, so the lockout and request limits hold.
- **Server keys.** The server's paid keys (Gemini, Sarvam, OpenAI, Google Cloud TTS) are used only for signed-in users
  on a live site.
- **Saved records.** A file-read error or a damaged file stops a change instead of saving an empty record over the
  real one.
- **Admin sign-in.** A live site accepts only the `ADMIN_*` sign-in. Copied laptop sign-ins (`xxx / yyy`) are ignored.

## V51.9.175 — Free hosting on Netlify (Neon PostgreSQL + Netlify Blobs)

## V51.9.174 — Google Cloud Build fix (faiss is optional, no mathsteps import)

## V51.9.173 — Google Cloud Run + PostgreSQL + Cloud Storage; security fixes

## V51.9.172 — Book and material ids can no longer read or write files outside the store

## V51.9.171 — A floating Play button that is easy to find
- The class's main Play button now floats beside the camera / mic pane as soon as the classroom opens (above it on a phone), instead of only in the bar at the bottom of the page. It is a big marigold button that says what it will do: Start class (with a gentle pulse and the lesson's name), Pause while the class is on, Continue when paused, Play again at the end.
- Drag it (the dotted grip or the button itself) to any part of the screen; the place is kept on this device, and the ↺ button puts it back beside the camera / mic. Keyboard: Tab to it, Enter / Space to press, Alt + arrow keys to move it.
- It drives the same class as the bar's ▶ (which stays): Start runs the lesson from the page you are looking at; Pause and Continue pause and carry on the whiteboard.

## V51.9.170 — Only the tabs students need
- Main menu: 15 tabs instead of 17. Whiteboard Lab (an older maths test page; the classroom teaches every problem now) and Local TTS (one click from Settings, which now says "AI keys and teacher voices") left the menu. Both pages still work from their links.
- Classroom: its second side menu is gone. It repeated the main menu, 11 of its 12 tabs (Flashcards, Profile, Subscription …) led nowhere, and its panel showed made-up numbers ("Study Today 2h 15m", "Model: Gemma 4", "Sync Complete"). The lesson now uses the full width.

## V51.9.169 — Day & Night themes, a new menu and front page, every page restyled
- Day / Night on every page: a sun–moon switch in the menu bar, remembered on this device and applied before the page draws (no flash). Night is the AI Guru navy with a soft glow; Day is light sky-blue. One stylesheet does it for all pages (app/ai-guru-theme.css, made by scripts/make-theme-css.py): Tailwind's colours are mirrored for Day (50↔950 … 400↔600, white↔navy) and the hand-picked dark colours become light surfaces, so every page keeps its own colours and nothing in the pages' logic changed.
- New menu bar: the 17 tabs are grouped — Learn (Classroom, Ask my paper, Quizzes & Exams, Whiteboard Lab, 3D Lab, Pictures), Create (Material Studio, Reel Studio, Teachers Notes, Subscribers), Portals (Progress, Teacher, Parent, Settings, Local TTS) — each with a short line saying what it is; plus My Textbooks, Messages, the theme switch and Sign in. On a phone it opens as a full sheet. The group of the page you are on is lit.
- New front page at / (it used to jump straight to the classroom): a rotating dotted globe on a see-through background (continents from the app's own Natural Earth coastlines), the headline, Start a class / Upload a textbook, and Student / Teacher / Parent.
- Easier to read: faint grey text is brighter; English text uses Noto Sans and headings Sora (Malayalam keeps Noto Sans Malayalam / Chilanka). The fonts are hosted with the app (public/fonts/ag, SIL Open Font License) so they work offline.
- Kept as they are: the textbook page in the classroom and the Pictures gallery stay light; camera and video previews stay dark.

## V51.9.168 — Netlify build fixed (TypeScript errors)
- The production build stopped on a type error in app/api/ai-guru/material-studio/index/route.ts (`pages.map(p => …)`: p implicitly any). The uploaded page list is now typed and cleaned.
- 31 more older type errors that would have stopped the build next were fixed without changing behaviour: video lesson route (language type), material-studio OCR (Buffer → Blob), 3B1B board (missing palette colour, unreachable 'plot' check), manim-web renderer (grid range fields, matrix morph field, NumberPlane options, Tex/Shape transforms), lesson planner and template selector (lesson grammar casts, two regexes without the ES2018 `s` flag, typed equation lists), to-visual-actions (token-move start time), teaching strategy (template list cast).
- tsconfig.json: test files (*.test.ts, *.test.tsx, __tests__) are left out of the production type check; vitest still runs them as before.
- `tsc --noEmit` over the whole project now reports 0 errors.

## V51.9.167 — Teach in English only, Malayalam only, or both
- The class board's top line has a new "Teach in" choice: English + മലയാളം (as before: the class language first, then the other), English only, or മലയാളം only. It works whatever languages the study materials were made in, and is remembered on this device.
- Changing it starts the section again in the chosen language(s) without asking the AI again (the lesson plans are kept for the passage).
- Malayalam only needs an AI key (or the textbook's own Malayalam for a one-part section) for the Malayalam words; without one the class says so and teaches in English.

## V51.9.166 — The class waits until the doubt pane is closed
- Before: opening the doubt pane stopped the class, but the class started again by itself as soon as the first answer finished — while the pane was still open.
- Now: the class stays stopped for as long as the doubt pane is open (voice, camera, typed or offline), through any number of questions and answers, and carries on from the same spot only when the student closes the pane (✕). If the class was paused before the pane opened, it stays paused.
- lessonBridge.openPane() / closePane(): while the pane is open every release() is ignored. A micro class started from the pane still plays, and its own "Back to lesson" still works.
- Test: lib/ai-guru/doubt/lesson-bridge-pane.test.ts.

## V51.9.165 — The doubt pane answers in the language you speak; Edge reads Malayalam first
- Live doubt pane (camera / mic / typed): AI Guru now answers — and speaks — in the same language the student used: Malayalam, English, Hindi, Tamil, Kannada, Telugu, Arabic or any other the AI knows, in that language's own script, switching when the student switches. The live voice is no longer locked to one speech locale, so it can speak any of them. When the language cannot be told (only a number or a picture), it uses the class language.
- A small "Answer in: the language I speak / the class language" switch under "Speak in any language…" keeps the old behaviour available (remembered on this device). The offline (Qwen) answer and its read-aloud follow the same rule; the browser voice picks the language from the answer's script.
- Voice order: Edge reads Malayalam first; the on-device Malayalam voice is next (it speaks when Edge cannot, e.g. offline), or first only with "Local Piper first" in Settings.
- Tests: lib/ai-guru/doubt/reply-language.test.ts, lib/ai-guru/tts/rasa-slow.test.ts, rasa-core.test.ts.

## V51.9.164 — An OpenRouter key shows as active
- Settings › Gemini BYOK: the banner only looked at Gemini keys, so with only an OpenRouter key it still said "No usable Gemini key yet". It now says "✓ OpenRouter is active" (or that the saved OpenRouter key is not usable right now and why), and updates as soon as the key is saved.
- Material Studio: the top button shows "✓ OpenRouter Active", the status card lists OpenRouter among the configured providers, and the page notices a key saved in another tab.
- AI keys & log lists the OpenRouter keys with their state (ready, used up for today, resting, not valid).
- The classroom's live doubt pane explains that live camera and voice need a Gemini key (OpenRouter cannot do live talk), instead of only "Set up your free Gemini key".

## V51.9.163 — Material Studio: Try again, several parts at once, another subject
- ↻ Try again: when materials fail (for example "Every material failed"), the red message now has a "Try again (N)" button that makes only the failed ones again, and a "Check my AI keys" link. The message also shows the first real reason the AI gave.
- Several parts at once: the parts are now tick boxes. Tick Part 2 and Part 3 (or "Select all parts") and press Create selected — each ticked part gets each chosen material ("Create selected (2 × 2 parts)"). With one part ticked a single chapter can still be chosen; with several parts the whole parts are used. Each part only sends its own text to the AI, as before.
- Another subject: a "My textbooks" bar at the top lists every textbook opened in this browser (subject · class · file) — click one to switch to it. "＋ Another subject" puts the open book aside (it stays in the list), clears the five choices, and lets you pick a new subject and upload its PDF. × removes a book from the list only (the book and its materials are not deleted). The upload button now says "Add another PDF".

## V51.9.162 — No more silent, frozen class with the on-device Malayalam voice
- Problem: with the downloaded on-device Malayalam voice (Rasa) switched on, every Malayalam sentence went to it first, and it ran the 150 MB voice model on the page itself. On a PC that cannot run it fast, the page froze (board, buttons) for many seconds per sentence, so the class looked stuck with no voice, and Edge was never asked to read the Malayalam.
- The voice model now runs in ONNX Runtime's own worker (env.wasm.proxy), so the page never freezes while it speaks.
- A time limit: starting the voice may take 20 s at most, and one sentence 8 s at most; after that Edge reads the sentence.
- A device that is slower than real time (over 3 s and over 1.5 × the length of the speech) is remembered for 30 minutes: Edge reads all Malayalam in that time, then the on-device voice is tried again. Switching the voice off and on in Settings › Local TTS clears this.
- Test: lib/ai-guru/tts/rasa-slow.test.ts.

## V51.9.161 — Camera moves per step, on the Cinematic and Whiteboard boards
- New camera presets, one move per step of the working: push-in, pull-out reveal, pan follow (the camera follows the pen), tilt-down steps, split focus (left side of "=", right side, then both), breathe (a slow drift on long holds); and for videos also crash zoom (on the answer), whip pan, dutch tilt (on the question) and rack focus (the rest of the board fades back behind the new line). 3D orbit and top-down drop are listed for the three.js solids later; the flat board never uses them.
- The moves follow the board's look: on 🎬 Cinematic they are slower and smaller (2° tilt, gentle zooms, no crash zoom or whip pan); on the Whiteboard they are the full, punchy set.
- What kind of step it is decides the move (from the caption, English and Malayalam): the question, a working step, the answer ("So, x = 10", "അതിനാൽ"), the check ("Check", "പരിശോധന"). Never the same move twice in a row; crash zoom and whip pan at most twice a part, dutch tilt once; a whip pan never opens a part. The same lesson always gets the same moves, so the preview and the MP4 match.
- Safe by design: the camera only zooms, looks, tilts and dims — no diagram item is moved, re-made or re-coloured, so the English and Malayalam passes still share one drawing. It never zooms so far that the step's line stops fitting, never shows past the board's own edge (only the whip pan's swipe, for a third of a second), and the blur is skipped on phones with 4 GB or less.
- New setting "Camera" on the class board's top line (Motion Class and the class page) and "Camera moves" in the Reel Studio (one setting on this device): Auto (calm in the class, lively in downloaded MP4s and the Reel Studio), Calm, Lively, Off. Calm never uses the fast moves. With Auto, a reel whose Camera is Punch-in / Slow drift / Close-ups keeps its own moves; Calm or Lively take over from it.
- Tapping a tile in an interactive question still lands on the tile while the camera has zoomed or tilted (boardMapping follows the same move).
- Tests: lib/ai-guru/reels/motion/camera-presets.test.ts (moves never repeat, limits, calm/cinematic sets, the new line stays on screen in every move, no edge shown, Auto rules).

## V51.9.153 — Messages: office, teachers and students
- New 💬 Messages page (top menu; teachers also from the teacher portal menu). Two contacts in each app: a student talks to the AI Guru office and to their teacher (when they joined a class); a teacher talks to the office and to each of their students. Teachers sign in with their class code and key.
- To the office, the AI Guru helper (bot) asks first what the message is about — 💰 Fees & payments, 🛠 Technical problem, ❓ How to use the app, 📚 Study doubt, 💡 Suggestion, 💬 Something else — and answers from the office's knowledge base when it can ("Did that solve it? Yes / No"). Everything else goes to the office.
- Admin portal › 💬 Messages: the inbox shows only who wrote (name, ID, student or teacher), the colour of the category, the status (Needs reply / Bot answered / Answered / Closed) and unread marks — not the text. Fees and money always show red, even if another category was chosen. A click opens the full conversation to read and reply. Filters: colour, status, students or teachers, search by name or ID; 50 at a time.
- ✉ New message: the office writes first to any student or teacher. 🤖 Bot knowledge: the office adds, edits and deletes the answers the bot gives (English and Malayalam).
- Teacher–student conversations stay out of the office's inbox; the office can open them (read only) with the "Teacher–student" filter, and both sides are told the office can see them.
- Stored on the server in data/ai-guru/messages (one file per conversation and an index); at most 30 messages an hour per person.

## V51.9.152 — Reel Studio: three ways to make a reel beautiful
- The Reel Studio opens on a front page with the three ways side by side, each with what it uses and how it works: Way 1 "Design it yourself" (right-click on the preview), Way 2 "Pick a style" (the style library), Way 3 "Google Flow (AI video)". Each way is its own page (/ai-guru/reels/design, /style, /flow) with tabs to move between them.
- 📥 From the whiteboard: every part sent from the class (🎬 Edit, Send to Reel Studio) is kept and listed on every page; open it in Design or Style, or delete it. Every MP4 made on the whiteboard (⬇ MP4, ⬇ Download, Share reel) is kept too, with a picture, a ▶ preview, ⬇ Download (for Google Flow) and delete.
- ⭐ My reels: every finished reel (Design or Style) and every video brought back from Google Flow (📂 Add the video from Google Flow) is kept with ▶ preview, ⬇ Download and 🗑 delete (Delete? Yes / No).
- The style library is open by default.
- All kept in this browser (IndexedDB); nothing leaves the device.

## V51.9.151 — Modify with Google Flow
- Reel Studio has a new page, "✨ Modify with Google Flow" (button in the Reel Studio bar; also offered after a video is downloaded on the whiteboard): how to get the MP4, a prompt builder (topic, 6 looks, which 10 seconds, music) with Copy, a button that opens Google Flow, and the steps there (Video › Omni Flash › upload › pick 10 s › paste › Generate).
- The prompt tells Flow to keep every number, equation and letter exactly as it is; the page still asks the student to check every number before posting, and to leave the QR ending unchanged.
- Google Flow needs an 18+ verified Google account with a Google AI Plus/Pro/Ultra plan (or an eligible Workspace plan), so the page asks students under 18 to do it with a parent or teacher.

## V51.9.150 — Joining from a reel
- A video cannot be tapped, so every reel now carries the student's join link three ways: written on every frame, an end card with a big QR code and the join code (scan it from another screen, or type the code at /j), and the caption (tappable on WhatsApp).
- Videos made from the class whiteboard (📱 Share reel, ⬇ Download after a solution, ⬇ MP4, downloads from the class history) had no link at all; they now have all three.
- Reel Studio: the QR end card is on for every reel ("Full video + QR" or "✂ Short clip + QR"); it was off by default.
- Links use the app's public address (NEXT_PUBLIC_SITE_URL) when it is set. When only a local address is known (localhost, a home Wi-Fi address), the share window warns that nobody else can open it.

## V51.9.149 — Steps 3–6 of the all-subjects plan
- Biology (new lessons): "Plant and animal cells" — the cell drawn part by part, each organelle ringed, named and its job written, then plant vs animal; "Mendel's crosses" — parents, gametes, the Punnett square box by box, genotype and phenotype ratios (3 : 1, 9 : 3 : 3 : 1 …) all computed.
- Social science (new agent): "History time line" — events on a time line drawn to scale (BCE/CE), years between events (no year 0) and the century of an event computed; "Places on the map" — places on a coastline map with a latitude/longitude grid, straight-line distances and routes in km. The map has coastlines only, never country or state borders, so no disputed boundary is drawn (Natural Earth, public domain, via world-atlas, ISC).
- Economics (new agent): "Demand, supply and price" — demand and supply lines, the equilibrium price and quantity, and a shift of either curve, computed; "Circular flow of income" — households and firms (optionally government), real and money flows moving round, saving = income − tax − consumption computed.
- English (new agent): "Sentence structure" — the sentence split into Subject, Verb, Object, Complement and Adverbial in colour; its pattern (S + V + O + A) and kind (declarative, interrogative, imperative, exclamatory) computed; a Subject–Predicate tree. Without AI a rule-based reader splits simple sentences.
- All work with and without the AI key (read straight from the textbook text when there is no key), in English and Malayalam, with voice, history, Reel Studio and MP4 like every other lesson.

## V51.9.148 — Physics, step 2 of the all-subjects plan
- Five new physics lessons, every number computed by the app and drawn to scale:
  - Projectile: the throw, u cos θ and u sin θ, the ball flying along its parabola, time of flight, greatest height, range.
  - Pendulum: the bob really swings; T = 2π√(L/g); a pendulum 4 × as long swings beside it with twice the period.
  - Waves: crest, trough, amplitude, wavelength; the wave travels; frequency, period, v = f λ (any two given, the third found).
  - Circuits: battery with 1–4 resistors in series or parallel; total resistance, I = V/R with current flowing round the loop, each resistor's share, power.
  - Lenses and mirrors: convex/concave lens and mirror, two principal rays meeting at the image (dashed for virtual images); real/virtual, erect/inverted, magnified/diminished; lens/mirror formula and magnification (Cartesian signs).
- With or without the AI key: the physics agent reads these problems straight from the textbook text (focal length, object distance, ohms and volts, Hz and wavelength, pendulum length, speed and angle of throw).
- Scene ideas from physicshub and Physics-Notebook (MIT); the code is the app's own.

## V51.9.147 — Chemistry, step 1 of the all-subjects plan
- New lesson "An element in the periodic table": the whole table appears (cells coloured by family), the element is found by its group and period, then its card (atomic number, symbol, mass), its electrons shell by shell (K, L, M, N as a Bohr picture), its electronic configuration (1s² 2s² …) and its valency.
- New lesson "Molecular mass and moles": atoms × atomic mass for each element, added for the molecular mass (u) and 1 mole (g); then moles = mass ÷ molar mass and molecules = moles × 6.022 × 10²³. School atomic masses (H 1, O 16, Na 23, Cl 35.5, Cu 63.5 …).
- The equation balancer is now exact (fractions, not trial up to 10): big equations such as 2KMnO4 + 16HCl → 2KCl + 2MnCl2 + 8H2O + 5Cl2 balance; up to 4 formulas a side are drawn, long equations are written smaller to fit.
- Works with and without the AI key: the chemistry agent reads "molecular mass of H2SO4", "moles in 49 g", "electronic configuration of sodium" and equations straight from the textbook text.
- Element data (118 elements) from Zperiod (github.com/Zhilips/Zperiod, MIT); balancer checked against the test equations of kongnet/chem (MIT).

## V51.9.146 — Delete earlier classes
- Each part in the earlier-classes history (scroll up) has "🗑 Delete"; it asks "Delete? Yes / No" first.
- "🗑 Delete all earlier classes" at the top of the history clears all of them. The board keeps teaching.
- Deleting only removes the pages from this screen; videos already downloaded or sent to the Reel Studio are not touched.

## V51.9.145 — One lesson board
- The old 3B1B board is gone from the class: there is no switch any more, so a student cannot open it by mistake. The Motion Class board is the only lesson board.
- Its features are on the Motion Class board's top line: ⬇ MP4 (saves the part on the board as a video, made in the background while the class goes on) and ↻ Regenerate (makes this section's lesson again). Close stays at the top right.
- "Next step after" is now labelled "Wait", so the top line fits on one row.

## V51.9.144 — A clear way back from the old board
- The board switch said only "Old board", which looked like a label; clicking it switched the class to the old 3B1B board (big overflowing equations, wrong working such as "2x − 10 = 1002x"). It now says "Use old board".
- On the old board, a green "◀ Back to Motion Class board" button is always visible (it used to be hidden under the old board's header).

## V51.9.143 — Speed controls on top of the whiteboard
- Start again, Speed, Next step after (wait between steps) and Board look now sit in one line ABOVE the whiteboard, instead of below it where the class dock covered them.
- "Next step in N s" and the language now show on the playing board's own bar.
- The board switch button is shorter ("Old board"), so it no longer covers the controls.

## V51.9.142 — Earlier pages like a chat
- Fix: the class area had no height limit and kept growing (over a million pixels), so the live whiteboard was pushed below the screen — the voice played but the board could not be seen. The area now takes the window's height.
- The live board fills the view. Earlier pages stay above it, out of sight, and appear when you scroll up — one under another at full size, like earlier messages in a chat. The small reel cards and thumbnails are gone; each part has a thin line with Watch again / Send to Reel Studio / Download.

## V51.9.141 — Pictures from the textbook, on the whiteboard
- Before the lesson of a section, the class finds the pictures on its textbook page (photos and drawings such as geometry figures), cuts each one out, and shows it on the whiteboard, big, with a gentle zoom.
- Each picture is explained in a few spoken sentences: what it shows, its labels, and how it connects to the lesson. With the student's AI key, the AI looks at the picture itself (English and Malayalam); without one, the explanation comes from the picture's caption, its labels and the lesson text.
- New: GET /api/ai-guru/material-studio/page-figures/{id}?page=N returns the cut-out pictures of a page.
- The Index panel now closes: a ✕ on its top bar, the Esc key, or the Index button again ("Close index"). It also ends above the control dock.

## V51.9.140 — Keep learning while the video is made
- After "⬇ Download to my device", the class does not have to wait. While the video is being made, any choice (Continue, Send to Reel Studio, or a click outside the window) tucks the window away and the class goes on.
- The video keeps being made in the background. A small chip at the top right shows "⬇ Problem 1: making video… 45%", saves the MP4 by itself when it is ready ("✓ Problem 1 saved: …"), and goes away after a few seconds.
- Downloads from the class history (scroll up) work the same way.

## V51.9.139 — Scroll up to see the whole class
- Nothing the class taught is lost. Every part that has played (lecture or problem, in every section of this visit) stays above the live board. Scroll up to see it.
- Each part keeps all its pages: the board just before every page change (the graph, each working sheet, the check, the Malayalam repeat), each with its caption. Click a page to see it big. The part playing now shows its earlier pages as it goes.
- Every part, including earlier ones, has 🎬 Send to Reel Studio and ⬇ Download (9:16 video with voice and captions). Parts of the section on screen also have ▶ Watch again.
- The live board keeps its full height, and the page stays at the live board unless you have scrolled up to read.
- The history is kept while the class page is open.

## V51.9.138 — Ask after each solution: Reel Studio or download
- When a solution on the problem board finishes, a window appears over the board: "✅ Solution finished — Do you want to send it to the Reel Studio, or download it to your device?"
  - 🎬 Send to Reel Studio: opens the solution in the Reel Studio in a new tab (the class stays here).
  - ⬇ Download to my device: makes the 9:16 video (voice and captions, the class language) and saves the MP4.
  - Both can be used; "Continue the class ▶" (or "No thanks, continue ▶") goes on to the next part.
- The class waits for the answer. Replaying the solution (⟲) asks again at its end. The small "📱 Share reel" and "🎬 Edit" buttons in the board's top bar are still there.

## V51.9.137 — The digits move: ring, orange, fly, become (cinematic class)
- Pair of linear equations: every working line is now MADE from the line above, the way a teacher shows it.
  - The digits a step works on get a hand-drawn ring and turn orange.
  - Copies fly on an arc to where they land in the new line and become the new value: "2 × 2x" flies together into "4x"; "3x" and "4x" fly together into "7x"; "12" and "2" into "14"; the 7 of "7x" leaves the x and flies across the "=" to divide; "+ 4" jumps across and turns into "− 4".
  - The new value is born orange with a soft glow, then takes its own colour.
  - What does not change glides down quietly.
  - A new multiplier or a sign that turns round (subtraction) pops in orange.
  - The cancelling terms are ringed, struck out and dimmed.
- The orange digits go back to their own colour as soon as their move is done.
- A found answer gets a green box and a few sparks.
- The camera leans in on the working (the given equations and the lines so far fill the board) and pulls back when the lesson returns to the graph.
- Classroom: new "Board" choice next to Speed. 🎬 Cinematic (night sky, glowing working, glass captions, the V51.9.126 look) is the default; Whiteboard is the classic board. It changes at once and is remembered on the device. The same choice is on the Motion Classroom page.

## V51.9.136 — Slower, fully explained solving: two captions and a step-wait control
- Pair of linear equations ("linear-system" board): the algebra no longer jumps. Elimination, substitution and the check each get their own working page (the graph comes back afterwards). Every small move is its own step with its own line:
  - Elimination: which unknown to remove and why → multiply (1) by k, written out term by term (3 × 2x + 3 × 3y = 3 × 8), then simplified → the same for (2), or "keep (2) as it is" → add or subtract the equations (rule and sign) → the cancelling terms are struck out → collect the like terms → divide both sides → the answer.
  - Substitution: take the equation → put the value in (2(3)) → multiply (2 × 3 = 6) → move the number across (− 6 both sides) → simplify → divide → the answer.
  - Check: both equations worked out (3(2) + 2(3) = 6 + 6 = 12 ✓) and the solution stated.
- Two captions on every step. The SHORT note on the right of the line says only what to do ("multiply (1) by 3", "÷ 7 both sides", "subtract: (1) − (2)"). The MAIN caption at the bottom, which is spoken, says why it is allowed and how the numbers come out ("Multiplying both sides by the same number keeps the equation true", "When we take away a whole equation, every one of its terms changes sign", "+ 6 on the left becomes − 6 on the right"). English and Malayalam. All words and numbers are written by the app from the equations, so they are always right.
- Each small step now stays until its caption has been read (or spoken). It is no longer cut short by the next step.
- Speed controller "Next step after": no wait, or 1–10 s. After each step the board and caption stay for that time, then the next step starts by itself (Play skips the wait, Pause stops it).
  - Classroom whiteboard (next to Speed) and Motion Classroom: works at once on the class already prepared, remembered on this device, 2 s by default.
  - Reel Studio (Style & voice): built into the reel and the MP4, "no wait" by default for social reels.
- Engine: a caption can carry a short side note (`note`). The problem board's step notes show that note instead of repeating the whole caption.

## V51.9.135 — ✦ Style library (Opus-inspired styles)
- Reel Studio has a new ✦ Style library panel, for every kind of reel (sum, topic, chapter, story, class part, explainer). It holds 430 safe ideas from the open awesome-opus5-5-videos collection (MIT), and 40 of them are hand-picked for lessons (maths, science, step by step, words & stories, celebration). Search, category filter, "Best for this reel", and each card credits its creator and links to the original.
- A style is a recipe for the engine AI Guru already has: look, camera, pace, music, sounds, fonts, opener and ending. Your lesson stays the content, so the preview still matches the MP4 frame for frame and the self-check still runs. Your own picks under More choices still win over the style. The chosen style is remembered on this phone.
- ✨ Explainers: with a style chosen, "✨ Write the script" writes in that style (tone and preferred pictures). In a class part sent from the whiteboard, "✨ Make an explainer in this style" turns the class text into an explainer script and opens it. The AI answer goes through the same checks as before, and with no AI key the text is split into sentences.
- The library is served by /api/ai-guru/reel-styles, one page at a time, so phones don't download the whole collection. It is validated once at server start, so an unknown look or font can never reach a reel.
- Curation: scripts/ai-guru-build-opus-library.mjs rebuilds data/ai-guru/opus-style-library.json from data/third-party/awesome-opus5-5-videos/videos.json. It drops brands and franchises, violence, gambling and crypto, alcohol, adult, horror, profanity and politics, plus games that teach nothing (273 of 703 dropped).

## V51.9.126 — Cinematic look for solving reels
- New look "Cinematic" (Reel Studio → Style & voice → More choices → Look): the explainer reels' style for any maths reel. A deep night sky with twinkling stars, the Milky Way, soft violet and blue glows and a vignette slowly zooms in; the board drifts in with it; the working, tiles and rings glow in soft colours; title, step and caption cards are frosted glass; the caption is in the elegant serif and appears word by word with the voice.
- Everything from V51.9.125 stays: every step on the board with its note, rings and orange digits flying into the next line, principle captions, the footer with name, photo and WhatsApp.
- With the cinematic look, "Auto" picks the elegant serif for words, the clear serif for numbers and a steady camera. Past lines stay readable (soft blue-grey), the WhatsApp line is a lighter green on the dark footer.

## V51.9.125 — Solving reels: all steps, notes, moving digits, principles, WhatsApp
- Balance-scale equations (class whiteboard, 📱 Share reel, Reel Studio class parts): no line of the working is ever faded away; the rows are sized so the whole solution fits under the scale.
- A small note on the right of EVERY line, in the class language: "the problem / ചോദ്യം", "− 5 both sides / ഇരുവശത്തും − 5", "25 − 5 = 20", "÷ 2 both sides", "20 ÷ 2 = 10", "both sides equal".
- The digits a step works on get a ring AND turn orange. Then they visibly make the next line: +5 flies across the "=" and turns into −5; 25 − 5 fly together and become 20; the 2 flies under 20; 20 over 2 fly together and become 10. Then they go back to their own colours.
- The main caption (spoken by the voice) now says the principle of each step: "An equation is a balance…", "To keep the balance, take away 5 from both sides…", "2 is multiplying x. Do the opposite…", "20 shared equally by 2 x's gives 10 each…", "Check: put x = 10 back…" (English and Malayalam). The arithmetic is the note beside the line.
- Reel Studio "Solve 2x + 5 = 25" example: the same principle captions, a note on every line, the ringed digits orange while they fly, and the whole working kept in view.
- Footer: My details has a WhatsApp number. It is written on downloaded reels (green line under the name and school, beside the photo) only when "Show it on the reels I share — my parent or guardian agrees" is ticked. My details is now also in the Reel Studio top bar, and the footer updates as soon as it is saved.

## V51.9.124 — Explainer reels (cinematic style)
- Reel Studio: ＋ New reel → "🎬 An explainer". One short sentence per screen, the words coming in one by one with the voice, in a serif font: *bold italic* words and a violet [highlight] box that grows behind the key words.
- Each shot has a dark moving picture with a slow zoom and glow: night sky with the Milky Way and a person looking up, a planet (Earth, Sun, Moon, Mars), rain, a beam of light, an arrow, a grid, an atom, a big title word, or the student's own photo (slow pan and zoom). Small spaced LABELS and numbers that count up (en-IN, e.g. "15 crore km").
- ✨ Write the script turns a topic or a lesson passage into 4–10 shots in English and Malayalam with the student's AI key; without a key the text is split into sentences. Every shot can be changed: picture, planet, photo, sentence, label, number, big word, order; "Use these changes" puts them in the reel.
- Sample: "The Sun you see is 8 minutes old" (8 shots, 37 s in English, 51 s in Malayalam). Malayalam labels are not letter-spaced, so the letters stay joined.
- Preview & post, Download, Share and the right-click menu work as for other reels; the card parts (title, caption, board) are not shown for explainers, since the sentence is the picture.

## V51.9.123 — No common mistakes, no mistake strike-outs
- The "COMMON MISTAKE" scene (a wrong line struck out with a red ✗, then the right line) is gone from the class whiteboard, the whole-textbook class, and every reel made from them (📱 Share reel, Reel Studio). The plan's own mistake from the AI is left out too. "Solve 2x + 5 = 25" now goes straight from reading the problem to the balance scale (29 s instead of 36 s).
- Reel Studio: the "Most get it wrong" opener and the "Spot the mistake" reel type are gone. A reel that had one saved or pinned uses the Challenge opener / a normal reel instead.
- The class's "⚠ Common mistakes" button is hidden (it no longer does anything).
- Still crossed out, because that is how the textbooks write it: a borrowed digit in subtraction, and a term cancelled on both sides.
- One switch, `MISTAKES = false` in `lib/ai-guru/features.ts`, brings it all back if ever wanted. Tests check both.

## V51.9.122 — Avatars hidden, to keep AI Guru simple
- The avatar (a face in the corner of reels and classes) is switched off everywhere by one switch, `AVATARS = false` in `lib/ai-guru/features.ts`. Its code stays; set it to `true` to bring it all back.
- Hidden: Reel Studio "Face in the corner" and "Make my avatar"; the "Duet" reel type; the teacher's face in the whole-textbook class; "My face in the corner" in the teacher's video maker; "My avatar" in the Teacher Portal menu. Opening that page by its address says avatars are not used now.
- Nothing else changes: reels and classes use the voice, the captions and the board. A student's own photo on their reels (footer and "Shared by") is not an avatar and stays.

## V51.9.121 — Share a reel straight from the whiteboard; a simpler Reel Studio with a Canva-like menu; preview before posting
- **📱 Share reel on the class whiteboard** (lecture and problem boards; it replaces "⬇ MP4"):
  - One tap makes a **9:16 reel** of the part on the board, with voice and captions, **in one language**. When the part was taught in English and Malayalam, the student picks which one first.
  - **The reel plays in a preview window first.** From there: **📱 Share** opens the phone's share menu (WhatsApp, Instagram, YouTube …) with the caption and link; on a computer it saves the MP4 and copies the caption. Also **⬇ Download**, and **✏️ Change it in Reel Studio**, which opens this part in the Reel Studio in that language.
  - The self-check result is shown under the video ("✓ sound, voice and picture are fine", or what is wrong; then Share asks twice).
  - **🎬 Edit** next to it opens the part in the Reel Studio straight away. The class file can still be saved from the share window.
- **Reel Studio, simpler:**
  - One top bar: **＋ New reel** (a sum, a topic example, a chapter intro, a story, a part of a class, each with a one-line description) and **👁 Preview & post**.
  - **👁 Preview & post** makes the MP4 and plays it before anything is saved or shared, with Share, Download and "✏️ Change it". It is made again only when something changed.
  - The left side shows only **what is in this reel** (sum, story, class part …), **🎨 Style & voice** (folded) with **More choices** (look, opener, ending, music, camera, fonts) folded inside it, and **📋 Caption & subtitles** (folded).
- **Right-click on the reel (long-press on a phone, or the ⋯ button on what is selected):**
  - On something added: Edit text, Colour, Behind the words, Shape, Bigger / Smaller, To front / To back, Copy, Delete, Add a heading below.
  - On the title card or the caption: Card colour, Text colour, **Card shape** (rounded, pill, ribbon, sticky note, speech bubble), Bigger / Smaller, Hide, As it was, Add a heading / text here.
  - On the board: Background colour, Bigger / Smaller, Hide, and add a heading, text, sticker or shape right where you clicked.
- New things are placed so they stay inside the frame. Text tiles in the Add panel are readable; the story editor's bar no longer covers the words.
- Code: `components/ai-guru/reels/ReelPreviewDialog.tsx`, `lib/ai-guru/reels/share-reel.ts` (share / save, one-language class reel), `components/ai-guru/reels/design/ContextMenu.tsx`, the menu triggers in `DesignOverlay`, card shape in the design layer and `draw.ts`. Tested, including a real class on the whiteboard made into a 1080×1920 reel and opened in the Reel Studio.

## V51.9.120 — Take a part of a class to the Reel Studio and change it
- **On the class whiteboard** (problem and lecture boards), two new buttons:
  - **🎬 Edit as reel** opens this part in the Reel Studio in a new tab; the class carries on.
  - **⬇ Class file** saves this part as a small file (…aiguru-class.json) to open in the Reel Studio later, or on another device.
- **What goes across is the lesson's material, not a video:** the textbook blocks and the teaching plans. The Reel Studio builds exactly the same maths animation again (the balance scale, the digits, the steps), so nothing is blurred and everything can still be changed.
- **🎓 From class in the Reel Studio:**
  - Choose the reel's language (English or Malayalam parts).
  - Untick parts you do not want (read the text, teach, common mistake …).
  - **✍ Change the words the teacher says**, line by line. The voice says your words and is timed to them; the maths on the board stays exactly as it was. "↺ Original words" undoes it.
  - Then design it on the preview like any reel (move, resize, colours, stickers, text, characters) and ⬇ Download MP4.
  - ⬇ Save as class file keeps your choices and words; 📂 Open a class file opens one.
- A micro class made from a doubt has no button (it is made from the doubt only).
- Code: `lib/ai-guru/reels/class-clip.ts` (the clip, checking, rebuilding, files); `withWords` in the engine (changed caption words, applied before the voice is timed); a `scenes` reel request; `components/ai-guru/reels/ClassClipPanel.tsx`; buttons in `MotionTeachingBoard`. Tested.

## V51.9.119 — Reel designer: click, drag, resize and recolour on the reel
- **Design on the preview itself.** Click any part of the reel — the title card, the board, the caption, the footer — and drag it, make it bigger or smaller with the corner handles, change its card and text colour, or hide it. Change the background colour.
- **Add things by dragging them onto the reel** (or tapping): text (heading, label, plain, Malayalam), 20 stickers, shapes (box, rounded box, circle, arrow, star, heart), the 14 story characters, 9 props, and a photo from this device. Added things can be dragged, resized and turned with handles.
- **The selected thing's settings** on the left: colour swatches and any colour, size, turn, see-through, font (the 8 reel fonts), bold, words, the colour behind the words, a round photo, which character or prop. Bring to front, send back, copy, delete.
- **When it shows:** the whole reel, or only one part. A strip of parts under the reel (Opener, Lesson or Shot 1, 2…, Ending, End card) shows how long each lasts. Tap a part to jump there; drag an item's chip onto a part (or "Whole reel"). In a story, drag a shot onto another to change the order.
- **How it arrives:** pop, fade, slide, bounce, or no animation. While the reel is paused for editing, items show in full; the animation plays when it plays and in the MP4.
- **Undo / redo** (↶ ↷, Ctrl+Z, Ctrl+Y). Keys: Delete, arrows to nudge (Shift = bigger steps), Ctrl+D to copy, Esc. The design is kept on this device.
- **The MP4 is the same picture as the preview:** the engine draws the design on every frame (photos are loaded first).
- **Less confusing page:** the long list of choices (voice, format, link, photo, face, look, opener, music, fonts…) is folded into one "⚙ Settings" line that shows the current choices; the preview is bigger and stays in view.
- Uses **react-konva 19.2.7 and konva 10.9.0** (both MIT) for the handles only; AI Guru's own engine draws the reel. Run `npm install` once to add them (V51.9.119 is also delivered with them in place).
- Code: `lib/ai-guru/reels/design/layer.ts` (the design), `draw-design.ts` (drawing the items), part changes in `draw.ts`; `components/ai-guru/reels/design/` (ReelDesigner, DesignOverlay, Panels, ShotStrip, useDesign). Tested, including frames checked pixel by pixel.

## V51.9.118 — Story reels: stories told in pictured shots, with a storyboard you can change
Ideas taken from ArcReel (an AI drama studio, AGPL-3.0) and written fresh for AI Guru; none of its code is used.
- **📖 Story in the Reel Studio.** A history lesson, a Malayalam lesson or any story becomes a reel of pictured shots: a Kerala setting (village with coconut palms, home, school, temple, palace, forest, river with a vallam, paddy field, seashore, night, market), the characters, props (pot, pebbles, book, lamp, basket, purse, well, ball), the narrator's line as the caption and voice, and a speech bubble when someone speaks.
  - Drawn with the motion engine's own shapes, so voice, captions, second-language line, music, looks, fonts, the opener and closing cards, MP4 export and even loudness all work as for the maths reels. No paid video AI.
  - **The same character looks the same in every shot.** Skin, hair and clothes come from the character, never from chance. A name tag shows the first time a character appears.
  - 14 kinds of character: boy, girl, man, woman, old man, grandmother, king, queen, teacher, sage, elephant, bird, tiger, monkey.
  - Movement: characters come in from the side, walk across, or a bird flies in. The camera drifts slowly and moves closer to whoever speaks.
  - Without a voice-over each caption stays long enough to read.
- **✨ Make storyboard.** Paste the passage; the student's AI plans the cast and 4–8 shots, every line in English and Malayalam. The answer is checked: only known settings, characters and props; whoever speaks is in the shot. Without an AI key the passage is split into shots by sentences, and the setting and characters are guessed from its words.
- **Change anything:** characters (name, kind), and for each shot the setting, who is in it, movement, props, narration and speech bubble. Shots can be moved, added or deleted. **↻ Redo** asks again for one shot only; **↶ Back** returns to the shot before the redo. "Use these changes in the reel" applies the edits, so the voice is not remade on every key press. The storyboard is kept on this device.
- Two ready samples: "The Thirsty Crow" (fable) and "Ammu and the Lost Purse" (honesty), both in English and Malayalam.
- Story reels' footer says "Follow for daily story lessons".
- Even music volume was already in place (V51.9.97: every reel is levelled to −14 LUFS).
- Code: `lib/ai-guru/reels/motion/recipes/story.ts` (drawing and shots); `lib/ai-guru/reels/story/storyboard.ts` (AI prompt, checking, no-AI fallback, redo, samples); `components/ai-guru/reels/StoryEditor.tsx`; a new `story` reel request. Tested, including frames rendered in both languages.

## V51.9.117 — Flying chilli and toffee with sound and voice; rewards in the teacher and parent portals
- **A chilli no longer just appears.** On a wrong answer a big chilli drops in from the top, bounces and shakes, with a falling whistle and a bonk. A voice says **"The answer is wrong. You got a chilli."** Then the chilli flies in an arc into the chilli counter, which jumps.
- **A toffee is celebrated.** On a right answer confetti bursts and a toffee spins in with a chime. A voice says **"Congratulations! You got a toffee."** Then the toffee flies into the toffee counter.
  - Redoing a missed question: "Well done! Your chilli turned into a toffee."
  - In a Malayalam class the voice speaks Malayalam when the device has a Malayalam voice; otherwise it speaks English.
- The same happens everywhere a reward is earned: questions inside the class, the toffee quiz, the sample quizzes. Rewards that come together play one after the other.
- The card says the answer was sent to the teacher and parent, and shows the parent code. A 🔊 button on it turns the sound and voice off or on (remembered on this device).
- **Teacher portal:** a new "Toffees and chillies (live)" list shows every reward with the student, the time, whether it was in class or in a quiz, and the question; for a chilli also what was chosen and the right answer. It refreshes every 20 s.
- **Parent portal:** the same list for their child, refreshing every 30 s.
- Code: `addReward` now announces each gain (`ai-guru:reward-gained`); `lib/ai-guru/quiz/celebrate.ts` holds the lines, sounds and voice; `RewardCelebration` is on every AI Guru page; `lib/ai-guru/quiz/reward-feed.ts` builds the portals' list. Tested.

## V51.9.116 — Classroom strip shows the textbooks ready to teach
- **The subject list above the lesson is gone.** In its place are the textbooks you uploaded and made study materials for in the Material Studio — only those. Each chip shows the book's name, subject, standard, pages and how many study materials it has.
  - A student clicks a book: it opens on page 1 and the class starts at once (the ▶ chip marks the open book). Clicking the open book again restarts its class.
  - Books with a General Class (whiteboard notes) come first, then the newest.
  - When no book is ready yet, the strip says so and links to the Material Studio.
  - The 📚 Whole textbook button stays at the start of the strip.
- New `GET /api/ai-guru/material-studio/ready`: the books this person may see (their own, this browser's guest books, or the shared library) that have study materials. `lib/ai-guru/material-studio/ready.ts` picks and orders them (tested).

## V51.9.115 — Main menu on every page; only tabs that open real pages
- **The main menu is on every AI Guru page.** A new `app/ai-guru/layout.tsx` (`AiGuruShell`) adds it to every page that did not draw it: student sign-in and sign-up, student page, teacher portal (and its pages), parent portal, library, quizzes, 3D Lab, Whiteboard Lab, safety, picture credits, admin. No page is a dead end now.
  - The pages that already draw the menu inside their own full-height layout keep theirs, so they look exactly as before: Classroom, Reel Studio, Material Studio, Settings, Ask my paper, Teachers Notes.
- **Only tabs that open a page.** Eight tabs only led back to the home page.
  - Now go to their real pages: **Quizzes & Exams** → the quiz page (daily challenge, contests, revision, sample lessons) · **Whiteboard Lab** → the maths whiteboard studio · **Progress** → the student page (fees, details and progress) · **Teacher Portal** · **Parent Portal**.
  - Removed: **Flashcards**, **Profile** and **Subscription**, which have no page. Flashcards stay a material type in the Material Studio.
  - Added: **3D Lab**, which had a page but no tab.
- The right tab lights up on each page: sign-up → Progress, teacher pages → Teacher Portal; "Teachers Notes" no longer lights up Teacher Portal, and "My Textbooks" no longer lights up Progress.
- Fixed: the tabs ran under the **Sign in / Admin** button on narrower screens. They now scroll inside their own row, and the Sign in drop-down is no longer cut off by the menu bar.
- Test `components/ai-guru/nav.test.ts`: every tab's page exists and none goes home, the right tab matches, and the pages with their own menu are not given a second one.
- Checked in Chromium: 17 pages show exactly one menu with the right tab lit; no tab leads home; the Sign in button and its drop-down are clear of the tabs; no page errors.

## V51.9.114 — Material Studio: one menu, and an "AI keys & log"
- **One menu row.** The Material Studio drew its own second menu (Classroom … Profile, Settings, Subscription) under the site menu. It is removed; the "Gemini BYOK Active" and "Choose / Replace PDF" buttons stay.
- **AI keys & log** (under the AI provider box):
  - **Keys on this browser:**
    - each Gemini key, masked ("AIza…1234"), with its state (ready / resting a minute after a rate limit / used up for today / not valid) and Google's last reason;
    - the Gemini model;
    - OpenAI, Agnes AI and Sarvam AI: added or not, their state and model;
    - the order they are tried in.
  - **What happened:** every AI call while making study materials, newest first. Each line shows the time, provider, model, the masked key used, the task ("MCQ · plan / content / visuals / questions / QA check / repair / QA re-check"), how long it took, and ✅ or ❌.
  - A failure gets a plain-words reason ("Too many requests a minute on this key — it rests and the next key is tried", "This key has used up today's free limit", "The key is not valid", "The AI service is busy", "No internet connection") plus the provider's own message.
  - The top line says which provider and model gave the last answer. "Clear log" empties it. The log is kept in memory for this visit only, and a full key is never written to it.
- New: `lib/ai-guru/ai-log.ts` (`logAi`, `onAiLog`, `timedAi`, `maskKey`), `components/ai-guru/AiKeysLog.tsx`.
  - The Gemini key rotation (`withKeyRotation`) logs each key it tries.
  - `callFallbackProvider` logs OpenAI / Agnes / Sarvam.
  - `callAiGuruText` and `callGeminiClient` take a `task`, and the material pipeline names every call.
- Tests: `ai-log.test.ts` (entries with masked keys and no full key, plain-word reasons, at most 300 entries).
- Checked in Chromium with a fake Gemini service: the first key was rate-limited (❌ with the reason), the second made every step of an MCQ (✅ plan, content, visuals, questions, QA), and only one menu row was shown.

## V51.9.113 — Ring it, then change it (every solving branch)
- **A hand-drawn ring around what is about to change**, as in the "Solve 2x + 5 = 25" reel. Before a step, every piece that will move, change, merge, split or cancel is circled, like a teacher circling with chalk.
  - Neighbours on one row share a ring ("+ 5", "25 − 5").
  - The ring is slightly wobbly and overlaps where it started, like a pen stroke.
  - It takes the colour of the group's first number or letter (purple for "+ 5", green for "25 − 5", red for "2").
  - Then the transformation plays as before: the piece flies to its new place and becomes its new value (+5 → −5), pieces merge (25 − 5 → 20), copies split. After that the ring fades.
- It is done in the motion engine's `focus` step, which every recipe calls before a change, so **all branches of solving** get it: equations, column addition, subtraction, multiplication, division, fractions, geometry, sequences, matrices and the rest. It works on the class problem board, Reel Studio and the MP4s.
- Shapes (lines, figures) keep the soft glow, and the final answer keeps its glow and box (no ring on top). A ring fades by itself if a recipe never un-focuses. The close-up camera follows the rings.
- New: `Motion.ringsAround` and `Motion.rings` (`engine.ts`); `camera.ts` counts rings as focus.
- Tests: all reel and class tests pass (929). The 14 failing tests in `lib/ai-guru/math` fail the same way without this change.

## V51.9.112 — Step buttons just below each step's caption
- On the problem board, each line now shows its short caption first, on the right of the line, and the small step buttons (# pause · ✓ carry on · ^ step before · ⟲ from the start) in a row **just below that caption**. Before, the buttons came before the caption.
- The caption and the buttons are centred on the line together, with one bar beside both. The buttons work as in V51.9.111.

## V51.9.111 — Step buttons after every line; in-class answers earn toffees and chillies
- **Small step buttons after every line** on the problem board, in a row: **#** pause · **✓** carry on · **^** step before · **⟲** from the start, then that step's short caption.
  - The step now is bright, and its # is filled red while paused. Earlier lines are lighter.
  - On an earlier line: # goes back to that step and stops there, ✓ carries on from it, and ^ goes to the step before it.
  - They are drawn on the board, so they move and zoom with the working. The symbols are shapes, so no font can show them as empty boxes.
  - The single vertical column on the board's edge (V51.9.110) is gone.
- **In-class questions now earn rewards.** The questions that pop up in the class used to earn nothing. Now the first answer to each question gives a 🍬 toffee when right and a 🌶 chilli when wrong (a skip gives nothing), and the counters change at once.
  - The answer is also sent to the teacher and parent portals as "In-class question · section", and kept on the device when offline.
  - A missed four-choice question can be redone with "Turn my chillies into toffees" in the Quiz.
- The **surprise quiz** (Quiz → 🎲 Surprise quiz) is unchanged: it makes questions from the lesson on the board, with the student's own Gemini key.
- New: `stepButtons` / `stepPaused` draw options and `stepButtonsOf(canvas)` (`draw.ts`), `class-rewards.ts`. Tests: `step-notes.test.ts` (the buttons are in a row, in order, small and to the right, one row is the step now, and nothing is recorded without the option) and `class-rewards.test.ts` (toffee, chilli, skip; the record passes the server check; a missed question can be redone; Malayalam saved in Malayalam).

## V51.9.110 — Interactive class: one board, step controls and step notes on the whiteboard
- **An empty board is hidden.** When a part has nothing for one board ("Nothing to explain in words in this part …"), that board is not shown, even if it was floated. Only the board that teaches is on screen, and the other comes back as soon as it has something to show.
- **Step controls on the whiteboard.** A small column on the board's right edge holds:
  - the step number (35/42);
  - **#** pause at this step (filled red while paused);
  - **✓** carry on (when playing: done with this step, on to the next);
  - **^** go up to the step before;
  - **⟲** start again from the beginning.

  The separate panel beside the board, which cut off ^ and ⟲ on a narrow floating board, is gone.
- **A short caption beside each step.** On the problem board, each step's caption is written in small letters to the right of the line that step wrote. The step now is in the board's accent colour and earlier steps are grey; long captions wrap to two lines.
  - Each note starts right of everything already on its row (the board's own "−5 both sides", ticks, answer boxes), and a row reused by a later step keeps only the latest note.
  - A note is left out where there is no room, and notes keep clear of the controls.
  - The lecture board and shared reels are unchanged.
- New: `stepNotes` draw option (`drawStepNotes`, `stepNoteItems` in `draw.ts`), `ClassPlayerOptions.stepNotes`. Test `step-notes.test.ts`: the step → line items are found and cached, and the notes are drawn only when asked, on the right.

## V51.9.109 — A failed Gemini key is a warning, not a red error
- When a Gemini request failed (rate or quota limit 429, a wrong key or model 400, Google busy 5xx), `classifyFailure` logged it with `console.error`. Next.js's development overlay showed every one as a red "Console Error · Gemini API failure: {}", with no reason given. The app had already moved on to the next saved key, so nothing was broken.
- It is now a `console.warn` with the status and Google's own reason, for example "Gemini HTTP 429: Resource has been exhausted … — rate or quota limit; trying the next key". The key rotation is unchanged.

## V51.9.108 — No more "Hydration failed" warnings
The red "Recoverable Error · Hydration failed…" box appeared on most pages for anyone with a Gemini key saved. The pages still worked, but the box hid the screen. It happens when the server's first drawing of a page differs from the browser's. Fixed:
- **The doubt camera/mic dock** (on the home page, Classroom, Material Studio and others): it read the Gemini key from the browser while the page was first drawn. The server has no key, so it drew "Set up your free Gemini key…" and the browser did not. These hints (and "Try offline AI instead") now wait until the page runs in the browser.
- **Reel Studio:**
  - The site address in "My link" ("localhost:3000/…") was known only in the browser.
  - The Auto music, from the class level in the profile on the device (V51.9.105), differed between server and browser.

  Both are now read once the page runs in the browser (`useSyncExternalStore`).
- Checked in Chromium with a Gemini key and a profile saved: no hydration errors on Home, Classroom, Material Studio, Reel Studio, Sign-up, Student, Library, Teacher avatar, Settings, Motion class, Learn and Maths (before: Home, Classroom and Reel Studio had them).

## V51.9.107 — Signing in is not needed
- **Material Studio without signing in.** Uploading a textbook PDF and saving the study materials used to stop with "Sign in (student or admin) to upload a textbook to the library". Now:
  - **Not signed in (guest):**
    - The book and its materials are saved **privately for that browser**, through a random guest id in an HTTP-only cookie (`lib/ai-guru/library/guest.ts`).
    - Nobody else sees them: not the shared library, not other students, not other browsers. The admin sees them in Library as "Guest (not signed in) · name · private" and can still publish one.
    - The guest opens every part of their own book, because they had the PDF.
    - Uploading the same PDF again brings back the guest's own book instead of indexing it twice.
    - The name typed on that device is attached to the book and materials (only the admin sees it).
  - **Guests never use AI Guru's keys.** Neither the AI Guru cloud key nor the server's `GEMINI_API_KEY` is used, so there is no surprise API cost. Only the guest's own keys (BYOK, from Settings) are used, or, with none, the chapters are found without AI.
  - **Signed in:** as before, books and materials go to the shared library.
  - **Create on cloud** (AI Guru's key) still needs a sign-in.
- **Chapters found without AI** are better: "Chapter 1 Fractions", "UNIT 3: Ratio and Proportion", "Lesson IV …" and "അധ്യായം 2 …" are recognised even when the heading runs into the text. The title stops where the first sentence starts, and a heading repeated on the next page stays in the same chapter. In the test PDF, 6 pages gave 3 chapters (before: 1).
- **The sign-up page's details are used for reels, with or without an account.**
  - What is typed (name, standard, school, place, district) is kept on the device at once, as the same device profile the reels' footer uses ("Meera Joseph · Std 7", "St Mary HSS, Aluva, Ernakulam").
  - It is also sent as the guest name to the Material Studio.
  - The form starts from the details already on the device.
  - A box under the form says an account is not needed, with **"Continue without an account →"** (to Reel Studio).
- Tests:
  - `library-api.test.ts`: a guest upload is private, has a cookie, finds chapters without AI, and never sends the server's or the cloud key; only that browser opens it (another guest, nobody and a signed-in student get 404, and it is not in the library list); the admin sees the guest; the same PDF again gives the same book; guest materials are private, another guest cannot overwrite them (403), and cloud jobs still need a sign-in (401).
  - The sign-up details are merged into the device profile.
  - `heading.test.ts`: headings and chapter splits found without AI.
  - Two older expectations ("401 without a sign-in") were changed to the new rule.
- Checked in Chromium: the sign-up form without an account → the device profile → the reel footer shows "Meera Joseph · Std 7 / St Mary HSS, Aluva, Ernakulam"; the Material Studio not signed in: the PDF uploads and indexes (6 pages · 3 chapters), with the private-save note and an HTTP-only guest cookie.
- The zip now unpacks straight into the app folder (no folder inside a folder).

## V51.9.106 — Font styles for reels
Reel Studio → *Make it different* now has two font choices. Both are on Auto by default, can be set by hand, and can be pinned (📌 My style):
- **Writing font**: the title, captions, step pill, cards and closing cards. There are 8 styles, each with a Malayalam partner, so Malayalam captions change with it:
  - Classic serif (Noto Serif · Noto Sans Malayalam)
  - Rounded (Baloo 2 · Baloo Chettan 2)
  - Handwriting (Kalam · Chilanka)
  - **new** Modern clean (Lexend · Anek Malayalam)
  - **new** Bubbly (Fredoka · Manjari)
  - **new** Marker pen (Patrick Hand · Gayathri)
  - **new** Elegant (Playfair Display · Noto Serif Malayalam)
  - **new** Comic (Comic Neue · Baloo Chettan 2)
- **Numbers font**: the maths on the board. There are 6 styles, chosen for clear digits and signs: classic serif, rounded, handwriting, modern, bubbly and marker. Elegant and comic are for writing only.
  - The board's layout is measured when the reel is built, so the reel is built **and** drawn with the chosen font (`withBoardFont`). The MP4 export uses the same font.
  - The default comes back straight afterwards, so the live class and other boards never change.
  - Column sums keep their digits lined up because every digit has its own cell. π and the root sign (missing from these fonts) come from the serif.
- **Auto** (the random style of each reel): the look's own writing font is the most likely, then fonts that suit the look (chalkboard → marker or handwriting, comic → comic or bubbly, kasavu → serif or elegant …).
  - The numbers keep the classic serif on about half of all reels.
  - Std 1–4 get rounder fonts (bubbly, rounded, comic) twice as often.
  - The fonts are drawn after every other choice, so all earlier choices for a seed stay the same.
- **Loaded only when used**: each new style's files (about 40–120 KB) load only when a reel uses it, so the page does not get slower.
- The fonts are all SIL Open Font License 1.1, from the Fontsource npm packages, saved in `public/fonts/reel` (credits added to `OFL-look-fonts.txt`).
- Tests (`fonts-choice.test.ts`, 5):
  - every style has its files and families, and its font stack ends in the serif;
  - the board font is used while measuring and is always put back, even after an error;
  - every numbers font builds and draws a sum and an equation, and the six pictures differ;
  - Auto suits the look more than 60 % of the time, keeps the serif board 35–80 % of the time, uses every font, and fixing the fonts by hand does not change any other choice;
  - Std 1–4 get rounder fonts more often; only allowed board fonts are used; fonts can be pinned.
- Checked in Chromium: six look + font combinations, Malayalam captions in the four new partners, only the needed font files downloaded, and a 20.6 s MP4 (chalkboard, marker writing and marker numbers).

## V51.9.105 — More variety: class level, classmates, my colour, three new looks
- **The style fits the class level.** The level comes from the standard in the student's profile ("3", "Std 7", "Class 10", "IX", "LKG"):
  - Std 1–4: bright, playful looks (sunrise, mint, comic, notebook, chalkboard), punch-in camera, upbeat music, arcade sounds, a relaxed pace;
  - Std 5–8: comic, chalkboard, graph, neon;
  - Std 9–12: calmer, cinematic looks (night, ocean, graph, paper & ink, neon), drift and close-ups, calm or lo-fi music, soft sounds.

  These are twice as likely and stack with the lesson's topic, but are never forced: every look still turns up. In tests the matching looks came up more than 55 % of the time. The random draws happen in the same order, so a reel without a level is unchanged.
- **Classmates spread across the looks.**
  - When a student downloads a reel, the phone tells the AI Guru PC its look, only the look's name (new `/api/ai-guru/student-portal/class-looks`; a small file on the PC, today only, no AI and no cost).
  - A new reel is less likely to use a look that classmates already used today: each classmate who used it makes it 2.5 × less likely. The student's own reels are left out, because the phone already avoids their last 5 looks.
  - The season's look is included: at Onam, a class where 8 classmates already posted kasavu gets kasavu on fewer than 15 % of new reels, instead of more than 60 %.
  - When the student is not signed in or not in a class, nothing changes.
- **🎲 Shuffle always changes the look.** It used to sometimes land on the look already on screen.
- **My colour.** There is a row of 8 colours (rose, orange, gold, green, teal, blue, violet, pink) or Auto, saved on the phone. The colour goes on the card outlines, the word being spoken, the face ring and the follow pill. The maths keeps its own colours. On each look the colour is made darker or lighter until it passes the readability rules (all 8 colours × all 12 looks are tested).
- **Three new looks (12 in all):**
  - **Neon:** a glowing grid and glows on a dark violet board, and the maths glows in its own colours;
  - **Paper & ink:** cream paper with fibres, ink blots, a red margin, ink-red, violet and green maths, handwritten cards;
  - **Comic:** halftone dots, faint action lines, bold black outlines and speech-bubble cards with a tail.

  All three pass the readability test and fit the topics: algebra and calculus → neon; geometry, calculus and chapter intros → paper & ink; sums and data → comic.
- Fixed (since V51.9.101): the "Follow for daily maths tricks" pill and the badges had white text on light colours on the chalkboard, deep ocean (and neon) looks, which was hard to read. The text is now white or near-black, whichever is readable, and the readability test checks it on every look.
- Tests (in `variety.test.ts`): the new looks are readable; class level from all kinds of standards; level bias (more than 55 %, every look still possible, no shift without a level); a busy look in the class drops below 6 %; kasavu at Onam drops from more than 60 % to less than 15 %; the class record counts each classmate once, leaves out the student's own reels and resets each day; every colour on every look is readable and the maths colours stay unchanged.
- Checked in Chromium:
  - two students in one class: the second sees the first's looks and the first's own downloads are not counted for them; not signed in gives 401;
  - a Std 3 student's shuffles leaned to playful looks with no repeat in a row;
  - neon, paper & ink and comic were rendered, plus comic and neon with "green".

## V51.9.104 — Photos from this device
- **📁 Upload from this device** replaces "Choose a photo" on the teacher's My avatar screen and in the student's My photo, where it is called "📁 From my phone" (both the Reel Studio and the admin's student list):
  - choose one photo or up to 12 at once from the phone's gallery or the computer's folders;
  - on a computer you can also drop photos onto the box or paste a copied picture (Ctrl+V);
  - the photos are ranked: a face, sharp, well lit and with enough pixels comes first, marked "best". Tap another to use it instead;
  - the face is found and the square crop starts on it, already zoomed in (this matters for a wide photo where the face is small). Drag and zoom still work as before;
  - clear messages:
    - a file that is not a photo is named;
    - files over 30 MB are refused;
    - iPhone HEIC photos that the browser cannot open come with the steps to share them as JPG;
    - when no clear face is found, it says so.
  - The photo stays on the device until Save, and the consent and guardian rules are unchanged.
- Reel Studio on phones: the page was wider than the screen (the left column did not shrink, and the content-kind menu was too wide), which pushed the My photo box partly off the screen. It now fits a 412 px phone.
- Tests: file checks (photo, HEIC, PDF, too big, empty, no file type), finding the face, and a starting crop that holds the face.

## V51.9.103 — "Use my own video" and AI Guru characters
Safe ways to get a good avatar without taking anyone's picture or voice from the internet.
- **🎬 Use my own video (teachers, My avatar).** Upload a recording of yourself, for example a class video downloaded from your own YouTube Studio, a clip saved from your own Instagram, or a phone recording. In the browser, with nothing fetched from the web, the app:
  - offers the 6 best stills for the photo (sharp, well lit, a face in the middle), and you pick one;
  - takes the clearest 10–15 s of speech as the voice sample, starting and ending in a pause and skipping distorted (clipped) audio;
  - writes down the words of that sample with the Gemini key saved on this computer, if there is one; otherwise you type them;
  - offers "✂ Use 8 s of it for the AI lip-sync" (the GPU-PC style).

  The "my own face and my own voice" tick is still needed to save. The warning now also names YouTube and Instagram content that is not you.
- **🧑‍🏫 AI Guru characters (teachers and students).** Six illustrated people who are nobody real: Asha Teacher, Ravi Sir and Fathima Teacher, plus Meenu, Arjun and Joel. They are drawn in code, with no image files.
  - The mouth and eyes are always in the same place, so lip-sync and blinking are exact without marking.
  - A teacher's character speaks with its own free classroom voice in English or Malayalam (the teacher's own voice sample is used instead when one is added).
  - On a student's phone, a character uses its own Gemini voice, still with the student's own key and opt-in.
  - Students need no photo and no guardian question for a character. The BYOK rule is unchanged: no key, no avatar.
  - The server accepts only known character ids, always uses the photo lip-sync style for a character (never the AI GPU style), and shares the character with students like a teacher's face.
- Tests: character drawing matches the lip-sync marks; still scoring (sharp vs blurred vs no face); the speech-window finder (finds speech, skips silence and clipping); the student rules for characters; and saving, rejecting and sharing a character through the routes.

## V51.9.102 — Reel styles that fit the lesson, "My style" favourites, closing cards in rotation
- **The style fits the lesson.** Each reel knows what kind of maths it is about: a sum, or algebra, geometry, data, calculus or a chapter intro (from the sum, the topic example's branch, or the chapter intro). Looks, camera and opener that suit that topic are 3 × as likely:
  - geometry → graph paper, night or ocean board, slow drift and close-ups, a "Did you know?" fact;
  - sums → notebook, chalkboard or kasavu, punch-in per step, a challenge or countdown;
  - chapter intro → night board or kasavu, drift.
  
  They are never forced: every look still turns up, the last-5-looks rule still wins, and only styling depends on chance (the maths and facts never do). A geometry reel in the browser landed on a geometry look 19 times in 30 shuffles.
- **My style (📌).** Each choice in *Make it different* (look, opener, ending, music, sounds, camera, Deepa's pose) has a pin. A pinned choice is kept on the phone and stays on every new reel, through 🎲 Shuffle, a new sum and a page reload, while everything else keeps changing. Choices that are not pinned reset to Auto on a new reel. A line shows how many are pinned.
- **Closing cards in rotation.** The short clip's closing card now has five versions in English and Malayalam: *Learn with AI Guru* · *Liked this trick?* · *Your turn to learn!* · *Made by Anu with AI Guru* (the student's first name; without a name it falls back to the first card) · *Study smarter* (Kerala syllabus). The reel's seed picks one. Every version keeps the student's join link and is spoken, and the QR card follows as before. The look gives each one its own colours and shape.
- New: `topicOf`, `TOPIC_FIT`, `pickFit`, pins (`loadPins` / `savePins` / `cleanPins`) in `variety.ts`; `END_CARD_VARIANTS` and `variant` / `name` options in `share/clip.ts`. Changed: `MotionReelStudio` (topic, pins, closing-card variant).
- Tests (added to `variety.test.ts`): topics read correctly; topic matches come up far more often (more than 60 %) while all 9 looks still appear, and less than 60 % without a topic; the last-5 rule still wins; pins keep only known values and hold while the rest changes; five different closing cards in each language, each with the link and three spoken lines; "Made by" uses the name and falls back without one; the share clip uses the given version. Checked in Chromium: a pinned look survives Shuffle, a new sum and a reload; five closing cards on different looks.

## V51.9.101 — Every shared reel different
Students' reels no longer all look the same. Each new reel gets its own **seed**, which picks its look, opener, ending, music, sounds, camera, Deepa's pose and pace. The same seed always gives the same reel, so the preview matches the MP4. **🎲 Shuffle** gives a new combination, and every choice can also be set by hand ("Auto" by default). The brand stays fixed (logo, the student's link, the footer in the same place), and the maths is never changed: only colours, cards and decoration change, and every look passes a readability check.
1. **Look packs** (Reel Studio → *Make it different*), 9 looks:
   - the looks: classic whiteboard · night board (3Blue1Brown style) · green chalkboard (chalk colours, wooden frame) · graph paper · notebook page (ruled lines, margin, punched holes) · Kerala kasavu (cream with gold border stripes) · sunrise · deep ocean · mint;
   - each look also sets its own colours, card shape (rounded / ribbon / sticky note / bubble), card font (serif; rounded Baloo 2 + Baloo Chettan 2; handwriting Kalam + Chilanka; all OFL), avatar frame (circle / rounded square / tilted polaroid with the name handwritten), transition between parts (cut / wipe / zoom / slide / chalk dust) and how captions arrive (fade / slide / pop);
   - **the phone remembers the last 5 looks the student downloaded and never picks them again.** A readability test checks every look: maths colours on the board ≥ 3:1 (carries ≥ 2.3:1, the classic orange's own level), captions and titles ≥ 4.5:1;
   - the classic look is exactly the old whiteboard, so the live class does not change;
   - the QR card always keeps black on white, so it still scans on dark boards.
2. **Openers** (the first 2 seconds), spoken and animated: *Challenge* ("Can you solve 478 + 356 in ten seconds?" with a 3-second timer) · *Countdown* (3-2-1-GO) · *Most get it wrong* (a real wrong answer struck out) · *Did you know?* (Deepa tells a true maths fact, including Indian and Kerala maths history) · *Watch me solve it* (only when a face is in the corner).
3. **Endings**: *Comment your answer* (a new sum of the same kind) · *Tag a friend* · *My toffees & streak* (count-up of the student's real numbers) · *Part 2 tomorrow* · *Quick-fire quiz* (three questions with answers). An ending that needs numbers the app does not have falls back to *Tag a friend*.
   - **Fixed: the closing "Learn with AI Guru" card and the QR card are now spoken too.** Before this, their lines were never sent to the voice, so every short clip ended with three silent steps that the MP4 check flagged.
4. **Personal touches**:
   - Deepa's pose in the opener and ending (waving, thinking, asking, cheering);
   - **badges** beside the student's details: real toffee count, day streak (2 or more), CLASS TOPPER (first on this week's class board), and the class name. Up to two on 9:16 and one on 16:9; switchable;
   - the class name also tags the weekly challenge.
5. **Sound**: four music beds (calm pad · upbeat arpeggio · Kerala percussion (chenda-like drum in 3+3+2, ilathalam ticks, drone) · lo-fi) and three sound packs (classic · soft · arcade). All are made in code (no audio files), and all are levelled and ducked under the voice as before.
6. **Seasons, on by date (India time)**: exam season (15 Feb – 31 Mar) · Vishu (10–16 Apr) · monsoon (Jun–Jul) · Onam (15 Aug – 15 Sep) · Children's Day (10–16 Nov) · Christmas (15–31 Dec).
   - Each season draws decorations behind the board, never over the maths: pookalam, konna flowers, star and snow, balloons, an EXAM SPECIAL ribbon, rain and an umbrella.
   - Each season also suggests its look (kasavu for Onam and Vishu …) and adds a greeting to the opener ("Happy Onam!" / "ഓണാശംസകൾ!").
   - "🎉 Onam theme on/off" switches it off for one reel. The dates are approximate and can be changed in `season.ts`.
7. **Reel types**:
   - *Spot the mistake* (sums): the real common mistake, struck out, then the lesson, then "Did you spot it?" with the reason: carry forgotten / smaller-from-bigger / row not shifted / 0 left out.
   - *Speed run*: the same lesson at 0.55× time, with a stopwatch and music.
   - *Same answer, two ways* (sums): a second method after the column method (make a round number / add the same to both / split the number / split into easy parts). Every line is computed, and a test checks each one.
   - *Malayalam ↔ English challenge*: both caption lines and a challenge opener.
   - *Teacher asks, I answer*: the class teacher's shared face asks in the opener, with lips moving only there, spoken by the classroom voice; the student's own avatar answers in their own-key voice.
   - *Weekly class challenge*: the same sum for the whole class all week (Monday–Sunday, India time), from the class code.
   - Types that cannot be made for the current reel are greyed out with the reason.
8. **Camera and pacing**: steady · punch-in at each step · slow drift · close-ups (zooms toward the item being worked on and back out). Only the board moves. Pace varies the gap between voiced steps (brisk / normal / relaxed).
- New: `look.ts`, `look-draw.ts`, `camera.ts`, `season.ts`, `variety.ts`, `recipes/hooks.ts`; look fonts in `public/fonts/reel` (+ `OFL-look-fonts.txt`). Changed: `draw.ts` (looks, cards, transitions, badges, duet face, stopwatch), `sfx.ts` / `audio.ts` (music beds, packs), `export.ts` (`style`), `share/clip.ts` (voiced end cards), `lipsync.ts` (per-range mouth tracks), `voice.ts` (`byokSkip`), `avatar-draw.ts` (frames), `fonts.ts`, `MotionReelStudio` (*Make it different* panel).
- Tests: `reels/motion/variety.test.ts` (22). Covers:
  - every look readable; classic unchanged; dark boards re-colour ink;
  - seeds repeat, vary (more than 35 different combinations in 40 seeds) and avoid the last 5 looks; a choice fixed by hand does not shift the others;
  - the avatar opener only with a face; seasons by date, including the India-time edge, and switchable;
  - similar sums, quick questions, the mistakes and the second ways all computed correctly; the weekly sum is stable within a week and changes between weeks and classes;
  - every opener and ending builds in English and Malayalam; opener, ending, end card and QR all voiced; each content kind adds its scenes; the speed run re-times every track and leaves the original untouched;
  - music beds and packs differ and stay quiet; the camera only moves the board; every look × season × frame × transition draws; the QR stays black on white on the night board.
- Checked in Chromium: all 9 looks with a teacher face and the student's photo and badges, and three MP4s (chalkboard + countdown + quick-fire quiz + Kerala percussion + close-ups; Onam + spot the mistake + the student's own avatar + short clip; speed run on graph paper at Christmas with arcade sounds). The MP4 check found no silent steps.
- Note: `math/teaching/offline-template-lesson.test.ts` ("text-overlap") fails on the untouched V51.9.99 too when run today. It is not related to this change.

## V51.9.100 — The teacher's face in the corner of reels, lips moving with the voice (a choice)
- **Teacher Portal → My avatar** (new menu item; open it with the class code + teacher key, as in "My class code"):
  1. **Photo** — camera or a picture, cut to a square. **Mark mouth & eyes**: drag the red oval onto the lips and the blue circles onto the eyes (mouth-width slider; blinking can be switched off).
  2. **Face style** — *Lips move on my photo* (any computer, no GPU: the mouth opens and closes with every word, teeth show on open vowels, eyes blink, the head sways a little) · *Photo only* (ring glows while speaking) · *AI lip-sync from a short video* (LatentSync on a GPU PC; 2–15 s face video; when that PC is off the reel uses the photo lip-sync).
  3. **Voice** (optional) — record or upload 3–25 s reading the sentence shown (Malayalam or English) and keep the exact words; reels can then speak in the teacher's own voice through IndicF5 on the AI Guru PC.
  4. **Consent** (required on every save: "this is my own face and my own voice … I can remove it at any time"; never a film star's or anyone else's) and **"My students may put my face on the reels they make"** (off by default; face only — see the student rule below).
  The **live preview** shows the bubble with the lips following a test voice, or the recorded sample with ▶ Play.
- **Reel Studio → "Face in the corner": Off / My face (teacher) / [Teacher]'s face / My avatar (student)** — off by default. On a teacher's computer: their own avatar, with "🎙 My voice / Classroom voice" when a voice sample exists. A signed-in student: their **own class teacher's** face only when that teacher shared it, and/or their **own avatar**. The preview shows the bubble exactly as the MP4.
- **Students: avatars only on their own phone, only with their own key (BYOK) — no surprise cost for the company.**
  - **Make my avatar** (Reel Studio): the student's own photo (V51.9.99 photo with the guardian's agreement and "show on my reels" on) + mouth/eye marks; lips drawn on the phone (free). Kept in the phone's browser only; nothing is uploaded.
  - The avatar's voice is **Gemini text-to-speech with the student's own Gemini key**, called from the phone (choice of 6 Gemini voices, "▶ Try my voice"). It needs a key in Settings → Your keys **and** the student's tick "use my own Gemini key for my avatar's voice — Google bills my key, not AI Guru" (the existing paid-voice opt-in). Without the key or the tick the avatar is paused and says why. If the key fails for a step, that step uses the free classroom voice.
  - **The AI Guru PC's teacher-voice worker and AI lip-sync are refused for students on the server (403)**, even when the teacher shares their avatar; a shared teacher avatar reaches students as face-only with the free lip-sync (no voice sample, no AI video).
- **Templates & videos → problem videos** — "My face in the corner" (the avatar saved on this computer; photo lip-sync).
- **Where the avatar appears: the regular class and MP4 downloads only — never on doubt clearing.** Motion Class gets a "Teacher's face" switch (the teacher's own avatar on their computer, or the class teacher's shared face for a student; face only, free lip-sync following the class voice), on the live board and in its MP4 download. The doubt-clearing boards (Teacher-Reading / 3B1B board with doubts, Ask my paper, doubt camera) are not touched.
- **Where:** a small round bubble with the teacher's name, bottom-right — above the caption on 9:16 and 1:1, beside the caption on 16:9 — never over the caption; not on the closing "Learn with AI Guru" / QR cards.
- **One clock for voice and lips** (idea taken from LatentSync): the voice clips are laid on the reel's timeline exactly as in the mix and every frame gets its own slice of sound → loudness (jaw, ring glow, a small nod), zero crossings ("ee"/"s" → wider mouth) and low-band energy ("oo" → rounder mouth); fast attack, slower release, shut in pauses. Preview and MP4 compute the same frames. The jaw is drawn through a feathered mask, so no seam shows. Blinks are deterministic (same in preview and MP4).
- **AI lip-sync path:** the reel's voice track (voice only, 16 kHz WAV) goes to the worker; the returned video is stepped frame by frame into the bubble (no real-time playback). A SyncNet score under 3 (LatentSync's own data rule), an error, or a worker that is off → the photo lip-sync, and the message says why.
- **Workers (optional, on the AI Guru PC):** `scripts/teacher-voice/indicf5_server.py` (port 8808, CPU is fine, offline after the first model download; English steps are left to the classroom voice because IndicF5 does not speak English) and `scripts/avatar-lipsync/latentsync_worker.py` (port 8809, NVIDIA GPU; uses **MediaPipe** instead of InsightFace for finding the face, because InsightFace's models are non-commercial; optional SyncNet check). Addresses: `AIGURU_TEACHER_VOICE_URL`, `AIGURU_LIPSYNC_URL`. Setup in `docs/archive/releases/AI-GURU-V51.9.100-TEACHER-AVATAR.md`.
- **Safety:** photo JPEG/PNG only (checked by bytes), voice WAV only (3–25 s), video MP4/WebM only (≤ 15 MB, 2–15 s); avatar ids checked before any path is made; avatars served `private, no-store`; a student of another class, or without a class, gets nothing; removing the avatar deletes photo, voice, video and settings at once.
- New (student side): `lib/ai-guru/student/avatar.ts` (rules, phone storage), `components/ai-guru/student/StudentAvatarEditor.tsx`; `callGeminiTtsClient` takes a voice name; `voice.ts` `byok` option + `pcm16ToClip`.
- New: `lib/ai-guru/teacher/avatar.ts` (rules), `avatar-store.ts`, `avatar-api.ts`, `avatar-client.ts`; `lib/ai-guru/reels/motion/lipsync.ts` (mouth track, blinks), `avatar-draw.ts` (the bubble); routes `teacher-avatar` (get / save / remove), `teacher-avatar/lipsync`, `teacher-voice`, `student-portal/teacher-avatar`; page `/ai-guru/teacher/avatar`, component `AvatarSetup`. Changed: `draw.ts` (`teacher` option, `teacherSpot`), `export.ts` (`teacher`, `faceVideo`, frame-exact `seekFrame`), `voice.ts` (teacher voice first, classroom voice as fallback per step), `make-video.ts`, `VideoMaker`, `MotionReelStudio`, teacher menu.
- Tests: `teacher/avatar.test.ts` — marks kept in the picture, consent + sharing rules, WAV/MP4/WebM checks; teacher saves with code + key (consent and photo required, AI style needs a video), wrong key refused, students see the avatar only when shared and only their own teacher's, students are refused (403) by the teacher-voice and AI lip-sync workers and see the shared avatar as face-only, the teacher's own voice and AI lip-sync go to the workers with the saved sample/video, a student's avatar needs photo + guardian + own key + voice tick, Gemini's raw voice becomes a reel clip, worker off → 503, remove deletes everything. `reels/motion/lipsync.test.ts` — shut in silence, opens with speech, closes after; "ee" vs "oo"; louder = wider; the lips move exactly while each step is spoken on a real reel; blinks short and deterministic. Checked in Chromium: setup → mark → preview → save; Reel Studio 9:16 / 1:1 / 16:9 frames; a VP9 MP4 with the lips moving and the eyes blinking; a student of the class sees the teacher's face; the AI path with a stand-in worker; on a phone-sized screen a student makes their own avatar, the voice comes from their own key (Gemini stubbed) and the reel's lips move — with zero calls to the teacher-voice or lip-sync workers.

## V51.9.99 — The student's photo on their profile, and on the reels they share
- **Add a photo** from the student's page (the round picture next to the name: "Add photo" / "Change"), from **My details** on the class boards, or from **Reel Studio** ("My photo"). Take a **selfie** with the front camera or **choose a photo**; cut it to a square — drag to move, slider to zoom, a circle shows what will be seen. Saved as a 512 × 512 JPEG.
- **Two switches decide whether it goes on reels:** "My parent or guardian agrees to my photo being shown on reels I share" and "Show my photo on the reels I share". The second can only be ticked after the first. Without both the photo stays on the profile. (Most students are children, and a shared reel travels far.)
- **On the reels the student downloads and shares** (Reel Studio, class videos, problem videos, offline class pack):
  - vertical 9:16 — a round photo beside the student's name, standard, school and place in the footer;
  - landscape 16:9 — a small round photo beside the details in the bottom strip;
  - square 1:1 (no footer) — beside the student's link under the title;
  - **the closing cards of a share clip** ("Learn with AI Guru" and the QR card) — a **"Shared by [photo] Anu Thomas · Std 8"** badge under the title ("പങ്കുവെച്ചത്" in Malayalam reels).
  Reel Studio's preview now shows the footer, details and photo exactly as the MP4 will (it showed the bare frame before). "My photo: On the reel / Off" switches it per reel without opening the editor. Teachers' problem videos never carry a student's photo.
- **Kept on the account and on the device:** for a signed-in student the photo is saved on the AI Guru server with their record (`data/ai-guru/admin/photos/<id>.jpg`) and copied to the browser, where the reel maker reads it (no network needed while exporting). A photo set on a device before signing in, or changed in My details on a board, is sent to the account the next time the student's page opens; a newer photo on the account comes down to the device; a photo removed by the student elsewhere or by the office is dropped from the device too (it is not sent back up).
- **Admin portal → Students:** each student shows their photo (a cyan ring = shown on reels). Tap it to add one for the student (e.g. from the admission form), change the switches, or **remove** a photo that should not be there. Deleting a student deletes their photo; editing the record keeps it.
- **Safety:** only JPEG or PNG pictures under 400 KB are accepted (checked by their bytes, not the name; SVG and others are refused); photos are served only to the student themself and the admin, never cached by shared caches (`private, no-store`); student ids are checked before any file path is made.
- New: `lib/ai-guru/student/photo.ts` (rules, crop, checks, the browser copy), `photo-client.ts` (cutting the square, the decoded photo for reels), `lib/ai-guru/admin/photo-store.ts` and `photo-api.ts`, routes `student-portal/photo` (GET / POST / DELETE, `?as=` for the admin) and `admin/students/photo`, components `PhotoEditor`, `StudentPhotoCard`; `photo` option on `drawReelFrame` / `exportMotionReelMp4`.
- Tests: `student/photo.test.ts` — both switches needed; JPEG/PNG only, size limit, a script disguised as a JPEG refused; the square stays inside the picture; a student adds, switches on, reads and removes their photo; another student cannot see it (and `?as=` works only for the admin); the office route is hidden from non-admins, adds a PNG, removes a photo (the removal is remembered); unknown and path-like ids refused; editing a student keeps the photo, deleting removes it. Checked in Chromium: the editor with a camera (selfie → drag → both switches → a 512 px JPEG saved), and reel frames with a photo in all three formats, the end card and the QR card.

## V51.9.98 — "Show your paper": hold a written page up to the camera and ask about it
- **New: Ask about your paper** — for handwritten notes, homework, a worksheet or a question paper, in any subject, in English or Malayalam. Opens from the 📄 button on the doubt dock (in every class), from the student page card "Ask about your paper", and from the menu ("Ask my paper", `/ai-guru/student/paper`).
  1. **Show the paper.** The back camera opens with a page frame. The app watches the picture and **takes the photo by itself when the paper is held still and sharp** (it waits 2 s first so the student can lift the page; it says "Hold the paper still…", "Not sharp — move the paper a little farther" or "Too dark — move to the light"). There is also a shutter button, a torch button on phones that have one, and **🖼️ choose a photo** (or take it with the phone's camera app). Up to 4 pages.
  2. **AI Guru reads it.** The photo is taken at the camera's full resolution (up to 2048 px, shape kept, not the small frame the live call streams), the paper is cleaned up (grey paper → white, pencil → dark, pen colours kept), and Gemini writes the page out **line by line, numbered, exactly as written — mistakes kept**, Malayalam in Malayalam script, maths in plain symbols (x², √, ÷), drawings described in one line, unreadable words marked [?].
  3. **The student checks the reading.** "This is what I read": lines with an unreadable word have an orange edge; **Fix** any line, remove it, or add a line that was missed. A blurry, dark or cut-off photo, or no paper at all, is reported with what to do ("Take it again").
  4. **Ask.** Type, tap 🎤 and speak (English or Malayalam), or one tap: 📖 Explain this page · ✅ Check my work · 💡 I'm stuck — a hint · 📝 Short notes · ❓ Quiz me · 🔤 What does this word mean? Each answer names the lines it talks about (they light up on the paper; tap "line 4" to jump to it), shows **each mistake on the paper as a card** (line, what is written crossed out, the correct version, why — and a wavy underline on that line), and offers two follow-up questions. Answers are **read aloud** with the classroom's own voice (Edge → Piper → Google → Sarvam, sentence by sentence; the browser's voice if none answers). EN / മല switch at the top. The photo and the conversation go with every question, so "why?" works.
  - Teaching rules: answer about this paper, quote it exactly, never claim it says something it does not, keep its numbers as written unless correcting them; point out mistakes only when sure (ask when a word was unclear); for homework, teach the method and give a hint first; inside a class, stay consistent with the chapter being taught (its text is passed in) and the class pauses while the sheet is open.
- **Live voice call:** with the camera on, a new **📄 Read this page** button takes one sharp still of the page held up now, reads it line by line and hands the reading to the live conversation, so the student can keep asking by voice after putting the paper down. A paper read in the sheet during a live call is handed over the same way. The live teacher's instructions now cover pages of notes in any subject, not only maths.
- Without a Gemini key but with the on-device picture model downloaded, the sheet skips the line-by-line reading and answers questions about the photo offline. With neither, it points to Settings.
- New files: `lib/ai-guru/doubt/paper/paper.ts` (reading and teaching prompts, tolerant JSON parsing, line fixes, line references in English and Malayalam, mistakes, one-tap questions, the note for the live call), `paper/image.ts` (sharpness, brightness, movement, auto-capture timing, clean-up), `paper/client.ts` (full-resolution still via ImageCapture or the video frame, photo files with their rotation, reading, asking, reading aloud, voice input), `components/ai-guru/doubt/PaperDoubt.tsx`, `app/ai-guru/student/paper/page.tsx`; `callGeminiClientContents()` (a whole conversation with pictures, key rotation) in `lib/student-key.ts`.
- Tests: `doubt/paper/paper.test.ts` (reading parsed from fenced JSON with a trailing comma, mistakes kept as written, plain-text fallback, retake cases, Malayalam and multi-page lines, fixing/removing/adding lines, quality messages; the teaching prompt carries the numbered paper, chapter and rules; answers with lines, mistakes and follow-ups, made-up line numbers dropped; "lines 3 to 5" and "വരി 2" found in plain answers; the photo goes once with the first question; sharp vs blurred writing, dark and moving pages, auto-capture timing, grey paper cleaned to white with black ink and full-range photos left alone). Checked in Chromium with a fake camera showing a handwritten homework page (English + a Malayalam line) at phone and desktop size: auto-capture, the cleaned photo sent, reading, fixing an unclear line, "Check my work" with two mistake cards and highlighted lines, a follow-up question carrying the conversation.
- Not checked here: Gemini's real reading of handwriting (no key or network on the build machine; the browser run used a fixed reply) — try a few real pages, including Malayalam handwriting, before telling students. Reading and answers use the app's text model (`gemini-3.1-flash-lite`); if it misreads handwriting often, a stronger Gemini model can be set for the reading step only.

## V51.9.97 — Every video checked before it is shared, and every soundtrack at one loudness
- **Self-check after every MP4** (Reel Studio, motion class, teaching board, teacher's problem videos, offline class pack). The finished file is opened again in the browser and checked: its **length** matches the reel; it **has a sound track** and is not silent; **every voice step can be heard** (a step whose voice failed to record, or a clip that came out empty, is named with its time: "Voice missing at 0:12"); no **blank picture** (one flat colour); no **stuck picture** (the same frame for 8 s or more — the whole video stuck is an error, a long still stretch is a note); notes for long silence in the middle, distortion, and sound that is too quiet or too loud. The sound is decoded from the file itself (the encoded mix is used only if the browser cannot decode it). If the browser cannot open the file at all, the video is still given and marked "Not checked".
- **Reel Studio:** a green "Checked ✓ 42.3 s · sound −14 LUFS" line under the buttons. When the check finds a problem the MP4 is **not downloaded automatically**: an amber box lists what is wrong, with **↻ Make it again** (when a voice step is missing it first asks the voice service again for only the missing steps — recorded steps are kept — then makes a new MP4) and **Download anyway**. **Share** on a flagged reel asks for a second tap ("Share anyway"), so a broken reel does not reach WhatsApp by accident.
- Motion class, teaching board and the offline pack add the check line to their "Saved …" message; the teacher's video list shows "checked ✓" or the problem next to each video.
- **Even loudness:** every reel and class soundtrack is measured the way YouTube and Instagram measure it (ITU-R BS.1770 / EBU R128 integrated loudness) and set to **−14 LUFS**, with a look-ahead limiter that keeps peaks under −1 dBFS (no clicks, no distortion). Each voice clip is first levelled to the same loudness (it was peak-normalised before), so steps voiced by Edge, Piper, Google or Sarvam sound equally loud and one reel is as loud as the next. Music-only reels are lifted at most 24 dB (they land near −16 LUFS). Live preview plays the same levelled mix. `mixReelAudio(…, { loudness: false })` and `exportMotionReelMp4(…, { check: false, loudness })` turn these off.
- New files: `reels/motion/loudness.ts` (K-weighting, gated loudness, limiter, clip levelling), `reels/motion/self-check.ts` (the checks, pure and tested), `reels/motion/self-check-browser.ts` (opens the MP4: length, frames, decoded sound); `unvoicedSteps()` in `reel.ts`. Written for AI Guru from the published standards; the idea of a post-render self-review came from looking at OpenMontage (AGPL) — none of its code is used.
- Tests: `reels/motion/self-check.test.ts` (published K-weighting coefficients; a full-scale 997 Hz tone reads −3.01 LUFS; gating; −14 LUFS with peaks under −1 dBFS; limiter leaves quiet audio untouched; clips from loud and soft engines level to the same loudness; reel soundtracks voiced and music-only; length, no track, silence, missing voice by time, an empty clip under the music bed, steps that never got a voice, gaps, distortion, quiet; blank and stuck frames; summary line). Checked in Chromium by exporting real MP4s: a good reel passes at −14.0 LUFS; a reel with one failed voice step and one with an empty clip are both caught with the right time.

## V51.9.96 — Colourful pictures for every subject: drawings, molecules, simulations and maps
- **One open-source library per subject**, chosen for school use, colour and licences that allow a paid app:
  - **Biology (and lab apparatus): Bioicons** — 1,507 colour SVG drawings (organs, cells, organelles, microbes, viruses, parasites, plants, animals, tissues, DNA, lab glassware, safety signs) in `public/ai-guru/visuals/bio/`. Only CC0, MIT, BSD, CC BY 3.0 and CC BY 4.0 drawings (no share-alike); each one is credited to its maker on the credits page. Optimised with SVGO; drawings with embedded photos or over 50 KB left out; nude human figures removed.
  - **Chemistry: SmilesDrawer** (MIT) — 63 school molecules (water, CO₂, alkanes to benzene, alcohols, acids, esters, glucose, sucrose, urea, amino acids, salts, soap, vitamin C…) drawn live from SMILES in bright atom colours (O red, N blue, S yellow, Cl green…), with English + Malayalam names and formulas. No image files.
  - **Physics (and some chemistry, biology, climate): PhET Interactive Simulations** (CC BY 4.0) — 51 HTML5 simulations (circuits, Ohm's law, induction, static electricity, forces, friction, energy, pendulum, lever, gravity and orbits, solar system, density, pressure, waves, refraction, lenses, atoms, pH, balancing equations, states of matter, natural selection, neuron, greenhouse effect…). They open from phet.colorado.edu in the student's browser on a tap (nothing is copied into the app; needs internet; Malayalam locale requested when teaching in Malayalam).
  - **Geography: Natural Earth** (public domain) drawn with **d3-geo** — world map in Natural Earth's **India point-of-view** edition (India's boundary as India claims it) and India's 36 states and UTs. Five colourful views: continents and oceans, heat zones (torrid / temperate / frigid with the tropics and circles), latitudes and longitudes (Equator, tropics, Prime Meridian, IST 82½°E), India's states, one state highlighted (Kerala and every other state), plus any of 34 countries highlighted when a paragraph names it.
- **Classroom: "🎨 Pictures for this page"** under the board — up to 8 pictures that match the paragraph being taught (chapter title + paragraph, English or Malayalam), best first, a colour card per subject; tap for the big view (zoomable drawing, large molecule with formula, full map, or "Start the simulation"). Hidden on locked parts.
- **Matching:** curated keywords for molecules, simulations and maps (English and Malayalam); rare words count more than common ones for drawings, plurals count a little less than exact words, everyday English words are ignored, at most two drawings per word so every topic of the paragraph gets one, the book's subject comes first (Science → biology/chemistry/physics, Social Science → geography). Malayalam endings handled by stems (അക്ഷാംശം → അക്ഷാംശവും), and common Malayalam science words map to English tags (ഹൃദയം → heart).
- **New page `/ai-guru/visuals` — "Pictures for every lesson / ചിത്രങ്ങളിലൂടെ പഠിക്കാം":** colourful gallery of all 1,625 pictures, subject tabs with counts, filters (drawings, molecules, simulations, maps), search in English or Malayalam, big view on tap. **`/ai-guru/visuals/credits`** lists every source, maker and licence (CC BY and PhET need this credit).
- Menu: "Pictures" added; "My Textbooks" now opens the library (V51.9.95) instead of the home page.
- New dependencies (add with `npm install`): `smiles-drawer` 2.4.1 (MIT), `d3-geo` (ISC), `topojson-client` (ISC), and their types for development.
- Tests: `visuals/visuals.test.ts` (unique ids, every SMILES parses, PhET links, chemistry/physics/geography/Malayalam matching, rare-word ranking, subject preference, gallery search). 130 tests pass. Checked in a browser: every map view, molecules, the classroom strip and the gallery.
- Not done / to check: PhET pages could not be opened from the build machine, so only long-standing HTML5 simulations are listed — open each once before going live; the maps follow Natural Earth's India view, but check against the Survey of India map before using them in exam papers; Servier Medical Art (CC BY, PNG) and ray-optics were not added (Servier could not be downloaded here; PhET covers optics); drawings are English-named (Malayalam search works through the word list).

## V51.9.95 — Study-material library ("cloud"): create in the admin portal, in your own settings or on the cloud; download by syllabus, one by one
- **One shared library on the server.** Every textbook uploaded in Material Studio and every material made for it is kept on the AI Guru server with who made it (admin, or a student — with their own key in Material Studio, or on the cloud). Students download the books of **their syllabus and standard**; a book made by one student is there for the next student of the same class. The same PDF is indexed once: a second upload of it (by anyone) gets the book already in the library, with its materials.
- **Sign-up asks Syllabus and Medium** (Kerala State, CBSE, Tamil Nadu, Karnataka, ICSE, other · English / Malayalam / Tamil / Hindi medium). After sign-up the student lands on **"Download your study materials"** (`/ai-guru/student/library`). Older accounts are asked for syllabus and medium there.
- **Student library page:** the textbooks matching syllabus + standard (own medium first; "show every syllabus" for others), each with its five parts and the materials in each (free part / 🔒), who made it ("AI Guru" or "Made by a student" — another student's name is never shown). **First pages:** the first four pages of the book to confirm it is the right textbook ("Is this your textbook?"), then **download one by one**: the textbook text, then each study material, with a ✓ per item; books queue and download one at a time. Downloaded books go to **My books** (server) and to this device (browser cache, so the classroom can open them when the network drops). Open in classroom, download again, remove.
- **Create it yourself:** (1) with your own Gemini key in Material Studio (Settings → key), or (2) **on the AI Guru cloud** when the admin allows it: upload the PDF without a key, then "Create on cloud" on any part the student can open — a daily limit per student; materials already in the library are not made again.
- **Admin portal → "Study materials":** upload a textbook (opens Material Studio as admin), **create on the AI Guru cloud** (book, part, material types → jobs run on the server, two at a time, with the same pipeline and QA gate as Material Studio; live status), **cloud settings** (the cloud Gemini key — kept on the server, never sent to a browser — or GEMINI_API_KEY; students may create on the cloud; materials per student per day; "check students' work before others see it"), and the **whole library**: every book with uploader, date, downloads, its syllabus / standard / medium (editable — students find books by these), the materials of each part with maker and QA score; hide / show / delete a material or a book.
- **Rules:** uploads and saving materials need a sign-in (student or admin) so the library knows who made them; a student cannot overwrite someone else's material; hidden books/materials are seen only by the admin and their maker; the student who uploaded a book opens all of it (they had the PDF), others get the free part until enrolled (V51.9.93); a student may create on the cloud only for parts they can open. Locks, plans and payments are unchanged.
- **Classroom:** "📥 My books · download study materials" in the Study Materials rail; books downloaded to the device open from that copy when the network fails. Links also on the student's page and in Settings.
- Server: the Gemini key pool now accepts a key handed in directly when it runs on the server (it is browser-only otherwise), so the cloud can run the same material pipeline.
- Tests: `library/library.test.ts` (syllabus/standard matching, cloud settings and key masking) and `library/library-api.test.ts` (sign-up syllabus → matching books → add; asking older accounts; upload needs sign-in and the same PDF is reused; materials saved under their maker, names hidden from other students, overwrite refused, hide, review; uploader opens the whole book; cloud: key needed, existing material reused, QA gate, student switch, daily limit, locked part refused; admin edits/deletes and My books follows). 120 tests pass.
- Not done: the cloud job queue is in memory (a restart forgets waiting jobs, never saved materials); page images are not saved to the device (the classroom needs the network for them); the whole-textbook view still teaches any PDF loaded from the device.

## V51.9.94 — Monthly and yearly fee plans in two registers, yearly reduction set by the admin
- **Two registers (databases) in the admin data:** `yearly` — one row per 12-month advance payment — and `monthly` — one row per monthly bill. Each row: student, first and last day, the monthly fee at the time (frozen), for yearly rows 12 × monthly, the reduction % and amount, the friend's/class code discount, the total, and the id of its fee bill. Old data files load with both registers empty.
- **New admin tab "Monthly & yearly":** monthly fee per standard (or "all other standards"), **yearly reduction %** (off 12 × the monthly fee, 0–90%) and **grace days**; a table of monthly vs yearly price and the saving for each standard. "New plan": pick a student, yearly or monthly, start date (defaults to the day after their last plan, or today) → the record and its bill are made. Then each register as its own list with totals (students on it now, collected, still due, yearly reduction given / overdue bills), search, status filter (paid, part paid, due, overdue, upcoming), **Record payment** and receipt printing on the row, Remove (only while unpaid), and a CSV download per register. "Make next month's bills" bills every monthly student whose month ends within 7 days (not those who moved to yearly).
- **Months run from the start date** (20 Oct → 19 Nov; a year 20 Oct 2026 → 19 Oct 2027; 31 Jan + 1 month = end of February). Two plans of one student may not cover the same day.
- **Bills are ordinary fee bills**, so they also show in Fees, receipts list "Yearly fee (12 × ₹1,000)" with the discount, the friend's commission is worked out on every payment, and the coupon discount applies (a % code on every bill; a ₹ code on the first bill only). The bill of a plan can only be removed from the plan tab.
- **Access follows the paid period:** a student with plan rows opens every part of every book while a fully paid month or year (plus the grace days) covers today; after that the status is **"Paid period ended"** and Parts 2–5 lock again until the next payment. A part payment does not open. Free seats never lapse; students billed only by term in Fees keep the old rule (the first payment enrols for good); centre pilots as before.
- **Students see both prices:** the student page shows "paid till …" and the next payment, or for a student on the free part / whose period ended: "₹900 a month, or ₹9,180 for a year in advance (15% off)" — after their code discount — with their Student ID. The classroom lock notice shows the same, and says "your paid period has ended" when that is the reason. The "Free part & enrolment" tab counts and labels lapsed students.
- Tests: `admin/plans.test.ts` (dates, prices with reduction and code discounts, bills, status, paid-through, overlap, access with grace and lapse) and `admin/plans-api.test.ts` (settings, yearly with friend's code → pay → all parts + commission, refused overlap, paid rows/bills cannot be removed, CSV; monthly → lapse after grace → next month's bill → pay → open; standard without a fee refused). 110 tests pass.
- Not done: online payment or auto-pay (the office records payments), reminders before a month runs out, pro-rata refunds when moving from monthly to yearly mid-month (the yearly plan starts after the paid month).

## V51.9.93 — Free trial = Part 1 of every book; Parts 2–5 and their study materials open when the student is enrolled
- **Replaces the day-based trial of V51.9.92.** Material Studio already splits every uploaded PDF into five parts. Now the free part (Part 1 by default) is the trial: anyone — visitor, new student, unpaid student — can study it in full: textbook pages, classroom teaching, whiteboard notes, MCQ, revision and every other material made for it. Parts 2–5 and their materials open when the student is enrolled. No days, no whole-page lock: Classroom, Reels, 3D Lab and Maths open for everyone again (the V51.9.92 page locks are removed).
- **Enforced on the server, on every route that serves book content**, for a student who is not enrolled while the lock is on:
  - `material-studio/sources/[id]`: the text of locked parts is left out (page numbers, chapter titles and the part map stay; chapter summaries of locked parts are removed). `document.parts` and `document.access` (free parts, locked parts, signed in, fee/due, Student ID) tell the classroom what unlocks.
  - `material-studio/materials`: each material carries its `part`; materials of locked parts come as stubs (title, type, part, first/last page) with no sections, overview or sources.
  - `material-studio/page-image/[id]`: a page of a locked part is a lock picture ("Page 15 · Part 2 — opens when the fee is paid"), never rendered.
  - `material-studio/pdf/[id]`: locked pages are replaced by blank "locked" pages of the same size (page numbers unchanged, none of their content copied — checked by extracting the text). Cached per book.
  - `material-studio/repair-page/[id]`: re-reading a locked page (which returns its text) is refused.
- **Who gets every part:** enrolled students (the first payment recorded in Fees enrols at once; or the admin's free seat), students of a tuition centre during its free pilot, and the admin. Visitors and unpaid students get the free parts.
- **Admin portal → "Free part & enrolment":** one switch (lock the other parts for students who have not paid), the school-wide free parts (Part 1 by default, any of 1–5), and every book with its five parts (pages, chapters, materials made) — click a part to make it free or paid for that book only, or go back to the school-wide setting. Totals (on free trial, enrolled, centre pilot, sign-ups who paid, friend referrals who paid), the newcomer list with how each came in, enrol a free seat / undo, CSV.
- **Classroom:** a part that is locked shows "🔒 Part 3 (pages 71–112) opens when you are enrolled. Part 1 is free…" with the fee and Student ID (or Sign up / Sign in for visitors), in English and Malayalam. ▶ Play, Teacher Reading and locked materials show that notice instead of teaching; Teacher Reading stops at the end of the free part instead of running into a locked one; a locked material is never auto-selected; the Study Materials rail shows locked materials with 🔒 and their part.
- Sign-up page and the student's page say what is free ("Free trial: Part 1 of every book, with whiteboard notes, MCQ and revision") and what to pay to open all five parts. Material Studio warns when it is opened without the admin sign-in while the lock is on (paid parts' text is not loaded, so their materials cannot be made).
- The five-part split moved from the Material Studio page into `lib/ai-guru/material-studio/parts.ts` (same algorithm) so the server uses exactly the parts the studio shows.
- Kept from V51.9.92: referrals always recorded (a friend's link never blocks sign-up), "Referred by…" for office students, payment enrols, free seats, flat or % friend's discount, per-class discount, the price table in Affiliates. Removed: trial days per standard/class, pay-first plans, the lesson-page lock.
- Tests: `material-studio/locks.test.ts` (parts, part of a material, what an unpaid student receives) and `admin/free-part-api.test.ts` (lock off = all open; visitor gets Part 1 only on sources, materials, page images, PDF and page re-read; new student → payment → everything; admin per-book free parts; free seat and undo; admin sees all). 98 admin/material-studio/share/public tests pass.
- Not done: the whole-textbook view's "load a PDF from this device" is not locked (it teaches the student's own file); online payment; the AI teaching APIs still accept any text a client sends (the locked text is simply never sent to an unpaid student's browser).

## V51.9.92 — (trial days superseded by V51.9.93) Free trials, enrolment after payment, referrals always recorded, discounts and commission set in the admin portal
- **Free trials per standard, with a class override.** New admin tab **Trials & enrolment**: switch trials on, give a standard (or "all other standards") N free days, and choose what standards without a trial do (lessons open as now, or locked until the first payment). In **Classes & centres** each class/centre can follow the standard's rule, have its own trial days, or "no trial — pay first"; the class's own rule wins.
- **Lessons lock when a trial ends unpaid.** Classroom, Reels, 3D Lab and Maths check on the server: a student whose trial has ended (or who must pay first) sees "Your free trial has ended", the fee after their discount (or what is due on their bill), their Student ID and where to pay; their progress is kept and they can still sign in. With "Lessons need a student sign-in" (on by default), visitors see Sign in / Start free trial / Free sample lessons. `/ai-guru/learn` sample lessons stay open. A small "Free trial: 2 days left" reminder shows in the last 3 days, and the student's own page shows the trial, the fee, or "enrolled".
- **Paying enrols.** Recording the first payment in Fees enrols the student at once (lessons unlock) and starts the friend's commission as before. The admin can also extend or give a trial, enrol a free seat with a note (scholarship, staff child) and undo it, set pay-first, or remove a plan.
- **Nothing changes until switched on.** Trials are off by default, and students who signed up before have no plan, so they are never locked.
- **Referrals are always entered.** A code that came from a friend's link no longer blocks sign-up when it gives no discount today (expired, affiliates switched off): the student signs up, is still recorded as that friend's referral, and the code is kept (`signupCode`). A typed wrong code is still refused. The Students tab shows the referring friend, and **Referred by…** lets the office link a student added at the office to a friend's or class code (or remove it).
- **Admin list of every newcomer:** how they came in (friend's link with the friend's name and code, class code, coupon, signed up directly, added by office), status (on trial · days left, trial ended unpaid, waiting to pay, enrolled · by payment or office, open), what they owe or would pay; totals for on trial, ending in 2 days, ended unpaid, enrolled and trial → paid %; filters, search and CSV download.
- **Discounts and commission in the admin portal:** the friend's discount can now be **% off every bill** or **₹ off the first bill** (Affiliates); each class can have its **own discount** (Classes & centres); commission %, per-student commission and payout day as before. Affiliates shows a **"What each standard pays"** table: fee from the fee heads, price with a friend's code, with a class code, and what the friend earns. The student's Refer & earn panel shows ₹ or % correctly.
- The sign-up page tells the student about the trial for the chosen standard (or the class code's own trial) before they sign up.
- Tests: `admin/enrolment.test.ts` (rules, dates in IST, status, gate, prices) and `admin/enrolment-api.test.ts` (off by default; link → trial → listed as friend's referral → trial ends → locked with discounted fee → bill → payment → enrolled + commission; class trial/none; extend/enrol/undo; link code never blocks sign-up; flat discount and price table; office sets referrer). All admin, share and public tests pass (88).
- Not done: online payment (fees are still recorded by the office); the AI lesson APIs themselves are not locked, only the lesson pages; no WhatsApp/SMS reminder before a trial ends; teachers who open the Classroom need a student account (give them a free seat).

## V51.9.91 — Join code next to every QR, and rich link previews for /j links
- **Join code beside the QR.** The QR card at the end of a share clip now also shows the student's code in big letters ("or type this code ANJA K7Q2 at <site>/j"), and the step caption says it. For a student watching on the same phone, on a TV or in a screen recording, who cannot scan. The QR still decodes from the frame (checked in portrait, square and landscape).
- **New page `/j`: "Enter your code".** A plain form (works without JavaScript): type the code with or without spaces or dashes ("anja k7q2", "ANJA-K7Q2") and it goes to `/j/ANJAK7Q2` → sign-up with the code filled in. `/j/CODE` itself now also accepts spaces and dashes.
- **The code everywhere the link is:** reel caption ("Code: ANJA K7Q2 — type it at …/j", because Instagram captions cannot be tapped), the quiz score card picture and its share text, and the class poster ("open …/j and type the code"). Reel Studio shows the student's code next to their link. Sign-up's coupon box now says "Friend's or teacher's code".
- **Rich link previews.** When a `/j/CODE` link is pasted into WhatsApp, Telegram, Facebook, X, Discord or LinkedIn, their preview robot gets a page with Open Graph tags and a 1200×630 invite picture (`/j/CODE/card`): "You're invited!" or "Join <class>", the code in a dashed box, the discount, and where to type it. People (including Instagram/Facebook in-app browsers) get the same instant 307 redirect as before.
- **Privacy:** previews never show the student's name (they are cached by the apps and seen by anyone the link reaches); a class name is shown only on class codes. An invalid or expired code gets the plain AI Guru preview.
- **Score card share** now uses the short `/j/CODE` link instead of `/ai-guru/student/signup?ref=…`, so it gets the rich preview too.
- **Set `NEXT_PUBLIC_SITE_URL`** in production: preview robots need absolute image links, and behind a proxy the request address may be internal.
- Tests: `share/join-code.test.ts` (code cleaning, code in QR card / caption / score card / poster, robot detection, preview page escaping, /j/CODE for people vs robots). Fixed two V51.9.90 tests in `public/lessons.test.ts` that still expected the end card to be last (the QR card is last since V51.9.90).
- Not done: Malayalam text inside the preview *picture* (the picture renderer cannot shape Malayalam; Malayalam is in the preview text instead); checking the preview on real WhatsApp (needs a public URL — WhatsApp caches a preview for a while, so test with a fresh code).

## V51.9.90 — Share videos with the student's affiliate link: on every frame, QR code, caption
- **Link on every frame.** New "My link" switch in Reel Studio (default on): the student's short link (`/j/CODE`) is written at the top of every frame of the video, in place of "@aiguru", in the preview and in the exported MP4. It survives forwarding, cropping from the middle and screen recordings. "Only in the end card" turns it off.
- **QR code at the end.** The short clip now ends with a big QR code of the link ("Scan to join", also in Malayalam) after the AI Guru end card; checked by decoding the rendered frames (portrait and landscape).
- **Caption always carries the link.** The share sheet text and the caption box now use the caption with the link and hashtags; new **📋 Copy caption + link** button for Instagram (which drops shared text).
- The short link `/j/CODE` (V51.9.7x) already sends the visitor to sign-up with the referral code remembered, so a friend who joins is credited to the sharer.
- Tests: QR modules and clip order. Not done: counting link clicks (only sign-ups are credited), posting directly to Instagram/YouTube (the phone's share sheet is used), real-phone check of the share sheet.

## V51.9.89 — Geography teaching DNAs, second set (Earth agent now has 8 templates)
- **Plate tectonics** (`plates`): convergent, divergent or transform boundary; plates slide, the landform forms (fold mountains, rift/new crust, earthquake zigzag); drift in km per million years computed from cm a year.
- **Winds and monsoon** (`monsoon`): land and sea heating; the app works out which side is low pressure and which way the wind blows from the two temperatures, so summer and winter monsoon come out right (rain only when the wind comes from the sea).
- **River courses and landforms** (`river`): upper, middle and lower course profile; slope in metres per km computed per course, steepest course found by the app; plan checked so each course starts where the last ended.
- **Map scale** (`mapscale`): 1 : n scale, distance on the map in cm → real km computed (reads "scale 1 : 250,000 … 4.4 cm" straight from the text).
- English + Malayalam captions for all; planner prompt lists all eight templates; works from the text without an AI key. Maths engine untouched. 7 new tests.
- Not done: soils/climate maps, India states map (needs a trusted map file), ocean currents.

## V51.9.88 — HyperFrames heading intros (eight looks, English + Malayalam)
- **Eight new intro looks** rendered with HyperFrames (HTML + GSAP → video, 5 s, 1080p): graph-draw, chalkboard, spinning globe, symbol rain, curtain reveal, atom, notebook, sunrise. Each picks fitting symbols for Maths / Science / Geography / other subjects; neighbouring headings never get the same look. Malayalam text uses the bundled Noto Sans Malayalam font.
- **Render tool** `tools/hyperframes-intros/build-intros.mjs`: renders one WebM per heading and writes `public/ai-guru/intros/manifest.json`; existing clips are skipped. Heading list comes from `compileClass(..., { onIntro })`, so look and file name always match what the class asks for. See the README in that folder.
- **Class plays the clip** when one exists for a heading (`introClips` option, loaded from the manifest when "3D heading intros" is on); otherwise the existing three.js intro plays, so nothing breaks before clips are rendered. MP4 export of a class still uses the three.js intro (clips play in real time).
- Tests: `intro-clips.test.ts` (look/key identical between app and tool, subject → look, manifest, class wiring).
- Not done: no clips are shipped yet (render them for your textbooks); WebM rendering is slow on small servers (about 1 min per clip on 2 CPUs); Hyperframes' version is pinned in package.json at 0.7.60 but was tested here with 0.8.174.

## V51.9.87 — Geography teaching DNA (Earth agent grows from 1 to 4 templates)
- **Cycles** (`cycle`): stages round a ring with labelled arrows and a dot travelling the loop. Built-in plans for the water, rock and carbon cycles; the AI planner can fill any 3–6 stage cycle (nitrogen etc.).
- **Seasons / orbit** (`orbit`): Earth at four places round the Sun, axis tilt 23.5° kept parallel; days per season and degrees per day are computed.
- **Latitude, longitude and time** (`latlong`): degree grid with places plotted from text like "10°N, 76°E"; time difference from Greenwich computed (4 min per degree).
- Layers (Earth interior, atmosphere) unchanged. English and Malayalam captions for all. Planner prompt lists all four templates; text-only fallback works without an AI key.
- Maths engine untouched. 5 new tests (computations, validators, text routing). Not yet: plate tectonics, winds/monsoon, landforms, map scale/contours.

## V51.9.86 — One Classroom: Live Class is the base, the whole-textbook class lives inside it
- **One classroom, one screen.** The Classroom page is now just the Live Class screen (subjects, search, textbook pages, teacher board, doubt pane, quiz and toffee buttons). The Live Class / Motion Class tabs from V51.9.85 are gone, and the name "Motion Class" no longer appears.
- **"📚 Whole textbook" button** on the subject strip (pinned at the left) opens everything the old Motion Class did inside the same screen: load a whole textbook PDF, reading order, questions in class, common mistakes, 3D heading intros, speed controls and MP4 / offline export. "← Back to the lesson" returns to the normal lesson view.
- Teacher quiz button appears once (not twice) in the combined screen. Left menu and header now say "Classroom".
- Old addresses still work: `/ai-guru` → `/ai-guru/classroom`, `/ai-guru/motion-class` → `/ai-guru/classroom?view=book`.
- Doubt pane and maths engine unchanged.
- Known: switching view unloads the other one (a loaded book must be reopened); not tested in a real Next.js run here.

## V51.9.85 — One Classroom button: Live Class and Motion Class on one page
- **One menu button, "Classroom".** The menu items Dashboard, Live Class, RAG Classroom and Motion Class (four buttons, three of which went to the same page) are now a single **Classroom** button. It opens `/ai-guru/classroom` with two tabs at the top: **Live Class** (the lesson with the teacher, camera/mic/text doubt pane, quiz and toffee buttons, board, textbook) and **Motion Class** (open a textbook PDF, taught on the whiteboard step by step, 3D heading intros, questions in class, exports).
- **Nothing removed.** Both classrooms are the same components as before and are loaded unchanged into the tabs (only their own top menu is hidden, because the page already has it). The doubt pane and the maths engine are not changed.
- **Old addresses still work.** `/ai-guru` opens the Live Class tab and `/ai-guru/motion-class` opens the Motion Class tab (they redirect), so saved links, the student page and the sign-in menu keep working. The page remembers the tab the student used last.
- Material Studio's own menu bar got the same single Classroom button.
- Switching tabs closes the other class (so no voice or video keeps playing behind the scenes); a book loaded in Motion Class has to be opened again after coming back.
- Not done: keeping both classes alive in the background while switching; the left-hand menu inside Live Class still lists its old placeholder names.

## V51.9.84 — "Teachers Notes" menu with a red dot, and teacher MCQs sent into the regular class
- **New menu item "Teachers Notes"** (top menu, and a card on the student page) opening `/ai-guru/teacher-notes`: the notes, shared worksheets and exams from the student's own teacher, newest first, with a red NEW tag on what they have not opened. Students with no class, and students of other teachers, see nothing from this teacher.
- **Red indicator on the menu.** A red dot with the number shows on "Teachers Notes" whenever the teacher has shared something the student has not opened yet (checked every minute, and cleared the moment the student opens the page). A newly shared note, a worksheet shown to the class, or an exam sent into class brings it back.
- **Teacher sends an MCQ into the regular class.** In the teacher's Exams tab, "Send into regular class" shows the exam, opens it and pops it up while the class's students learn (RAG Classroom and Motion Class): a red "📝 Quiz from your teacher" button. The student answers in a window without leaving the lesson, hands in once, and sees the mark and right answers. "Stop sending to class" removes the button.
- **Results go to the teacher's own database.** The mark lands in that exam's Results table (roll no., student no., name, mark, class average) in My class → Exams, with no change to how results were already kept. Only that teacher's students ever get the pop-up.
- The RAG doubt pane and the motion-class maths engine are not changed; the quiz button is one extra floating button added to the two class pages.
- Tests: class-content.test.ts extended (send into class, only the class's students see it, red-dot count, seen clears it, new share brings it back, in-class hand-in lands in results).
- Not done: scheduling an exam for a time, pushing the pop-up instantly (it appears within 30 seconds), WhatsApp/phone alerts for new notes.

## V51.9.83 — Teacher's class: roll numbers, student list with progress, own notes / templates / exams
- **Roll number inside each class.** Every student who joins a teacher's class gets a serial (1, 2, 3 …) in joining order, never reused. Students who joined before this version are numbered the first time the teacher opens the class. The student sees "your roll number is N".
- **Teacher's student list** (My class page): roll no., the AI Guru student number (ST-123-26), name, standard, quizzes taken, score %, toffees, chillies, topics the student needs help with, last active day.
- **Notes, templates and exams, per teacher.** The teacher writes notes, keeps private templates (worksheet, revision plan, with starters to copy) and makes multiple-choice exams (2–5 answers per question, a right answer marked, optional explanation, minutes). Each item belongs to that teacher's class only: the server checks the class on every read, hand-in, edit, copy, delete and result, so another teacher's students (or students with no class) never see it, and another teacher cannot touch it.
- **Show / hide / open / close.** Notes and exams are shown to the class when saved; templates stay private until the teacher shows one. Exams open and close with one click. Students hand an exam in once; the mark and the right answers come back straight away. The teacher sees every student's mark with roll no. and student no., and the class average. Questions of an exam that has been taken are locked (copy it to change them).
- **Student page:** a new "From <teacher>" panel lists what the teacher shared, with the exam form.
- Teachers still open their class with the class code + 6-digit key (no separate teacher login yet). Data is in `data/ai-guru/admin/class-content.json`.
- Tests: `admin/class-content.test.ts` (rules, plus an end-to-end test with two teachers: visibility, no cross-class access, one hand-in, results, locking).
- Not done: file / image attachments on notes, timed auto-close of exams, short-answer questions, seeing a student's whole history from the roster row.

## V51.9.82 — Student and teacher numbers: ST-123-26, TE-34-26
- **Every new student gets a number like `ST-123-26`**: ST = student, 123 = the 123rd student who joined that year, 26 = the year (Indian time). Teachers get `TE-34-26` the same way. The count restarts each January; the year in the number keeps every number unique.
- Students sign in with their ST number (any letter case) and password, as before. The number shows on the student page, the sign-up welcome message, and the admin lists.
- **Teachers:** each teacher gets one TE number, kept for all their classes (matched by phone number, else name + school). It shows in the admin Classes tab and on the teacher's class page. Classes made before this version get their teacher numbers automatically the first time the admin Classes tab opens, numbered by the year the class was made.
- **Existing students keep their old `AIG0042` ids** so nobody is locked out; those still work for sign-in. New students from now on get ST numbers.
- Numbers are saved in a counter, so a number is never given twice, even if a record is deleted. Tests: `admin/member-codes.test.ts`, plus teacher-number checks in `classes-api.test.ts`; sign-up tests now expect ST numbers.
- Not done: a separate teacher sign-in account (teachers still open their class with the class code and the 6-digit key); the TE number is their identity label for now.

## V51.9.81 — Six different 3D heading intros
- **No two neighbouring headings look alike.** The 3D heading intro now has six looks: **Tunnel** (blue grid, symbols rush past), **Orbit** (violet/cyan rings with circling symbols), **Skyline** (amber towers grow behind the title), **Galaxy** (spiral galaxy, camera warps in, title bursts from the centre), **Cards** (a wall of cards flips over, then the title lands) and **Waves** (rolling coral wave with rising symbol bubbles). Each has its own colours, camera move and way the expression and title arrive.
- Each heading takes the next look in turn, starting from a point that depends on the chapter, so a student never knows what comes next. English and Malayalam intros of one heading share a look.
- Same 3D toggle, same 2D fallback, same timing (expression about 1–2.5 s, title about 2.5 s, topics line about 3.2 s). Preview and MP4 export still draw identical frames.
- Tests: heading-intro.test.ts now also checks that consecutive headings get different looks.

## V51.9.80 — 3D heading intros for the whiteboard class
- **Every heading now opens with a short 3D intro (about 5 seconds):** symbols stream through a glowing grid tunnel, the chapter's key expression flies in with sparks (e.g. Polynomials → `P(x) = 3x⁴ − 2x³ + 5x − 7`), then the title lands with a flare and the topics line fades up. English and Malayalam each get their own intro; subject decides the symbols (maths, science, general).
- **Works for any subject.** The key expression comes from a fixed keyword table (polynomials, quadratics, linear equations, progressions, circles, triangles, fractions, statistics, probability, trigonometry, solids, coordinates, ratios, sets, matrices, algebra); headings with no match get the tunnel and title only.
- **Toggle "🎬 3D heading intros"** in the class options (on by default). Off = the class is exactly as before. The intro is its own segment (pill INTRO / ആമുഖം) so it can be played, skipped or exported with the rest.
- Preview and MP4 export draw the same frame for the same time (pure function of time, seeded), so exports match the preview. If the device has no WebGL, the intro falls back to a night-blue 2D title card.
- three.js loads only when the intro is needed. The motion-class maths engine and the doubt pane are not changed.
- Tests: `motion-class/heading-intro.test.ts`.
- Not tested here: MP4 export of the 3D frames in a real browser, and sound on export (checked only by headless screenshots).

## V51.9.79 — 3D Lab (three.js): solids, atoms and molecules, solar system
- **New page `/ai-guru/lab3d`** (also linked from the student page and the public lessons page), English or Malayalam. three.js loads only on this page (dynamic import), so the rest of the app is not heavier. Drag to turn, scroll or pinch to zoom; if the device has no WebGL a plain message is shown.
- **Solids:** cuboid, triangular prism, cylinder, cone, sphere with size sliders, **Slice it** (a plane cuts the solid parallel to the base and says the shape and area of the cut; the cone's circle shrinks, the sphere's is biggest in the middle) and a see-through mode. Volume and surface area come from the same `solidFacts` the Solids DNA board uses, so the lab and the lesson agree.
- **Atoms and molecules:** atoms 1–20 with shells and orbiting electrons (2-8-8-2 rule), and ball-and-stick H₂O, CO₂, CH₄, NH₃, O₂ with the real bond angles.
- **Solar system:** the eight planets with real orbit periods and a speed slider; distances and sizes are squeezed to fit (said on the page).
- Existing features, the Solids DNA board and manim-web are not changed. Added dev dependency `@types/three`; `three` was already listed. Run `npm install`.
- Tests: `three-d/three-d.test.ts` (volumes, sections, shells, bond angles, Kepler's third law).
- Not done yet: unfolding nets in 3D, 3D inside the Motion Class lesson board, more science models (cell, human body).

## V51.9.78 — Habit and trust: daily challenge, exam packs, festival contests, public numbers, safety note
- **Daily five-minute challenge** (`/ai-guru/learn/daily`): five questions from five lessons, the same for everyone each Indian-time day, with a day streak, a daily 5 pm calendar reminder (.ics) and a "challenge a friend" WhatsApp message. Toffees and chillies count like the classroom.
- **Revise in 10 minutes** (`/ai-guru/learn/revise`): a printable one-page pack for every chapter: key points in English and Malayalam, worked examples with tap-to-reveal answers, and a 3 + 4 + 3 minute plan. Built from the lesson itself.
- **Festival contests** (`/ai-guru/learn/contest`): Onam (18 Aug–15 Sep), Children's Day (10–16 Nov), Christmas (18–26 Dec), Republic Day (20–27 Jan), five themed bilingual questions each, ×2 toffees while open, a leaderboard (most right, then fastest; first name + last initial) and a downloadable **winners' card**. Entry needs a student sign-in, only while the contest is open, one entry each (best counts). Onam moves each year, so its window is wide.
- **Real numbers and testimonials** on the public lessons page: students, quizzes, toffees and schools are counted from the data (a zero is hidden); testimonials appear only when the admin has typed one for a class or centre (Classes & centres tab).
- **"How your child's data is kept safe"** (`/ai-guru/safety`), linked from the sign-up and lessons pages. Have it checked against your own practice and your legal advice before launch.
- Sitemap now lists the new pages.
- Tests: `public/phase4.test.ts` (daily set and streak, IST rollover, reminder, contest answer keys and windows, contest API, public stats).

## V51.9.77 — Schools: class codes, teacher rewards, leaderboards, tuition-centre pilots, poster
- **Class and centre codes:** Admin → **Classes & centres**. Make a class or a tuition centre; it gets a join code (also a coupon: students who join with it get the class discount, default 10 %, and are counted for the teacher) and a private 6-digit **teacher key** shown once (stored hashed; "New teacher key" replaces it). Class codes work with the `/j/CODE` link and the sign-up page, which says "Joining Class 6B". Switching a class off stops new joins.
- **Teacher rewards:** tiers set by the admin (default 10 / 25 / 50 students joined). A tier shows *earned* when reached; the admin presses **Mark given**. Tiers and discount are editable in the same tab.
- **Teacher page:** Teacher portal → **My class code** (code + key): joined, active this week, invite link, WhatsApp share, printable **poster with QR code**, reward progress, weekly star-point table.
- **Fair leaderboards:** star points reward effort and improvement (10 per quiz up to 10, improvement over the previous 4 weeks up to 25, 5 per chilli turned into a toffee, 3 per streak day up to 7), not only top marks. Students see first name + last initial, their rank and a class top 5 ("My class" on the student page). Schools are ranked by the *average* points of all their students (at least 3 students), so a big school does not win by size.
- **Tuition-centre pilots:** a centre can have a free-pilot end date and a testimonial (used on the landing page in the next release).
- New dependency: `qrcode-generator` (run `npm install`).
- Tests: `admin/classes-api.test.ts` (rules, leaderboard, create → join → discount → rewards → teacher view → key check).

## V51.9.76 — Reach: share clips, free sample lessons, link previews, search pages
- **Share clip (Reel studio):** new "Share clip" row: **Short clip + my link** keeps up to 40 s of the lesson (whole parts only) and adds an AI Guru end card (what the app is, "Join: yourdomain/j/CODE"). The caption button then copies a ready post text with hashtags. Off by default; the full video path is unchanged.
- **Short invite link** `/j/CODE` → sign-up with the friend's code filled in. Short enough to read out in a video or type from a poster. Bad codes land on plain sign-up.
- **Free sample lessons, no sign-up:** `/ai-guru/learn` and 6 lessons (Class 4–7 Maths and Science), English and Malayalam on one page, with a 3-question quiz that earns toffees and chillies (counters shown). "Share this lesson" and WhatsApp carry the student's own referral code; a friend's `?ref=` is remembered for sign-up. Answer keys are re-computed in tests.
- **Link previews:** the app now has a proper title, description and Open Graph / Twitter card (picture generated), per-lesson previews, and a sign-up page preview for invite links. Set `NEXT_PUBLIC_SITE_URL` to your real address in production.
- **Search pages:** `sitemap.xml`, `robots.txt` (lessons open; API, admin, student, teacher and parent pages closed), canonical links and schema.org LearningResource data on every lesson.
- Tests: `public/lessons.test.ts` (content, answer keys, clip trimming and end card, invite link).

## V51.9.75 — Share loop: score card, weekly WhatsApp report, streaks and badges, chilli redemption
- **Score card:** after every quiz the student gets a picture card (score ring, toffees, chillies, streak, their own referral link) with **Share** (the phone's share sheet with the picture), **WhatsApp** and **Save picture**. English or Malayalam to match the classroom.
- **Weekly parent report:** Parent portal → "This week": quizzes, average, toffees, chillies, weak topics, streak, best quiz, as a ready WhatsApp message in English or Malayalam (Send on WhatsApp / Copy).
- **Streaks and badges:** a 🔥 day streak (Indian time, alive until the day after the last quiz) and 10 badges (first quiz, 5 / 25 quizzes, 50 / 100 / 250 toffees, perfect box, 3 / 7-day streak, Chilli master) with progress bars, in the Student portal and the Parent portal. Earned badges print as a certificate.
- **Chilli to toffee:** the Quiz button now offers "Turn my chillies into toffees": missed questions come back; each one answered right turns one chilli into a toffee, once per question. The server re-checks that the questions are real, missed, the student's own and not redeemed before; the toffee count comes from that check, not from the browser. A redo is practice, not a quiz (no change to quiz counts or averages). Counters, parent, teacher and student views all show the net chillies. Quiz records now keep the four choices and the explanation so questions can be redone.
- Tests: `share.test.ts` (streaks, badges, weekly report, score card, redo rules and the server check).

## V51.9.74 — Toffee and chilli rewards, counters on screen, reported in every portal
- **Chilli:** a right answer in a quiz earns a toffee (golden question 2, streak and perfect-box bonuses as before); a **wrong answer now earns a chilli**. Shown with a pop-in on the answer card, in the progress bar slot, in the quiz header and in the end summary ("1 chilli"). English and Malayalam.
- **Always-on counters:** toffees at the **bottom left** and chillies at the **bottom right** of the classroom and of the student portal. They move the moment an answer is given (also above the quiz window), are kept per student on the device, and are raised to the server's total when the student is known, so they never go down and stay right on another device. The Quiz button sits just above the toffee counter. Nothing else in the classroom or the doubt pane was changed.
- **Server:** every saved quiz now carries chillies (counted by the server from the answers, not trusted from the browser; older records are counted from their wrong answers). Roll-ups return `chillies` next to `toffees`.
- **Reported in the other portals:** Parent (new "Chillies" tile and per-quiz counts, toffee/chilli mark on every question), Teacher results (class chillies tile, per-student column), Teacher attendance (tile, column, CSV), Teacher questions (chillies per student), Student portal (Chillies tile and counters), Admin "view as student" and "view as parent".
- Tests: `rewards.test.ts` (scoring, server recount, old records, counters never go down, seeding), `mcq.test.ts` updated.

## V51.9.73 — Affiliate marketing (refer & earn)
- **Every student gets a personal link and code** (e.g. `/ai-guru/student/signup?ref=ANJAK7Q2`), shown on the student dashboard in a new **Refer & earn** panel with Copy link and WhatsApp / Telegram / Facebook / X / share buttons.
- **A new student who opens the link gets the sender's code filled into the sign-up form automatically** ("Referred by Anjali · 10% off fees"). The code is remembered on that device until sign-up, the new student becomes the sender's referral, and gets a link of their own.
- **Commission:** every fee payment the office records for a referred student earns the sender a commission (rate frozen on that payment). It is paid on the **4th of the next month** (admin can change the day). Status: Pending → To be paid → Paid.
- **Sender's report:** students joined, earned / pending / to be paid / paid, next payout date, payout by date, and every referred student with billed, paid, pending and each payment (date, amount, commission, payout date, status). Guardian phone and address are never shown.
- **Admin → Affiliates tab:** settings (on/off, commission %, friend's discount %, payout day; changing them updates every referral coupon), affiliates table with earned / pending / to pay / paid, per-student commission rate override, **Mark paid** with a payment reference (payout history kept), commission ledger CSV, and **Student revenue**: billed, discount, paid, pending, commission generated and net revenue for every student, with each payment expanded.
- Personal codes are kept out of the Coupons tab. Defaults: 10% commission, 10% friend discount, payout on the 4th.
- Tests: `affiliate.test.ts` (rules), `affiliate-api.test.ts` (link → referral → discount → commission → report → payout → settings).

## V51.9.72 — Student sign-up with coupon codes
- New page `/ai-guru/student/signup` (also linked from the student sign-in and every portal's Sign in box): **Name, Standard, School, State, District, Place, Password, Confirm password, Coupon code (optional)**. State → district dropdowns come from the states-and-districts dataset. The student is signed in at once.
- Every student now has a **Student ID** (AIG0001, AIG0002 …). Students sign in with the Student ID (or the admission number the office gave) and their password; the dashboard shows the ID and, after sign-up, a welcome box asking them to write it down.
- Coupons: admin → **Coupons** tab makes codes (percentage or rupee amount, max uses, expiry, note, on/off; used ones can only be switched off). The sign-up page checks the code live. A coupon is saved on the student and its discount is taken off their fee bills automatically: a percentage coupon on every bill, a rupee coupon on the first bill only (the invoice records which coupon). Admin → Settings can make a coupon **required** for sign-up.
- Admin Students list: self sign-ups are marked, with Student ID and coupon shown. Passwords the office makes are now called passwords (not PINs). The address no longer needs a house line or PIN code (place, district and state are enough; a PIN code, if given, must be 6 digits).
- Forgot password: Student ID plus the parent's mobile **or the student's full name** (self sign-ups have no parent mobile); the admin still hands over a new password.
- Safety: sign-ups are limited per address, wrong coupon guesses count against the caller, passwords are stored as scrypt hashes, a student with the same name, standard and school cannot sign up twice.
- Tests: `student-login.test.ts` (sign-up, validation, coupon limits, discounts, required-coupon switch).

## V51.9.71 — Student login, wired to fees, details and progress
- New page `/ai-guru/student`: a student signs in with the **admission number and a PIN**. The same details also work in the Sign in box of every portal (the admin's `xxx` / `yyy` still opens the admin portal).
- After sign-in the student sees only their own record: fees billed / paid / still to pay, every invoice with its payments and printable receipts, quiz progress (quizzes, average, toffees, weak topics), their details and address, and the parent code for the Parent portal. Payment itself stays at the school office; it shows here once the admin records it.
- Wiring: signing in sets this browser's student id, name and profile (name, standard, school, place) to the registered student, so quizzes, attendance and the name/school on downloaded MP4s all carry the right student.
- Admin → Students: **Make PIN / New PIN** (a 6-digit PIN shown once; stored only as a scrypt hash), **Block**, **View** (admin sees the student's page, nothing changes on any device), admission numbers must be unique, and the list never exposes the hash. The admin menu links to the student sign-in.
- Forgot PIN: under the sign-in form, a student enters the admission number and the parent mobile number the school has; a match puts a request in the admin Students tab ("Students who forgot their PIN" → Make new PIN). The answer is always the same, so it reveals nothing.
- Safety: a separate signed httpOnly cookie, 5 wrong tries lock that address for 15 minutes, wrong details always get the same bare answer; `?as=` works only for the admin.
- Receipts share one printable template (`lib/ai-guru/admin/receipt.ts`) between the admin and student pages.
- Tests: `student-login.test.ts` (PIN, hidden hash, own-fees-only, forged cookie, `?as=`, block).

## V51.9.70 — Admin portal (hidden): fees and address management
- No admin card or link anywhere. A new **Sign in** box (top bar of the classroom and every page, and the header of the teacher and parent portals) takes a username and password; the admin's details open `/ai-guru/admin`. Any other details get the same plain "not recognised" answer, so the portals never show that an admin exists. The admin API answers 404 to anyone not signed in.
- Admin sign-in (development stage): username **xxx**, password **yyy** unless `ADMIN_USERNAME` + `ADMIN_PASSWORD` are set in the server environment. Change it in Admin → Settings (stored as an scrypt hash) before deployment.
- A signed-in admin goes through every portal freely: the Sign in box becomes an "Admin ▾" menu (Admin portal, Student classroom, Teacher portal, Parent portal, Sign out), and the parent portal lets the admin pick any student instead of typing a parent code. Signed httpOnly cookie, 8 hours; 5 wrong tries lock that address for 15 minutes.
- Students & addresses: add / edit / delete students with guardian and home address (state → district dropdowns from the MIT-licensed *indian-states-districts* dataset, 6-digit PIN check), import the students found in quiz results, school address.
- Fees (modelled on the fees module of ScholarOS, MIT): fee heads per standard, invoices for a whole standard or one student, discounts, due dates, partial payments with numbered receipts (printable), statuses paid / partial / pending / overdue, totals, "who owes most", fee register CSV. Money is counted in paise (no rounding drift); no overpayment; a student or invoice with payments cannot be deleted.
- Students tab: each student has a school (suggestions from schools already entered), and the list filters by state, district and school (only places that have students, with counts; district list follows the state).
- Admin dashboard: fees collected vs due by standard, collected each month (last 6), students by district (and how many lack a full address), latest receipts, who owes the most.
- Data is kept in `data/ai-guru/admin/` (add it to backups; keep it out of git).
- Tests: `src/lib/ai-guru/admin/` (pure fee and address rules, plus sign-in, hidden routes, lock-out, fee flow).

## V51.9.69 — Subject agents: physics, chemistry, biology, earth science, computer science
- New layer `src/lib/ai-guru/subjects/`: every subject is its own agent (claim, plan, validate, build). The maths engine (motion-class) is untouched; blocks no agent claims go through it exactly as before, and `compileMixed` equals `compileClass` when no agent claims anything.
- Orchestrator: all agents score each block in parallel; the most confident one (≥ 0.5) plans it, from the AI when a key is set (one retry with the validator's reasons) or straight from the text. Equation blocks always stay with maths. A failing agent is isolated and its block falls back to maths.
- Templates (every number on the board is computed by the app): physics force-diagram (net force, a = F ÷ m) and motion-graph (v–t slope, area); chemistry balance-equation (atoms counted, coefficients found); biology food-chain (10% energy pyramid); earth layers (to-scale bands, totals, percentages); computer-science array-sort (the sort is run, compares and swaps counted). All captions English + Malayalam.
- MotionTeachingBoard plans subjects after the maths plans and compiles with compileMixed; the step rail works for these scenes too.
- Tests: src/lib/ai-guru/subjects/subjects.test.ts.

## V51.9.68 — One set of step buttons everywhere in the regular class
- The step rail (# pause, √ next step, ^ previous step, ⟲ start again) sits beside every board in the regular class for every maths template; a test now checks that every template gives it numbered steps with captions.
- The older board's per-step icons use the same ⟲ "start again" glyph (was ®), and the legend above it reads "# pause · √ continue · ⟲ start again · ^ move up / down".

## V51.9.67 — Logo and student details only on downloads; step rail in the live class
- The ship's-wheel logo in the title card, the AI Guru footer and the student details are drawn only in a downloaded MP4 (`DrawOptions.download`); the live class shows none of them. Vertical downloads keep the full footer; landscape downloads (the classroom's own) get a slim strip under the caption: logo and name left, student's details right.
- The "My details" button left the class page; it is now a small "👤 Details" button beside "⬇ MP4" on the problem board.
- New step rail at the right of each board: the short caption of the current step, "Step n / N", and four buttons: # pause / carry on, √ next step, ^ previous step, ⟲ start again from the beginning (under the board on narrow screens).

## V51.9.66 — Moving digits, rings, AI Guru footer and student details on the MP4
- Beam scale: digits that carry over now fly from the line above to the new line (2x, 25, 5, 20, 2…) instead of the new line simply appearing; new digits and signs fade in after they land.
- Focus: thin rings in the digit's own colour (red 2, purple 5, green 25) replace the yellow blobs; "+5" is ringed before it moves, "−5" after, the right side before it is simplified, the divisor, the answer.
- The question stays pinned in the title card; the working fills the board under the scale and scrolls up (older lines glide up and fade at the top) only if it would not fit; all steps stay on one screen.
- Vertical MP4s get a footer: AI Guru logo + "See the maths. Understand it.", the student's details (Name · Std, School, Place) and a "Follow for daily maths tricks" pill; the caption box moves up to make room. Off for square/landscape; `footer: false` turns it off.
- New "My details" button in the classroom (name, standard, school, place), kept in this browser only (`lib/ai-guru/student/profile.ts`).
- Offline captions in the reel's style (one idea per step).

## V51.9.65 — Beam-style balance scale (focus rings, aligned working)
- The balance-scale template now looks like the reference reel: a flat beam on a triangle with the tiles standing on it (x tiles, numbers), the working written line by line underneath with the "=" signs lined up, older lines fading, a fraction for the division, and a boxed answer with a tick.
- The digits and signs a step is working on get a yellow blob and a red ring (the "+5" before it moves, the "−5" after, the 2 in "÷ 2", the answer). Extra x tiles and pieces fade to ghosts when one group is kept.
- The old tipping-pan scale is still there: set `look: "pans"` in the plan. Default is `beam`.
- Offline captions are short, one idea per step ("+5 മറുവശത്തേക്ക് മാറ്റുക. അത് −5 ആകും.", "20 ÷ 2 = 10"); the notes beside the lines are Malayalam in Malayalam classes.
- Files: `dna/beam-builders.ts` (new), `dna/builders.ts`, `dna/types.ts` (`BalPlan.look`), `plan/offline.ts`, `balance-scale.test.ts`.

## V51.9.64 — Attendance register and teacher-made questions (teacher portal)
- `/ai-guru/teacher/attendance`: for each day (or 7 / 30 days) every student's first entry, last exit (or "in class"), time actually in class, visits, quiz score and toffees; students seen before but absent; open a row to see the questions; download as CSV for Excel. The classroom records start / beat / end (`AttendanceBeacon`, `/api/ai-guru/attendance`, file `data/ai-guru/attendance/sessions.json`); time is taken from the server clock and counts only while the page is open and in view; a closed tab is shown as left at its last beat.
- `/ai-guru/teacher/questions`: write multiple-choice quizzes (or let the AI draft some to check), mark a golden question, hide / show a quiz, and see each quiz's results per student; a "Toffees by student" table splits toffees from your quizzes and from surprise quizzes. Stored in `data/ai-guru/teacher/question-sets.json` (`/api/ai-guru/question-sets`).
- Students: the Quiz button offers the teacher's active quizzes next to the surprise quiz; results carry `setId` / `setName`.
- One teacher menu (Results, Attendance, Questions & toffees, Templates & videos) on every teacher page.
- No sign-in yet: the answer key of an active quiz can be read from the network by a student who looks for it.

## V51.9.63 — DNA selection screen and videos in the teacher's own style (teacher portal)
- New teacher screen `/ai-guru/teacher/dna` (link on the teacher page), four tabs:
  - Selection test: paste a problem, see which template the classroom would use, with every template's score; choose another template yourself (a "pin": wins over the rules wherever the exact same problem appears).
  - DNA library: every built-in template with its description, and the teacher's own.
  - Learn from a video: upload a teaching video; ~10 frames go to Gemini, which describes how it teaches (steps, pace, layout) and maps it onto the app's own drawing parts. The teacher edits and saves it as a template (`source: 'teacher-video'`). The video itself is not kept or copied.
  - Make videos: paste problems, pick a template (yours or automatic) and a language, get one MP4 per problem (same engine as the classroom).
- Pins and video templates are saved on the server (`data/ai-guru/teacher/dna.json`, `/api/ai-guru/teacher-dna`); the classroom pulls them before it plans a lesson.
- `selectDna` checks a teacher pin first; `LearnedDna` gained `source`, `styleNotes`, `stepsOutline`, `sourceName`; the planner prompt carries the video's style for teacher-video templates.
- New: `lib/ai-guru/teacher/*`, `dna/teacher-dna.ts`, `components/ai-guru/teacher/*`, `callGeminiClientImages` in `lib/student-key.ts`.

## V51.9.62 — Toffee quiz, session reports for teachers and parents
- Quiz button (bottom left of the classroom): 5 surprising multiple-choice questions made from the lesson being taught (twist, spot-the-mistake, what-if, real-life, odd-one-out). The app marks the answers from the answer key; one golden question is worth 2 toffees; every 3rd right answer in a row +1; a perfect box +2. Each right answer sticks a small toffee on the progress bar; the end shows "You earned = N Toffees" with a percentage ring (OpenMAIC's 90 / 70 tiers).
- Each finished quiz is saved (`/api/ai-guru/progress`, file `data/ai-guru/progress/sessions.json`, with a browser backup that retries). New first-version pages: `/ai-guru/teacher` (all students, class average, weak concepts, every question) and `/ai-guru/parent` (child's code, scores, trend, toffees, questions).
- No sign-in yet on these pages: add a login before real students use them.
- New: `lib/ai-guru/quiz/*`, `components/ai-guru/quiz/*`, `app/ai-guru/{teacher,parent}`, `app/api/ai-guru/progress`.

## V51.9.61 — AI Guru logo (ship's wheel)
- The ship's-wheel logo replaces the flame next to the title in the MP4 export and the reel (`reels/motion/brand.ts`; loaded with the fonts so the first frame already has it, with a small vector wheel as backup). It is also the logo in the top bar, the browser tab icon (`app/icon.png`) and `public/aiguru-logo.png`.

## V51.9.60 — One board at a time; the doubt pane holds the class
- **One board on screen.** The board that is teaching is shown; the other is hidden (not removed — it keeps what it shows) and comes back when its turn comes, so the student sees a single board. A board the student floats (⧉ ◧ ◨) stays visible, so two boards side by side is still one tap away. This undoes the V51.9.57b "both boards always shown".
- **Doubt button stops the class.** Opening the camera / mic / typed doubt pane pauses the class and leaves everything on the boards exactly as it is. When the doubt is answered (or the pane is closed) the class carries on from the same spot. If a micro class is made, it plays on the lecture board and **↩ Back to lesson** puts the lecture board back at the step it was on.

## V51.9.59 — Doubt pane (camera / mic / text) from the RAG Classroom, and the micro class
- **The RAG Classroom's camera/mic pane, as it was** (`components/DoubtCameraMic.tsx` + its helpers: live voice client `lib/gemini-live.ts`, speech helper, offline Qwen fallback, voice visualiser, concept-picture renderer). Same look, same pill dock, same voice / camera / typed doubt, same key rotation. Mounted once in the classroom (`doubt/ClassroomDoubtDock.tsx`); a failure in the pane never stops the lesson.
- **The AI sees the class.** Inside a Motion class the pane gets the chapter text as its study material, the step being taught (what the teacher just said), and a picture of the board (sent when the pane connects and each time the student starts a doubt; not while the camera is on).
- **Micro class from a doubt.** "cross multiply both the equations" → "what is cross multiplication?": the AI calls `make_micro_class` (or the student presses 💡 Micro class). The planner (`plan/micro.ts`, same engine, same validation) may use ANY built-in template, compose several, or draw a free sketch; nothing is saved as a learned template. The problem board pauses where it is; the micro class plays on the lecture board; **↩ Back to lesson** carries on.
- **Changed on purpose:** while the live class is on, the pane's "textbook only" rule is relaxed for a doubt about a word, step or idea (the AI may explain it with a tiny example) — the problem's own numbers and answer must stay true.
- `DiagramRenderer`: the 3-D, GeoGebra, molecule and subject-map pictures of the RAG app are left out (the pane only draws fraction, number line, geometry, graph, bar chart, flowchart).
- New packages: `@google/genai`, `@wllama/wllama`, `chart.js` (run `install-doubt-pane.bat`).

## V51.9.58 — Chapter introduction (title card, topic tour, recap) on the lecture board
- **New DNA `chapter-intro`** (modelled on the "Polynomials" chapter opening video): a night-blue title card with the chapter's formulas drifting behind it and the topic names underneath; one card per topic (a numbered chip, the topic, and a small worked example the app computes: `a x + b = c` with the move and divide steps, boxed answer and check, or a pair of equations with its solution); a closing recap. English and Malayalam (the Malayalam is a draft for a teacher to check).
- **Made from the chapter itself** (`plan/chapter-intro.ts`, no AI needed): topics are the section headings (up to six), each topic's example is the first equation or pair of equations in that section that works out in whole numbers, the background formulas are the equations in the text. Fewer than two headings: no intro.
- The first section of a chapter plays the intro first, on the **lecture board**; the other runs follow as before. The planner never picks it for a passage. Golden sample: `samples/chapter-intro.ts` (Pairs of Equations).
- Floating boards (V51.9.57) and the empty-board fix are in the same build.

## V51.9.56 — Two boards in the RAG Classroom: lecture board on top, problem board below
- **Lecture board / problem board.** `motion-class/board-kind.ts` cuts the lesson into runs by the DNA the selector chose: meaning, importance and the Malayalam retelling (`concept-board`, `section-intro`, `bridge`, `ai-sketch`) play on the lecture board; every worked problem (equations, tables, graphs, figures) plays on the problem board. The runs play one after the other, English then Malayalam inside each run; a bridge sentence goes with the block after it.
- **Adjustable space.** A draggable divider (mouse, touch or arrow keys; double-click resets) sets each board's share of the height, and the choice is remembered. Each 16:9 board fits its own share, so nothing is cut off. A section with no problem (or no lecture) gives the whole height to the board it has.
- **Textbook page can be folded away** (◀ Hide / ▶ Show, remembered) so the boards get the whole width on a phone.
- **Per-problem MP4.** The problem board has a ⬇ MP4 button that saves the problem on screen (voice and captions, English and Malayalam).
- Run chips (📖 1, ✏️ 1 …) jump to any run; speed, pause, step strip, questions and mistake scenes work on whichever board is playing.

## V51.9.55 — Pairs of equations on balance scales; the balance scale handles bigger numbers and x on both sides
- **New DNA `balance-pair`** (two scales): each equation a x + b y = c is a scale that balances (x tiles and y tiles on the left, a hollow tile when y is taken away, the total on the right). The scales are put together (added or subtracted) so one unknown's tiles cancel; the one scale that is left is solved; the value is put back into an equation (the number tile comes off both pans) to find the other unknown; both scales are checked with ticks. The app computes every tile and number; the planner gives two equations and five spoken captions. Works for pairs where the x coefficients are equal or the y coefficients are equal or opposite (x + y = 100 with x − y = 10; x + y = 11000 with 4x + y = 14000; 2x + 3y = 22 with 2x − y = 6), whole answers 1–99999. Pairs that need an equation multiplied first, graphs and matrices stay with `linear-system`. Files: `dna/pair-math.ts`, `dna/pair-builders.ts`, `samples/balance-pair.ts`, test `balance-pair.test.ts`. The selector prefers it for such pairs (and the offline planner writes the plan), so the "Pairs of Equations" chapter now uses the balance.
- **Balance scale, bigger and wider:** answers up to 100 (was 20), so the chapter's beads problem 2x − 10 = 100 (x = 55) is drawn; **x on both sides** (3x + 2 = x + 10): new plan field `d` (x tiles on the right pan) and step `cancel` (the same x tiles come off both pans). The check step shrinks value tiles so they fit the pan.
- Tests changed on purpose: 2x − 10 = 100 and 3x + 5 = 2x + 9 now choose the balance; x + y = 11000 / 4x + y = 14000 now chooses `balance-pair`.

## V51.9.54 — Merged the V51.9.52 "Motion Feel" additions into the all-subjects Motion board
- Adopted from V51.9.52: **questions in class** (the class pauses and asks, answers saved), **step strip** with saved progress, **common-mistake scenes** (struck-out wrong way, then the right way), term-by-term formulas, wording checks, **offline class pack**, **class lint** (`npm run lint:class`), the **AI sketch DNA**, and ticking **HCF/LCM counters** (`Motion.count`).
- The RAG Classroom board (`MotionTeachingBoard`) now also shows the question overlay, the step strip, and the common-mistake scenes.
- Not adopted: their `FEEL` easing and `rippleOnsets` (V51.9.50 curves and stagger already cover this and are kept).
- Version numbers 51.9.51–53 are used by a separate chain; this merge is labelled 51.9.54.

## V51.9.51 — Motion Class teaches every subject, and is the RAG Classroom board

- Concept board gained three subject-neutral pictures: **flow** (steps with arrows: photosynthesis, digestion, a method), **cycle** (3–5 stages in a ring: water cycle, life cycle) and **timeline** (dates down a line: history). The offline planner picks them from the wording (years in order → timeline, "cycle / again" → cycle, "first / then / finally" → flow); the AI planner prompt and the plan checks know them.
- New `MotionTeachingBoard` (components/ai-guru): the RAG Classroom (`/ai-guru`) now teaches each textbook passage with Motion Class (selectDna → plan → quality gate → scenes → one voice clip per caption) and reports `completed` so the classroom still advances section by section. The old board stays one click away ("use old board") until parity is confirmed.
- Because Motion Class sends one voice request per caption and never splits a Malayalam sentence at its English words, the word-by-word voice of the old board does not occur on the new board.
- r2: the board has its own **Pause/Play, step back/forward, restart and Speed (0.5×–1.5×, remembered)**; the classroom's # pause icon now holds the Motion board too; each section is taught in **English first, then the same lesson in Malayalam** (language badge shown).
- r4 **pictures, not only text** (concept board): new layouts **scale** (a balance that tips toward the heavier side: demand/supply, cause/effect, pros/cons), **bars** (bars grow to their values), **tree** (a topic and its kinds); and **icons** (sun, drop, cloud, leaf, tree, flame, coin, book, house, person, clock, mountain, wave, bolt, bulb, heart, flag, earth, gear) on cards, flow steps and cycle stages, picked from the words or named by the planner. The AI planner prompt now says "pictures first" and when to use each. Files: `dna/concept-icons.ts`, `dna/concept-kit.ts`, `dna/concept-pictures.ts`, `samples/concept-pictures.ts`, test `concept-pictures.test.ts`; the concept board is now layout-checked (`LAYOUT_QA_DNAS`).
- `lib/ai-guru/motion-class/passage.ts`: passage → teaching blocks. Test: `concept-subjects.test.ts`.

## V51.9.50 — Smoother motion: easing by action, uneven stagger, a capped end hold and a timeline check
Why: the attached `motion-core-lite` (a crop of "motionmaxxing", Apache-2.0) had ideas that fit the Motion Class engine: land-slow / leave-fast easing, rhythmic stagger, and a timeline check. A trial on five lessons also showed every lesson rested 2.9–3.7 s after its last movement.
- **Easing by action** (`reels/motion/curves.ts`, `engine.ts`): new curves `ease.land` (things that land decelerate), `ease.glide` (moves, morphs, resizes), `ease.exit` (fade-outs accelerate) and `ease.soft` (opacity, colour, dim blends). `write`, `fadeOut`, `move`, `hop`, `resize`, `morph`, `recolor`, `dim`, `undim` and `appear`'s fade use them. Every curve starts at 0 and ends at 1, so end positions and colours are unchanged; only the way they are reached. The pop (`back`) on `appear` and the camera keep their curves.
- **Uneven stagger**: `appear` and `write` accept a list of gaps (ms) as well as a number. `STAGGER_TEXT` (100, 66, 66, … ms) is used when typeset lines are written or morphed (typeset-chain, quadratic derivation, HCF/LCM, numeric quadratic formula), so a row arrives with a rhythm instead of a flat 40 ms drip.
- **End hold capped**: `Motion.build` now ends a lesson at most `END_HOLD_MAX` (1.2 s) after its last movement, and never cuts the last step's own time or its voice clip. Every lesson was resting about 3 s on a still picture; now it is about 1.2 s (plus whatever the last caption or voice needs).
- **Timeline check** (`plan/timeline-qa.ts`, used by `qaLayout`): reports stretches with no movement longer than 4.2 s and a rest over 1.4 s after the last movement (the last caption gets 2.4 s to be read). The planner gets a sentence it can act on. The check ran clean on every built-in DNA example.
- Credit: `NOTICE-motion-core.md` and `docs/licenses/Apache-2.0-motionmaxxing.txt` (the code is our own rewrite of their curve shapes).
- Tests: 15 new in `motion-polish.test.ts` (curve endpoints and monotonic, landing decelerates / leaving accelerates, stagger offsets, a move lands exactly and gently, fade-out accelerates, end-hold cap and floor, timeline check on a still and a lively scene, every DNA example passes). All 751 motion-class and reels tests pass; the full `lib/ai-guru` run shows the same 16 known environment failures as before.
- Not done: the frame-stepped counter and word-synchronised appearance (needs per-word timings from the voice engine). Not run here: real voice, Malayalam font, the app's own MP4 export. Motion feel was checked only on the MP4s I rendered, not on a phone.

## V51.9.49 — HCF and LCM by prime tiles
Why: HCF and LCM were a missing branch (the standing permission is to add missing DNAs). Prime factorisation is easiest to see as tiles that line up.
- **New DNA `hcf-lcm`** (`dna/hl-math.ts`, `dna/hl-builders.ts`): two numbers split into coloured prime tiles (12 = 2 × 2 × 3), tiles slide so shared primes sit in the same columns and are joined by green lines, the shared tiles are boxed (HCF = product), every column is boxed (LCM = product), and an optional check shows HCF × LCM = a × b. Typeset lines under the tiles; co-prime numbers give HCF 1 and no joining lines.
- **Plan** is just `a < b` (2–120) and a caption per fixed step (show, factorise, common, hcf, lcm, optional check); the app computes every factor, product and position and validates numbers, order, repeats and missing captions.
- **Selection**: HCF / LCM / GCD / "highest common factor" / "least common multiple" wording scores 0.93+; text about fractions or denominators is left to the fraction lessons. "Factorisation" no longer sends HCF text to the quadratic lesson.
- **Offline planner** takes the first two different numbers from the text (smaller first), else 12 and 18. Samples: 12/18, 36/48, 8/15 (co-prime), 6/12. Malayalam captions are drafts for a teacher to review.
- Tests: 16 new (prime factors for every n to 120, HCF/LCM from the tiles equal the true values for 300+ pairs, HCF × LCM = a × b, shared tiles in the same column in both rows, nothing overlaps or leaves the board at any step, three formats × light/dark, English = Malayalam pictures, validator, selector, offline planner). 706 motion-class tests pass.
- Seen by eye: frames of every step and day/night MP4s (12/18, 36/48, 8/15).
- Not run here: real voice, the Malayalam font, the app's own MP4 export, a real chapter run. Only two numbers are supported (not three), and numbers above 120 are rejected.

## V51.9.48 — The quadratic formula, derived: a square, a strip, the missing corner, and the algebra beside it
Why: a silent geometric video of completing the square showed *why* the quadratic formula is true; our quadratic lesson only worked numbers (graph, discriminant, check). Now a lesson can show the reason, with the same steps in letters and in numbers.
- **New DNA `quadratic-derivation`** (`dna/qd-math.ts`, `dna/qd-builders.ts`): a square of side x and a strip of area b·x; the strip is cut in half, one half turns a quarter and wraps the bottom of the square, the missing corner square (b/2)² is added (dashed, then filled), and the figure is the square (x + b/2)² with braces. Beside it the same steps are **typeset** (stacked fractions, root sign) in letters, and below them with the numbers of one example (x² + 6x + 5 = 0: x² + 6x + 9 = 9 − 5, (x + 3)² = 4, x + 3 = ±2, x = −1 or x = −5). The optional last step writes the result as the quadratic formula, first for a = 1 and then for any a, and the numeric row runs the same numbers through the formula. Symbols glide from line to line (`becomeMath`).
- **The app computes everything**: the plan is only `b`, `c` (b even 2–16, (b/2)² − c a perfect square 1–144, so both roots are whole numbers) and a caption per fixed step (show, split, bend, corner, square, root, answer, optional formula). Validation rejects wrong numbers, repeated or out-of-order steps and missing captions.
- **Selection**: text that asks where the formula comes from (derive, prove, origin, completing the square leading to the formula) scores 0.99 and takes this DNA; the numeric `quadratic-equation` lesson is unchanged for ordinary equations, including "solve … by completing the square".
- **Offline planner** uses an equation written in the text (x² + 8x + 12 = 0) when it has two whole roots, else x² + 6x + 5 = 0; English and Malayalam captions (Malayalam is a draft for a teacher to review). Pictures are identical in both languages.
- **Numeric quadratic lesson**: the formula step now shows the formula, and the numbers put in, as typeset fractions with a real root sign (it was flat text with a hand-made fraction).
- Samples: x² + 6x + 5, x² + 8x + 12, x² + 2x − 8 (negative constant). Tests: 16 new (every numeric line checked against the algebra for all valid examples, pieces fill the big square exactly and do not overlap, the turned half lands on its place, braces and text stay on the board, no text overlaps at the end of any step, three formats × light/dark, English = Malayalam pictures, validator, selector, offline planner). The two tests that checked the old flat-text formula were updated. 690 motion-class tests pass.
- Seen by eye: frames of every step and day/night MP4s of the derivation (x² + 6x + 5 and x² + 2x − 8) and of the numeric quadratic lesson.
- Not run here: real voice, the Malayalam font, the app's own MP4 export, a real chapter run with a Gemini key. The strip is drawn symbolically (the same size for every b), not to scale.

## V51.9.47 — The balance scale tips: pans, bigger and colourful, no end glitch, check step, prices on the scale
Why: a teacher's phone recording of the 2x + 5 = 25 class showed the scale was a flat beam with tiny tiles, the equation lines scrolled under it and clipped, the last lines faded over each other, and the caption said "move +5 across" while the picture removed 5 from both pans.
- **A real scale** (`dna/bal-math.ts`, `dna/bal-builders.ts`): the beam tips toward the heavier pan (angle computed from the weights of the tiles, limited to 8°), the pans hang from it on strings and move with it, the beam swings level with a small overshoot when both pans are equal. A tile lifts off the left (the beam tips right); the same amount lifts off the right (level again). For x − 3 = 9 a +3 tile cancels the −3 (tips left) and the same +3 joins the 9 (level). Dividing splits the right pan into one group per x and removes the extra groups in pairs, so it stays level. The check puts the number back and the scale balances. The scale is bigger (pans 330 wide, tiles 78 high), the stand, beam, pans and tiles are coloured (orange beam and pans, purple post, red/purple/green tiles, sparkles at the answer).
- **No end glitch**: the equation panel keeps at most four lines in fixed slots; the oldest fades and the rest move up (nothing scrolls under the scale or fades over another line); the answer box moves and fades with its line.
- **Words and picture agree**: the sample captions now say "take the 5 off the left pan, the scale tips, take 5 off the right pan, level again" (Malayalam draft for a teacher to check).
- **Prices**: `scale` (10, 100, 1000) writes every value times it (3 tiles, 3000 written) so a price problem fits.
- **Table and chair on the scale**: `word-problem` with `solvedLater` now really stops after the equations; an `ai-custom` plan continues with two scales (3x = 3000 → chair 1000, then y + 1000 = 11000 → table 10000); the problem card stays pinned on every scene of such a plan; the planner prompt says how.
- Review script now draws the whole reel (step numbers continue across scenes).
- Tests: scale file 22 → 35 (tilt angles, strings joined at every tilt, rows fit the pans, level at the end of every step, tips right/left during the move, tiles stay on the dish while tipping, four-line panel, units, table-and-chair class in 3 formats × 2 themes). `lib/ai-guru/motion-class`: 674 pass; tsc clean for motion-class and reels.
- Seen by eye: frames of every step (light, dark, vertical) and four MP4s: equations (2x + 5 = 25, x − 3 = 9, 3n + 4 = 22) and table-and-chair, each in day and night.
- Not run here: real voice, the Malayalam font, the app's own MP4 export. I could not find where the lines under the scale in the teacher's recording (a stacked 20/2 fraction, "25 − 5 = 20" captions) come from in this source; the scale scene now writes its own lines. The two-equations-to-one-unknown step (subtracting equations) is told in words on the first scale, not drawn as two scales. Planner/offline do not yet build the table-and-chair composite by themselves: it is a sample plan the planner may copy.

## V51.9.46 — Mascot with "why?" moments, lesson arc, visual replacements for text-only boards, and the teacher review loop
Why: the reference video keeps a friendly character, asks questions, and never shows a wall of text. Five of our DNAs (concept-board, key-result, identity-formula, equation-pair, mental-math) were text on a board.
- **Original mascot "Deepa"** `reels/motion/mascot.ts`: a drop-shaped character drawn from engine items (body, eyes, brows, mouth, pupils) with four poses (idle, think, ask, cheer) that morph into each other, a hop, and **speech and thought bubbles** (outline only, so day and night modes both work; bubbles fit their words and stay inside the board). Not based on any existing character.
- **Lesson arc** `plan.arc` (optional, next to `teach`): `hook` (mascot wonders, thought bubble, before the picture), `why` (question in a thought bubble, answer in a speech bubble; the planner chooses where a "why?" is worth asking), `formal` (a RULE pill with the typeset formula in a box), `check` (a CHECK pill, the numbers put in, a tick) and `summary` (mascot cheers). Added to the planner prompt (LESSON ARC section) with word limits; `arcProblems` checks it (formulas must parse, Malayalam must be Malayalam, word limits); Malayalam is skipped, never mixed with English, when a field lacks Malayalam. Mental-math units get a default hook from their first line.
- **Concept board as pictures** `dna/concept-builders.ts`: `layout` "cards" (default: numbered cards, key term as a coloured head, focus), "pyramid" (built from its base: first point = widest, lowest band) and "columns" (two titled columns, each idea has `col`). `concept-math.ts` validates (count, text length per layout, heads, both columns used). Idea cards are still flagged "text-only" by the quality gate (they are words in boxes); a pyramid or two columns are not.
- **Key result**: a KEY RESULT pill, the statement card with key terms coloured and focused, the formula **typeset** (and boxed) when it parses, plain tokens otherwise, and a tick.
- **Identity-formula**: after the derivation, a "TRY NUMBERS" scene: left side | right side with the numbers put in, both arrow down to the same value, `=` and a tick. Values come from the verified evaluator (`wp-check`, now understanding ² and ³); nothing is shown unless the identity really holds for the given numbers.
- **Equation-pair**: opens with a brace over the two equations ("both true at the same time"), then the existing elimination/substitution chain.
- **Voice-measured timing**: already in the engine (`Motion.step` waits for and lasts as long as each clip; the app's player measures the real TTS clips). New: `estimatedClipMs` (speaking-time estimate per language) so a class can be rendered with realistic timing when no voice exists.
- **Review loop**: `motion-class/review.ts` (pure): plan fingerprint, manifest, `applyReview` (Approved / Needs changes with a required comment), stale detection (an approval stops counting when the plan changed), summary and "ready" flag. `review-html.ts`: one self-contained `review.html` (video per segment, Approve / Needs changes, comments, download/load `review.json`, remembers progress, day/night). `scripts/ai-guru-render-review.ts`: renders every segment to its own MP4 + `manifest.json` + `review.html`; `--apply review.json [--plans class.json]` merges the teacher's decisions, lists stale approvals and change notes, exits non-zero until everything is approved.
- 29 new tests (mascot poses and bubbles, arc validation/scenes/compile order/3 formats × 2 themes, layouts, visual DNAs, review manifest/decisions/stale, timing, page safety). `lib/ai-guru/motion-class`: 665 tests pass; tsc clean for motion-class and reels.
- Seen by eye: mascot poses and arc scenes (light and dark), the three layouts, key result, identity try, equation-pair brace; the review page driven in Chromium (approve, comment, download, apply with a stale plan).
- Not run here: the app itself (there is no in-app review screen yet; the review page is a standalone file), real voice clips, the Malayalam font (Malayalam pictures are identical, only words change), the app's own MP4 export, a headless Chromium cannot play H.264 so the videos were checked with ffmpeg instead. Not done: `plane-transform` and `matrix-ops` still write matrices as flat text; the missing branches (HCF/LCM, surds/logs, interest, calculus, complex numbers, geometric sequences, trigonometry, more statistics).

## V51.9.45 — Maths typesetting layer + symbol-matching transform (new DNA `typeset-chain`)
Why: the reference video (Essence of Linear Algebra) shows formulas as a printed book would: stacked fractions, square roots, powers, bracketed matrices, and one line turning into the next by its symbols sliding into place. Our boards only had flat text tokens.
- **Typesetting layer** `reels/motion/typeset.ts`: a parser for LaTeX-like text (`\frac{a}{b}`, `\sqrt{x}`, `x^{2}`, `x_{1}`, `\pm \times \cdot`, `\begin{bmatrix}…\end{bmatrix}` (also pmatrix, vmatrix), `\vec{v}`, `\hat{i}`, `\text{…}`, `\color{a}{x}`) that also reads plain maths (`x²`, `3/4`, `√16`, `√(x + 3)`), a layout (pure maths: fraction bars, root signs, scripts, matrix grids with brackets, binary/relation spacing, unary minus) and `placeMath` / `showMath`, which build the formula from ordinary engine items, so appear, write, dim, focus, move and fadeOut work on it unchanged. Limits: 400 characters, 260 parts, 7 levels; a clear message for anything it cannot read (unknown command, unclosed brace, ragged matrix, `\sqrt[3]{x}`).
- **Symbol-matching transform** `becomeMath`: the shared symbols (same text and size, in order) glide to their new places, the rest fade and the new ones appear; fraction bars, roots and brackets are redrawn.
- **New DNA `typeset-chain`**: steps `show` (write a formula), `become` (turn the line into the next), `add` (write underneath; earlier lines dim; a full page restarts), `focus` (light symbols), `box`. Optional colours by symbol and a short note under a line. Wired like every DNA: registry (score 0.91, only for text with a root, `\frac` or matrix and an `=`; numeric fractions and quadratics keep their own DNAs), card, validator (every formula must parse, a plain equation without any structure is refused), offline planner (formulas found in the text), AI prompt, quality gate, samples (quadratic formula, √ equation by squaring, matrix × vector, determinant).
- 31 new tests: parser (shapes, errors, limits, √( ) brackets), layout (fits its width, no glyph overlaps, fraction/script/root/matrix geometry, keys), board behaviour (shown, becomes, strokes redrawn), plan checks, selector with look-alikes, offline planner, the class in 3 formats × light/dark, no overlap at any step, English and Malayalam pictures identical. Whole `lib/ai-guru` suite: only the 16 known environment failures elsewhere; tsc clean for motion-class and reels.
- Seen by eye: formulas, samples in vertical light/dark and landscape dark; two MP4s (day and night) of the four samples.
- Correction to an earlier message: the plane / matrix-transformation DNA (`plane-transform`: grid, î and ĵ, unit square, determinant, composition) already existed; it was not rebuilt.
- Not run here: a real browser, the Malayalam font (a Malayalam note under a line is measured with the same metrics), voice, the app's own MP4 export. Not done: `plane-transform` and `matrix-ops` still write their matrices as flat text; moving them onto the typesetter is the next step.

## V51.9.44 — Word problems: the problem stays at the top, then unknowns, equations, solving, check, answer
- Every scene of a problem/exercise class (and every `word-problem` class) now shows the problem in a "PROBLEM" card at the top of the page (Malayalam: "പ്രശ്നം"). The board moves down under the card in vertical, landscape and square; light and dark themes both work, so the MP4 download carries the card in either mode.
- `word-problem` is a flow: (1) read the problem, "Let x be …" for each unknown, then each equation written from its sentence with the letters flying in from their definitions; (2) the verified solver's steps; (3) **check** — the answers put back into every equation (4 × 1000 + 10000 = 14000 ✓), shown only when every equation really holds (`dna/wp-check.ts`, so a false check can never appear); (4) the answer in words.
- The offline planner now reads three kinds of story problem without AI: table-and-chair style pairs (x + y = A, 4x + y = B), bead/count pairs, and sum-and-difference. English and Malayalam (draft, for a teacher to check). Other story problems still need the AI planner.
- Fix: a board scene with automatic height started its camera at 0, so in landscape and square the check lines sat low and were cut by the caption. The camera now frames the whole board.
- `reels/motion`: `MotionScene.problem/problemLabel`, `fitProblem`, `layoutFor(format, problem)`. `class.ts`: `problemFor`, `withProblem`.
- 23 new tests: check evaluator (rejects false equations, brackets, ÷0), offline planner, scenes (content, problem on every scene, EN/ML pictures equal, ticks), card layout in 3 formats × light/dark at every caption, `problemFor`/`withProblem`, compileClass. Whole motion-class suite 604 passed; tsc clean for motion-class and reels. Pixel checks by eye on vertical, landscape, square, light and dark.
- Not run here: a real browser, the Malayalam font, voice, MP4 export. Not yet done: other DNAs (quadratic, linear-system …) carry the card but were not each re-checked under the smaller board; remaining text-only DNAs still need visuals.

## V51.9.43 — Balance scale: linear equations a x + b = c as a scale (modelled on the reel)
- New DNA `balance-scale`, built from the reel the team shared (a level scale, x tiles, the 5 that moves across, 25 − 5 = 20, "÷ 2 on both sides", x = 10 with a tick). The scale spans the whole width; the equation is written below it in the same role colours (a red, b purple, c green, the working indigo); each new line dims the one before.
- Steps: `show` (scale, a tiles of x, a tile for b, a tile for c, the equation), `move` (the b tile leaves and arrives on the other pan with its sign changed; "− 5 both sides"), `simplify` (the right pan merges into one tile: 2 x = 20), `divide` (the tile splits into a equal tiles, one per x; "÷ 2 both sides"), `answer` (the extra tiles fade, one x is lit against its value, x = 10 boxed), `check` (2 × 10 + 5 = 25 with a tick). Works for a x + b = c, a x − b = c (the tile that arrives is +b), x + b = c (no dividing) and a x = c (nothing to move).
- The planner gives a (1–4), b (−12…12), c, the unknown's letter and the steps; the app computes and draws everything (`dna/bal-math.ts`, `dna/bal-builders.ts`). The validator refuses a non-whole or out-of-range answer (1–20), x = c, a step that needs another step first, a step repeated, a plan that stops before the answer, and a Malayalam caption in English.
- Selector: one equation with one unknown whose answer is a whole number 1–20 (`2x + 5 = 25`, `x − 3 = 9`, `4x = 28`, `3n + 4 = 22`) → `balance-scale` (0.95); a story problem keeps `word-problem`; two unknowns, x², variables on both sides, answers outside 1–20 and fractions stay with the equation chain. The offline planner reads the first such equation in the text and writes the lesson in English and Malayalam (the Malayalam is a draft for a teacher to check). The quality gate checks its layout.
- 26 new tests (every a, b and answer: 1,000+ cases; tiles inside their pan and on the beam; every line and tile text at every step; validator messages; selector with look-alikes that must not match; offline planner; no overlap at any step; English and Malayalam pictures identical). Pixel check: 144 checks over light/dark × landscape/vertical/square, and with MUTATE=1 the check fails (24 misses), so it can fail.
- Not run here: a real browser, the Malayalam font, voice, MP4 export.

## V51.9.42 — The demo textbook is no longer packaged
- The app is for classes 1–12, so no single class's textbook ships with it. Removed from the package: `data/demo/35_Maths Eng.pdf` (6.5 MB), `public/demo/page-27.png` (a page picture made from it) and `fixtures/ai-guru/book-index.json` (a generated index of it, 0.3 MB). None of them was read by the running app (only by `scripts/prepare-book.*`, which still take any PDF you give them).
- `package.json`: removed the `book:prepare:current` script that pointed at the demo PDF (`book:prepare` stays and takes any PDF). `scripts/ai-guru-build-repair-audit.mjs` no longer requires `public/demo/page-27.png`.
- Teachers upload their own textbook PDF in Motion Class as before. Not changed: `motion-class/samples/scert9-ch1-s1.ts` (the sample class plans for one section of that book, a few paragraphs) and old sprint notes in `docs/` that mention the demo file.
- Delete the same three files from your own copy of the app (the "changed files only" zip cannot carry deletions).

## V51.9.41 — Automatic quality gate and regeneration
- After a plan passes validation, `plan/qa.ts` checks what the viewer would meet: text that overlaps other text or runs off the board at any step (for the thirteen DNAs whose layouts are tested for it: angle-geometry, area-figure, arithmetic-sequence, coordinate-geometry, fraction-line, linear-system, matrix-ops, pie-chart, polynomial, quadratic-equation, ratio-percent, solid-figure, square-identity), a spoken caption that is a paragraph (over 40 English or 60 Malayalam words), a whole English phrase inside a Malayalam caption, the same caption on three or more steps, and a unit over four minutes.
- When the gate finds problems, the planner asks the AI again automatically, sending its own answer and each problem as a sentence ("At step 3 the texts … overlap"). Validation problems and quality problems share the same three tries. A plan that is valid but still not clean on the last try is kept with the open notes as a warning (and `plan.qa.passed = false`); a plan that is invalid on the last try falls back to the offline plan as before.
- `plan.qa` records the number of asks and the notes; the unit list shows "Quality check: passed · 2 asks", and after planning the page says how many units were regenerated automatically and how many still have notes.
- New `regenerateBlock` and a "Regenerate this unit" button in Motion Class: plans one unit again with an optional teacher note ("use smaller numbers"), runs the same checks and retries, and replaces the cached plan.
- 13 new tests (good plans pass; bilingual pairs found; long captions, English in Malayalam and repeated captions flagged; a layout check that really finds overlapping and off-board text; a bad plan is sent back with the reasons and the corrected one accepted; a clean first answer costs one ask; a never-clean plan is kept with a warning; an invalid plan still falls back; the teacher's note reaches the model and the new plan is cached). The gate raises no problem on any of the 50 sample plans of the thirteen DNAs. Full-app regression unchanged. See docs/MOTION-CLASS-DNA.md §28.

## V51.9.40 — Visual proofs of (a + b)², (a − b)² and (a + b)(a − b)
- New DNA `square-identity`, built after the "(a + b)² = a² + 2ab + b², a visual proof" clip. Three kinds. `sum`: a square of side a + b with curly braces; `tileA` (a², corner), `strips` (two a × b rectangles), `tileB` (b²), then `name` (a², ab, ab, b² in the tiles) and `build`, which writes (a + b)² = a² + ab + ab + b² one term at a time, each term lighting its tile, then = a² + 2ab + b². `difference`: a square of side a; `strips` takes away two strips of width b (right and bottom), `corner` puts back the b × b corner that was taken twice, `name`, `build`: (a − b)² = a² − ab − ab + b² = a² − 2ab + b². `product`: a square with a b × b corner cut out (`remove`), the L cut into two rectangles (`cut`), the lower one turned and slid beside the upper one (`move`), braces a + b and a − b (`name`), a² − b² = (a + b)(a − b) (`build`). `check` tries the identity with the numbers a and b.
- Panel words keep the colour of their letter from the picture to the formula (a red, b purple, ab green or orange).
- The planner gives the kind, the sides a and b (whole numbers) and the order. The app computes every tile, brace and label size (`dna/sq-math.ts`); the validator refuses a = b in a sum, a + b over 12, b not below a, sides too small to label the pieces, an order that does not work (each step needs the one before it) and steps of another kind.
- Selector: (a + b)², (a − b)², (a + b)(a − b) written with letters, "square of the sum / difference of two numbers", "difference of two squares" and "visual proof" → `square-identity` (score above the general identity DNA); polynomial, quadratic, equation, root and remainder texts, and number-only products such as (x + 2)(x + 3), stay where they were. DNA card for semantic selection. The offline planner recognises the three forms and uses a = 3, b = 2 (sum) or a = 5, b = 2.
- 25 new tests (the areas of every tile for every legal size add up to the identity; the L and the moved piece make the rectangle; braces start and end on their span; every label fits inside its tile; lines written at each step and their colours; terms appear in order; validation messages; selection; offline planner; no text overlaps at any step in all ~120 legal sizes) and a real-canvas check of 354 pixels (light and dark, landscape, vertical, square: tile fills, outline, every brace); moving things gives 84 mismatches. Full-app regression unchanged. See docs/MOTION-CLASS-DNA.md §27.

## V51.9.39 — Coordinate geometry: plotting points, quadrants, distance and midpoint
- New DNA `coordinate-geometry`, three kinds. `points` (1–4 points): `axes` draws the grid with its numbers; each `plot` (with its index `i`) draws dashed drops to the axes, the dot and its letter, and writes A = (3, 2) in the point's colour; `quadrant` writes I–IV in the plane and A (3, 2) : I for each point. `distance` (two points): `plot` both, `segment`, `legs` (dashed horizontal and vertical legs with a right-angle mark, dx = |5 − 1| = 4 and dy = |5 − 2| = 3, negatives in brackets), `formula` (d² = dx² + dy², the numbers, the sum, d = √25 = 5, or d = √34 ≈ 5.83 when not exact). `midpoint`: `plot`, `segment`, `midpoint` (drops to the axes, dot M, equal tick marks on the two halves, x = (a + b) ÷ 2, y = …, M = (…)).
- The planner gives the kind, the points (whole numbers −6 to 6), optional letters and the order. The app computes every position, number and label (`dna/cg-math.ts`); the validator refuses points outside −6..6, repeated points, a distance between points on one horizontal or vertical line (no right triangle), "M" as a name in a midpoint problem, `legs` before `segment`, `formula` before `legs`, `midpoint` before `segment`, a `plot` without a valid unique `i` in `points`, and steps that belong to another kind.
- Layout keeps letters, dx and dy and the I–IV numerals clear of the axis numbers, the dots and the segment; when the unit gets small (a range over about 9 units) only the even numbers are written on the axes.
- Selector: plot, coordinates, quadrant, distance between points or midpoint of a segment with (x, y) pairs → `coordinate-geometry`; graphs of equations, linear systems, plane transformations, matrices and "distance travelled" stay where they were. DNA card for semantic selection. The offline planner reads A(3, 2) style pairs and the words distance, midpoint or quadrant; otherwise it says the AI planner is needed.
- 23 new tests (distance and midpoint arithmetic over hundreds of point pairs, quadrants, picture to scale, written lines and their colours at each step, validation messages, selection, offline planner, no text overlaps at any step in every generated picture) and a real-canvas check of 156 pixels (light and dark, landscape, vertical, square: dots, segment middle, right-angle corner, leg, M, origin). Full-app regression unchanged. See docs/MOTION-CLASS-DNA.md §26.

## V51.9.38 — Area of a parallelogram and of a trapezium: cut-and-slide, turned copy, two triangles
- New DNA `area-figure`, two kinds. `parallelogram`: drawn to scale with b and h in colour (b red, h green); `height` draws the dashed perpendicular with its right-angle mark; `cut` shades the right triangle at one end; `move` slides it (an arc) to the other end and outlines the rectangle b × h that results; `formula` writes A = b × h, = 8 × 5, = 40 cm². `trapezium` (a the shorter parallel side red, b the longer purple, h green; leaning left for a right angle, right, or centre): `copy` adds a half-turned copy that completes a parallelogram of base a + b with a bracket under it and 2 × A = (a + b) × h; `triangles` cuts it by a diagonal into two triangles (½ × b × h and ½ × a × h) that add up to the area; `formula` writes A = ½ × (a + b) × h, the numbers, the product and the area with the unit squared.
- Panel words can be coloured by the letter they stand for (`b@a`), so every number keeps the colour of its letter from the picture to the formula.
- The planner gives the kind, sizes, lean, unit and the order. The app computes every point and number (`dna/af-math.ts`); the validator refuses sizes outside 2–20, a shorter side not below the longer one, a trapezium with (a + b) × h odd (the area would not be whole), `triangles` unless b × h and a × h are even, a lean that does not fit the kind, `cut` before `height`, `move` before `cut`, `copy` or `triangles` before `height`, and steps of the other kind.
- Selector: parallelogram, trapezium or trapezoid together with area, height, base or parallel sides → `area-figure`; angle and property statements about parallelograms, rectangle area and the other DNAs stay where they were. DNA card for semantic selection. The offline planner reads "base 8 cm … height 5 cm" for a parallelogram and "parallel sides 4 cm and 10 cm … height 6 cm" for a trapezium; otherwise it says the AI planner is needed.
- 22 new tests (the shoelace area of every drawn figure equals the formula to scale; the copy and the two triangles have the right areas; the cut triangle moved by b makes the rectangle; every figure fits the left area and rests on the base line; colours follow the letters; no text overlaps at any step) and a real-canvas check of 252 pixels (light and dark, landscape, vertical, square: every side, the height line, the moved triangle, the copy and the two triangle fills); moving things gives 86 mismatches. Full-app regression unchanged. See docs/MOTION-CLASS-DNA.md §25.

## V51.9.37 — Matrices: multiplication entry by entry, and the transpose
- New DNA `matrix-ops`, two kinds. `multiply`: A × B drawn as bracketed grids (A red, B purple, the product indigo); `check` writes the orders A : m × n, B : n × p, the two inner numbers equal (n = n, with a tick) and AB : m × p, and draws the empty product; each `entry` boxes row i of A (red) and column j of B (purple) and the cell of the product, writes the products with negatives in brackets (2 × 1 + (−1) × (−2)) and their sum, and puts the result in its cell; `all` fills the rest. `transpose`: A and an empty Aᵀ side by side; `rows` boxes each row of A in its own colour and writes it as a column of Aᵀ, one row at a time; `entry` boxes an entry and its new place and writes (i, j) → (j, i); `size` writes A : r × c and Aᵀ : c × r.
- The planner gives the kind, the matrices and the order. The app computes every entry, box and bracket (`dna/mo-math.ts`); the validator refuses matrices that are ragged, empty, too big (3 × 3 to multiply, 4 × 4 to transpose), entries outside −9..9, a product whose columns of A do not equal the rows of B or whose entry goes beyond ±99, an `entry` outside the product or used twice or more than four of them, `entry` before `check` (multiply) or `rows` (transpose), `all` that is not last, and steps that belong to the other kind.
- Selector: "matrix" (or a [[…]] literal) with transpose, matrix multiplication, product of matrices, row by column or order of the product → `matrix-ops`; the grid-of-entries matrix DNA, rotations and transformations, vectors, determinants, inverses and "transpose the terms" in equations stay where they were. DNA card for semantic selection. The offline planner reads matrices written [[1,2],[3,4]] or [1 2; 3 4] and the words transpose / multiply / product; otherwise it says the AI planner is needed.
- 24 new tests (every shape of product up to 3 × 3 × 3 with random entries: each entry is row · column, the order is m × p, (AB)ᵀ = BᵀAᵀ; every transpose up to 4 × 4: (Aᵀ)ᵀ = A and (i, j) ↔ (j, i); every entry text in its cell; boxes round the right row, column and cell; no text overlaps at any step) and a real-canvas check of 498 pixels (light and dark, landscape, vertical, square: brackets and every non-zero entry of every matrix); moving things gives 192 mismatches. Full-app regression unchanged. See docs/MOTION-CLASS-DNA.md §24.

## V51.9.36 — Fractions on the number line: marking, equivalent fractions, comparing, adding and subtracting
- New DNA `fraction-line`, four kinds. `mark`: a number line with its whole numbers; `divide` cuts each whole into D equal parts (D = the common denominator) and shows one part as {1/D}; `mark` puts a dot and label at each fraction (1–4 fractions, neighbours staggered in height with a stem) and writes {n/d} = n × {1/D}; `mixed` writes improper fractions as whole + fraction under their dot. `equivalent`: the fraction on a line cut d parts, then a second line cut d × k parts with a dashed line down to the same point, {n/d} = {n/d} × {k/k} = {nk/dk}, and both stretches from 0 shaded. `compare`: both fractions marked, rewritten in place over the common denominator on the finer line, then two bars from 0 whose lengths show which is greater, with the sign. `add` (and `sub`): the first fraction as a dot, an arc of the length of the second to the right (left for subtraction), the common denominator, the sum reduced and, above one, as a mixed number.
- The planner gives the kind, the fractions and the order. The app computes every tick, dot, jump and number (`dna/fl-math.ts`); the validator refuses fractions not in lowest terms, denominators outside 2–12, values above 3, repeated fractions, fractions too close to mark or label apart, lines needing more than 36 parts, k outside 2–6, a subtraction that is not positive, a sum above 3, steps of another kind, `mixed` without an improper fraction, `common` when the denominators already match, and steps out of order.
- Selector: "number line" together with fractions (words or a/b) → `fraction-line`; number lines with integers only, fraction bars and the other DNAs stay where they were. DNA card for semantic selection. The offline planner reads the fractions written a/b and the words equivalent / compare / add / subtract (larger first for subtraction); otherwise it says the AI planner is needed.
- 29 new tests (every fraction pair sampled across denominators 2–12: sums and differences exact over the common denominator, reduced, mixed numbers right; dots at value × unit, ticks one per part, equivalent dots at the same x, arc from the first fraction to the answer, bar lengths in proportion; no text overlaps at any step) and a real-canvas check of 234 pixels (light and dark, landscape, vertical, square: dots, end ticks, arcs, answer dots, bars, shaded stretches); moving things gives 144 mismatches. Full-app regression unchanged. See docs/MOTION-CLASS-DNA.md §23.

## V51.9.35 — Pie chart: data, total, central angles, percentages, check
- New DNA `pie-chart`. `show` draws the circle and lists the data on the side (name = value, each in its sector's colour); `total` adds the values; `angle` writes each angle as {value/total} × 360° = …° and draws the sectors one by one, clockwise from the top, in six fixed colours with the angle written outside and the name inside when it fits; `percent` replaces the angles by {value/total} × 100% (with "≈" when it does not divide exactly); `check` adds the angles to 360° with a tick.
- The planner gives 2–6 whole-number values, optional names (1–10 characters, the same in both languages, default A, B, C …) and the order. The app computes every angle, percentage and sector (`dna/pc-math.ts`); the validator refuses data whose angle is not a whole number of degrees (the total must divide 360 × every value, e.g. 36, 40, 45, 60, 72, 90, 120, 180, 360), any angle under 15°, a total above 1000, names that are missing, repeated or too long, and `percent` / `check` before `angle`. Labels of thin sectors are staggered on three radii so they never touch.
- Selector: pie chart / pie diagram / pie graph / circle graph → `pie-chart`; bar graphs, angles at the centre, percentages and the other DNAs stay where they were. DNA card for semantic selection. The offline planner reads "Name value" pairs from the text (capitalised names, 2–6 pairs) and adds `percent` when the words ask for percentages; otherwise it says the AI planner is needed.
- 21 new tests (including thousands of splits of totals that give whole degrees: angle × total = 360 × value, angles add to 360°, percentages to 100%, sectors contiguous clockwise from the top and each the right share of the disc, no text overlaps at any step) and a real-canvas check of 264 pixels (light and dark, landscape, vertical, square: each sector tinted in its colour, its boundary radius, its arc on the circle); moving things gives 49 mismatches. Full-app regression unchanged. See docs/MOTION-CLASS-DNA.md §22.

## V51.9.34 — Ratio and percent: bar models for sharing in a ratio, a percent of a quantity, percent increase and decrease
- New DNA `ratio-percent`, three kinds. `share`: the bar in as many equal blocks as the ratio has parts, coloured by person (A red, B purple, C green), the total in a bracket above; `unit` writes the parts added, the total divided by them, and the value in every block; `parts` writes each share as its blocks times one block and puts the value under each group; `check` adds the shares back to the total with a tick. `percent`: the bar in ten tenths with the whole in a bracket; `tenth` writes a tenth in every block and 10% … 90% under the edges; `part` shades exactly p% of the bar and works out {p/100} × whole; `result` replaces the percentage by the answer. `change`: the original bar, `change` adds a green piece beyond it (increase) or shades a purple piece off its end (decrease) worth p% of the original, `result` brackets the new amount and writes original ± piece and "that is (100 ± p)% of the original". Rs is written before the number, kg, m, cm, km, l after it.
- The planner gives the kind, the whole numbers and the order. The app computes every value and block (`dna/rp-math.ts`); the validator refuses ratios with a part outside 1–9, more than 3 parts or more than 20 blocks, a total that does not share out in whole numbers, a percentage that does not give a whole answer (p × whole must be a multiple of 100), a decrease above 90%, steps that belong to another kind, and steps out of order (`unit` → `parts` → `check`; `tenth` → `part` → `result`; `change` → `result`).
- Selector: "in the ratio", a ratio like 3 : 5, percent / per cent / percentage, a number followed by %, discount → `ratio-percent`; trigonometric ratios, common ratio, similar figures, scale factor, the 1 : √3 : 2 sides of special triangles and probability talk stay where they were. DNA card for semantic selection. The offline planner reads the ratio and the total, or "p% of N" with increase / decrease / discount words, and the currency or unit; otherwise it says the AI planner is needed.
- 24 new tests (including every ratio of 2–3 parts up to 20 blocks with several totals: shares whole, in the ratio exactly, adding to the total; every percentage and whole that gives a whole answer: p% × 100 = whole × p, increase and decrease results exact; the drawn groups and shaded pieces in exact proportion; no text overlaps at any step of any sampled case) and a real-canvas check of 426 pixels (light and dark, landscape, vertical, square: block tints, group edges, tenth edges, brackets, the shaded piece's edges and tint); moving things gives 270 mismatches. Full-app regression unchanged. See docs/MOTION-CLASS-DNA.md §21.

## V51.9.33 — Solids: cuboid, triangular prism, cylinder, cone, sphere — 3-D pictures, volume, nets, surface area
- New DNA `solid-figure`. The solid is drawn in oblique 3-D (hidden edges dashed; the cylinder and cone with their base ellipse, the sphere with its equator) with every size written in the colour of the letter that names it (l red, w purple, h green, slant orange); `show` also lists the sizes on the side. `base` shades the base (cuboid floor l × w, the prism's triangle, the circle of a cylinder or cone) and works out its area; `slant` colours the slant side of a cone (or the third side of the prism triangle) and gets it from Pythagoras; `volume` writes the formula, the numbers and the result (base × height; cone one third; sphere four thirds π r³; π values exact, with the decimal for π ≈ 3.14); `net` unfolds the surface flat — six rectangles in three colour pairs, three rectangles and two triangles, two circles and a rectangle as long as the circle is round, a circle and a sector whose arc is the circle's circumference — with the area written in every piece; `surface` adds the pieces (the sphere: four great circles of area π r²).
- The planner gives the solid, its whole-number sizes (cuboid 2–20, prism legs 3–24 with a whole third side such as 3-4-5, cylinder r 1–14 and h 2–30, cone r, h 1–24 with a whole slant height, sphere r 1–15, unit cm / m / mm) and the order. The app computes every area, volume and point (`dna/s-math.ts`); the validator refuses sizes out of range, proportions too extreme to draw, a cone or prism with no whole slant, a step that does not belong to the solid, `net` / `surface` before `slant` for a cone or prism, `base`, `slant` or `volume` after `net`, `net` after `surface`.
- Selector: the names of the solids (cuboid, cylinder, cone, sphere, hemisphere, prism and their adjectives), slant height, curved / lateral / total surface area, "surface area of a …", "volume of a tank / box / ball …" → `solid-figure`; circles, angles, quadratics and the other DNAs stay where they were. DNA card for semantic selection. The offline planner reads the solid and its sizes from the text (radius, height, length, breadth, the three sides of the prism triangle) and plans only the volume or surface steps the words ask for; otherwise it says the AI planner is needed.
- 29 new tests (including every cuboid, prism, cylinder and cone in range: the area of the drawn net equals the surface area, the front triangle of the prism as drawn equals the base area, the cylinder net is as wide as its circle is round, the cone sector's arc equals the circle's circumference and its radius is l, Archimedes for the sphere, S = dV/dr) and a real-canvas check of 606 pixels (light and dark, landscape, vertical, square: every visible edge, the base fill, the slant side, the colour and outline of every net piece, the four great circles); moving things gives 308 mismatches. Full-app regression unchanged. See docs/MOTION-CLASS-DNA.md §20.

## V51.9.32 — Angle geometry: parallel lines and a transversal, triangle angle sum and exterior angle, circle theorems
- New DNA `angle-geometry` with three figures. `parallel`: two parallel lines with a transversal; one given angle (any of the eight positions) and the steps `vertical`, `linear`, `corresponding`, `alternate`, `cointerior`, each drawing the partner angle as an arc with its degree value (equal angles green, 180° pairs purple) and the reason written on a side panel. `triangle`: angles A and B known, `find` C = 180 − A − B (the "?" becomes the value), `sum` check, `exterior` extends BC and shows exterior angle = the two opposite interior angles. `circle`: centre angle and circumference angle on the same chord (`centre`, `circumference`, `double`), `same-arc` (second point, equal angle), `cyclic` (opposite angles add to 180°); a 90° circumference angle gets a right-angle square (angle in a semicircle).
- The planner gives the figure, the one angle (a, or A and B, or the circumference angle beta) and the order. The app computes every angle and draws it from the drawn directions (`dna/a-math.ts`); the validator refuses angles out of range (parallel 30–150 but not 90, triangle 20–120 with A + B 60–160, circle 20–90), relations before `given`, `sum` / `exterior` before `find`, `double` without both angles, `same-arc` / `cyclic` without the circumference angle, steps of another figure, a step twice.
- Selector: transversal, corresponding / alternate / co-interior / vertically opposite angles, linear pair, angle sum of a triangle, exterior angle, angle at the centre / in a semicircle / in the same segment, cyclic quadrilateral, inscribed angle → `angle-geometry` (two hits needed). DNA card for semantic selection. The offline planner reads the angle from the text and writes the lesson in English and Malayalam; otherwise it says the AI planner is needed.
- 26 new tests (each relation re-derived from the drawn sector directions, the circle theorems re-derived from coordinates) and a real-canvas check of 138 pixels (light and dark, landscape, vertical, square: lines, transversal, the given arc, the partner arc, circle points and chords); moving one line, arc or point gives 70 mismatches. Full-app regression unchanged. See docs/MOTION-CLASS-DNA.md §19.

## V51.9.31 — Polynomials: terms, add, subtract, multiply, long division, remainder and factor theorems, square identities, graph (reference-clip idea, fitted to the textbook)
- New DNA `polynomial`: `show` writes P(x) with its degree and coefficients; `add` / `subtract` line the powers up in columns (header x², x, 1; rows P, Q or −Q; a rule; the sum) and write the result; `multiply` fills an area table, every cell the product of its row and column term, cells with the same power of x in one colour, then collects the product; `divide` does long division by x − r line by line (term, multiply back, what is left in orange, quotient and remainder); `remainder` puts r into P with brackets, adds the terms up and boxes P(r), with a tick when it is 0; `factor` applies the factor theorem at a root the planner names, divides it out and writes every factor, (x − 2)(x + 1)(x − 3); `identity` recognises x² − k², x² + 2kx + k², x² − 2kx + k² and draws the area picture (a square cut into x², strips and k²) with the product written out as a check; `graph` draws the curve in a window that shows every real root and turning point; `roots` marks the whole-number roots on the x-axis.
- The planner gives P as whole-number coefficients (degree 2–4), optionally Q and a divisor x − r, and the order. The app computes every line (`dna/p-math.ts`); the validator refuses coefficients out of range, `add` / `subtract` / `multiply` without Q, `divide` / `remainder` without r or above degree 3, `multiply` tables that do not fit, `factor` unless P is monic and splits completely into whole-number roots (and names the real roots when "at" is not one), `identity` for any other polynomial, `roots` before `graph` or with no whole-number root.
- Selector: remainder theorem, factor theorem, "degree / zeros / coefficients of a polynomial", polynomial division, monomial / binomial / trinomial, "remainder when … divided by", or "polynomial" together with a cubic or quartic → `polynomial`; a bare "polynomial" (for example "the graph of a quadratic polynomial is a parabola"), quadratic equations, identities such as (a + b)² and the other DNAs stay where they were. DNA card for semantic selection. The offline planner reads the polynomial from the text, the divisor after "divided by", and adds divide, remainder, factor, identity, graph and roots as the words and numbers allow; otherwise it says the AI planner is needed.
- 24 new tests (including brute force over hundreds of polynomials: sums, differences and products agree with evaluation, P = (x − r)q + R and R = P(r) for every division, every full factorisation, every graph window contains all roots and turning points) and a real-canvas check of 102 pixels (light and dark, landscape, vertical, square: the curve on the polynomial, dots on the roots, the four edges of the area picture); moving one curve point, the roots or the picture gives 30 mismatches. Full-app regression unchanged. See docs/MOTION-CLASS-DNA.md §18.

## V51.9.30 — Quadratic equations: parabola, discriminant, factorising, the formula, roots on the graph, check
- New DNA `quadratic-equation`: the equation a x² + b x + c = 0 is pinned at the top; `graph` draws the parabola (purple, clipped to a window that shows the vertex, the roots and both axes); `discriminant` writes D = b² − 4ac, then with the numbers, then D, with its nature (D > 0 green, D = 0 orange, D < 0 red); `factorise` splits the middle term, groups, writes the product (x − 3)(x − 2) = 0 and the two linear equations, then x = 2 or x = 3; `formula` writes x = (−b ± √D) / 2a as a stacked fraction, then with the numbers, then the roots (a negative D stops at "D < 0": no real root; a non-square D ends with ± √D); `roots` puts a dot on the x-axis at each root; `check` puts each whole-number root into the equation and ticks it.
- The planner gives a, b, c and the order. The app computes everything written or drawn (`dna/q-math.ts`: exact rational roots, the splitting of the middle term, the grouping, the window); the validator refuses a beyond ±6, b beyond ±20, c beyond ±36, `factorise` or `roots` when D is not a perfect square, `factorise` when b = c = 0, `roots` before `graph`, `check` unless the roots are whole numbers, a step twice.
- Selector: quadratic, second degree, discriminant, completing the square, factorising, roots of the equation, or an equation like x² − 5x + 6 = 0 → `quadratic-equation`; "square roots", "parabola" alone, function graphs and identities stay elsewhere. DNA card for semantic selection. The offline planner reads the equation from the text and writes the lesson in English and Malayalam; otherwise it says the AI planner is needed.
- 20 new tests, including a brute-force check of every a, b, c with a perfect-square D (roots satisfy the equation exactly, the splitting always works, the factor identities hold), and a real-canvas check of 90 pixels (light and dark, landscape, vertical, square) that the curve is where the equation puts it and the root dots sit on the x-axis at the roots; moving one curve point or the roots gives 12 mismatches. Full-app regression unchanged. See docs/MOTION-CLASS-DNA.md §17.

## V51.9.29 — Arithmetic sequences: terms, common difference, n-th term, sum, Gauss pairing, "is it a term?", graph
- New DNA `arithmetic-sequence` (the first of the "missing branches" DNAs): the first 4–7 terms in boxes with x₁, x₂ … beneath; an arrow from each term to the next carrying the common difference (+4, −3); `formula` writes x_n = a + (n − 1)d, then with the numbers, then simplified (4n − 1); `term` n works out a far term (x₂₀ = 3 + (20 − 1) × 4 → 79); `sum` n writes S_n = n ÷ 2 × (first + last) step by step (odd n handled); `pairs` brackets the first with the last, the second with the second last … each labelled with the same sum, then pairs × sum; `test` v solves n − 1 = (v − a) ÷ d and ticks (n = 25) or crosses (n = 1/3) — a number is a term only when n is a whole number ≥ 1; `graph` plots (n, x_n) on a plane with a dashed line through them (up for d > 0, down for d < 0).
- The planner gives a, d, how many terms the row shows and the order. The app computes every term, line and sum (`dna/as-math.ts`); the validator refuses d = 0 or beyond ±12, a beyond ±50, a term already in the row, `term` or `test` before `formula`, `pairs` with an odd number of terms or after `formula`/`graph`, n beyond 100.
- Selector: arithmetic sequence / progression, common difference, "20th term", sum of the first n terms, or a list of numbers with a constant difference ("2, 5, 8, 11") → `arithmetic-sequence`; geometric sequences ("common ratio"), plain lists of data and years stay elsewhere. DNA card for semantic selection. The offline planner reads the list or "first term … common difference …" and the nth-term number from the text and writes the lesson in English and Malayalam; otherwise it says the AI planner is needed.
- 25 new tests (305 in the Motion Class + motion engine suites), including brute-force checks of nth/sum/membership over thousands of (a, d, n), and a real-canvas check of 288 pixels (light and dark, landscape, vertical, square) for the boxes, arrows, graph points, the dashed line and the Gauss brackets; moving one graph point gives 12 mismatches. Full-app regression unchanged. See docs/MOTION-CLASS-DNA.md §16.

## V51.9.28 — Pair of linear equations: two lines, elimination, substitution, check, matrix form (reference-clip idea, fitted to the textbook)
- New DNA `linear-system`: two equations a x + b y = c are written token by token in two colours; `graph` draws the plane and both lines; `meet` marks the point where they cross with its coordinates; `eliminate` x or y multiplies the equations to equal coefficients (shown as "(2)×2"), adds or subtracts them, writes the one-unknown equation (7x = 14) and the value found; `substitute` puts that value into equation 1 or 2 and finds the other unknown; `check` writes the solution into both equations and ticks them; `matrix` writes A · x = b with the coefficients flying out of the equations into the matrix (the idea of the "System to Matrix" clip). Steps can come in any teachable order (graph first or algebra first).
- The planner gives the six whole numbers and the order. The app solves the system and computes every line it writes (`dna/lin-math.ts`); the validator refuses parallel lines, the same line twice, a solution that is not a pair of whole numbers inside ±6 (so every intermediate line stays a clean whole-number equation), a coefficient of 0 or above 9, `substitute` before one unknown is found, `check` before both are, `meet` without `graph`, an unknown found twice.
- Selector: "pair of linear equations", "simultaneous equations", "system of equations", elimination / substitution / graphical method → `linear-system`; a plain two-equation block with no such words stays with `equation-pair`; one-variable equations, matrix size talk and word problems stay where they were. DNA card for semantic selection. The offline planner reads two equations like 3x + 2y = 12 from the text (when they have a clean solution) and writes the full lesson in English and Malayalam; otherwise it says the AI planner is needed.
- 30 new tests (280 in the Motion Class + motion engine suites), including 5000+ generated systems for the algebra and line clipping, and a real-canvas check of 168 sample pixels (light and dark, landscape, vertical, square) that each line is its colour where the equation puts it and not beside it; moving one line endpoint gives 36 mismatches. Full-app regression unchanged. See docs/MOTION-CLASS-DNA.md §15.

## V51.9.27 — Trigonometric ratios on the unit circle: every ratio a drawn segment, a sweeping angle, exact special angles (reference-clip style)
- New DNA `unit-circle`: axes and a unit circle, a point P at angle θ, the legs x and y, then each ratio drawn as the segment whose LENGTH is that ratio: cos (horizontal leg), sin (vertical leg), tan (tangent at P down to the x-axis), cot (tangent up to the y-axis), sec (centre to where the tangent meets the x-axis), csc (centre to the y-axis). Each ratio is written beside the figure in its own colour with its formula (tan = sin/cos, sec = 1/cos …). `sweep` moves θ and every segment, label and the point follow; `values` writes exact values at 30°, 45°, 60° (cos 30° = √3/2, tan 30° = 1/√3) or decimals elsewhere; `identity` writes sin² + cos² = 1, 1 + tan² = sec² or 1 + cot² = csc² only when the app has checked it at the current angle; `box` frames the formulas.
- The planner picks the angle (20–70°, whole degrees) and the order. The app computes all geometry and values and refuses impossible plans: ratio before its legs, a ratio twice, a sweep to the angle already shown, angles outside 20–70.
- Engine: rotated board text (`Motion.turn`, `rot` track) so labels lie along their segments and turn with them during a sweep; never upside down.
- Selector: trigonometry talk (sine, cosine, cosecant, cotangent, unit circle, sin 30°, "secant" except "secant of a circle") → `unit-circle`; tangent/secant of a circle stay in geometry. DNA card for semantic selection; the offline planner draws the ratios named in the text and uses the angle in the text.
- 27 new tests (250 in the Motion Class + motion engine suites) and a real-canvas check of 64 sample pixels (light and dark, landscape and vertical, before and after the sweep) that each segment is its ratio's colour at the right place; moving the tan endpoint in the builder gives 8 mismatches. Full-app regression unchanged. See docs/MOTION-CLASS-DNA.md §14.

## V51.9.26 — Sets and Venn diagrams: shaded regions, De Morgan, lists and counts (reference-clip style)
- New DNA `venn-sets`: the universal set as a rectangle with two or three circles A, B, C; the region of each set expression fills in colour with the expression written beneath (A ∩ B, A ∪ B, Aᶜ, A − B, B − A, Aᶜ ∪ B, (A ∩ B)ᶜ …); `identity` shows De Morgan style laws; with `elements` the regions hold numbers or words and `list` writes `A ∩ B = {2, 4}` while `inclusion` writes `n(A ∪ B) = n(A) + n(B) − n(A ∩ B)` and `= 4 + 4 − 2 = 6`, all counted by the app.
- Set algebra in `dna/venn-math.ts`: an expression is a bitmask over the 2^n basic regions, so the app knows exactly which regions it covers and whether two expressions are the same set. The validator refuses a false `identity` (and names the regions where the sides differ), mixed operators without brackets, a set that does not exist, elements that repeat, or too many elements for a region.
- Engine: `region` item (`Motion.region`) fills any combination of Venn regions by clipping to each circle (inside) or to the universe minus the circle (outside); drawn symbols ∪ ∩ ∅ ∈ in board text (the board font has none of them; this also fixes the `∈` in the matrix size line); `measureSpaced` counts leading and trailing spaces in runs, so spacing around symbols is right on canvas back-ends that drop them.
- Selector: set talk (union, intersection, complement, Venn, universal set, De Morgan, ∪ ∩) → `venn-sets`; "intersection of two lines" and "complementary angles" stay elsewhere. DNA card for semantic selection. The offline planner draws the standard operations for two or three sets (and De Morgan when named).
- 33 new tests (223 in the Motion Class + motion engine suites), plus a real-canvas check of 272 sample pixels (light and dark, landscape and vertical) that only the right regions are shaded; breaking the clip direction gives 72 mismatches. Full-app regression unchanged (17 failing before and after, none new). See docs/MOTION-CLASS-DNA.md §13.

## V51.9.25 — Shapes with their formulas: circle, rectangle, triangles, Pythagoras, special right triangles (reference-clip style)
- New DNA `shape-formula`: a figure is drawn by pen (circle, rectangle, square, triangle, right triangle, special 30-60-90 and 45-45-90), its sides are labelled (r; l, w; a, b, c; a, a√3, 2a), angle arcs show 30°, 60°, 45°, a dotted height appears on a triangle, and the formula is written beneath, first as the rule and then with the numbers worked out when the plan gives whole-number sizes (3, 4 → 3² + 4² = 25, c = 5; r = 5 → A = π(5)² = 25π; a = 5 → 5 : 5√3 : 10). Up to 6 shapes replace each other in one class.
- The planner only picks shapes and steps. The app draws to scale (30-60-90 is built from a, a√3, 2a), writes every label and formula with exact roots (√13, 5√2) and rejects steps that do not fit: height on a circle, angles on a plain right triangle, a formula the shape does not have, sizes that are not whole numbers 1-50, a without b for a rectangle.
- Engine: a drawn square root. The board font has no √, so `√3`, `5√2`, `√{x+1}` in any board text are drawn as a radical path with an overbar (works in light and dark, any format). New `reels/motion/shapes.ts`: `circlePts`, `arcPts`, `rightAnglePts`, `angleArc` (circles, angle arcs and right-angle marks are pen-drawn polylines, so they get the same animation, camera and theme as everything else).
- Selector: formula talk about a named shape (area of a circle, circumference, Pythagoras, hypotenuse, special right triangles) with at most one number → `shape-formula`; compass-and-ruler construction stays `geometry-construction`; numeric rectangle area stays `area-model`; word problems with numbers stay `word-problem`. DNA card added for semantic selection. The offline planner draws the shapes named in the text with fixed English and Malayalam captions.
- 31 new tests (190 in the Motion Class + motion engine suites); a wrong hypotenuse, a missing validator check or a wrong 30-60-90 proportion each make tests fail. Full-app regression unchanged (17 failing before and after, none new). See docs/MOTION-CLASS-DNA.md §12.

## V51.9.24 — Matrix as a grid: rows, columns, diagonal, zoom into an entry (reference-clip style)
- New DNA `matrix-grid`: bracketed grid of entries a_{ij} (or numbers), a row / a column / the diagonal boxed in turn, the camera zooms into one entry and arrows show that its two subscripts are its row and column, `A ∈ ℝ^{r×c}` and "r × c matrix", the general n × n and m × n grids with dots, and the Square / Rectangular verdict. The app writes every subscript, size and verdict; the planner only orders the steps.
- Engine: subscripts (`a_{12}`, `a_12`) in board text; deep camera zoom (`look(t, y, h, dur, x)` centres on x too and scales by height/camH without the old 1.6× cap); dark board theme (`DrawOptions.theme: 'dark'`, black board, light ink, role colours kept). Older scenes are unchanged.
- Board words (row, column, diagonal, Square Matrix, # of rows …) and the histogram's mean / median are translated by the app; positions and numbers stay identical in English and Malayalam.
- Selector: "what a matrix is" (rows, columns, entries, order, square) → `matrix-grid`; "what a matrix does" (rotate, reflect, vector, multiply) stays `plane-transform`. DNA card added for semantic selection.
- 22 new tests (159 in the Motion Class + motion engine suites); breaking the maths, the zoom, the arrows, the verdict or the dark remap makes tests fail. See docs/MOTION-CLASS-DNA.md §11.

## V51.9.23 — Semantic DNA selection (EmbeddingGemma-ready) + Malayalam evaluation
- `dna/semantic.ts`: compares a paragraph with DNA cards (`dna/cards.ts`, English + Malayalam sentences) by embedding similarity and, only when the keyword rules are not sure, lets the closest picture DNA win. Rules ≥ 0.8, headings, bridges and equation runs are never overridden; any embedder failure gives exactly the old selection.
- Embedders: `ollamaEmbedder` (EmbeddingGemma through Ollama: task prefixes, 768/512/256/128 dims by Matryoshka truncation) and `hashEmbedder` (deterministic character n-grams, no install). Card vectors are cached.
- `planSection({ selections })`, `aiPlanBlock(..., { selection })`, `offlinePlan(..., selection)` accept a precomputed selection (`hybridSelections` embeds a whole section in one call).
- `eval/dna-eval-set.ts` (24 English + 24 Malayalam labelled paragraphs), `eval/run-eval.ts`, and `scripts/dna-embed-eval.ts` (rules vs hash vs EmbeddingGemma, with a similarity-threshold sweep).
- Fix: a short Malayalam sentence with no digits (e.g. "AB എന്ന രേഖാഖണ്ഡത്തിന്റെ ലംബസമഭാജി വരയ്ക്കുക.") was classed as a bridge sentence and only read aloud; bridge detection of short prose now applies to non-Malayalam text only.
- 20 new tests. The real EmbeddingGemma model was NOT run (no access in the build sandbox). See docs/MOTION-CLASS-DNA.md §10.

## V51.9.22 — Fractions, data and chance boards (3Blue1Brown style)
- Three new DNAs: `fraction-bars` (bars cut into equal parts, equivalent fractions by cutting, adding by joining shaded parts, 10×10 tiles with decimal and percent), `histogram` (bars grow from zero, mean / median / target lines computed by the app and sliding when a bar changes) and `probability-tree` (branches with exact fractions, a path multiplies, an event adds, the ends total 1).
- Every number on screen is computed from the plan's few inputs with exact fractions; validators reject siblings that do not add to 1, joins of unequal parts, values above the axis, paths that stop before a leaf, and more.
- Selector: fraction, data (mean, median, bar graph, survey) and chance (coin, dice, outcomes, tree diagram) units no longer fall to text; word problems with no unknowns and no equations on these topics yield to the picture DNAs.
- Offline planner draws one bar per fraction found in the text ("3/4", "{1/2}"); data and chance wait for the AI planner and are flagged as such.
- 28 new tests (116 in the Motion Class + motion engine suites). See docs/MOTION-CLASS-DNA.md §9.

## V51.9.21 — Coordinate board: plane + matrix transformation, function graph (3Blue1Brown style)
- Motion engine: morphing polygons, vectors, clipping, fixed view; new `Plane` helper (whole-space matrix transformation, matrix columns coloured like î / ĵ, determinant, labels that ride the vectors).
- Two new DNAs: `plane-transform` and `function-graph` (axes, points, curve, tracker reading coordinates, shaded area, curve that bends when a parameter changes). All numbers computed by the app and validated; bilingual golden samples.
- Selector: graph, coordinate, parabola, reflection, rotation, matrix, vector units no longer fall to text (or to number-line / equation-chain); arithmetic sequences are not mental-math chains.
- Visual QA: text-only boards are flagged per unit. Offline planner draws "y = …x" without AI. Plan cache bumped to v2.
- î / ĵ spoken as "i hat" / "j hat". 32 new tests (88 in the Motion Class + motion engine suites). See docs/archive/releases/AI-GURU-V51.9.21-PLANE-GRAPH-DNA.md and docs/MOTION-CLASS-DNA.md §8.

## V51.9.20 — Interactive Motion Class (manim-web player) + MP4 kept
- Motion Class now plays live in the browser as one interactive timeline: play/pause, seek, restart (step, part, class), speed 0.25×–2× with natural voice pitch, next/previous step, "pause after each step" (manim-web slides mode), jump to any Read/Teach part, hear the same part in the other language, clickable transcript.
- Uses manim-web's own PlayerUI bar and PlayerController keyboard (Space/K, ←/→ step, Shift+←/→ seek, Home/End, S, F) plus R (replay step) and [ / ] (speed). The bar sits below the board so captions stay visible.
- ⬇ Save MP4 + subtitles (and the bar's export menu) still produce the same 1280×720 voiced MP4 + .srt. See docs/MOTION-CLASS-DNA.md §7 and docs/archive/releases/AI-GURU-V51.9.20-INTERACTIVE-CLASS.md.

## V51.9.19 — Motion Class (textbook → bilingual DNA-planned class)
- Layout reader + segmenter for textbook PDFs (headings, problems, equation runs, results, exercises, side boxes, stacked fractions); worked solutions grouped into teaching units.
- 15 DNA templates with explainable selection; mandatory DNA for problems/equations/formulae; AI composes, validates and saves new DNAs when none fits.
- AI planner (Gemini, page picture for figures) with validator (both languages, maths checked, buildable) and retry; offline planner using the verified solver.
- Class per unit: Read EN → Teach EN → Read ML → Teach ML (same graphics), voice + karaoke captions, section MP4 + .srt. See docs/MOTION-CLASS-DNA.md.

## V51.9.18 — Reel voice-over + captions (English / Malayalam)
- Every reel step is explained aloud through the classroom TTS chain (Edge → Piper → Google → Sarvam); steps wait for the voice.
- Maths read as words in both languages (speech.ts); all 12 topic examples now have Malayalam captions.
- Karaoke captions, optional second-language line, .srt/.vtt download, music ducked under the voice. See docs/archive/releases/AI-GURU-V51.9.18-REEL-VOICE-CAPTIONS.md.

## V51.9.17 — Motion Graphics Engine + Reel Studio
- One motion grammar (focus, colour roles, move, hop, swap, merge, strike, camera) for every branch of maths. See docs/MOTION-GRAPHICS-ENGINE.md and docs/archive/releases/AI-GURU-V51.9.17-MOTION-ENGINE-REELS.md.
- Column addition/subtraction/multiplication and long division recipes; derivation recipe for algebra, fractions, %, exponents, quadratics, calculus, geometry, mensuration, statistics, probability, trigonometry; chapter-intro reels (EN + ML).
- Every reel is maths-checked before it can be built. New Reel Studio page (/ai-guru/reels) with browser MP4 export and share.

## V51.9.16 — Native 3B1B visuals, real camera, MP4 export
- `plot`/`graph`/`matrix`/`barChart` render as native manim-web objects; real pan/zoom/focus camera (scrub-safe); runtime identity-camera fix; browser MP4 export (⬇ MP4). See docs/archive/releases/AI-GURU-V51.9.16-3B1B-NATIVE-CAMERA-MP4.md.


## V51.9.15 — 3B1B Renderer Lifecycle + Transform Destination Fix
- Prevent React/manim-web DOM lifecycle races that caused `removeChild` / `node is not a child` runtime crashes.
- Keep inline parent `onError` callback changes out of the renderer rebuild dependency list.
- Give manim-web a dedicated render host whose children are owned by the renderer.
- Stop pre-adding transform destination equations to the Scene; transform targets are now animation-owned until they become the active alias.
- Preserve standalone draw behavior for nodes that are not transform destinations.
- This removes duplicate/stacked equations such as `2x - 10 = 1002x` during Page 7 playback.
## V51.9.14
- Fixed Video-DNA highlight QA for Teacher-Reading source cues so narration-only textbook beats do not falsely fail critical-highlight rules.
- Mandatory deterministic templates now perform one deterministic repair pass instead of three identical repair cycles when AI regeneration is disabled.
- Pinned CLASS PLAYING/PAUSED/ERROR/COMPLETED status at the top of the whiteboard header with the live pipeline stage.

## V51.9.13 — Deterministic Template QA + Class Status
- Fixed Video-DNA `text overlap figure` QA so explicit 3B1B focus/spotlight overlays do not count as layout collisions; genuine text/figure collisions are still rejected.
- Mandatory deterministic worked-solution templates no longer fall through to slow Gemini regeneration after QA exhaustion. They fail closed immediately instead of causing the browser's 50-second timeout.
- Added a persistent `CLASS STARTING / CLASS RUNNING / CLASS STOPPED` status badge at the top of the whiteboard, with a live status detail.



## V51.9.12 — Token-Level Equation Animation
- Added deterministic LaTeX token decomposition for browser 3B1B equation morphing.
- MathTex equations now render as multipart glyph groups so variables, digits, operators and constants can transform independently.
- Algebra transforms default to `TransformMatchingTex` with mismatch pairing, allowing patterns such as `x + x → 2x` to visually combine rather than replace the entire equation.
- Fixed transform-source visibility in the manim-web adapter.
- Added explicit `token-move.atMs` support for planner-authored single-token motion.
- Existing QA and TTS clocks remain unchanged.


## V51.9.10 — QA → Repair → Recompile → QA

- Hardened `/api/ai-guru/math/teaching` so a QA failure no longer immediately returns HTTP 422.
- Added deterministic repair followed by fresh AI regeneration with exact QA failures when a provider is available.
- Every repair/regeneration candidate is recompiled and re-QA'd before it can reach the classroom.
- HTTP 422 is now fail-closed only after three repair/regeneration passes are exhausted.
- Successful responses include auditable `regeneration.attempts` metadata for the Teaching Pipeline Log.
- Preserves selected Video-DNA, Teacher-Reading source cues, verified mathematics and 3B1B visual grammar during repair.

## V51.9.8 — Teacher-Reading fallback teaches from the video templates; board can no longer overflow

- **Fixed the HTTP 422 "Local teacher fallback failed visual QA ... N created visual node(s) leave the 24px safe frame".** `repairTeacherVisualLayout` stacked every beat of the lesson in one column with a 58px minimum row height; a 16-beat page needed ~930px on a 700px board, so the bottom rows fell outside the safe frame (and the "safe frame" Video-DNA rule failed with them). The repair is now `paginateTeacherBoard`: every node is clamped into the frame and, when a new line would land on something still on the board, the board is wiped (one `erase` wipe) and a fresh page starts - like a scene change in a 3B1B video.
- **Whiteboard teaching now comes from the video templates.** New `buildTemplateTeacherLesson`: textbook sentences are still read verbatim (EN + ML cues unchanged), but the board is the verified worked-solution template (`buildSolverLesson`: KaTeX lines, one colour per variable, a reason label per line, check, answer) instead of filler labels such as "Key idea". Segments are sized to the grade's difficulty profile. Pages with no solvable problem keep the plain label board (now paged).
- Retries now change strategy (plain paged label board) instead of rebuilding the identical lesson.
- QA `text-overlap` is now time-aware: text/LaTeX that was erased before another node appeared is not an overlap. Genuine simultaneous overlaps are still rejected.
- `erase` accepts `together:true` so a page wipe plays as one motion.
- Tests: `teacher-fallback-template.test.ts` (Page 7 beads, table-and-chairs, Malayalam, grades 5/8/11, paging, overlap still caught).
- Note: this fixes the QA 422. The reason the fallback was entered at all is the Gemini planner failing (timeout / 4xx / 5xx / missing key); check the server log line `[AI Guru][3B1B teaching] planner failure` and the `warning` field of the response.

## V51.9.1 — Teacher Reading keeps going; Edge is the Malayalam voice

- **Class no longer stops after one paragraph.** The "3B1B Teacher ▶" button (and the Play fallback when the saved material lacks the visible paragraph) built a one-section run, so the loop reported "completed normally" after one passage. Both now queue one section per textbook paragraph from the cursor to the end of the current chapter (cap 80), and the textbook pane follows along. `lib/ai-guru/lesson/teacher-run.ts`.
- Fixed a ReferenceError path: `currentParagraph` was declared inside an inner block but read by the "Playback anchor" log line.
- **Edge TTS is the first voice for Malayalam** (was Piper first), in both the classroom and the Teacher Reading board; local Piper stays the next fallback. Settings → Local TTS now applies to both, and lets you pick the Malayalam Edge voice (Sobhana / Midhun). A provider that just failed is tried last for 5 minutes; Edge gets a 20 s client timeout (its handshake can take 10 s). `lib/ai-guru/tts/provider-order.ts`.

## V51.9.0 — 3B1B feel: colour, counting, continuous motion, KaTeX, templates

- New board actions `recolor`, `count`, `tween` (with `together:true` for simultaneous motion) in the schema, compiler and runtime.
- Lesson-level `colorBindings` (variable -> colour) shared by LaTeX terms, shapes and graph elements; `var:<name>` recolours a variable everywhere over time.
- Live parameters: `valueExpr` readouts, `bindX/bindY/bindWidth/bindHeight`, and a `plot` node with a moving marker and live tangent.
- Whiteboard equations are now typeset with KaTeX with per-term colour.
- Four verified, bilingual scene templates the LLM fills with numbers: number-line jump, area model, completing the square, moving point with live slope.
- Offline worked-solution lessons from the deterministic solver when no AI key is available or the planner fails; the board no longer refuses to start without a saved key.
- Safe in-house expression evaluator; colour whitelist. 32 new tests. See docs/sprints/AI-GURU-V51.9.0-3B1B-FEEL.md.

## V51.8.20 — Five-Part Lazy Study-Material Generation

- Added a local five-part textbook selector above Material Studio chapter/material selection.
- Parts are derived from the indexed page/chapter map without an AI call; the selected part keeps explicit source IDs so the other four parts are excluded from material-generation context.
- Chapter selection is now scoped inside the selected part.
- Material generation sends only the selected part/chapter plus the selected material type(s) to the generation pipeline.
- Removed the Material Studio “Create all” action to prevent accidental whole-book material generation and reduce API spend.
- Existing multi-select material workflow remains available, but generation starts only after “Create selected”.
- Added visible cost-control messaging and per-scope progress.

## V51.8.18 — General Class Play/Start Hardening + Gemini Timeout Fallback

- Fixed the remaining physical-page jump: when the selected page has no extracted paragraph, Play now keeps the PDF/reference pane on the requested physical page instead of silently advancing page 7 → page 9 or back to page 1. The readable cursor is retained only as context.
- General Class synthetic Teacher-Reading sections now preserve the requested physical page in their source anchor and `TextbookPage.pageNumber`, so the planner/reader sees the same page the student selected.
- Prevented selected-material auto-positioning from overriding an explicit page selection while Play is starting.
- Reduced the Gemini 3B1B planner timeout from 20s to 12s and trimmed oversized teacher-reading prompt payloads to reduce latency.
- Added a deterministic `buildLocalTeacherLesson()` emergency path for General Class Teacher-Reading: if Gemini times out or temporarily fails, the API still returns a playable textbook-grounded lesson using the supplied page/cue manifest. It never invents a verified solution; mathematical verification remains authoritative.
- The local fallback keeps the whiteboard concise (labels/equations/visual objects) and keeps detailed reading/explanation in the teacher speech layer. Existing bilingual material translations are reused when available.
- Added explicit playback-anchor diagnostics to the classroom log.
- Added optional pre-generated bilingual source/explanation fields to the teaching request so the emergency fallback can reuse Material Studio translations.
- Problems & Formulae remains isolated from this General Class fallback; its dedicated visual/DNA playback path is unchanged.


## V51.8.17 — General Class Page-7 Playback Lock

- Fixed the remaining page-jump defect where the selected-material synchronization effect re-ran whenever `paragraphIndex` changed and snapped a manually selected page (such as page 7) back to the material's first section (often page 1).
- Selected-material auto-positioning now runs once per material and never re-runs on ordinary page/paragraph navigation.
- General Class Play no longer falls back to section 0 when the saved material does not contain the currently visible paragraph. It creates a one-paragraph Teacher-Reading run for the paragraph actually visible on the textbook.
- Preserved the textbook cursor as the authoritative start position: Play from page 7 stays on page 7 even when the saved study material begins on another page.
- Added clearer separation between the page-navigation fix and Gemini planning failures: a 3B1B/Gemini HTTP failure no longer causes the page-position logic to select page 1.


## V51.8.16 — General Class Start/Page Stability

- Fixed General Class Play always starting Teacher-Reading from material section 0; it now starts from the paragraph currently visible/selected, preventing page 7 → page 1 jumps.
- Prevented the selected-material synchronization effect from overwriting the user's current paragraph while a 3B1B Teacher-Reading run is active.
- Passed the inferred textbook grade (including Standard IX/X/XI/XII Roman numerals) to the 3B1B planner instead of silently defaulting to Grade 12.
- 3B1B planning now tries all usable saved Gemini keys before failing.
- The teaching API now returns actionable 400/502/504 errors and logs the actual planner failure server-side instead of masking it as a generic 500.
- Teacher-Reading startup errors now surface the server's exact error in the classroom pipeline log.


## V51.8.15 — Integrated Textbook Teacher-Reading + 3B1B Video-DNA

- Integrated V51.8.14 Teacher-Reading contracts, textbook cursor and classroom controller into the V51.8.13 General Class.
- General Class play now uses Teacher-Reading + Chapter → Lesson → Beat Video-DNA as the primary path; Problems & Formulae remains isolated.
- Added structured textbook page/cue manifests so the planner must cover every readable cue in order.
- Added QA coverage for missing/invalid textbook cues, bilingual read/explain fields and verbatim textbook reading.
- Added bilingual speech sequencing: English reading → Malayalam translation → English explanation → Malayalam explanation → optional check.
- Malayalam TTS explicitly protects English variable names (ex, why, zee, ay, bee) and English mathematical terminology.
- General Class advances section-by-section without a STOPPED state between sections; STOPPED remains user/navigation cancellation only.
- Prevented page override from carrying into automatic Teacher-Reading progression.
- Added one-section Teacher-Reading mode for direct paragraph Play as well as multi-section material playback.
- Added precise textbook cue IDs and retained paragraph-level visual spotlighting; the whiteboard remains concise visual mathematics, not extracted prose.


## V51.8.13 — General Class 3B1B Video-DNA First

- General Class now starts directly from the current textbook paragraph and uses Chapter → Lesson → Beat Video-DNA as its primary visual teaching mechanism.
- Interactive Mathlet/template referrals are isolated from General Class.
- Added human-teacher topic introduction, ordinary-life purpose, variable definitions, solving plan and mistake-avoidance requirements.
- Removed long narrative text nodes from the mathematical SVG scene; detailed explanation remains in narration/captions.
- Added 20s Gemini planner timeout, 23s browser lesson timeout and one QA repair pass.
- Changed 3B1B TTS to lazy first-beat synthesis with next-beat prefetch and 8s provider timeouts.
- General Class now ends as COMPLETED instead of STOPPED; navigation/close remains an explicit stop.
- General Class stays on the current textbook page while the lesson is being taught.
- Malayalam narration preserves English mathematical terminology and English variable-name pronunciation.

## V51.8.8 — Deterministic Classroom Start + Equation Recovery
- Skip `/api/ai-guru/math/plan` when a verified deterministic solution can be built locally.
- Recover explicit textbook equations when generated `mathSteps` are missing.
- Render recovered equations as real vertical teaching rows instead of captions-only playback.
- Suppress empty generic rectangle placeholders in legacy visual fallback.
- Keep Gemini visual planning as optional enrichment for non-deterministic lessons.
# V51.8.6 — Teaching Board Flow Layout

- General-teaching planner text/LaTeX nodes now render as vertical FLOW rows instead of absolute canvas labels.
- Spatial shapes, lines, arrows, highlights and graphs remain on the visual figure.
- This prevents bilingual Malayalam/English text and equations from overlapping because of model-estimated canvas coordinates.
- Preserves the existing classroom, math verification, TTS, Video-DNA and Problems & Formulae paths.


## V51.8.4 — Classroom Playback Resilience

- Prevented a transient `/api/ai-guru/math/plan` HTTP/provider/visual-QA failure from aborting an otherwise teachable classroom section.
- General Classroom now falls back to its existing authored/verified `mathSteps` and visual actions when the optional visual planner is unavailable.
- Problems & Formulae remains isolated from this fallback path.
- Improved client API diagnostics to include HTTP status and server error details in the Teaching Pipeline Log.
- Removed the stale demo `/demo/page-27.png` fixture reference that caused 500 resource errors after the production-slim asset cleanup.
## V51.8.2 — Production Slim / Feature-Preserving Cleanup
- Removed optional Video-DNA reference MP4/WebM binaries from the production package; retained all style/registry metadata under `data/ai-guru/reference-styles/`.
- Moved the demo textbook PDF to `data/demo/` and updated `book:prepare:current`; removed the byte-identical duplicate PDF.
- Consolidated the duplicate math fallback corpus to `general-classroom-curated.json` and updated its two runtime/build references.
- Removed confirmed development artifacts and the excluded legacy application.
- Moved versioned AI Guru sprint notes into `docs/sprints/`.
- Preserved the 3B1B planner, math verification, Video-DNA selection, browser animation, Multi-TTS, cue synchronization, LTX/HyperFrames adapters, classroom, teacher, parent, material, and server-agent functionality.


## V51.7.8 — 3B1B Audit Defect Cure
- Added authoritative 3B1B math verification + QA/repair loop.
- Implemented real move animation events and transform retention.
- Materialized opening/why/prerequisite/running-example/intuition/mathematics/final-insight narration into the compiled scene.
- Added grade-based difficulty enforcement, beat-mix QA, camera/pacing execution, geometry/safe-frame QA and temporal object-ID validation.
- Wired chapter/textbook context from RAG Classroom into the 3B1B planner.

## V51.1 — Whiteboard text-wall cure
- Hard-separated narration/captions from whiteboard rows.
- Removed section-content prose fallback write action.
- Suppressed legacy prose write/latex actions while preserving math and short positioned diagram labels.
- Step bars no longer use full narration as board labels.
## V50
- Visual Pattern RAG + Visual Developer agent (lib/ai-guru/patterns), dry-run of every generated visual, timing contract, figure container for diagrams, absolute diagram labels, /api/ai-guru/patterns, pattern gallery. Includes V46-V48.

## V49 — Universal Math Branch Expansion

- Added explicit TypeScript domain registry for 25 school-mathematics branches plus `general`.
- Added deterministic routing and visual constructions for number systems, inequalities, sets and combinatorics.
- Added explicit Math branch selector and V49 coverage panel to Universal Math Studio.
- Added `/api/ai-guru/math/domains` coverage endpoint.
- Kept Math.js/Mathsteps verification, existing visual QA, reference-style system and native whiteboard renderer unchanged as canonical boundaries.
- No Python runtime was introduced.


## 2026-09-20 · Question papers taught in order + worked-solution template board

- **Question papers are indexed one question per unit** (`material-studio/question-paper.ts`). The 20-question paper used to be cut into 9 arbitrary chunks (several questions per "paragraph", Q19 split in half). It is now 22 units: instructions, Q1 ... Q20 exactly as printed, closing note. Existing uploads must be **re-uploaded** to be re-indexed.
- **Fixed "answers up to Q4 then repeats from the top"** (`lesson/paragraph-flow.ts`): when one paragraph was taught on its own, the classroom recorded the wrong paragraph number (global index read as page-local), so "continue to the next paragraph" resolved to the same paragraph and replayed it. Paragraphs now map by id, and the next paragraph is always strictly after everything already taught in the run. Sections are also re-ordered by their cited source (`section-order.ts`) whatever order the model emitted them.
- **Board follows the worked-solution template** (studied frame by frame from the supplied reference video; grammar only, nothing copied): every transformation on its own line in its own colour, an arc over the part just operated on / a circle around the isolated term, a coloured label to the right ("Subtract 5 from both sides"), the answer boxed, then a **Check** (substitute back, both sides agree) and "The solution is ...". Renderer: `components/ai-guru/template-row-dom.ts`; rows: `math/template-types.ts`, `math/template-focus.ts`.
- **Deterministic solver** (`math/template-solver.ts`, exact fractions, no AI): linear equations (brackets, unknown on both sides, fractions/decimals), quadratic by the formula (a,b,c -> formula -> substitute -> discriminant -> both roots -> check both), pair of linear equations by elimination, (a+b)^2 and (a+b)(a-b) identities, expand/simplify, surds, integer arithmetic. Every answer is substituted back before it is used; anything it is not certain about returns null and the lesson's own steps are drawn in the same template look. On the 20-question paper it covers Q1, 3, 4, 5, 15, 16, 17, 20; the rest (word problems, calculus, geometry) use the model's steps.
- Bilingual: each solver row has an English and a Malayalam caption (fixed vocabulary; please have a Malayalam-speaking teacher review the wording).
- Prompt rule 9b: one section per numbered question, in order, complete worked solution ending with a check.
- Tests +35 this round (question-paper indexing on the real paper text, repeat-bug reproduction, section order, solver on every algebra question, template rows). The 8 older failing tests in `lib/ai-guru` are unchanged.


## 2026-09-20 · Classroom layout: half textbook, half single whiteboard

- **Workspace is now two equal halves**: textbook page (left) and ONE whiteboard (right), side by side from tablet width up (`md:grid-cols-2`); on phones they stack. The old 3-column strip (Solution lines / Transformation steps / Explanation & voice) and the separate "Problem from textbook" card are removed - the textbook is already on the left and the problem is pinned on the board.
- The previous layout class was assembled at runtime (`xl:grid-cols-[...${...}]`), which Tailwind cannot generate, and only applied from 1280px anyway - which is why the textbook sat full-width above the board on narrower windows.
- **The template decides how the board is drawn** (`lib/ai-guru/teaching/board-mode.ts`): symbolic/numeric templates use the ordered derivation column; geometry/graph/statistics templates play the lesson's authored visuals in full. The board header shows the mode and the selected template.
- One-line caption bar under the board (English or Malayalam per the teaching language) replaces the caption column.
- The lesson index is a slide-over drawer opened from the whiteboard header ("Index"), so the two halves stay exactly 50/50.


## 2026-09-20 · Ordered derivation board, template selection, page-image 500

- **Board = ordered derivation column** (`lib/ai-guru/math/derivation-beat.ts`, follows the approved `visual-derivation-explanation-v1` grammar): problem pinned, starting equation written first, then per step: highlight the working line, one operation tag (`↓ subtract 10 from both sides`), new line pulses pink then settles cyan, final line green. Earlier lines stay, dimmed, so the whole solution reads top-to-bottom. Captions and Malayalam prose are no longer painted on the board (the previous integration did this by mistake; the board is maths-only per AI-GURU-V45-MATH-TEACHING-SEPARATED-CAPTIONS.md).
- **Narrative "steps" stay off the board** (e.g. a preface step "Dynamic GeoGebra Model"): only steps that contain real mathematics are drawn or listed as solution lines.
- **Side panels grouped per paragraph** (`§2 · heading`, Start line, Step 1, 2, 3 … restarting for each paragraph) instead of one global Step 1…8 across unrelated paragraphs.
- **Material prompt rule 8** (`pipeline.ts`): mathSteps only for real problems; strict solving order; one variable naming; never solve the same problem twice in a section (separate "Method 1/2" sections instead). Applies to newly generated materials - regenerate old ones.
- **Template selection**: worded problems containing a real equation are now classed `linear_equations` (were `general`, so no template); the section's solution steps take part in selection; a multi-step equation chain (3+ equation lines) counts as a concept match. A single bare equation still does NOT trigger a referral (existing rule kept).
- **page-image 500 fixed and reproduced under `next dev`**: pdfjs was being bundled by Turbopack (worker not found) - `serverExternalPackages: ['pdfjs-dist','@napi-rs/canvas']` in `next.config.ts`; pdfjs's own optional `canvas` (node-canvas) is usually not built, so the route now polyfills DOMMatrix/Path2D/ImageData and supplies a CanvasFactory from `@napi-rs/canvas` (one canvas library end to end; mixing two segfaults the server); `standardFontDataUrl` so non-embedded Times body text renders; any failure returns a visible SVG placeholder (HTTP 200, reason in `x-page-image-error`) instead of a 500.
- Types: `VisualAction` `write` gains optional `role` (incl. `op`); `highlight` gains optional `durationMs`.
- Tests: +9 (derivation beat, grouping, template selection). 8 older tests in `lib/ai-guru` were already failing before this change and are unchanged.

## 2026-09-16 · Material Studio reliability + creation tabs

- Fixed Gemini structured-output parsing so separate JSON objects or trailing model commentary no longer get concatenated with `lastIndexOf('}')`, eliminating the `Unexpected non-whitespace character after JSON` failure seen during material creation.
- Moved Gemini BYOK and Replace/Choose PDF controls into a dedicated, always-visible action bar directly below the horizontal workspace navigation.
- Reworked material creation controls into horizontal creation tabs with persistent visual states: green for created, violet for selected/running, red for failed, and dark for remaining.
- Restored persisted created-material states when Material Studio loads an indexed textbook and added a created/total counter.
## V45 — Reference video library expansion
- Added three user-supplied reference videos to `public/reference-styles/`.
- Added style profiles, generation prompts, reference metadata and dedicated QA profiles.
- Added automatic style selection cues for first-principles calculus, slope-to-derivative, and quadratic-formula lessons.
- Added regression tests for the three reference styles.

# Changelog

## Sprint 8.5.2 — Trigonometry + Riemann Reference Styles
- Added approved trigonometry unit-circle/identity reference video to `public/reference-styles/`.
- Added approved calculus Riemann-sum/area-under-curve reference video to `public/reference-styles/`.
- Registered both styles in the canonical Visual Reference Style Library.
- Updated the Visual Style Selector to prefer the unit-circle reference for trig identities/unit-circle concepts and the Riemann reference for definite-integral/Riemann-sum/rectangle-area concepts.
- Added selector regression tests for both routes.
- Extended the style audit to verify reference assets, library registration and selector integration.
- Fixed an existing extra closing brace in `lib/ai-guru/math/planner/gemini.ts` that caused `TS1128` during global TypeScript checking.

## Sprint 8.5.3 QA
- Added five-case reference-style QA matrix.
- Added dedicated geometry-area, unit-circle, and Riemann visual compiler primitives.
- Added semantic planning checks for decomposition, trig identity connection, and sum-to-integral progression.
- Fixed reference manifest so all five approved reference videos are registered.

## Sprint 8.5.4 — Reference-quality animation repair
- Added style-specific pacing and action-duration propagation.
- Added deliberate visual pause gaps.
- Made AI plan domain detection authoritative for automatic style selection.
- Added style-aware renderer palettes and improved geometry/Riemann visual grammar.
- Added bilingual universal narration cues.
- Added reference quality audit.


## Sprint 8.5.5 — Single-Language Two-Pass Teaching
- English is the first visual/narration pass.
- Malayalam is the following translation-class pass.
- Universal Math scenes now declare `teachingLanguage`.
- Narration cues carry exactly one active language and no bilingual payload.
- Gemini visual planner is instructed to emit natural-language labels/captions only in the active language.
- Deterministic fallback localizes common teaching labels for Malayalam.
- Universal Math Studio adds an explicit English-first / Malayalam-translation pass selector.
- Added regression coverage for one-language-at-a-time rendering.
- Added language two-pass documentation.

## Sprint 8.5.6 — Common Teaching Grammar + Reference-Specific QA
- Added `area-formula-visual-derivation-reference` from the newly uploaded 112-second area-formula teaching video.
- Added shared `visual-derivation-explanation-v1` teaching grammar: one idea per beat, visual reasoning before symbolic compression, continuity, concise annotations, insight pauses, and formula-after-reasoning.
- Added versioned reference-specific QA profiles and paragraph-scoped enforcement.
- Visual Step Agent now stamps `qaProfileId` and `commonTeachingStyleId` onto canonical visual steps.
- Gemini Visual Planner receives the common teaching grammar and selected QA profile.
- Recovery remains scoped to the failed paragraph/problem/visual step and must re-pass the same reference QA profile.
- Existing AI Guru graphics/math engine remains the renderer; reference videos provide style grammar only.

## V49 — Mathematical Token Motion

- Added executable `token-move` VisualAction for digit/operator/term-level animation.
- Token motion supports independent X/Y movement, configurable duration, font size, and fade-out.
- MathLikeAnimBoard fallback renderer now animates the actual token rather than a placeholder marker.
- Universal math scene/compiler carries token-move actions through to the renderer.
- Gemini visual planner is instructed to emit token-move actions for physical digit/sign/term transformations instead of describing movement only in narration.
- Material Studio visual normalization accepts token-move actions.

## V51.2 — 2026-09-21
- Fixed stale previous Material Studio material leaking into a newly uploaded classroom PDF.
- Wired selected referral videos through the actual Gemini video-grounded `/api/ai-guru/math/plan` pipeline and classroom renderer; temporal grounding evidence is required before using the grounded plan.
- Fixed physical PDF page jump so requested pages display even when no extracted paragraph begins on that page.

## V51.4 — K-12 reference library / quota protection
- Separated 20 physical problem-solving reference assets by curriculum branch.
- Added local problem-solving Visual DNA cache and made repeated Gemini video upload opt-in.
- Replaced oversized MathVizAI fallback corpus with 69 unique K-12 visual-pattern entries.
- Removed old FAISS stores containing 1,911 broad chunks so they cannot be selected at runtime.
- Added organised per-branch general-classroom RAG files and a master catalogue.

## V51.6 — Classroom / Problems & Formulae separation
- Removed the 20 physical problem-solving references from normal classroom strategy selection.
- Normal classroom now uses only general-teaching K-12 Visual DNA/templates, while retaining verified problem solving as part of teaching.
- Added Material Studio type **Problems and Formulae**.
- Problems and Formulae retrieves only the most relevant patterns from the 20-reference problem-solving DNA library during material creation; no MP4 is watched/uploaded.
- Problems and Formulae playback bypasses classroom template selection so the two visual styles cannot be mixed at runtime.

## V51.8.1 — Sprint I Integrated Video Pipeline
- Merged Sprint I renderer-neutral video subsystem into the V51.7.8 application.
- Unified Sprint I Multi-TTS manager with the existing AI Guru Edge, Google Cloud, Sarvam and Piper providers; no duplicate provider stack is required.
- Added word-level scene cue generation and speech-to-scene synchronization.
- Wired 3B1B TeachingLesson → Video-DNA → renderer-neutral GuruLesson → Multi-TTS → production QA.
- Added `POST /api/ai-guru/video/lesson` integration endpoint.
- Preserved existing math verification as the mathematical authority.

## V51.8.5 — Teaching Board Overlap Fix
- fixed overlapping General Classroom planner labels on the responsive teaching board
- normalized text/LaTeX node geometry for Malayalam/English readability
- added browser-side text collision avoidance
- prevented hidden WASM SVG from creating a duplicate visual layer under the DOM renderer

## V51.8.9 — Template Grammar / Equation-Flow Fix
- General Class detects textbook equation chains before invoking the generic visual planner.
- Equation chains render through the deterministic template-row grammar.
- Removed broad `algebra` referral trigger from Fundamental Algebra template selection.
- Generic algebra visual plans without symbolic/derivation content are rejected.

## V51.8.10 — Concept-First Classroom + Completion State
- Added deterministic concept bridge before algebra derivation: variable meaning, quantity relationships, and equation formation are explained before symbolic operations.
- Added `COMPLETED` classroom state so normal end-of-lesson is no longer displayed as `STOPPED`.
- Starting another material now cancels the previous run without emitting a false user STOP state.
- Preserved explicit STOPPED state for user/navigation cancellation.

## V51.8.10 — Concept-First Classroom + Completion State
- Added deterministic concept bridge before algebra derivation: variable meaning, quantity relationships, and equation formation are explained before symbolic operations.
- Added `COMPLETED` classroom state so normal end-of-lesson is no longer displayed as `STOPPED`.
- Starting another material now cancels the previous run without emitting a false user STOP state.
- Preserved explicit STOPPED state for user/navigation cancellation.

## V51.8.19 — ODL-style hybrid OCR/page repair

- Material Studio now keeps PDF.js as the fast text-layer path and automatically OCRs weak/empty pages.
- Added OpenDataLoader/Docling hybrid backend support via `OPENDATALOADER_URL`.
- Added local `pdftoppm` + Tesseract fallback for hosts without the ODL service.
- Added targeted OCR repair for a physical textbook page when the indexed paragraph map is missing it.
- Page repair preserves the requested PDF page instead of silently teaching from the next readable page.
- Added OCR diagnostics and deployment documentation.

## V51.9.7 — Teacher-Reading regeneration hardening
- QA now verifies compound simultaneous-equation fields atomically (`a=b and c=d`) instead of rejecting the human-readable conjunction.
- Local Teacher-Reading fallback performs a true fresh rebuild on every QA repair pass (maximum 3), rather than reusing the failed lesson.
- Deterministic full-board repair now reflows all drawable nodes into non-overlapping columns and preserves mathematical object identity.
- Regeneration attempts are logged explicitly as `regeneration pass N/3` and the final response includes the attempt results.

## V51.9.11 — Manim-Web primary 3B1B renderer
- Added the `manim-web` browser/WebGL adapter as the primary 3B1B rendering backend.
- Kept AI Guru Scene IR, RAG, Video-DNA, math verification, TTS and QA as the authoritative layers.
- Added a renderer preflight plan and unit test.
- Synchronized manim-web timeline seeking to the existing measured TTS `timeMs` clock.
- Retained the deterministic SVG renderer as a WebGL failure fallback.
