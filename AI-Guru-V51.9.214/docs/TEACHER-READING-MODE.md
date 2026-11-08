# AI Guru V51.8.14 – Teacher Reading Mode Patch

This package contains the minimal, production-ready changes that turn the General Class experience into a true **human-teacher + textbook** interaction.

## Files included

```
lib/ai-guru/lesson/textbook-cursor.ts          ← NEW
lib/ai-guru/math/teaching/types.ts             ← UPDATED (schema 2.1)
lib/ai-guru/math/teaching/lesson-planner.ts    ← UPDATED (prompt + normalization)
lib/ai-guru/teaching/classroom-controller.ts   ← UPDATED (READ→TRANSLATE→EXPLAIN→VISUALIZE)
docs/sprints/AI-GURU-V51.8.14-TEACHER-READING-MODE.md
```

## How to apply (drop-in)

```bash
# From the root of your v5189fix tree:
cp -r path/to/this-patch/lib/ai-guru/lesson/textbook-cursor.ts   lib/ai-guru/lesson/
cp path/to/this-patch/lib/ai-guru/math/teaching/types.ts         lib/ai-guru/math/teaching/
cp path/to/this-patch/lib/ai-guru/math/teaching/lesson-planner.ts lib/ai-guru/math/teaching/
cp path/to/this-patch/lib/ai-guru/teaching/classroom-controller.ts lib/ai-guru/teaching/
cp path/to/this-patch/docs/sprints/AI-GURU-V51.8.14-TEACHER-READING-MODE.md docs/sprints/
```

Then follow the 5 integration steps in the sprint document.

## What the student will experience (beads example)

1. Textbook sentence is soft-highlighted.  
2. Teacher voice (English): “There are 100 beads, black and white, in a box; 10 more black than white.”  
3. Teacher voice (Malayalam): natural translation.  
4. Teacher explains what is known / unknown.  
5. Only then does the whiteboard draw the visual model (x and x−10).  
6. Solution proceeds with 3B1B-style transformations + verification.

No more AI-generated text walls on the right-hand board.

## Ready for deployment

After copying the files and wiring the spotlight event + `teacherReadingMode: true` flag, the app is ready for a normal production build (`npm run build` / your existing CI pipeline).
