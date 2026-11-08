# Newcomer journey: what AI Guru promises a new student (V51.9.181)

This is the Elephant's statement of intent for the Elephant–Goldfish review of the newcomer journey. Each Goldfish
checks the app against it without knowing anything else about the project.

## Who
A Class 1–12 student in India, often on a phone, often with a parent helping, reading English or Malayalam. Their
teacher (or a friend) has told them about AI Guru and may have given them a **class code** (for this test: `STDMGEXN`,
class "Std 7 Maths A", teacher "Lekha Teacher") or an **invite link** (`/j/STDMGEXN`).

## The promises
1. **Find the way in.** From the front page a newcomer can see how to start a class without an account, and how to
   make one.
2. **Classes without an account.** A student can open the classroom and press **Start class** without signing up.
   The first part of every book is free.
3. **Sign up in one form.** Name, standard, syllabus, medium, school, state, district, place, password (6+ characters),
   and an optional coupon/class code. A teacher's class code puts the student in that teacher's class.
4. **Know your sign-in.** After signing up, the student learns the **Student ID** they will sign in with, and the
   password is the one they chose.
5. **Sign in again.** On `/ai-guru/student`, with the Student ID (or admission number) and password. Five wrong tries
   lock the address for 15 minutes.
6. **Forgot password.** The student enters their Student ID and a parent's phone number (or full name); the school
   office is told and gives a new password in person.
7. **Get to the class.** Once signed in, the student can reach the classroom, see their teacher's class, and press
   **Start class**.
8. **Language.** A Malayalam-reading student or parent can follow the journey.

## Pages
Front page `/` (redirects to `/ai-guru`), student sign-in and dashboard `/ai-guru/student`, sign-up
`/ai-guru/student/signup`, invite link `/j/<code>`, classroom `/ai-guru/classroom`, teacher's notes
`/ai-guru/teacher-notes`, messages `/ai-guru/messages`.

## Test site
`http://127.0.0.1:3700` — the production build of V51.9.181 with an empty school (one teacher class, no textbooks
uploaded, no AI keys), so AI answers are not available; the classroom's built-in sample lesson is.
