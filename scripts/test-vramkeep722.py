#!/usr/bin/env python3
"""bitGen Studio - 2.722.0: KEEP THE MODEL ON THE CARD WHILE THE RENDERS USE IT (scripts/comfy_client.py).

Tim: "if render queue is using the same model don't unload vram until model is changed (will this keep adding to vram?"
  free_mode (change by default / always / off), models_of (the model files a graph loads), clear_before_gen with the
  graph: the first render frees, the same models again = kept (said, no /free), other models = freed (said), no graph =
  freed, "always" frees every time, off never; what ComfyUI holds is noted on every queue, forgotten after an
  out-of-memory error or a crash (the next render frees whatever it loads); every worker hands its graph over; the
  video worker notes its own /prompt and forgets on its out-of-memory ladder; the Settings dropdown and the defaults.
"""
import json
import os
import re
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
TMP = Path(tempfile.mkdtemp(prefix="vk722-"))
os.environ["BITGEN_COMFY_LOADED"] = str(TMP / "loaded.json")
import comfy_client as C  # noqa: E402

passed = failed = 0


def check(name, cond, got=None):
    global passed, failed
    if cond:
        passed += 1
        print("PASS: " + name)
    else:
        failed += 1
        print("FAIL: " + name + ("" if got is None else "\n      got " + json.dumps(got, default=str)[:600]))


cfg = lambda **c: {"engine": {"comfy": c}}  # noqa: E731
check("free_mode: nothing set = change (the new default)", C.free_mode({}) == "change" and C.free_mode(cfg()) == "change")
check("...free_vram always = always; junk = change", C.free_mode(cfg(free_vram="always")) == "always" and C.free_mode(cfg(free_vram="x")) == "change")
check("...the switch off (free_before_gen false) = off, whatever free_vram says", C.free_mode(cfg(free_before_gen=False, free_vram="always")) == "off")

QWEN = {"1": {"class_type": "UNETLoader", "inputs": {"unet_name": "qwen_image_2.1_int8_convrot.safetensors", "weight_dtype": "default"}},
        "2": {"class_type": "CLIPLoader", "inputs": {"clip_name": "qwen3vl_8b_int8_convrot.safetensors", "type": "qwen_image"}},
        "3": {"class_type": "VAELoader", "inputs": {"vae_name": "qwen_image_2.1_vae_bf16.safetensors"}},
        "4": {"class_type": "LoraLoaderModelOnly", "inputs": {"lora_name": "sub\\turbo8_lora_step2500.safetensors", "model": ["1", 0]}},
        "5": {"class_type": "CLIPTextEncode", "inputs": {"text": "a fox.safetensors in snow is not a file?", "clip": ["2", 0]}},
        "6": {"class_type": "LoadImage", "inputs": {"image": "ref.png"}}}
m = C.models_of(QWEN)
check("models_of: the model files, sorted, '/' separators; a link, a picture and prose are not models",
      m == sorted(["qwen_image_2.1_int8_convrot.safetensors", "qwen3vl_8b_int8_convrot.safetensors", "qwen_image_2.1_vae_bf16.safetensors",
                   "sub/turbo8_lora_step2500.safetensors"]), m)
check("...a graph with no model (a tool graph) = []", C.models_of({"1": {"class_type": "LoadImage", "inputs": {"image": "a.png"}}}) == [] and C.models_of(None) == [])

# ---- clear_before_gen with a fake /free
calls, lines = [], []
C.free_memory = lambda base, **k: (calls.append(base) or ([{"name": "gpu", "free": 1, "total": 2}], [{"name": "gpu", "free": 2, "total": 2}]))
say = lines.append
B = "http://127.0.0.1:8188"
C.forget_loaded(B)
r = C.clear_before_gen(B, cfg(), say, QWEN)
check("the first render (nothing known): frees the card", r is True and len(calls) == 1 and C.loaded_models(B) is None, lines[-2:])
C.note_loaded(B, QWEN)                                     # what queue() does after it is accepted
check("queue notes what ComfyUI holds now", C.loaded_models(B) == m)
r = C.clear_before_gen(B, cfg(), say, json.loads(json.dumps(QWEN)))
check("the next render with the SAME models: kept - no /free, said with the model names", r is False and len(calls) == 1
      and re.search(r"VRAM kept: the same model\(s\) as the last render \(qwen3vl_8b_int8_convrot\.safetensors, qwen_image_2\.1_int8_convrot\.safetensors, qwen_image_2\.1_vae_bf16\.safetensors \+1\)", lines[-1]), lines[-1])
