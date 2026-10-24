#!/usr/bin/env python3
"""bitGen Studio — 2.353.0: video and sound reference slots for an H3 reference graph.
Run: python3 scripts/test-refslots.py

Tim: "for video generation from prompt the h3_Video_ref workflow doesn't use video reference, can we add
video and sound slots when a reference video and/or sound is added".
  1. scripts/refslots.py: a ref2va graph saved with pictures only gets LoadVideo (+ its own sound through
     GetVideoComponents) and LoadAudio slots for the references given (at most 3 each); a graph that has
     slots, and a graph without an H3 reference node, are left alone;
  2. worker.py through the stub ComfyUI: that graph renders with the video + sound filled; a render with
     ONLY a reference video (no picture) works in ref2va; routes/index.js: Text mode with a reference video /
     sound goes through ref2va, Reference mode needs a picture, video or sound.
"""
import copy
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
import refslots as RS     # noqa: E402

P = F = 0


def check(name, ok, extra=None):
    global P, F
    if ok:
        P += 1
        print("PASS: " + name)
    else:
        F += 1
        print("FAIL: " + name + ("" if extra is None else " :: " + json.dumps(extra, default=str)[:600]))


full = json.loads((ROOT / "comfy_workflows" / "ref2va.json").read_text())
bare = copy.deepcopy(full)
for k in ("160", "161", "162", "170", "171", "172", "165", "166", "167"):
    bare.pop(k)
for k in list(bare["136"]["inputs"]):
    if "video" in k or "ref_audios" in k:
        bare["136"]["inputs"].pop(k)

# ---- 1. the helper
g = copy.deepcopy(bare)
notes = RS.add_missing(g, 2, 1)
ins = g["136"]["inputs"]
check("a pictures-only ref2va graph: 2 video slots (LoadVideo + its sound via GetVideoComponents) and 1 sound slot added, said",
      ins["ref_videos.ref_video_1"][0] in g and g[ins["ref_videos.ref_video_0"][0]]["class_type"] == "LoadVideo"
      and g[ins["ref_video_audios.ref_video_audio_0"][0]]["class_type"] == "GetVideoComponents" and ins["ref_video_audios.ref_video_audio_0"][1] == 1
      and g[ins["ref_audios.ref_audio_0"][0]]["class_type"] == "LoadAudio" and "ref_audios.ref_audio_1" not in ins
      and len(notes) == 2 and "no video reference slot - added 2" in notes[0], notes)
g = copy.deepcopy(bare)
RS.add_missing(g, 7, 5)
check("at most 3 videos and 3 sounds (the model's limit)", sum(k.startswith("ref_videos.") for k in g["136"]["inputs"]) == 3
      and sum(k.startswith("ref_audios.") for k in g["136"]["inputs"]) == 3)
g = copy.deepcopy(full)
check("a graph with its own slots is left alone (the worker's clone step grows it)", RS.add_missing(g, 3, 3) == [] and g == full)
g = copy.deepcopy(bare)
check("no references given -> nothing added", RS.add_missing(g, 0, 0) == [] and g == bare)
g = copy.deepcopy(bare)
g["900"] = {"class_type": "VHS_LoadAudioUpload", "inputs": {"audio": "voice.wav"}}
before = copy.deepcopy(g)
notes = RS.add_missing(g, 1, 1)
check("a graph that loads sound ANYWHERE (the MM3 chain's VHS_LoadAudioUpload voices) gets no sound slot - only the missing video one",
      "ref_audios.ref_audio_0" not in g["136"]["inputs"] and "ref_videos.ref_video_0" in g["136"]["inputs"] and len(notes) == 1, notes)
fl = {"1": {"class_type": "MiniMaxH3ImageToVideo", "inputs": {"prompt": "x"}}}
check("a graph without an H3 reference node (fl2va) is left alone; takes_av says which graph can take them",
      RS.add_missing(fl, 1, 1) == [] and not RS.takes_av(fl) and RS.takes_av(bare))

# ---- 2. worker.py + the generate route
if not (shutil.which("ffmpeg") and shutil.which("node")):
    print("(ffmpeg / node missing - the worker checks are skipped)")
