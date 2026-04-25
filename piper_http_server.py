#!/usr/bin/env python3
import inspect
import io
import json
import os
import threading
import traceback
import wave
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse

try:
    from piper.voice import PiperVoice
except Exception:
    from piper import PiperVoice

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

MODEL = os.getenv(
    "PIPER_MODEL",
    os.path.join(BASE_DIR, "voices", "en_US-lessac-medium.onnx"),
)
CONFIG = os.getenv("PIPER_CONFIG", MODEL + ".json")
HOST = os.getenv("PIPER_SERVER_HOST", "127.0.0.1")
PORT = int(os.getenv("PIPER_SERVER_PORT", "5001"))

LENGTH_SCALE = float(os.getenv("PIPER_LENGTH_SCALE", "1.20"))
SENTENCE_SILENCE = float(os.getenv("PIPER_SENTENCE_SILENCE", "0.05"))
SPEAKER_ID = int(os.getenv("PIPER_SPEAKER_ID", "0"))

if not os.path.exists(MODEL):
    raise SystemExit(f"Model not found: {MODEL}")

if not os.path.exists(CONFIG):
    CONFIG = None

print(f"Loading Piper model: {MODEL}")
voice = PiperVoice.load(MODEL, config_path=CONFIG)
print("Piper voice loaded and ready.")

sample_rate = None
try:
    sample_rate = int(getattr(getattr(voice, "config", None), "sample_rate", 0)) or None
except Exception:
    sample_rate = None

synth_lock = threading.Lock()
synth_sig = inspect.signature(voice.synthesize)


def synthesize_wav_bytes(text: str) -> bytes:
    text = (text or "").strip()
    if not text:
        raise ValueError("Text is required.")

    out = io.BytesIO()
    kwargs = {}
    params = synth_sig.parameters

    if "speaker_id" in params:
        kwargs["speaker_id"] = SPEAKER_ID

    if "length_scale" in params:
        kwargs["length_scale"] = LENGTH_SCALE

    if "sentence_silence" in params:
        kwargs["sentence_silence"] = SENTENCE_SILENCE
    elif "sentence_silence_seconds" in params:
        kwargs["sentence_silence_seconds"] = SENTENCE_SILENCE

    with synth_lock:
        with wave.open(out, "wb") as wav_file:
            voice.synthesize(text, wav_file, **kwargs)

    return out.getvalue()


class Handler(BaseHTTPRequestHandler):
    server_version = "PiperHTTP/1.0"

    def log_message(self, fmt, *args):
        print("%s - - [%s] %s" % (self.address_string(), self.log_date_time_string(), fmt % args))

    def _send_json(self, status_code, payload):
        data = json.dumps(payload).encode("utf-8")
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        path = urlparse(self.path).path

        if path == "/health":
            self._send_json(200, {
                "ok": True,
                "model": MODEL,
                "config": CONFIG,
                "sample_rate": sample_rate,
                "length_scale": LENGTH_SCALE,
                "sentence_silence": SENTENCE_SILENCE,
            })
            return

        self._send_json(404, {"ok": False, "error": "Not found"})

    def do_POST(self):
        path = urlparse(self.path).path

        if path != "/tts":
            self._send_json(404, {"ok": False, "error": "Not found"})
            return

        length = int(self.headers.get("Content-Length", "0"))
        raw = self.rfile.read(length) if length > 0 else b""
        content_type = (self.headers.get("Content-Type") or "").lower()

        if "application/json" in content_type:
            try:
                payload = json.loads(raw.decode("utf-8"))
                text = (payload.get("text") or "").strip()
            except Exception as exc:
                traceback.print_exc()
                self._send_json(500, {"ok": False, "error": str(exc)})
                return
        else:
            text = raw.decode("utf-8").strip()

        if not text:
            self._send_json(400, {"ok": False, "error": "Text is required"})
            return

        try:
            wav_bytes = synthesize_wav_bytes(text)
        except Exception as exc:
            traceback.print_exc()
            self._send_json(500, {"ok": False, "error": str(exc)})
            return

        self.send_response(200)
        self.send_header("Content-Type", "audio/wav")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(wav_bytes)))
        self.end_headers()
        self.wfile.write(wav_bytes)


if __name__ == "__main__":
    httpd = ThreadingHTTPServer((HOST, PORT), Handler)
    print(f"Piper HTTP server listening on http://{HOST}:{PORT}")
    httpd.serve_forever()