#!/usr/bin/env python3
"""bitGen Studio — 3.11.2: a pi-H3 render on a ComfyUI that has not loaded the ComfyUI-piFlow nodes is stopped BEFORE queueing
with what to do (scripts/pih3.py missing + info's version / reached, scripts/comfy_missing.py note), ComfyUI's own
"missing_node_type" rejection says the same (misc/worker.py), and the 16 GB note no longer blames RunPod on a pi-H3 render.
Tim's log: "rejected: missing_node_type Node 'pi-H3 2-step DWD adapter' not found. The custom node may not be installed." +
"16 GB mode: not used on a RunPod endpoint" (on 127.0.0.1)."""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
import pih3          # noqa: E402
import comfy_missing as cm  # noqa: E402

passed = failed = 0


def check(name, ok, got=None):
    global passed, failed
    if ok:
        passed += 1
        print("PASS: " + name)
    else:
        failed += 1
        print("FAIL: " + name + ("" if got is None else "\n      got " + str(got)[:600]))


wf = json.loads((ROOT / "comfy_workflows" / "pi_h3_dwd_2step.json").read_text(encoding="utf-8"))
used = {v.get("class_type") for v in wf.values() if isinstance(v, dict)}
check("the shipped pi-H3 workflow uses the pack's own class names (ComfyUI-piFlow's NODE_CLASS_MAPPINGS: 'Load LakonLab Adapter', 'pi-Flow Scheduler', 'DWD Decode')",
      set(pih3.PACK_NODES) <= used, used)
none = {"reached": True, "classes": {}, "version": "0.46.2"}
check("missing: the pack's nodes this graph uses that ComfyUI has not loaded", pih3.missing(wf, none) == list(pih3.PACK_NODES), pih3.missing(wf, none))
check("…none when they are loaded", pih3.missing(wf, {"reached": True, "classes": {c: {} for c in pih3.PACK_NODES}}) == [])
check("…none when ComfyUI could not be asked (ComfyUI then says it itself)", pih3.missing(wf, {"reached": False, "classes": {}}) == [])
n = cm.note("Load LakonLab Adapter", "pi-H3 2-step DWD adapter", "0.46.2")
check("note: names the node by its title AND class, the pack (ComfyUI-piFlow), restart ComfyUI, where bitGen installs it, IMPORT FAILED",
      "'pi-H3 2-step DWD adapter' (Load LakonLab Adapter)" in n and "ComfyUI-piFlow" in n and "Restart ComfyUI" in n and "π pi-H3" in n and "IMPORT FAILED" in n and "update ComfyUI" not in n, n)
o = cm.note("DWD Decode", "", "0.44.9")
check("…a ComfyUI older than the pack needs (0.45): update it first (Settings ▸ ComfyUI ▸ Engine ▸ ⤓ Update ComfyUI)", "needs ComfyUI 0.45.0 or newer and this one is 0.44.9" in o and "⤓ Update ComfyUI" in o, o)
g = cm.note("SomeOtherNode", "My node", "")
check("…a node of another pack: install it (ComfyUI Manager), restart, IMPORT FAILED; the workflow itself is fine", "ComfyUI Manager" in g and "restart ComfyUI" in g and "workflow itself is fine" in g, g)
check("version_tuple", cm.version_tuple("v0.45.1") == (0, 45, 1) and cm.version_tuple("0.46") < cm.version_tuple("0.46.1") and cm.version_tuple("") == ())
wk = (ROOT / "misc" / "worker.py").read_text(encoding="utf-8")
check("the worker stops a pi-H3 render before queueing when its nodes are not loaded (the pack, what to do)", "pmiss = _pi.missing(g, pinf)" in wk and 'fail("pi-H3: " + (hint or _cm.note(pmiss[0], ttl, pinf.get("version")))' in wk)
check("…ComfyUI's missing_node_type rejection explained (not 'fix them in the template')", 'if err.get("type") == "missing_node_type":' in wk and "_cm.note(ct, xi.get(\"node_title\")" in wk)
check("…the 16 GB note says RunPod only on RunPod, pi-H3 on a pi-H3 render", 'elif rp and _vram16_cfg(cfg)["mode"] != "off":' in wk and "16 GB mode: not used for pi-H3" in wk)
print(f"\n{passed} passed, {failed} failed")
print(f"RESULT: {failed} failed")
sys.exit(1 if failed else 0)
