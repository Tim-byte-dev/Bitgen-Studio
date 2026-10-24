#!/usr/bin/env python3
"""Unit tests for scripts/swap_graph.py (2.324.0, the character swap) -
the window / size rules, the graph patch against the SHIPPED workflow
(comfy_workflows/MiniMax_H3_Swap.json, Tim's minimax-h3-swap export), and
the ffmpeg cut + audio mux for real when ffmpeg is on PATH."""
import json
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
import swap_graph as SG  # noqa: E402

passed = failed = 0


def check(name, cond, detail=""):
    global passed, failed
    if cond:
        passed += 1
        print(f"  ok   {name}")
    else:
        failed += 1
        print(f"  FAIL {name} {detail}")


def raises(fn, needle):
    try:
        fn()
    except ValueError as e:
        return needle in str(e)
    return False


def links(g):
    return [(k, kk, v) for k, n in g.items() for kk, v in (n.get("inputs") or {}).items()
            if isinstance(v, list) and len(v) == 2 and isinstance(v[0], (str, int))]


# ---- the frame grid + the window
check("snap_down: 17k+5, never below 5", [SG.snap_down(x) for x in (0, 5, 21, 22, 100, 362, 400)]
      == [5, 5, 5, 22, 90, 362, 396])
w = SG.window(10.0)
check("window: blank = the whole video, snapped DOWN to 17k+5", w["frames"] == 226 and abs(w["dur"] - 226 / 24) < 1e-9, w)
w = SG.window(30.0, 2, 4)
check("window: start + duration", w["start"] == 2 and w["frames"] == 90, w)
check("window: the snap is said", any("17k+5" in n for n in w["notes"]), w["notes"])
w = SG.window(60.0, 0, 40)
check("window: longer than one run is capped at the ceiling and said",
      w["frames"] == 362 and any("longer than one run" in n for n in w["notes"]), w)
w = SG.window(60.0, 0, 40, ceiling=200)
check("window: the learned VRAM ceiling caps it too", w["frames"] == 192, w)
w = SG.window(5.0, 3, 9)
check("window: a duration past the end runs to the end, said",
      w["frames"] == 39 and any("to its end" in n for n in w["notes"]), w)
check("window: a start past the end is refused in words", raises(lambda: SG.window(5.0, 6), "past the end"))
check("window: no duration is refused", raises(lambda: SG.window(0), "no duration"))
check("window: a negative start is 0", SG.window(5.0, -3)["start"] == 0)

# ---- the size
check("size: 16:9 at 544", SG.size(1920, 1080, 544) == (960, 544), SG.size(1920, 1080, 544))
check("size: portrait keeps its aspect", SG.size(1080, 1920, 544) == (544, 960), SG.size(1080, 1920, 544))
check("size: 16-px aligned", all(v % 16 == 0 for v in SG.size(1000, 700, 540)))
check("size: no picture refused", raises(lambda: SG.size(0, 0, 544), "no picture size"))

# ---- the shipped workflow
wf = ROOT / "comfy_workflows" / "MiniMax_H3_Swap.json"
g0 = json.loads(wf.read_text(encoding="utf-8"))
check("the shipped swap graph is API format with the ref2va gen node",
      any(v.get("class_type") == SG.GEN for v in g0.values()))
g, notes = SG.patch(g0, "swap_clip.mp4", "hero.png", "PROMPT", 960, 544, 124, 7)
gen = next(v for v in g.values() if v.get("class_type") == SG.GEN)["inputs"]
check("patch: prompt / size / length written as plain values",
      gen["prompt"] == "PROMPT" and gen["width"] == 960 and gen["height"] == 544 and gen["length"] == 124, gen)
cls = {v.get("class_type") for v in g.values()}
check("patch: VideoInfo / the length math / the prompt box are dropped",
      not ({"VHS_VideoInfo", "ComfyMathExpression", "PrimitiveStringMultiline"} & cls), sorted(cls))
check("patch: nothing points at a dropped node", all(str(v[0]) in g for _, _, v in links(g)))
lv = next(v for v in g.values() if v.get("class_type") == "VHS_LoadVideo")["inputs"]
check("patch: the video loader reads the clip at 24 fps, the render size, `length` frames",
      lv["video"] == "swap_clip.mp4" and lv["force_rate"] == 24 and lv["frame_load_cap"] == 124
      and lv["custom_width"] == 960 and lv["custom_height"] == 544 and lv["skip_first_frames"] == 0, lv)
