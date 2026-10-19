#!/usr/bin/env python3
"""bitGen Studio — 2.305.0: the VIDEO -> IMAGE link repair.
Tim (Scene 7): "rejected: prompt_outputs_failed_validation ... node 136
(MiniMaxH3ReferenceToVideo) input 'ref_videos.ref_video_0': Return type
mismatch between linked nodes ref_videos.ref_video_0, received_type(VIDEO)
mismatch input_type(IMAGE)".
  1. mismatches() reads ComfyUI's own refusal (details and extra_info shapes);
  2. repair() splits the link through GetVideoComponents (frames = output 0),
     shares one split per video, leaves anything else alone;
  3. on the real MMH3_NativeAudio_MV export (converted from its .ui.json) and
     the official ref2va.json;
  4. the worker wiring: one repair, then one re-queue.
Run from repo root: python3 scripts/test-typefix.py"""
import copy, json, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
import comfy_typefix as tf  # noqa: E402

FAILED = []


def check(name, cond, extra=""):
    if cond:
        print(f"PASS: {name}")
    else:
        FAILED.append(name)
        print(f"FAIL: {name} {extra}")


TIM = {"136": {"errors": [{
    "type": "return_type_mismatch",
    "message": "Return type mismatch between linked nodes",
    "details": "ref_videos.ref_video_0, received_type(VIDEO) mismatch input_type(IMAGE)",
    "extra_info": {"input_name": "ref_videos.ref_video_0", "received_type": "VIDEO"}}]}}

# ---- 1. reading the refusal ---------------------------------------------------------
m = tf.mismatches(TIM)
check("Tim's refusal reads as (136, ref_videos.ref_video_0, VIDEO, IMAGE)",
      m == [("136", "ref_videos.ref_video_0", "VIDEO", "IMAGE")], m)
noinfo = {"9": {"errors": [{"message": "Return type mismatch between linked nodes",
                            "details": "ref_videos.ref_video_1, received_type(VIDEO) mismatch input_type(IMAGE)"}]}}
check("...the input name comes from details when extra_info is missing",
      tf.mismatches(noinfo) == [("9", "ref_videos.ref_video_1", "VIDEO", "IMAGE")], tf.mismatches(noinfo))
other = {"73": {"errors": [{"message": "Value not in list", "details": "model: 'x' not in [...]"}]}}
check("...other refusals are not mismatches", tf.mismatches(other) == [] and tf.mismatches(None) == [])

# ---- 2. the repair --------------------------------------------------------------------
G = {"136": {"class_type": "MiniMaxH3ReferenceToVideo",
             "inputs": {"ref_videos.ref_video_0": ["156", 0], "ref_videos.ref_video_1": ["157", 0],
                        "prompt": "p"}},
     "156": {"class_type": "LoadVideo", "inputs": {"file": "scene7_prev_tail.mp4"}},
     "157": {"class_type": "LoadVideo", "inputs": {"file": "b.mp4"}}}
g = copy.deepcopy(G)
notes = tf.repair(g, m)
sid = g["136"]["inputs"]["ref_videos.ref_video_0"][0]
check("repair: ref_video_0 now takes GetVideoComponents' FRAMES (output 0), which reads the LoadVideo",
      g[sid]["class_type"] == "GetVideoComponents" and g[sid]["inputs"]["video"] == ["156", 0]
      and g["136"]["inputs"]["ref_videos.ref_video_0"] == [sid, 0], g)
check("...only the refused input is touched, the note names it",
      g["136"]["inputs"]["ref_videos.ref_video_1"] == ["157", 0] and len(notes) == 1
      and "ref_videos.ref_video_0" in notes[0] and "GetVideoComponents" in notes[0], notes)
