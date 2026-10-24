#!/usr/bin/env python3
"""Patcher unit tests.
Part A: prune/sync of the RH 9-image/3-video/3-audio ref2va example (kept as
comfy_workflows/ref2va_rh_example.json) + the fl2va-style plain template.
Part B: the NATIVE official export (comfy_workflows/ref2va.json,
MiniMaxH3ReferenceToVideo): literal patching of prompt/length/width/height,
seed on RandomNoise, steps on BasicScheduler, LoRA/switch bypass, dangling
helper pruning, dynamic ref_images.ref_image_N slot cloning, and the 17k+5
grid planner. Run from repo root: python3 scripts/test-patcher.py"""
import copy, json, sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "misc"))
import worker  # noqa: E402  (import is side-effect-safe; main() is guarded)

TPL = json.loads(Path("comfy_workflows/ref2va_rh_example.json").read_text())
NAT = json.loads(Path("comfy_workflows/ref2va.json").read_text())
P = dict(prompt="p", seed=1, frames=121, width=960, height=544, steps=8)
FAILED = []


def check(name, cond, extra=""):
    if cond:
        print(f"PASS: {name}")
    else:
        FAILED.append(name)
        print(f"FAIL: {name} {extra}")


def counts(g):
    c = {"LoadImage": 0, "LoadVideo": 0, "LoadAudio": 0, "iref": 0, "vref": 0, "aref": 0}
    for v in g.values():
        ct = v["class_type"]
        if ct in c:
            c[ct] += 1
        elif ct == "RHMiniMaxH3Ref2VAImageReference":
            c["iref"] += 1
        elif ct == "RHMiniMaxH3Ref2VAVideoReference":
            c["vref"] += 1
        elif ct == "RHMiniMaxH3Ref2VAAudioReference":
            c["aref"] += 1
    return c


def chain_ok(g):
    """Every surviving link must point at a surviving node, and Target/Encode
    'references' must reach the chain head through surviving reference nodes."""
    for k, v in g.items():
        for key, val in (v.get("inputs") or {}).items():
            if isinstance(val, list) and val and str(val[0]) not in g:
                return False, f"{k}.{key} -> dangling {val[0]}"
    tgt = next(v for v in g.values() if v["class_type"] == "RHMiniMaxH3Ref2VATarget")
    nid, hops = str(tgt["inputs"]["references"][0]), 0
    while hops < 50:
        node = g[nid]
        up = node["inputs"].get("references")
        if not up:
            return True, f"head={nid}"
        nid, hops = str(up[0]), hops + 1
    return False, "chain loop"


# 1) full house: 9 images + 3 videos + 3 audios -> nothing pruned
g = worker._patch_workflow(copy.deepcopy(TPL), **P,
                           images=[f"i{n}.png" for n in range(9)],
                           videos=[f"v{n}.mp4" for n in range(3)],
                           audios=[f"a{n}.mp3" for n in range(3)])
c = counts(g)
check("full house keeps all slots",
      c == {"LoadImage": 9, "LoadVideo": 3, "LoadAudio": 3, "iref": 9, "vref": 3, "aref": 3}, str(c))
ok, why = chain_ok(g)
check("full house chain intact", ok, why)
check("filenames assigned in order",
      g["10"]["inputs"]["image"] == "i0.png" and g["18"]["inputs"]["image"] == "i8.png"
      and g["30"]["inputs"]["file"] == "v0.mp4" and g["52"]["inputs"]["audio"] == "a2.mp3")

# 2) 2 images only -> 7 image slots + all video/audio slots bypassed
g = worker._patch_workflow(copy.deepcopy(TPL), **P, images=["a.png", "b.png"])
c = counts(g)
check("2-image prune",
      c == {"LoadImage": 2, "LoadVideo": 0, "LoadAudio": 0, "iref": 2, "vref": 0, "aref": 0}, str(c))
ok, why = chain_ok(g)
check("2-image chain rewired to head", ok and why == "head=20", why)
tgt = g["70"]["inputs"]["references"]
check("target repointed to last live ref", str(tgt[0]) == "21", str(tgt))
check("encode repointed too", str(g["71"]["inputs"]["references"][0]) == "21")

# 3) 1 image + 1 audio, no videos -> audio chain hops the whole video block
g = worker._patch_workflow(copy.deepcopy(TPL), **P, images=["a.png"], audios=["s.wav"])
c = counts(g)
check("img+audio prune",
      c == {"LoadImage": 1, "LoadVideo": 0, "LoadAudio": 1, "iref": 1, "vref": 0, "aref": 1}, str(c))
check("audio ref chains straight to image ref",
      str(g["60"]["inputs"]["references"][0]) == "20",
      str(g["60"]["inputs"].get("references")))
check("audio file assigned", g["50"]["inputs"]["audio"] == "s.wav")
ok, why = chain_ok(g)
check("img+audio chain intact", ok, why)

# 4) 9 images + 1 video + 2 audios (mixed partial)
g = worker._patch_workflow(copy.deepcopy(TPL), **P,
                           images=[f"i{n}.png" for n in range(9)],
                           videos=["v.mp4"], audios=["x.wav", "y.wav"])
c = counts(g)
check("mixed partial prune",
      c == {"LoadImage": 9, "LoadVideo": 1, "LoadAudio": 2, "iref": 9, "vref": 1, "aref": 2}, str(c))
check("video ref chains to 9th image ref", str(g["40"]["inputs"]["references"][0]) == "28")
check("audio ref chains to the one video ref", str(g["60"]["inputs"]["references"][0]) == "40")
ok, why = chain_ok(g)
check("mixed chain intact", ok, why)

# 5) more files than slots -> extras ignored, no crash
g = worker._patch_workflow(copy.deepcopy(TPL), **P,
                           images=[f"i{n}.png" for n in range(12)])
check("12 images clamp to 9 slots", counts(g)["LoadImage"] == 9)

# 6) fl2va-style plain template (no reference chain) keeps old behavior
fl = {"3": {"class_type": "LoadImage", "inputs": {"image": "x.png"}},
      "4": {"class_type": "LoadImage", "inputs": {"image": "y.png"}},
      "7": {"class_type": "RHMiniMaxH3VideoGen",
            "inputs": {"prompt": "", "seed": 0, "duration_seconds": 1.0,
                       "width": 0, "height": 0, "steps": 8,
                       "first_frame": ["3", 0], "last_frame": ["4", 0]}},
      "9": {"class_type": "SaveVideo", "inputs": {"video": ["7", 0]}}}
g = worker._patch_workflow(copy.deepcopy(fl), **P, images=["only.png"])
check("fl2va: surplus LoadImage removed", "4" not in g and "3" in g)
check("fl2va: dangling last_frame input dropped",
      "last_frame" not in g["7"]["inputs"] and g["3"]["inputs"]["image"] == "only.png")


# ---------------- Part B: NATIVE official export ----------------

def no_dangling(g):
    for k, v in g.items():
        for key, val in (v.get("inputs") or {}).items():
            if isinstance(val, list) and val and str(val[0]) not in g:
                return False, f"{k}.{key} -> dangling {val[0]}"
    return True, ""

def classes(g):
    return sorted({v["class_type"] for v in g.values()})

NAT1 = copy.deepcopy(NAT)          # 1-slot variant (a bare official export)
for i in range(1, 9): NAT1.pop(str(149 + i)); NAT1["136"]["inputs"].pop(f"ref_images.ref_image_{i}")
for k in range(3):
    NAT1.pop(str(160 + k)); NAT1.pop(str(170 + k)); NAT1.pop(str(165 + k))
    for key in (f"ref_videos.ref_video_{k}", f"ref_video_audios.ref_video_audio_{k}",
                f"ref_audios.ref_audio_{k}"):
        NAT1["136"]["inputs"].pop(key)

# 7) native, 1 image: literals patched, helpers + 14 unused slots pruned
g = worker._patch_workflow(copy.deepcopy(NAT), **P, images=["a.png"])
gen = g.get("136")
check("native: gen node kept", gen is not None, str(classes(g)))
check("native: prompt literal", gen and gen["inputs"]["prompt"] == "p")
check("native: length literal (worker owns the 17k+5 snap)",
      gen and gen["inputs"]["length"] == 121)
check("native: width/height literal",
      gen and gen["inputs"]["width"] == 960 and gen["inputs"]["height"] == 544)
check("native: seed on RandomNoise", g["129"]["inputs"]["noise_seed"] == 1)
# steps: the scheduler's link to the LoRA steps-switch is KEPT (severing it is
# the Errno-22 bug); the literal 8 is set on the branch the boolean selects.
# Resolve it the way ComfyUI would and check the sampler ends up at 8 steps.
def _resolve_steps(g, sched_id="124"):
    link = g[sched_id]["inputs"]["steps"]
    hops = 0
    while isinstance(link, list) and link and hops < 20:
        v = g.get(str(link[0]))
        if not v:
            return None
        ins = v.get("inputs") or {}
        if "switch" in str(v.get("class_type", "")).lower():
            sel = ins.get("switch")
            on = None
            if isinstance(sel, list) and str(sel[0]) in g:
                on = (g[str(sel[0])].get("inputs") or {}).get("value")
            link = ins.get("on_true") if on else ins.get("on_false")
            hops += 1
            continue
        return ins.get("value")
    return link if not isinstance(link, list) else None
check("native: steps resolve to 8 through the intact switch (link kept, not severed)",
      _resolve_steps(g) == 8, repr(g["124"]["inputs"]["steps"]))
check("native: the scheduler's steps input is STILL a link to the switch",
      isinstance(g["124"]["inputs"]["steps"], list), repr(g["124"]["inputs"]["steps"]))
check("native: the LoRA steps-switch (142) and its boolean (146) survive",
      "142" in g and "146" in g and "143" in g,
      f'142={"142" in g} 146={"146" in g} 143={"143" in g}')
check("native: image assigned", g["137"]["inputs"]["image"] == "a.png")
check("native: unused image/video/audio slots pruned",
      not any(str(n) in g for n in list(range(150, 158)) + list(range(160, 163))
              + list(range(165, 168)) + list(range(170, 173))))
check("native: only slot-0 dotted key survives",
      [k for k in g["136"]["inputs"] if "." in k] == ["ref_images.ref_image_0"],
      str([k for k in g["136"]["inputs"] if "." in k]))
