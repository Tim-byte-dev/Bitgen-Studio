#!/usr/bin/env python3
"""bitGen Studio — LTX 2.5 worker (2.338.0): mode "ltx".

Tim: "can we add ltx2.5 for our music video and screenplay and first/last
frame from reference images/audio/video option".

One job = one clip through ONE mode of Tim's "LTX 2.5 All-In-One" canvas
(comfy_workflows/LTX25_All_In_One.json, a UI export):
  1. upload the job's pictures / audio / video to ComfyUI's input folder;
  2. ask ComfyUI's /object_info, class by class, for every node the mode
     uses (scripts/ltx_convert.js classes) - a class it does not know fails
     here, by name, with the pack that provides it;
  3. convert the one-mode canvas into an API prompt with the app's own
     converter (scripts/ltx_convert.js convert: lib/ltxWorkflow.prepare +
     lib/graphToApi) run by the app's node (job.json node_exe; Electron runs
     as node with ELECTRON_RUN_AS_NODE=1);
  4. write the job's values in (scripts/ltx_graph.patch), queue, wait,
     download the VHS_VideoCombine mp4 (it carries LTX's own audio, or the
     lip-synced song) -> @@OUT.

2.339.0 LTX RIPPLE (params.ripple, the swap dialog's second engine): the
segment is cut first (scripts/ltx_graph.ripple_cut_args: 24 fps, the render
size, the last frame held to fill LTX's 8k+1) and loaded whole; the patch
swaps the IC-LoRA for LTX25_Ripple_v11 and feeds the guide the raw clip; the
take is trimmed back to the segment's frames with the ORIGINAL audio on.

2.401.5 (Tim: "maybe try to find another ltx workflow"): text / picture / first-last frame run on COMFY-ORG'S OWN LTX
2.5 templates (comfy_workflows/ltx25_official_*.json - core ComfyUI nodes only, lib/ltxOfficial.js fills them,
ltx_graph.official_finish puts a .gguf on UnetLoaderGGUF and chains the LoRAs) when ComfyUI has the LTX 2.5 files;
otherwise - or for Ripple, the camera guide, a transition LoRA, ltx_engine "canvas" - the canvas runs it, as before.

2.402.0 LTX 2.3 (Tim: "... can we use this lora and our blender bridge to layout a 3d scene in blender and render it in
bitgen using ltx2.3 - please add a style for ltx2.3"): a style of arch "ltx-2.3" runs ONLY Comfy-Org's LTX 2.3
templates (comfy_workflows/ltx23_official_*.json; t2v / i2v / flf / 3dreal) - no canvas fallback, a missing file or
node fails in words. 3dreal = the IC-LoRA template with fal's 3DREAL LoRA and the job's video (a Blender render sent by
the add-on, routes/blender.js POST /api/blender/scene) as the guide; without a picture the render's first frame
(ffmpeg) fills the bypassed first-frame input.
"""
import json
import os
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
import ltx_graph as LG
import basic_apply as _BA             # 2.409.0: Basic Settings' Override style - steps + cfg into the graph
import swap_graph as SG
import prompt_relay as _PR          # 2.592.0: ⏱ timed lines in the prompt = Prompt Relay (Nougan_Nodes / Kijai)

for _s in (sys.stdout, sys.stderr):
    try:
        _s.reconfigure(encoding="utf-8", errors="replace")
    except Exception:                                      # noqa: BLE001
        pass

