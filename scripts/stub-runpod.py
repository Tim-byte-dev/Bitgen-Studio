#!/usr/bin/env python3
"""bitGen Studio e2e — stub RunPod serverless ComfyUI endpoint (2.197.0).

Speaks exactly the worker-comfyui protocol the real thing does
(docs.runpod.io/tutorials/serverless/comfyui):
  POST /v2/<endpoint>/run     -> {"id", "status": "IN_QUEUE"}   (Bearer checked)
  GET  /v2/<endpoint>/status/<id>
        poll 1 -> IN_PROGRESS
        poll 2 -> COMPLETED with output.images = one real testsrc mp4 as
                  base64, filename derived from the graph's SegmentSave /
                  VideoCombine filename_prefix so the worker's prefix->node
                  mapping is exercised for real.
An unfaithful stub is how bugs ship (2.190.0): auth is REQUIRED, requests
are recorded to <outdir>/rp_request_<n>.json, and a request over ~10 MB is
refused with 413 like RunPod's own cap.

Usage: stub-runpod.py <port> <outdir>
"""
import base64
import json
import os
import subprocess
import sys
import tempfile
import uuid
from http.server import BaseHTTPRequestHandler, HTTPServer

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8399
OUT = sys.argv[2] if len(sys.argv) > 2 else tempfile.mkdtemp(prefix="stub-rp-")
os.makedirs(OUT, exist_ok=True)
JOBS = {}          # id -> {"polls": n, "prefix": str}
NREQ = [0]


def _mp4():
    p = os.path.join(OUT, "canned.mp4")
    if not os.path.exists(p):
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error",
                        "-f", "lavfi", "-i", "testsrc2=size=192x108:rate=24",
                        "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=48000",
                        "-t", "1", "-c:v", "libx264", "-pix_fmt", "yuv420p",
                        "-c:a", "aac", p], check=True)
    return open(p, "rb").read()


class H(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def _json(self, code, obj):
        data = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _auth(self):
        a = self.headers.get("Authorization") or ""
        if not a.startswith("Bearer ") or not a[7:].strip():
            self._json(401, {"error": "unauthorized"})
            return False
        return True

    def do_POST(self):
        if not self._auth():
            return
        if not self.path.rstrip("/").endswith("/run"):
            return self._json(404, {"error": "not found"})
        n = int(self.headers.get("Content-Length") or 0)
        if n > 10_000_000:
            return self._json(413, {"error": "payload too large"})
        body = json.loads(self.rfile.read(n) or b"{}")
        NREQ[0] += 1
        with open(os.path.join(OUT, f"rp_request_{NREQ[0]}.json"), "w") as f:
            json.dump(body, f)
        g = ((body.get("input") or {}).get("workflow")) or {}
        prefix = "runpod_take"
        for nd in g.values():
            c = str((nd or {}).get("class_type", "")).lower()
            if "segmentsave" in c or "videocombine" in c or "savevideo" in c:
                px = str(((nd or {}).get("inputs") or {}).get("filename_prefix") or "")
                if px:
                    prefix = os.path.basename(px)
                    break
        jid = uuid.uuid4().hex
        JOBS[jid] = {"polls": 0, "prefix": prefix}
        self._json(200, {"id": jid, "status": "IN_QUEUE"})

    def do_GET(self):
        if not self._auth():
            return
        parts = self.path.rstrip("/").split("/")
        if len(parts) < 2 or parts[-2] != "status":
            return self._json(404, {"error": "not found"})
        j = JOBS.get(parts[-1])
        if not j:
            return self._json(404, {"error": "no such job"})
        j["polls"] += 1
        if j["polls"] < 2:
            return self._json(200, {"id": parts[-1], "status": "IN_PROGRESS"})
        data = base64.b64encode(_mp4()).decode()
        self._json(200, {"id": parts[-1], "status": "COMPLETED",
                         "delayTime": 111, "executionTime": 999,
                         "output": {"images": [
                             {"filename": j["prefix"] + "_00001.mp4",
                              "type": "base64", "data": data}]}})


if __name__ == "__main__":
    HTTPServer(("127.0.0.1", PORT), H).serve_forever()
