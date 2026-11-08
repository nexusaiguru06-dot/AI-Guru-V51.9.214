# AI Guru — Common Teaching Grammar + Reference-Specific QA

## Common teaching grammar
All approved reference videos share `visual-derivation-explanation-v1`:
- one mathematical idea per beat;
- visual/concrete relationship before symbolic compression;
- preserve continuity;
- concise labels/highlights;
- pause at insight beats;
- final formula/result after verified reasoning;
- one active language per pass (English first, Malayalam translation second).

## Reference-specific QA
The selected `qaProfileId` controls presentation QA. The profile is attached to every canonical visual step by the Visual Step Agent and checked at paragraph scope by Visual Step QA.

Math correctness remains a separate universal gate.

If a reference-specific visual QA fails, recovery is scoped to the failed paragraph/problem/visual step and must be re-checked using the same QA profile before acceptance.

## Newly added reference
`area-formula-visual-derivation-reference`
- source asset: `/public/reference-styles/area-formula-visual-derivation-reference.mp4`
- grammar: `visual-derivation-explanation-v1`
- QA: `geometry-area-derivation-v2`
- approved for: geometry, mensuration, 3D geometry
- content is never copied; only teaching grammar is used.
