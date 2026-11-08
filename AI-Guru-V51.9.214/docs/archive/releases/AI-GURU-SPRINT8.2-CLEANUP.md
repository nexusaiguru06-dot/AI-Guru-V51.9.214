# Sprint 8.2 Cleanup

Removed from the active distribution:

- OpenMAIC workspace package tree (`packages/`)
- legacy render service (`render-service/`)
- OpenMAIC workspace configuration (`pnpm-workspace.yaml`)
- active OpenMAIC bridge/compiler dependency
- legacy non-AI-Guru Next routes from `app/`

Preserved outside the active Next.js graph:

- `legacy-app/` for historical route/reference code
- existing AI Guru agents/contracts/tests that are still part of the native runtime

The build boundary is now controlled by the root package and the AI Guru-only `app/` tree.
