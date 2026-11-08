# Classroom teaching + Edge TTS + live status log

## Symptoms fixed
- Status stuck / no idea if Play is working
- Whiteboard blank, no voice
- Console: `/api/ai-guru/tts` → **502 Bad Gateway** (Edge TTS server error)

## Changes

### 1. Live **Teaching log** on top of the whiteboard
After ▶ Play you always see steps such as:
- `▶ Play pressed — preparing lesson…`
- `§1 writing source text on board…`
- `Calling edge TTS…`
- `edge TTS failed: …` (real server error text)
- `Voice OK: Edge TTS (en-IN-NeerjaNeural)`

Colors: green = ok, amber = warn, red = error. Working/speaking indicator in the header.

### 2. `lib/ai-guru/tts/providers.ts` — hardened Edge TTS
- 20s timeout, rate, non-blocking metadata stream

### 3. `components/ai-guru/AIGuruClassroom.tsx`
- Board write always runs even if TTS fails
- Edge forced as preferred; fetch + playback timeouts
- Full step logging into the on-board log strip

### 4. `app/api/ai-guru/tts/route.ts`
- Returns real `error` + `hint` in JSON body on 502
- Server `console.info` / `console.error` for debugging

## If Edge still 502s
1. Server terminal will show `[tts] FAIL provider=edge: <message>`
2. Teaching log shows that same message
3. Common causes:
   - No outbound HTTPS to Microsoft Read Aloud (`speech.platform.bing.com`)
   - `msedge-tts` not installed (`npm i msedge-tts`)
   - Corporate firewall / offline env

Fallbacks still tried: Google Cloud → Sarvam → Piper (need their env keys).
