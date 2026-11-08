# AI Guru Reference Video Library V2

The approved reference-video registry is `public/reference-styles/ai-guru-reference-video-registry.json`.

## Library contract

Every approved reference asset contains:

- stable `id` and media path
- source/original filename
- duration, dimensions, FPS, codec and MIME type
- subject, domains and suggested grades
- concepts and explicit `selectionTerms`
- teaching methods
- reusable teaching prompt
- reference-specific QA instructions
- `styleId`, `qaProfileId` and the common teaching grammar
- `approved: true` and `doNotCopyContent: true`

The seven area-formula clips are registered as `reference_segment` assets and retain their parent reference and source time boundaries.

## Selection rule

A reference may be selected only when there is a meaningful concept/term match. Domain/subject and grade are supporting signals; they are never sufficient on their own. `lib/ai-guru/teaching/strategy.ts` enforces this with a positive concept-match requirement before a referral can be returned.

The reference is used as a **teaching grammar**, not as content to copy. The actual lesson mathematics must still pass the existing solver/verification and visual-step QA pipeline.

## QA

Run:

```bash
npm run audit:reference-video-library
```

This verifies that all registry entries have required metadata and that every registered media file exists in the app.
