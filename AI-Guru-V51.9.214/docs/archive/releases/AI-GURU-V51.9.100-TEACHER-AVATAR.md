# AI Guru V51.9.100 — Teacher avatar with lip-sync

The teacher's own face in a small corner bubble on reels, lips moving with the voice. Optional, and off until someone switches it on.

## For the teacher
1. **Teacher Portal → My avatar** → class code + teacher key.
2. **Photo:** face the camera, good light, mouth closed. Then **👄 Mark mouth & eyes**: red oval on the lips, blue circles on the eyes.
3. **Face style:**
   - **Lips move on my photo** (recommended): works on any computer, no GPU.
   - **Photo only:** the ring glows while the voice speaks.
   - **AI lip-sync from a short video:** needs the GPU worker (below). Record about 8 s of your face: look at the camera, head still, talking normally, no cuts.
4. **Voice (optional):** read the sentence shown and keep the exact words in the box. Reels can then speak in your voice (needs the voice worker).
5. Tick **consent** (your own face and voice only). Tick **"My students may put my face…"** only if students should be able to use it.

## For students: only on their own phone, only with their own key
Avatars must never cause a surprise API or GPU cost for the company, so students never use the AI Guru PC's teacher voice or AI lip-sync. The server refuses students on both routes, even when the teacher shares their avatar.
- **Teacher's face:** Reel Studio → *Face in the corner* → *[Teacher]'s face*. This shows only when their own class teacher shared it. Students get the face only, with the free lip-sync drawn on the phone; the voice is the normal reel voice.
- **My avatar (the student's own):** Reel Studio → *Make my avatar*. It needs:
  1. their photo, with the parent/guardian agreement and "show my photo on reels" both on;
  2. their own Gemini key (Settings → Your keys);
  3. their tick on "use my own Gemini key for my avatar's voice — Google bills my key, not AI Guru".

  The lips are drawn on the phone for free. The voice is Gemini text-to-speech called from the phone with the student's key (6 voices to choose from). The avatar is kept on the phone only; nothing is uploaded.
  - If the key or the tick is missing, the avatar is paused and the reason is shown.
  - If the key fails for a step, that step uses the free classroom voice.

## Workers on the AI Guru PC (optional)
Neither worker is needed for the built-in lip-sync. If a worker is off, the reel quietly uses the classroom voice or the photo lip-sync, and Reel Studio says why.

### Teacher voice: IndicF5 (CPU is fine)
```bash
pip install git+https://github.com/ai4bharat/IndicF5.git soundfile numpy
python scripts/teacher-voice/indicf5_server.py        # http://127.0.0.1:8808
```
- The first run downloads `ai4bharat/IndicF5` from Hugging Face. After that it works offline.
- On a CPU it is slow (tens of seconds per sentence), but reels are made ahead of time, so that is fine.
- **English is not one of IndicF5's languages.** English steps therefore use the classroom voice. `TEACHER_VOICE_ALLOW_EN=1` tries anyway.
- Set `AIGURU_TEACHER_VOICE_URL` if the worker runs elsewhere.

### AI lip-sync: LatentSync (NVIDIA GPU: about 8 GB for 1.5, about 18 GB for 1.6)
```bash
git clone https://github.com/bytedance/LatentSync && cd LatentSync && source setup_env.sh
pip install mediapipe
export LATENTSYNC_DIR=/path/to/LatentSync              # Windows: set LATENTSYNC_DIR=C:\path\to\LatentSync
python scripts/avatar-lipsync/latentsync_worker.py     # http://127.0.0.1:8809
```
- **Licence:** LatentSync's code is Apache 2.0, but it finds faces with **InsightFace, whose ready-made models are non-commercial**. Because of that, the worker swaps in **MediaPipe Face Mesh** (Apache 2.0) by default (`run_latentsync.py`). It gives LatentSync the same three points it uses: the two eyebrow centres and the nose centre.
  - **Test this on a clip before relying on it.** It was not run on a GPU here.
  - `LIPSYNC_FACE_DETECTOR=insightface` uses the original, but only where its licence allows that.
  - Check the licence of the LatentSync model weights on Hugging Face too.
- `LIPSYNC_SYNC_CHECK=1` scores each result with LatentSync's SyncNet. Under 3 → the reel uses the photo lip-sync. This needs their `checkpoints/auxiliary/syncnet_v2.model`.
- Settings: `LIPSYNC_UNET_CONFIG` (default `configs/unet/stage2_512.yaml`, version 1.6), `LIPSYNC_CKPT`, `LIPSYNC_GUIDANCE` (1.5). For version 1.5 on an 8 GB card, use its own config and checkpoint.
- Set `AIGURU_LIPSYNC_URL` if the worker runs elsewhere.

## How the built-in lip-sync works
- **One clock for voice and lips.** Each voice clip is placed on the reel timeline exactly where the soundtrack mix puts it. Every frame then reads its own slice of sound:
  - loudness → how far the jaw opens, the ring glow, and a small nod;
  - zero crossings → "ee"/"s" (a wider mouth);
  - low-band energy → "oo" (a rounder mouth).
- The jaw opens fast and closes a little slower, and the mouth stays shut in pauses.
- **Drawing the mouth:** a dark mouth opening (with teeth on open vowels) is drawn at the lips. The face below the lips is then drawn again, lower by the jaw drop, through a feathered mask so no seam shows.
- **Blinks** are deterministic, so they are the same in the preview and the MP4.
- The preview and the MP4 use the same drawing function and the same clock.

## Files
`lib/ai-guru/teacher/avatar*.ts`, `lib/ai-guru/reels/motion/lipsync.ts`, `lib/ai-guru/reels/motion/avatar-draw.ts`, `app/api/ai-guru/teacher-avatar/**`, `app/api/ai-guru/teacher-voice`, `app/api/ai-guru/student-portal/teacher-avatar`, `app/ai-guru/teacher/avatar`, `components/ai-guru/teacher/AvatarSetup.tsx`, `scripts/teacher-voice/`, `scripts/avatar-lipsync/`.
Data: `data/ai-guru/teacher/avatars/<teacher number>/` (meta.json, photo, voice.wav, face.mp4).