g2 = copy.deepcopy(G)
g2["136"]["inputs"]["ref_videos.ref_video_1"] = ["156", 0]
both = m + [("136", "ref_videos.ref_video_1", "VIDEO", "IMAGE")]
tf.repair(g2, both)
splits = [k for k, v in g2.items() if v["class_type"] == "GetVideoComponents"]
check("...one video feeding two refused slots gets ONE split", len(splits) == 1, splits)
g3 = copy.deepcopy(G)
check("...a non-VIDEO mismatch, a missing link or an already-split source is left alone",
      tf.repair(g3, [("136", "ref_videos.ref_video_0", "LATENT", "IMAGE")]) == []
      and tf.repair(g3, [("136", "nope", "VIDEO", "IMAGE")]) == [] and g3 == G)
g4 = copy.deepcopy(G)
g4["bgvsplit_156"] = {"class_type": "Other", "inputs": {}}
tf.repair(g4, m)
check("...a taken id is never overwritten", g4["bgvsplit_156"]["class_type"] == "Other"
      and g4["136"]["inputs"]["ref_videos.ref_video_0"][0] == "bgvsplit_156_2", list(g4))
g5 = copy.deepcopy(G)
tf.repair(g5, [("136", "ref_videos.ref_video_0", "VIDEO", "AUDIO")])
check("...a VIDEO on an AUDIO input takes the split's audio (output 1)",
      g5["136"]["inputs"]["ref_videos.ref_video_0"][1] == 1)

# ---- 3. the real exports ----------------------------------------------------------------
# the export's own link, read from its .ui.json (the API base is converted
# against the live /object_info at first ▶ - the link survives as is)
ui = json.loads((ROOT / "comfy_workflows" / "MMH3_NativeAudio_MV.ui.json").read_text())
nodes = {n["id"]: n for n in ui["nodes"]}
lk = {l[0]: l for l in ui["links"]}
gen = next(n for n in ui["nodes"] if n["type"] == "MiniMaxH3ReferenceToVideo")
slot = next(i for i in gen["inputs"] if i["name"] == "ref_videos.ref_video_0")
src = nodes[lk[slot["link"]][1]]
api = {str(gen["id"]): {"class_type": gen["type"], "inputs": {"ref_videos.ref_video_0": [str(src["id"]), 0]}},
       str(src["id"]): {"class_type": src["type"], "inputs": {"file": "scene7_prev_tail.mp4"}}}
notes = tf.repair(api, [(str(gen["id"]), "ref_videos.ref_video_0", "VIDEO", "IMAGE")])
new = api[str(gen["id"])]["inputs"]["ref_videos.ref_video_0"]
check("MMH3_NativeAudio_MV: its export wires LoadVideo straight into ref_video_0 (Tim's refusal) - split",
      src["type"] == "LoadVideo" and gen["id"] == 136
      and api[new[0]]["class_type"] == "GetVideoComponents" and len(notes) == 1, (src["type"], new))
off = json.loads((ROOT / "comfy_workflows" / "ref2va.json").read_text())
fx = [("136", f"ref_videos.ref_video_{i}", "VIDEO", "IMAGE") for i in range(3)]
notes = tf.repair(off, fx)
check("the official ref2va.json: all three ref videos split, the audio splits it already had kept",
      len(notes) == 3 and all(off[off["136"]["inputs"][f"ref_videos.ref_video_{i}"][0]]["class_type"]
                              == "GetVideoComponents" for i in range(3))
      and off["136"]["inputs"]["ref_video_audios.ref_video_audio_0"] == ["170", 1], notes)

# ---- 4. the worker ----------------------------------------------------------------------
W = (ROOT / "worker.py").read_text()
check("worker: imports the helper, repairs ONCE per job and re-queues, else reports as before",
      "import comfy_typefix as _tf" in W
      and 'typefix = {"done": False}' in W
      and 'fixes = _tf.repair(graph, _tf.mismatches(resp.get("node_errors")))' in W
      and "return _attempt(graph)" in W
      and W.index("return _attempt(graph)") < W.index('fail("ComfyUI rejected the workflow - the node errors above name the "'))

print(f"\nRESULT: {len(FAILED)} failed")
sys.exit(1 if FAILED else 0)
