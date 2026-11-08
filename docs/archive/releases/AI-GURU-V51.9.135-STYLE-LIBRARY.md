# AI Guru V51.9.135 — ✦ Style library (Opus-inspired styles)

Built on V51.9.126-CINEMATIC.

## What students get
Reel Studio → **✦ Style library** (below "In this reel"):
- **For lessons (40)**: hand-picked styles such as *Kinetic proof, step by step*, *Journey of a photon*, *Builds itself in five stages* and *Sand-animation history*. **All ideas (430)**: every idea that passed the safety filter.
- Search, category chips (Maths, Science, Step by step, Words & stories, Celebration, Motion ideas) and **Best for this reel**.
- **Use this style** changes the look, camera, pace, music, sounds, fonts, opener and ending of the current reel at once. The reel's content doesn't change. **Remove style** goes back to Auto.
- **The idea** shows the original prompt excerpt, with links to the original video and the creator's post. Every card credits its creator.
- **Explainers**: with a style chosen, "✨ Write the script" writes in that style. In a **class part** from the whiteboard, **✨ Make an explainer in this style** turns the class text into an explainer script, using the student's own AI key (BYOK).

## How it works
The upstream repository is 703 text prompts with no animation code. Each safe prompt becomes a **recipe** for the existing motion engine:

| Recipe part | Used by |
|---|---|
| look, camera, pace, music, pack, font, boardFont, opener, ending | `planStyle()` through `StyleChoices`. Order: pins < style < the student's own picks |
| direction, visuals | Added to the explainer writer's system prompt. The answer is still checked by `parseScript()` |
| credit (author, post, example, thumbnail) | Shown on the card |

Nothing from the original is ever executed. Rendering, voice, MP4 export, preview and self-check are the existing V51.9.126 pipeline.

## Files
| File | |
|---|---|
| `lib/ai-guru/reels/opus/library.ts` | **New**: zod schema (values limited to what the engine has), search, `recipeChoices`, `recipeDirection`, `styledLlm`, `clipPassage`, on-device memory |
| `lib/ai-guru/reels/opus/library.test.ts` | **New**: 7 tests (validity, safety, real engine styles, search/paging, small cards, styled AI + checks, class passage) |
| `app/api/ai-guru/reel-styles/route.ts` | **New**: `GET ?view&q&category&mode&offset&limit` and `GET ?id=` |
| `components/ai-guru/reels/StyleLibraryPanel.tsx` | **New**: the panel |
| `components/ai-guru/MotionReelStudio.tsx` | Panel, style state, "explainer in this style" from a class part |
| `components/ai-guru/reels/ExplainerEditor.tsx` | Optional `styleRecipe`: ✨ Write the script uses it |
| `data/ai-guru/opus-style-library.json` | **New**: 430 recipes (≈430 KB, server-side only) |
| `data/third-party/awesome-opus5-5-videos/` | Upstream `videos.json` + MIT `LICENSE` |
| `scripts/ai-guru-build-opus-library.mjs` | **New**: rebuilds the library (`node scripts/ai-guru-build-opus-library.mjs`). The hand-picked list is `CURATED` at the top |

## Checked
- `tsc --noEmit`: no new errors (the same 71 pre-existing errors in old test files as V51.9.126).
- `vitest run lib/ai-guru/reels`: 13 files, 130 tests pass (7 new).
- ESLint on new files: clean. The 3 `set-state-in-effect` errors in MotionReelStudio.tsx were already in V51.9.126.
- Browser (Playwright, dev server): the panel lists 40 / 430, search works, choosing "Sand-animation history" changed the reel Classic whiteboard → Kerala kasavu, the style is remembered after reload, and the page has no sideways scroll at 390 px.

## Not checked here
- "✨ Make an explainer in this style" with a real class part and a real AI key. The logic is unit-tested, and the AI and no-key paths are the existing `makeScript`.
- Thumbnails come from media.skillry.dev and could not load in the test sandbox. When they can't load, cards simply show no picture.
- Making an MP4 with each style: it uses the unchanged V51.9.126 export. Make one or two reels with different styles before release.

## Credits
Ideas: [awesome-opus5-5-videos](https://github.com/yihui-dev/awesome-opus5-5-videos) (MIT, © 2026 yihui-dev). Every idea belongs to its creator, linked on each card. Keep the credits, and remove an entry if a creator asks: delete it from `CURATED` or add a block rule, then re-run the script.
