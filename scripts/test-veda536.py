#!/usr/bin/env python3
"""bitGen Studio — 2.536.0 units: VEDA SPARSE ATTENTION as an optional video accelerator.

Tim: "add veda as an optional video accelerator" (after "can you check out this workflow please - it is meant to
increase mmh3 speed a lot but keep quality" - The AI Brief's Default / Sage / Veda test bench).
Veda (github.com/veda-sparse/Veda-on-ComfyUI, node VedaSparseAttention, ComfyUI 0.38+): a learned predictor in
ComfyUI/models/veda keeps ~10 % of the attention tiles; it REPLACES attention, so it goes LAST on the model wire
(after LoRAs / Spectrum, before the guider), and a Sage patch in front of it is pointless.
Run: python3 scripts/test-veda536.py
"""
import copy
import json
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..")
sys.path.insert(0, ROOT)
sys.path.insert(0, HERE)
import worker                                                # noqa: E402
import comfy_client as CC                                    # noqa: E402

PASS = FAIL = 0


def check(name, cond, got=None):
    global PASS, FAIL
    if cond:
        PASS += 1
        print("PASS: " + name)
    else:
        FAIL += 1
        print("FAIL: " + name + ("\n      " + repr(got)[:900] if got is not None else ""))


def h3(w=1344, h=768):
    return {
        "1": {"class_type": "UNETLoader", "inputs": {"unet_name": "h3.safetensors", "weight_dtype": "default"}},
        "2": {"class_type": "MiniMaxH3SigmaShift", "inputs": {"model": ["1", 0], "shift_video": 12, "shift_audio": 3}},
        "4": {"class_type": "MiniMaxH3ReferenceToVideo", "inputs": {"width": w, "height": h, "length": 124}},
        "3": {"class_type": "BasicGuider", "inputs": {"model": ["2", 0], "conditioning": ["4", 0]}},
        "6": {"class_type": "BasicScheduler", "inputs": {"model": ["2", 0], "steps": 8}},
        "5": {"class_type": "SamplerCustomAdvanced", "inputs": {"guider": ["3", 0], "sigmas": ["6", 0]}},
    }


# ---- injection
g, notes = worker.apply_video_accel(h3(), {"veda": "on"})
v = g.get("h3veda") or {}
check("veda on: h3veda (VedaSparseAttention) after the sigma shift; the guider AND the scheduler read it",
      v.get("class_type") == "VedaSparseAttention" and v["inputs"]["model"] == ["2", 0] and g["3"]["inputs"]["model"] == ["h3veda", 0]
      and g["6"]["inputs"]["model"] == ["h3veda", 0], g)
check("…the authors' 90 % / 90 % and the released predictor as the starting name (the worker swaps in a listed one)",
      v["inputs"]["generated_sparsity"] == "90%" and v["inputs"]["reference_sparsity"] == "90%"
      and v["inputs"]["predictor"] == "minimax_h3_t2va_veda_8nfe_600step_preview_fp8.safetensors" and "full_attention_steps" not in v["inputs"], v)
check("…1344x768 is a trained size: no size note", not any("trained for" in n for n in notes), notes)
gq, nq = worker.apply_video_accel(h3(960, 544), {"veda": "quality", "veda_predictor": "my/r2va.safetensors"})
q = gq["h3veda"]["inputs"]
check("quality: 75 % / 50 % + full attention on step 0, the style's predictor kept", q["generated_sparsity"] == "75%" and q["reference_sparsity"] == "50%"
      and q["full_attention_steps"] == "0" and q["predictor"] == "my/r2va.safetensors", q)
check("…960x544 (The AI Brief's benchmark size) is not trained: the note says it uses the nearest size's tile plan",
      any("960x544 uses the nearest trained size" in n for n in nq), nq)

gs, ns = worker.apply_video_accel(h3(), {"veda": "on", "sage": "auto"})
check("veda + sage: the Sage patch is skipped (Veda replaces attention) and said so", "h3sage" not in gs and "h3veda" in gs
      and any("sage auto skipped - Veda replaces attention" in n for n in ns), ns)
gp, _ = worker.apply_video_accel(h3(), {"veda": "on", "spectrum": "on"})
check("veda + spectrum: shift -> spectrum -> veda -> guider (Veda last)", gp["h3spectrum"]["inputs"]["model"] == ["2", 0]
      and gp["h3veda"]["inputs"]["model"] == ["h3spectrum", 0] and gp["3"]["inputs"]["model"] == ["h3veda", 0], gp)
