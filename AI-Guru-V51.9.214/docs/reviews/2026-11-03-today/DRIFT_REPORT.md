# Drift: what the Elephant expected vs what the Goldfish found

The Elephant wrote nine predictions ([elephant_predictions.md](elephant_predictions.md)) before any report arrived.

| # | Prediction | Outcome |
|---|---|---|
| 1 | Older students who paid a term bill see "a confusing mix" | **Far too mild.** They are locked out of Parts 2–5 with no way to pay (G4 blocker). |
| 2 | Library redirect fine with a school ID | **Right** (G1). |
| 3 | UTR hard for a child to find | **Not tested as such.** G1 found the box, but the floating counters cover its label on a phone. |
| 4 | No way for the office to see why an alert was ignored | **Partly right, and a smaller worry.** The bigger risk is the opposite: the parser accepting too much (mandates, reversals, bare numbers), and the Gmail script dropping alerts past 50 (G4). |
| 5 | Receipt says Congratulations; no transaction ID for counter payments | **Right, but missed the real problem.** The receipt says all five parts are open and the balance is nil after one part (G1, G2, G4). The Elephant wrote that text itself, before the part plan existed, and never revisited it. |
| 6 | Settings page long; part prices hard to find | **Wrong about prices** (G2 found them). **Missed** the two trial settings drifting apart, and the old portal tabs editing the same things. |
| 7 | No approval notice; odd MCQ answer formats lose questions | **First part right** (G3). **Second wrong:** all four questions survived. |
| 8 | Security reader questions the alert door, transaction IDs and teacher-session reach | **Right on teacher-session reach, and worse than expected.** It is a blocker: every student's progress across all schools, shared question sets, paid AI keys and every book. The alert door itself was fine. |
| 9 | Malayalam missing in office and teacher screens | **Missed the more important gap.** On the student side, amounts, due dates, receipts and payment messages are English only (G1). |

## Problems the Elephant did not predict
- **Its own text from earlier versions became wrong when later versions changed the model.**
  - The receipt's "all parts open" (written in V51.9.190, before the part plan).
  - The lock card's "opens when you are enrolled / Part 1, 2 is free".
  - "Go to the school office" on My account.
  - The "Enrolled · paid" office labels.

  Each version was tested on its own; nobody re-read the earlier screens against the new model.
- **Two trials and two due days.** The doubt trial (V51.9.188) and the part-plan trial (V51.9.191) are separate
  settings that count days differently. Part 2's due date is day 8, while the doubt trial ends on day 7.
- **A failed free doubt still counts**, because the session is counted before the token is made. Only a live site
  without a real key showed this.
- **Exam integrity.**
  - The time limit is checked only in the browser, and the timer restarts when the page is reopened.
  - The answers go to the first student who hands in.
- **Office sign-in is hidden**: `/ai-guru/admin` goes to the classroom.
- **The registers show a school student as "no discount"**, because the code is stored without dashes.

## Lesson for the Elephant
Every version today passed its own tests and walk-through, but those tests checked each change in isolation. The
biggest problems sit where one version's assumptions met another's:
- the receipt (190) and the part plan (191);
- the doubt trial (188) and the part trial (191);
- the class-teacher gate (173) and the school-teacher session (193).

A cross-version check like this review should run before money goes live.
