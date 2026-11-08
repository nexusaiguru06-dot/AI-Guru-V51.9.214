# AI Guru V49 — Universal Math Branch Expansion

## What changed

V49 extends the existing Universal Math engine into an explicit branch registry. This is an architecture expansion, not a replacement of the existing whiteboard renderer or math verification pipeline.

### Domain registry

`lib/ai-guru/math/domains/` contains TypeScript profiles for the school-mathematics branches used by AI Guru. Each profile defines:

- branch label and description
- vocabulary used for automatic routing
- semantic visual objects
- default visual mode
- common teaching grammar

### Universal compiler

`detectMathDomain()` now recognizes the additional branches `number_systems`, `inequalities`, `sets`, and `combinatorics`, then uses the domain vocabulary registry as a deterministic fallback.

### Visual construction

The visual language now has dedicated deterministic constructions for number systems, inequalities, sets and combinatorics. Existing constructions remain in place for arithmetic, fractions, equations, geometry, trigonometry, calculus, statistics, probability, matrices, vectors and complex numbers.

### Renderer boundary

No Python runtime was introduced. The existing TypeScript/React visual runtime remains authoritative. Reference videos remain style-only; they do not dictate the mathematical method. Math.js/Mathsteps remain the verification boundary.

### UI

The Universal Math Studio is branded **AI Guru V49**, provides an explicit branch selector plus auto-detection, and shows the complete branch coverage list.

### API

`GET /api/ai-guru/math/domains` returns the V49 branch registry and count.

## Important scope note

The branch registry is universal at the engine level, while curriculum content remains source-specific. The supplied Kerala Standard IX textbook remains a curriculum reference; additional Kerala/CBSE grades must be ingested into the curriculum RAG rather than being assumed from this branch registry.
