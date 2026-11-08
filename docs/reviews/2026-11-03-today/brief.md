# What AI Guru promises after today's work (V51.9.186–194)

The Elephant's statement of intent for the Elephant–Goldfish review of the work done on 3 November 2026. Each Goldfish
checks the app against it without knowing anything else about the project.

## Who
- **Students** of Class 1–12 in India (often on a phone, often with a parent, reading English or Malayalam).
- **The school office** (one admin, "the office") that runs AI Guru.
- **Teachers of a contracted school**, e.g. James, who teaches Physics for Std 8–10 at St. Joseph's School.

## The promises
1. **Pay by part.** Every textbook has five parts. Part 1 is free (the trial). Each next part costs ₹2,000, or Parts
   2–5 cost ₹7,000 together if paid before any part. Part 2 is due the day the free trial ends (7 days after joining;
   the joining day is day 1), with reminders and grace days. Parts 3–5 have no due date: the student pays when ready.
   There are no monthly or yearly plans.
2. **Paying opens the part in every book**, in order. Paid parts stay open. A part that is not paid cannot be opened,
   and cannot be used to make study materials — not even with the student's own AI key.
3. **Paid parts get their study materials automatically**, made on the school's AI key for the student's books, and
   the student is told in Messages.
4. **UPI.** The student pays the school's UPI ID from any UPI app (a QR with the amount and an AI Guru transaction ID)
   and types the 12-digit UPI reference. The payment is confirmed automatically when the bank's alert (or an uploaded
   statement) has the same reference AND amount; otherwise the office confirms it on the Fees page.
5. **Receipt.** After every recorded payment the student gets "🎉 Congratulations" (not "thanks") in Messages with a
   receipt: date, amount, receipt number, AI Guru transaction ID, UPI reference, what it paid for, balance; printable.
6. **Fees not paid.** Reminders before and on the due day, every day of the grace period, and once when grace is over
   (a banner "Your grace period is over, please make payment to continue").
7. **Library first.** After sign-in a student with no textbook is sent to "Download your study materials" (books of
   their syllabus and standard, first pages to check, downloaded one by one). Downloaded books appear in the
   classroom; clicking one starts the class. Study materials sit above the textbook and the whiteboard.
8. **AI keys.** The school's key makes the common study materials. Students use their own free Gemini key for making
   materials and for doubts. A student without a key can still clear doubts within limits (a free trial allowance,
   then a smaller daily one), and sees notifications that open Settings to add a key.
9. **One Settings page** for the office with every setting (school, trial & part fees, free doubts, AI key, grace
   days, referral commission, class groups, schools, UPI, daily reminders, password).
10. **Contracted schools.** The office adds a school → school ID (SC-…), with its own terms: school %, teacher %,
    students' discount %. Teachers sign up with the school ID, subject and standards → teacher ID (TS-…), and can sign
    in after the office approves. A teacher works only on their subject and standards: opens the AI materials, makes
    the school's own version (their students see it instead of the AI one), adds new ones, sets exams, sees scores.
    Every change is recorded against the teacher on the office's Schools page. Students join with the school or
    teacher ID, get the discount, and each fee they pay adds commission to a separate schools account. Their own
    invite link and ordinary commission do not change.

## Pages
Student: `/ai-guru/student`, `/ai-guru/student/signup`, `/ai-guru/student/library`, `/ai-guru/classroom`,
`/ai-guru/messages`, `/ai-guru/student/exam?id=…`, `/ai-guru/settings/gemini`, `/ai-guru/material-studio`.
Office: `/ai-guru/admin`, `/ai-guru/admin/settings`, `/ai-guru/admin/schools`, `/ai-guru/admin/fees`,
`/ai-guru/admin/dues`. Teacher: `/ai-guru/school-teacher/join`, `/ai-guru/school-teacher`.

## Test site
`http://127.0.0.1:3720` — the production build of V51.9.194, office sign-in `office` / `office-pass-2026`. Set up with:
UPI ID `manojkrish70@okhdfcbank`; the part plan on (₹2,000 / ₹7,000, 7-day trial); St. Joseph's School (Kerala
syllabus, 10% school, 5% teacher, 10% discount); a Physics Std 8 book with an AI-made MCQ and a Maths Std 8 book.
The school AI key is a dummy, so real AI calls (doubts, making materials) fail — that is expected. A bank alert is
simulated by posting to `/api/ai-guru/payments/bank-alert` with the header `x-alert-secret: egm-bank-alert-secret-2026`.
