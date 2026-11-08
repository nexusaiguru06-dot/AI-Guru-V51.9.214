# AI Guru Sprint 4 — Math Agent

The Math Agent is paragraph-scoped and reuses the existing Math.js/Mathsteps verifier plus Universal Math Compiler.

Flow:

`paragraph -> expression extraction -> Math.js/Mathsteps verification -> Universal Math Compiler -> paragraph.math -> Visual Step QA`

A math failure blocks only the affected generated lesson pipeline result; source paragraphs are not rewritten. The existing `/api/ai-guru/math/plan` and `/api/ai-guru/math/compile` endpoints remain the public compiler APIs, while `/api/ai-guru/math/agent` exposes the canonical paragraph-scoped agent.
