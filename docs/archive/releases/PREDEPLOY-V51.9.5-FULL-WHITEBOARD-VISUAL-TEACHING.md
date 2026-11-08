# AI Guru V51.9.5 — Full Whiteboard Visual Teaching Fix

## Problem observed
General Class was rendering the approved worked-solution template as a vertical DOM text column. The live Teacher Explanation caption also occupied the lower part of the board. As a result the student saw prose/steps in a corner instead of a full 3B1B-style mathematical construction.

## Fixes

### 1. Full-board cinematic template
When a worked-solution `tpl` row is revealed, the current answer block becomes a 1000x700-style cinematic canvas:
- full available whiteboard width
- stable 16:11 board aspect ratio
- equations distributed across the whole board
- right-side operation labels and step controls remain attached to each row
- no auto-scroll while the template is teaching
- rows are reflowed after each step so the complete derivation remains balanced

### 2. Larger mathematics
Template equation sizing was increased so the mathematics is the visual focus rather than the caption.

### 3. Visible transformation motion
Each derivation step now adds a short token-flight animation for a changed number. This is supplementary to the actual equation transformation and is not used as a mathematical source of truth.

### 4. Colour grammar remains active
Rows retain the worked-solution colour grammar:
- original equation
- alternating transformation colours
- result/answer green
- check orange
- boxed final answer
- focus arc/circle over the changed portion

### 5. Teacher explanation moved away from the canvas centre
The live Teacher Explanation overlay is now a compact upper-left overlay, leaving the main whiteboard available for mathematics.

## Expected Class 8 Page 7 behaviour
For the table/chair problem the board should visibly construct:
1. `t + c = 11000`
2. `t + 4c = 14000`
3. eliminate `t`
4. `3c = 3000`
5. `c = 1000`
6. `t = 10000`
7. substitute/check
8. boxed final answer

The equations should be large, coloured, spatially distributed, and animated. The teacher explanation is narration/caption support, not the whiteboard itself.

## Validation
TypeScript/TSX syntax transpilation was run against the four modified files and passed with zero syntax diagnostics. Full Next.js build/E2E could not be run because the package has no installed `node_modules`; `npm ci --ignore-scripts` exceeded the available execution window.

## Deployment gate
Do not deploy until the browser test confirms:
- full-board equations are visible;
- no prose wall replaces the mathematics;
- at least one digit visibly moves during a transformation;
- colours change between transformation rows;
- focus arc/circle appears;
- final answer is boxed/green;
- Teacher Explanation does not cover the main mathematical construction;
- Malayalam/English TTS continues independently of board rendering.
