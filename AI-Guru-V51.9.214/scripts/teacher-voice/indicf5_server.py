#!/usr/bin/env python3
"""
AI Guru V51.9.100 - the teacher's own voice (IndicF5, AI4Bharat) as a small local worker.

    pip install git+https://github.com/ai4bharat/IndicF5.git soundfile numpy
    python scripts/teacher-voice/indicf5_server.py            # listens on 127.0.0.1:8808

AI Guru's /api/ai-guru/teacher-voice route calls it (set AIGURU_TEACHER_VOICE_URL if you use another address).
Runs on the CPU when there is no GPU (slow: expect tens of seconds per sentence; reels are made ahead of time, so that is fine).
The model is downloaded once from Hugging Face (ai4bharat/IndicF5); after that it works offline.

POST /tts   {"text": "...", "lang": "ml", "ref_audio_b64": "<WAV>", "ref_text": "exact words of the sample"}
         -> {"ok": true, "audio_b64": "<WAV 24 kHz mono>"}
GET  /health -> {"ok": true, "model": "ai4bharat/IndicF5", "device": "cpu"}

IndicF5 speaks 11 Indian languages (Malayalam, Tamil, Hindi, ...). English is not one of them, so English steps are
refused with 422 and AI Guru uses the classroom voice for them (set TEACHER_VOICE_ALLOW_EN=1 to try anyway).
Use only the teacher's own voice, with their consent.
"""
import base64
import io
import json
import os
import sys
import tempfile
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

HOST = os.environ.get("TEACHER_VOICE_HOST", "127.0.0.1")
PORT = int(os.environ.get("TEACHER_VOICE_PORT", "8808"))
REPO = os.environ.get("TEACHER_VOICE_MODEL", "ai4bharat/IndicF5")
ALLOW_EN = os.environ.get("TEACHER_VOICE_ALLOW_EN") == "1"
RATE = 24000

_model = None
_lock = threading.Lock()  # one sentence at a time: the model is large and not thread-safe


def model():
    global _model
    if _model is None:
        from transformers import AutoModel  # imported late so /health answers while it loads

        print(f"[teacher-voice] loading {REPO} (first time downloads it) ...", flush=True)
        _model = AutoModel.from_pretrained(REPO, trust_remote_code=True)
        print("[teacher-voice] ready", flush=True)
    return _model


def device():
    try:
        import torch

        return "cuda" if torch.cuda.is_available() else "mps" if torch.backends.mps.is_available() else "cpu"
    except Exception:
        return "cpu"


def synthesize(text: str, ref_wav: bytes, ref_text: str) -> bytes:
    import numpy as np
    import soundfile as sf

    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
        f.write(ref_wav)
        ref_path = f.name
    try:
        with _lock:
            audio = model()(text, ref_audio_path=ref_path, ref_text=ref_text)
    finally:
        os.unlink(ref_path)
    audio = np.asarray(audio)
    if audio.dtype == np.int16:
        audio = audio.astype(np.float32) / 32768.0
    audio = np.clip(audio.astype(np.float32).reshape(-1), -1.0, 1.0)
    buf = io.BytesIO()
    sf.write(buf, audio, RATE, format="WAV", subtype="PCM_16")
    return buf.getvalue()


class Handler(BaseHTTPRequestHandler):
    def _send(self, code: int, body: dict):
        data = json.dumps(body).encode()
        self.send_response(code)
        self.send_header("content-type", "application/json")
        self.send_header("content-length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def log_message(self, fmt, *args):  # quieter log
        sys.stderr.write("[teacher-voice] " + (fmt % args) + "\n")

    def do_GET(self):
        if self.path == "/health":
            return self._send(200, {"ok": True, "model": REPO, "device": device(), "loaded": _model is not None})
        self._send(404, {"ok": False, "error": "not found"})

    def do_POST(self):
        if self.path != "/tts":
            return self._send(404, {"ok": False, "error": "not found"})
        try:
            n = int(self.headers.get("content-length", "0"))
            if n > 8_000_000:
                return self._send(413, {"ok": False, "error": "request too large"})
            b = json.loads(self.rfile.read(n) or b"{}")
            text = str(b.get("text", "")).strip()
            ref_text = str(b.get("ref_text", "")).strip()
            ref = base64.b64decode(str(b.get("ref_audio_b64", "")))
            if not text or not ref_text or len(ref) < 1000:
                return self._send(400, {"ok": False, "error": "text, ref_text and ref_audio_b64 are needed"})
            if b.get("lang") == "en" and not ALLOW_EN:
                return self._send(422, {"ok": False, "error": "IndicF5 does not speak English; the classroom voice is used for English steps"})
            wav = synthesize(text, ref, ref_text)
            self._send(200, {"ok": True, "audio_b64": base64.b64encode(wav).decode()})
        except Exception as e:  # report, keep serving
            self._send(500, {"ok": False, "error": f"{type(e).__name__}: {e}"[:300]})


if __name__ == "__main__":
    print(f"[teacher-voice] AI Guru teacher voice on http://{HOST}:{PORT}  (model {REPO}, device {device()})", flush=True)
    if os.environ.get("TEACHER_VOICE_PRELOAD", "1") == "1":
        threading.Thread(target=model, daemon=True).start()
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
