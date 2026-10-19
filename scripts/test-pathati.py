#!/usr/bin/env python3
"""bitGen Studio — 2.387.0: Wan 2.1 ATI (a subject travelling a DRAWN PATH) in scripts/wan_graph.py.
Run: python3 scripts/test-pathati.py
Tim: "can we add a paths layer, then generate parts of the scene on each path layer so animals, cars, people can be
rendered separately" - per layer "Along the path (Wan ATI)"."""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import wan_graph as WG  # noqa: E402

P = F = 0


def check(name, ok, got=None):
    global P, F
    if ok:
        P += 1
        print("PASS: " + name)
    else:
        F += 1
        print("FAIL: " + name + ("" if got is None else " :: %r" % (got,)))


check("ati is a Wan mode", "ati" in WG.MODES)
names = ["wan2.1_i2v_720p_14B_fp8_e4m3fn.safetensors", "Wan2_1-I2V-ATI-14B_fp8_e4m3fn.safetensors", "wan2.1_t2v_14B_fp8_e4m3fn.safetensors"]
a = WG.pick_models(names, "wan21", "ati")
i = WG.pick_models(names, "wan21", "i2v")
check("pick_models: the ATI file for ati (its name also says I2V)", a.get("models") == ["Wan2_1-I2V-ATI-14B_fp8_e4m3fn.safetensors"], a)
check("...and NEVER the ATI file for a plain i2v", i.get("models") == ["wan2.1_i2v_720p_14B_fp8_e4m3fn.safetensors"], i)
none = WG.pick_models(names[:1], "wan21", "ati")
check("...no ATI file: says which one to download", "Wan2_1-I2V-ATI-14B" in (none.get("error") or ""), none)

track = [{"x": 10 + i * 10, "y": 300 - i * 2} for i in range(30)]
r = WG.resample(track)
check("resample: any number of points -> exactly 121, the ends kept, evenly in time", len(r) == WG.ATI_POINTS == 121
      and r[0] == {"x": 10.0, "y": 300.0} and r[-1] == {"x": 300.0, "y": 242.0} and abs(r[60]["x"] - 155.0) < 1e-6, (r[0], r[60], r[-1]))
tj = json.loads(WG.tracks_json([track, [{"x": -50, "y": 10}, {"x": 9999, "y": 10}], [{"x": 1, "y": 1}]], 832, 480))
check("tracks_json: a JSON list of tracks of {x, y}, every track 121 points, kept inside the frame, a 1-point track dropped",
      len(tj) == 2 and all(len(t) == 121 for t in tj) and tj[1][0]["x"] == 0.0 and tj[1][-1]["x"] == 831.0, [len(t) for t in tj])
o = {"family": "wan21", "mode": "ati", "prompt": "a fox trots along its path", "width": 832, "height": 480, "frames": 81, "seed": 7,
     "models": ["Wan2_1-I2V-ATI-14B_fp8_e4m3fn.safetensors"], "images": {"start": "path_start.png"}, "tracks": [track]}
g, notes = WG.build(o)
cls = {v["class_type"]: k for k, v in g.items()}
tt = g[cls["WanTrackToVideo"]]["inputs"] if "WanTrackToVideo" in cls else {}
check("build ati: WanTrackToVideo with the start picture, CLIP vision of it, the tracks (121 points), 220 / 2",
      "WanTrackToVideo" in cls and tt.get("start_image") and tt.get("clip_vision_output") and len(json.loads(tt["tracks"])[0]) == 121
      and tt["temperature"] == 220.0 and tt["topk"] == 2 and tt["width"] == 832 and tt["height"] == 480 and tt["length"] == 81, tt)
ks = g[cls["KSampler"]]["inputs"]
check("...its conditioning and latent feed the sampler; the note says the paths", ks["positive"][0] == cls["WanTrackToVideo"]
      and ks["latent_image"] == [cls["WanTrackToVideo"], 2] and any("ATI" in n for n in notes), notes)
for bad, why in ((dict(o, family="wan22", models=["a", "b"]), "Wan 2.1"), (dict(o, images={}), "start picture"), (dict(o, tracks=[]), "path")):
    try:
        WG.build(bad)
        check("refused: " + why, False)
    except ValueError as e:
        check("refused in words: " + why, why in str(e), str(e))
print("\nRESULT: %d passed, %d failed" % (P, F))
sys.exit(1 if F else 0)
