#!/usr/bin/env python3
"""bitGen Studio — 2.401.1: scripts/clean_workflows.py (the shipped workflows' default media made neutral).
Tim: "set all default images, videos and sound in workflows to 0 or comfy fairy . it must all be cleaned before i can
upload the repo".
  1. an API export: LoadImage -> example.png, LoadVideo / LoadAudio -> "0"; model / VAE names, links, numbers, a
     multi-line note mentioning a .png, a "video/mp4" format - untouched; the layout of a hand-written file kept;
  2. a UI export: widgets_values lists, a VHS preview dict (filename, fullpath C:\\..., subfolder, type -> input);
  3. --check: exit 1 + the file named while one is left, 0 once clean; a second clean changes nothing;
  4. the shipped comfy_workflows/ as packaged: the build cleans them (scripts/clean_workflows.py) - checked here on a
     copy, so a gate that rewrites the *_tmp run graphs does not count against it.
Run from repo root: python3 scripts/test-cleanworkflows.py"""
import json
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
import clean_workflows as CW  # noqa: E402

FAILED = []


def check(name, cond, extra=""):
    print(("PASS: " if cond else "FAIL: ") + name + ("" if cond else f" {extra}"))
    if not cond:
        FAILED.append(name)


T = Path(tempfile.mkdtemp(prefix="cw401_"))
try:
    api_txt = '''{
  "1": { "class_type": "LoadImage", "inputs": { "image": "Gemini_Generated_Image_1nsw.png" } },
  "2": { "class_type": "LoadVideo", "inputs": { "file": "Wizard_and_hobbit_on_wall.mp4" } },
  "3": { "class_type": "LoadAudio", "inputs": { "audio": "BVoice_00001.flac" } },
  "4": { "class_type": "UNETLoader", "inputs": { "unet_name": "minimax_h3_ref2va.safetensors", "weight_dtype": "default" } },
  "5": { "class_type": "Note", "inputs": { "text": "put your picture.png\\nin the input folder" } },
  "6": { "class_type": "SaveVideo", "inputs": { "video": ["2", 0], "format": "video/mp4", "filename_prefix": "video/out" } },
  "7": { "class_type": "LoadImage", "inputs": { "image": "example.png" } }
}
'''
    (T / "api.json").write_text(api_txt, encoding="utf-8")
    ui = {"nodes": [
        {"id": 1, "type": "LoadImage", "widgets_values": ["ChatGPT Image Aug 9, 2026 (2).png", "image"]},
        {"id": 2, "type": "VHS_LoadVideo", "widgets_values": {"video": "Female DJ 10s.mp4", "force_rate": 0, "videopreview": {
            "hidden": False, "paused": False, "params": {"filename": "ltx_00188.mp4", "subfolder": "test", "type": "output",
                                                         "format": "video/h264-mp4", "fullpath": "C:\\SD\\ComfyUI\\output\\test\\ltx_00188.mp4"}}}},
        {"id": 3, "type": "LoadAudio", "widgets_values": ["Parisian Reverie.mp3", None, None]},
        {"id": 4, "type": "VAELoader", "widgets_values": ["ltx-2.5-video-vae-bf16.safetensors"]}]}
    (T / "ui.json").write_text(json.dumps(ui, indent=2), encoding="utf-8")

    rc = subprocess.run([sys.executable, str(ROOT / "scripts" / "clean_workflows.py"), "--check", str(T)], capture_output=True, text=True)
    check("--check before: exit 1, both files named, nothing changed",
          rc.returncode == 1 and "api.json" in rc.stdout and "ui.json" in rc.stdout and (T / "api.json").read_text() == api_txt, rc.stdout)
    r = subprocess.run([sys.executable, str(ROOT / "scripts" / "clean_workflows.py"), str(T)], capture_output=True, text=True)
    a = json.loads((T / "api.json").read_text())
    check("API export: the picture -> example.png, the video / the sound -> 0",
          a["1"]["inputs"]["image"] == "example.png" and a["2"]["inputs"]["file"] == "0" and a["3"]["inputs"]["audio"] == "0", a)
    check("API export: model name, the note's text, a link, 'video/mp4', the prefix, an already-neutral example.png untouched",
          a["4"]["inputs"]["unet_name"] == "minimax_h3_ref2va.safetensors" and a["5"]["inputs"]["text"] == "put your picture.png\nin the input folder"
          and a["6"]["inputs"] == {"video": ["2", 0], "format": "video/mp4", "filename_prefix": "video/out"} and a["7"]["inputs"]["image"] == "example.png", a)
    txt = (T / "api.json").read_text()
    check("the hand-written layout kept (one node per line, only the names swapped)",
          txt.count("\n") == api_txt.count("\n") and '"1": { "class_type": "LoadImage", "inputs": { "image": "example.png" } },' in txt, txt)
    u = json.loads((T / "ui.json").read_text())
    vp = u["nodes"][1]["widgets_values"]["videopreview"]["params"]
    check("UI export: widgets -> example.png / 0; the VHS preview's filename + fullpath (C:\\...) -> 0, subfolder '', type input; the VAE kept",
          u["nodes"][0]["widgets_values"][0] == "example.png" and u["nodes"][1]["widgets_values"]["video"] == "0"
          and vp == {"filename": "0", "subfolder": "", "type": "input", "format": "video/h264-mp4", "fullpath": "0"}
          and u["nodes"][2]["widgets_values"][0] == "0" and u["nodes"][3]["widgets_values"][0] == "ltx-2.5-video-vae-bf16.safetensors", u)
    r2 = subprocess.run([sys.executable, str(ROOT / "scripts" / "clean_workflows.py"), str(T)], capture_output=True, text=True)
    rc2 = subprocess.run([sys.executable, str(ROOT / "scripts" / "clean_workflows.py"), "--check", str(T)], capture_output=True, text=True)
    check("a second clean changes nothing; --check after: exit 0 'clean'",
          "cleaned 0 media default(s)" in r2.stdout and rc2.returncode == 0 and "RESULT: clean" in rc2.stdout, (r2.stdout, rc2.stdout))
    # 4 the shipped set, as the build packs it
    shutil.copytree(ROOT / "comfy_workflows", T / "cw")
    CW.run([str(T / "cw")], check=False, say=lambda *_: None)
    left = CW.run([str(T / "cw")], check=True, say=lambda *_: None)
    bad = [p for p in (T / "cw").rglob("*.json") if "C:\\\\SD" in p.read_text(encoding="utf-8") or "E:\\\\ComfyUI_Sell" in p.read_text(encoding="utf-8")]
    check("comfy_workflows/ as the build packs it: every media default neutral, no C:\\SD / E:\\ComfyUI_Sell paths left",
          not left and not bad, (list(left)[:5], bad[:5]))
finally:
    shutil.rmtree(T, ignore_errors=True)

print(f"\nRESULT: {len(FAILED)} failed")
sys.exit(1 if FAILED else 0)