li = next(v for v in g.values() if v.get("class_type") == "LoadImage")["inputs"]
check("patch: LoadImage reads the character", li["image"] == "hero.png", li)
check("patch: the seed", next(v for v in g.values() if v.get("class_type") == "RandomNoise")["inputs"]["noise_seed"] == 7)
check("patch: the save prefix", next(v for v in g.values() if v.get("class_type") == "SaveVideo")["inputs"]["filename_prefix"] == "bitgen_swap")
check("patch: the input graph is untouched", any(v.get("class_type") == "VHS_VideoInfo" for v in g0.values()))
check("patch: the notes say the size / length", any("124 frames" in n for n in notes), notes)
check("patch: the LoRA loader and samplers stay", {"Power Lora Loader (rgthree)", "SamplerCustomAdvanced",
                                                   "VAEDecodeAudio", "CreateVideo"} <= cls)
# a core LoadVideo -> GetVideoComponents variant
g2 = {"1": {"class_type": "LoadVideo", "inputs": {"file": "x.mp4"}},
      "2": {"class_type": "GetVideoComponents", "inputs": {"video": ["1", 0]}},
      "3": {"class_type": "LoadImage", "inputs": {"image": "a.png"}},
      "4": {"class_type": SG.GEN, "inputs": {"ref_videos.ref_video_0": ["2", 0],
                                             "ref_images.ref_image_0": ["3", 0],
                                             "ref_images.ref_image_1": ["3", 0],
                                             "prompt": "", "width": 1, "height": 1, "length": 1}}}
g3, _ = SG.patch(g2, "c.mp4", "h.png", "p", 544, 960, 90, 1)
check("patch: a core LoadVideo is aimed through GetVideoComponents", g3["1"]["inputs"]["file"] == "c.mp4")
check("patch: GetVideoComponents is kept (it carries the frames)", "2" in g3)
check("patch: every other reference slot is emptied", "ref_images.ref_image_1" not in g3["4"]["inputs"])
check("patch: a graph with no gen node is refused in words",
      raises(lambda: SG.patch({"1": {"class_type": "LoadImage", "inputs": {}}}, "a", "b", "", 1, 1, 5, 0), "no MiniMaxH3ReferenceToVideo"))
check("patch: a gen node with no video loader is refused",
      raises(lambda: SG.patch({"1": {"class_type": SG.GEN, "inputs": {}}}, "a", "b", "", 1, 1, 5, 0), "video loader"))

# ---- ffmpeg: the cut and the audio mux, for real
if shutil.which("ffmpeg") and shutil.which("ffprobe"):
    with tempfile.TemporaryDirectory() as td:
        t = Path(td)
        src = t / "src.mp4"
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "lavfi", "-i", "testsrc=size=1280x720:rate=25:duration=6",
                        "-f", "lavfi", "-i", "sine=frequency=440:duration=6", "-shortest",
                        "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", str(src)], check=True)
        win = SG.window(6.0, 1, 3)
        W, H = SG.size(1280, 720, 544)
        clip = t / "clip.mp4"
        r = subprocess.run(SG.trim_args(src, clip, win["start"], win["dur"], win["frames"], W, H),
                           capture_output=True, text=True)
        check("ffmpeg: the cut runs", r.returncode == 0, r.stderr[-300:])

        def pr(p, what):
            return subprocess.check_output(["ffprobe", "-v", "error", "-count_frames", "-select_streams", "v:0",
                                            "-show_entries", what, "-of", "csv=p=0", str(p)], text=True).strip()
        check("ffmpeg: the clip has exactly `frames` frames at the render size",
              pr(clip, "stream=nb_read_frames") == str(win["frames"]) and pr(clip, "stream=width,height") == f"{W},{H}",
              (pr(clip, "stream=nb_read_frames"), pr(clip, "stream=width,height")))
        # a "swapped" render with DIFFERENT audio: the mux must put the clip's back
        sw = t / "swapped.mp4"
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "lavfi", "-i",
                        f"color=red:size={W}x{H}:rate=24:duration={win['dur']:.4f}", "-c:v", "libx264",
                        "-pix_fmt", "yuv420p", str(sw)], check=True)
        out = t / "out.mp4"
        r = subprocess.run(SG.mux_args(sw, clip, out, win["dur"]), capture_output=True, text=True)
        check("ffmpeg: the mux runs", r.returncode == 0, r.stderr[-300:])
        check("mux: an mp4 render is stream-copied; a webm is encoded once to H.264",
              "copy" in SG.mux_args(sw, clip, out, 1) and "libx264" in SG.mux_args(t / "x.webm", clip, out, 1))
        a = subprocess.check_output(["ffprobe", "-v", "error", "-select_streams", "a", "-show_entries",
                                     "stream=codec_type", "-of", "csv=p=0", str(out)], text=True)
        check("ffmpeg: the swapped take carries the ORIGINAL audio", "audio" in a)
        d = float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                                           "-of", "csv=p=0", str(out)], text=True).strip())
        check("ffmpeg: the take is the window's length", abs(d - win["dur"]) < 0.1, (d, win["dur"]))