gl, nl = worker.apply_video_accel(h3(), {"veda": "on", "long": "on"})
check("veda + Long video: Veda skipped (Long runs its own attention patch)", "h3veda" not in gl and "h3lowvram" in gl and any("Veda skipped" in n for n in nl), nl)
plain = {"1": {"class_type": "UNETLoader", "inputs": {}}, "3": {"class_type": "BasicGuider", "inputs": {"model": ["1", 0], "conditioning": ["9", 0]}}}
gn, nn = worker.apply_video_accel(copy.deepcopy(plain), {"veda": "on"})
check("a graph with no native MiniMax H3 node: skipped with a note", "h3veda" not in gn and any("Veda is MiniMax H3-only" in n for n in nn), nn)
g0, n0 = worker.apply_video_accel(h3(), {"veda": "off", "sage": "off"})
check("off / an unknown mode: the graph untouched", g0 == h3() and n0 == [] and worker.apply_video_accel(h3(), {"veda": "turbo9000"})[0] == h3())

# ---- the fallback machinery knows it
check("accel_nodes lists h3veda; drop_accel_node heals the chain to the guider", worker.accel_nodes(g) == {"h3veda": "VedaSparseAttention"}
      and worker.drop_accel_node(copy.deepcopy(g), "h3veda")[0]["3"]["inputs"]["model"] == ["2", 0])
check("a missing Veda pack names the install (ACCEL_INSTALL_HINTS)", "Veda-on-ComfyUI" in worker.ACCEL_INSTALL_HINTS["VedaSparseAttention"]
      and "models/veda" in worker.ACCEL_INSTALL_HINTS["VedaSparseAttention"])
err = lambda **d: [["execution_error", d]]
NODES = {"h3veda": "VedaSparseAttention"}
check("failed_accelerator: the Veda node's own error -> h3veda", CC.failed_accelerator(err(node_id="h3veda", node_type="VedaSparseAttention", exception_message="boom"), NODES) == "h3veda")
check("…a Triton kernel error inside the sampler while Veda is the attention -> h3veda",
      CC.failed_accelerator(err(node_id="5", node_type="SamplerCustomAdvanced", exception_type="triton.compiler.errors.CompilationError", exception_message="x"), NODES) == "h3veda")
check("…an out-of-memory is the memory ladder's, not Veda's",
      CC.failed_accelerator(err(node_id="5", node_type="SamplerCustomAdvanced", exception_type="torch.OutOfMemoryError", exception_message="CUDA out of memory (triton)"), NODES) == "")
check("…an unrelated failure blames nothing", CC.failed_accelerator(err(node_id="4", node_type="VAEDecode", exception_message="bad shape"), NODES) == "")

# ---- the predictor ComfyUI lists
L = ["minimax_h3_t2va_veda_8nfe_600step_preview_fp8.safetensors", "sub/minimax_h3_r2va_veda_preview_fp8.safetensors"]
check("pick: the style's file by name (any subfolder)", worker.pick_veda_predictor("minimax_h3_r2va_veda_preview_fp8.safetensors", L, False) == L[1])
check("pick: blank -> an R2VA one for a reference graph, a T2VA one otherwise", worker.pick_veda_predictor("", L, True) == L[1] and worker.pick_veda_predictor("", L, False) == L[0])
check("pick: an unlisted wish -> the best listed one; nothing listed -> ''", worker.pick_veda_predictor("gone.safetensors", L, False) == L[0] and worker.pick_veda_predictor("x", [], True) == "")
check("combo lists: old [[...]] and new ['COMBO', {options}] forms", worker._combo_list([["a", "b"]]) == ["a", "b"] and worker._combo_list(["COMBO", {"options": ["c"]}]) == ["c"] and worker._combo_list(None) == [])
real_http, real_fail, real_say = worker._http_json, worker.fail, worker.say
said = []
worker.say = lambda m: said.append(m)


class Failed(Exception):
    pass


def boom(m):
    raise Failed(m)


