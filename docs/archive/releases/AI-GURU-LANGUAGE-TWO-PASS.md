# AI Guru Language Two-Pass

AI Guru presents one teaching language at a time.

1. **English — first explanation pass.** The teacher explains the paragraph and runs the verified visual sequence in English.
2. **Malayalam — translation class.** The same verified visual sequence is replayed with Malayalam narration/captions and Malayalam handwriting where natural-language text is drawn.
3. No English + Malayalam overlay is rendered. The inactive language is not emitted in active narration/captions.
4. Mathematical symbols, numerals, variables, diagrams and verified transformations are shared between passes.
5. Universal Math compile/plan APIs accept `language: "english" | "malayalam"`; omitted language defaults to English.
6. Visual QA remains paragraph-scoped. A language/render failure is attached to the current paragraph/visual step and uses the existing visual-step recovery boundary.

The RAG Classroom already uses `teachingMode: "two-pass"`; this change aligns the Universal Math compiler/planner and visual presentation with that contract.
