# Newcomer journey review (Elephant–Goldfish) — V51.9.181

**Question:** can a newcomer sign up, sign in and attend a class easily?
**Answer:** not yet. A newcomer can get into a class, because the classroom works without an account. But the account
journey loses children:
- they are never shown the Student ID they need, and losing it locks them out for good;
- a class sharing one Wi-Fi locks itself out after five typos;
- the screens around sign-up and sign-in are English only.

One of the four blockers (sign-in looking as if it failed) was introduced in V51.9.181 and is fixed in the same pull
request (#10).

## How it was run
- **Elephant (the main session).** Wrote the promises in [`journey_brief.md`](journey_brief.md) and its own
  predictions before any report arrived.
- **Goldfish.** Three fresh agents with no history of the project, each with an EGM persona file:
  - **G1, Comprehension, student.** Anu, Class 7, on a phone. Was told only: "make an account, use our class code
    STDMGEXN". Drove the live V51.9.181 build with Playwright and judged from screenshots, without reading code.
  - **G2, Comprehension, parent.** A Malayalam-reading parent who opened the teacher's WhatsApp invite link
    `/j/STDMGEXN` on the parent's phone. Live build, screenshots, no code.
  - **G3, Design Critic.** Read the sign-up, sign-in, session, lockout and invite code against the brief. Read-only.
- **Test site.** The production build, with one teacher class ("Std 7 Maths A", Lekha Teacher), no textbooks and no AI
  keys. Screenshots are in `/var/tmp/egm-newcomer/g1/` and `/g2/` on the test machine and are not committed.

## Promise by promise
| # | Promise (brief) | Result |
|---|---|---|
| 1 | Find the way in | **Partly.** "Start a class" is clear. Making an account is only a small link inside the Sign in box, and nothing on the front page mentions a class code (G1, G2). |
| 2 | Classes without an account | **Kept.** Start class plays the sample lesson. |
| 3 | Sign up in one form; the class code joins the teacher's class | **Kept, but unclear.** It works. The box is called "Coupon code", the invite says "a *friend* invited you", and the confirmation talks about "10% off fees" and never names the teacher (G1, G2). |
| 4 | Know your sign-in | **Broken (Blocker 1).** |
| 5 | Sign in again; 5 wrong tries lock the address for 15 minutes | **Broken before this review's fix (Blocker 3); lockout too broad (Blocker 4).** |
| 6 | Forgot password | **Weak (Blocker 2).** The phone-number option can never match a self-signed-up child, and the header sign-in box has no link to it. |
| 7 | Get to the class and see the teacher's class | **Partly.** Start class works. The classroom never shows the class, the teacher or the student's standard (G1, G2). |
| 8 | Malayalam | **Not kept.** Every decision point is English only (all three). |

## Blockers
1. **The Student ID is never shown at sign-up.** (G1, G2, G3)
   - **What happens:** sign-up opens the library, which shows "Welcome… pick your textbooks". The ID appears only on
     "My account", in small text. The welcome note that says "write it down" is on a page sign-up never opens.
   - **Code:** `signup/page.tsx:59`, `student/page.tsx:129`.
   - **Also:** the sign-up form has no username field, so the browser saves the password against the Name field.
   - **Fix:** after sign-up, a full screen with the ID in large type, in English and Malayalam, with "Share to parent
     on WhatsApp", an "I wrote it down" tick, and a hidden `autocomplete="username"` field.
2. **Losing the Student ID locks a self-signed-up child out for good.** (G3)
   - **Sign-in:** works only with the ID or an admission number, and self-signed-up children have no admission number.
   - **Forgot password:** needs the ID, and the "parent's mobile" option can never match, because sign-up never asks
     for it (`signup/route.ts:52`).
   - **Signing up again:** blocked by the name + standard + school check. The same check also blocks a second real
     "Fathima" in the same class.
   - **Fix:** ask for the parent's phone at sign-up. Let forgot-password work with name + standard + school. Show the
     ID on the office's reset screen. Replace the duplicate block with "Is this you?".
3. **Sign-in on the student page looked as if it failed. Fixed in #10.** (G3; confirmed live)
   - **What happened:** the V51.9.181 sign-in hint was written only by the proxy, so the first correct sign-in left
     the form on screen. A link opened from WhatsApp also showed a signed-in student as signed out.
   - **Fix (commit `e7a1c50`):** the sign-in, sign-up and sign-out replies now write the hint themselves, and pages
     never clear it. Checked live: the first press opens the dashboard, and a second sign-in on the same phone works.
4. **A class on one Wi-Fi locks itself out.** (G3; confirmed live: the test machine's sign-ins were locked by the
   testers' few wrong tries)
   - **Counted per address:** five failures in 15 minutes lock that address (`auth.ts:51-54`).
   - **Sign-up:** every attempt is counted, including the ones that succeed, so only 5 children can sign up per
     address per 15 minutes.
   - **Header Sign in box:** tries the admin sign-in first. Every student sign-in there, even a correct one, counts as
     a failed admin try. After five, correct details get "Too many tries", and the school's admin is locked out too.
   - **Hosting other than Cloud Run or Netlify:** every visitor shares one address key ("local").
   - **Fix:** count failures per account (address + typed ID), with a high per-address backstop. Count only failed
     sign-ups. Try the student sign-in first in the header box. Refuse to start a live site when the address cannot
     be known.

## Major
5. **No way to join a teacher's class after signing up.** (G2, G3)
   - Teachers Notes says "ask your teacher for the class code" but gives nowhere to type it.
   - Opening `/j/<code>` while signed in shows the sign-up form, so the likely outcome is a second account.
   - **Fix:** add `student-portal/join` and an "Enter your class code" box. Make `/j/<code>` offer "Join this class"
     to a signed-in student.
6. **The header says "Sign in" to a signed-in student**, and has no Sign out. (G1, G2, G3)
   - **Code:** `PortalSignIn.tsx` checks only the admin session.
   - **Fix:** show the first name, the Student ID and Sign out.
7. **English only at every decision point.** (G1, G2, G3)
   - **Screens:** sign-up labels and errors, sign-in, forgot password, the lockout message, the Student ID line, and
     the header box.
   - **Front page:** its three "മലയാളം" labels are decoration and cannot be tapped.
   - **Classroom:** it starts in English even for Malayalam-medium children, and after switching only the quiz labels
     change.
8. **The classroom doesn't show the student's class.** (G1, G2) No class name, teacher or standard; the sample is
   "Grade 12 — Quadratic Equation Demo" for a Std 7 child.
9. **The class code is called a coupon.** (G1, G2)
   - The box is labelled "Coupon code (optional)", and its hint is cut off on phones.
   - The invite says a *friend* invited you and never names Lekha Teacher.
   - After sign-up nothing confirms "you joined Std 7 Maths A".
10. **The first screen after sign-up confuses a child.** (G1, G2) It shows an empty library, "your own Gemini key"
    and "Material Studio", but no "go to your class" button.
11. **The header Sign in box has no "Forgot password".** (G1, G2) It also says "Username", which a student is never
    given.
12. **Shared phones mix siblings.** (G3)
    - Sign out does not clear the device's student ID and profile, so a sibling's visitor quizzes land on the first
      child's record.
    - Sign-up is pre-filled with the previous child's name and school.
    - Sessions last 12 hours, with no shared-phone option.
13. **Work is not linked to the new account.** (G3) Free-trial work done before sign-up is not moved over, and the
    classroom keeps recording under the visitor ID until "My account" is opened. Teacher and parent reports show
    nothing.
14. **Passwords of 31–60 characters are accepted but can never sign in.** (G3, checked) Sign-up allows 60
    characters (`fees.ts:185`); sign-in reads only 30 (`login/route.ts:13`).
15. **The front page has no visible "Sign up" or "Join with class code".** (G1, G2)

## Nits
- **Lockout message:** says "a few minutes", not 15, and the wrong-password message doesn't warn that tries are
  limited.
- **Sign-up card on phones:** uses about two-thirds of the width, and the safety link floats beside it.
- **"Continue without an account":** goes to Reels, not the classroom.
- **"Back to the classroom" on the sign-in page:** goes to `/ai-guru`.
- **"Refer & earn" (commission, payouts):** shown to a Class 7 child.
- **"PIN" and "password":** both are used. After an office reset the password becomes a number, and the child is not
  told.
- **Invite link address:** the link moved 127.0.0.1 to localhost. Check that `SITE_URL` is set on the live site.

## What worked
- One-form sign-up with the class code check.
- Sign-in with the Student ID, which accepts lower case.
- The 5-try lock does trigger.
- Clear forgot-password wording on the student page.
- The teacher's class is attached when the code is used.
- Start class plays a lesson without an account.

## Suggested fix order (V51.9.182)
1. **Student ID screen:** shown after sign-up, plus the `username` field.
2. **Lockout:** per-account lockout, count only failed sign-ups, and the student sign-in first in the header box.
3. **Signed-in header:** name, ID and Sign out, with a Forgot-password link in the header box.
4. **Class code:** "Class code" wording, the teacher's name, a joined-class confirmation, and a join-a-class box.
5. **Recovery:** the parent's phone at sign-up, and forgot-password without the ID.
6. **Malayalam:** on the sign-up, sign-in, forgot-password and Student ID screens. The classroom follows the
   student's medium.
7. **Records:** link the visitor's work to the account; clear the device profile on sign out.
8. **Password limit:** the same in both places (6–30).

## Re-check on V51.9.182 (fresh Goldfish, same journey)
Two new Goldfish had no knowledge of the first review or the fixes: the student with the class code, and the
Malayalam-reading parent using the invite link. They ran the same journey on the V51.9.182 build. **Every promise
that failed before now holds:**
- the Student ID is shown at sign-up;
- the class is joined and confirmed, with the teacher named;
- signing in again works;
- forgot-password works without the ID;
- a sibling can join the class after sign-up;
- the classroom opens in Malayalam and shows "Std 7 Maths A · Lekha Teacher";
- a sibling on the same phone gets a blank form.

**What they still found, and how it was fixed in the same release:**
- **Classroom:** the "add a free Gemini key" note sat over the whiteboard. It now shows only after a camera or mic
  doubt is tried, in both languages. Teacher-only footer buttons (Import PDF, Generate) now sit behind Teacher tools.
  A student in a class sees "Your school's textbooks will appear here" instead of "upload one".
- **"Teach in" setting:** it read "English + മലയാളം" in a Malayalam class. It now reads in the order taught,
  "മലയാളം + English".
- **Forgot-password help:**
  - The two choices and their explanations now have full Malayalam.
  - The parent's mobile now works in "I forgot my Student ID too".
  - The ID typed in the header box is carried over.
- **Wrong-password message:** it now warns that 5 wrong tries mean a 15-minute wait, in both languages, and no longer
  talks about parents' quiz codes.
- **Header:** it now shows the student straight after sign-up. Sign-out says "You are signed out". The welcome card says
  "Tick the box above to go on".
- **Joining a class:**
  - The class panel (or the join box) is now above fees on "My account".
  - "Join a class" is in the header menu.
  - Joining a class for another standard shows a note.
  - The joined message stays on screen.
- **Smaller fixes:**
  - The example code is no longer a real-looking code.
  - The front page says "Welcome back · Go to my class" to a signed-in student.
  - The sign-up note explains what an account keeps.

A scripted run of the whole journey on the final build checked the following:
- the invite stays on the address it was opened on;
- the ID card is shown and the header shows the student;
- the classroom is in Malayalam, with the class chip and no teacher-only words;
- "Teach in" reads "മലയാളം + English", and the key note is not over the board;
- sign-out shows its message and leaves a blank form for the next child.

**Left for later (not newcomer blockers):**
- "Refer & earn" with commission is shown on a child's page.
- The sample lesson is quadratic equations for every standard.
- Sessions last 12 hours, with no shared-phone option.
- Hosting other than Cloud Run or Netlify still needs `AI_GURU_PROXY_HOPS` to tell addresses apart.