worker.fail = boom
try:
    worker._http_json = lambda url, *a, **k: {"VedaSparseAttention": {"input": {"required": {"predictor": [L]}}}}
    gr, _ = worker.apply_video_accel(h3(), {"veda": "on"})
    worker._veda_resolve("http://x", gr)
    check("resolve: a reference graph + both predictors listed -> the R2VA one, logged", gr["h3veda"]["inputs"]["predictor"] == L[1] and any("veda: predictor" in s for s in said), gr["h3veda"])
    worker._http_json = lambda url, *a, **k: {"VedaSparseAttention": {"input": {"required": {"predictor": [[]]}}}}
    try:
        worker._veda_resolve("http://x", worker.apply_video_accel(h3(), {"veda": "on"})[0])
        check("resolve: no predictor -> fail with the catalog download", False)
    except Failed as e:
        check("resolve: no predictor in models/veda -> it says where to get it (the model catalog) or to turn Veda off",
              "Model catalog" in str(e) and "Veda predictor (MiniMax H3)" in str(e) and "Off" in str(e), str(e))
    worker._http_json = lambda url, *a, **k: {}
    gm, _ = worker.apply_video_accel(h3(), {"veda": "on"})
    worker._veda_resolve("http://x", gm)
    check("resolve: the pack missing -> left for schema sync to name the install", gm["h3veda"]["inputs"]["predictor"] == worker.VEDA_DEFAULT_PREDICTOR)
finally:
    worker._http_json, worker.fail, worker.say = real_http, real_fail, real_say
# ---- against the stub ComfyUI over HTTP (scripts/stub-comfy.py serves VedaSparseAttention's schema)
import socket
import time


def free_port():
    with socket.socket() as so:
        so.bind(("127.0.0.1", 0))
        return so.getsockname()[1]


