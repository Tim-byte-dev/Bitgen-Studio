#!/usr/bin/env python3
"""bitGen Studio — 3.12.0: 🧩 Ming layered design in ComfyUI - scripts/ming_graph.py (pure) and misc/ming_worker.py (mode "ming")
end to end against a fake ComfyUI on 127.0.0.1 (its /object_info lists Comfy-Org/Ming-Image's files; /prompt records the graph;
/history hands back one picture for the design, the composite + N layers for the split), and the ☁ OpenRouter engine against a
fake /images endpoint (3.9.0's legs, kept).
Tim: "replace our ming image with this one, https://huggingface.co/Comfy-Org/Ming-Image" """
import base64
import json
import os
import struct
import subprocess
import sys
import tempfile
import threading
import zlib
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse, unquote

ROOT = Path(__file__).resolve().parent.parent
WORKER = ROOT / "misc" / "ming_worker.py"
sys.path.insert(0, str(ROOT / "scripts"))
import ming_graph as MG                                    # noqa: E402

passed = failed = 0


def check(name, ok, got=None):
    global passed, failed
    if ok:
        passed += 1
        print("PASS: " + name)
    else:
        failed += 1
        print("FAIL: " + name + ("" if got is None else "\n      got " + str(got)[:700]))


def png(w, h, rgba):
    raw = b"".join(b"\x00" + bytes(rgba) * w for _ in range(h))

    def chunk(t, d):
        return struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xffffffff)
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0)) + chunk(b"IDAT", zlib.compress(raw)) + chunk(b"IEND", b"")


UNETS = ["ming_image_0.2_design_int8_convrot.safetensors", "ming_image_0.2_design_bf16.safetensors",
         "ming_image_0.1_design_layer_int8_convrot.safetensors", "ming_image_0.1_design_layer_bf16.safetensors", "other/flux1-dev.safetensors"]
CLIPS = ["ming_image_0.1_ling_mini_2.0_bf16.safetensors", "ming_image_0.2_ling_mini_2.0_int8_convrot.safetensors",
         "ming_image_0.1_ling_mini_2.0_layer_int8_convrot.safetensors", "ming_image_0.1_ling_mini_2.0_layer_bf16.safetensors", "t5xxl.safetensors"]
VAES = ["ming_image_vae_bf16.safetensors", "ae.safetensors"]

# ---------------------------------------------------------------- the graphs (pure)
pk = MG.pick(UNETS, CLIPS, VAES)
check("pick: int8 first, the 0.2 text encoder for the design (not 0.1's, not the layer one), the layer model's own text encoder",
      pk["design"] == UNETS[0] and pk["design_te"] == CLIPS[1] and pk["layer"] == UNETS[2] and pk["layer_te"] == CLIPS[2] and pk["vae"] == VAES[0] and not pk["error"], pk)
pb = MG.pick(UNETS, CLIPS, VAES, precision={"design": "bf16", "layer": "int8"})
check("pick: bf16 for the model whose bf16 set is there (lib/mingAddon.js says which), int8 for the other",
      pb["design"] == UNETS[1] and pb["design_te"] == CLIPS[1] and pb["layer"] == UNETS[2] and pb["layer_te"] == CLIPS[2], pb)
pm = MG.pick(UNETS[:2], CLIPS[:2], VAES, need=("design", "layer"))
check("pick: the layer files not listed -> said, with their names and the add-on", pm["error"] and "ming_image_0.1_design_layer_int8_convrot" in pm["error"] and "🧩 Ming layered design" in pm["error"]
      and pm["missing"] == [MG.HINT["layer"], MG.HINT["layer_te"]], pm)
check("pick: only what the job needs (a design alone does not need the layer files)", not MG.pick(UNETS[:2], CLIPS[:2], VAES, need=("design",))["error"])
g, notes = MG.build_design({"model": pk["design"], "te": pk["design_te"], "vae": pk["vae"], "prompt": '{"canvas_settings": {}, "layers": []}',
                            "width": 1530, "height": 1020, "seed": 7, "prefix": "bitgen_ming/x"})
