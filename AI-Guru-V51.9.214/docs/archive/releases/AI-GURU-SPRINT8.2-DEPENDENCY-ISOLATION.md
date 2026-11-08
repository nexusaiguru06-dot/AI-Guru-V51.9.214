# AI Guru Sprint 8.2 — Dependency Isolation & Native Runtime

Implemented against the uploaded Sprint 8.1 package.

## What changed

- AI Guru is now a **single Next.js package**. `pnpm-workspace.yaml` was removed.
- All `@openmaic/*` `workspace:*` dependencies were removed from the active package.
- Legacy non-AI-Guru Next routes were moved from `app/` to `legacy-app/` so Next.js does not compile them.
- AI Guru's audit trail no longer imports the legacy server-agent/persistence stack.
- Session Memory no longer imports the legacy persistence provider; it uses the native AI Guru session store.
- The OpenMAIC lesson compiler was replaced by the canonical AI Guru Lesson compiler.
- The old `openmaic-port.ts` bridge was removed from the active AI Guru runtime.
- The active TypeScript project is scoped to the AI Guru app/runtime instead of the entire legacy repository.
- The postinstall hook explicitly skips the OpenMAIC workspace build.
- Malayalam classroom text uses the **Chilanka** Google Font with Noto Sans Malayalam/Nirmala UI fallback.
- MathLikeAnim board waits for the Chilanka font before creating the first SVG scene.
- Transform actions are no longer an empty SVG no-op; they create a visible derived object.

## Active architecture

RAG → Lesson JSON → Paragraph State Machine → Math Agent → Math Verification → Universal Visual Compiler → Visual Step Agent → Visual Step QA → Native Whiteboard → Malayalam/English Voice → Word/Cue Sync.

Visual recovery remains paragraph/problem/visual-step scoped.

## Verification performed here

- `package.json` parses successfully.
- `tsconfig.json` parses successfully.
- Static active-app import audit: **0 unresolved local imports**.
- Static active-app OpenMAIC import audit: **0 active `@openmaic/*` imports**.
- Full `pnpm install`/Next build cannot be executed in this environment because the npm registry is unavailable and the uploaded package has no `node_modules`; run the normal install/build on Windows.

## Legacy boundary

The old OpenMAIC/PBL/editor/workbench source is preserved under the repository for reference/migration, but it is outside the active Next.js application graph. It must not be reintroduced into the AI Guru classroom merely to satisfy a legacy import.