def stub(env_extra):
    port = free_port()
    env = dict(os.environ, **env_extra)
    pr = subprocess.Popen([sys.executable, os.path.join(HERE, "stub-comfy.py"), str(port), "/tmp/stub-veda536-out"], env=env,
                          stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    base = f"http://127.0.0.1:{port}"
    for _ in range(50):
        try:
            if worker._http_json(base + "/system_stats", timeout=1):
                break
        except Exception:                                    # noqa: BLE001
            time.sleep(0.1)
    return pr, base


pr, base = stub({})
worker.say = lambda m: said.append(m)
try:
    said.clear()
    gh, _ = worker.apply_video_accel(h3(), {"veda": "on"})
    worker._veda_resolve(base, gh)
    gh = worker._schema_sync(base, gh)
    vi = gh["h3veda"]["inputs"]
    check("stub ComfyUI: the listed predictor is used, schema sync keeps the sparsity strings, nothing reported missing",
          vi["predictor"] == worker.VEDA_DEFAULT_PREDICTOR and vi["generated_sparsity"] == "90%" and gh["3"]["inputs"]["model"] == ["h3veda", 0], vi)
finally:
    pr.terminate()
    worker.say = real_say
pr, base = stub({"STUB_VEDA_EMPTY": "1"})
worker.fail = boom
try:
    try:
        worker._veda_resolve(base, worker.apply_video_accel(h3(), {"veda": "on"})[0])
        check("stub ComfyUI with no predictor downloaded: the render stops with where to get it", False)
    except Failed as e:
        check("stub ComfyUI with no predictor downloaded: the render stops with where to get it", "Veda predictor (MiniMax H3)" in str(e), str(e))
finally:
    pr.terminate()
    worker.fail = real_fail

src = open(os.path.join(ROOT, "worker.py"), encoding="utf-8").read()
check("the render calls _veda_resolve right after the accelerators go in", "_veda_resolve(base, g)          # 2.536.0" in src
      and src.index("_veda_resolve(base, g)          # 2.536.0") > src.index("g, anotes = apply_video_accel(g, vstyle.get(\"accel\"))"))

# ---- styles, the arch, the catalog, the installer, the page
js = r'''
const S = require("./lib/styles.js"), C = require("./lib/comfy.js"), fs = require("fs");
const n = (a) => S.normVideoAccel ? S.normVideoAccel(a) : null;
const arch = JSON.parse(fs.readFileSync("lib/videoArch.json", "utf8")).archs;
const cat = JSON.parse(fs.readFileSync("lib/modelCatalog.json", "utf8")).models.find((m) => m.id === "veda_h3");
console.log(JSON.stringify({ modes: S.VIDEO_VEDA_MODES, h3: (arch.find((a) => a.accel && a.accel.veda) || {}).id, others: arch.filter((a) => a.accel && a.accel.veda).length, cat,
  pip: [C.pipArgsFor("", null, "win32", "triton>=3.2\n# c\nsafetensors\n-r other.txt\n"), C.pipArgsFor("", "3.3", "linux", "triton>=3.2"), C.pipArgsFor("", "3.4", "win32", "")] }));
'''
out = json.loads(subprocess.check_output(["node", "-e", js], cwd=ROOT, text=True, stderr=subprocess.DEVNULL).strip().splitlines()[-1])
check("styles: VIDEO_VEDA_MODES off / on / quality", out["modes"] == ["off", "on", "quality"], out["modes"])
check("videoArch: only the MiniMax H3 arch offers Veda", out["others"] == 1 and out["h3"], out)
c = out["cat"] or {}
check("model catalog: Veda predictor (MiniMax H3) -> ComfyUI/models/veda from Veda-Sparse/Minimax-H3-T2VA-Veda-8NFE-600Step-Preview (275 MB)",
      c.get("dest") == "comfy/veda" and c.get("repo") == "Veda-Sparse/Minimax-H3-T2VA-Veda-8NFE-600Step-Preview"
      and c.get("file") == "minimax_h3_t2va_veda_8nfe_600step_preview_fp8.safetensors" and c.get("size") == 275000000, c)
check("installer pip step: requirements lines; Windows: triton -> triton-windows (and added when no triton); Linux keeps triton",
      out["pip"][0] == ["triton-windows", "safetensors"] and out["pip"][1] == ["triton>=3.2"] and out["pip"][2] == [], out["pip"])
nv = subprocess.check_output(["node", "-e", r'''
const src = require("fs").readFileSync("lib/styles.js", "utf8");
const m = src.match(/function normVideoAccel\(v\) \{[\s\S]*?\n\}/)[0];
const VIDEO_SAGE_MODES = ["off", "auto"], VIDEO_SPECTRUM_MODES = ["off", "on"], VIDEO_VEDA_MODES = ["off", "on", "quality"];
const f = eval("(" + m.replace("function normVideoAccel", "function") + ")");
console.log(JSON.stringify([f({ sage: "auto", veda: "on", veda_predictor: " my/r2va.safetensors " }), f({ veda: "off", veda_predictor: "x" }), f({ veda: "warp" }), f({})]));
'''], cwd=ROOT, text=True).strip()
a = json.loads(nv)
check("normVideoAccel: veda kept only when on (+ its predictor, trimmed); off / unknown / absent = the old shape",
      a[0] == {"sage": "auto", "spectrum": "off", "veda": "on", "veda_predictor": "my/r2va.safetensors"} and a[1] == {"sage": "off", "spectrum": "off"}
      and a[2] == {"sage": "off", "spectrum": "off"} and a[3] == {"sage": "off", "spectrum": "off"}, a)
cj = open(os.path.join(ROOT, "lib", "comfy.js"), encoding="utf-8").read()
check("lib/comfy.js: the veda pack (veda-sparse/Veda-on-ComfyUI, pip: true) - clone, then pip", '"https://github.com/veda-sparse/Veda-on-ComfyUI.git"' in cj and "pip: true" in cj and "pipArgsFor(target, st.triton, process.platform)" in cj)
html = open(os.path.join(ROOT, "static", "index.html"), encoding="utf-8").read()
check("the page: Veda in a video style (off / on / quality + a predictor field), shown for H3 only; saved and loaded",
      'id="s_vsveda"' in html and 'id="s_vsvedapred"' in html and '$("s_vsvedabox").style.display = ac.veda' in html
      and 'veda: $("s_vsveda") ? $("s_vsveda").value : "off"' in html and '$("s_vsveda").value = vac.veda || "off"' in html)
check("…and ⬇ Install Veda under Settings -> ComfyUI -> Video accelerators (status label + install blurb)",
      'id="s_vapack_veda"' in html and 'id="s_vapacklbl_veda"' in html and '["kjnodes", "yusu", "veda", "dlss5"]' in html and "Veda-on-ComfyUI into custom_nodes" in html)

print(f"\n{PASS} passed, {FAIL} failed")
print("RESULT: " + ("FAIL" if FAIL else "PASS") + f" ({PASS} passed, {FAIL} failed)")
sys.exit(1 if FAIL else 0)
