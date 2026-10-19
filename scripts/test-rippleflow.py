#!/usr/bin/env python3
"""bitGen Studio — 2.342.0: LTX Ripple through Tim's own workflow.
Run: python3 scripts/test-rippleflow.py

Tim: "use this workflow for the character swap, i tested it in comfy and it
works" (comfy_workflows/LTX_Ripple_FFAF_Edit_v11.json).
  1. scripts/ui_named_to_api.py on his export: widget names from
     widgets_values_named, Set/Get wires, the Anything Everywhere links
     (extra.ue_links), canvas-only nodes gone - and the shipped _api.json is
     exactly that conversion;
  2. scripts/ripple_graph.patch: the constants, seed, steps, prompts, the
     first frame, the clip, the Ripple LoRA + extra LoRAs chained, the output,
     the prune, refusals in words;
  3. render_frames + finish_args on real ffmpeg (the still at frame 0 off,
     the segment's frames, the original audio)."""
import json
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
import ripple_graph as RG  # noqa: E402
import ui_named_to_api as U  # noqa: E402

P = F = 0


def check(name, ok, extra=None):
    global P, F
    if ok:
        P += 1
        print("PASS: " + name)
    else:
        F += 1
        print("FAIL: " + name + ("" if extra is None else " :: " + json.dumps(extra, default=str)[:400]))


UI = json.loads((ROOT / "comfy_workflows" / "LTX_Ripple_FFAF_Edit_v11.json").read_text(encoding="utf-8"))
API = json.loads((ROOT / "comfy_workflows" / "LTX_Ripple_FFAF_Edit_v11_api.json").read_text(encoding="utf-8"))
api, notes = U.convert(UI)
cls = lambda g: sorted({v["class_type"] for v in g.values()})  # noqa: E731
ofc = lambda g, c: [k for k, v in g.items() if v["class_type"] == c]  # noqa: E731

# ---- 1. the conversion
check("the shipped LTX_Ripple_FFAF_Edit_v11_api.json IS the conversion of Tim's export", api == API)
check("canvas-only + virtual nodes gone (Label, Note, MarkdownNote, Anything Everywhere, Set/Get)",
      not set(cls(api)) & {"Label (rgthree)", "Note", "MarkdownNote", "Anything Everywhere", "SetNode", "GetNode"}, cls(api))
check("no dangling link, no notes", not notes and all(str(v[0]) in api for n in api.values() for v in n["inputs"].values()
                                                      if isinstance(v, list) and len(v) == 2 and isinstance(v[1], int)), notes)
enc = [api[k] for k in ofc(api, "CLIPTextEncode")]
dec = api[ofc(api, "VAEDecode")[0]]
guide = api[ofc(api, "LTXAddVideoICLoRAGuide")[0]]
check("the Anything Everywhere links: both prompts' clip, VAEDecode.vae, the IC guide's vae (exactly extra.ue_links)",
      all(e["inputs"]["clip"] == ["1318", 0] for e in enc) and dec["inputs"]["vae"] == ["822", 0] and guide["inputs"]["vae"] == ["822", 0])
lv = api[ofc(api, "VHS_LoadVideo")[0]]["inputs"]
check("...and NOT the optional VAE sockets (VHS_LoadVideo stays an image loader)", "vae" not in lv and "meta_batch" not in lv, lv)
check("Set/Get by name: the frame cap, the latent's size + length are the constants", lv["frame_load_cap"] == ["937", 0]
      and api["567"]["inputs"]["width"] == ["933", 0] and api["567"]["inputs"]["length"] == ["937", 0])
check("widget values by NAME (a wired widget takes the wire), UI-only ones left out", api["1312"]["inputs"]["lora_name"].endswith("LTX25_Ripple_v11.safetensors")
      and api["1319"]["inputs"]["steps"] == 8 and "videopreview" not in lv and api["1304"]["inputs"] == {"image": api["1304"]["inputs"]["image"]})
check("titles ride in _meta (the patcher finds the constants by them)",
      sorted(api[k]["_meta"]["title"] for k in ofc(api, "INTConstant")) == ["Set FPS", "Set Frames Amount", "Set Height", "Set Width"])
try:
    U.convert({"nodes": [{"id": 1, "type": "KSampler", "widgets_values": [1, 2]}], "links": []})
    check("a node with values but no names is refused (never guessed by position)", False)
except ValueError as e:
    check("a node with values but no names is refused (never guessed by position)", "no names" in str(e))

# ---- 2. the patch
o = {"image": "ff.png", "video": "clip.mp4", "width": 1376, "height": 768, "frames": 129, "seed": 4242, "steps": 12,
     "prompt": "P!", "negative": "N!", "strength": 1.2, "loras": [{"name": "a.safetensors", "weight": 0.5}, {"name": "b.safetensors"}],
     "prefix": "bitgen_ripple"}
g, pn = RG.patch(API, o)
const = {g[k]["_meta"]["title"]: g[k]["inputs"]["value"] for k in ofc(g, "INTConstant")}
check("the constants: width / height / frames / fps", const == {"Set Width": 1376, "Set Height": 768, "Set Frames Amount": 129, "Set FPS": 24}, const)
check("seed on the SeedNode (RandomNoise reads it), steps on the BasicScheduler",
      g[ofc(g, "SeedNode")[0]]["inputs"]["seed"] == 4242 and g[ofc(g, "RandomNoise")[0]]["inputs"]["noise_seed"] == [ofc(g, "SeedNode")[0], 0]
      and g[ofc(g, "BasicScheduler")[0]]["inputs"]["steps"] == 12)