VIDEO_EXT = (".mp4", ".webm", ".mov", ".mkv", ".gif")
# the packs Tim's canvas needs, by the classes they provide (for the error)
PACK_HINT = {
    "UnetLoaderGGUF": "ComfyUI-GGUF", "Power Lora Loader (rgthree)": "rgthree-comfy",
    "Any Switch (rgthree)": "rgthree-comfy", "mxSlider": "ComfyUI-mxToolkit",
    "ComfyMathExpression": "a core ComfyUI node - update ComfyUI (2.401.2: the canvas's math runs on it, ComfyMath is gone)",
    "easy cleanGpuUsed": "ComfyUI-Easy-Use", "ResolutionSelector": "the ResolutionSelector pack from Tim's canvas",
    "GetImageRangeFromBatch": "ComfyUI-KJNodes (2.401.3: the canvas's last-frame pick, was MediaMixer's FinalFrameSelector)",
    "ModelPreviewOverrideKJ": "ComfyUI-KJNodes", "VAELoaderKJ": "ComfyUI-KJNodes", "INTConstant": "ComfyUI-KJNodes",
    "LTXVImgToVideoInplaceKJ": "ComfyUI-KJNodes", "SimpleCalculatorKJ": "ComfyUI-KJNodes",
    "VHS_LoadVideo": "ComfyUI-VideoHelperSuite", "VHS_LoadAudioUpload": "ComfyUI-VideoHelperSuite",
    "VHS_VideoCombine": "ComfyUI-VideoHelperSuite", "DWPreprocessor": "comfyui_controlnet_aux",
    "DepthAnythingV2Preprocessor": "comfyui_controlnet_aux", "CannyEdgePreprocessor": "comfyui_controlnet_aux",
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


def first_video(outputs):
    for node_out in (outputs or {}).values():
        if not isinstance(node_out, dict):
            continue
        for lst in node_out.values():
            if not isinstance(lst, list):
                continue
            for it in lst:
                if isinstance(it, dict) and str(it.get("filename") or "").lower().endswith(VIDEO_EXT):
                    return it
    return None


def node_cmd(job):
    """The app's own node: Electron as node, or node on PATH."""
    exe = str(job.get("node_exe") or "") or shutil.which("node") or "node"
    env = dict(os.environ, ELECTRON_RUN_AS_NODE="1")
    return exe, env


def run_convert(job, args):
    exe, env = node_cmd(job)
    script = str(Path(job.get("app_dir") or Path(__file__).resolve().parent.parent) / "scripts" / "ltx_convert.js")
    r = subprocess.run([exe, script] + [str(a) for a in args], capture_output=True, text=True, env=env,
                       stdin=subprocess.DEVNULL, timeout=180)
    return r


def probe(p):
    """(duration, width, height, has_audio) of a video."""
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration:stream=codec_type,width,height",
                        "-of", "json", str(p)], capture_output=True, text=True)
    try:
        d = json.loads(r.stdout or "{}")
    except json.JSONDecodeError:
        d = {}
    v = [x for x in d.get("streams") or [] if x.get("codec_type") == "video"]
    a = any(x.get("codec_type") == "audio" for x in d.get("streams") or [])
    dur = float((d.get("format") or {}).get("duration") or 0)
    return dur, int((v[0] if v else {}).get("width") or 0), int((v[0] if v else {}).get("height") or 0), a


def run_ff(args, what):
    r = subprocess.run(args, capture_output=True, text=True)
    if r.returncode != 0:
        fail(f"ffmpeg failed {what}: {(r.stderr or '').strip()[-300:]}")


def ripple_lora(info, want):
    """The Ripple file as ComfyUI lists it (a subfolder is fine), or None."""
    spec = ((info.get("input") or {}).get("required") or {})
    names = []
    for v in spec.values():
        names += SG.combo_list(v) or []
    names = [str(n) for n in names if str(n).lower().endswith((".safetensors", ".ckpt", ".pt"))]
    if not names:
        return want, False                          # the server did not list its LoRAs - send ours
    for n in names:
        if Path(n.replace("\\", "/")).name.lower() == Path(want).name.lower():
            return n, True
    hit = [n for n in names if "ripple" in n.lower()]
    return (hit[0], True) if hit else (None, True)


