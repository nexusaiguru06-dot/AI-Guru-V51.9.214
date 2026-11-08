# AI Guru V51.8.14 – Teacher Reading Mode

**Goal:** Make the AI teacher behave like a human teacher sitting beside the student with the textbook open.

## Cycle

```
TEXTBOOK PAGE
     │
     ▼
Textbook Reading Cursor (sentence-level)
     │
     ├── Original English sentence   (READ)
     ├── Malayalam translation       (TRANSLATE)
     └── Teacher explanation         (EXPLAIN)
             │
             ▼
       3B1B Visual DNA beat          (VISUALIZE)
             │
             ▼
       Optional micro-check          (CHECK)
```

## What changed

### New file
- `lib/ai-guru/lesson/textbook-cursor.ts`  
  Structured page → paragraph → sentence cursor with classification (readable vs decoration) and stable cue IDs (`p7-para2-s1`).

### Updated files
- `lib/ai-guru/math/teaching/types.ts`  
  - `TeachingBeat` now supports optional `sourceCueId`, `read`, `explain`, `checkQuestion`.  
  - Schema version can be `"2.1"`.

- `lib/ai-guru/math/teaching/lesson-planner.ts`  
  - Planner prompt now forces the READ → TRANSLATE → EXPLAIN → VISUALIZE cycle.  
  - Explicit rule: **never put extracted textbook paragraphs or long prose on the whiteboard**.  
  - Normalization preserves the new bilingual fields.

- `lib/ai-guru/teaching/classroom-controller.ts`  
  - New `teachBeats()` path that walks each beat with the full bilingual cycle.  
  - Emits `onSpotlight(cueId)` so the left textbook pane can soft-highlight the current sentence.  
  - Fully backward-compatible with the previous paragraph-level path.

## Integration steps (5–10 minutes)

1. Copy the three updated files + the new `textbook-cursor.ts` into the corresponding locations under `v5189fix/`.

2. In the document / OCR ingest path (wherever textbook pages are turned into paragraphs), call:

   ```ts
   import { buildTextbookPage, createTextbookCursor } from '@/lib/ai-guru/lesson/textbook-cursor';

   const page = buildTextbookPage(pageNumber, rawParagraphs);
   const cursor = createTextbookCursor(page);
   // Pass page (or JSON.stringify(page)) into the planner as textbookPageJson / textbookContext
   ```

3. When calling `generateTeachingLesson`, set:

   ```ts
   teacherReadingMode: true,
   textbookContext: /* or textbookPageJson: JSON.stringify(page) */
   ```

4. In the classroom React component (AIGuruClassroom / ClassroomSurface), listen for the new `onSpotlight` event and apply a CSS highlight / soft spotlight to the sentence whose `data-cue-id` matches.

5. (Optional) Add a UI toggle:

   ```
   📖 Teacher Reading  |  Standard  |  Detailed
   ```

   When “Teacher Reading” is selected, force `teacherReadingMode: true` on the planner and show the progress indicator:

   ```
   ● Reading  ● Translation  ● Explanation  ● Visual  ● Check
   ```

## Math pronunciation (already enforced by planner rules 22–23)

| Written | Spoken          |
|---------|-----------------|
| x       | ex              |
| y       | why             |
| 2x      | two ex          |
| x − 10  | ex minus ten    |

Technical terms stay English in both languages.

## Verification checklist

- [ ] Textbook sentence is soft-highlighted while the teacher reads it.
- [ ] English reading → Malayalam translation → explanation order is respected.
- [ ] Whiteboard never receives multi-sentence textbook prose.
- [ ] Variables are defined before they are manipulated.
- [ ] Final answer is verified with a visual check.
- [ ] Legacy paragraphs without `sourceCueId` still play correctly.

## Compatibility

All changes are additive. Existing lessons and the Problems & Formulae 20-video DNA pipeline are untouched.