FLUX = {"1": {"class_type": "UNETLoader", "inputs": {"unet_name": "flux3_klein.safetensors"}}}
r = C.clear_before_gen(B, cfg(), say, FLUX)
check("a render with OTHER models: 'the model changed' - freed", r is True and len(calls) == 2 and any("the model changed since the last render" in l for l in lines[-3:]), lines[-3:])
C.note_loaded(B, FLUX)
r = C.clear_before_gen(B, cfg(), say, None)
check("no graph handed over: freed, as before 2.722.0", r is True and len(calls) == 3)
C.note_loaded(B, FLUX)
r = C.clear_before_gen(B, cfg(free_vram="always"), say, FLUX)
check("'before every generation' (always): freed even with the same models", r is True and len(calls) == 4)
C.note_loaded(B, FLUX)
r = C.clear_before_gen(B, cfg(free_before_gen=False), say, QWEN)
check("the switch off: never freed (said)", r is False and len(calls) == 4 and "OFF" in lines[-1], lines[-1])
check("...another ComfyUI address knows nothing of this one's models", C.loaded_models("http://10.0.0.5:8188") is None)
C.note_loaded(B, {})
r = C.clear_before_gen(B, cfg(), say, {})
check("a graph that loads no model is never 'the same models' (an empty list does not match): freed", r is True)

# ---- queue notes; an out-of-memory error / a crash forgets
C.forget_loaded(B)
C.http_json = lambda url, body=None, **k: {"prompt_id": "p1"} if url.endswith("/prompt") else {}
C.print_meta = lambda g: None
C.queue(B, QWEN)
check("queue(): accepted -> noted", C.loaded_models(B) == m)
OOM = [["execution_error", {"exception_type": "torch.OutOfMemoryError", "exception_message": "CUDA out of memory. Tried to allocate 2 GiB"}]]
C.http_json = lambda url, body=None, **k: {"p1": {"status": {"status_str": "error", "messages": OOM}}}
try:
    C.wait(B, "p1", poll=0.01)
    ok = False
except C.ComfyError:
    ok = True
check("wait(): an out-of-memory error -> forgotten (the next render frees the card, same model or not)", ok and C.loaded_models(B) is None)
C.note_loaded(B, QWEN)
C.http_json = lambda url, body=None, **k: (_ for _ in ()).throw(OSError("refused"))
C.time.sleep = lambda s: None
try:
    C.wait(B, "p1", poll=0.01)
    ok = False
except C.ComfyError:
    ok = True
check("wait(): ComfyUI stopped answering (a crash) -> forgotten", ok and C.loaded_models(B) is None)

# ---- the workers
W = {p.name: p.read_text(encoding="utf-8") for p in (ROOT / "misc").glob("*worker.py")}
bare = [n for n, s in W.items() if re.search(r"clear_before_gen\(base, cfg, say\)", s)]
check("every worker hands its graph to clear_before_gen (none left without it)", not bare, bare)
users = sorted(n for n, s in W.items() if "clear_before_gen(" in s)
# 2.749.0: + RelayVSR (2.728.0) and the picture upscaler (2.733.0), which free the card too - the list had not followed
check("...the 15 workers that free the card (image, video, Wan, LTX, music, graph, swap, Viggle, Ripple, SeedVR2, RTX VFX, DLSS 5, 3D, RelayVSR, picture upscale)",
      len(users) == 15 and "relayvsr_worker.py" in users and "imgupscale_worker.py" in users, users)
V = W["worker.py"]
check("the video worker: its own /prompt notes the models; its clear gets the graph; its out-of-memory ladder forgets",
      "_cc.note_loaded(base, graph)" in V and "_comfy_clear_vram(base, cfg, g)" in V and "_cc.clear_before_gen(base, cfg, say, graph)" in V
      and re.search(r"except ComfyOOM as oom:\n\s+oom_tries \+= 1\n\s+if _cc is not None:[^\n]*\n\s+_cc\.forget_loaded\(_comfy_url\(cfg\)\)", V))
H = (ROOT / "static" / "index.html").read_text(encoding="utf-8")
check("Settings -> ComfyUI: 'Free it' - when the model changes (first, the default) / before every generation; saved as free_vram, painted",
      re.search(r'<select id="s_cfreewhen"><option value="change">when the model changes</option><option value="always">before every generation</option></select>', H)
      and 'free_vram: $("s_cfreewhen") ? $("s_cfreewhen").value : "change"' in H and '$("s_cfreewhen").value = (eng.comfy || {}).free_vram === "always" ? "always" : "change"' in H)
check("the defaults: free_vram change in lib/core.js and misc/default.settings",
      'free_vram: "change"' in (ROOT / "lib" / "core.js").read_text(encoding="utf-8")
      and json.loads((ROOT / "misc" / "default.settings").read_text(encoding="utf-8"))["engine"]["comfy"]["free_vram"] == "change")

print(f"\n{passed} passed, {failed} failed")
print("RESULT: " + ("FAIL" if failed else "PASS"))
sys.exit(1 if failed else 0)
