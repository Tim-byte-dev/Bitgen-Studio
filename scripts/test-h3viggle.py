#!/usr/bin/env python3
"""bitGen Studio — 2.352.0: the H3_Viggle style, the worker side.
Run: python3 scripts/test-h3viggle.py

Tim: "I have looks at the h3ref workflow, we should have a fl2va workflow too, can we incorporate viggle
into these worklows but make it a new viggle workflow?" - the scene's motion video drives, the sheet
(ref2va) or the first frame (fl2va) performs, rendered by ComfyUI's Viggle model.
  1. scripts/h3viggle.py: the picture per mode, the frame counts, the motion cut (offset, size, the
     held last frame, its audio), the graph fill, the words when something is missing;
  2. worker.py through the stub ComfyUI: a ref2va scene, an fl2va scene, a long clip in two chunks
     (chunk 2 cuts the motion from where chunk 1 stopped), no motion video = refused in words.
"""
import json
import os
import shutil
import subprocess
import sys
import tempfile
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
import h3viggle as HV     # noqa: E402

P = F = 0


def check(name, ok, extra=None):
    global P, F
    if ok:
        P += 1
        print("PASS: " + name)
    else:
        F += 1
        print("FAIL: " + name + ("" if extra is None else " :: " + json.dumps(extra, default=str)[:600]))


tmp = Path(tempfile.mkdtemp(prefix="h3vg_"))
ff = lambda *a: subprocess.run(["ffmpeg", "-y", "-loglevel", "error", *a], check=True)  # noqa: E731
probe = lambda f, e="stream=nb_read_frames,width,height": subprocess.run(  # noqa: E731
    ["ffprobe", "-v", "error", "-count_frames", "-select_streams", "v:0", "-show_entries", e, "-of", "csv=p=0", str(f)],
    capture_output=True, text=True).stdout.strip()
has_audio = lambda f: "audio" in subprocess.run(["ffprobe", "-v", "error", "-show_entries", "stream=codec_type", "-of", "csv=p=0", str(f)],  # noqa: E731
                                                capture_output=True, text=True).stdout
