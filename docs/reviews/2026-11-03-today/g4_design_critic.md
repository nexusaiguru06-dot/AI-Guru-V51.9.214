# G4 — Design Critic Goldfish (code review of 6f87b1b..V51.9.194, read-only)

## Blockers
1. **The school teacher cookie passes every class-teacher gate.** `teacherGate` (`auth.ts:163-166`) accepts any valid
   teacher cookie, including `sch:<id>`.
   - A school teacher can call `GET /api/ai-guru/progress?role=teacher` and get every student's name, code and
     sessions. Those student codes unlock the parent view of any child.
   - The same session reaches attendance, adds or deletes the global question sets, and overwrites teacher-dna.
   - The status is not checked, so a teacher the office switches off keeps this access while the cookie lasts.
   - `signedInFromCookies` (`server-keys.ts:37`) also lets them use the server's paid AI keys.
2. **Students who already paid lose Parts 2–5 when the part plan is switched on.**
   - Entitlement works out paid parts only from part bills (`enrolment.ts:89`).
   - `eligible` (`part-plan.ts:73`) gives no part bills to anyone who has already paid something.
   - So a student who paid a term, month or year is locked out, with nothing they can pay (months and years are hidden
     while the plan is on).

## Major
3. **A failed confirmation still destroys the part bills.** `update()` saves even when the callback returns an error
   (`upi.ts:153`, `store.ts:139`).
   - A ₹7,000 claim deletes the part bills, then `recordPayment` fails (the price or discount changed since the claim).
   - The student is left with a ₹7,000 bill due today and reminders running.
4. **The Gmail script can drop alerts.** It sends every message of each thread, cuts the batch at 50, then labels
   every thread (`gmail-bank-alerts.gs:29,36`). Alerts past the 50th are never sent.
5. **The alert parser accepts too much as a credit.** "received" counts as a credit word, and a single bare 12-digit
   number is taken as the reference (`bank-alert.ts:32,43`). A payment request, a mandate notice or a reversal mail can
   be read as a credit, and a claim for that amount is then confirmed with no money arriving. The script also trusts
   the Gmail `from:` filter.
6. **Two claims can share one reference.**
   - The duplicate check has no lock (`upi.ts:115`), so two claims sent at the same moment with the same reference are
     both stored.
   - Manual confirm never looks at the reference, so the office can confirm the second one too.
   - The payer's UPI ID is never compared, so the first student to claim a sibling's real reference wins.
7. **The receipt says "All five parts are open" after only Part 2 is paid.** `notify.ts:169` uses `st.enrolled`.
8. **School commission can be lost.** It is recorded only inside the best-effort receipt call, after the payment is
   saved (`notify.ts:162`). If that call fails, the commission is never recorded and nothing records it again.
9. **The unpaid-part check on making materials trusts the client.** The part comes from the material's own
   `chapterIds` and `sources` (`materials/route.ts:65`). A student can label Part 3 material as Part 1.
10. **A school teacher can read every book.** They get full, unredacted access to every book, not only their subject
    and standards (`content-access.ts:79`). School codes also run in sequence, so anyone can guess one, join with it
    and get the discount.
11. **Exams can be cheated.**
    - The time limit is not enforced; `startedAt` comes from the client.
    - The answers are returned to the first student who hands in, while classmates can still take the exam.
    - An exam built from an AI MCQ uses questions whose answers are visible in that material.
12. **Free doubts expose the school key's cost.** The limit is per account only, so every new sign-up adds sessions
    and there is no cap across all students. The token has no model or config constraints. A failed mint still uses up
    the student's daily allowance.

## Nits
13. A teacher copy of a hidden AI material is not hidden.
14. Trial end means two different days: Part 2 is due on day 8 (joining day + 7), while free doubts end on day 7.
15. Part 2 and "all at once" can both be paid; the second payment then sticks as "Could not record".
16. If the alert and the claim arrive at the same moment, each can miss the other, and nothing retries.
17. Paid-part materials are made only on the first receipt send, with no retry.
18. The receipt balance compares receipt numbers as text (unverified).
19. `schoolVersions` is not applied in `material-studio/ready` (unverified).

**Verified as working:** a payment cannot be recorded twice (the claim is locked while confirming), each receipt is
sent once per payment, alerts are kept once per reference, and the alert secret is compared in constant time.
