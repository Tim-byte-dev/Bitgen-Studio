#!/usr/bin/env python3
"""bitGen Studio — 3.9.0: misc/ming_worker.py (mode "ming") end to end, with stand-ins for what is not here:
  local       a fake Ming-Image infer.py (the real one's flags and file names: image_00.png / layer_01.png ...) run by THIS Python
  OpenRouter  a fake /images endpoint on 127.0.0.1 (0.2-Design unknown -> 0.1-Design; the layer model sends the composite first)
Tim: "can u add this to image editor please. https://huggingface.co/inclusionAI/Ming-Image-0.2-Design ... it is supposed to be
able to generate separate layers. please check it" """
import base64
import json
import os
import subprocess
import sys
import tempfile
import threading
import zlib
import struct
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
WORKER = ROOT / "misc" / "ming_worker.py"
passed = failed = 0


def check(name, ok, got=None):
    global passed, failed
    if ok:
        passed += 1
        print("PASS: " + name)
    else:
        failed += 1
        print("FAIL: " + name + ("" if got is None else "\n      got " + str(got)[:600]))


def png(w, h, rgba):
    raw = b"".join(b"\x00" + bytes(rgba) * w for _ in range(h))
    def chunk(t, d):
        return struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xffffffff)
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0)) + chunk(b"IDAT", zlib.compress(raw)) + chunk(b"IEND", b"")


FAKE_INFER = r'''
import argparse, re, struct, sys, zlib, json, os
from pathlib import Path
a = argparse.ArgumentParser()
for f in ["--model", "--task", "--prompt", "--input-image", "--output-dir", "--width", "--height", "--resolution", "--seed", "--steps", "--attn-implementation", "--device-map", "--num-gpus"]:
    a.add_argument(f)
a.add_argument("--local-files-only", action="store_true")
x = a.parse_args()
def png(w, h, rgba):
    raw = b"".join(b"\x00" + bytes(rgba) * w for _ in range(h))
    def chunk(t, d): return struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xffffffff)
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0)) + chunk(b"IDAT", zlib.compress(raw)) + chunk(b"IEND", b"")
od = Path(x.output_dir); od.mkdir(parents=True, exist_ok=True)
log = Path(os.environ["MING_FAKE_LOG"]); log.open("a").write(json.dumps({"argv": sys.argv[1:], "offline": os.environ.get("HF_HUB_OFFLINE"), "cwd": os.getcwd()}) + "\n")
if os.environ.get("MING_FAKE_OOM"):
    print("torch.OutOfMemoryError: CUDA out of memory. Tried to allocate 2.00 GiB"); sys.exit(1)
if x.task == "text-to-image":
    assert x.local_files_only and x.width and x.height
    json.loads(Path(x.prompt).read_text())
    (od / "image_00.png").write_bytes(png(8, 6, (200, 30, 30, 255)))
else:
    n = int(re.search(r"Number of layers: (\d+)", Path(x.prompt).read_text()).group(1))
    for i in range(1, n + 1):
        (od / f"layer_{i:02d}.png").write_bytes(png(8, 6, (i * 40, 0, 0, 128)))
print("done")
'''


def run_worker(job, cwd, env=None):
    jf = Path(cwd) / "job.json"
    jf.write_text(json.dumps(job), encoding="utf-8")
    r = subprocess.run([sys.executable, str(WORKER), str(jf)], cwd=cwd, capture_output=True, text=True, env=dict(os.environ, **(env or {})), timeout=120)
    return r.returncode, r.stdout + r.stderr


rows = [{"name": "Title", "desc": "the words \"SALE\"", "where": "top"}, {"name": "Shoe", "desc": "a red shoe", "where": "centre"}, {"name": "Background", "desc": "a beach", "where": "all"}]

