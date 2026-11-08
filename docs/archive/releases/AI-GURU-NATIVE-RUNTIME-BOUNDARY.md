# AI Guru Native Runtime Boundary

The supplied AI Guru v6 work was used for cumulative mathematical derivation behavior, but the student-facing AI Guru classroom no longer depends on the OpenMAIC presentation runtime.

For the AI Guru path:

- `MathLikeAnimBoard` is the visual renderer.
- `lib/action`, `lib/playback`, and `lib/choreography` remain the action/timeline infrastructure.
- Universal Math Compiler output becomes AI Guru `VisualAction`s.
- Malayalam uses Sarvam -> Piper -> device TTS fallback.
- Paragraph-scoped Visual Step QA remains authoritative.

The root install no longer executes the OpenMAIC workspace build chain. This is intentional for the AI Guru distribution because the attached package did not contain all upstream optional build packages/configuration.

Legacy OpenMAIC-based application routes remain in the repository for compatibility and are not part of the native AI Guru classroom acceptance path.
