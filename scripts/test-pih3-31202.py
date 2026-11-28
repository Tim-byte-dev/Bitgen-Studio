#!/usr/bin/env python3
"""bitGen Studio — 3.12.2: scripts/pih3.py info() asks ComfyUI for each node with its class name URL-encoded. "Load LakonLab
Adapter" has spaces; urllib refused the unencoded URL before sending it, the error read as "not loaded", and every pi-H3 render
stopped with "this ComfyUI has not loaded the node ... (Load LakonLab Adapter)" (3.11.2) / "loaded an OLD ComfyUI-piFlow"
(3.12.1) - while Tim's ComfyUI log shows ComfyUI-piFlow imported fine. Checked against a real HTTP server here."""
import json
import sys
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlparse

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
import pih3                    # noqa: E402
import comfy_missing as cm     # noqa: E402

passed = failed = 0


def check(name, ok, got=None):
    global passed, failed
    if ok:
        passed += 1
        print("PASS: " + name)
    else:
        failed += 1
        print("FAIL: " + name + ("" if got is None else "\n      got " + str(got)[:600]))


HAVE = {"Load LakonLab Adapter": {"input": {"required": {"adapter_name": [["pi_h3_4step_dwd_adapter_int8_convrot.safetensors"], {}]}}},
        "pi-Flow Scheduler": {"name": "s"}, "DWD Decode": {"name": "d"}, "Load pi-Flow Model": {"name": "l"}, "pi-Flow Sampler": {"name": "p"}, "ModelSamplingPiFlow": {"name": "m"}}
asked = []


class H(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def do_GET(self):
        u = urlparse(self.path)
        if u.path == "/system_stats":
            body = {"system": {"comfyui_version": "0.46.0"}, "devices": [{"name": "cuda:0 NVIDIA GeForce RTX 5090"}]}
        elif u.path.startswith("/object_info/"):
            asked.append(u.path)
            c = unquote(u.path[len("/object_info/"):])
            body = {c: HAVE[c]} if c in HAVE else {}
        else:
            body = {}
        b = json.dumps(body).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(b)))
        self.end_headers()
        self.wfile.write(b)


srv = ThreadingHTTPServer(("127.0.0.1", 0), H)
threading.Thread(target=srv.serve_forever, daemon=True).start()
base = f"http://127.0.0.1:{srv.server_address[1]}"
inf = pih3.info(base)
srv.shutdown()
check("info: the nodes with spaces in their names are found (Load LakonLab Adapter, pi-Flow Scheduler, DWD Decode)",
      all(c in inf["classes"] for c in pih3.PACK_NODES) and inf["reached"] and inf["version"] == "0.46.0", inf)
check("…asked for with the name URL-encoded", "/object_info/Load%20LakonLab%20Adapter" in asked, asked)
wf = json.loads((ROOT / "comfy_workflows" / "pi_h3_dwd_4step.json").read_text(encoding="utf-8"))
check("the shipped 4-step graph: nothing missing on a ComfyUI that has ComfyUI-piFlow 1.4+ (the render goes on)", pih3.missing(wf, inf) == [], pih3.missing(wf, inf))
check("…and no 'OLD ComfyUI-piFlow' words", cm.piflow_report({"engine": {"comfy": {"dir": "/no/such"}}}, ROOT, inf, None) == "")
g, notes = pih3.apply(json.loads(json.dumps(wf)), inf)
check("…the adapter list is read too (the int8 / bf16 swap can see what you have)", any(isinstance(v, dict) and v.get("class_type") == pih3.ADAPTER for v in g.values()), notes)
pk = (ROOT / "scripts" / "plato_keys_apply.py").read_text(encoding="utf-8")
check("plato_keys_apply asks with the class name encoded too", "urllib.parse.quote(str(cls), safe='')" in pk)
print(f"\n{passed} passed, {failed} failed")
print(f"RESULT: {failed} failed")
sys.exit(1 if failed else 0)
