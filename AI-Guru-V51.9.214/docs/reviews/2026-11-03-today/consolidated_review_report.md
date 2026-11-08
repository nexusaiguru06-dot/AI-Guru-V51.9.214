# Review of today's work (Elephant–Goldfish) — V51.9.186–194

**Question:** does today's work keep the promises in [`brief.md`](brief.md)?

**Answer:** the paths themselves work.
- UPI with automatic confirmation from the bank.
- Library-first sign-in.
- The school / teacher / student flow.
- Teacher versions replacing the AI ones for that school.
- Exams with scores.

Do **not** take real money or onboard a real school yet, for three reasons:
- **Security.** A school teacher's sign-in opens the class-teacher pages, which list every student of every school.
- **What a family is told.** After paying one part, the receipt and messages say all parts are open and nothing is
  owed.
- **Switching the part plan on.** Doing so would lock students who paid the old way, with no way to pay.

## How it was run
- **Elephant (the main session).** It wrote the brief and [its predictions](elephant_predictions.md) before any
  report arrived.
- **Test site.** The production build of V51.9.194, with:
  - UPI `manojkrish70@okhdfcbank`;
  - the part plan on (₹2,000 / ₹7,000, 7-day trial);
  - St. Joseph's School (10% / 5% / 10%);
  - Physics and Maths Std 8 books, with an AI MCQ and notes;
  - a dummy school AI key;
  - bank alerts simulated with the secret.
- **Goldfish.** Four fresh agents with no history of the project:
  - **G1, Comprehension, student** ([report](g1_student.md)). Anu, Class 8, on a phone, joined with the school ID
    SC-1-26. Live build, screenshots, no code.
  - **G2, Comprehension, office** ([report](g2_office.md)). The school office, not a programmer: Settings, Schools,
    Fees and UPI, a statement upload, Fees due.
  - **G3, Comprehension, teacher** ([report](g3_teacher.md)). James, Physics Std 8–10. Signed up, was approved, edited
    the MCQ, added material, set an exam, then took it as his student.
  - **G4, Design Critic** ([report](g4_design_critic.md)). Read the code changed today (6f87b1b..V51.9.194) against the
    brief. Read-only.

  Screenshots are in `/var/tmp/egm-today/shots/` on the test machine and are not committed.

## Promise by promise
| # | Promise | Result |
|---|---|---|
| 1 | Pay by part, Part 2 due when the trial ends | **Partly.** Prices and the school discount are right. Trial end and Part 2's due date show on two different days (11-09 / 11-10) (G1, G2, G3, G4). "STILL TO PAY ₹7,200" reads as a debt. |
| 2 | Paying opens the part in every book; unpaid parts can't be used for materials | **Partly.** The opening is right, but: students who paid the old way lose everything (G4 B2). The paid part is labelled "free" (G1). The lock card says "Part 1, 2 is free" (G1). The unpaid-part check trusts the client's labels (G4). |
| 3 | Paid parts get their materials automatically | **Partly.** Jobs are queued and the student is told. There is no progress or failure shown (G1), and no retry (G4). |
| 4 | UPI, auto-confirmed on the same reference and amount | **Kept** on the main path (G1, G2). Risks: the parser reads too much as a credit (G4). A mismatched amount can be confirmed in one click (G2). Two claims can share a reference (G4). The Gmail script can drop alerts (G4). |
| 5 | Receipt with Congratulations | **Broken wording.** All fields are there, but "All five parts … are open" and "Nil — fully paid" are said after one part (G1, G2, G4). |
| 6 | Reminders and grace | **Partly.** Not seen live (nothing was overdue yet). Due-day wording conflicts (G2). |
| 7 | Library first | **Kept** (G1). The first-pages preview was blank with the test PDF. |
| 8 | Keys and free doubts with notifications | **Partly.** The notifications lead to Settings. A failed doubt still uses up the allowance (G1, G4). Paying ends the trial's doubts without warning (G1). There is no cap across all students (G4). |
| 9 | One Settings page | **Partly.** Everything is there, but the old portal tabs still edit the same things. The two trial settings drift apart (G2). |
| 10 | Contracted schools | **Kept** end to end (G3), apart from four gaps: the teacher's sign-in reaches other pages (G4 B1); no approval notice; the record says *that* something changed, not *what*; the office can't see exam results; the exam time limit is not enforced (G3, G4). |

## Blockers (fix before real use)
1. **A school teacher's sign-in passes every class-teacher gate.** (G4)
   - It reaches every student's progress across all schools, attendance, the shared question sets and teacher-dna, and
     the paid AI keys.
   - It also reads every book unredacted, not only the teacher's subject.
   - A teacher the office switches off keeps that access while the cookie lasts.
2. **Switching the part plan on locks students who already paid**, with no way left to pay. (G4)
3. **After paying one part, everything says all parts are open and nothing is owed.** The receipt, the message and My
   account all say so, in English and Malayalam. (G1, G2, G4)
4. **A failed free doubt still counts**, and a failed token mint also uses up the day's allowance. (G1, G4)

## Major (fix next)
- **Money handling:**
  - one-click confirm of a mismatched amount (G2);
  - a failed ₹7,000 confirmation leaves a ₹7,000 bill due today (G4);
  - two claims can share a reference (G4);
  - the alert parser reads mandates, requests and reversals as credits (G4);
  - the Gmail script cuts batches at 50 and drops the rest (G4);
  - school commission is recorded only inside the receipt call (G4).
- **Exams:**
  - the time limit is not enforced, and the timer restarts when the page is reopened (G3, G4);
  - the answers are shown to the first student who hands in;
  - AI-MCQ exams have their answers visible in the material (G4);
  - the office sees no exam results (G3).
- **One truth for dates and prices:**
  - the trial end and Part 2's due date on one day (G1, G2, G3, G4);
  - ₹2,000 vs ₹1,800 on Material Studio (G1);
  - "Part 1, 2 is free" and "opens when you are enrolled" on the lock card (G1);
  - "due ." with a blank date (G1, G2).
- **Leftovers of the old fee model:**
  - "Enrolled · paid", term billing, fee heads and "free premium month" rewards on office screens (G2);
  - "go to the school office" under the UPI panel (G1, G2, G3);
  - two settings forms for the same things (G2).
- **Office:**
  - sign-in is hidden: `/ai-guru/admin` goes to the classroom, and the box says "Student ID" (G2);
  - the bank-alert status reads as connected when it is not (G2);
  - a school student shows as "Signed up directly · SC126 (no discount)" in the registers (G2).
- **Teachers:**
  - no approval notice (G3);
  - the record does not say what changed (G3);
  - the Part 2+ visibility of a new material is not explained (G3);
  - a school teacher can read every book (G4).
- **Free doubts:**
  - paying ends the trial allowance with no warning (G1);
  - no school-wide cap (G4);
  - the doubt buttons don't match their messages (G1).
- **Malayalam:** amounts, due dates, receipt details and the payment and materials messages are English only (G1).

## Nits
Listed in each report: the payee name is a person, counters cover the UTR label, US date format, plurals, "School
paid" wording, programmer words in Settings, the "4 materials" vs "3" count, the ⭐ in the Students tab, and others.

## What was confirmed to work
- A payment is never recorded twice.
- Each receipt is sent once per payment.
- Each alert is kept once per reference.
- The alert secret is compared in constant time.
- Statement matching confirms and flags correctly.
- Teacher versions are hidden from other schools and from visitors who are not signed in.
- Library-first sign-in works.
- The school discount is applied.
- The ₹180 / ₹90 commission lines are right.
- Exam questions survive from the MCQ.
