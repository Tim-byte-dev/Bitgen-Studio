#!/usr/bin/env python3
"""bitGen Studio — LTX Ripple swap worker (2.342.0): mode "ripple".

Tim: "use this workflow for the character swap, i tested it in comfy and it
works". One segment of the swap dialog through HIS workflow
(comfy_workflows/LTX_Ripple_FFAF_Edit_v11_api.json - converted once from his
UI export by scripts/ui_named_to_api.py; scripts/ripple_graph.py patches it):

  1. the segment cut from the source at the render size, 24 fps, exactly
     Frames (8k+1) frames - the last one held when the video ends first
     (scripts/ltx_graph.ripple_cut_args), its audio kept;
  2. the edited first frame + the clip uploaded;
  3. every node class asked of ComfyUI (a missing one named with its pack);
     the Ripple LoRA and the swap LoRAs matched to ComfyUI's own list;
  4. patch -> queue -> wait -> the VHS_VideoCombine video;
  5. the still at frame 0 dropped, the segment's frames kept, the ORIGINAL
     audio muxed back (scripts/ripple_graph.finish_args) -> @@OUT.
"""
import json
import random
import shutil
import signal
import subprocess
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))
try:
    import comfy_client as _comfy
except Exception as _e:                                    # noqa: BLE001
    _comfy, _comfy_err = None, _e
import image_name as _iname
import comfy_progress as _CP          # 2.401.3: live step lines from ComfyUI's websocket
import black_check as BC
import ltx_graph as LG
import model_match as MM
import ripple_graph as RG
import swap_graph as SG

for _s in (sys.stdout, sys.stderr):
    try:
        _s.reconfigure(encoding="utf-8", errors="replace")
    except Exception:                                      # noqa: BLE001
        pass

VIDEO_EXT = (".mp4", ".webm", ".mov", ".mkv", ".gif")
PACK_HINT = {
    "Frames Slice": "RES4LYF", "LTXAddVideoICLoRAGuide": "ComfyUI-LTXVideo",
    "ImageResizeKJv2": "ComfyUI-KJNodes", "INTConstant": "ComfyUI-KJNodes", "VAELoaderKJ": "ComfyUI-KJNodes",
    "PathchSageAttentionKJ": "ComfyUI-KJNodes", "LTX2MemoryEfficientSageAttentionPatch": "ComfyUI-KJNodes",
    "VHS_LoadVideo": "ComfyUI-VideoHelperSuite", "VHS_VideoCombine": "ComfyUI-VideoHelperSuite",
    "SeedNode": "a newer ComfyUI (update it)", "ComfyNumberConvert": "a newer ComfyUI (update it)",
    "BatchImagesNode": "a newer ComfyUI (update it)",
}


# 2.345.0: the model loaders in Tim's workflow -> (input, the kind of file, what, where)
MODELS = {
    "UNETLoader": ("unet_name", r"ltx.?2\.?5.*(22b|19b|transformer|distilled|dev)", "the LTX 2.5 model",
                   "put the LTX 2.5 transformer in ComfyUI/models/diffusion_models (Settings -> Models -> Model catalog -> LTX 2.5)"),
    "VAELoader": ("vae_name", r"ltx.?2\.?5.*video.?vae", "the LTX 2.5 video VAE",
                  "Model catalog -> LTX 2.5 video VAE (conv) into ComfyUI/models/vae"),
    "VAELoaderKJ": ("vae_name", r"ltx.?2\.?5.*audio.?vae", "the LTX 2.5 audio VAE",
                    "Model catalog -> LTX 2.5 audio VAE into ComfyUI/models/vae"),
    "CLIPLoader": ("clip_name", r"gemma", "the LTX text encoder (Gemma)",
                   "Model catalog -> LTX 2.5 text encoder into ComfyUI/models/text_encoders"),
}


def say(line):
    try:
        print(line, flush=True)
    except UnicodeEncodeError:
        print(line.encode("ascii", "replace").decode("ascii"), flush=True)


def fail(msg):
    say("[worker] ERROR: " + msg)
    sys.exit(1)


for _sig in (signal.SIGTERM, signal.SIGINT):
    try:
        signal.signal(_sig, lambda *_: sys.exit(143))
    except Exception:                                      # noqa: BLE001
        pass


def probe(p):
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration:stream=codec_type,width,height",
                        "-of", "json", str(p)], capture_output=True, text=True)
    try:
        d = json.loads(r.stdout or "{}")
    except json.JSONDecodeError:
        d = {}
    v = [x for x in d.get("streams") or [] if x.get("codec_type") == "video"]
    a = any(x.get("codec_type") == "audio" for x in d.get("streams") or [])
    return (float((d.get("format") or {}).get("duration") or 0), int((v[0] if v else {}).get("width") or 0),
            int((v[0] if v else {}).get("height") or 0), a)