by = {n["class_type"]: (k, n) for k, n in g.items()}
check("design graph: Comfy-Org's template recipe - ModelSamplingFlux 1.15 / 0.5 at the size, simple 12 steps, euler, BasicGuider (no cfg)",
      by["ModelSamplingFlux"][1]["inputs"]["max_shift"] == 1.15 and by["ModelSamplingFlux"][1]["inputs"]["base_shift"] == 0.5 and by["ModelSamplingFlux"][1]["inputs"]["width"] == 1536
      and by["BasicScheduler"][1]["inputs"]["scheduler"] == "simple" and by["BasicScheduler"][1]["inputs"]["steps"] == 12 and by["KSamplerSelect"][1]["inputs"]["sampler_name"] == "euler"
      and "BasicGuider" in by and "CFGGuider" not in by, g)
check("…the text encoder as type qwen_image (the template's), 16-px size, the seed, the JSON as the prompt, SaveImage",
      by["CLIPLoader"][1]["inputs"]["type"] == "qwen_image" and by["EmptyLatentImage"][1]["inputs"]["height"] == 1024 and by["RandomNoise"][1]["inputs"]["noise_seed"] == 7
      and by["CLIPTextEncode"][1]["inputs"]["text"].startswith('{"canvas_settings"') and by["SaveImage"][1]["inputs"]["filename_prefix"] == "bitgen_ming/x")
check("…every link points at a node of the graph", all(v[0] in g for n in g.values() for v in n["inputs"].values() if isinstance(v, list)))
gl, _ = MG.build_layers({"model": pk["layer"], "te": pk["layer_te"], "vae": pk["vae"], "prompt": "Decompose this image into 3 layers", "image": "in.png",
                         "layers": 3, "width": 1024, "height": 768, "seed": 9})
bl = {n["class_type"]: (k, n) for k, n in gl.items()}
check("layer graph: the picture scaled to the latent's size goes in as TextEncodeMingImageEdit's image_1 (text encoder + VAE reference)",
      bl["ImageScale"][1]["inputs"]["width"] == 1024 and bl["ImageScale"][1]["inputs"]["height"] == 768 and bl["ImageScale"][1]["inputs"]["image"] == [bl["LoadImage"][0], 0]
      and bl["TextEncodeMingImageEdit"][1]["inputs"]["images.image_1"] == [bl["ImageScale"][0], 0] and bl["TextEncodeMingImageEdit"][1]["inputs"]["vae"] == [bl["VAELoader"][0], 0]
      and bl["TextEncodeMingImageEdit"][1]["inputs"]["prompt"].startswith("Decompose"), gl)
check("…the latent has the layers + the composite frame (EmptyQwenImageLayeredLatentImage layers = 3)",
      bl["EmptyQwenImageLayeredLatentImage"][1]["inputs"]["layers"] == 3 and bl["EmptyQwenImageLayeredLatentImage"][1]["inputs"]["width"] == 1024)
check("…cfg 2.0 against the zeroed conditioning (inclusionAI's layer sampling), 12 steps",
      bl["CFGGuider"][1]["inputs"]["cfg"] == 2.0 and bl["CFGGuider"][1]["inputs"]["negative"] == [bl["ConditioningZeroOut"][0], 0]
      and bl["ConditioningZeroOut"][1]["inputs"]["conditioning"] == [bl["TextEncodeMingImageEdit"][0], 0] and bl["BasicScheduler"][1]["inputs"]["steps"] == 12)
check("…cut to one frame per batch item BEFORE the decode (the Ming VAE is a video VAE), then saved",
      bl["LatentCutToBatch"][1]["inputs"] == {"samples": [bl["SamplerCustomAdvanced"][0], 0], "dim": "t", "slice_size": 1} and bl["VAEDecode"][1]["inputs"]["samples"] == [bl["LatentCutToBatch"][0], 0])
check("…every link points at a node; every class is one the worker checks for", all(v[0] in gl for n in gl.values() for v in n["inputs"].values() if isinstance(v, list))
      and {n["class_type"] for n in gl.values()} <= set(MG.REQUIRED + MG.REQUIRED_LAYERS) and {n["class_type"] for n in g.values()} <= set(MG.REQUIRED))
check("layer_items: the composite (first) dropped", MG.layer_items(["c", "a", "b"], 2) == ["a", "b"] and MG.layer_items(["only"], 1) == ["only"])
for bad, o in (("layers", {"image": "x", "prompt": "p", "layers": 0}), ("picture", {"prompt": "p", "layers": 2}), ("plan", {"image": "x", "layers": 2})):
    try:
        MG.build_layers(dict({"model": "m", "te": "t", "vae": "v"}, **o))
        check("build_layers refuses without " + bad, False)
    except ValueError:
        check("build_layers refuses without " + bad, True)