with tempfile.TemporaryDirectory() as t:
    t = Path(t)
    src = t / "Ming-Image"
    src.mkdir()
    (src / "infer.py").write_text(FAKE_INFER, encoding="utf-8")
    out = t / "output"
    flog = t / "calls.jsonl"
    base = {"mode": "ming", "engine": "local", "name": "Summer Sale", "rows": rows, "generate": True, "split": True, "input": None,
            "width": 1024, "height": 768, "layer_res": 1024, "t2i_prompt": json.dumps({"canvas_settings": {}, "layers": []}),
            "layer_plan": "Decompose this image into 3 layers with the following specifications:\n\nNumber of layers: 3\nLayer 1: Title - x\nLayer 2: Shoe - y\nLayer 3: Background - z",
            "steps": None, "seed": 42, "gpus": 1, "ming": {"python": sys.executable, "src": str(src), "gen": "inclusionAI/Ming-Image-0.2-Design", "layer": "inclusionAI/Ming-Image-0.1-Design-Layer"}}
    code, log = run_worker({"params": base, "output_dir": str(out), "config": {}}, t, {"MING_FAKE_LOG": str(flog)})
    calls = [json.loads(l) for l in flog.read_text().splitlines()] if flog.exists() else []
    check("local: the worker finishes", code == 0 and "ming complete" in log, log[-800:])
    check("…runs infer.py twice: text-to-image (0.2-Design), then layer-decompose (0.1-Design-Layer) on the design it made",
          len(calls) == 2 and "text-to-image" in calls[0]["argv"] and "inclusionAI/Ming-Image-0.2-Design" in calls[0]["argv"] and "layer-decompose" in calls[1]["argv"]
          and calls[1]["argv"][calls[1]["argv"].index("--input-image") + 1].endswith("image_00.png"), calls)
    check("…offline, in its folder, eager attention, balanced over the cards (1 here: GPUs = first card)",
          all(c["offline"] == "1" and Path(c["cwd"]).name == "Ming-Image" and "--local-files-only" in c["argv"] and c["argv"][c["argv"].index("--num-gpus") + 1] == "1" and c["argv"][c["argv"].index("--attn-implementation") + 1] == "eager" for c in calls), calls)
    outs = json.loads([l for l in log.splitlines() if l.startswith("@@OUTS ")][0][7:])
    check("…the design first, then each layer named after its row, front first", outs == ["Summer_Sale_ming.png", "Summer_Sale_ming_L01_Title.png", "Summer_Sale_ming_L02_Shoe.png", "Summer_Sale_ming_L03_Background.png"]
          and all((out / n).is_file() for n in outs), outs)
    check("…the progress steps (the queue's bar)", "step 1/2" in log and "step 2/2" in log)
    # split only: the picture given
    pic = t / "in.png"
    pic.write_bytes(png(8, 6, (1, 2, 3, 255)))
    flog.unlink()
    sp = dict(base, generate=False, input=str(pic), t2i_prompt=None, name="Split")
    code, log = run_worker({"params": sp, "output_dir": str(out), "config": {}}, t, {"MING_FAKE_LOG": str(flog)})
    calls = [json.loads(l) for l in flog.read_text().splitlines()]
    check("split the open picture: only layer-decompose, on that picture; 3 layers, no design", code == 0 and len(calls) == 1 and calls[0]["argv"][calls[0]["argv"].index("--input-image") + 1] == str(pic)
          and json.loads([l for l in log.splitlines() if l.startswith("@@OUTS ")][0][7:]) == ["Split_ming_L01_Title.png", "Split_ming_L02_Shoe.png", "Split_ming_L03_Background.png"], log[-600:])
    code, log = run_worker({"params": base, "output_dir": str(out), "config": {}}, t, {"MING_FAKE_LOG": str(flog), "MING_FAKE_OOM": "1"})
    check("out of memory: said, with what to do (OpenRouter, a smaller size, both cards)", code != 0 and "ran out of memory" in log and "OpenRouter" in log, log[-500:])
    code, log = run_worker({"params": dict(base, ming={"python": str(t / "nope"), "src": str(src)}), "output_dir": str(out), "config": {}}, t)
    check("not installed: said, where to install it", code != 0 and "Settings ▸ Add-ons ▸ 🧩 Ming layered design" in log, log[-300:])

    # ---------------- OpenRouter
    seen = []

    class H(BaseHTTPRequestHandler):
        def log_message(self, *a):
            pass

        def do_POST(self):
            body = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
            seen.append({"path": self.path, "auth": self.headers.get("Authorization"), "body": body})
            if body["model"] == "inclusionai/ming-image-0.2-design":
                return self.reply(404, {"error": {"code": 404, "message": "No endpoints found for inclusionai/ming-image-0.2-design"}})
            if body["model"] == "inclusionai/ming-image-0.1-design":
                return self.reply(200, {"data": [{"b64_json": base64.b64encode(png(8, 6, (9, 9, 9, 255))).decode(), "media_type": "image/png"}], "usage": {"cost": 0}})
            n = int(body["prompt"].split("Number of layers: ")[1].split("\n")[0])
            data = [{"b64_json": base64.b64encode(png(8, 6, (i, 0, 0, 255 if i == 0 else 100))).decode(), "media_type": "image/png"} for i in range(n + 1)]
            return self.reply(200, {"data": data})

        def reply(self, st, j):
            b = json.dumps(j).encode()
            self.send_response(st)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(b)))
            self.end_headers()
            self.wfile.write(b)

    srv = HTTPServer(("127.0.0.1", 0), H)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    orp = dict(base, engine="openrouter", name="Cloud", ming={"gen": ["inclusionai/ming-image-0.2-design", "inclusionai/ming-image-0.1-design"], "layer": "inclusionai/ming-image-0.1-design-layer"},
               style={"api_id": "__openrouter"})
    job = {"params": orp, "output_dir": str(out), "config": {"apis": {"__openrouter": {"key": "sk-or-test", "base": f"http://127.0.0.1:{srv.server_address[1]}"}}}}
    code, log = run_worker(job, t)
    srv.shutdown()
    check("OpenRouter: finishes", code == 0 and "ming complete" in log, log[-800:])
    check("…0.2-Design first; OpenRouter has none -> 0.1-Design, said", [s["body"]["model"] for s in seen[:2]] == ["inclusionai/ming-image-0.2-design", "inclusionai/ming-image-0.1-design"] and "OpenRouter has no inclusionai/ming-image-0.2-design" in log, [s["body"]["model"] for s in seen])
    check("…your key, POST /images, the size of the canvas, the JSON prompt", all(s["path"] == "/images" and s["auth"] == "Bearer sk-or-test" for s in seen) and seen[1]["body"]["size"] == "1024x768" and seen[1]["body"]["n"] == 1)
    check("…the layer model gets the design as its one reference + the plan", seen[2]["body"]["model"] == "inclusionai/ming-image-0.1-design-layer" and seen[2]["body"]["input_references"][0]["image_url"]["url"].startswith("data:image/png;base64,")
          and "Number of layers: 3" in seen[2]["body"]["prompt"], seen[2]["body"].get("model"))
    outs = json.loads([l for l in log.splitlines() if l.startswith("@@OUTS ")][0][7:])
    check("…the composite it sends first left out: the design + 3 layers", outs == ["Cloud_ming.png", "Cloud_ming_L01_Title.png", "Cloud_ming_L02_Shoe.png", "Cloud_ming_L03_Background.png"], outs)
    code, log = run_worker(dict(job, config={"apis": {}}), t)
    check("OpenRouter without a key: said", code != 0 and "API key" in log, log[-300:])

print(f"\n{passed} passed, {failed} failed")
print(f"RESULT: {failed} failed")
sys.exit(1 if failed else 0)