long = tmp / "long.mp4"
ff("-f", "lavfi", "-i", "testsrc2=size=640x360:rate=24", "-t", "18", "-c:v", "libx264", "-pix_fmt", "yuv420p", str(long))
motion = tmp / "dance.mp4"
ff("-f", "lavfi", "-i", "testsrc2=size=640x360:rate=30", "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=44100",
   "-t", "8", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", str(motion))
sheet = tmp / "sheet.png"
ff("-f", "lavfi", "-i", "testsrc2=size=256x256", "-frames:v", "1", str(sheet))
first = tmp / "first.png"
ff("-f", "lavfi", "-i", "color=c=red:size=256x256", "-frames:v", "1", str(first))

# ---- 1. the helper
wf = {v: json.loads((ROOT / "comfy_workflows" / f"H3_Viggle_{v}.json").read_text()) for v in ("ref2va", "fl2va")}
check("the two workflows: Tim's Viggle graph, the comparison taken out, marked H3_Viggle ref2va / fl2va",
      all(HV.is_viggle(g) and g["_bitgen"]["style"] == "H3_Viggle" and g["_bitgen"]["variant"] == v and "29" not in g and "30" not in g
          for v, g in wf.items()))
check("the picture: ref2va = the first reference (the others said), fl2va = the first frame",
      HV.picture_for("ref2va", ["a.png", "b.png"], None)[0] == "a.png" and "1 more reference(s) left out" in HV.picture_for("ref2va", ["a.png", "b.png"], None)[1]
      and HV.picture_for("fl2va", ["a.png"], "f.png")[0] == "f.png")
for mode, refs, ff_, want in (("ref2va", [], None, "needs a character sheet or picture"), ("fl2va", [], None, "needs the scene's first frame")):
    try:
        HV.picture_for(mode, refs, ff_)
        check(f"no picture ({mode}) -> refused in words", False)
    except ValueError as e:
        check(f"no picture ({mode}) -> refused in words", want in str(e), str(e))
check("frames: 17n+5, at least 124 (Viggle), at most 362", HV.render_frames(48) == 124 and HV.render_frames(130) == 141
      and HV.render_frames(400) == 362 and HV.render_frames(141) == 141)
out, words = HV.cut_motion(motion, 48, 124, 480, 288, tmp / "cut.mp4")
check("the motion cut: from its offset, 24 fps, the render size (cover + centre crop), its audio kept",
      probe(out) == "480,288,124" and has_audio(out) and "from 2.00 s, 124 frames at 480x288" in words and "held" not in words, (probe(out), words))
out, words = HV.cut_motion(motion, 120, 141, 480, 288, tmp / "cut2.mp4")
check("...a clip that ends first: its last frame held to the length", probe(out) == "480,288,141" and "its last frame is held" in words, (probe(out), words))
try:
    HV.cut_motion(motion, 24 * 9, 124, 480, 288, tmp / "cut3.mp4")
    check("...an offset past the clip's end -> refused in words", False)
except RuntimeError as e:
    check("...an offset past the clip's end -> refused in words", "past its end" in str(e), str(e))
sent = []
g, n, notes = HV.prepare(wf["fl2va"], {"seg_mode": "fl2va", "refs": [str(sheet)], "first_frame": str(first), "motion": str(motion),
                                         "offset": 0, "frames": 48, "width": 480, "height": 288, "seed": 5, "steps": 3,
                                         "loras": [{"path": "style.safetensors", "weight": 0.7}], "workdir": str(tmp)},
                         lambda p: sent.append(Path(p).name) or "up_" + Path(p).name)
c = [v for v in g.values() if v["class_type"] == "ViggleAnimateConditioning"][0]["inputs"]
img = [v for v in g.values() if v["class_type"] == "LoadImage"][0]["inputs"]["image"]
vid = [v for v in g.values() if v["class_type"] == "VHS_LoadVideo"][0]["inputs"]
check("prepare (fl2va): the first frame performs, the motion cut is the driving clip, 124 frames at 480x288, the 3-step sigmas, "
      "the style's LoRA after the DMD one, fp16 accumulation off",
      n == 124 and (c["width"], c["height"], c["length"]) == (480, 288, 124) and img == "up_first.png" and vid["video"] == "up_motion_000000.mp4"
      and vid["frame_load_cap"] == 124 and any(v["class_type"] == "LoraLoaderModelOnly" and v["inputs"]["lora_name"] == "style.safetensors" for v in g.values())
      and all(v["inputs"]["enable_fp16_accumulation"] is False for v in g.values() if v["class_type"] == "ModelPatchTorchSettings")
      and any("the first frame first.png performs the motion dance.mp4" in x for x in notes)
      and any("the plan trims the take to 48" in x for x in notes), notes)
for o, want in (({"motion": None}, "needs the scene's motion video"), ({"width": 500}, "multiples of 32")):
    base = {"seg_mode": "ref2va", "refs": [str(sheet)], "motion": str(motion), "frames": 48, "width": 480, "height": 288}
    base.update(o)
    try:
        HV.prepare(wf["ref2va"], base, lambda p: p)
        check(f"prepare refuses: {want}", False)
    except (ValueError, RuntimeError) as e:
        check(f"prepare refuses: {want}", want in str(e), str(e))

# ---- 2. worker.py through the stub ComfyUI
if not (shutil.which("ffmpeg") and shutil.which("node")):
    print("(ffmpeg / node missing - the worker checks are skipped)")
else:
    port = 8393
    stub = subprocess.Popen([sys.executable, str(ROOT / "scripts" / "stub-comfy.py"), str(port), str(tmp / "stub")],
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    for _ in range(40):
        try:
            urllib.request.urlopen(f"http://127.0.0.1:{port}/system_stats", timeout=1)
            break
        except Exception:                                    # noqa: BLE001
            time.sleep(0.25)
    cfg = json.loads(subprocess.run(["node", "-e", f"process.stdout.write(JSON.stringify(require({json.dumps(str(ROOT / 'lib' / 'core'))}).resolvedConfig()))"],
                                    capture_output=True, text=True, cwd=str(ROOT)).stdout)
    cfg["engine"]["backend"] = "comfy"
    cfg["engine"]["comfy"]["url"] = f"http://127.0.0.1:{port}"
    style = {"name": "H3_Viggle", "kind": "video", "arch": "minimax-h3",
             "workflows": {"ref2va": "comfy_workflows/H3_Viggle_ref2va.json", "fl2va": "comfy_workflows/H3_Viggle_fl2va.json"},
             "loras": [], "phases": [{"model": ""}]}

    def work(params):
        wd = Path(tempfile.mkdtemp(prefix="wj_", dir=tmp))
        out = tmp / "out"
        (wd / "job.json").write_text(json.dumps({"params": params, "config": cfg, "app_dir": str(ROOT), "models_dir": str(ROOT / "models"),
                                                 "output_dir": str(out)}))
        env = dict(os.environ, H3_ENGINE="comfy")
        r = subprocess.run([sys.executable, str(ROOT / "misc" / "worker.py"), "job.json"], cwd=wd, capture_output=True, text=True, timeout=900, env=env)
        name = next((ln[6:].strip() for ln in r.stdout.splitlines() if ln.startswith("@@OUT ")), "")
        (tmp / f"log_{wd.name}.txt").write_text(r.stdout + r.stderr)
        return r.returncode, r.stdout, (out / name if name else None)

    base = {"prompt": "dance", "width": 480, "height": 288, "steps": 0, "seed": 9, "format": "mp4", "pipeline": "auto",
            "video_style": style, "viggle": True, "trim_exact": True, "raw_master": False}
    code, log, f = work(dict(base, mode="ref2va", frames=48, reference_files=[str(sheet)], ref_videos=[str(motion)]))
    check("worker ref2va: the H3_Viggle ref2va graph, the sheet performs the motion, 124 rendered -> 48 kept, the clip's audio on, "
          "no H3 patching (no prompt / reference nodes looked for)",
          code == 0 and f and f.exists() and probe(f).endswith(",48") and has_audio(f)
          and "video style \"H3_Viggle\": workflow H3_Viggle_ref2va.json for ref2va" in log
          and "H3_Viggle ref2va: the picture sheet.png performs the motion dance.mp4 from 0.00 s, 124 frames at 480x288" in log
          and "extracting frames from reference video" not in log and "fp16 accumulation off" in log, (code, log[-1500:]))
    code, log, f = work(dict(base, mode="fl2va", frames=48, reference_files=[str(first)], ref_videos=[str(motion)]))
    check("worker fl2va: the H3_Viggle fl2va graph, the first frame performs",
          code == 0 and probe(f).endswith(",48") and "workflow H3_Viggle_fl2va.json for fl2va" in log
          and "H3_Viggle fl2va: the first frame first.png performs the motion dance.mp4" in log, (code, log[-1200:]))
    code, log, f = work(dict(base, mode="ref2va", frames=400, reference_files=[str(sheet)], ref_videos=[str(long)]))
    check("worker, a long clip in two chunks: chunk 2 (fl2va, the hand-off frame performs) cuts the motion from where chunk 1 stopped "
          "(a motion clip without audio is fine)",
          code == 0 and probe(f).endswith(",400") and "plan=[362, 39]" in log and "the picture sheet.png performs the motion long.mp4 from 0.00 s, 362 frames" in log
          and "H3_Viggle fl2va: the first frame handoff_01.png performs the motion long.mp4 from 15.04 s, 124 frames" in log, (code, log[-1800:]))
    code, log, f = work(dict(base, mode="ref2va", frames=48, reference_files=[str(sheet)], ref_videos=[]))
    check("worker: no motion video -> refused in words", code != 0 and "H3_Viggle needs the scene's motion video" in log, log[-400:])
    stub.terminate()
    stub.wait()
    for v in ("ref2va", "fl2va"):                     # the run graphs the worker wrote beside the exports
        (ROOT / "comfy_workflows" / f"H3_Viggle_{v}_tmp.json").unlink(missing_ok=True)
print("TMP", tmp) if F else shutil.rmtree(tmp, ignore_errors=True)
print(f"RESULT: {P} passed, {F} failed")
sys.exit(1 if F else 0)
