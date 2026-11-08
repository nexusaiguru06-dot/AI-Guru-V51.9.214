# Security check — AI Guru V51.9.195 → V51.9.196 (3 Nov 2026)

Method: the ECC `security-reviewer` agent and `security-review` skill checklist (secrets, input, injection, auth and
access, XSS, CSRF, rate limits, data exposure, dependencies), applied by hand to the code. The new money and school
features (V51.9.186–195) were read in full.

## Result
No critical or high problems. Four medium and low problems were fixed in V51.9.196, two moderate dependency advisories
were fixed by updating the lock file, and some items are left as recommendations.

## Fixed in V51.9.196
| # | Severity | Problem | Fix |
|---|---|---|---|
| 1 | Medium | **Guessing one account from many addresses.** Wrong tries locked an account only per address (5), so someone with many addresses could keep guessing a 6-character student or teacher password. | 20 wrong tries on one account, from any address, lock it for 15 minutes (student and school-teacher sign-in). |
| 2 | Medium | **Forged bank e-mails.** The Gmail script trusted the `From:` line. A forged "HDFC" e-mail that reached the inbox could have confirmed a payment that never happened, if its UPI reference and amount matched a family's claim. | The script sends only e-mails that Gmail verified as really from the bank (DMARC pass, or DKIM signed by the bank's domain). |
| 3 | Low | **A secret header with unusual characters crashed the check** (500 instead of 401) on the bank-alert and daily-job addresses. | Bytes are compared, not characters. |
| 4 | Low | **No HSTS or content policy.** | `Strict-Transport-Security` (1 year) and `Content-Security-Policy: object-src 'none'; base-uri 'self'; frame-ancestors 'self'; form-action 'self'`. |
| 5 | Low | A school teacher's save could name a material of one book with another book's ID. | The material must belong to the book sent. |
| 6 | Moderate (deps) | `hono` (static-path bypass) and `ip-address` (slow parse), pulled in by `@google/genai` / `hyperframes`; neither is used directly. | Lock file updated: hono 4.13.16, @hono/node-server 2.1.6, ip-address 10.7.5. |

Tests: `lib/ai-guru/security-196.test.ts`.

## Checked and fine
- **Secrets:** none in the code or the git history. `.env.example.ai-guru` holds only settings. The UPI ID is meant to be public.
- **Passwords:** scrypt with a salt; constant-time comparisons; on a live site the office sign-in comes only from `ADMIN_USERNAME` / `ADMIN_PASSWORD`.
- **Sessions:** HMAC-signed cookies; HttpOnly, SameSite=Strict, Secure on HTTPS. SameSite=Strict also blocks cross-site form posts (CSRF).
- **Sign-in limits:** per account and address, plus per address. On Cloud Run the caller's address is the one Google adds, so it cannot be faked.
- **Access:** all 106 API routes were listed. 55 routes have no sign-in check. Each was read: they are sign-in pages, public pages, or AI and voice routes that run on the visitor's own key. The school's paid keys are used only for signed-in people (`server-keys.ts`), and these routes have a per-address request limit.
- **New features:** office routes check the office session; student routes use the student's own ID (no reading another student's claims, exams or receipts); school teachers see only their own exams and their subject and standards (fixed in V51.9.195); the bank-alert and daily-job addresses need a secret of 16+ characters and do not exist without it.
- **Payments:** the amount always comes from the server's bills; one claim per UPI reference; confirmations are recorded at most once; a different amount needs the office's second yes.
- **Injection:** no SQL is built from text; storage keys are cleaned (`rowName`); the only shell command (voice install) runs for the office only, with fixed downloads.
- **XSS:** React escapes everything. The few raw-HTML places use escaped or generated content (receipt, flowchart, structured data). Message buttons open only `/ai-guru/…` pages.
- **Guests:** a random 24-character ID; they never use the school's keys.

## Recommendations (not changed)
1. **School IDs are short and in order** (SC-1-26, SC-2-26…), and they are meant to be shared with the school's students.
   Anyone who learns one can join with it, get that school's student discount, and add to the school's commission.
   The Schools page lists every student who joined with each ID, so the office can spot strangers. If this matters, the
   office could approve school students, or school IDs could get a random part.
2. **`manim-web`** (maths animations) carries moderate advisories through `@mathjax/src`, `katex`, `glob` and
   `minimatch`. The fix is a major upgrade (0.40.1); test the maths animations first.
3. **Sessions cannot be revoked one by one.** Signing out removes the cookie, but a copied office cookie stays valid
   for up to 8 hours. Changing `ADMIN_SESSION_SECRET` signs everyone out.
4. **Scripts are not restricted by the content policy** (Next.js and the theme switch use inline scripts). A nonce-based
   policy is possible later.
5. **Before going live**, set `NODE_ENV=production`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET`,
   `AI_GURU_BANK_ALERT_SECRET` and `AI_GURU_CRON_SECRET` (each 16+ characters) on Cloud Run.
