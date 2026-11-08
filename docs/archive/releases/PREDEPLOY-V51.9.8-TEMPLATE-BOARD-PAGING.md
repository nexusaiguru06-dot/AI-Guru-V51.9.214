# AI Guru V51.9.8 - Template-based Teacher-Reading board + board paging

## Screenshot diagnosis (Page 7, "Pairs of Equations")
`Local teacher fallback failed visual QA after 3 regeneration/repair passes: 4 created visual node(s) leave the 24px safe frame | 1 selected Video-DNA QA rule(s) failed.`

Reproduced in a unit test: the fallback produced 16 beats (6 textbook-reading beats + 10 solver rows). The old repair gave each beat its own row at `max(58, 610/n)` px, so row 16 started near y=900 on a 700px board. Three identical regenerations could never succeed because the build was deterministic and the layout rule was the cause.

## Fix
1. `paginateTeacherBoard` (lesson-planner.ts) - clamp to the safe frame; wipe and start a new page when text would collide.
2. `buildTemplateTeacherLesson` - reading beats carry no board clutter; the whiteboard is the verified worked-solution template.
3. QA overlap check is time-aware (respects `erase`).
4. Route: first attempt = template lesson + paging; retries switch to the plain paged label board.

## Browser acceptance test
Page 7 beads problem, Gemini unavailable: the class must start, the board shows `b + w = 100`, `b = w + 10`, ... `b = 55`, `w = 45` in colour with a reason label per line, then the check lines and the answer. No 422.