def camera_loras(base, params, style):
    """The style's LoRAs + (2.399.0) the timeline 🎥 camera's LTX-2 camera LoRA from ComfyUI's loras."""
    style_loras = list(style.get("loras") or [])
    cl = params.get("camera_lora") if isinstance(params.get("camera_lora"), dict) else None
    if cl:
        names = []
        for ct in ("LoraLoaderModelOnly", "LoraLoader"):
            spec = (((_comfy.object_info(base, ct) or {}).get(ct) or {}).get("input") or {}).get("required") or {}
            names += SG.combo_list(spec.get("lora_name")) or []
        hit = LG.camera_lora(names, cl.get("re"))
        if hit:
            style_loras.append({"path": hit, "weight": float(cl.get("strength") or 1.0)})
            say(f"[camera] LTX camera LoRA {hit} ({cl.get('key')}) @ {float(cl.get('strength') or 1.0):g}")
        else:
            say(f"[camera] no LTX camera LoRA for {cl.get('key')} in ComfyUI's loras - the camera words carry it "
                f"(download {cl.get('file')} from huggingface.co/{cl.get('repo')} into ComfyUI/models/loras)")
    return style_loras


OFFICIAL = {"t2v": "ltx25_official_t2v.json", "i2v": "ltx25_official_i2v.json", "flf": "ltx25_official_flf2v.json"}
# 2.402.0: LTX 2.3 (styles of arch "ltx-2.3") - Comfy-Org's LTX 2.3 templates only; "3dreal" = the IC-LoRA template
# with fal's 3DREAL LoRA and the render as its control frames (Blender -> photoreal)
OFFICIAL23 = {"t2v": "ltx23_official_t2v.json", "i2v": "ltx23_official_i2v.json", "flf": "ltx23_official_flf2v.json",
              "3dreal": "ltx23_official_ic_lora.json"}


def family_of(style):
    return "ltx23" if str((style or {}).get("arch") or "") == "ltx-2.3" else "ltx25"


def official_template23(job, wf, lmode):
    """The LTX 2.3 template for this mode - LTX 2.3 has no canvas to fall back to, so anything else fails in words."""
    if lmode not in OFFICIAL23:
        fail(f"LTX 2.3 renders text / picture / first-last frame / 3D render -> real; '{lmode}' is an LTX 2.5 canvas "
             "mode (audio, lipsync, style transfer ...) - pick the LTX 2.5 style for it")
    for d in (wf.parent, Path(str(job.get("app_dir") or Path(__file__).resolve().parent.parent)) / "comfy_workflows"):
        p = d / OFFICIAL23[lmode]
        if p.is_file():
            return p
    fail(f"Comfy-Org's LTX 2.3 template {OFFICIAL23[lmode]} is missing - unzip the workflows zip at the install root")


def first_frame(src, work):
    """The render's first frame as a PNG (3DREAL's first-frame input when no real picture is given), or None."""
    if not shutil.which("ffmpeg"):
        return None
    dst = work / "render_first.png"
    r = subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(src), "-frames:v", "1", str(dst)],
                       capture_output=True, text=True)
    return dst if r.returncode == 0 and dst.is_file() else None


def official_template(job, params, wf, lmode, rp):
    """2.401.5: Comfy-Org's template for this job, or None (the canvas runs it): text / picture / first-last frame,
    not a Ripple or camera-guide job, no transition LoRA asked for, not forced onto the canvas (ltx_engine "canvas")."""
    if lmode not in OFFICIAL or rp or params.get("raw_guide") or str(params.get("ltx_engine") or "") == "canvas":
        return None
    if params.get("transition") is True:
        say("[worker] the transition LoRA was asked for - it lives on the LTX canvas, which runs this job")
        return None
    for d in (wf.parent, Path(str(job.get("app_dir") or Path(__file__).resolve().parent.parent)) / "comfy_workflows"):
        p = d / OFFICIAL[lmode]
        if p.is_file():
            return p
    say(f"[worker] Comfy-Org's LTX 2.5 template {OFFICIAL[lmode]} is not installed - the LTX canvas runs it")
    return None


def _listed(base, ct, key):
    spec = ((((_comfy.object_info(base, ct) or {}).get(ct) or {}).get("input") or {}).get("required") or {}).get(key)
    return [str(x) for x in (SG.combo_list(spec) or [])] if spec is not None else []