else:
    print("  (ffmpeg not on PATH - the real cut / mux checks are skipped)")

# ---- 2.328.0: the mmh3_chr_swap STYLE's overrides in swap_worker.apply_style
import signal  # noqa: E402
sys.path.insert(0, str(ROOT)); sys.path.insert(0, str(ROOT / "misc"))
_argv = sys.argv
sys.argv = ["swap_worker.py"]
import swap_worker as SWK  # noqa: E402
sys.argv = _argv
check("swap_worker: importing worker.py leaves swap_worker's OWN SIGTERM handler (a cancel still exits)",
      getattr(signal.getsignal(signal.SIGTERM), "__module__", "") == "swap_worker")
base_g = json.loads((ROOT / "comfy_workflows" / "MiniMax_H3_Swap.json").read_text(encoding="utf-8"))
pg, _ = SG.patch(json.loads(json.dumps(base_g)), "clip.mp4", "hero.png", "p", 544, 960, 101, 7)
g0, n0 = SWK.apply_style(json.loads(json.dumps(pg)), None)
check("apply_style: no style = the graph untouched", g0 == pg and n0 == [])
g1, n1 = SWK.apply_style(json.loads(json.dumps(pg)),
                         {"name": "mmh3_chr_swap", "phases": [{"model": "", "steps": None, "cfg": None, "dtype": ""}],
                          "te": [""], "vae": "", "loras": [], "accel": {"sage": "off", "spectrum": "off"}})
check("apply_style: the starter (all blank) = the workflow's own models, said once", g1 == pg
      and any("workflow's own" in n for n in n1), n1)
g2, n2 = SWK.apply_style(json.loads(json.dumps(pg)),
                         {"name": "mine", "phases": [{"model": "h3_other.safetensors", "dtype": "fp8_e4m3fn"}],
                          "te": ["te2.safetensors"], "vae": "vae2.safetensors",
                          "loras": [{"path": "look.safetensors", "weight": 0.6}],
                          "accel": {"sage": "auto", "spectrum": "off"}})
unet = [n for n in g2.values() if n.get("class_type") == "UNETLoader"][0]["inputs"]
clip = [n for n in g2.values() if n.get("class_type") == "CLIPLoader"][0]["inputs"]
check("apply_style: model + load precision, text encoder, the video VAE (not the audio one), a LoRA, Sage",
      unet.get("unet_name") == "h3_other.safetensors" and unet.get("weight_dtype") == "fp8_e4m3fn"
      and clip.get("clip_name") == "te2.safetensors"
      and any(n.get("inputs", {}).get("vae_name") == "vae2.safetensors" for n in g2.values())
      and "h3lora1" in g2 and "h3sage" in g2 and all('style "mine"' in n for n in n2), n2)

# ---- 2.334.0: the swap stops ignoring the picture (Tim: "the character swap
# worked for the first 2 seconds of a video, then it wouldn't work at all ...
# it seems to not be using the reference image at all")
check("fix_tags: <Image n> -> <Picture n> (H3's own tag), any spacing / case",
      SG.fix_tags("put <Image 1> and < image 2 > in <Video 1>") == "put <Picture 1> and <Picture 2> in <Video 1>")
