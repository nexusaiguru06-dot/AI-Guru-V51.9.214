# AI Guru V51.9.18: reel voice-over + captions (English / Malayalam)

No new npm packages.

## What changed
| Area | File | Change |
|---|---|---|
| Spoken script | `lib/ai-guru/reels/motion/speech.ts` (new) | Captions → speakable text. Maths symbols, powers, fractions, roots, brackets, %, °, π, sin/cos/tan read as words; Malayalam uses Kerala classroom terms (പ്ലസ്, മൈനസ്, ഗുണം, ഹരണം, സമം, സ്ക്വയർ, ബൈ) and joins case endings (x-നെ → എക്സിനെ). |
| Timing | `engine.ts`, `reel.ts` | `VoicePlan` / `buildReel(req, { voiceMs, subtitleFrom })`. A step waits for the previous clip; captions cover their clip. `voiceScript()`, `reelVoiceCues()`. |
| Voices | `voice.ts` (new) | Fetches each step's clip from `/api/ai-guru/tts` using `ttsProviderOrder` + `edgeVoiceFor` (Settings → Local TTS applies). Decodes to 48 kHz, trims, normalises, caches; 3 requests at a time. |
| Audio | `audio.ts` (new), `sfx.ts` | `mixReelAudio`: music and effects duck under the voice; voice clips placed on their cues; soft limiter. |
| Captions | `draw.ts`, `subtitles.ts` (new) | Karaoke word highlight + speaking indicator; optional second-language line; `.srt` / `.vtt` export. |
| Malayalam content | `recipes/branches.ts` | Malayalam captions for all 12 topic examples (percentage, exponents, calculus, circle area, mean, probability, trigonometry added) and Malayalam side notes. |
| MP4 | `export.ts` | `voices` option: the voice-over goes into the MP4 audio track. |
| UI | `MotionReelStudio.tsx` | Voice + captions language (English / മലയാളം), "🔊 Explain each step" or music only, "+ second language line", voice status, CC .srt / .vtt buttons. |

## Verified
- 30 tests pass (`motion.test.ts`): speech in both languages, no English left in any Malayalam voice script, steps wait for clips without overlap, captions cover clips, second line + SRT, voice mixed at its cue.
- Real Chromium, full browser path: clips fetched through the TTS route, decoded, timed and exported into the MP4. Voice energy lines up with every cue. The test server stood in for `/api/ai-guru/tts` with local Piper, because Edge is blocked from the build sandbox.
- TypeScript strict: new files clean.

## Notes
- Sample videos were voiced with Piper (`ml_IN-meera-medium`, `en_US-lessac-medium`) because Microsoft Edge TTS is not reachable from the build machine. In the app, Edge `ml-IN-SobhanaNeural` / `en-IN-NeerjaNeural` are used first.
- Voiced chapter intros can run past 60 s (the Pair of Linear Equations intro + example is ~67 s). Instagram Reels and YouTube Shorts accept that; use a topic example for a shorter reel.
- The Malayalam maths wording in `speech.ts` and the captions should be reviewed by a Malayalam maths teacher.