def run_official(job, params, cfg, base, lmode, style, images, tpl, work, output_dir, family="ltx25", vd=None, relay=(None, None)):
    """One clip on Comfy-Org's LTX template. True when done; False hands an LTX 2.5 job to the canvas (this ComfyUI
    lacks a core node / a file the template needs); fail() on anything else (LTX 2.3 always fails in words)."""
    fam = "LTX 2.3" if family == "ltx23" else "LTX 2.5"
    say(f"[worker] {fam} on Comfy-Org's own template {tpl.name} (core ComfyUI nodes only)")
    if family == "ltx23":
        # the checkpoints folder as ComfyUI lists it - the LTX audio-VAE loader lists the same folder (either answers)
        ck = _listed(base, "CheckpointLoaderSimple", "ckpt_name")
        ck += [x for x in _listed(base, "LTXVAudioVAELoader", "ckpt_name") if x not in ck]
        lists = {"ckpt": ck,
                 "te": _listed(base, "LTXAVTextEncoderLoader", "text_encoder"),
                 "loras": _listed(base, "LoraLoaderModelOnly", "lora_name"),
                 "upscale": _listed(base, "LatentUpscaleModelLoader", "model_name")}
    else:
        lists = {"unet": _listed(base, "UNETLoader", "unet_name"), "gguf": _listed(base, "UnetLoaderGGUF", "unet_name"),
                 "vae": _listed(base, "VAELoader", "vae_name"), "clip": _listed(base, "CLIPLoader", "clip_name"),
                 "upscale": _listed(base, "LatentUpscaleModelLoader", "model_name")}
    extra = {}
    if lmode == "3dreal":
        # 2.402.0: the render is the guide; a picture in the reference dock (a photoreal first frame) leads it,
        # else the render's own first frame only fills the first-frame input (bypassed)
        if not (vd or {}).get("name"):
            fail("3D render -> real needs the render: a video in the reference dock (or send the scene from Blender)")
        real = bool(images)
        if not real:
            src = Path(str((params.get("video") or {}).get("path") or ""))
            ff = first_frame(src, work) if src.is_file() else None
            if ff:
                images = [_comfy.upload_image(base, str(ff))]
            else:
                images = ["example.png"]
                say("[worker] (no ffmpeg - ComfyUI's example.png fills the bypassed first-frame input)")
        extra = {"video": vd["name"], "video_start": float((params.get("video") or {}).get("start") or 0),
                 "first_real": real, "ic_lora": params.get("ic_lora") or "", "ic_strength": params.get("ic_strength")}
    te = style.get("te")
    opts = work / "ltx_official_opts.json"
    opts.write_text(json.dumps({
        "family": family, "mode": lmode, "prompt": params.get("prompt") or "", "seconds": params.get("seconds") or 5,
        "width": params.get("width") or 1280, "height": params.get("height") or 720, "seed": int(params.get("seed") or 0),
        "fps": params.get("fps") or 24, "images": images, "prefix": "bitgen_ltx", "lists": lists,
        "style": {"model": (style.get("phases") or [{}])[0].get("model") or style.get("model") or "",
                  "te": (te[0] if te else "") if isinstance(te, list) else (te or "")}, **extra}), encoding="utf-8")
    r = run_convert(job, ["oclasses", tpl, opts])
    if r.returncode != 0:
        why = (r.stderr or r.stdout).strip().splitlines()[-1][:600] if (r.stderr or r.stdout).strip() else f"could not read {tpl.name}"
        if family == "ltx23":
            fail(why)
        say(f"[worker] {why} - the LTX canvas runs it")
        return False
    cl = json.loads(r.stdout or "{}")
    info, missing = {}, []
    for ct in cl.get("classes") or []:
        got = _comfy.object_info(base, ct)
        if isinstance(got, dict) and ct in got:
            info[ct] = got[ct]
        else:
            missing.append(ct)
    if (cl.get("models") or {}).get("gguf") and not lists["gguf"]:
        missing.append("UnetLoaderGGUF")
    if missing and family == "ltx23":
        fail("ComfyUI does not have these core node types, which Comfy-Org's LTX 2.3 template needs: "
             + ", ".join(missing) + " - update ComfyUI")
    if missing:
        say("[worker] this ComfyUI lacks " + ", ".join(missing) + " for Comfy-Org's template (update ComfyUI"
            + (" / install ComfyUI-GGUF" if "UnetLoaderGGUF" in missing else "") + ") - the LTX canvas runs it instead")
        return False
    for n in cl.get("notes") or []:
        say(f"[worker] {n}")
    ipath = work / "ltx_object_info.json"
    ipath.write_text(json.dumps(info), encoding="utf-8")
    out_json = work / "ltx_api.json"
    r = run_convert(job, ["oconvert", tpl, opts, ipath, out_json])
    if r.returncode != 0 or not out_json.is_file():
        fail(f"converting {tpl.name} failed: {(r.stderr or r.stdout).strip()[-400:]}")
    conv = json.loads(out_json.read_text(encoding="utf-8"))
    if not conv.get("graph"):
        fail("ComfyUI could not describe these node types: " + ", ".join(conv.get("unknown") or []))
    say(f"[worker] converted {tpl.name} ({lmode}) -> {len(conv['graph'])} nodes"
        + (f", {len(conv.get('warnings') or [])} note(s)" if conv.get("warnings") else ""))
    graph, notes = LG.official_finish(conv["graph"], {"models": conv.get("models") or {},
                                                      "style_loras": camera_loras(base, params, style),
                                                      "negative": params.get("negative") or style.get("negative") or ""})
    for n in notes:
        say(f"[worker] {n}")
    for n in _BA.apply(graph, params.get("basic")):      # 2.409.0: Override style ON = Basic Settings' steps / cfg
        say(f"[worker] {n}")
    graph = relay_apply(graph, relay[0], relay[1], params)   # 2.592.0: ⏱ Prompt Relay
    (work / "ltx_queued.json").write_text(json.dumps(graph, indent=1), encoding="utf-8")
    for nid, key, _old, new in _comfy.canonicalise_combos(base, graph):
        say(f"[worker]   node {nid}.{key}: matched ComfyUI's spelling -> {new}")
    say("[worker] ===== chunk 1/1")
    try:
        _comfy.clear_before_gen(base, cfg, say)
        pid, outputs = _CP.run(_comfy, base, graph, say, "rendering")
    except _comfy.ComfyError as e:
        fail(str(e))
    it = first_video(outputs)
    if not it:
        fail("ComfyUI finished but saved no video - Comfy-Org's template ends in SaveVideo")
    ext = Path(str(it.get("filename") or "")).suffix.lower() or ".mp4"
    name = _iname.reserve(output_dir, f"{_iname.build_stem(work.name, int(params.get('seed') or 0), time.time())}_ltx{ext}")
    _comfy.download(base, it, output_dir / name)
    if not (output_dir / name).exists() or (output_dir / name).stat().st_size == 0:
        fail(f"downloaded an empty file for {it.get('filename')}")
    say(f"[worker] file 1/1 written -> {name}")
    say("@@OUT " + name)
    say("[worker] ltx complete")
    return True