check("native: lora removed", "145" not in g)
check("native: model switch rewired through the lora",
      str(g["141"]["inputs"]["on_true"][0]) == "127")
# The frame-math / resolution / prompt helpers ARE detached by literal patching
# and pruned. PrimitiveInt is NOT here any more: 143/144 feed the LoRA steps
# switch, which now stays wired (keeping it whole is the Errno-22 fix). The
# LoRA loader is gone because the toggle is off (bypassed).
gone = {"ComfyMathExpression", "PrimitiveFloat", "PrimitiveStringMultiline",
        "ResolutionSelector", "LoraLoaderModelOnly"}
check("native: detached frame/prompt helpers pruned", not gone & set(classes(g)), str(classes(g)))
check("native: the switch-branch PrimitiveInt(s) are KEPT (they feed the live switch)",
      "PrimitiveInt" in classes(g), str(classes(g)))
ok, why = no_dangling(g)
check("native: no dangling links", ok, why)

# 8) native, 3 images fill BAKED slots (no cloning needed on the shipped tpl)
g = worker._patch_workflow(copy.deepcopy(NAT), **P,
                           images=["a.png", "b.png", "c.png"])
li = sorted([k for k, v in g.items() if v["class_type"] == "LoadImage"], key=int)
check("native: 3 LoadImage after cloning", len(li) == 3, str(li))
gen = g["136"]
check("native: dotted slots 0..2 present",
      all(f"ref_images.ref_image_{i}" in gen["inputs"] for i in range(3)),
      str([k for k in gen["inputs"] if k.startswith("ref_images")]))
check("native: cloned files in order",
      [g[k]["inputs"]["image"] for k in li] == ["a.png", "b.png", "c.png"],
      str([g[k]["inputs"]["image"] for k in li]))
check("native: slots point at live loaders",
      all(str(gen["inputs"][f"ref_images.ref_image_{i}"][0]) in g for i in range(3)))
ok, why = no_dangling(g)
check("native: cloned graph has no dangling links", ok, why)

# 9) native, full mixed refs: 2 videos (+ their soundtrack extractors) + 1 audio
g = worker._patch_workflow(copy.deepcopy(NAT), **P, images=["a.png"],
                           videos=["v1.mp4", "v2.mp4"], audios=["s.wav"])
check("native: videos assigned in order",
      g["160"]["inputs"]["file"] == "v1.mp4" and g["161"]["inputs"]["file"] == "v2.mp4")
check("native: 3rd video slot + its soundtrack extractor pruned",
      "162" not in g and "172" not in g)
check("native: kept videos keep their GetVideoComponents",
      "170" in g and "171" in g
      and str(g["136"]["inputs"]["ref_video_audios.ref_video_audio_0"][0]) == "170")
check("native: dead video's dotted keys dropped",
      "ref_videos.ref_video_2" not in g["136"]["inputs"]
      and "ref_video_audios.ref_video_audio_2" not in g["136"]["inputs"])
check("native: audio slot filled, extras pruned",
      g["165"]["inputs"]["audio"] == "s.wav" and "166" not in g and "167" not in g)
ok, why = no_dangling(g)
check("native: mixed graph has no dangling links", ok, why)

# 9b) cloning still works on a bare 1-slot export (NAT1)
g = worker._patch_workflow(copy.deepcopy(NAT1), **P,
                           images=["a.png", "b.png", "c.png"])
li = sorted([k for k, v in g.items() if v["class_type"] == "LoadImage"], key=int)
check("native 1-slot: cloned to 3 LoadImage",
      len(li) == 3 and [g[k]["inputs"]["image"] for k in li] == ["a.png", "b.png", "c.png"],
      str(li))
check("native 1-slot: dotted slots 0..2 present",
      all(f"ref_images.ref_image_{i}" in g["136"]["inputs"] for i in range(3)))
ok, why = no_dangling(g)
check("native 1-slot: no dangling links", ok, why)

# 10) 17k+5 grid math + planner (comfy engine)
check("snap17k5 up", [worker.snap_17k5_up(n) for n in (1, 5, 6, 49, 96, 360, 362)]
      == [5, 5, 22, 56, 107, 362, 362])
check("snap17k5 down", [worker.snap_17k5_down(n) for n in (1, 5, 21, 56, 361)]
      == [5, 5, 5, 56, 345])
p = worker.plan_chunks(96, 56, grid="17k5", force=True)
check("17k5 plan 96f/max56", p["chunks"] == [56, 56] and p["trim"] == 15, str(p))
p = worker.plan_chunks(360, worker.MAX_SINGLE_RUN_COMFY, grid="17k5")
check("17k5 single 360f -> one 362f gen", p["chunks"] == [362] and p["trim"] == 2, str(p))
p = worker.plan_chunks(121, 361)     # default grid untouched
check("4n1 regression 121f", p["chunks"] == [121] and p["trim"] == 0, str(p))

# 10b) the VRAM ceiling (2.99.0): plan_chunks(ceiling=) and the fallback ladder,
# mirrored in lib/framePlan.js (test-timeline.js checks that side)
p = worker.plan_chunks(360, 362, grid="17k5", ceiling=243)
check("17k5 ceiling 243: 360f -> [243, 124]", p["chunks"] == [243, 124] and p["trim"] == 6, str(p))
p = worker.plan_chunks(240, 362, grid="17k5", ceiling=243)
check("17k5 ceiling 243: 240f still ONE run", p["chunks"] == [243], str(p))
p = worker.plan_chunks(360, 362, grid="17k5", ceiling=0)
check("ceiling 0 = the model ceiling", p["chunks"] == [362], str(p))
p = worker.plan_chunks(360, 362, grid="17k5", ceiling=250)
check("an off-grid ceiling snaps DOWN (250 -> 243)", p["chunks"] == [243, 124], str(p))
check("fallback ladder 362 -> 243 -> 158 -> 107",
      [worker.vram_fallback_ceiling(n) for n in (362, 243, 158)] == [243, 158, 107],
      [worker.vram_fallback_ceiling(n) for n in (362, 243, 158)])
check("fallback never goes below the grid minimum", worker.vram_fallback_ceiling(5) == 5)
check("ComfyOOM carries the frame count", worker.ComfyOOM(362, "x").frames == 362)

# 10c) the text encoder OFF the card (2.99.2). Tim's card: a 32B int8 text
# encoder beside a ~21 GB video model on 32 GB. It only ever rendered because
# ComfyUI offloaded the encoder; a newer ComfyUI ("Using RAM pressure cache")
# can hold it through sampling, and that is when 15 s starts failing while 10 s
# fits. CLIPLoader.device="cpu" pins it in system RAM. The graph H3 sent at
# 2.89.0 and at 2.97.1 was byte-identical, so this is the only lever that is
# ours to pull without touching his ComfyUI.
REF = json.loads(Path("comfy_workflows/ref2va.json").read_text())
g = worker._patch_workflow(copy.deepcopy(REF), prompt="p", seed=1, frames=362,
                           width=960, height=544, steps=8,
                           images=["a.jpg", "b.jpg"], use_lora=False, cfg=1.0,
                           clip_device="cpu")
clips = [v for v in g.values() if v.get("class_type") == "CLIPLoader"]
check("clip on cpu: CLIPLoader.device is set", clips and clips[0]["inputs"]["device"] == "cpu",
      str([c["inputs"] for c in clips]))
check("clip on cpu: the model it loads is untouched",
      clips and clips[0]["inputs"]["clip_name"].startswith("qwen3vl_32b"), str(clips[0]["inputs"]))
g2 = worker._patch_workflow(copy.deepcopy(REF), prompt="p", seed=1, frames=362,
                            width=960, height=544, steps=8,
                            images=["a.jpg", "b.jpg"], use_lora=False, cfg=1.0,
                            clip_device="")
clips2 = [v for v in g2.values() if v.get("class_type") == "CLIPLoader"]
check("clip device left alone when the setting is off",
      clips2 and clips2[0]["inputs"]["device"] == "default", str(clips2[0]["inputs"]))
# 2.99.3: OPT-IN. It costs ~110 s of encoding per run and did NOT fix Tim's
# failure (a 3 s clip failed identically), so the default is ComfyUI's choice.
check("the default is now 'default' (opt-in), not cpu",
      worker._clip_device({}) == "" and worker._clip_device({"engine": {"comfy": {}}}) == "")
check("'cpu' turns it on; junk never becomes a device",
      worker._clip_device({"engine": {"comfy": {"clip_device": "cpu"}}}) == "cpu"
      and worker._clip_device({"engine": {"comfy": {"clip_device": "cuda:9"}}}) == "")
# a CLIPLoader with NO device input must not gain one (an older export, or the
# RH pack): patch the real template with that one input removed
REF_NODEV = copy.deepcopy(REF)
for _v in REF_NODEV.values():
    if _v.get("class_type") == "CLIPLoader":
        _v["inputs"].pop("device", None)
g3 = worker._patch_workflow(REF_NODEV, prompt="p", seed=1, frames=362, width=960,
                            height=544, steps=8, images=["a.jpg"], use_lora=False,
                            cfg=1.0, clip_device="cpu")
clips3 = [v for v in g3.values() if v.get("class_type") == "CLIPLoader"]
check("a CLIPLoader without a device input is left alone (no invented key)",
      clips3 and "device" not in clips3[0]["inputs"], str(clips3[0]["inputs"]) if clips3 else "no CLIPLoader")

# 11) native fl2va template: first/last frame slot wiring + bypass
FL2VA = json.loads(Path("comfy_workflows/fl2va.json").read_text())
GEN = "105:104"

g = copy.deepcopy(FL2VA)
worker._patch_workflow(g, prompt="p", seed=3, frames=39, width=192, height=108,
                       steps=8, images=["first.png"])
check("fl2va: first_frame wired from the only image",
      g[GEN]["inputs"].get("first_frame") == ["114", 0]
      and g["114"]["inputs"]["image"] == "first.png", str(g[GEN]["inputs"]))
check("fl2va: NO last image -> last_frame key dropped (bypassed)",
      "last_frame" not in g[GEN]["inputs"], str(g[GEN]["inputs"].keys()))
check("fl2va: bypassed last-frame loader is pruned", "116" not in g)
ok, why = no_dangling(g)
check("fl2va: no dangling links after bypass", ok, why)

g = copy.deepcopy(FL2VA)
worker._patch_workflow(g, prompt="p", seed=3, frames=39, width=192, height=108,
                       steps=8, images=["first.png", "last.png"])
