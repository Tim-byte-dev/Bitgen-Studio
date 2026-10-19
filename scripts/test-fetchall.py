#!/usr/bin/env python3
"""bitGen Studio — 2.308.0: the lossless master's frame download.
Tim: "the queued scene doesn't stop running ... even when the comfyui job is
completed". The frames now come down in parallel, each with a timeout, the
whole step inside a budget - LIVE against a local HTTP server:
  1. 40 frames arrive, byte-exact, faster than one-by-one would;
  2. a server that stalls trips the budget (RuntimeError, said by the caller:
     the take stays mp4-only) instead of holding the job;
  3. a missing file raises (the caller keeps the take mp4-only).
Run from repo root: python3 scripts/test-fetchall.py"""
import sys, threading, time, tempfile
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlparse, parse_qs

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import worker  # noqa: E402

FAILED = []


def check(name, cond, extra=""):
    print(("PASS: " if cond else "FAIL: ") + name + ("" if cond else f" {extra}"))
    if not cond:
        FAILED.append(name)


class H(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def do_GET(self):
        q = parse_qs(urlparse(self.path).query)
        name = q.get("filename", [""])[0]
        if name.startswith("slow"):
            time.sleep(5)
        if name.startswith("missing"):
            self.send_response(404); self.end_headers(); return
        time.sleep(0.05)                       # a real /view takes a moment
        body = (name * 50).encode()
        self.send_response(200); self.send_header("Content-Length", str(len(body)))
        self.end_headers(); self.wfile.write(body)


srv = ThreadingHTTPServer(("127.0.0.1", 0), H)
threading.Thread(target=srv.serve_forever, daemon=True).start()
base = f"http://127.0.0.1:{srv.server_address[1]}"
tmp = Path(tempfile.mkdtemp())

jobs = [({"filename": f"f{i:03d}.png", "type": "temp"}, tmp / f"{i:06d}.png") for i in range(40)]
t0 = time.time()
worker._fetch_all(base, jobs, budget=30)
el = time.time() - t0
check("40 frames arrive byte-exact", all(d.read_bytes() == (it["filename"] * 50).encode() for it, d in jobs))
check("...in parallel (well under the 2 s one-by-one would take)", el < 1.5, el)

slow = [({"filename": f"slow{i}.png", "type": "temp"}, tmp / f"s{i}.png") for i in range(4)]
t0 = time.time()
try:
    worker._fetch_all(base, slow, budget=1)
    r = "no error"
except RuntimeError as e:
    r = str(e)
check("a stalled server trips the budget (the caller keeps the take mp4-only) instead of holding the job",
      "budget" in r and time.time() - t0 < 4, (r, time.time() - t0))

try:
    worker._fetch_all(base, [({"filename": "missing.png", "type": "temp"}, tmp / "m.png")], budget=10)
    r = "no error"
except Exception as e:                        # noqa: BLE001
    r = type(e).__name__
check("a missing frame raises (the caller keeps the take mp4-only)", r != "no error", r)

srv.shutdown()
print(f"\nRESULT: {len(FAILED)} failed")
sys.exit(1 if FAILED else 0)