# ---------------------------------------------------------------- a fake ComfyUI
STATE = {"graphs": [], "uploads": [], "drop": set(), "unets": list(UNETS), "fail": ""}


def spec(cls):
    combos = {"UNETLoader": {"unet_name": [STATE["unets"], {}], "weight_dtype": [["default", "fp8_e4m3fn"], {}]},
              "CLIPLoader": {"clip_name": [CLIPS, {}], "type": [["stable_diffusion", "qwen_image", "pan2"], {}], "device": [["default", "cpu"], {}]},
              "VAELoader": {"vae_name": [VAES, {}]}}
    return {"input": {"required": combos.get(cls, {})}, "output": [], "name": cls}


CLASSES = set(MG.REQUIRED + MG.REQUIRED_LAYERS)


class Comfy(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def reply(self, st, body, ctype="application/json"):
        b = body if isinstance(body, bytes) else json.dumps(body).encode()
        self.send_response(st)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(b)))
        self.end_headers()
        self.wfile.write(b)

    def do_GET(self):
        u = urlparse(self.path)
        if u.path == "/system_stats":
            return self.reply(200, {"system": {"comfyui_version": "0.46.0"}, "devices": []})
        if u.path == "/object_info":
            return self.reply(200, {c: spec(c) for c in CLASSES - STATE["drop"]})
        if u.path.startswith("/object_info/"):
            c = unquote(u.path[len("/object_info/"):])
            return self.reply(200, {c: spec(c)} if c in CLASSES - STATE["drop"] else {})
        if u.path.startswith("/history/"):
            pid = u.path.split("/")[-1]
            gr = STATE["graphs"][int(pid)]
            if STATE["fail"]:
                return self.reply(200, {pid: {"status": {"status_str": "error", "messages": [["execution_error", {"exception_message": STATE["fail"], "node_type": "SamplerCustomAdvanced"}]]}, "outputs": {}}})
            lay = [n for n in gr.values() if n["class_type"] == "EmptyQwenImageLayeredLatentImage"]
            n = lay[0]["inputs"]["layers"] + 1 if lay else 1
            save = [k for k, v in gr.items() if v["class_type"] == "SaveImage"][0]
            return self.reply(200, {pid: {"status": {"status_str": "success", "completed": True},
                                          "outputs": {save: {"images": [{"filename": f"p{pid}_{i:02d}.png", "subfolder": "bitgen_ming", "type": "output"} for i in range(n)]}}}})
        if u.path == "/view":
            q = parse_qs(u.query)
            i = int(q["filename"][0].split("_")[1][:2])
            return self.reply(200, png(8, 6, (i * 30, 10, 10, 255 if i == 0 else 120)), "image/png")
        return self.reply(404, {})

    def do_POST(self):
        ln = int(self.headers.get("Content-Length") or 0)
        body = self.rfile.read(ln) if ln else b""
        if self.path == "/upload/image":
            STATE["uploads"].append(len(body))
            return self.reply(200, {"name": "ming_in.png", "subfolder": "", "type": "input"})
        if self.path == "/prompt":
            STATE["graphs"].append(json.loads(body)["prompt"])
            return self.reply(200, {"prompt_id": str(len(STATE["graphs"]) - 1), "number": 1})
        return self.reply(200, {})


srv = ThreadingHTTPServer(("127.0.0.1", 0), Comfy)
threading.Thread(target=srv.serve_forever, daemon=True).start()
URL = f"http://127.0.0.1:{srv.server_address[1]}"


def run_worker(job, cwd, env=None):
    jf = Path(cwd) / "job.json"
    jf.write_text(json.dumps(job), encoding="utf-8")
    e = dict(os.environ, **(env or {}))
    for k in ("BITGEN_SAMPLER", "BITGEN_SCHEDULER", "BITGEN_TEXT_ENCODER"):
        e.pop(k, None)
    r = subprocess.run([sys.executable, str(WORKER), str(jf)], cwd=cwd, capture_output=True, text=True, env=e, timeout=180)
    return r.returncode, r.stdout + r.stderr