cond = g[ofc(g, "LTXVConditioning")[0]]["inputs"]
check("the prompts by what LTXVConditioning reads", g[cond["positive"][0]]["inputs"]["text"] == "P!" and g[cond["negative"][0]]["inputs"]["text"] == "N!")
check("the edited first frame + the clip (from its first frame)", g[ofc(g, "LoadImage")[0]]["inputs"]["image"] == "ff.png"
      and g[ofc(g, "VHS_LoadVideo")[0]]["inputs"]["video"] == "clip.mp4" and g[ofc(g, "VHS_LoadVideo")[0]]["inputs"]["skip_first_frames"] == 0)
chain = [g[k] for k in ofc(g, "LoraLoaderModelOnly")]
check("the Ripple LoRA @ 1.2, then the two swap LoRAs chained; the sage patch reads the last",
      g["1312"]["inputs"]["strength_model"] == 1.2 and g["rl1"]["inputs"]["model"] == ["1312", 0] and g["rl2"]["inputs"]["model"] == ["rl1", 0]
      and g["rl1"]["inputs"]["strength_model"] == 0.5 and g["rl2"]["inputs"]["strength_model"] == 1.0
      and g[ofc(g, "PathchSageAttentionKJ")[0]]["inputs"]["model"] == ["rl2", 0], [c["inputs"] for c in chain])
outs = ofc(g, "VHS_VideoCombine")
check("ONE output left - the VAEDecode's, prefix bitgen_ripple; the input preview + the comparison pruned",
      len(outs) == 1 and g[outs[0]]["inputs"]["filename_prefix"] == "bitgen_ripple"
      and g[g[outs[0]]["inputs"]["images"][0]]["class_type"] == "VAEDecode"
      and not ofc(g, "ImageConcatMulti") and not ofc(g, "TextOverlay") and not ofc(g, "VAEDecodeAudio"), outs)
check("nothing dangling after the patch", all(str(v[0]) in g for n in g.values() for v in n["inputs"].values()
                                              if isinstance(v, list) and len(v) == 2 and isinstance(v[1], int)))
check("patch never touches the template", API["1312"]["inputs"]["strength_model"] == 1.35 and "rl1" not in API)
for bad, why in (({}, "empty"), ({k: v for k, v in API.items() if v["class_type"] != "LoadImage"}, "ONE picture")):
    try:
        RG.patch(bad, o)
        check(f"refused in words: {why}", False)
    except ValueError as e:
        check(f"refused in words: {why}", why in str(e), str(e))
check("render_frames: 8k+1 >= the segment + the still", RG.render_frames(124) == 129 and RG.render_frames(128) == 129
      and RG.render_frames(129) == 137 and RG.render_frames(3) == 9)

# ---- 3. the finish on real ffmpeg
if shutil.which("ffmpeg"):
    T = Path(tempfile.mkdtemp(prefix="rflow-"))
    # a "render": 129 frames where frame 0 is RED (the still) and the rest are blue
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "lavfi", "-i", "color=c=red:s=320x192:r=24:d=0.0417",
                    "-f", "lavfi", "-i", "color=c=blue:s=320x192:r=24:d=5.3333", "-filter_complex", "[0]trim=end_frame=1,setpts=PTS-STARTPTS[r];[r][1]concat=n=2:v=1[v]",
                    "-map", "[v]", "-frames:v", "129", "-pix_fmt", "yuv420p", str(T / "raw.mp4")], check=True)
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "lavfi", "-i", "testsrc=s=320x192:r=24:d=6", "-f", "lavfi",
                    "-i", "sine=f=300:d=6", "-shortest", "-pix_fmt", "yuv420p", "-c:a", "aac", str(T / "clip.mp4")], check=True)
    subprocess.run(RG.finish_args(T / "raw.mp4", T / "clip.mp4", T / "out.mp4", 124, True), check=True)
    n = subprocess.run(["ffprobe", "-v", "error", "-count_frames", "-select_streams", "v:0", "-show_entries", "stream=nb_read_frames",
                        "-of", "csv=p=0", str(T / "out.mp4")], capture_output=True, text=True).stdout.strip()
    rgb = subprocess.run(["ffmpeg", "-loglevel", "error", "-i", str(T / "out.mp4"), "-frames:v", "1", "-vf", "scale=1:1", "-f", "rawvideo",
                          "-pix_fmt", "rgb24", "-"], capture_output=True).stdout
    a = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "stream=codec_type", "-of", "csv=p=0", str(T / "out.mp4")],
                       capture_output=True, text=True).stdout
    check("finish: the RED still at frame 0 is gone (the take starts blue), 124 frames kept, the original audio on",
          n == "124" and len(rgb) == 3 and rgb[2] > rgb[0] and "audio" in a, (n, list(rgb), a))
    shutil.rmtree(T, ignore_errors=True)
else:
    print("(no ffmpeg - the finish check is skipped)")

print(f"RESULT: {P} passed, {F} failed")
sys.exit(1 if F else 0)