def relay_prepare(base, params):
    """2.592.0: timed lines in the prompt ([0-2s] ...) -> Prompt Relay when ComfyUI has PromptRelayEncode (Settings ▸
    Add-ons ▸ Nougan Nodes); the prompt the graph gets = the global lines (the node encodes the timed ones), or - without
    the node - one prompt from all of them. -> the parsed prompt + the node's object_info (None = not installed)."""
    rel = _PR.parse(params.get("prompt") or "")
    if not rel:
        return None, None
    try:
        spec = ((_comfy.object_info(base, _PR.NODE) or {}).get(_PR.NODE))
    except Exception:                                      # noqa: BLE001
        spec = None
    if not spec:
        params["prompt"] = _PR.flat(rel)
        say(f"[worker] ⏱ {len(rel['segments'])} timed line(s) in the prompt, but this ComfyUI has no Prompt Relay "
            f"({_PR.NODE} - Settings ▸ Add-ons ▸ Nougan Nodes, then restart ComfyUI): the clip renders them as ONE prompt")
        return None, None
    params["prompt"] = rel["global"] or _PR.flat(rel)
    return rel, spec


def relay_apply(graph, rel, spec, params):
    """2.592.0: wire Prompt Relay into the built graph; on a graph it cannot go into, the one-prompt fallback."""
    if not rel:
        return graph
    try:
        g2, notes = _PR.splice(graph, rel, params.get("seconds") or 5, params.get("fps") or 24, spec,
                               params.get("relay_epsilon"))
        for n in notes:
            say(f"[worker] {n}")
        if any(isinstance(v, dict) and v.get("class_type") in LG.OUTPUT_CLASSES for v in g2.values()):
            LG.prune(g2)                                   # the positive's own encoder is left with no reader
        return g2
    except ValueError as e:
        one = _PR.flat(rel)
        for n in graph.values():                           # the prompt's words where the graph holds them (an encoder,
            ins = n.get("inputs") or {}                    # a Primitive the template promoted it to ...)
            for k in ("text", "value", "prompt"):
                if isinstance(ins.get(k), str) and ins.get(k) == params.get("prompt"):
                    ins[k] = one
        say(f"[worker] ⏱ Prompt Relay could not be wired into this graph ({e}) - the timed lines render as ONE prompt")
        return graph


