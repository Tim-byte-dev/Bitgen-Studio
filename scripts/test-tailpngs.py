#!/usr/bin/env python3
"""bitGen Studio — 2.313.0: the take's last 2 s as high-res PNGs.
Tim: "save the last 2 seconds of the video as 1080p png, and use one of
those frames to continue the video or first frame for next video ... save
the png's to song name\\scene_<n>\\song name_scene_<n>_x.png. add option in
video docker settings for png size, upscaler dropdown.
https://docs.comfy.org/tutorials/basic/upscale"
  1. plan / names / the ffmpeg command / the upscale graph (the docs'
     LoadImage -> UpscaleModelLoader -> ImageUpscaleWithModel -> SaveImage +
     ImageScale to the size);
  2. LIVE lanczos: a 100-frame clip whose frame k is gray level 2k -> 48
     PNGs at 1920x1080, x = 1..48 in time order, the last is the clip's last
     frame, tail.json right, an old set cleared first;
  3. the ComfyUI path with a fake server: every frame uploaded, queued with
     the upscale graph, fetched in order; a failure falls back to lanczos,
     said; a clip shorter than 2 s gives what it has;
  4. the worker wiring.
Run from repo root: python3 scripts/test-tailpngs.py"""
import json, shutil, subprocess, sys, tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
import tailpngs as tp  # noqa: E402

FAILED = []


def check(name, cond, extra=""):
    print(("PASS: " if cond else "FAIL: ") + name + ("" if cond else f" {extra}"))
    if not cond:
        FAILED.append(name)


# ---- 1. the pieces -------------------------------------------------------------------------
check("plan: the last 2 s of 124 frames = frames 76..123 (48)", tp.plan(124) == (76, 48), tp.plan(124))
check("...a 30-frame take gives all 30", tp.plan(30) == (0, 30), tp.plan(30))
check("names: <stem>_1..<stem>_N.png", tp.names("Song_scene_3", 3) == ["Song_scene_3_1.png", "Song_scene_3_2.png", "Song_scene_3_3.png"])
g = tp.graph("tail_7.png", "4x-ESRGAN.pth", 1920, 1080, "bitgen_tail/x_7")
cls = {k: v["class_type"] for k, v in g.items()}
check("the upscale graph is the docs' chain + ImageScale to the size",
      sorted(cls.values()) == sorted(["LoadImage", "UpscaleModelLoader", "ImageUpscaleWithModel", "ImageScale", "SaveImage"])
      and g["1"]["inputs"]["image"] == "tail_7.png" and g["2"]["inputs"]["model_name"] == "4x-ESRGAN.pth"
      and g["3"]["inputs"] == {"upscale_model": ["2", 0], "image": ["1", 0]}
      and (g["4"]["inputs"]["width"], g["4"]["inputs"]["height"], g["4"]["inputs"]["upscale_method"]) == (1920, 1080, "lanczos")
      and g["5"]["inputs"]["images"] == ["4", 0] and g["5"]["inputs"]["filename_prefix"] == "bitgen_tail/x_7", g)