check("fl2va: last image selected -> last_frame wired",
      g[GEN]["inputs"].get("last_frame") == ["116", 0]
      and g["116"]["inputs"]["image"] == "last.png", str(g[GEN]["inputs"]))
check("fl2va: frames land on the right slots, not swapped",
      g["114"]["inputs"]["image"] == "first.png"
      and g["116"]["inputs"]["image"] == "last.png")
check("fl2va: literals replace the primitive/math helpers",
      g[GEN]["inputs"]["length"] == 39 and g[GEN]["inputs"]["width"] == 192
      and g[GEN]["inputs"]["prompt"] == "p", str(g[GEN]["inputs"]))
check("fl2va: detached helpers pruned (115 res / 119 scale / 120 size)",
      all(x not in g for x in ("115", "119", "120")))
ok, why = no_dangling(g)
check("fl2va: no dangling links when both frames wired", ok, why)

# the slot mapping must follow the LINKS, not the node ids: an export whose
# last-frame loader carries the lower id used to silently swap the keyframes
g = copy.deepcopy(FL2VA)
g["113"] = g.pop("116")
g[GEN]["inputs"]["last_frame"] = ["113", 0]
worker._patch_workflow(g, prompt="p", seed=3, frames=22, width=192, height=108,
                       steps=8, images=["first.png", "last.png"])
check("fl2va: slot order is link-driven, not id-driven",
      g["114"]["inputs"]["image"] == "first.png"
      and g["113"]["inputs"]["image"] == "last.png",
      str({k: v["inputs"].get("image") for k, v in g.items()
           if v.get("class_type") == "LoadImage"}))

# LoRA toggle still behaves on this template
g = copy.deepcopy(FL2VA)
worker._patch_workflow(g, prompt="p", seed=3, frames=22, width=192, height=108,
                       steps=4, images=["first.png"], use_lora=True)
check("fl2va: 4-step LoRA kept and its enable switch flipped",
      any("loraloader" in v.get("class_type", "").lower() for v in g.values())
      and g["105:126"]["inputs"]["value"] is True)
g = copy.deepcopy(FL2VA)
worker._patch_workflow(g, prompt="p", seed=3, frames=22, width=192, height=108,
                       steps=8, images=["first.png"], use_lora=False)
check("fl2va: LoRA bypassed when the toggle is off",
      not any("loraloader" in v.get("class_type", "").lower() for v in g.values()))

# ---------------- Part D: the LoRA-switch / scheduler Errno-22 fix ----------
# THE BUG (Tim, three sessions): SamplerCustomAdvanced died with
# "OSError: [Errno 22] Invalid argument" on a ref2va graph that used to render.
# It was labelled the ComfyUI-on-Windows stderr crash for months. It was not:
# the patcher, setting BasicScheduler.steps, OVERWROTE the link to the LoRA
# steps-switch with a literal, severing one arm of a shared boolean+switch and
# leaving the graph half-rewired (PrimitiveBoolean + one ComfySwitchNode
# surviving into execution — exactly Tim's node census). These lock the fix:
# the scheduler's link is KEPT, the user's step count reaches the sampler
# through the switch whichever arm the LoRA toggle selects, and no order
# dependence between _set_steps and the LoRA-flip can send steps to the wrong
# arm (the bug found by testing fl2va with the LoRA on).

def _sampler_steps(g):
    samp = next(v for v in g.values() if v.get("class_type") == "SamplerCustomAdvanced")
    link = g[str(samp["inputs"]["sigmas"][0])]["inputs"]["steps"]
    hops = 0
    while isinstance(link, list) and link and hops < 20:
        v = g.get(str(link[0])); ins = v.get("inputs") or {}
        if "switch" in str(v.get("class_type", "")).lower():
            sel = ins.get("switch"); on = None
            if isinstance(sel, list) and str(sel[0]) in g:
                on = (g[str(sel[0])].get("inputs") or {}).get("value")
            link = ins.get("on_true") if on else ins.get("on_false"); hops += 1; continue
        break
    return g.get(str(link[0]), {}).get("inputs", {}).get("value") if isinstance(link, list) else link

for tpl in ("comfy_workflows/ref2va.json", "comfy_workflows/fl2va.json"):
    base = json.loads(Path(tpl).read_text())
    name = tpl.split("/")[-1]
    for lora, st in ((False, 8), (False, 20), (True, 4)):
        g = worker._patch_workflow(copy.deepcopy(base), prompt="p", seed=1,
                                   frames=121, width=960, height=544, steps=st,
                                   images=["a.png"], use_lora=lora, cfg=1.0)
        check(f"{name}: sampler gets steps={st} through the switch (lora={lora})",
              _sampler_steps(g) == st, f"resolved {_sampler_steps(g)!r}")
        # the scheduler input is STILL a link (the switch was not severed)
        sch = next(v for v in g.values() if v.get("class_type") == "BasicScheduler")
        check(f"{name}: scheduler.steps stays a link, switch intact (lora={lora})",
              isinstance(sch["inputs"]["steps"], list), repr(sch["inputs"]["steps"]))
        ok, why = no_dangling(g)
        check(f"{name}: no dangling links after the steps fix (lora={lora})", ok, why)
        # the sampler chain has no LINK where a literal is required: sigmas ->
        # scheduler resolves to an int, guider -> a real model node
        samp = next(v for v in g.values() if v.get("class_type") == "SamplerCustomAdvanced")
        gd = g[str(samp["inputs"]["guider"][0])]["inputs"]["model"]
        gm = gd
        hops = 0
        while isinstance(gm, list) and gm and hops < 20:
            v = g.get(str(gm[0])); ins = v.get("inputs") or {}
            if "switch" in str(v.get("class_type", "")).lower():
                sel = ins.get("switch"); on = None
                if isinstance(sel, list) and str(sel[0]) in g:
                    on = (g[str(sel[0])].get("inputs") or {}).get("value")
                gm = ins.get("on_true") if on else ins.get("on_false"); hops += 1; continue
            break
        gmc = g.get(str(gm[0]), {}).get("class_type") if isinstance(gm, list) else None
        want = "LoraLoaderModelOnly" if lora else "UNETLoader"
        check(f"{name}: guider resolves to {want} for lora={lora}",
              gmc == want, f"got {gmc}")

# the diagnostic is read-only: it must not mutate the graph or raise
g = worker._patch_workflow(copy.deepcopy(json.loads(Path("comfy_workflows/ref2va.json").read_text())),
                           prompt="p", seed=1, frames=121, width=960, height=544,
                           steps=8, images=["a.png"], use_lora=False, cfg=1.0)
import copy as _c
snap = _c.deepcopy(g)
worker._diagnose_sampler(g)
check("diagnostic does not mutate the graph", g == snap)
worker._diagnose_sampler({})            # empty
worker._diagnose_sampler({"1": {"class_type": "SamplerCustomAdvanced"}})  # no inputs
check("diagnostic never raises on odd graphs", True)
# 2.99.1: the DIAG must RESOLVE steps through the switch, not cry "Errno-22 shape"
import io, contextlib
g2 = worker._patch_workflow(copy.deepcopy(json.loads(Path("comfy_workflows/ref2va.json").read_text())),
                            prompt="p", seed=1, frames=362, width=960, height=544,
                            steps=8, images=["a.jpg", "b.jpg"], use_lora=False, cfg=1.0)
buf = io.StringIO()
_real_say = worker.say
worker.say = lambda l: buf.write(str(l) + "\n")
try:
    worker._diagnose_sampler(g2)
finally:
    worker.say = _real_say
out = buf.getvalue()
check("DIAG resolves the switch-fed steps to a value (steps=8, switch intact)",
      "steps=8 (via" in out and "switch intact" in out, out)
check("DIAG no longer prints the false 'Errno-22 shape' warning for an intact switch",
      "Errno-22 shape" not in out, out)


# ---- 2.100.0: STEPS FOLLOW THE LoRA TOGGLE, PER WORKFLOW -------------------
# One Steps field used to push the fixed default 8 (a LoRA count) into every
# workflow, base-model runs included; Tim's own exports run the base at 20.
FL = json.loads(Path("comfy_workflows/fl2va.json").read_text())
TIM = json.loads(Path("comfy_workflows/ref2va_tim_0330.json").read_text())
check("auto steps: ref2va base model takes the template's on_false arm (20)",
      worker.resolve_steps(NAT, 0, False)[0] == 20, worker.resolve_steps(NAT, 0, False))
check("auto steps: ref2va with its 4-step LoRA on -> 4 (read from the file name)",
      worker.resolve_steps(NAT, 0, True)[0] == 4, worker.resolve_steps(NAT, 0, True))
check("auto steps: fl2va with its 8-step LoRA on -> 8 (a DIFFERENT count for a different workflow)",
      worker.resolve_steps(FL, 0, True)[0] == 8, worker.resolve_steps(FL, 0, True))
check("auto steps: fl2va base -> 20", worker.resolve_steps(FL, 0, False)[0] == 20)
check("auto steps: Tim's export (literal steps=20, no LoRA) -> 20",
      worker.resolve_steps(TIM, 0, False)[0] == 20, worker.resolve_steps(TIM, 0, False))
check("auto steps: LoRA on but the graph has no LoRA whose name says a count -> 8",
      worker.resolve_steps(TIM, 0, True)[0] == worker.LORA_STEPS_FALLBACK)
check("an explicit Steps still overrides both", worker.resolve_steps(NAT, 12, True) == (12, "steps=12 (explicit)"))
check("junk/None steps counts as auto", worker.resolve_steps(NAT, None, False)[0] == 20
      and worker.resolve_steps(NAT, "x", False)[0] == 20)
check("a graph with no scheduler literal at all falls back to BASE_STEPS=20",
      worker.resolve_steps({"1": {"class_type": "X", "inputs": {}}}, 0, False)[0] == worker.BASE_STEPS)
check("the resolved note is human-readable and names the source",
      "auto" in worker.resolve_steps(NAT, 0, True)[1] and "LoRA" in worker.resolve_steps(NAT, 0, True)[1])