gt, nt = SG.patch(json.loads(json.dumps(g0)), "c.mp4", "h.png", "Swap <Video 1> for <Image 1>.", 960, 544, 124, 1)
gen = next(v for v in gt.values() if v.get("class_type") == SG.GEN)["inputs"]
check("patch: an old <Image 1> prompt reaches ComfyUI as <Picture 1>", gen["prompt"] == "Swap <Video 1> for <Picture 1>.", gen["prompt"])
check("patch: the picture goes in at ref_image_size max (the export said match)", gen["ref_image_size"] == "max", gen["ref_image_size"])
check("patch: the note names <Picture 1> and the size", any("<Picture 1> = h.png" in n and "max" in n for n in nt), nt)
gm, _ = SG.patch(json.loads(json.dumps(g0)), "c.mp4", "h.png", "<Picture 1>", 960, 544, 124, 1, ref_image_size="match")
check("patch: ref_image_size match on request; junk = max",
      next(v for v in gm.values() if v.get("class_type") == SG.GEN)["inputs"]["ref_image_size"] == "match"
      and next(v for v in SG.patch(json.loads(json.dumps(g0)), "c", "h", "", 960, 544, 124, 1, ref_image_size="huge")[0].values()
               if v.get("class_type") == SG.GEN)["inputs"]["ref_image_size"] == "max")
_, nn = SG.patch(json.loads(json.dumps(g0)), "c.mp4", "h.png", "a person dancing", 960, 544, 124, 1)
check("patch: a prompt that never names <Picture 1> is said", any("never names <Picture 1>" in n for n in nn), nn)
shipped = json.loads((ROOT / "comfy_workflows" / "MiniMax_H3_Swap.json").read_text(encoding="utf-8"))
txt = json.dumps(shipped)
check("the shipped swap workflow says <Picture 1>, never <Image 1>, and ref_image_size max",
      "<Image 1>" not in txt and "<Picture 1>" in txt and '"ref_image_size": "max"' in txt)
check("combo_list: every /object_info shape", SG.combo_list([["a", "b"], {}]) == ["a", "b"]
      and SG.combo_list(["COMBO", {"options": ["c"]}]) == ["c"] and SG.combo_list({"type": "COMBO", "options": ["d"]}) == ["d"]
      and SG.combo_list("STRING") == [])
check("lora_names: from a LoraLoaderModelOnly answer",
      SG.lora_names({"LoraLoaderModelOnly": {"input": {"required": {"lora_name": [["x.safetensors"]]}}}}) == ["x.safetensors"])
TURBO = "minimax-h3/minimax_h3_ref2v_lightx2v_turbo_4step_v0.1_resized_avg_rank_20_bf16.safetensors"
SWL = "minimax-h3/" + SG.SWAP_LORA_FILE
check("find_swap_lora: the exact file, never the turbo LoRA; none = None",
      SG.find_swap_lora([TURBO, SWL]) == SWL and SG.find_swap_lora([TURBO]) is None
      and SG.find_swap_lora(["loras/my_h3-character-swap_v2.safetensors"]) == "loras/my_h3-character-swap_v2.safetensors")
gl, nl = SG.add_swap_lora(gt, SWL)
pl = next(v for v in gl.values() if str(v.get("class_type", "")).startswith("Power Lora Loader"))["inputs"]
check("add_swap_lora: stacked on the Power Lora Loader as the next row (the turbo row kept)",
      pl["lora_1"]["lora"] == TURBO and pl["lora_2"] == {"on": True, "lora": SWL, "strength": 1.0, "strengthTwo": None}, nl)
check("add_swap_lora: twice = once", SG.add_swap_lora(gl, SWL)[0] == gl)
gu = {"1": {"class_type": "UNETLoader", "inputs": {"unet_name": "m"}},
      "2": {"class_type": "BasicGuider", "inputs": {"model": ["1", 0]}},
      "3": {"class_type": "BasicScheduler", "inputs": {"model": ["1", 0]}}}
