"""bitGen Studio — the native engine server (2.352.0). Runs INSIDE venvs/native, on 127.0.0.1 only.

One process keeps the loaded models between jobs (Wan2GP's "the model stays
loaded"): the first render of a session reads the weights, the next ones
start at once. The app's workers talk to it through scripts/native_client.py.

    python server.py --port 8199 [--ram-budget-gb N] [--pack int8|bf16] [--pin 1]
                     [--idle-unload 20] [--idle-exit 120] [--device auto]

  GET  /health    {ok, busy, device, loaded[], version}
  POST /run       {task: "h3" | "viggle" | "check", ...job} -> NDJSON lines
                  {"log": "..."} ... then {"ok": true, "meta": {...}} or
                  {"ok": false, "error": "..."}; one job at a time (409 busy)
  POST /cancel    stop the running job at the next block
  POST /unload    drop every loaded model (RAM + VRAM back)
  POST /shutdown  exit
"""
import argparse
import json
import os
import sys
import threading
import time
import traceback
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
VERSION = "2.352.0"

ARGS = None
ENGINE = None
LOCK = threading.Lock()
STATE = {"busy": False, "last": time.time(), "unloaded": True}


def engine():
    global ENGINE
    if ENGINE is None:
        import h3_engine as H
        ENGINE = H.Engine(device=None if ARGS.device == "auto" else ARGS.device, ram_budget_gb=ARGS.ram_budget_gb,
                          pack_mode=ARGS.pack, pin=bool(ARGS.pin))
    return ENGINE


def run_job(body, say):
    import h3_engine as H
    import wstream as W
    task = body.get("task")
    eng = engine()
    eng.say = say
    W.CANCEL.clear()
    if task == "check":
        out = {k: H.check_source(k, v, body["base"]) for k, v in (body.get("sources") or {}).items()}
        return {"checks": out}
    if task == "h3":
        res = eng.render(body)
    elif task == "viggle":
        import torch
        fixed = torch.load(body["embed"], map_location="cpu", weights_only=False)
        for k in ("prompt_embeds", "text_token_tags", "presentation"):
            if k not in fixed:
                raise W.Unsupported(f"{os.path.basename(body['embed'])} has no '{k}' - it is not Viggle's fixed embedding")
        res = eng.render(body, fixed=fixed)
    else:
        raise W.Unsupported(f"unknown task {task!r}")
    meta = H.write_outputs(res, body["out_frames"], body.get("out_audio"))
    return {"meta": meta}


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.0"

    def log_message(self, fmt, *args):               # quiet: the job lines are the log
        pass

    def _json(self, code, obj):
        b = json.dumps(obj).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(b)))
        self.end_headers()
        self.wfile.write(b)

    def _body(self):
        n = int(self.headers.get("Content-Length") or 0)
        return json.loads(self.rfile.read(n) or b"{}") if n else {}

    def do_GET(self):
        if self.path == "/health":
            dev = ENGINE.device.type if ENGINE else "not loaded"
            return self._json(200, {"ok": True, "busy": STATE["busy"], "device": dev, "version": VERSION, "pid": os.getpid(),
                                    "loaded": ENGINE.loaded() if ENGINE else []})
        self._json(404, {"error": "no such route"})

    def do_POST(self):
        import wstream as W
        if self.path == "/cancel":
            W.CANCEL.set()
            return self._json(200, {"ok": True})
        if self.path == "/unload":
            if STATE["busy"]:
                return self._json(409, {"error": "a job is running"})
            if ENGINE:
                ENGINE.unload()
            STATE["unloaded"] = True
            return self._json(200, {"ok": True})
        if self.path == "/shutdown":
            self._json(200, {"ok": True})
            threading.Thread(target=lambda: (time.sleep(0.3), os._exit(0)), daemon=True).start()
            return None
        if self.path != "/run":
            return self._json(404, {"error": "no such route"})
        if not LOCK.acquire(blocking=False):
            return self._json(409, {"error": "the native engine is busy with another job"})
        try:
            body = self._body()
            STATE["busy"] = True
            self.send_response(200)
            self.send_header("Content-Type", "application/x-ndjson")
            self.end_headers()

            def line(obj):
                try:
                    self.wfile.write((json.dumps(obj) + "\n").encode("utf-8"))
                    self.wfile.flush()
                except Exception:                      # noqa: BLE001  (the worker went away - keep rendering is pointless)
                    W.CANCEL.set()

            def say(m):
                line({"log": str(m)})
            try:
                out = run_job(body, say)
                STATE["unloaded"] = False
                line({"ok": True, **out})
            except W.Cancelled:
                line({"ok": False, "error": "cancelled"})
            except W.Unsupported as e:
                line({"ok": False, "error": str(e)})
            except Exception as e:                     # noqa: BLE001
                import torch
                if isinstance(e, torch.cuda.OutOfMemoryError):
                    line({"ok": False, "error": "the GPU ran out of memory - the swap dialog's ⚙: a smaller size or a "
                                                "shorter segment (close other GPU apps, ComfyUI included)"})
                else:
                    tb = traceback.format_exc().strip().splitlines()
                    line({"log": "\n".join(tb[-12:])})
                    line({"ok": False, "error": f"{type(e).__name__}: {e}"[:600]})
        finally:
            STATE["busy"] = False
            STATE["last"] = time.time()
            LOCK.release()


def idle_watch():
    while True:
        time.sleep(15)
        if STATE["busy"]:
            continue
        idle = (time.time() - STATE["last"]) / 60
        if ARGS.idle_exit and idle >= ARGS.idle_exit:
            os._exit(0)
        if ARGS.idle_unload and idle >= ARGS.idle_unload and ENGINE and not STATE["unloaded"]:
            ENGINE.unload()
            STATE["unloaded"] = True


def main():
    global ARGS
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=8199)
    ap.add_argument("--ram-budget-gb", type=float, default=0)
    ap.add_argument("--pack", default="int8", choices=["int8", "bf16"])
    ap.add_argument("--pin", type=int, default=1)
    ap.add_argument("--idle-unload", type=float, default=20)
    ap.add_argument("--idle-exit", type=float, default=120)
    ap.add_argument("--device", default="auto")
    ARGS = ap.parse_args()
    srv = ThreadingHTTPServer(("127.0.0.1", ARGS.port), Handler)
    threading.Thread(target=idle_watch, daemon=True).start()
    print(f"[native] engine server {VERSION} on 127.0.0.1:{ARGS.port} (pid {os.getpid()})", flush=True)
    srv.serve_forever()


if __name__ == "__main__":
    main()