# ---- VIDEO ACCELERATORS (2.116.0): sage + spectrum injection ---------------
# FL: guider 105:16 AND scheduler 105:9 both read the switch 105:122 -> both
# get the accel chain. NAT: guider 126 reads switch 141 but scheduler 124
# reads the RAW loader 127 -> only the guider is repointed (sigmas keep the
# plain model, exactly what the graph itself does).
ga = worker.apply_video_accel(copy.deepcopy(FL), {"sage": "off", "spectrum": "off"})[0]
check("accel off: the graph is untouched", ga == FL)
ga, notes = worker.apply_video_accel(copy.deepcopy(FL), {"sage": "auto"})
check("accel sage auto: PathchSageAttentionKJ injected with the mode",
      ga.get("h3sage", {}).get("class_type") == worker.ACCEL_SAGE_GENERIC
      and ga["h3sage"]["inputs"]["sage_attention"] == "auto"
      and ga["h3sage"]["inputs"]["model"] == ["105:122", 0], ga.get("h3sage"))
check("accel sage auto: guider AND scheduler repointed, the switch untouched",
      ga["105:16"]["inputs"]["model"] == ["h3sage", 0]
      and ga["105:9"]["inputs"]["model"] == ["h3sage", 0]
      and ga["105:122"]["inputs"]["on_true"] == FL["105:122"]["inputs"]["on_true"], notes)
gn, _ = worker.apply_video_accel(copy.deepcopy(NAT), {"sage": "auto"})
check("accel on ref2va: only the guider moves - the scheduler keeps the raw loader",
      gn["126"]["inputs"]["model"] == ["h3sage", 0]
      and gn["124"]["inputs"]["model"] == NAT["124"]["inputs"]["model"], gn["124"]["inputs"])
gs, notes = worker.apply_video_accel(copy.deepcopy(NAT), {"spectrum": "on"})
check("accel spectrum on: node enabled, model from the switch, NO preset keys "
      "(the server's own audio-safe defaults fill the rest at schema sync)",
      gs.get("h3spectrum", {}).get("class_type") == worker.ACCEL_SPECTRUM
      and gs["h3spectrum"]["inputs"] == {"model": ["141", 0], "enabled": True}
      and gs["126"]["inputs"]["model"] == ["h3spectrum", 0], gs.get("h3spectrum"))
gb, _ = worker.apply_video_accel(copy.deepcopy(FL), {"sage": "memeff", "spectrum": "aggressive"})
check("accel both: chain model -> sage -> spectrum -> guider, memeff has ONLY a model input",
      gb["h3sage"]["class_type"] == worker.ACCEL_SAGE_MEMEFF
      and gb["h3sage"]["inputs"] == {"model": ["105:122", 0]}
      and gb["h3spectrum"]["inputs"]["model"] == ["h3sage", 0]
      and gb["105:16"]["inputs"]["model"] == ["h3spectrum", 0], gb.get("h3sage"))
check("accel aggressive: the README preset's two knobs and nothing else extra",
      gb["h3spectrum"]["inputs"]["blend_weight"] == 0.75
      and gb["h3spectrum"]["inputs"]["flex_window"] == 3.0
      and set(gb["h3spectrum"]["inputs"]) == {"model", "enabled", "blend_weight", "flex_window"},
      gb["h3spectrum"]["inputs"])
G2 = {"1": {"class_type": "UNETLoader", "inputs": {"unet_name": "w"}},
      "3": {"class_type": "KSamplerAdvanced", "inputs": {"steps": 20, "cfg": 3.5, "model": ["1", 0]}}}
gk, notes = worker.apply_video_accel(copy.deepcopy(G2), {"sage": "auto", "spectrum": "on"})
check("accel on a non-H3 graph: Spectrum is SKIPPED with a note, generic sage still lands on the KSampler",
      "h3spectrum" not in gk and any("H3-only" in n for n in notes)
      and gk["3"]["inputs"]["model"] == ["h3sage", 0], notes)
gm, notes = worker.apply_video_accel(copy.deepcopy(G2), {"sage": "memeff"})
check("accel memeff on a non-H3 graph: skipped with a note, graph untouched",
      gm == G2 and any("memeff is H3-only" in n for n in notes), notes)
# ---- THE 15-SECOND CHARACTER RESET (2.130.0) ------------------------------
# Tim: "that workflow was meant to continue the video after 15 seconds but the
# characters completely change in mine after every 15 seconds." His template is
# MiniMaxH3ReferenceToVideo: ref_images.ref_image_0 and NO first_frame. The
# hand-off frame was landing in the reference slot while the real references had
# been thrown away, so every chunk re-rolled the character from one blurred frame.
REFT = json.loads((Path(__file__).resolve().parents[1]
                   / "comfy_workflows" / "h3_scene_api.json").read_text(encoding="utf-8"))
REFT = {k: v for k, v in REFT.items() if not str(k).startswith("_")}
check("the shipped H3 scene template really has NO keyframe slot (the premise)",
      worker._frame_slot_loaders(REFT) == {}, worker._frame_slot_loaders(REFT))
src, notes = worker._frame_sources(REFT, "fl2va", ["/r/char.png"], "/w/handoff_01.png", None)
check("continuation on a REFERENCE template sends the references AND the hand-off",
      src == ["/r/char.png", "/w/handoff_01.png"], src)
check("...and says why, naming the missing input rather than skipping it silently",
      any("no first_frame input" in n and "character" in n for n in notes), notes)
src2, notes2 = worker._frame_sources(REFT, "fl2va", [], "/w/handoff_01.png", None)
check("no anchor at all: the hand-off goes alone but the drift is PREDICTED, not hidden",
      src2 == ["/w/handoff_01.png"] and any("drift" in n for n in notes2), notes2)
KEYT = {"1": {"class_type": "LoadImage", "inputs": {"image": "a.png"}},
        "2": {"class_type": "LoadImage", "inputs": {"image": "b.png"}},
        "3": {"class_type": "MiniMaxH3ImageToVideo",
              "inputs": {"prompt": "", "first_frame": ["1", 0], "last_frame": ["2", 0]}}}
src3, notes3 = worker._frame_sources(KEYT, "fl2va", ["/r/char.png"], "/w/h.png", None)
check("a REAL keyframe template is untouched: keyframes only, references left out",
      src3 == ["/w/h.png"], src3)
check("...and that omission is stated too (no silent drop)",
      any("keyframe slots" in n for n in notes3), notes3)
check("ref2va is unchanged by any of this",
      worker._frame_sources(REFT, "ref2va", ["/r/a.png", "/r/b.png"], None, None)[0]
      == ["/r/a.png", "/r/b.png"])
check("t2va chunk 1 (no frames, no refs) sends nothing",
      worker._frame_sources(REFT, "t2va", [], None, None)[0] == [])
# the patcher must actually clone a slot for the extra image, or the fix is a lie
gp = worker._patch_workflow(copy.deepcopy(REFT), prompt="p", seed=1, frames=97,
                            width=640, height=352, steps=4, cfg=1.0,
                            images=["char.png", "handoff_01.png"],
                            videos=[], audios=[], use_lora=False)
gen = [v for v in gp.values() if "MiniMaxH3" in str(v.get("class_type"))][0]
slotk = sorted(k for k in gen["inputs"] if ".ref_image_" in k)
check("both images reach the gen node: a second ref slot is cloned for the hand-off",
      len(slotk) == 2, slotk)
loaded = sorted((gp[str(gen["inputs"][k][0])]["inputs"]["image"]) for k in slotk)
check("...and they are the character AND the hand-off, not one overwriting the other",
      loaded == ["char.png", "handoff_01.png"], loaded)
gz, notes = worker.apply_video_accel({"1": {"class_type": "X", "inputs": {}}},
                                     {"sage": "auto"})
check("accel with no model consumer anywhere: skipped with a note",
      any("no guider/sampler" in n for n in notes), notes)

# ---- DROPPING ONE ACCELERATOR (2.129.0) -----------------------------------
# The seatbelt: when a render dies because of a patch pack, that ONE node comes
# out and the graph is queued again. The chain must heal exactly like the LoRA
# bypass, and the accelerator that did NOT fail must survive untouched.
gb2, _ = worker.apply_video_accel(copy.deepcopy(FL), {"sage": "auto", "spectrum": "on"})
check("accel_nodes reports both injected accelerators with their class names",
      worker.accel_nodes(gb2) == {"h3sage": worker.ACCEL_SAGE_GENERIC,
                                  "h3spectrum": worker.ACCEL_SPECTRUM},
      worker.accel_nodes(gb2))
gd, ok = worker.drop_accel_node(copy.deepcopy(gb2), "h3spectrum")
check("drop spectrum: gone, its consumers fall back to SAGE, sage untouched",
      ok and "h3spectrum" not in gd and gd["105:16"]["inputs"]["model"] == ["h3sage", 0]
      and gd["105:9"]["inputs"]["model"] == ["h3sage", 0]
      and gd["h3sage"]["inputs"]["model"] == ["105:122", 0], gd.get("105:16"))
check("drop spectrum: the OTHER accelerator is still the graph's accelerator",
      worker.accel_nodes(gd) == {"h3sage": worker.ACCEL_SAGE_GENERIC})
gd2, ok2 = worker.drop_accel_node(copy.deepcopy(gb2), "h3sage")
check("drop sage from the MIDDLE of the chain: spectrum takes sage's own upstream",
      ok2 and "h3sage" not in gd2
      and gd2["h3spectrum"]["inputs"]["model"] == ["105:122", 0]
      and gd2["105:16"]["inputs"]["model"] == ["h3spectrum", 0], gd2.get("h3spectrum"))
gd3, ok3 = worker.drop_accel_node(copy.deepcopy(gd), "h3sage")
check("dropping the LAST accelerator restores the original wiring exactly",
      ok3 and worker.accel_nodes(gd3) == {}
      and gd3["105:16"]["inputs"]["model"] == FL["105:16"]["inputs"]["model"]
      and gd3["105:9"]["inputs"]["model"] == FL["105:9"]["inputs"]["model"], gd3["105:16"])
check("dropping a node that is not there changes nothing and says so",
      worker.drop_accel_node(copy.deepcopy(FL), "h3sage") == (FL, False))
check("a node with no upstream model link is NOT removed (that would break the graph)",
      worker.drop_accel_node({"h3sage": {"class_type": worker.ACCEL_SAGE_GENERIC,
                                         "inputs": {"sage_attention": "auto"}}},
                             "h3sage")[1] is False)