gu2, _ = SG.add_swap_lora(gu, SWL)
check("add_swap_lora: no Power Lora Loader = a LoraLoaderModelOnly after the model loader, its readers re-aimed",
      gu2["h3swaplora"]["inputs"]["model"] == ["1", 0] and gu2["2"]["inputs"]["model"] == ["h3swaplora", 0]
      and gu2["3"]["inputs"]["model"] == ["h3swaplora", 0])
check("add_swap_lora: no loader at all = skipped, said", "skipped" in SG.add_swap_lora({}, SWL)[1])
wsrc = (ROOT / "misc" / "swap_worker.py").read_text(encoding="utf-8")
check("swap_worker: the swap LoRA is looked up + stacked after the style, ref_image_size passed, long runs warned",
      "graph = swap_lora(base, graph" in wsrc and "ref_image_size=params.get(\"ref_image_size\")" in wsrc
      and "SG.BEST_FRAMES" in wsrc)

# ---- 2.336.0: QUALITY (the swap LoRA was tested WITHOUT the turbo LoRA, 28 steps)
check("is_turbo: lightx2v / turbo / lightning / 4step LoRAs yes; the swap LoRA and a style LoRA no",
      SG.is_turbo(TURBO) and SG.is_turbo("minimax_h3_ref2v_turbo_4step_v0.1_comfyui_bf16.safetensors")
      and SG.is_turbo("x/lightning_8step.safetensors") and not SG.is_turbo(SWL) and not SG.is_turbo("look.safetensors"))
gq = SG.add_swap_lora(gt, SWL)[0]
gf, nf = SG.apply_quality(gq, "fast")
check("apply_quality fast: the export as it is (turbo on, 4 steps)", gf == gq and "fast" in nf[0])
def sched(gx):
    return next(v for v in gx.values() if v.get("class_type") == "BasicScheduler")["inputs"]
def rows(gx):
    pl = next(v for v in gx.values() if str(v.get("class_type", "")).startswith("Power Lora Loader"))["inputs"]
    return {r["lora"]: r["on"] for k, r in pl.items() if k.startswith("lora_")}
g20, n20 = SG.apply_quality(gq, "full")
check("apply_quality full: the turbo row OFF, the swap LoRA ON, 20 steps, beta",
      rows(g20) == {TURBO: False, SWL: True} and sched(g20)["steps"] == 20 and sched(g20)["scheduler"] == "beta"
      and "turbo LoRA off" in n20[0], (rows(g20), sched(g20)))
g28, _ = SG.apply_quality(gq, "best")
check("apply_quality best: 28 steps (the swap LoRA's own test renders)", sched(g28)["steps"] == 28 and rows(g28)[TURBO] is False)
check("apply_quality: blank / junk = full (the default)", sched(SG.apply_quality(gq, None)[0])["steps"] == 20
      and sched(SG.apply_quality(gq, "ultra")[0])["steps"] == 20 and SG.DEFAULT_QUALITY == "full")
gt2 = {"1": {"class_type": "UNETLoader", "inputs": {}},
       "2": {"class_type": "LoraLoaderModelOnly", "inputs": {"model": ["1", 0], "lora_name": "minimax_h3_ref2v_turbo_4step_v0.1_comfyui_bf16.safetensors"}},
       "3": {"class_type": "BasicGuider", "inputs": {"model": ["2", 0]}},
       "4": {"class_type": "BasicScheduler", "inputs": {"model": ["2", 0], "steps": 4, "scheduler": "simple"}}}
gb, _ = SG.apply_quality(gt2, "full")
check("apply_quality: a LoraLoaderModelOnly turbo node is bypassed (its readers get the model loader)",
      "2" not in gb and gb["3"]["inputs"]["model"] == ["1", 0] and gb["4"]["inputs"]["model"] == ["1", 0] and gb["4"]["inputs"]["steps"] == 20)
check("swap_worker: quality after the swap LoRA, the scheduler checked against ComfyUI's own list",
      "graph = swap_quality(base, graph, params.get(\"quality\"))" in wsrc and "def swap_quality(" in wsrc
      and wsrc.index("graph = swap_lora(base, graph") < wsrc.index("graph = swap_quality(base, graph"))

print(f"RESULT: {passed} passed, {failed} failed")
sys.exit(1 if failed else 0)
