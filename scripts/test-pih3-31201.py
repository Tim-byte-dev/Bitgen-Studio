#!/usr/bin/env python3
"""bitGen Studio — 3.12.1: when a pi-H3 render stops because ComfyUI has not loaded the ComfyUI-piFlow nodes, the worker says WHICH
case it is (scripts/comfy_missing.py piflow_report): an OLD ComfyUI-piFlow loaded (the pi-H3 nodes came in 1.4.0), the copy and
its version in custom_nodes, ComfyUI's own "IMPORT FAILED" console lines, or that it is not in custom_nodes at all.
Tim's log (after restarting ComfyUI): "this ComfyUI has not loaded the node 'pi-H3 4-step DWD adapter' (Load LakonLab Adapter)" """
import os
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
import comfy_missing as cm  # noqa: E402

passed = failed = 0


def check(name, ok, got=None):
    global passed, failed
    if ok:
        passed += 1
        print("PASS: " + name)
    else:
        failed += 1
        print("FAIL: " + name + ("" if got is None else "\n      got " + str(got)[:700]))


def copy(cn, name, version, pih3, git=False):
    d = Path(cn) / name
    d.mkdir(parents=True, exist_ok=True)
    (d / "pyproject.toml").write_text(f'[project]\nname = "comfyui-piflow"\nversion = "{version}"\n', encoding="utf-8")
    (d / "__init__.py").write_text('NODE_CLASS_MAPPINGS = {"Load pi-Flow Model": 1' + (', "Load LakonLab Adapter": 2' if pih3 else "") + "}\n", encoding="utf-8")
    if git:
        (d / ".git").mkdir(exist_ok=True)
    return d


with tempfile.TemporaryDirectory() as t:
    app = Path(t) / "bitgen"
    comfy = app / "ComfyUI"
    cn = comfy / "custom_nodes"
    cn.mkdir(parents=True)
    copy(cn, "comfyui-piflow", "1.3.6", False)
    copy(cn, "ComfyUI-other", "9.9", True)
    copy(cn, "ComfyUI-piFlow.old-1.2.0.disabled", "1.2.0", False)
    check("custom_nodes_dirs: the ComfyUI beside the app when Settings names none; the folder Settings names when it does",
          cm.custom_nodes_dirs({}, app) == [str(cn)] and cm.custom_nodes_dirs({"engine": {"comfy": {"dir": str(comfy)}}}, "/nowhere") == [str(cn)]
          and cm.custom_nodes_dirs({"engine": {"comfy": {"dir": "/no/such"}}}, app) == [], cm.custom_nodes_dirs({}, app))
    cp = cm.piflow_copies([str(cn)])
    check("piflow_copies: the registry's comfyui-piflow (1.3.6, no git, no pi-H3 nodes); not other packs, not *.disabled",
          len(cp) == 1 and cp[0]["name"] == "comfyui-piflow" and cp[0]["version"] == "1.3.6" and not cp[0]["git"] and not cp[0]["pih3"], cp)

    info_old = {"reached": True, "version": "0.46.0", "classes": {"Load pi-Flow Model": {}, "pi-Flow Sampler": {}}}
    h = cm.piflow_report({}, app, info_old, lambda: [])
    check("an OLD ComfyUI-piFlow loaded: said so, the copy + its version + not a git copy, the 1.4.0 / 20 Nov 2026 cut, how to update, restart",
          "loaded an OLD ComfyUI-piFlow" in h and "1.4.0 (20 Nov 2026)" in h and "comfyui-piflow (version 1.3.6, not a git copy)" in h
          and "π pi-H3 ▸ Install" in h and ".disabled" in h and "ComfyUI-Manager" in h and "restart ComfyUI" in h, h)
    h2 = cm.piflow_report({}, app, {"reached": True, "classes": {}}, lambda: [])
    check("…not loaded at all, but the copy there is old: the same advice (update it)", "OLD ComfyUI-piFlow" in h2 and "1.3.6" in h2, h2)

    logs = [{"t": "1", "m": "Traceback (most recent call last):"},
            {"t": "2", "m": f"Cannot import {cn}/comfyui-piflow module for custom nodes: No module named 'comfy.ldm.minimax'"},
            {"t": "3", "m": "   0.1 seconds (IMPORT FAILED): " + str(cn / "comfyui-piflow")},
            {"t": "4", "m": "   0.0 seconds: " + str(cn / "ComfyUI-other")}]
    lf = cm.load_failures(logs)
    check("load_failures: ComfyUI's console lines about the pack not importing (not other packs)",
          len(lf) == 2 and "No module named 'comfy.ldm.minimax'" in lf[0] and "IMPORT FAILED" in lf[1], lf)
    h3 = cm.piflow_report({}, app, {"reached": True, "classes": {}}, lambda: logs)
    check("…an import failure comes first: its words quoted, update ComfyUI / a missing package, restart", h3.startswith("ComfyUI-piFlow did not import")
          and "No module named 'comfy.ldm.minimax'" in h3 and "update ComfyUI" in h3 and "restart ComfyUI" in h3, h3)
    check("…a ComfyUI without the log endpoint: no crash, the other words", cm.piflow_report({}, app, info_old, lambda: (_ for _ in ()).throw(OSError("404"))).startswith("this ComfyUI loaded an OLD"))

    # a good copy that is not loaded
    (cn / "comfyui-piflow").rename(cn / "comfyui-piflow.old-1.3.6.disabled")
    copy(cn, "ComfyUI-piFlow", "1.4.2", True, git=True)
    h4 = cm.piflow_report({}, app, {"reached": True, "classes": {}}, None)
    check("a 1.4+ copy there but not loaded: where it is, restart, is the ComfyUI you run this one, IMPORT FAILED",
          "ComfyUI-piFlow (version 1.4.2, a git copy)" in h4 and "Restart ComfyUI" in h4 and "the one in that folder" in h4 and "IMPORT FAILED" in h4, h4)
    # none there
    (cn / "ComfyUI-piFlow").rename(cn / "x.disabled")
    h5 = cm.piflow_report({}, app, {"reached": True, "classes": {}}, None)
    check("none in custom_nodes: says where it is missing and that Install puts it there", f"is not in {cn}" in h5 and "π pi-H3 ▸ Install" in h5, h5)
    check("a remote ComfyUI (no folder here, nothing in its console): \"\" - the plain note is used",
          cm.piflow_report({"engine": {"comfy": {"dir": "/no/such"}}}, app, {"reached": True, "classes": {}}, None) == "")

pi = (ROOT / "scripts" / "pih3.py").read_text(encoding="utf-8")
wk = (ROOT / "misc" / "worker.py").read_text(encoding="utf-8")
check("pih3.info also asks ComfyUI for piFlow's older nodes (an old copy loaded?)", '"Load pi-Flow Model", "pi-Flow Sampler", "ModelSamplingPiFlow"' in pi and "PACK_NODES + old" in pi)
check("the worker uses piflow_report (the folder, ComfyUI's console) before the plain note",
      "_cm.piflow_report(cfg, Path(__file__).resolve().parent.parent, pinf," in wk and "_cc._log_entries(base)" in wk and 'fail("pi-H3: " + (hint or _cm.note(' in wk)
print(f"\n{passed} passed, {failed} failed")
print(f"RESULT: {failed} failed")
sys.exit(1 if failed else 0)
