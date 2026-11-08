# AI Guru V46 — Step icons, question header, scrollable teaching history

1. Every step row: [math line] | caption, then the icon row  # (pause)  √ (continue/next)  ® (repeat answer)  ^ (up; Shift-click / long-press = down).
2. Every answer starts with a "Question" card holding the full text extracted from the PDF.
3. Nothing is erased between answers: each answer is its own block in one scrollable column. Scroll up to see earlier teaching; "Back to latest step" returns. Auto-scroll pauses while you are reading earlier steps.
4. Only "Clear board" (or loading a new book) erases the board. ■ Stop no longer wipes it.
Files: components/ai-guru/{AIGuruClassroom.tsx, MathLikeAnimBoard.tsx, template-row-dom.ts}

# V48 additions
- Captions + # √ ® ^ icons are mandatory for EVERY step in EVERY template/board mode (algebra derivations, geometry/graph visual templates, narrative steps, legacy notes without mathSteps). Rows with no caption get a default one ("Given", "Next step", "Therefore", "Check the answer" ... also in Malayalam); steps with no derivation line get a captioned "Step n" row (lib/ai-guru/math/derivation-beat.ts: ensureCaption, playStepBar).
- Teacher persona + "no skipped step" contract (lib/ai-guru/teaching/teacher-persona.ts) injected into the material author, repair agent, visual planner and lesson planner prompts; the QA gate now rejects skipped steps and missing captions.

# V50 additions
- MathVizAI-style Visual Pattern RAG + Visual Developer agent, dry run of every visual, timing contract: docs/archive/releases/AI-GURU-VISUAL-PATTERN-RAG.md
- Board: one 1000x700 figure per answer; positioned diagram labels (placement "absolute"); shared lib/ai-guru/visual/action-svg.ts
