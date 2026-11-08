# HyperFrames heading intros

Eight looks (graph, chalk, globe, rain, curtain, atom, notebook, sunrise), each a small HTML + GSAP page, 5 s, 1920×1080,
English or Malayalam. `build-intros.mjs` renders one WebM per heading with HyperFrames and writes
`public/ai-guru/intros/manifest.json`. The classroom finds a heading's clip by key and plays it in place of the three.js intro;
a heading without a clip keeps the three.js intro.

## Make the list of headings

Compile the chapter with `onIntro` and save what it reports (this keeps look choice and keys identical to the class):

```ts
const list: IntroRequest[] = [];
compileClass(units, plans, { title: section.title }, { headingIntro3d: true, subject: book.name, onIntro: (r) => list.push(r) });
// write JSON.stringify(list) to headings.json
```

## Render

```bash
node tools/hyperframes-intros/build-intros.mjs --in headings.json --out public/ai-guru/intros --format webm --quality looks
```

* Needs Node 22, ffmpeg and Chrome (`HYPERFRAMES_BROWSER_PATH=/path/to/chrome` if hyperframes cannot find one).
* Clips already in the manifest are skipped, so re-running only renders new headings.
* About 20–40 s per clip on a plain CPU; a GPU machine is faster.
* The Malayalam font (Noto Sans Malayalam 700/800) is bundled in `fonts/`; the pages load no network files.
* `--format mp4` also works, but WebM plays in every browser without extra codecs.

## Add a look

Copy a file in `looks/`, keep `data-duration="5"`, end with `tl.to('#root',{opacity:0,…},4.6)`, use `D` (heading, sub, kicker, lang,
subject, seed), `fitText`, `splitUnits`, `SYMS`, `R()` from `common.js`, then add it to `LOOKS` in `pick-look.mjs` **and**
`lib/ai-guru/motion-class/intro-clips.ts` (the test fails if the two differ).