else:
    tmp = Path(tempfile.mkdtemp(prefix="refslots_"))
    ff = lambda *a: subprocess.run(["ffmpeg", "-y", "-loglevel", "error", *a], check=True)  # noqa: E731
    ff("-f", "lavfi", "-i", "testsrc2=size=320x180:rate=24", "-f", "lavfi", "-i", "sine=frequency=440", "-t", "3",
       "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", str(tmp / "clip.mp4"))
    ff("-f", "lavfi", "-i", "sine=frequency=300", "-t", "3", str(tmp / "voice.wav"))
    ff("-f", "lavfi", "-i", "color=c=red:size=256x256", "-frames:v", "1", str(tmp / "pic.png"))
    (tmp / "bare.json").write_text(json.dumps(bare))
    port = 8391
    stub = subprocess.Popen([sys.executable, str(ROOT / "scripts" / "stub-comfy.py"), str(port), str(tmp / "stub")],
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    for _ in range(40):
        try:
            urllib.request.urlopen(f"http://127.0.0.1:{port}/system_stats", timeout=1)
            break
        except Exception:                                   # noqa: BLE001
            time.sleep(0.25)
    cfg = json.loads(subprocess.run(["node", "-e", f"process.stdout.write(JSON.stringify(require({json.dumps(str(ROOT / 'lib' / 'core'))}).resolvedConfig()))"],
                                    capture_output=True, text=True, cwd=str(ROOT)).stdout)
    cfg["engine"]["backend"] = "comfy"
    cfg["engine"]["comfy"]["url"] = f"http://127.0.0.1:{port}"
    style = {"name": "H3_Video_Ref", "kind": "video", "arch": "minimax-h3", "workflow": str(tmp / "bare.json"), "workflows": {},
             "loras": [], "phases": [{"model": ""}]}

    def work(params):
        wd = Path(tempfile.mkdtemp(prefix="wj_", dir=tmp))
        (wd / "job.json").write_text(json.dumps({"params": params, "config": cfg, "app_dir": str(ROOT), "models_dir": str(ROOT / "models"),
                                                 "output_dir": str(tmp / "out")}))
        r = subprocess.run([sys.executable, str(ROOT / "misc" / "worker.py"), "job.json"], cwd=wd, capture_output=True, text=True, timeout=600,
                           env=dict(os.environ, H3_ENGINE="comfy"))
        run = json.loads((tmp / "bare_tmp.json").read_text()) if (tmp / "bare_tmp.json").exists() else {}
        return r.returncode, r.stdout, run
    base = {"prompt": "<Picture 1> walks like <Video 1>", "mode": "ref2va", "frames": 48, "width": 480, "height": 288, "steps": 4, "seed": 3,
            "format": "mp4", "pipeline": "auto", "video_style": style, "trim_exact": True}
    code, log, run = work(dict(base, reference_files=[str(tmp / "pic.png")], ref_videos=[str(tmp / "clip.mp4")], ref_audios=[str(tmp / "voice.wav")]))
    n = (run.get("136") or {}).get("inputs") or {}
    vid = n.get("ref_videos.ref_video_0") or [""]
    check("worker: H3_Video_Ref's graph saved without video / sound slots now takes the reference video + sound (was: '0 video slot(s), ignored')",
          code == 0 and "slots filled: 1/9 image, 1/1 video, 1/1 audio" in log and "no video reference slot - added 1" in log
          and "extra reference(s) ignored" not in log and "ref_audios.ref_audio_0" in n and vid[0] in run, (code, log[-1500:]))
    code, log, run = work(dict(base, prompt="walks like <Video 1>", reference_files=[], ref_videos=[str(tmp / "clip.mp4")]))
    check("worker: ref2va with ONLY a reference video (no picture) renders", code == 0 and "slots filled: 0/9 image, 1/1 video" in log, (code, log[-800:]))
    code, log, run = work(dict(base, reference_files=[], ref_videos=[]))
    check("worker: ref2va with nothing at all is still refused in words", code != 0 and "ref2va needs 1-9 reference images" in log, log[-300:])
    stub.terminate()
    stub.wait()
    shutil.rmtree(tmp, ignore_errors=True)

IDX = (ROOT / "routes" / "index.js").read_text(encoding="utf-8")
check("routes/index: Text mode with a reference video / sound goes through ref2va (said on the job); Reference mode needs a picture, video or sound",
      'if (mode === "t2va" && hasAv) {' in IDX and 'mode = "ref2va";' in IDX
      and '"ref2va needs at least one reference image, video or sound"' in IDX and 'const notes = [modeNote, speechNote, frameOp && frameOp.note, ...camNotes].filter(Boolean).join(" · ");' in IDX)   # 2.399.0: + the camera notes   # 2.388.0: + the Append / Prepend note   # 2.364.0: + the speech note
W = (ROOT / "misc" / "worker.py").read_text(encoding="utf-8")
check("worker.py: the slots are added before the fill; an fl2va render on a reference graph uploads its video / sound too",
      "for n in _rs.add_missing(g, len(videos), len(audios), {c: k[0] for c, k in LOADER_KINDS.items()}):" in W and "or (_rs is not None and _rs.takes_av(g or {})))" in W)
print(f"RESULT: {P} passed, {F} failed")
sys.exit(1 if F else 0)
