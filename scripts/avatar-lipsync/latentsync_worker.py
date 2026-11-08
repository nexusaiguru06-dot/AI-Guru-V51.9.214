#!/usr/bin/env python3
"""
AI Guru V51.9.100 - AI lip-sync of the teacher's face video (ByteDance LatentSync) as a small local worker.

Needs a PC with an NVIDIA GPU: LatentSync 1.5 needs about 8 GB of GPU memory, 1.6 about 18 GB.

    git clone https://github.com/bytedance/LatentSync && cd LatentSync && source setup_env.sh   # their setup
    pip install mediapipe                                                                         # face finding (see below)
    set LATENTSYNC_DIR=C:\\path\\to\\LatentSync          (Windows)   /   export LATENTSYNC_DIR=/path/to/LatentSync
    python scripts/avatar-lipsync/latentsync_worker.py   # listens on 127.0.0.1:8809

AI Guru's /api/ai-guru/teacher-avatar/lipsync route calls it (AIGURU_LIPSYNC_URL for another address).

POST /lipsync {"video_b64": "<teacher's 5-10 s face video>", "video_type": "mp4", "audio_b64": "<WAV voice track>", "steps": 20}
           -> {"ok": true, "video_b64": "<MP4>", "sync_confidence": 7.1 | null}
GET  /health -> {"ok": true, "latentsync_dir": "...", "face_detector": "mediapipe"}

LatentSync itself loops the short face video forward-and-back to the voice's length, and re-draws only the mouth area.

Face finding and the licence: LatentSync finds the face with InsightFace, whose ready-made models are for
NON-COMMERCIAL research only. AI Guru is a paid product, so this worker replaces that step with MediaPipe Face Mesh
(Apache 2.0) by default: it gives LatentSync the same three points it uses (the two eyebrow centres and the nose centre).
Check the result on a test clip first. LIPSYNC_FACE_DETECTOR=insightface uses the original (only where its licence allows).

Sync check (optional, LIPSYNC_SYNC_CHECK=1): LatentSync's own SyncNet score of the result (their data pipeline drops
clips under 3). AI Guru then falls back to the photo lip-sync for a low score.
"""
import base64
import json
import os
import re
import subprocess
import sys
import tempfile
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

HOST = os.environ.get("LIPSYNC_HOST", "127.0.0.1")
PORT = int(os.environ.get("LIPSYNC_PORT", "8809"))
LS_DIR = os.environ.get("LATENTSYNC_DIR", "")
DETECTOR = os.environ.get("LIPSYNC_FACE_DETECTOR", "mediapipe")
UNET_CONFIG = os.environ.get("LIPSYNC_UNET_CONFIG", "configs/unet/stage2_512.yaml")
CKPT = os.environ.get("LIPSYNC_CKPT", "checkpoints/latentsync_unet.pt")
GUIDANCE = os.environ.get("LIPSYNC_GUIDANCE", "1.5")
SYNC_CHECK = os.environ.get("LIPSYNC_SYNC_CHECK") == "1"
HERE = os.path.dirname(os.path.abspath(__file__))
_lock = threading.Lock()  # one job at a time on the GPU


def run_job(video: bytes, video_type: str, audio: bytes, steps: int) -> dict:
    with tempfile.TemporaryDirectory() as tmp:
        vin = os.path.join(tmp, f"face.{ 'webm' if video_type == 'webm' else 'mp4' }")
        ain = os.path.join(tmp, "voice.wav")
        out = os.path.join(tmp, "out.mp4")
        with open(vin, "wb") as f:
            f.write(video)
        with open(ain, "wb") as f:
            f.write(audio)
        if video_type == "webm":  # LatentSync reads MP4 at 25 fps; convert once
            mp4 = os.path.join(tmp, "face.mp4")
            subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", vin, "-r", "25", "-an", mp4], check=True)
            vin = mp4
        cmd = [
            sys.executable, os.path.join(HERE, "run_latentsync.py"),
            "--detector", DETECTOR,
            "--",
            "--unet_config_path", UNET_CONFIG,
            "--inference_ckpt_path", CKPT,
            "--inference_steps", str(max(8, min(50, steps))),
            "--guidance_scale", GUIDANCE,
            "--enable_deepcache",
            "--video_path", vin,
            "--audio_path", ain,
            "--video_out_path", out,
            "--temp_dir", os.path.join(tmp, "temp"),
        ]
        with _lock:
            p = subprocess.run(cmd, cwd=LS_DIR, capture_output=True, text=True)
        if p.returncode != 0 or not os.path.exists(out):
            tail = (p.stderr or p.stdout or "")[-400:]
            raise RuntimeError("LatentSync failed: " + tail.replace("\n", " "))
        conf = None
        if SYNC_CHECK:
            q = subprocess.run([sys.executable, "-m", "eval.eval_sync_conf", "--video_path", out, "--temp_dir", os.path.join(tmp, "sync")], cwd=LS_DIR, capture_output=True, text=True)
            m = re.search(r"SyncNet confidence:\s*([0-9.]+)", (q.stdout or "") + (q.stderr or ""))
            conf = float(m.group(1)) if m else None
        with open(out, "rb") as f:
            return {"ok": True, "video_b64": base64.b64encode(f.read()).decode(), "sync_confidence": conf}


class Handler(BaseHTTPRequestHandler):
    def _send(self, code: int, body: dict):
        data = json.dumps(body).encode()
        self.send_response(code)
        self.send_header("content-type", "application/json")
        self.send_header("content-length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def log_message(self, fmt, *args):
        sys.stderr.write("[lipsync] " + (fmt % args) + "\n")

    def do_GET(self):
        if self.path == "/health":
            return self._send(200, {"ok": bool(LS_DIR and os.path.isdir(LS_DIR)), "latentsync_dir": LS_DIR, "face_detector": DETECTOR, "sync_check": SYNC_CHECK})
        self._send(404, {"ok": False, "error": "not found"})

    def do_POST(self):
        if self.path != "/lipsync":
            return self._send(404, {"ok": False, "error": "not found"})
        if not LS_DIR or not os.path.isdir(LS_DIR):
            return self._send(503, {"ok": False, "error": "LATENTSYNC_DIR is not set to a LatentSync folder"})
        try:
            n = int(self.headers.get("content-length", "0"))
            if n > 80_000_000:
                return self._send(413, {"ok": False, "error": "request too large"})
            b = json.loads(self.rfile.read(n) or b"{}")
            video = base64.b64decode(str(b.get("video_b64", "")))
            audio = base64.b64decode(str(b.get("audio_b64", "")))
            if len(video) < 1000 or len(audio) < 1000:
                return self._send(400, {"ok": False, "error": "video_b64 and audio_b64 are needed"})
            self._send(200, run_job(video, str(b.get("video_type", "mp4")), audio, int(b.get("steps", 20))))
        except Exception as e:
            self._send(500, {"ok": False, "error": f"{type(e).__name__}: {e}"[:400]})


if __name__ == "__main__":
    print(f"[lipsync] AI Guru lip-sync worker on http://{HOST}:{PORT}  LatentSync: {LS_DIR or '(LATENTSYNC_DIR not set)'}  face: {DETECTOR}", flush=True)
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