# ---- 2. LIVE lanczos --------------------------------------------------------------------------
tmp = Path(tempfile.mkdtemp())
try:
    clip = tmp / "take.avi"
    # frame k of a 100-frame clip: gray level 2k (exact in FFV1 / rgb)
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "lavfi", "-i", "color=c=black:s=64x36:r=24:d=5",
                    "-vf", "geq=r='2*N':g='2*N':b='2*N'", "-frames:v", "100", "-c:v", "ffv1", "-pix_fmt", "bgr0", str(clip)],
                   check=True)
    d = tmp / "Song" / "scene_4"
    d.mkdir(parents=True)
    (d / "Song_scene_4_99.png").write_bytes(b"old")
    (d / "keep.txt").write_text("not ours")
    said = []
    run_cmd = lambda c: subprocess.run(c).returncode

    def probe(p):
        r = subprocess.run(["ffprobe", "-v", "error", "-count_frames", "-select_streams", "v:0", "-show_entries",
                            "stream=nb_read_frames", "-of", "csv=p=0", str(p)], capture_output=True, text=True)
        return int(r.stdout.strip() or -1)
    spec = {"dir": str(d), "stem": "Song_scene_4", "width": 1920, "height": 1080, "upscaler": "", "seconds": 2, "fps": 24}
    m = tp.run(spec, clip, "scene4.mp4", say=said.append, run_cmd=run_cmd, probe_frames=probe)
    pngs = sorted(p.name for p in d.glob("*.png"))

    def px(p):
        b = subprocess.check_output(["ffmpeg", "-loglevel", "error", "-i", str(p), "-vf", "crop=1:1:960:540",
                                     "-f", "rawvideo", "-pix_fmt", "rgb24", "-"])
        return b[0]
    wh = subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "stream=width,height", "-of", "csv=p=0",
                                  str(d / "Song_scene_4_48.png")], text=True).strip()
    check("LIVE: 48 PNGs Song_scene_4_1..48.png (the old 99 cleared, other files kept), at 1920x1080",
          len(pngs) == 48 and "Song_scene_4_99.png" not in pngs and (d / "keep.txt").exists() and wh == "1920,1080",
          (len(pngs), wh))
    check("LIVE: in time order - PNG 1 is frame 52, PNG 48 the clip's LAST frame (99)",
          abs(px(d / "Song_scene_4_1.png") - 104) <= 2 and abs(px(d / "Song_scene_4_48.png") - 198) <= 2,
          (px(d / "Song_scene_4_1.png"), px(d / "Song_scene_4_48.png")))
    meta = json.loads((d / "tail.json").read_text())
    check("LIVE: tail.json names the take, the window (from frame 52 = 2.1667 s), the size and how",
          meta["take"] == "scene4.mp4" and meta["first_index"] == 52 and meta["count"] == 48
          and abs(meta["time_from"] - 52 / 24) < 1e-3 and (meta["width"], meta["height"]) == (1920, 1080)
          and meta["upscaler"] == "lanczos" and meta["source"] == "take.avi" and meta["files"][0] == "Song_scene_4_1.png", meta)
    check("...and says it", any("48 PNG(s) of the last 2.0s at 1920x1080 (lanczos)" in s for s in said), said)

    # ---- 3. the ComfyUI path (a fake server) ---------------------------------------------------
    calls = {"upload": 0, "queue": [], "fetch": 0}

    def fetch(item, dest):
        calls["fetch"] += 1
        shutil.copyfile(item["src"], dest)
    comfy = {"upload": lambda p: (calls.__setitem__("upload", calls["upload"] + 1), p.name)[1],
             "queue": lambda gr: (calls["queue"].append(gr), f"pid{len(calls['queue'])}")[1],
             "wait": lambda pid: {"5": {"images": [{"src": str(tmp / "native_up.png")}]}},
             "fetch": fetch}
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "lavfi", "-i", "color=c=red:s=1920x1080", "-frames:v", "1",
                    str(tmp / "native_up.png")], check=True)
    spec2 = dict(spec, upscaler="4x-ESRGAN.pth")
    m2 = tp.run(spec2, clip, "scene4.mp4", say=said.append, run_cmd=run_cmd, probe_frames=probe, comfy=comfy)
    check("ComfyUI path: 48 uploads, 48 prompts with the model and the size, 48 fetches in order, meta says the model",
          calls["upload"] == 48 and len(calls["queue"]) == 48 and calls["fetch"] == 48
          and calls["queue"][0]["2"]["inputs"]["model_name"] == "4x-ESRGAN.pth"
          and calls["queue"][5]["5"]["inputs"]["filename_prefix"] == "bitgen_tail/Song_scene_4_6"
          and m2 and m2["upscaler"] == "4x-ESRGAN.pth" and len(list(d.glob("*.png"))) == 48
          and not any(p.name.startswith(".native") for p in d.iterdir()), (calls["upload"], len(calls["queue"]), m2 and m2["upscaler"]))
    bad = dict(comfy, wait=lambda pid: (_ for _ in ()).throw(RuntimeError("boom")))
    m3 = tp.run(spec2, clip, "scene4.mp4", say=said.append, run_cmd=run_cmd, probe_frames=probe, comfy=bad)
    check("...a failing upscale falls back to lanczos for the whole set, said",
          m3 and m3["upscaler"] == "lanczos" and m3["count"] == 48 and any("lanczos for the tail instead" in s for s in said), m3)
    # ---- 2.314.0: SeedVR2 (Tim's own workflow) ------------------------------------------------
    S = json.loads((ROOT / "comfy_workflows" / "utility_seedvr2_7b_int8_upscale_image_api.json").read_text())
    gs = tp.graph_seedvr2("f1.png", 1280, 720, 1920, 1080, "bitgen_tail/x_1")
    check("SeedVR2: Tim's export ships verbatim (SeedVR2Preprocess / Conditioning / PostProcessing, 7B int8 + its VAE)",
          {v["class_type"] for v in S.values()} >= {"SeedVR2Preprocess", "SeedVR2Conditioning", "SeedVR2PostProcessing",
                                                   "ResizeImageMaskNode", "KSampler", "SaveImage", "LoadImage"}
          and S["66:52"]["inputs"]["unet_name"] == "seedvr2_7b_int8_convrot.safetensors"
          and S["66:51"]["inputs"]["vae_name"] == "seedvr2_ema_vae_fp16.safetensors")
    check("...per frame: the frame in, the multiplier that reaches the size (1280x720 -> 1920x1080 = 1.5), a fixed seed, the prefix; the UI-only ImageCompare dropped; the rest untouched",
          gs["1"]["inputs"]["image"] == "f1.png" and gs["66:57"]["inputs"]["resize_type.multiplier"] == 1.5
          and gs["66:57"]["inputs"]["resize_type"] == "scale by multiplier"
          and gs["66:54"]["inputs"]["seed"] == tp.SEEDVR2_SEED and gs["9"]["inputs"]["filename_prefix"] == "bitgen_tail/x_1"
          and "65" not in gs and tp.save_node(gs) == "9" and gs["66:59"] == S["66:59"] and gs["66:61"] == S["66:61"], gs.get("66:57"))
    check("...a portrait frame reaches its long target too (720x1280 -> 1080x1920 = 1.5)",
          tp.graph_seedvr2("f.png", 720, 1280, 1080, 1920, "p")["66:57"]["inputs"]["resize_type.multiplier"] == 1.5)
    calls2 = {"queue": [], "fetch": 0}
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "lavfi", "-i", "color=c=green:s=1928x1088", "-frames:v", "1",
                    str(tmp / "seed_out.png")], check=True)

    def fetch2(item, dest):
        calls2["fetch"] += 1
        shutil.copyfile(item["src"], dest)
    comfy2 = {"upload": lambda p: p.name,
              "queue": lambda gr: (calls2["queue"].append(gr), f"s{len(calls2['queue'])}")[1],
              "wait": lambda pid: {"9": {"images": [{"src": str(tmp / "seed_out.png")}]}},
              "fetch": fetch2}
    m5 = tp.run(dict(spec, upscaler="seedvr2"), clip, "scene4.mp4", say=said.append, run_cmd=run_cmd,
                probe_frames=probe, comfy=comfy2)
    q0 = calls2["queue"][0] if calls2["queue"] else {}
    check("...the tail with SeedVR2: 48 of Tim's graphs queued (64x36 frames -> multiplier 30), read back from ITS SaveImage (9), fitted to exactly 1920x1080",
          len(calls2["queue"]) == 48 and calls2["fetch"] == 48 and q0.get("66:57", {}).get("inputs", {}).get("resize_type.multiplier") == 30.0
          and m5 and m5["upscaler"] == "seedvr2" and tp.png_size(d / "Song_scene_4_17.png") == (1920, 1080)
          and not any(p.name.startswith(".fit_") for p in d.iterdir())
          and any("SeedVR2 7B (your ComfyUI workflow)" in x for x in said), (len(calls2["queue"]), m5 and m5["upscaler"]))
    short = tmp / "short.avi"
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "lavfi", "-i", "color=c=blue:s=64x36:r=24:d=1",
                    "-c:v", "ffv1", str(short)], check=True)
    m4 = tp.run(dict(spec, stem="Song_scene_5"), short, "scene5.mp4", say=said.append, run_cmd=run_cmd, probe_frames=probe)
    check("...a 1 s take gives its 24 frames", m4 and m4["count"] == 24 and m4["first_index"] == 0, m4)
finally:
    shutil.rmtree(tmp, ignore_errors=True)

# ---- 4. the worker ----------------------------------------------------------------------------
W = (ROOT / "misc" / "worker.py").read_text()
check("worker: the tail runs after the take (and its master) are final, before 'render complete', from the master when there is one",
      "import tailpngs as _tp" in W and "_tail_pngs(params, cfg, final, raw_dir)       # 2.313.0" in W
      and W.index("_tail_pngs(params, cfg, final, raw_dir)       # 2.313.0") < W.index("render complete: {final.name}")
      and "src = master if master is not None and master.exists() else final" in W
      and 'comfy=_tail_comfy(cfg) if spec.get("upscaler") else None' in W)

print(f"\nRESULT: {len(FAILED)} failed")
sys.exit(1 if FAILED else 0)
