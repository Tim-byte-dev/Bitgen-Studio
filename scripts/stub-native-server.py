"""bitGen Studio — e2e stand-in for scripts/native/server.py (2.352.0).

The e2e gate has no torch / diffusers / GPU. A fake venv's "python" runs this
instead of the real server: same port, same routes (/health, /run, /cancel,
/unload, /shutdown), same NDJSON lines, same outputs (raw RGB24 frames of the
asked size + f32 stereo audio), so the whole app flow - the route, the job,
worker.py / viggle_native_worker.py, native_client, the master, the joins -
runs for real around it.

    python stub-native-server.py [-u] <scripts/native/server.py> --port N ...
A job whose seed is 666 fails like a NaN render; "prompt" containing
"STUB-OOM" fails like an out-of-memory. Every /run body is appended to
<log dir>/stub-native-jobs.jsonl for the e2e to read back.
"""
import json
import math
import os
import struct
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

ARGS = {"port": 8199}
LOADED = []
BUSY = [False]
LOG = [None]


def parse(argv):
    a = [x for x in argv[1:] if x != "-u"]
    for i, x in enumerate(a):
        if x == "--port":
            ARGS["port"] = int(a[i + 1])
    LOG[0] = os.path.join(os.environ.get("STUB_NATIVE_LOG_DIR") or os.getcwd(), "stub-native-jobs.jsonl")


def frames(w, h, n):
    out = bytearray()
    for i in range(n):
        for y in range(h):
            for x in range(w):
                out += bytes(((x * 7 + i * 3) % 256, (y * 5 + i) % 256, 128))
    return bytes(out)


class H(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.0"

    def log_message(self, *a):
        pass

    def _j(self, code, obj):
        b = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(b)))
        self.end_headers()
        self.wfile.write(b)

    def do_GET(self):
        if self.path == "/health":
            return self._j(200, {"ok": True, "busy": BUSY[0], "device": "stub", "version": "stub", "pid": os.getpid(),
                                 "loaded": [{"what": w, "source": "stub", "gb": 1.0} for w in LOADED]})
        self._j(404, {})

    def do_POST(self):
        n = int(self.headers.get("Content-Length") or 0)
        body = json.loads(self.rfile.read(n) or b"{}") if n else {}
        if self.path == "/shutdown":
            self._j(200, {"ok": True})
            threading.Thread(target=lambda: (time.sleep(0.2), os._exit(0)), daemon=True).start()
            return
        if self.path in ("/unload", "/cancel"):
            if self.path == "/unload":
                LOADED.clear()
            return self._j(200, {"ok": True})
        if self.path != "/run":
            return self._j(404, {})
        if BUSY[0]:
            return self._j(409, {"error": "the native engine is busy with another job"})
        BUSY[0] = True
        try:
            with open(LOG[0], "a", encoding="utf-8") as f:
                f.write(json.dumps(body) + "\n")
            self.send_response(200)
            self.send_header("Content-Type", "application/x-ndjson")
            self.end_headers()

            def line(o):
                self.wfile.write((json.dumps(o) + "\n").encode())
                self.wfile.flush()
            task = body.get("task")
            wf = body.get("workflow")
            part = "transformer_ref" if wf == "ref2va" else "transformer"
            line({"log": f"stub engine: {task} {wf} {body.get('num_frames')}f {body.get('width')}x{body.get('height')} "
                         f"steps {body.get('steps')} seed {body.get('seed')}"})
            src = (body.get("sources") or {}).get(part) or {}
            line({"log": "reading " + str(src.get("comfy") or src.get("official") or "?") + (" (ComfyUI file)" if "comfy" in src else " (the official weights)")})
            for lo in body.get("loras") or []:
                line({"log": f"LoRA {os.path.basename(str(lo.get('path')))} @ {lo.get('weight')} merged into 480 weights"})
            if int(body.get("seed") or 0) == 666:
                line({"ok": False, "error": "the model produced NaN / inf pixels (100%) - the render would be black"})
                return
            if "STUB-OOM" in str(body.get("prompt") or ""):
                line({"ok": False, "error": "the GPU ran out of memory - the swap dialog's ⚙: a smaller size / a shorter segment"})
                return
            nf, w, h = int(body["num_frames"]), int(body["width"]), int(body["height"])
            if nf % 17 != 5 or nf < 124 or nf > 345:
                line({"ok": False, "error": f"num_frames {nf} is not 17n+5 in 124..345"})
                return
            if part not in LOADED:
                LOADED.append(part)
            with open(body["out_frames"], "wb") as f:
                f.write(frames(w, h, nf))
            meta = {"frames": nf, "height": h, "width": w, "sr": 0, "channels": 0}
            if body.get("out_audio"):
                sr = 32000
                k = int(nf / 24 * sr)
                with open(body["out_audio"], "wb") as f:
                    for i in range(k):
                        v = 0.2 * math.sin(2 * math.pi * 440 * i / sr)
                        f.write(struct.pack("<ff", v, v))
                meta.update(sr=sr, channels=2)
            line({"log": f"rendered {nf} frames {w}x{h} in 0s"})
            line({"ok": True, "meta": meta})
        finally:
            BUSY[0] = False


def check_mode(argv):
    """--check <check.py> <base> <json spec>: every file is 'readable' (the stub reads nothing) - except a
    name holding "unreadable" (2.353.0: the after-install follow-up download is tested with one)."""
    spec = json.loads(argv[-1])
    out = {}
    for k, v in spec.items():
        name = os.path.basename(str(v.get("comfy") or v.get("official")))
        out[k] = ({"ok": False, "why": "stub check: the engine cannot read " + name, "gb": 0} if "unreadable" in name
                  else {"ok": True, "why": "stub check: " + name, "gb": 1.0})
    print(json.dumps(out), flush=True)


if __name__ == "__main__":
    if "--check" in sys.argv:
        check_mode(sys.argv)
        sys.exit(0)
    parse(sys.argv)
    print(f"[native] stub engine server on 127.0.0.1:{ARGS['port']}", flush=True)
    ThreadingHTTPServer(("127.0.0.1", ARGS["port"]), H).serve_forever()
