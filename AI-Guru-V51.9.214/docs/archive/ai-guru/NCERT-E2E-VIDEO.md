# AI Guru NCERT end-to-end video

The NCERT proof lesson now has one shared lesson contract for classroom playback and video export.

## Flow

NCERT paragraph → AI Guru Lesson → math verification → visual timeline → OpenMAIC/Hyperframes project → optional render-service MP4.

The API is `POST /api/ai-guru/e2e/export` with `{ "lesson": <AIGuruLesson> }`.

If `RENDER_SERVICE_URL` is unset, the endpoint downloads the OpenMAIC-compatible video project ZIP. If it is set, it submits the same project to OpenMAIC's existing render service, which produces MP4 using its Chromium + FFmpeg pipeline.

Run the contract check with:

```bash
pnpm e2e:ncert:video
```

For production MP4 rendering, start OpenMAIC's existing `video-export` profile and set `RENDER_SERVICE_URL`. No separate math animation server is introduced.
