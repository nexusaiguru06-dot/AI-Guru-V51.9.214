# AI Guru Sprint 8 — Production Hardening

This slice hardens the existing v43 multi-agent architecture without introducing a second runtime.

## Added
- Canonical agent registry with capability/tool/scope permissions.
- Single `executeAIGuruAgent()` gateway for permission checks and audit events.
- Durable session-memory persistence in PostgreSQL when `DATABASE_URL` is configured, with in-process fallback for local/demo mode.
- AI Guru audit trail; when a runtime session ID is supplied, audit events are appended to the existing agent-session event log.
- Scoped recovery controller enforcing smallest-scope recovery and mandatory re-check semantics.
- Model registry/readiness seam for downloaded/ready model state.
- Runtime inspection endpoint: `GET /api/ai-guru/runtime`.
- Agent registry tests.

## Existing systems preserved
The existing OpenMAIC agent runtime, PostgreSQL event store/NOTIFY bus, RAG, lesson generator, math verifier/compiler, visual QA, voice/sync, assessment and classroom runtime remain the execution infrastructure. No parallel runtime or renderer is introduced.

## Runtime rules
- LLM agents cannot bypass the central agent gateway when invoked through the hardened integrations.
- Agent writes are scope-limited by registry permissions.
- Session memory is durable when PostgreSQL is available.
- Audit persistence is best-effort so an audit outage cannot stop teaching; the durable agent event log remains the source of truth when a session is available.
- Recovery is bounded and scoped; unresolved failures must escalate rather than loop forever.