rows = [{"name": "Title", "desc": "the words \"SALE\"", "where": "top"}, {"name": "Shoe", "desc": "a red shoe", "where": "centre"}, {"name": "Background", "desc": "a beach", "where": "all"}]
CFG = {"engine": {"comfy": {"url": URL}}, "comfy": {"free_before_gen": False}}

with tempfile.TemporaryDirectory() as t:
    t = Path(t)
    out = t / "output"
    base = {"mode": "ming", "engine": "comfy", "name": "Summer Sale", "rows": rows, "generate": True, "split": True, "input": None,
            "width": 1024, "height": 768, "layer_res": 1024, "t2i_prompt": json.dumps({"canvas_settings": {}, "layers": []}),
            "layer_plan": "Decompose this image into 3 layers with the following specifications:\n\nNumber of layers: 3\nLayer 1: Title - x\nLayer 2: Shoe - y\nLayer 3: Background - z",
            "steps": None, "seed": 42, "precision": {"design": "int8", "layer": "bf16"}}
    code, log = run_worker({"params": base, "output_dir": str(out), "config": CFG}, t)
    check("comfy: the worker finishes", code == 0 and "ming complete" in log, log[-1200:])
    G = STATE["graphs"]
    check("…two graphs: the design (0.2 Design int8), then the layers (0.1 Design-Layer bf16 + its bf16 text encoder - the precision asked)",
          len(G) == 2 and any(n["inputs"].get("unet_name") == UNETS[0] for n in G[0].values())
          and any(n["inputs"].get("unet_name") == UNETS[3] for n in G[1].values()) and any(n["inputs"].get("clip_name") == CLIPS[3] for n in G[1].values()), [len(G)])
    check("…the design it made is uploaded and split; the plan + 3 layers", len(STATE["uploads"]) == 1
          and [n for n in G[1].values() if n["class_type"] == "LoadImage"][0]["inputs"]["image"] == "ming_in.png"
          and [n for n in G[1].values() if n["class_type"] == "EmptyQwenImageLayeredLatentImage"][0]["inputs"]["layers"] == 3
          and "Number of layers: 3" in [n for n in G[1].values() if n["class_type"] == "TextEncodeMingImageEdit"][0]["inputs"]["prompt"])
    check("…the split at the picture's shape (~1024 px; the fake design is 8x6 -> 4:3)",
          [n for n in G[1].values() if n["class_type"] == "EmptyQwenImageLayeredLatentImage"][0]["inputs"]["width"] == 1184
          and [n for n in G[1].values() if n["class_type"] == "EmptyQwenImageLayeredLatentImage"][0]["inputs"]["height"] == 880, G[1])
    outs = json.loads([ln for ln in log.splitlines() if ln.startswith("@@OUTS ")][0][7:])
    check("…the design first, then each layer named after its row, front first (the composite left out)",
          outs == ["Summer_Sale_ming.png", "Summer_Sale_ming_L01_Title.png", "Summer_Sale_ming_L02_Shoe.png", "Summer_Sale_ming_L03_Background.png"] and all((out / n).is_file() for n in outs), outs)
    check("…the layer files are frames 1..3 of what ComfyUI saved (not the composite)", (out / "Summer_Sale_ming_L01_Title.png").read_bytes() == png(8, 6, (30, 10, 10, 120))
          and (out / "Summer_Sale_ming.png").read_bytes() == png(8, 6, (0, 10, 10, 255)))
    check("…the progress steps (the queue's bar) and the files it used", "step 1/2" in log and "step 2/2" in log and "ming_image_0.2_ling_mini_2.0_int8_convrot" in log, log[-900:])

    # split only: the picture given
    STATE["graphs"].clear()
    pic = t / "in.png"
    pic.write_bytes(png(16, 16, (1, 2, 3, 255)))
    sp = dict(base, generate=False, input=str(pic), t2i_prompt=None, name="Split", layer_res=512, precision={"design": "int8", "layer": "int8"})
    code, log = run_worker({"params": sp, "output_dir": str(out), "config": CFG}, t)
    G = STATE["graphs"]
    check("split the open picture: one graph (the layers, int8), at 512 for a square picture; 3 layers, no design",
          code == 0 and len(G) == 1 and [n for n in G[0].values() if n["class_type"] == "EmptyQwenImageLayeredLatentImage"][0]["inputs"]["width"] == 512
          and any(n["inputs"].get("unet_name") == UNETS[2] for n in G[0].values())
          and json.loads([ln for ln in log.splitlines() if ln.startswith("@@OUTS ")][0][7:]) == ["Split_ming_L01_Title.png", "Split_ming_L02_Shoe.png", "Split_ming_L03_Background.png"], log[-600:])

    # an older ComfyUI: no Ming nodes
    STATE["drop"] = {"TextEncodeMingImageEdit", "EmptyQwenImageLayeredLatentImage"}
    code, log = run_worker({"params": base, "output_dir": str(out), "config": CFG}, t)
    check("an older ComfyUI (no Ming-Image nodes): said, with how to update", code != 0 and "TextEncodeMingImageEdit" in log and "0.46.0" in log and "Update ComfyUI" in log, log[-400:])
    STATE["drop"] = set()
    # the files not downloaded
    STATE["unets"] = [UNETS[0], UNETS[4]]
    code, log = run_worker({"params": base, "output_dir": str(out), "config": CFG}, t)
    check("the layer model not listed: said, with its file name and the add-on", code != 0 and "ming_image_0.1_design_layer_int8_convrot" in log and "Settings ▸ Add-ons ▸ 🧩 Ming layered design" in log, log[-400:])
    STATE["unets"] = list(UNETS)
    # ComfyUI fails while sampling
    STATE["fail"] = "CUDA out of memory"
    code, log = run_worker({"params": dict(base, split=False), "output_dir": str(out), "config": CFG}, t)
    check("ComfyUI fails: the step and ComfyUI's own words", code != 0 and "Ming-Image (the design) stopped in ComfyUI" in log and "out of memory" in log, log[-500:])
    STATE["fail"] = ""
    # ComfyUI not running
    code, log = run_worker({"params": base, "output_dir": str(out), "config": {"engine": {"comfy": {"url": "http://127.0.0.1:9"}}}}, t)
    check("ComfyUI not running: said, start it or use OpenRouter", code != 0 and "cannot reach ComfyUI" in log and "OpenRouter" in log, log[-300:])

    # ---------------- OpenRouter (3.9.0's legs)
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

    osrv = ThreadingHTTPServer(("127.0.0.1", 0), H)
    threading.Thread(target=osrv.serve_forever, daemon=True).start()
    orp = dict(base, engine="openrouter", name="Cloud", ming={"gen": ["inclusionai/ming-image-0.2-design", "inclusionai/ming-image-0.1-design"], "layer": "inclusionai/ming-image-0.1-design-layer"},
               style={"api_id": "__openrouter"})
    orp.pop("precision")
    job = {"params": orp, "output_dir": str(out), "config": {"apis": {"__openrouter": {"key": "sk-or-test", "base": f"http://127.0.0.1:{osrv.server_address[1]}"}}}}
    code, log = run_worker(job, t)
    osrv.shutdown()
    check("OpenRouter: finishes", code == 0 and "ming complete" in log, log[-800:])
    check("…0.2-Design first; OpenRouter has none -> 0.1-Design, said", [s["body"]["model"] for s in seen[:2]] == ["inclusionai/ming-image-0.2-design", "inclusionai/ming-image-0.1-design"] and "OpenRouter has no inclusionai/ming-image-0.2-design" in log, [s["body"]["model"] for s in seen])
    check("…the layer model gets the design as its one reference + the plan", seen[2]["body"]["model"] == "inclusionai/ming-image-0.1-design-layer" and seen[2]["body"]["input_references"][0]["image_url"]["url"].startswith("data:image/png;base64,")
          and "Number of layers: 3" in seen[2]["body"]["prompt"], seen[2]["body"].get("model"))
    outs = json.loads([ln for ln in log.splitlines() if ln.startswith("@@OUTS ")][0][7:])
    check("…the composite it sends first left out: the design + 3 layers", outs == ["Cloud_ming.png", "Cloud_ming_L01_Title.png", "Cloud_ming_L02_Shoe.png", "Cloud_ming_L03_Background.png"], outs)
    code, log = run_worker(dict(job, config={"apis": {}}), t)
    check("OpenRouter without a key: said", code != 0 and "API key" in log, log[-300:])

srv.shutdown()
print(f"\n{passed} passed, {failed} failed")
print(f"RESULT: {failed} failed")
sys.exit(1 if failed else 0)
