#!/usr/bin/env python3
"""bitGen Studio — Viggle-Animate swap worker (2.344.0): mode "viggle".

Tim: "can you see if we can add viggle to our styles\\workflow" (with
API-viggle-animate-h3_workflow-v1.2.0.json). One segment of the swap dialog
through Viggle-Animate on MiniMax H3 (comfy_workflows/viggle_animate_h3_api.json,
patched by scripts/viggle_graph.py):

  1. the segment cut from the source at the render size, 24 fps, exactly its
     frames (scripts/ltx_graph.ripple_cut_args), its audio kept;
  2. the ✎ first frame (the character repainted into the segment's first
     frame) + the clip uploaded;
  3. every node class asked of ComfyUI: the Viggle pack's / VHS's missing =
     fail in words with the pack; the speed patches missing = stepped over;
     the models (the Viggle H3 finetune, the DMD LoRA, the text conditioning,
     the H3 video VAE) matched to ComfyUI's own lists;
  4. patch -> queue -> wait -> the VHS_VideoCombine video;
  5. trimmed to the segment's frames, the ORIGINAL audio muxed back -> @@OUT.
"""
import json
import random
import shutil
import signal
import subprocess
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent / "scripts"))
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
import viggle_graph as VG

for _s in (sys.stdout, sys.stderr):
    try:
        _s.reconfigure(encoding="utf-8", errors="replace")
    except Exception:                                      # noqa: BLE001
        pass

VIDEO_EXT = (".mp4", ".webm", ".mov", ".mkv", ".gif")
PACK = "ComfyUI-Viggle-Animate-H3 (github.com/Saganaki22/ComfyUI-Viggle-Animate-H3)"
PACK_HINT = {
    "ViggleAnimateConditioning": PACK, "ViggleTextCondLoader": PACK,
    "CustomSigmas": "ComfyUI-KJNodes", "VHS_LoadVideo": "ComfyUI-VideoHelperSuite",
    "VHS_VideoCombine": "ComfyUI-VideoHelperSuite",
    "MiniMaxH3SigmaShift": "a newer ComfyUI with MiniMax H3 (update it)",
}
HF = "huggingface.co/drbaph/Viggle-Animate-ComfyUI"
# what each loader must find in ComfyUI's list: (class, input, pattern, what, where)
MODELS = (
    ("UNETLoader", "unet_name", r"ref2va_viggle", "the Viggle-Animate H3 model", f"{HF} diffusion_models/ -> ComfyUI/models/diffusion_models"),
    ("LoraLoaderModelOnly", "lora_name", r"viggle_animate_dmd", "the Viggle DMD LoRA", f"{HF} loras/ -> ComfyUI/models/loras"),
    ("ViggleTextCondLoader", "text_cond", r"fixed_embed|viggle|\.safetensors$", "the Viggle text conditioning",
     f"{HF} text_cond/fixed_embed_fwd_anyframe.safetensors -> ComfyUI/models/text_cond"),
    ("VAELoader", "vae_name", r"minimax_h3_video_vae", "the MiniMax H3 video VAE",
     "Settings -> Models -> Model catalog -> MiniMax H3 video VAE (ComfyUI/models/vae)"),
)


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


def count_frames(p):
    r = subprocess.run(["ffprobe", "-v", "error", "-count_packets", "-select_streams", "v:0", "-show_entries",
                        "stream=nb_read_packets", "-of", "csv=p=0", str(p)], capture_output=True, text=True)
    try:
        return int((r.stdout or "").strip().split(",")[0])
    except ValueError:
        return 0


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


def pick(names, want, pattern):
    """The template's file as ComfyUI lists it (by base name), else the one
    file matching the pattern, else None. No list -> the template's own."""
    return MM.best(names, want, pattern)[0]            # 2.345.0: the shared matcher (scripts/model_match.py)


