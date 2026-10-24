#!/usr/bin/env python3
"""bitGen Studio tests — a stand-in llama-server binary (2.584.0).

lib/core.js ensureLlama() starts `<engine dir>/llama-server -m <model> --port <p> ...` and waits for /health; this script
takes that place so a test can switch between several "models" for real (🔁 Compare LLMs asks one LLM after another,
each a fresh process). It answers /v1/chat/completions with the model's own name and the start of the last user
message, so a test can tell whose reply is whose. A model whose name contains "fail" exits at once (the app reports
"llama-server exited while loading"); one with "slow" waits 3 s before it is healthy.

Usage (as the engine): llama-server -m MODEL --port PORT [anything else is ignored]
"""
import json
import os
import sys
import time
from http.server import BaseHTTPRequestHandler, HTTPServer

args = sys.argv[1:]
model = args[args.index("-m") + 1] if "-m" in args else "model.gguf"
port = int(args[args.index("--port") + 1]) if "--port" in args else 8080
stem = os.path.basename(model)
stem = stem[:-5] if stem.lower().endswith(".gguf") else stem
if "fail" in stem:
    sys.exit(3)
if "slow" in stem:
    time.sleep(3)


class H(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def _send(self, code, obj):
        b = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(b)))
        self.end_headers()
        self.wfile.write(b)

    def do_GET(self):
        if self.path.startswith("/health"):
            self._send(200, {"status": "ok"})
        elif self.path.startswith("/v1/models"):
            self._send(200, {"object": "list", "data": [{"id": model, "object": "model"}]})
        else:
            self._send(404, {"error": "no"})

    def do_POST(self):
        n = int(self.headers.get("Content-Length") or 0)
        try:
            body = json.loads(self.rfile.read(n) or b"{}")
        except Exception:
            body = {}
        users = [m.get("content", "") for m in body.get("messages", []) if m.get("role") == "user"]
        last = str(users[-1] if users else "")[-80:].replace("\n", " ")
        text = "[%s] my answer to: %s" % (stem, last)
        self._send(200, {"choices": [{"message": {"role": "assistant", "content": text}}]})


HTTPServer(("127.0.0.1", port), H).serve_forever()