check("accel_nodes ignores a Sage node the WORKFLOW itself brought (only our ids/classes)",
      worker.accel_nodes({"77": {"class_type": worker.ACCEL_SAGE_GENERIC, "inputs": {}},
                          "h3sage": {"class_type": "SomethingElse", "inputs": {}}}) == {})
# preflight: 0.34's own MiniMaxH3SigmaShift present => warn that a Spectrum
# build older than that is the thing that fails in the sampler.
_pre_http, _pre_say = worker._http_json, worker.say
_pl = []
worker.say = lambda l: _pl.append(l)
worker._http_json = lambda url, *a, **k: ({"MiniMaxH3SigmaShift": {"input": {}}}
                                          if "MiniMaxH3SigmaShift" in url else {})
try:
    worker._accel_preflight("http://stub", gb2)
    _warned = list(_pl)
    _pl.clear()
    worker._accel_preflight("http://stub", gd)          # sage only, no spectrum
    _quiet = list(_pl)
    _pl.clear()
    worker._http_json = lambda *a, **k: {}              # pre-0.34 server
    worker._accel_preflight("http://stub", gb2)
    _old = list(_pl)
finally:
    worker._http_json, worker.say = _pre_http, _pre_say
check("preflight: Spectrum + a 0.34 ComfyUI gets the out-of-date-pack warning",
      any("MiniMaxH3SigmaShift" in l and "0.34" in l for l in _warned), _warned)
check("preflight: it promises the re-queue rather than a thrown-away render",
      any("re-queues" in l for l in _warned), _warned)
check("preflight: no Spectrum, nothing to warn about", _quiet == [], _quiet)
check("preflight: a ComfyUI without the native node says nothing", _old == [], _old)
# missing pack: _schema_sync must FAIL with install guidance when the server
# answers but the accel class is absent (the RH-pack pattern, generalized)
_real_http, _real_say = worker._http_json, worker.say
_lines = []
worker._http_json = lambda *a, **k: {}          # server answered; class absent
worker.say = lambda l: _lines.append(l)
try:
    worker._schema_sync("http://stub", {"h3spectrum": {
        "class_type": worker.ACCEL_SPECTRUM, "inputs": {"model": ["1", 0], "enabled": True}}})
    code = None
except SystemExit as e:
    code = e.code
finally:
    worker._http_json, worker.say = _real_http, _real_say
check("accel missing pack: schema sync fails (exit 2) and the message names the "
      "Spectrum repo to install",
      code == 2 and any("Spectrum" in l and "custom_nodes" in l for l in _lines), _lines[-1:])

# ---- LoRA SOURCES x ACCEL (2.116.2, Tim: "do loras work from the temporary
# lora's in basic settings and in style loras for both minimax h3 styles") ----
# Replicates comfy_generate's EXACT call order — apply_video_style (style +
# merged temp loras -> h3loraN) -> _patch_workflow (turbo toggle on the
# template's own lora) -> apply_video_accel — and asserts the settled chain:
#   UNET -> h3lora1 (style) -> h3lora2 (temp) -> switch [-> turbo when ON]
#        -> h3sage -> h3spectrum -> guider (+ scheduler, same src in fl2va)
_SS = {"name": "ss-proof",
       "loras": [{"path": "styleA.safetensors", "weight": 0.6},
                 {"path": "tempB.safetensors", "weight": 1.0}],
       "accel": {"sage": "auto", "spectrum": "on"}}


def _model_path(g, start, hops=12):
    path, cur = [], start
    for _ in range(hops):
        path.append(cur)
        ins = g.get(cur, {}).get("inputs") or {}
        nxt = ins.get("model") or ins.get("on_false")
        if not isinstance(nxt, list):
            break
        cur = str(nxt[0])
    return path


for _ul in (False, True):
    _g = copy.deepcopy(FL)
    _g, _ = worker.apply_video_style(_g, _SS)
    _g = worker._patch_workflow(_g, prompt="p", seed=1, frames=22, width=192,
                                height=108, steps=8, cfg=1.0, images=["x.png"],
                                videos=[], audios=[], use_lora=_ul, clip_device="")
    _g, _ = worker.apply_video_accel(_g, _SS["accel"])
    _p = _model_path(_g, str(_g["105:16"]["inputs"]["model"][0]))
    check(f"lora x accel (turbo {'ON' if _ul else 'OFF'}): guider <- spectrum <- sage, "
          "style+temp loras UPSTREAM of the accel chain",
          _p[0] == "h3spectrum" and _p[1] == "h3sage"
          and "h3lora1" in _p and "h3lora2" in _p
          and _p.index("h3sage") < _p.index("h3lora2") < _p.index("h3lora1"), _p)
    check(f"lora x accel (turbo {'ON' if _ul else 'OFF'}): the template's own turbo "
          f"lora is {'kept' if _ul else 'bypassed'}, h3loraN never is",
          ("105:121" in _g) == _ul
          and _g["h3lora1"]["inputs"]["lora_name"] == "styleA.safetensors"
          and _g["h3lora2"]["inputs"]["lora_name"] == "tempB.safetensors", sorted(_g))
    check(f"lora x accel (turbo {'ON' if _ul else 'OFF'}): the fl2va scheduler shares "
          "the accelerated model (same src as the guider)",
          str(_g["105:9"]["inputs"]["model"][0]) == "h3spectrum", _g["105:9"]["inputs"])

# ---- THE minimaxH3-I STYLE'S GRAPH (2.128.0) --------------------------------
# The style is only as good as this template surviving the patcher. Asserted
# against the SHIPPED file, so editing the template without re-checking fails
# here rather than on Tim's GPU.
_SCENE = json.loads((Path(__file__).resolve().parent.parent
                     / "comfy_workflows" / "h3_scene_api.json").read_text(encoding="utf-8"))
_p = worker._patch_workflow(copy.deepcopy(_SCENE), prompt="a viking boy waves", seed=1234,
                            frames=124, width=848, height=480, steps=20, images=["ref1.png"])
_gen = [v for v in _p.values() if "MiniMaxH3" in str(v.get("class_type"))]
check("minimaxH3-I graph: exactly one generation node, and it takes the prompt",
      len(_gen) == 1 and _gen[0]["inputs"]["prompt"] == "a viking boy waves", _gen)
check("minimaxH3-I graph: length/width/height are patched as literals",
      _gen[0]["inputs"]["length"] == 124 and _gen[0]["inputs"]["width"] == 848
      and _gen[0]["inputs"]["height"] == 480, _gen[0]["inputs"])
check("minimaxH3-I graph: the seed reaches RandomNoise",
      any(v["inputs"].get("noise_seed") == 1234 for v in _p.values()
          if v["class_type"] == "RandomNoise"), None)
check("minimaxH3-I graph: Basic Settings' Steps reaches the render (via the wired PrimitiveInt)",
      _p["247"]["inputs"]["value"] == 20, _p.get("247"))
check("minimaxH3-I graph: the reference dock's picture lands in LoadImage",
      any(v["inputs"].get("image") == "ref1.png" for v in _p.values()
          if v["class_type"] == "LoadImage"), None)
check("minimaxH3-I graph: the VIDEO output chain survives (a style must render video, not just audio)",
      all(any(v["class_type"] == c for v in _p.values())
          for c in ("VAEDecode", "VAEDecodeAudio", "CreateVideo", "SaveVideo")),
      sorted({v["class_type"] for v in _p.values()}))
check("minimaxH3-I graph: the detached duration helpers are pruned once length is a literal",
      not any(v["class_type"] in ("ComfyMathExpression", "PrimitiveFloat") for v in _p.values()),
      sorted({v["class_type"] for v in _p.values()}))
check("minimaxH3-I graph: every remaining wire points at a node that is still there",
      all(g0 in _p for v in _p.values() for x in v["inputs"].values()
          if isinstance(x, list) and x for g0 in [str(x[0])]), None)

# ---- the upscale bypass (2.140.0): fast renders strip the in-line stage ---
_mm3 = json.load(open(Path(__file__).resolve().parents[1] / "comfy_workflows" / "MM3_Characters.json"))
_su, _sur = worker._strip_upscale(copy.deepcopy(_mm3))
check("upscale bypass: the MM3 export's MMH3UltimateUpscale is removed by name",
      _sur == ["MMH3UltimateUpscale#5112"], _sur)
check("upscale bypass: BOTH decodes and the segment save are rewired to the "
      "un-upscaled sampler latent (30)",
      all(_su[c]["inputs"][k] == ["30", 0] for c, k in
          (("5113", "samples"), ("5114", "samples"), ("5122", "sampled_latent"))),
      {c: _su[c]["inputs"] for c in ("5113", "5114", "5122")})
check("upscale bypass: no surviving wire points at the removed node",
      not any(isinstance(x, list) and x and str(x[0]) == "5112"
              for v in _su.values() for x in (v.get("inputs") or {}).values()), None)
_nog, _nor = worker._strip_upscale({"1": {"class_type": "KSampler", "inputs": {}}})
check("upscale bypass: a graph with no upscaler is untouched and reports nothing",
      _nor == [] and "1" in _nog, _nor)
_unw = {"9": {"class_type": "MMH3UltimateUpscale", "inputs": {"latent": 5}}}
_ug, _urr = worker._strip_upscale(copy.deepcopy(_unw))
check("upscale bypass: an upscaler with no wired latent is LEFT IN, not removed "
      "(removing it would leave consumers dangling)",
      _urr == [] and "9" in _ug, (_urr, list(_ug)))
# patch with upscale=False must also sweep the stage's private feeders
_pf = worker._patch_workflow(copy.deepcopy(_mm3), prompt="p", seed=1, frames=39,
                             width=512, height=512, steps=0, images=[], upscale=False)
check("upscale bypass through _patch_workflow: the stage AND its private "
      "feeders (latent-upscale/split params) are gone from the queued graph",
      not any("UltimateUpscale" in v.get("class_type", "")
              or "LatentUpscaleWithModelParams" in v.get("class_type", "")
              or "SplitParams" in v.get("class_type", "") for v in _pf.values()),
      sorted({v["class_type"] for v in _pf.values()
              if "Upscale" in v.get("class_type", "") or "Split" in v.get("class_type", "")}))
_pk = worker._patch_workflow(copy.deepcopy(_mm3), prompt="p", seed=1, frames=39,
                             width=512, height=512, steps=0, images=[], upscale=True)
check("upscale kept (upscale=True): the stage survives the patch untouched",
      any("UltimateUpscale" in v.get("class_type", "") for v in _pk.values()), None)