def main():
    if len(sys.argv) != 2:
        fail("usage: viggle_worker.py <job.json>")
    try:
        job = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as e:
        fail(f"cannot read job file: {e}")
    params, cfg = job["params"], job["config"]
    output_dir = Path(job["output_dir"])
    output_dir.mkdir(parents=True, exist_ok=True)
    work = Path.cwd()
    if params.get("mode") != "viggle":
        fail(f"viggle_worker.py only runs mode=viggle (got {params.get('mode')!r})")
    say("[worker] viggle_worker.py mode=viggle (Viggle-Animate on MiniMax H3)")
    if _comfy is None:
        fail(f"the ComfyUI modules could not be imported: {_comfy_err}")
    for tool in ("ffmpeg", "ffprobe"):
        if not shutil.which(tool):
            fail(f"a Viggle swap needs {tool} on PATH (winget install Gyan.FFmpeg)")
    wf = Path(str(params.get("workflow") or ""))
    src = Path(str(params.get("video") or ""))
    img = Path(str(params.get("image") or ""))
    for label, p in (("Viggle workflow", wf), ("video to swap", src), ("edited first frame", img)):
        if not p.is_file():
            fail(f"the {label} is missing: {p}" + (" - it ships in the full zip's comfy_workflows folder" if label == "Viggle workflow" else ""))
    try:
        template = json.loads(wf.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as e:
        fail(f"cannot read {wf.name}: {e}")

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
        width, height = VG.size(sw, sh, params.get("short_side") or VG.SHORT)
    frames = int(params.get("frames") or 120)
    # 2.351.0: H3 renders 17n+5 frames (124..362) - the segment is rendered at
    # the next valid count and trimmed back to its own frames at the end
    render_n = VG.align_frames(frames)
    if render_n > VG.MAX_FRAMES:
        fail(f"a Viggle segment can be at most {VG.MAX_FRAMES} frames ({VG.MAX_FRAMES / 24:.2f} s) - this one is {frames}; split it")
    clip = work / "viggle_clip.mp4"
    run_ff(LG.ripple_cut_args(src, clip, params.get("start") or 0, render_n, width, height), "cutting the segment")
    say(f"[worker] viggle: the segment {float(params.get('start') or 0):.2f}s + {frames} frames of {src.name}, cut at {width}x{height}"
        + (f" - rendered as {render_n} frames (H3 makes 17n+5, at least 124), trimmed back after" if render_n != frames else ""))

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

    # 3. the classes: the speed patches are optional
    seed = int(params.get("seed", -1))
    if seed < 0:
        seed = random.randrange(0, 2 ** 31)
        say(f"[worker] seed random -> {seed}")
    info, missing = {}, []
    for ct in sorted({v.get("class_type") for k, v in template.items() if isinstance(v, dict) and not str(k).startswith("_")}):
        got = _comfy.object_info(base, ct)
        if isinstance(got, dict) and ct in got:
            info[ct] = got[ct]
        else:
            missing.append(ct)
    skip = [m for m in missing if m in VG.OPTIONAL]
    # 2.346.0 (Tim's run: ComfyUI-SolAttn_triton ABORTED ComfyUI at the first
    # step - "Fatal Python error: Aborted" in _morton_h3.py): Sol-Attn is off
    # unless ⚙ "Sol-Attn speed patch" is ticked
    if not params.get("speed_patch") and "SolAttnPatch" not in skip and "SolAttnPatch" in info:
        skip.append("SolAttnPatch")
        say("[worker] the Sol-Attn speed patch is off (⚙ Viggle: speed patches) - it crashed ComfyUI on a real run")
    g0 = {k: v for k, v in template.items() if not str(k).startswith("_")}
    if skip:
        VG.bypass(g0, skip)
        absent = [m for m in skip if m in missing]
        if absent:
            say(f"[worker] this ComfyUI has no {', '.join(absent)} - stepped over (a speed patch, not needed)")
    try:
        graph, notes = VG.patch(g0, {
            "image": img_name, "video": clip_name, "width": width, "height": height, "frames": render_n,
            "seed": seed, "steps": params.get("steps"), "strength": params.get("strength"),
            "loras": [{"name": l.get("path"), "weight": l.get("weight", 1.0)} for l in (params.get("loras") or []) if l.get("path")],
            "prefix": "bitgen_viggle",
        })
    except ValueError as e:
        fail(str(e))
    need = [m for m in missing if m not in VG.OPTIONAL and any(v.get("class_type") == m for v in graph.values())]
    if need:
        fail("ComfyUI does not have these node types, which Viggle needs: "
             + ", ".join(f"{m} ({PACK_HINT.get(m, 'install the missing custom nodes')})" for m in need)
             + ". Settings -> Setup -> node packs (or Manager -> Install Missing Custom Nodes), then restart ComfyUI.")
    # the models, as ComfyUI lists them
    for ct, key, pat, what, where in MODELS:
        spec = ((info.get(ct) or {}).get("input") or {})
        listed = SG.combo_list((spec.get("required") or {}).get(key) or (spec.get("optional") or {}).get(key))
        for k, v in graph.items():
            if v.get("class_type") != ct or k.startswith("vl"):
                continue
            want = v["inputs"].get(key)
            if not isinstance(want, str):
                continue
            name = pick(listed, want, pat)
            if name is None:
                fail(f"{what} is not in ComfyUI ({Path(want.replace(chr(92), '/')).name}) - download it: {where}")
            v["inputs"][key] = name
    for k, v in graph.items():                              # the swap LoRAs
        if k.startswith("vl"):
            listed = SG.lora_names(info, "LoraLoaderModelOnly")
            name = pick(listed, v["inputs"]["lora_name"], r"^$")
            if name is None:
                fail(f"the LoRA {v['inputs']['lora_name']} is not in ComfyUI's loras folder")
            v["inputs"]["lora_name"] = name
    for n in notes:
        say(f"[worker] {n}")
    # 2.350.0 (Tim: "the Viggle render came back ALL BLACK ... this was with
    # viggle"): fp16 accumulation (the template has it ON) is a speed patch too
    if VG.fp16_accumulation(graph, bool(params.get("speed_patch"))):
        say("[worker] fp16 accumulation " + ("on (⚙ Viggle: speed patches)" if params.get("speed_patch")
                                             else "off - it can turn a take black (⚙ Viggle: speed patches turns it on)"))
    vae_spec = ((info.get("VAELoader") or {}).get("input") or {})
    vae_names = SG.combo_list((vae_spec.get("required") or {}).get("vae_name") or (vae_spec.get("optional") or {}).get("vae_name"))
    safe_used = []
    if params.get("safe"):
        graph, safe_used = VG.safe_mode(graph, vae_names)
        say("[worker] ⚙ Viggle safe mode: " + ("; ".join(safe_used) or "nothing to change in this graph"))
    (work / "viggle_queued.json").write_text(json.dumps(graph, indent=1), encoding="utf-8")
    for nid, key, _old, new in _comfy.canonicalise_combos(base, graph):
        say(f"[worker]   node {nid}.{key}: matched ComfyUI's spelling -> {new}")

    # 4. render
    def render(g, tag, label):
        say(f"[worker] ===== {label}")
        try:
            _comfy.clear_before_gen(base, cfg, say)
            # 2.401.3: live "[comfy] step v/m" lines from ComfyUI's websocket (scripts/comfy_progress.py) - the job's
            # progress, the queue card and the status bar move instead of saying "loading" until the end
            pid, outputs = _CP.run(_comfy, base, g, say, "rendering")
        except _comfy.ComfyError as e:
            fail(str(e))
        it = first_video(outputs)
        if not it:
            fail("ComfyUI finished but saved no video - the Viggle workflow must end in VHS_VideoCombine")
        out = work / ("viggle_raw" + tag + (Path(str(it.get("filename"))).suffix.lower() or ".mp4"))
        _comfy.download(base, it, out)
        if not out.exists() or out.stat().st_size == 0:
            fail(f"downloaded an empty file for {it.get('filename')}")
        return out
    raw = render(graph, "", "chunk 1/1")
    # 2.348.0 (Tim: "now it is only rendering a black video"): never file a black take as done
    if BC.all_black(raw):
        # 2.350.0: ... and before giving up, ONE more go with everything that
        # can make NaNs switched off (same seed, so it is the settings)
        g2, changes = (graph, []) if params.get("safe") or params.get("safe_retry") is False else VG.safe_mode(graph, vae_names)
        if not changes:
            fail(BC.reason("Viggle", safe=bool(params.get("safe"))))
        say("[worker] the take came back ALL BLACK - rendering it again in safe mode: " + "; ".join(changes))
        (work / "viggle_queued_safe.json").write_text(json.dumps(g2, indent=1), encoding="utf-8")
        raw = render(g2, "_safe", "chunk 1/1 (safe mode)")
        if BC.all_black(raw):
            fail(BC.reason("Viggle", safe=True))
        say("[worker] safe mode fixed it (" + "; ".join(changes) + ") - ⚙ Viggle safe mode is switched on for the next renders")

    # 5. the segment's frames, the original sound
    got = count_frames(raw)
    keep = min(frames, got) if got else frames
    stem = _iname.build_stem(work.name, seed, time.time())
    name = _iname.reserve(output_dir, f"{stem}_viggle.mp4")
    has_a = probe(clip)[3]
    run_ff(RG.finish_args(raw, clip, output_dir / name, keep, has_a, drop_first=False), "trimming the take and putting the original audio back")
    say(f"[worker] viggle: {keep} frames kept" + (f" (Viggle made {got} of {frames})" if got and got < frames else "")
        + (", the original audio on" if has_a else " (the video has no audio)"))
    say(f"[worker] file 1/1 written -> {name}")
    say("@@OUT " + name)
    say("[worker] viggle complete")


if __name__ == "__main__":
    main()
