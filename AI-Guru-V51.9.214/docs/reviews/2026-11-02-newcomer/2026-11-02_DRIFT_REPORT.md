# Drift: what the Elephant expected vs what the Goldfish found

The Elephant wrote seven predictions before any Goldfish report arrived. This report lists only the differences.

## Predictions that were wrong or too mild
- **"The Student ID is shown after sign-up, but probably only once."** Wrong. It is not shown at all on the screen
  sign-up opens. It is only on "My account", which the child has no reason to open.
- **"Forgot password needs the office in person."** Too mild. A self-signed-up child cannot even ask without the ID,
  and the parent's-phone option can never match because sign-up never asks for the phone.
- **"Lockout is per address."** Too mild:
  - successful sign-ups count toward it;
  - the header sign-in box turns every student sign-in into a failed admin try;
  - hosting outside Cloud Run or Netlify gives every visitor one shared key.

## Problems the Elephant did not predict
- **Its own change.** The V51.9.181 sign-in hint made the first correct sign-in on the student page look like a
  failure, and made a link from WhatsApp show a signed-in student as signed out. It was in the brief's scope, and the
  Elephant's own walk-throughs had used the header box, which takes another path. Fixed in `e7a1c50`.
- **Header.** It says "Sign in" to a signed-in student, has no Sign out, and the header box has no Forgot password.
- **Shared phones.** Sign out leaves the device's student ID and profile behind, so siblings' work gets mixed.
- **Records.** Work is not linked to the new account until "My account" is opened.
- **Passwords.** 31–60 characters are accepted at sign-up but can never sign in.
- **Class code.** It is presented as a coupon from "a friend", with "10% off fees", and the teacher is never named.
- **Classroom.** It shows a "Grade 12" sample to a Std 7 child and ignores the Malayalam medium chosen at sign-up.

## Predictions confirmed
- No way to join a teacher's class after sign-up.
- Sign-up and sign-in are English only.
- An empty school shows only the sample lesson.
