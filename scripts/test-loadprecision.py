#!/usr/bin/env python3
"""bitGen Studio — 2.303.0: a video style's per-phase LOAD PRECISION.
Run: python3 scripts/test-loadprecision.py

Tim (verbatim): "it is an int8 file, but i think it would be good to add the
8-bit loading option for users who are using the bf16 models".
worker.apply_video_style writes a phase's dtype into ITS model loader's
weight_dtype (UNETLoader), leaves already-quantized files alone (int8 /
fp8 / fp4 / GGUF - by name), and says why whenever it does not apply."""
import copy
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "misc"))
import worker as W  # noqa: E402

P = F = 0
def check(name, ok, extra=None):
    global P, F
    if ok:
        P += 1; print("PASS: " + name)
    else:
        F += 1; print("FAIL: " + name + ("" if extra is None else " :: " + json.dumps(extra, default=str)[:500]))

def graph(*loaders):
    g = {}
    for i, (cls, key, name) in enumerate(loaders, start=1):
        ins = {key: name}
        if cls == "UNETLoader":
            ins["weight_dtype"] = "default"
        g[str(i)] = {"class_type": cls, "inputs": ins}
    return g

def run(g, phases):
    g2, notes = W.apply_video_style(copy.deepcopy(g), {"phases": phases})
    return g2, notes

bf16 = graph(("UNETLoader", "unet_name", "minimax_h3_singularity_bf16.safetensors"))
g, n = run(bf16, [{"dtype": "fp8_e4m3fn"}])
check("a bf16 model loads as fp8: its UNETLoader.weight_dtype = fp8_e4m3fn, said",
      g["1"]["inputs"]["weight_dtype"] == "fp8_e4m3fn" and any("load as fp8_e4m3fn -> 1.weight_dtype" in x for x in n), n)
g, n = run(bf16, [{"model": "other_bf16.safetensors", "dtype": "fp8_e4m3fn_fast"}])
check("the phase's model AND its precision land together (fast fp8)",
      g["1"]["inputs"]["unet_name"] == "other_bf16.safetensors" and g["1"]["inputs"]["weight_dtype"] == "fp8_e4m3fn_fast", g["1"])
g, n = run(bf16, [{}])
check("blank = the workflow's own precision (untouched, nothing said)",
      g["1"]["inputs"]["weight_dtype"] == "default" and not any("load as" in x for x in n), n)
for name in ("minimax_h3_ref2va_pruned_int8_convrot.safetensors", "h3_fp8_e4m3fn.safetensors",
             "h3_nvfp4.safetensors", "h3-Q8_0.gguf", "h3_q4_k_m.gguf"):
    g, n = run(graph(("UNETLoader", "unet_name", name)), [{"dtype": "fp8_e4m3fn"}])
    check(f"already quantized ({name}) -> left as it is, said in words",
          g["1"]["inputs"]["weight_dtype"] == "default" and any("already quantized" in x for x in n), n)
g, n = run(graph(("UNETLoader", "unet_name", "h3_int8.safetensors")), [{"dtype": "default"}])
check("'Full precision (as stored)' still applies to any file", g["1"]["inputs"]["weight_dtype"] == "default"
      and any("load as default" in x for x in n), n)
g, n = run(graph(("CheckpointLoaderSimple", "ckpt_name", "sd_bf16.safetensors")), [{"dtype": "fp8_e4m3fn"}])
check("a loader without weight_dtype (checkpoint loader) is not touched, said",
      "weight_dtype" not in g["1"]["inputs"] and any("has no weight_dtype input" in x for x in n), n)
two = graph(("UNETLoader", "unet_name", "wan_high_bf16.safetensors"), ("UNETLoader", "unet_name", "wan_low_bf16.safetensors"))
g, n = run(two, [{"dtype": ""}, {"dtype": "fp8_e4m3fn"}])
check("two phases: phase 2's precision lands on loader 2 only (Wan high/low)",
      g["1"]["inputs"]["weight_dtype"] == "default" and g["2"]["inputs"]["weight_dtype"] == "fp8_e4m3fn", [g["1"], g["2"]])
g, n = run(bf16, [{}, {"dtype": "fp8_e4m3fn"}])
check("a phase with no loader of its own: ignored, said", any("only 1 model loader" in x for x in n), n)

# ---- the style store keeps a valid precision per phase, drops junk --------------
import subprocess  # noqa: E402
root = Path(__file__).resolve().parent.parent
r = subprocess.run(["node", "-e", """
const S = require("./lib/styles");
const v = S.normalize({ kind: "video", name: "t", arch: "wan22",
  phases: [{ model: "a", dtype: "fp8_e4m3fn" }, { model: "b", dtype: "bogus" }] }, {});
const keep = S.normalize({ kind: "video", name: "t", arch: "wan22", te: [""] }, v);
console.log(JSON.stringify({ v: v.phases.map((p) => p.dtype), keep: keep.phases.map((p) => p.dtype) }));
"""], cwd=root, capture_output=True, text=True)
try:
    got = json.loads(r.stdout.strip().splitlines()[-1])
except Exception:  # noqa: BLE001
    got = {"err": r.stderr[-300:]}
check("the style store keeps a valid precision per phase and drops an unknown one to blank",
      got.get("v") == ["fp8_e4m3fn", ""], got)
check("...and an edit that does not send phases keeps the stored precision",
      got.get("keep") == ["fp8_e4m3fn", ""], got)

print(f"\nRESULT: {P} passed, {F} failed")
sys.exit(1 if F else 0)
