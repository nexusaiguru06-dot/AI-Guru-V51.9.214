# AI Guru V51.9.19: Motion Class

No new npm packages (uses pdfjs-dist and mp4-muxer, which are already installed).

## New
| File | What |
|---|---|
| `lib/ai-guru/motion-class/layout.ts` | pdf.js runs → tagged fragments (body, heading, chapter title, side box, bubble, furniture), Symbol-font repair, stacked fractions → `{a/b}` |
| `lib/ai-guru/motion-class/segment.ts` | chapters → sections → typed blocks; front matter skipped; `teachingUnits()` merges worked solutions |
| `lib/ai-guru/motion-class/dna/*` | DNA types, registry + selection logic (mandatory rule), learned-DNA library, scene builders (word problem, area model, number table, geometry construction, number line, key result, words→equations, composites) |
| `lib/ai-guru/motion-class/plan/*` | AI planner (prompt, retry with exact errors, new-DNA creation, page picture, cache), offline planner, validator |
| `lib/ai-guru/motion-class/reading.ts` | reading scene (sentence-by-sentence, equations centred, numbers coloured) |
| `lib/ai-guru/motion-class/class.ts`, `player.ts` | Read EN → Teach EN → Read ML → Teach ML; voice; joining for export |
| `lib/ai-guru/motion-class/pdf-client.ts` | browser PDF loading + page pictures |
| `lib/ai-guru/motion-class/samples/scert9-ch1-s1.ts` | bilingual sample plans (Chapter 1, first section) |
| `components/ai-guru/MotionClassroom.tsx`, `app/ai-guru/motion-class/page.tsx`, nav | Motion Class page |
| Engine | filled polygons, dots, fill colour changes; per-segment step numbering; READ/STEP pills; tighter cameras for 16:9 |

## Verified
- 55 tests pass (25 motion engine, 5 voice/captions, 25 motion class): layout reader, segmenter, units, DNA selection, mandatory → AI DNA, AI planner with a mock model (accept, wrong maths rejected with the exact line, English-in-Malayalam rejected, new DNA composed + saved + reused, fallback), bilingual compile order, identical EN/ML graphics, sample plans valid.
- Whole SCERT IX Part 1 book: 7 chapters, 1,155 teaching units, 414 mandatory, 71 sent to the AI for a new DNA.
- Real Chromium: PDF read (144 pages in 1.6 s) → chapters → units → voiced bilingual segments → MP4 (decodes cleanly).
- TypeScript strict: new files clean.

## Limits
- The AI planner could not be run from the build machine (no network to Gemini). It is tested with a mock model; the sample plans were written by hand in its exact format.
- Figures are not in the PDF text. Geometry DNAs are drawn from the AI's figure plan, using the attached page picture; offline, geometry paragraphs get a concept board.
- Two-column pages with many side boxes can still produce a stray fragment; the AI planner receives the whole page text and repairs it.
- Malayalam translations and sample captions should be checked by a Malayalam maths teacher.