# ---- THE SCHEDULED CHAIN'S VOICE LOADERS (2.144.0, Tim's Scene 1) ----------
# The MM3 chain's voice loaders are VHS_LoadAudioUpload. Missing from
# LOADER_KINDS, the worker reported "0/0 audio", left the tmp file's stale
# project-disk name in the node, and could never prune an unused voice slot.
# And pruning a mid-chain reference used to kill everything downstream of it
# (`previous` was not exempt from the cascade); now the chain HEALS.
def _chain_fixture():
    return {
        "37": {"class_type": "MiniMaxH3ScheduledReferenceToVideo",
               "inputs": {"prompt": "x", "length": 22, "width": 512, "height": 512,
                          "ref_image_size": "max",
                          "reference_schedule": ["char_voice_1", 0]}},
        "char_img_0": {"class_type": "LoadImage", "inputs": {"image": "stale_a.png"}},
        "char_pic_0": {"class_type": "MiniMaxH3ScheduledPictureReference",
                       "inputs": {"tag": "joan", "scenes": "all",
                                  "image": ["char_img_0", 0]}},
        "char_aud_0": {"class_type": "VHS_LoadAudioUpload",
                       "inputs": {"audio": "stale_a.wav", "start_time": 0, "duration": 30}},
        "char_voice_0": {"class_type": "MiniMaxH3ScheduledAudioReference",
                         "inputs": {"tag": "joan voice", "scenes": "all",
                                    "audio": ["char_aud_0", 0],
                                    "previous": ["char_pic_0", 0]}},
        "char_img_1": {"class_type": "LoadImage", "inputs": {"image": "stale_b.png"}},
        "char_pic_1": {"class_type": "MiniMaxH3ScheduledPictureReference",
                       "inputs": {"tag": "kev", "scenes": "all",
                                  "image": ["char_img_1", 0],
                                  "previous": ["char_voice_0", 0]}},
        "char_aud_1": {"class_type": "VHS_LoadAudioUpload",
                       "inputs": {"audio": "stale_b.wav", "start_time": 0, "duration": 30}},
        "char_voice_1": {"class_type": "MiniMaxH3ScheduledAudioReference",
                         "inputs": {"tag": "kev voice", "scenes": "all",
                                    "audio": ["char_aud_1", 0],
                                    "previous": ["char_pic_1", 0]}},
    }
import io as _io, contextlib as _ctx
_buf = _io.StringIO()
with _ctx.redirect_stdout(_buf):
    _cg = worker._patch_workflow(_chain_fixture(), prompt="p", seed=1, frames=22,
                                 width=512, height=512, steps=0,
                                 images=["u1.png", "u2.png"],
                                 audios=["w1.wav", "w2.wav"])
_clog = _buf.getvalue()
check("chain voices: both VHS_LoadAudioUpload slots take the UPLOADED names in order",
      _cg["char_aud_0"]["inputs"]["audio"] == "w1.wav"
      and _cg["char_aud_1"]["inputs"]["audio"] == "w2.wav",
      {k: _cg[k]["inputs"] for k in ("char_aud_0", "char_aud_1")})
check("chain voices: no stale project-disk name survives anywhere",
      "stale_" not in json.dumps(_cg), None)
check("chain voices: the slot report counts audio (2/2, not 0/0)",
      "2/2 audio" in _clog, _clog)
check("chain voices: every chain reference and the schedule wire survive a full fill",
      all(k in _cg for k in ("char_pic_0", "char_voice_0", "char_pic_1", "char_voice_1"))
      and _cg["37"]["inputs"]["reference_schedule"] == ["char_voice_1", 0], None)
_buf2 = _io.StringIO()
with _ctx.redirect_stdout(_buf2):
    _cg2 = worker._patch_workflow(_chain_fixture(), prompt="p", seed=1, frames=22,
                                  width=512, height=512, steps=0,
                                  images=["u1.png", "u2.png"], audios=["w1.wav"])
_clog2 = _buf2.getvalue()
check("chain voices: an unfilled voice loader is pruned and its reference removed",
      "char_aud_1" not in _cg2 and "char_voice_1" not in _cg2, sorted(_cg2))
check("chain voices: the chain HEALS through the gap — the schedule rewires to "
      "the removed reference's own previous, and nothing downstream dies with it",
      _cg2["37"]["inputs"]["reference_schedule"] == ["char_pic_1", 0]
      and all(k in _cg2 for k in ("char_pic_0", "char_voice_0", "char_pic_1")),
      _cg2["37"]["inputs"].get("reference_schedule"))
check("chain voices: the removed reference is REPORTED BY NAME with its tag",
      "chain reference char_voice_1" in _clog2 and "kev voice" in _clog2, _clog2)
check("chain voices: the report counts the shortfall (1/2 audio)",
      "1/2 audio" in _clog2, _clog2)
# ---- stable-tag repair (2.145.0, Tim's live error on char_voice_0) ---------
# The pack validates the tag widget ("stable tag such as 'hero_face'"); the
# fixture's tags deliberately carry SPACES (the shape of an old tmp file and
# of the verbatim MM3H-Character-ref demo tags) and must come out repaired -
# same tag, accepted spelling, said in the log.
check("stable tags: a spaced tag is repaired to underscores on the queued graph",
      _cg["char_voice_0"]["inputs"]["tag"] == "joan_voice"
      and _cg["char_pic_0"]["inputs"]["tag"] == "joan",
      {k: _cg[k]["inputs"]["tag"] for k in ("char_voice_0", "char_pic_0")})
check("stable tags: the repair is SAID, naming node, old and new",
      "tag 'joan voice' -> 'joan_voice' on char_voice_0" in _clog, _clog)
check("stable tags: an already-clean tag is left alone and not reported",
      "tag 'joan' ->" not in _clog and "tag 'kev' ->" not in _clog, _clog)
check("stable tags: no Scheduled reference in the queued graph carries a space",
      not any(" " in str((v.get("inputs") or {}).get("tag", ""))
              for v in _cg.values()
              if "Scheduled" in str(v.get("class_type", ""))
              and "Reference" in str(v.get("class_type", ""))), None)
_at = worker._patch_workflow({"9": {"class_type": "MiniMaxH3ScheduledPictureReference",
                                    "inputs": {"tag": "@Hero Face!", "scenes": "all"}},
                              "37": {"class_type": "MiniMaxH3ScheduledReferenceToVideo",
                                     "inputs": {"prompt": "x", "length": 22,
                                                "width": 64, "height": 64,
                                                "reference_schedule": ["9", 0]}}},
                             prompt="p", seed=1, frames=22, width=64, height=64,
                             steps=0, images=[])
check("stable tags: a leading @ survives the repair (the pack's own example allows it)",
      _at["9"]["inputs"]["tag"] == "@Hero_Face", _at["9"]["inputs"]["tag"])

# ---- THE CHAIN PIPELINE SURVIVES WHOLE (2.147.0, Tim: "high noise render
# that doesn't complete" on the character-ref workflow). Four defects, all on
# the SHIPPED MM3H_Character_ref.json, all pinned here:
#   1. resolve_steps took the upscale stage's BasicScheduler literal (steps=1,
#      denoise=0.2) as "the template's base literal" -> ONE step on the main
#      sampler = mostly noise. A partial-denoise scheduler is a REFINE pass.
#   2. the sink-ancestor prune kept only ancestors of ChainSegmentSave, so
#      ChainReview -> ChainLoopEnd -> ChainAssemble (DOWNSTREAM of it) were
#      deleted: the loop never closed, the film was never assembled.
#   3. the stamping loop overwrote ChainCurrent LINKS (per-shot prompt/seed/
#      length/size) with one literal each.
#   4. ChainReview enabled=True gates every segment on a reviewer an API run
#      does not have (10 min idle each).
_href = json.load(open(Path(__file__).resolve().parents[1] / "comfy_workflows"
                       / "MM3H_Character_ref.json"))
_hs, _hnote = worker.resolve_steps(_href, 0, False)
check("chain steps: auto NEVER takes the refine pass's literal 1 - the graph "
      "drives its own per-shot count (sentinel 0)",
      _hs == 0 and "per-shot" in _hnote, (_hs, _hnote))
check("chain steps: a non-chain graph still resolves its base literal (unchanged)",
      worker.resolve_steps({"1": {"class_type": "BasicScheduler",
                                  "inputs": {"steps": 20, "denoise": 1}}}, 0, False)[0] == 20)
check("chain steps: a refine scheduler (denoise<1) never supplies the base count",
      worker.resolve_steps({"1": {"class_type": "BasicScheduler",
                                  "inputs": {"steps": 1, "denoise": 0.2}}}, 0, False)[0]
      == worker.BASE_STEPS)
_sr = {"steps": 1, "denoise": 0.2}
check("set_steps: an explicit count leaves a refine scheduler at its exported 1",
      "refine" in worker._set_steps({}, _sr, 12) and _sr["steps"] == 1, _sr)
_sl = {"steps": ["21", 7]}
check("set_steps: an unresolvable LINK is left WIRED, never overwritten "
      "(the 2.127.0 rule)",
      "WIRED" in worker._set_steps({}, _sl, 12) and _sl["steps"] == ["21", 7], _sl)
_s0 = {"steps": 5}
check("set_steps: the 0 sentinel writes NOTHING (a 0 is a degenerate schedule)",
      "graph" in worker._set_steps({}, _s0, 0) and _s0["steps"] == 5, _s0)
_hb = _io.StringIO()
with _ctx.redirect_stdout(_hb):
    _hp = worker._patch_workflow(copy.deepcopy(_href), prompt="user prompt", seed=77,
                                 frames=121, width=960, height=544, steps=_hs,
                                 images=["sheet.png"], audios=["voice.wav"],
                                 upscale=True)
_hlog = _hb.getvalue()
check("chain tail: SegmentSave, Review, LoopEnd, Assemble AND both decodes survive",
      all(_hp.get(n) for n in ("5122", "48", "35", "36", "31", "32", "33")),
      sorted(set(_href) - set(_hp)))
check("chain links: the per-shot prompt/seed/length/steps stay WIRED to ChainCurrent",
      _hp["37"]["inputs"]["prompt"] == ["21", 4]
      and _hp["24"]["inputs"]["noise_seed"] == ["21", 5]
      and _hp["37"]["inputs"]["length"] == ["21", 6]
      and _hp["29"]["inputs"]["steps"] == ["21", 7], None)