def main():
    if len(sys.argv) != 2:
        fail("usage: ltx_worker.py <job.json>")
    try:
        job = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as e:
        fail(f"cannot read job file: {e}")
    params, cfg = job["params"], job["config"]
    output_dir = Path(job["output_dir"])
    output_dir.mkdir(parents=True, exist_ok=True)
    work = Path.cwd()
    if params.get("mode") != "ltx":
        fail(f"ltx_worker.py only runs mode=ltx (got {params.get('mode')!r})")
    lmode = str(params.get("ltx_mode") or "t2v")
    style = params.get("video_style") if isinstance(params.get("video_style"), dict) else {}
    say(f"[worker] ltx_worker.py mode=ltx ltx_mode={lmode}" + (f" style={style.get('name')}" if style else ""))
    if _comfy is None:
        fail(f"the ComfyUI modules could not be imported: {_comfy_err}")
    wf = Path(str(params.get("workflow") or ""))
    if not wf.is_file():
        fail(f"the LTX workflow is missing: {wf} - unzip the workflows zip at the install root")

    base = _comfy.base_url(cfg)
    say(f"[worker] engine=comfy url={base}")
    try:
        _comfy.preflight(base)
    except _comfy.ComfyError as e:
        fail(str(e))

    relay, relay_spec = relay_prepare(base, params)       # 2.592.0: ⏱ timed lines -> Prompt Relay

    # 1. uploads
    def up(p, what):
        p = Path(str(p))
        if not p.is_file():
            fail(f"the {what} is missing: {p}")
        try:
            name = _comfy.upload_image(base, str(p))
        except Exception as e:                             # noqa: BLE001
            fail(f"could not upload the {what} to ComfyUI: {e}")
        say(f"[worker] uploaded {what} {p.name} -> {name}")
        return name
    images = [up(p, f"picture {i + 1}") for i, p in enumerate(params.get("images") or [])]
    audio = params.get("audio") if isinstance(params.get("audio"), dict) else {}
    video = params.get("video") if isinstance(params.get("video"), dict) else {}
    au = {"name": up(audio["path"], "audio"), "start": float(audio.get("start") or 0)} if audio.get("path") else {}
    rp = params.get("ripple") if isinstance(params.get("ripple"), dict) else None
    clip = None
    if rp:
        # 2.339.0: the segment cut at the render size, 8k+1 frames (the last
        # one held when the video ends first), its own audio kept for the mux
        for tool in ("ffmpeg", "ffprobe"):
            if not shutil.which(tool):
                fail(f"an LTX Ripple swap needs {tool} on PATH (winget install Gyan.FFmpeg)")
        src = Path(str(video.get("path") or ""))
        if not src.is_file():
            fail(f"the video to swap is missing: {src}")
        _d, sw, sh, _a = probe(src)
        if not (sw and sh):
            fail(f"could not read the size of {src.name} (is ffprobe installed?)")
        params["width"], params["height"] = LG.ripple_size(sw, sh, rp.get("short_side") or 544)
        clip = work / "ripple_clip.mp4"
        run_ff(LG.ripple_cut_args(src, clip, rp.get("start") or 0, int(rp["frames"]), params["width"], params["height"]),
               "cutting the segment")
        say(f"[worker] ripple: the segment {float(rp.get('start') or 0):.2f}s + {int(rp['trim_frames'])} frames of "
            f"{src.name}, cut at {params['width']}x{params['height']} as {int(rp['frames'])} frames")
        vd = {"name": up(clip, "segment clip"), "skip": 0}
    else:
        vd = {"name": up(video["path"], "video"), "skip": int(round(float(video.get("start") or 0) * int(params.get("fps") or 24)))} \
            if video.get("path") else {}

    # 2.401.5: text / picture / first-last frame run on Comfy-Org's own LTX 2.5 templates (core nodes only) -
    # Tim: "maybe try to find another ltx workflow"; the canvas keeps the modes only it has
    seed = int(params.get("seed", -1))
    if seed < 0:
        import random
        seed = random.randrange(0, 2 ** 31)
        say(f"[worker] seed -1 -> random seed {seed}")
        params["seed"] = seed
    family = family_of(style)
    if family == "ltx23":                       # 2.402.0: LTX 2.3 = Comfy-Org's templates only (no canvas)
        if rp:
            fail("LTX Ripple runs on LTX 2.5 - pick the LTX 2.5 style for the swap")
        run_official(job, params, cfg, base, lmode, style, images, official_template23(job, wf, lmode), work,
                     output_dir, family, vd, relay=(relay, relay_spec))
        return
    tpl = official_template(job, params, wf, lmode, rp)
    if tpl and run_official(job, params, cfg, base, lmode, style, images, tpl, work, output_dir, relay=(relay, relay_spec)):
        return

    # 2. the mode's classes, asked one by one
    opts = work / "ltx_opts.json"
    opts.write_text(json.dumps({"model": (style.get("phases") or [{}])[0].get("model") or style.get("model") or "",
                                "te": (style.get("te") or [""])[0] if isinstance(style.get("te"), list) else (style.get("te") or "")}),
                    encoding="utf-8")
    r = run_convert(job, ["classes", wf, lmode, opts])
    if r.returncode != 0:
        fail(f"could not read the LTX workflow's {lmode} mode: {(r.stderr or r.stdout).strip()[-400:]}")
    cl = json.loads(r.stdout or "{}")
    for n in cl.get("notes") or []:
        say(f"[worker] {n}")
    info, missing = {}, []
    for ct in cl.get("classes") or []:
        got = _comfy.object_info(base, ct)
        if isinstance(got, dict) and ct in got:
            info[ct] = got[ct]
        else:
            missing.append(ct)
    if missing:
        fail("ComfyUI does not have these node types, which the LTX 2.5 workflow needs: "
             + ", ".join(f"{m} ({PACK_HINT.get(m, 'install the missing custom nodes')})" for m in missing)
             + ". Manager -> Install Missing Custom Nodes, then restart ComfyUI.")
    ic = None
    if rp:
        name, listed = ripple_lora(info.get("LTXICLoRALoaderModelOnly") or {}, rp.get("lora") or "LTX25_Ripple_v11.safetensors")
        if not name:
            fail("the LTX Ripple LoRA is not in ComfyUI's loras folder - download LTX25_Ripple_v11.safetensors "
                 "(Setup -> Models -> LTX Ripple, or huggingface.co/WepeNerd/LTX-Ripple) into ComfyUI/models/loras")
        ic = {"name": name, "strength": float(rp.get("strength") or 1.35)}
        say(f"[worker] ripple: IC-LoRA {name} @ {ic['strength']:g}" + ("" if listed else " (ComfyUI did not list its LoRAs)"))
    # 2.399.0: the timeline's 🎥 camera - its LTX-2 camera LoRA (the main move) from ComfyUI's loras; the exact path is
    # the depth guide as this v2v job's video, fed RAW to the IC guide (routes/ltx.js set raw_guide)
    style_loras = camera_loras(base, params, style)
    if params.get("raw_guide") and not rp:
        say("[camera] the exact path: the depth guide is the IC guide's video, read as depth (no preprocessor)")
    ipath = work / "ltx_object_info.json"
    ipath.write_text(json.dumps(info), encoding="utf-8")

    # 3. the API prompt
    out_json = work / "ltx_api.json"
    r = run_convert(job, ["convert", wf, lmode, opts, ipath, out_json])
    if r.returncode != 0 or not out_json.is_file():
        fail(f"converting the LTX workflow failed: {(r.stderr or r.stdout).strip()[-400:]}")
    conv = json.loads(out_json.read_text(encoding="utf-8"))
    if not conv.get("graph"):
        fail("ComfyUI could not describe these node types: " + ", ".join(conv.get("unknown") or []))
    say(f"[worker] converted {wf.name} ({lmode}) -> {len(conv['graph'])} nodes"
        + (f", {len(conv.get('warnings') or [])} note(s)" if conv.get("warnings") else ""))

    # 4. values, queue, output
    try:
        graph, notes = LG.patch(conv["graph"], {
            "mode": lmode, "prompt": params.get("prompt") or "", "negative": params.get("negative") or style.get("negative") or "",
            "images": images, "audio": au, "video": vd, "seconds": params.get("seconds") or 5,
            "fps": params.get("fps") or 24, "width": params.get("width"), "height": params.get("height"),
            "seed": seed, "prefix": "bitgen_ltx", "style_loras": style_loras,
            "transition": params.get("transition"),
            **({"frames": int(rp["frames"]), "ic_lora": ic, "raw_guide": True} if rp else {}),
            **({"raw_guide": True} if params.get("raw_guide") and not rp else {}),
        })
    except ValueError as e:
        fail(str(e))
    for n in notes:
        say(f"[worker] {n}")
    for n in _BA.apply(graph, params.get("basic")):      # 2.409.0: Override style ON = Basic Settings' steps / cfg
        say(f"[worker] {n}")
    graph = relay_apply(graph, relay, relay_spec, params)   # 2.592.0: ⏱ Prompt Relay
    (work / "ltx_queued.json").write_text(json.dumps(graph, indent=1), encoding="utf-8")
    for nid, key, _old, new in _comfy.canonicalise_combos(base, graph):
        say(f"[worker]   node {nid}.{key}: matched ComfyUI's spelling -> {new}")
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
        fail("ComfyUI finished but saved no video - the LTX workflow must end in VHS_VideoCombine")
    stem = _iname.build_stem(work.name, seed, time.time())
    ext = Path(str(it.get("filename") or "")).suffix.lower() or ".mp4"
    if rp:
        raw = work / ("ripple_raw" + ext)
        _comfy.download(base, it, raw)
        if not raw.exists() or raw.stat().st_size == 0:
            fail(f"downloaded an empty file for {it.get('filename')}")
        name = _iname.reserve(output_dir, f"{stem}_ripple.mp4")
        has_a = probe(clip)[3]
        run_ff(LG.ripple_finish_args(raw, clip, output_dir / name, int(rp["trim_frames"]), has_a),
               "trimming the take and putting the original audio back")
        say(f"[worker] ripple: trimmed to the segment's {int(rp['trim_frames'])} frames"
            + (", the original audio on" if has_a else " (the video has no audio)"))
    else:
        name = _iname.reserve(output_dir, f"{stem}_ltx{ext}")
        _comfy.download(base, it, output_dir / name)
    if not (output_dir / name).exists() or (output_dir / name).stat().st_size == 0:
        fail(f"downloaded an empty file for {it.get('filename')}")
    say(f"[worker] file 1/1 written -> {name}")
    say("@@OUT " + name)
    say("[worker] ltx complete")


if __name__ == "__main__":
    main()
