# G2 — Comprehension Goldfish: the school office (live V51.9.194, Playwright, desktop)

**Paraphrase.** The office signs in to the Admin portal and uses:
- **⚙ Settings:** "every setting in one place": part prices, trial days, free doubts, AI key, grace days, referral,
  school terms, class groups, UPI, daily reminders.
- **🏫 Schools:** contracted schools, each with an SC- ID, its teachers to approve, students, commission account and
  activity log.
- **Fees:** families' UPI claims, confirmed by a bank alert or an uploaded HDFC statement when the reference and
  amount match; otherwise Confirm or Not found.
- **Fees due:** who owes money now, with reminders.

## Promises
- **4 UPI: Partly.** The waiting row and the statement auto-match worked ("3 UPI credits read · 1 payment confirmed
  now · … 1 with a different amount · 1 with no family claim yet"), and the mismatch was flagged ("The bank shows
  ₹1500 … the family paid for ₹2000. Please check."). But one Confirm click then recorded ₹2,000 with no warning, and
  the ⚠ line stayed with no way to clear it.
- **5 Receipt: Broken (wording).** All fields are there, with Congratulations and printing. But after paying only
  Part 2 it says "All five parts of every book are open for you now" (the Malayalam line too) and "Balance: Nil —
  fully paid". My fees shows "STILL TO PAY ₹6,000" and Parts 3–5 locked.
- **6 Fees not paid: Partly.** The page explains reminders, but the office is told to "run
  scripts/cloud/setup-daily-reminders.sh … (docs/DEPLOY-GOOGLE-CLOUD.md, step 10)". There were no overdue students to
  test.
- **9 One Settings page: Partly.** Everything is there, but the Admin portal still has its own Settings, UPI payments,
  Free part & enrolment and Classes & centres tabs, which edit the same things with different forms.
- **10 Schools: Partly.** Adding a school gave "Saved. School ID: SC-2-26 …". The teacher showed as waiting with
  Approve, and a commission row (₹1,800 → ₹180). But the registers contradict the discount (finding 5).

## Findings
1. **Major — office sign-in.** `/ai-guru/admin` sends a signed-out visitor to the classroom. The only sign-in box says
   "Student ID (like ST-12-26) or admission number"; typing `office` there works, but nothing tells the office so.
2. **Major — the receipt says everything is open and fully paid** (promise 5, above).
3. **Major — a mismatched amount can be confirmed in one click,** with no question and no way to record the amount the
   bank actually shows.
4. **Major — the old fee model is still on the office screens.**
   - "Free part & enrolment" says "the first fee payment recorded in Fees enrols them at once" and shows "Enrolled ·
     paid" for a student who owes ₹6,000, plus a "Paid period ended" filter.
   - The Fees tab still has fee heads (Tuition, Exam, Transport…) and "Bill a whole standard … Term".
   - Teacher rewards read "Free premium month / term / year".
5. **Major — the registers show a school student wrongly.** They show "Signed up directly · Code SC126 (no
   discount)", while her parts are ₹1,800. The code reads "SC126" on Students and "SC-1-26" on Schools.
6. **Major — the two trial settings do not stay in step.** "Free trial (days from joining)" (part fees) and "Trial
   days from joining" (free doubts) are separate. The student page shows two dates: "Free trial until 2026-11-10" and
   "trial until 2026-11-09".
7. **Major — the due day is described two ways.** One help text says "due the day after" the trial; the other says
   "due when the free trial ends".
8. **Major — bank alerts are not explained.**
   - Settings says only "docs step 11".
   - "Bank alerts reach AI Guru · none yet" reads as working, not as "not connected".
   - After a statement upload it says "last one …", so it looks connected.
   - Nowhere does it say that without alerts, every payment waits for the office.
9. **Major — contradictory texts about who confirms UPI.**
   - Settings says "the office confirms each payment", and the checkbox under it says payments are confirmed
     automatically.
   - My account still says "To pay a fee, please go to the school office", under the UPI panel.
10. **Nit — programmer words for the office:** "(V51.9.191)", "ADMIN_USERNAME / ADMIN_PASSWORD", "Cloud Shell". The
    office password cannot be changed in Settings.
11. **Nit — Schools page wording.**
    - Plurals: "1 schools", "1 teachers".
    - "School paid ₹180" reads as already paid.
    - The payout date is unexplained.
    - The students table has unlabelled columns.
12. **Nit —** the school name for receipts is empty, so receipts show "AI Guru".
13. **Nit —**
    - "due ." with a blank date for Part 3.
    - The Malayalam UPI heading says "Parts 2–5 തുറക്കും" when only Part 2 is chosen.
