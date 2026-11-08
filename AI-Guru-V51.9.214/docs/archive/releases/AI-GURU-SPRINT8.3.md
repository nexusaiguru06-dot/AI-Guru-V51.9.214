# AI Guru Sprint 8.3 — Visual Engine Merge + Asset Discipline

Sprint 8.3 does not replace the AI Guru graphics engine.

It adopts only the useful Two-Pass Visual Construction / Semantic Graph concepts:
1. Pass 1 builds semantic relationships from the existing Universal Math Compiler scene.
2. Pass 2 validates a deterministic construction order.
3. The existing AI Guru Visual Action IR and renderer remain the sole rendering path.
4. Visual Step QA remains paragraph/problem/step scoped.
5. OpenMAIC remains outside the active AI Guru runtime.

The semantic graph and construction plan are metadata contracts attached to `UniversalMathScene`.
They are not a second renderer or teaching controller.