def run_ff(args, what):
    r = subprocess.run(args, capture_output=True, text=True)
    if r.returncode != 0:
        fail(f"ffmpeg failed {what}: {(r.stderr or '').strip()[-300:]}")


def first_video(outputs):
    for node_out in (outputs or {}).values():
        if isinstance(node_out, dict):
            for lst in node_out.values():
                if isinstance(lst, list):
                    for it in lst:
                        if isinstance(it, dict) and str(it.get("filename") or "").lower().endswith(VIDEO_EXT):
                            return it
    return None


def match_lora(names, want):
    """want (a file name, maybe with a folder) -> the name as ComfyUI lists it."""
    if not names:
        return want, False
    base = Path(str(want).replace("\\", "/")).name.lower()
    for n in names:
        if Path(n.replace("\\", "/")).name.lower() == base:
            return n, True
    return None, True


def main():
    if len(sys.argv) != 2:
        fail("usage: ripple_worker.py <job.json>")
    try:
        job = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as e:
        fail(f"cannot read job file: {e}")
    params, cfg = job["params"], job["config"]
    output_dir = Path(job["output_dir"])
    output_dir.mkdir(parents=True, exist_ok=True)
    work = Path.cwd()
    if params.get("mode") != "ripple":
        fail(f"ripple_worker.py only runs mode=ripple (got {params.get('mode')!r})")
    say("[worker] ripple_worker.py mode=ripple (Tim's LTX_Ripple_FFAF_Edit_v11)")
    if _comfy is None:
        fail(f"the ComfyUI modules could not be imported: {_comfy_err}")
    for tool in ("ffmpeg", "ffprobe"):
        if not shutil.which(tool):
            fail(f"an LTX Ripple swap needs {tool} on PATH (winget install Gyan.FFmpeg)")
    wf = Path(str(params.get("workflow") or ""))
    src = Path(str(params.get("video") or ""))
    img = Path(str(params.get("image") or ""))
    for label, p in (("Ripple workflow", wf), ("video to swap", src), ("edited first frame", img)):
        if not p.is_file():
            fail(f"the {label} is missing: {p}" + (" - it ships in the full zip's comfy_workflows folder" if label == "Ripple workflow" else ""))
    try:
        template = json.loads(wf.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as e:
        fail(f"cannot read {wf.name}: {e}")
    template = {k: v for k, v in template.items() if not k.startswith("_")}

    base = _comfy.base_url(cfg)
    say(f"[worker] engine=comfy url={base}")
    try:
        _comfy.preflight(base)
    except _comfy.ComfyError as e:
        fail(str(e))

    # 1. the size + the cut
    _d, sw, sh, _a = probe(src)
    width, height = int(params.get("width") or 0), int(params.get("height") or 0)
    if not (width and height):
        if not (sw and sh):
            fail(f"could not read the size of {src.name} (is ffprobe installed?)")
        width, height = LG.ripple_size(sw, sh, params.get("short_side") or 768)
    frames = int(params.get("frames") or RG.render_frames(params.get("trim_frames") or 120))
    keep = int(params.get("trim_frames") or frames - 1)
    clip = work / "ripple_clip.mp4"
    run_ff(LG.ripple_cut_args(src, clip, params.get("start") or 0, frames, width, height), "cutting the segment")
    say(f"[worker] ripple: the segment {float(params.get('start') or 0):.2f}s + {keep} frames of {src.name}, "
        f"cut at {width}x{height} as {frames} frames")

    # 2. uploads
    def up(p, what):
        try:
            name = _comfy.upload_image(base, str(p))
        except Exception as e:                             # noqa: BLE001
            fail(f"could not upload the {what} to ComfyUI: {e}")
        say(f"[worker] uploaded {what} {Path(p).name} -> {name}")
        return name
    img_name = up(img, "first frame")
    clip_name = up(clip, "segment clip")

    # 3. the classes + the LoRAs
    seed = int(params.get("seed", -1))
    if seed < 0:
        seed = random.randrange(0, 2 ** 31)
        say(f"[worker] seed random -> {seed}")
    try:
        graph, notes = RG.patch(template, {
            "image": img_name, "video": clip_name, "width": width, "height": height, "frames": frames,
            "fps": 24, "seed": seed, "steps": params.get("steps"), "prompt": params.get("prompt") or "",
            "negative": params.get("negative") or "", "strength": params.get("strength"),
            "loras": [{"name": l.get("path"), "weight": l.get("weight", 1.0)} for l in (params.get("loras") or []) if l.get("path")],
            "prefix": "bitgen_ripple",
        })
    except ValueError as e:
        fail(str(e))
    missing, info = [], {}
    for ct in sorted({v.get("class_type") for v in graph.values()}):
        got = _comfy.object_info(base, ct)
        if isinstance(got, dict) and ct in got:
            info[ct] = got[ct]
        else:
            missing.append(ct)
    if missing:
        fail("ComfyUI does not have these node types, which LTX Ripple needs: "
             + ", ".join(f"{m} ({PACK_HINT.get(m, 'install the missing custom nodes')})" for m in missing)
             + ". Manager -> Install Missing Custom Nodes, then restart ComfyUI.")
    loras = SG.lora_names(info, "LoraLoaderModelOnly")
    for k, v in graph.items():
        if v.get("class_type") != "LoraLoaderModelOnly":
            continue
        want = v["inputs"].get("lora_name")
        name, listed = match_lora(loras, want)
        if name is None:
            if RG.RIPPLE_RE.search(str(want)):
                fail("the LTX Ripple LoRA is not in ComfyUI's loras folder - download LTX25_Ripple_v11.safetensors "
                     "(Settings -> Models -> Model catalog -> LTX Ripple, or huggingface.co/WepeNerd/LTX-Ripple) into ComfyUI/models/loras")
            fail(f"the LoRA {want} is not in ComfyUI's loras folder")
        v["inputs"]["lora_name"] = name
    # 2.345.0 (Tim's run: "Value not in list [unet_name] = ltx-2.5-22b-distilled-
    # transformer-comfy-int8-convrot.safetensors"): every model the workflow
    # names -> the name THIS ComfyUI lists (a subfolder, or the same kind)
    for k, v in graph.items():
        spec = MODELS.get(v.get("class_type"))
        if not spec:
            continue
        key, pat, what, where = spec
        want = v["inputs"].get(key)
        if not isinstance(want, str):
            continue
        sp = ((info.get(v["class_type"]) or {}).get("input") or {})
        listed = SG.combo_list((sp.get("required") or {}).get(key) or (sp.get("optional") or {}).get(key))
        name, how = MM.best(listed, want, pat)
        if name is None:
            fail(f"{what} is not in ComfyUI: the workflow names {want}, and nothing like it is in "
                 f"{v['class_type']}.{key} ({len(listed)} files listed) - {where}")
        if how in ("subfolder", "similar"):
            say(f"[worker] {what}: {want} -> {name} (as your ComfyUI lists it"
                + (", the closest file of that kind" if how == "similar" else "") + ")")
        v["inputs"][key] = name
    for n in notes:
        say(f"[worker] {n}")
    (work / "ripple_queued.json").write_text(json.dumps(graph, indent=1), encoding="utf-8")
    for nid, key, _old, new in _comfy.canonicalise_combos(base, graph):
        say(f"[worker]   node {nid}.{key}: matched ComfyUI's spelling -> {new}")

    # 4. render
    say("[worker] ===== chunk 1/1")
    try:
        _comfy.clear_before_gen(base, cfg, say)
        # 2.401.3: live "[comfy] step v/m" lines from ComfyUI's websocket (scripts/comfy_progress.py) - the job's
        # progress, the queue card and the status bar move instead of saying "loading" until the end
        pid, outputs = _CP.run(_comfy, base, graph, say, "rendering")
    except _comfy.ComfyError as e:
        fail(str(e))
    it = first_video(outputs)
    if not it:
        fail("ComfyUI finished but saved no video - the Ripple workflow must end in VHS_VideoCombine")
    raw = work / ("ripple_raw" + (Path(str(it.get("filename"))).suffix.lower() or ".mp4"))
    _comfy.download(base, it, raw)
    if not raw.exists() or raw.stat().st_size == 0:
        fail(f"downloaded an empty file for {it.get('filename')}")
    # 2.348.0 (Tim: "now it is only rendering a black video"): never file a black take as done
    if BC.all_black(raw):
        fail(BC.reason("LTX Ripple"))

    # 5. the still off, the segment's frames, the original sound
    stem = _iname.build_stem(work.name, seed, time.time())
    name = _iname.reserve(output_dir, f"{stem}_ripple.mp4")
    has_a = probe(clip)[3]
    run_ff(RG.finish_args(raw, clip, output_dir / name, keep, has_a), "trimming the take and putting the original audio back")
    say(f"[worker] ripple: the still at frame 0 dropped, {keep} frames kept"
        + (", the original audio on" if has_a else " (the video has no audio)"))
    say(f"[worker] file 1/1 written -> {name}")
    say("@@OUT " + name)
    say("[worker] ripple complete")


if __name__ == "__main__":
    main()