check("chain links: ...and the log SAYS so, pointing at the screenplay",
      "ride the PLAN" in _hlog and "screenplay" in _hlog, _hlog)
check("chain refine: the upscale stage's scheduler keeps steps=1 denoise=0.2",
      _hp["5109"]["inputs"]["steps"] == 1 and _hp["5109"]["inputs"]["denoise"] == 0.2,
      _hp["5109"]["inputs"])
check("chain review: enabled is turned OFF for the API run, and said with the idle cost",
      _hp["48"]["inputs"]["enabled"] is False
      and "ChainReview#48 disabled" in _hlog and "10 min" in _hlog, _hlog)
_g2 = copy.deepcopy(_href)
_g2["48"]["inputs"]["enabled"] = False
_b2 = _io.StringIO()
with _ctx.redirect_stdout(_b2):
    worker._patch_workflow(_g2, prompt="p", seed=1, frames=22, width=64,
                           height=64, steps=0, images=[], upscale=True)
check("chain review: an export with review already off is left alone, unreported",
      "ChainReview" not in _b2.getvalue(), _b2.getvalue())

# ---- USER NODE BYPASS (2.177.0, "can we bypass nodes that aren't used and
# enable them when needed?") — physical removal with passthrough rewiring;
# refusal by name when no clean passthrough exists; sinks protected.
def _byp(g, spec):
    cfg = {"engine": {"comfy": {"node_bypass": spec}}}
    buf = _io.StringIO()
    with _ctx.redirect_stdout(buf):
        worker._apply_node_bypass(g, cfg)
    return buf.getvalue()

_bg = {
    "1": {"class_type": "SourceA", "inputs": {}},
    "2": {"class_type": "Passthru", "inputs": {"images": ["1", 0]}},
    "3": {"class_type": "SaveVideo", "inputs": {"video": ["2", 0]}},
}
_out = _byp(_bg, ["Passthru"])
check("single-input bypass: the consumer rewires straight through",
      "2" not in _bg and _bg["3"]["inputs"]["video"] == ["1", 0]
      and "removed Passthru#2" in _out, (_bg, _out))

_bg = {
    "1": {"class_type": "Model", "inputs": {}},
    "2": {"class_type": "Clip", "inputs": {}},
    "5": {"class_type": "Lora", "inputs": {"model": ["1", 0], "clip": ["2", 0]}},
    "6": {"class_type": "Guider", "inputs": {"model": ["5", 0]}},
    "7": {"class_type": "Encode", "inputs": {"clip": ["5", 1]}},
    "9": {"class_type": "SaveVideo", "inputs": {"video": ["6", 0]}},
}
_byp(_bg, ["#5"])
check("name-matched bypass: model->model and clip->clip each find their own lane",
      "5" not in _bg and _bg["6"]["inputs"]["model"] == ["1", 0]
      and _bg["7"]["inputs"]["clip"] == ["2", 0], _bg)

_bg = {
    "1": {"class_type": "A", "inputs": {}},
    "2": {"class_type": "B", "inputs": {}},
    "5": {"class_type": "Mixer", "inputs": {"a": ["1", 0], "b": ["2", 0]}},
    "6": {"class_type": "Sink2", "inputs": {"video": ["5", 0]}},
}
_out = _byp(_bg, ["Mixer"])
check("no clean passthrough: the bypass is REFUSED by name, the node stays",
      "5" in _bg and "REFUSED" in _out and "Mixer#5" in _out, _out)

_bg = {"3": {"class_type": "SaveVideo", "inputs": {}}}
_out = _byp(_bg, ["SaveVideo"])
check("a sink is never bypassed — the graph must keep its output",
      "3" in _bg and "a sink" in _out, _out)

_bg = {"1": {"class_type": "X", "inputs": {}}}
_out = _byp(_bg, ["NotHere"])
check("an absent class is said and skipped, never an error",
      "no NotHere in this graph" in _out, _out)

_bg = {
    "1": {"class_type": "Src", "inputs": {}},
    "2": {"class_type": "Hop", "inputs": {"x": ["1", 0]}},
    "3": {"class_type": "Hop", "inputs": {"x": ["2", 0]}},
    "4": {"class_type": "End", "inputs": {"x": ["3", 0]}},
}
_byp(_bg, ["Hop"])
check("a CHAIN of bypassed nodes resolves transitively to the source",
      "2" not in _bg and "3" not in _bg
      and _bg["4"]["inputs"]["x"] == ["1", 0], _bg)

# ---- Part C (2.223.13; fixture inlined 2.227.0): GENERIC patcher
# machinery — ImageBatchMulti slot grow/shrink, VHS_LoadVideo video fill,
# primitive+math helper detach-prune. The SHIPPED extend workflow was
# REMOVED in 2.227.0 (Tim verbatim: "remove the extend workflow, this
# workflow needs a node that corrupts the other h3 nodes"), but the worker
# machinery it exercised is generic and a USER's own style export can
# still reach it — so the old export lives on HERE as inert test data
# (never shipped, never queued), keeping the machinery pinned:
EXT = json.loads("""{
 "1": {
  "inputs": {
   "vae_name": "minimax_h3_video_vae_fp16.safetensors"
  },
  "class_type": "VAELoader",
  "_meta": {
   "title": "Load Video VAE"
  }
 },
 "2": {
  "inputs": {
   "vae_name": "minimax_h3_audio_vae_fp32.safetensors"
  },
  "class_type": "VAELoader",
  "_meta": {
   "title": "Load Audio VAE"
  }
 },
 "3": {
  "inputs": {
   "clip_name": "qwen3vl_32b_minimax_h3_int8_convrot.safetensors",
   "type": "minimax",
   "device": "default"
  },
  "class_type": "CLIPLoader",
  "_meta": {
   "title": "Load MiniMax CLIP"
  }
 },
 "4": {
  "inputs": {
   "unet_name": "minimax_h3_ref2va_pruned_int8_convrot.safetensors",
   "weight_dtype": "default"
  },
  "class_type": "UNETLoader",
  "_meta": {
   "title": "Load Diffusion Model"
  }
 },
 "5": {
  "inputs": {
   "video": "20260910-165503_1c548fbea3b7.mp4",
   "force_rate": 0,
   "custom_width": 0,
   "custom_height": 0,
   "frame_load_cap": 0,
   "skip_first_frames": 0,
   "select_every_nth": 1,
   "format": "AnimateDiff"
  },
  "class_type": "VHS_LoadVideo",
  "_meta": {
   "title": "Load prior shot"
  }
 },
 "12": {
  "inputs": {
   "shift_video": 12,
   "shift_audio": 6,
   "model": [
    "4",
    0
   ]
  },
  "class_type": "MiniMaxH3SigmaShift",
  "_meta": {
   "title": "Sigma Shift"
  }
 },
 "13": {
  "inputs": {
   "sampler_name": "res_multistep"
  },
  "class_type": "KSamplerSelect",
  "_meta": {
   "title": "Sampler Select"
  }
 },
 "14": {
  "inputs": {
   "scheduler": "linear_quadratic",
   "steps": 20,
   "denoise": 1,
   "model": [
    "12",
    0
   ]
  },
  "class_type": "BasicScheduler",
  "_meta": {
   "title": "Scheduler"
  }
 },
 "15": {
  "inputs": {
   "noise_seed": 475735739096761
  },
  "class_type": "RandomNoise",
  "_meta": {
   "title": "Noise"
  }
 },
 "16": {
  "inputs": {
   "model": [
    "12",
    0
   ],
   "conditioning": [
    "36",
    0
   ]
  },
  "class_type": "BasicGuider",
  "_meta": {
   "title": "Guider"
  }
 },
 "17": {
  "inputs": {
   "noise": [
    "15",
    0
   ],
   "guider": [
    "16",
    0
   ],
   "sampler": [
    "13",
    0
   ],
   "sigmas": [
    "14",
    0
   ],
   "latent_image": [
    "36",
    1
   ]
  },
  "class_type": "SamplerCustomAdvanced",
  "_meta": {
   "title": "Sample"
  }
 },
 "18": {
  "inputs": {
   "samples": [
    "17",
    0
   ],
   "vae": [
    "1",
    0
   ]
  },
  "class_type": "VAEDecode",
  "_meta": {
   "title": "Decode Video"
  }
 },
 "19": {
  "inputs": {
   "samples": [
    "17",
    0
   ],
   "vae": [
    "2",
    0
   ]
  },
  "class_type": "VAEDecodeAudio",
  "_meta": {
   "title": "Decode Audio"
  }
 },
 "20": {
  "inputs": {
   "fps": 24,
   "bit_depth": 8,
   "color_space": "sRGB",
   "images": [
    "18",
    0
   ],
   "audio": [
    "19",
    0
   ]
  },
  "class_type": "CreateVideo",
  "_meta": {
   "title": "Create Video"
  }
 },
 "21": {
  "inputs": {
   "filename_prefix": "video/job2",
   "format": "auto",
   "format.codec": "auto",
   "codec": "auto",
   "video": [
    "20",
    0
   ]
  },
  "class_type": "SaveVideo",
  "_meta": {
   "title": "Save Video"
  }
 },
 "22": {
  "inputs": {
   "value": 10
  },
  "class_type": "PrimitiveFloat",
  "_meta": {
   "title": "Float (Duration in Seconds)"
  }
 },
 "23": {
  "inputs": {
   "expression": "max(5, round(a * 24)) + (5 - (max(5, round(a * 24)) % 17)) % 17",
   "values.a": [
    "22",
    0
   ]
  },
  "class_type": "ComfyMathExpression",
  "_meta": {
   "title": "Math Expression"
  }
 },
 "34": {
  "inputs": {
   "vae": [
    "1",
    0
   ],
   "images": [
    "5",
    0
   ],
   "audio_vae": [
    "2",
    0
   ],
   "audio": [
    "5",
    2
   ]
  },
  "class_type": "MiniMaxH3EncodeAVPatched",
  "_meta": {
   "title": "MiniMax H3 Encode AV (Backported)"
  }
 },
 "35": {
  "inputs": {
   "image": "811555e0-c335-4787-8abd-01de32aec710_747+1.avif"
  },
  "class_type": "LoadImage",
  "_meta": {
   "title": "Load Image"
  }
 },
 "36": {
  "inputs": {
   "prompt": "amera zooms out and pans around the crashed plane in the middle of an islad, jungle and palm trees. the plane is behind him, split at the wing, the plane is burned and damaged",
   "length": [
    "23",
    1
   ],
   "context_frames": 12,
   "pin_last_frame": true,
   "ref_image_size": "match",
   "clip": [
    "3",
    0
   ],
   "vae": [
    "1",
    0
   ],
   "context_latent": [
    "34",
    0
   ],
   "audio_vae": [
    "2",
    0
   ],
   "ref_images": [
    "37",
    0
   ]
  },
  "class_type": "MiniMaxH3VideoExtendPatched",
  "_meta": {
   "title": "MiniMax H3 Video Extend (Backported)"
  }
 },
 "37": {
  "inputs": {
   "inputcount": 2,
   "Update inputs": null,
   "image_1": [
    "35",
    0
   ],
   "image_2": [
    "38",
    0
   ]
  },
  "class_type": "ImageBatchMulti",
  "_meta": {
   "title": "Image Batch Multi"
  }
 },
 "38": {
  "inputs": {
   "image": "air-china-boeing-747-400-b-2472-passenger-plane-with-chinese-president-onboard-landing-at-hamburg-airport-for-g20-summit_3_2.avif"
  },
  "class_type": "LoadImage",
  "_meta": {
   "title": "Load Image"
  }
 }
}""")


