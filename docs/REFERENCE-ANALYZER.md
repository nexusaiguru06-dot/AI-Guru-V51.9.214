# Reference Video Analyzer (V46)

Turns one reference video into keyframes + a JSON style spec + a registry entry.

    npm run analyze:reference -- "C:\videos\linear-equation.mp4" --id linear-equation-two-step --subject Algebra
    npm run analyze:reference -- <video> --id <slug> --merge      # copy video + add/replace registry entry
    npm run audit:reference-video-library                          # must still pass

Needs ffmpeg/ffprobe on PATH and GEMINI_API_KEY (env or .env.local) for the AI step.

Options: --mode video|frames (whole video incl. narration, or keyframes only - cheaper), --frames 12, --scene 0.06,
--model, --no-ai (keyframes + skeleton), --approve (mark a skeleton approved), --dry-run, --out.

Output (public/reference-styles/analysis/<id>/): keyframes/kf-NN.jpg, contact-sheet.jpg, spec.json, registry-entry.json.
Always read spec.json before --merge: warnings are printed for bad palette hex, regions outside 0-1, or timeline events
beyond the video length. Video is uploaded to the Gemini File API and deleted after the analysis.
The spec lists `doNotCopy` items (handles, watermarks, wording) - keep them out of generated lessons.