def _run_extend(n_imgs, videos=("take.mp4",)):
    return worker._patch_workflow(
        copy.deepcopy(EXT), prompt="P", seed=7, frames=125, width=832,
        height=480, steps=20, images=[f"r{i}.png" for i in range(n_imgs)],
        videos=list(videos), audios=[])


_g = _run_extend(2)
check("extend: prompt + literal length land on VideoExtendPatched, seed on RandomNoise",
      _g["36"]["inputs"]["prompt"] == "P" and _g["36"]["inputs"]["length"] == 125
      and _g["15"]["inputs"]["noise_seed"] == 7)
check("extend: the previous take fills VHS_LoadVideo (picture AND soundtrack ride 34)",
      _g["5"]["inputs"]["video"] == "take.mp4"
      and _g["34"]["inputs"]["images"] == ["5", 0]
      and _g["34"]["inputs"]["audio"] == ["5", 2])
check("extend: 2 pictures = the export as-is (inputcount 2, both slots, both files)",
      _g["37"]["inputs"]["inputcount"] == 2
      and _g["35"]["inputs"]["image"] == "r0.png"
      and _g["38"]["inputs"]["image"] == "r1.png")
check("extend: the detached duration helpers are pruned (math 23 + primitive 22)",
      "22" not in _g and "23" not in _g)
check("extend: context_frames/pin_last_frame/sampler/scheduler LEFT AS EXPORTED",
      _g["36"]["inputs"]["context_frames"] == 12
      and _g["36"]["inputs"]["pin_last_frame"] is True
      and _g["13"]["inputs"]["sampler_name"] == "res_multistep"
      and _g["14"]["inputs"]["scheduler"] == "linear_quadratic"
      and _g["14"]["inputs"]["steps"] == 20)

_g = _run_extend(1)
check("extend shrink: 1 picture drops image_2 + loader 38, inputcount 1, batch alive",
      "38" not in _g and _g["37"]["inputs"]["inputcount"] == 1
      and "image_2" not in _g["37"]["inputs"]
      and _g["37"]["inputs"]["image_1"] == ["35", 0]
      and _g["36"]["inputs"]["ref_images"] == ["37", 0])

_g = _run_extend(0)
check("extend bare: 0 pictures kill batch + both loaders; ref_images drops; gen node LIVES",
      "37" not in _g and "35" not in _g and "38" not in _g
      and "36" in _g and "ref_images" not in _g["36"]["inputs"]
      and _g["5"]["inputs"]["video"] == "take.mp4")

_g = _run_extend(4)
_ok = _g["37"]["inputs"]["inputcount"] == 4 and all(
    f"image_{i}" in _g["37"]["inputs"] for i in (1, 2, 3, 4))
_names = {_g[str(_g["37"]["inputs"][f"image_{i}"][0])]["inputs"]["image"]
          for i in (1, 2, 3, 4)} if _ok else set()
check("extend grow: 4 pictures clone 2 loaders, image_3/4 added, every file wired",
      _ok and _names == {"r0.png", "r1.png", "r2.png", "r3.png"}, str(_names))

# renumbering guard: an export numbered AGAINST loader-id order still reads
# contiguously after the shrink (image_1..N, never a gap)
_swapped = copy.deepcopy(EXT)
_swapped["37"]["inputs"]["image_1"] = ["38", 0]
_swapped["37"]["inputs"]["image_2"] = ["35", 0]
_g = worker._patch_workflow(_swapped, prompt="P", seed=7, frames=125,
                            width=832, height=480, steps=20,
                            images=["r0.png"], videos=["take.mp4"], audios=[])
check("extend shrink renumbers: survivors are contiguous image_1..N whatever the export's order",
      _g["37"]["inputs"]["inputcount"] == 1
      and _g["37"]["inputs"].get("image_1") == ["35", 0]
      and "image_2" not in _g["37"]["inputs"])

# ---- Part D (2.223.17): THE RUN TMP - "create a tmp workflow for each
# workflow ... then use the workflow name_tmp.json to generate. the original
# workflows won't be touched" (Tim, verbatim). Every queue attempt
# materializes the fully patched graph as <stem>_tmp.json beside its source
# export and queues what it just wrote.
import hashlib

_src = Path("comfy_workflows/ref2va.json")
_before = hashlib.sha256(_src.read_bytes()).hexdigest()
_g = json.loads(_src.read_text())
_tmp, _g2 = worker._write_run_tmp(str(_src), _g)
check("run tmp: ref2va.json materializes as ref2va_tmp.json and the queue gets THE FILE's content",
      _tmp.name == "ref2va_tmp.json" and json.loads(_tmp.read_text()) == _g2 == _g)
check("run tmp: the ORIGINAL export is untouched, byte for byte",
      hashlib.sha256(_src.read_bytes()).hexdigest() == _before)
_t2, _ = worker._write_run_tmp("comfy_workflows/MM3_Characters_tmp.json",
                               {"1": {"class_type": "X", "inputs": {}}})
check("run tmp: a stem already ending _tmp keeps its own name (never _tmp_tmp)",
      _t2.name == "MM3_Characters_tmp.json")
for _f in (_tmp, _t2):
    try: _f.unlink()
    except FileNotFoundError: pass
check("run tmp: every queue attempt writes it - the worker's _attempt calls the writer before /prompt",
      "_write_run_tmp(wf_src, graph)" in Path("misc/worker.py").read_text()
      and "run graph written" in Path("misc/worker.py").read_text())


# ---- Part E (2.225.0): _apply_refmods - Load H3 RefMods + Apply H3 RefMod
# spliced before the sampler on the NATIVE ref2va export. Node/input names
# verified against ComfyUI-MiniMaxH3Mod @ cd27d1109a0d (lib/refmods.js PIN).
_g = copy.deepcopy(NAT)
_r2v = next(k for k, v in _g.items()
            if "ReferenceToVideo" in v.get("class_type", ""))
_pre_consumers = [(nid, key) for nid, n in _g.items()
                  for key, v in (n.get("inputs") or {}).items()
                  if isinstance(v, list) and len(v) == 2
                  and str(v[0]) == _r2v and int(v[1]) == 0]
_g = worker._apply_refmods(_g, ["bitgen_jinx", "bitgen_rex"])
check("refmods: the loader and apply nodes are spliced in",
      _g.get("refmod_loader", {}).get("class_type") == "MiniMaxH3RefModsLoader"
      and _g.get("refmod_apply", {}).get("class_type") == "MiniMaxH3RefModApply")
_ld = _g["refmod_loader"]["inputs"]
check("refmods: loader slots mod_1..8 carry the names then '(none)', strength 1.0, copies 1",
      _ld["mod_1"] == "bitgen_jinx" and _ld["mod_2"] == "bitgen_rex"
      and all(_ld[f"mod_{i}"] == "(none)" for i in range(3, 9))
      and all(_ld[f"strength_{i}"] == 1.0 and _ld[f"copies_{i}"] == 1
              for i in range(1, 9)) and _ld["show_info"] is False)
_ap = _g["refmod_apply"]["inputs"]
check("refmods: apply reads the R2V conditioning and the loader bundle at official-parity settings",
      _ap["conditioning"] == [_r2v, 0] and _ap["mods"] == ["refmod_loader", 0]
      and _ap["retention"] == 1.0 and _ap["curve_direction"] == "constant"
      and _ap["override"] is False and _ap["scramble_seed"] == -1)
check("refmods: every former conditioning consumer now reads the APPLY output",
      _pre_consumers
      and all(_g[nid]["inputs"][key] == ["refmod_apply", 0]
              for nid, key in _pre_consumers))
check("refmods: the sampler's latent_image (R2V output 1) is untouched",
      any(isinstance(v, list) and len(v) == 2 and str(v[0]) == _r2v and v[1] == 1
          for n in _g.values() for v in (n.get("inputs") or {}).values()))
check("refmods: no names = byte-identical graph (the chain and plain flows never see this)",
      worker._apply_refmods(copy.deepcopy(NAT), []) == NAT
      and worker._apply_refmods(copy.deepcopy(NAT), None) == NAT)
_fl = json.loads(Path("comfy_workflows/img_sdxl_t2i.json").read_text())
check("refmods: a graph without an R2V node is left alone (a plain export passes through)",
      worker._apply_refmods(copy.deepcopy(_fl), ["bitgen_x"]) == _fl)
_g9 = worker._apply_refmods(copy.deepcopy(NAT), [f"m{i}" for i in range(10)])
check("refmods: a ninth mod stays out - the loader's 8 slots are the cap, said out loud",
      _g9["refmod_loader"]["inputs"]["mod_8"] == "m7"
      and "m8" not in json.dumps(_g9["refmod_loader"]["inputs"]))
check("refmods: the worker calls the splice right after the patcher (schema sync can then canonicalise it)",
      '_apply_refmods(g, params.get("refmods"))' in Path("misc/worker.py").read_text())

print("=" * 30)
print(f"{'ALL PASS' if not FAILED else 'FAILED: ' + ', '.join(FAILED)}")
sys.exit(1 if FAILED else 0)
