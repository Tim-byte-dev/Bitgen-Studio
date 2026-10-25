#!/usr/bin/env python3
"""bitGen Studio — the IMAGE generation worker.

A SEPARATE worker from worker.py, on purpose and by instruction. worker.py owns
video: the 4n+1 / 17k+5 frame grids, the 361-frame single-run ceiling, chunked
fl2va hand-off, seam-drop joining, the progressive preview and the timeline
compile. None of that applies to a still image, and every one of those rules is
actively wrong for one. Two files means a change to image defaults cannot
perturb a video render, and a crash in one cannot take the other down.

It is launched exactly like worker.py — `python image_worker.py <job.json>` —
and speaks the SAME control protocol back to lib/core.js, because the queue,
the log pane and the progress bar are shared:

    @@CMD <json argv>          the command line, for "Copy command"
    @@OUT <filename>           THE output file (relative to output_dir)
    @@OUTS <json [filenames]>  every file this job produced (batch renders)
    [worker] ===== chunk i/N   progress — the stable protocol string core.js
                               parses; image i of N reuses it so the progress
                               bar works with no change to the parser.

The argv itself is built by scripts/image_gen.py, which reads the shared
lib/imageArch.json catalogue. This file runs things; that file decides them.
"""
import json
import os
import re
import signal
import subprocess
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))
try:
    import image_gen as _img
except Exception as _e:                                    # noqa: BLE001
    _img, _img_err = None, _e
try:
    import comfy_image as _cimg
    import comfy_client as _comfy
    import comfy_progress as _cprog       # 2.574.0: live "[comfy] step v/m" lines for pictures too
except Exception as _e3:                                   # noqa: BLE001
    _cimg, _comfy, _comfy_err = None, None, _e3
# THE one place that decides what a generated still is called. Imported rather
# than inlined so the comfy path and the sd-cli path cannot name files
# differently, and so the rules are testable without a GPU. Stdlib only, so it
# has no reason to fail to import; if it somehow did, naming is not something to
# limp along with a fallback for, so the failure is left loud.
import image_name as _iname

# Windows consoles default to cp1252; force UTF-8 (with replacement) so a log
# line can never crash the worker with UnicodeEncodeError. Same guard as
# worker.py — worker log strings stay ASCII regardless.
for _s in (sys.stdout, sys.stderr):
    try:
        _s.reconfigure(encoding="utf-8", errors="replace")
    except Exception:                                      # noqa: BLE001
        pass

RUN_ENV = {}
CHILD = None


def say(line: str) -> None:
    try:
        print(line, flush=True)
    except UnicodeEncodeError:
        print(line.encode("ascii", "replace").decode("ascii"), flush=True)


def fail(msg: str) -> None:
    say("[worker] ERROR: " + msg)
    sys.exit(1)


def on_term(signum, _frame):
    """Cancel must kill the child, not just this process."""
    global CHILD
    if CHILD and CHILD.poll() is None:
        try:
            CHILD.kill()
        except Exception:                                  # noqa: BLE001
            pass
    sys.exit(143)


for _sig in (signal.SIGTERM, signal.SIGINT):
    try:
        signal.signal(_sig, on_term)
    except Exception:                                      # noqa: BLE001
        pass


def run(argv, echo_cmd=True) -> int:
    global CHILD
    if echo_cmd:
        say("[worker] $ " + " ".join(str(a) for a in argv))
    env = dict(os.environ)
    env.update(RUN_ENV)
    CHILD = subprocess.Popen([str(a) for a in argv], stdout=subprocess.PIPE,
                             stderr=subprocess.STDOUT, env=env)
    # 2.574.0: sd-cli redraws its progress bar with \r ("|=====>   | 3/20 - 1.23s/it") - each redraw is a line, so
    # the job's step (lib/jobMeta) follows the sampler instead of arriving all at once at the end
    buf = b""
    while True:
        chunk = CHILD.stdout.read1(4096) if hasattr(CHILD.stdout, "read1") else CHILD.stdout.read(4096)
        if not chunk:
            break
        buf += chunk
        parts = re.split(rb"\r\n|\r|\n", buf)
        buf = parts.pop()
        for raw in parts:
            if raw.strip():
                say(raw.decode("utf-8", "replace"))
    if buf.strip():
        say(buf.decode("utf-8", "replace"))
    CHILD.stdout.close()
    rc = CHILD.wait()
    CHILD = None
    return rc


def require(label: str, p: str) -> None:
    if not p or not Path(p).exists():
        fail(f"{label} not found: {p or '(not set)'} — fix it in Settings -> Image.")


def resolve(app_dir: str, p: str) -> str:
    """An app-relative style path made absolute.

    Styles STORE paths app-relative wherever possible (the same convention the
    Settings file picker uses: a pick under the app folder is stored relative to
    it) so a saved style survives the app folder being moved or the whole
    install being copied to another machine. But the worker's cwd is the JOB
    directory, several levels down, so a relative path resolves to nothing there
    — which reads as "model not found" for a file that is plainly present.
    Resolve at USE time, never at save time.
    """
    s = str(p or "").strip()
    if not s or os.path.isabs(s):
        return s
    return os.path.normpath(os.path.join(app_dir, s))


def resolve_style(app_dir: str, style: dict) -> dict:
    """A copy of the style with every on-disk path resolved. The stored style is
    never mutated — it stays portable."""
    s = dict(style)
    s["model"] = resolve(app_dir, s.get("model"))
    if str(s.get("vae") or "").strip():
        s["vae"] = resolve(app_dir, s.get("vae"))
    s["te"] = [resolve(app_dir, t) if str(t or "").strip() else ""
               for t in (s.get("te") or [])]
    # LoRA paths are resolved for the EXISTENCE CHECK only; the command line
    # carries the file's stem and lets sd-cli resolve it against
    # --lora-model-dir, so a resolved path here must not change the token.
    s["loras"] = [dict(l or {}) for l in (s.get("loras") or [])]
    return s


def run_comfy(params, cfg, style, output_dir, stem, batch, seed, graph_hook=None):
    """Render through the user's ComfyUI.

    NOTHING IS RESOLVED AGAINST THE LOCAL DISK HERE, and that is the whole
    point. In comfy mode a style's model/VAE/text-encoder fields are ComfyUI
    DROPDOWN VALUES, resolved inside ComfyUI's own models folders — not paths on
    this machine. Treating them as local paths is the confusion that cost
    several rounds in 2.12.x, and it is why the Settings UI relabels those
    fields when the engine is ComfyUI. Only the workflow file is ours.
    """
    base = _comfy.base_url(cfg)
    say(f"[worker] engine=comfy url={base}")
    _comfy.preflight(base)

    # 2.105.0: routes may swap a FLUX.2 Klein 9B text-to-image style to its
    # sibling edit workflow when the reference dock has pictures (lib/imageRefs.js)
    rel = str(params.get("workflow") or style.get("workflow") or "").strip()
    if params.get("workflow_note"):
        say(f"[worker] {params['workflow_note']}")
    if not rel:
        fail("this style has no ComfyUI workflow. In ComfyUI: build or open the "
             "graph you want, Workflow -> Export (API), save the file, then pick "
             "it in Settings -> Image.")
    wf = Path(rel) if Path(rel).is_absolute() else Path(cfg["_app_dir"]) / rel
    if not wf.exists():
        fail(f"workflow not found: {wf}")
    graph = _cimg.load_workflow(str(wf))
    say(f"[worker] workflow {wf.name} ({len(graph)} nodes)")

    # 2.223.12 (by instruction): the H3-Character_creator look-sheet
    # workflow — Tim's own ComfyUI export, run AS EXPORTED. The generic
    # patcher would hunt for a positive prompt and inject style text into a
    # graph whose prompt is built by its own H3LookSheets nodes, so this
    # branch touches ONLY what must change: both LoadImage slots get the
    # uploaded character picture, every scalar seed is re-rolled, and BOTH
    # outputs — the SaveImage sheet AND the SaveVideo turnaround — are
    # downloaded (saved outputs only; the graph's own previews stay in
    # ComfyUI's temp).
    if params.get("h3sheet"):
        uploaded = []
        for src in (params.get("images") or []):
            sp = resolve(cfg["_app_dir"], src)
            if not Path(sp).exists():
                fail(f"character picture not found: {sp}")
            uploaded.append(_comfy.upload_image(base, sp))
        graph, ireport = _cimg.apply_images(graph, uploaded)
        for nid, name, how in ireport:
            say(f"[worker] image slot {nid}: {name if how != 'bypassed' else 'bypassed'}")
        seed = int(params.get("seed") or 0)
        if seed > 0:
            for nid, node in graph.items():
                ins = node.setdefault("inputs", {})
                for k in ("seed", "noise_seed"):
                    if k in ins and not isinstance(ins[k], list):
                        ins[k] = seed
                        say(f"[worker] seed -> node {nid}.{k}")
        say("[worker] ===== chunk 1/1 (H3 look sheet)")
        _comfy.clear_before_gen(base, cfg, say)
        pid, outputs = _cprog.run(_comfy, base, graph, say)          # 2.574.0: with its steps
        imgs = [it for it in _comfy.output_images(outputs)
                if it.get("type", "output") == "output"]
        vids = [it for it in _comfy.output_videos(outputs)
                if it.get("type", "output") == "output"]
        if not imgs:
            fail("the H3 look-sheet run finished but produced no saved image — "
                 "check the workflow's SaveImage node in ComfyUI")
        produced = []
        for i, it in enumerate(imgs + vids):
            ext = Path(str(it.get("filename") or "")).suffix or ".png"
            name = _iname.reserve(
                output_dir, _iname.image_name(stem, i, len(imgs) + len(vids)))
            name = str(Path(name).with_suffix(ext))
            dest = output_dir / name
            _comfy.download(base, it, dest)
            if not dest.exists() or dest.stat().st_size == 0:
                fail(f"downloaded an empty file for {it.get('filename')}")
            produced.append(name)
            say(f"[worker] output {i + 1}/{len(imgs) + len(vids)} written -> {name}")
        say(f"[worker] {len(imgs)} sheet image(s) + {len(vids)} video(s) complete")
        return produced

    # 2.209.0 (Tim's card: "unet_name 'flux-2-klein-base-9b-fp8.safetensors'
    # not in (list of length 56)" — while the same style renders daily from
    # the prompt): when routes swapped in a SIBLING workflow, the style's own
    # workflow is the one that provably loads on this machine, so its model
    # filenames outrank whatever the sibling was exported with.
    own_rel = str(style.get("workflow") or "").strip()
    if params.get("workflow") and own_rel and own_rel != rel:
        own_wf = Path(own_rel) if Path(own_rel).is_absolute() \
            else Path(cfg["_app_dir"]) / own_rel
        if own_wf.exists():
            try:
                donor = _cimg.load_workflow(str(own_wf))
            except Exception:                               # noqa: BLE001
                donor = None
            for nid, key, old, new in _comfy.carry_loader_names(graph, donor or {}):
                say(f"[worker]   swap inherit: node {nid}.{key} '{old}' -> "
                    f"'{new}' (from {own_wf.name}, the workflow this style "
                    "provably renders with)")

    p = dict(params)
    p["batch"] = batch

    # Reference images live in THIS project's Images assets; ComfyUI cannot see
    # them, so each is uploaded to ComfyUI's input folder first and the graph
    # gets the name ComfyUI gives back. Done before patching, because the graph
    # has to carry the uploaded name, not the local path.
    uploaded = []
    for src in (params.get("images") or []):
        sp = resolve(cfg["_app_dir"], src)
        if not Path(sp).exists():
            fail(f"reference image not found: {sp}")
        try:
            uploaded.append(_comfy.upload_image(base, sp))
        except Exception as e:                              # noqa: BLE001
            fail(f"could not upload {Path(sp).name} to ComfyUI: {e}")
        say(f"[worker] uploaded reference {Path(sp).name} -> {uploaded[-1]}")
    p["images"] = uploaded
    # The seed arrives ALREADY DRAWN from routes/index.js (lib/imageSeed.js), so
    # this render, its log line and its filename all name the same number. A
    # negative value still reaches the patcher, which rolls its own — that path
    # is what keeps a worker run by hand or by a test from repeating itself.
    p["seed"] = seed
    graph, report = _cimg.patch(graph, style, p)
    for line in report:
        say(f"[worker]   {line}")

    # A saved style can hold the same path spelled the other way round: our
    # folder scan writes "flux/model.safetensors", ComfyUI's own list says
    # "flux\model.safetensors" (os.path.relpath, on Windows). Same file, and
    # combo validation is an exact string match, so it would be rejected.
    # Repaired here rather than in the patcher because it needs the RUNNING
    # ComfyUI's lists, and the patcher is pure on purpose.
    for nid, key, old, new in _comfy.canonicalise_combos(base, graph):
        say(f"[worker]   node {nid}.{key}: {old} -> as ComfyUI lists it: {new}")
    # 2.316.0: the ControlNet pass hangs its loader + apply nodes here - on
    # the patched graph, before the schema fill and the missing-node check
    if graph_hook is not None:
        graph = graph_hook(graph)

    # 2.209.0 (Tim's card: "node 91: Required input is missing
    # [resolution_steps]"): a node definition on the RUNNING ComfyUI can be
    # newer than the bundled export. Required inputs the export never had are
    # filled from the server's own declared defaults — read, never guessed —
    # the image chain's equivalent of the video worker's schema sync (2.175.0).
    for nid, ct, name, val, src in _comfy.fill_required_inputs(base, graph):
        say(f"[worker]   schema fill: node {nid} {ct}.{name} = {val!r} "
            f"({src} — this ComfyUI's node definition is newer than the export)")

    # A missing node pack named up front beats a validation 400 listing ids.
    missing = _comfy.missing_classes(base, graph)
    if "NouganRegionalCharacterLoRA" in missing:        # 2.592.0: 🎭 a zone's character LoRA
        fail("🎭 a zone carries a character LoRA, and this ComfyUI does not have the Regional Character LoRA node "
             "(NouganRegionalCharacterLoRA) - Settings ▸ Add-ons ▸ Nougan Nodes installs it (then restart ComfyUI), "
             "or clear the zones' 🎭 LoRAs")
    if missing:
        fail("ComfyUI does not have these node types: " + ", ".join(missing)
             + ". Install the node pack that provides them (Manager -> Install "
             "Missing Custom Nodes), or export a workflow that uses core nodes.")

    say(f"[worker] ===== chunk 1/1")
    # 2.588.0: a ⚡ live render (the image editor's live mode) keeps the model loaded - the next stroke renders at once
    if params.get("live"):
        say("[worker] live render - the model stays loaded (no VRAM clear)")
    else:
        _comfy.clear_before_gen(base, cfg, say)   # empty card first (2.98.0)
    pid, outputs = _cprog.run(_comfy, base, graph, say)              # 2.574.0: live "[comfy] step v/m" lines

    items = _comfy.output_images(outputs)
    if not items:
        fail("ComfyUI finished but produced no image — does the workflow end in "
             "a SaveImage node?")
    produced = []
    for i, it in enumerate(items[:batch] if len(items) >= batch else items):
        # reserve() before every write: a name that is already on disk is a
        # picture somebody rendered, and overwriting it is the one failure mode
        # here that destroys work instead of reporting it.
        name = _iname.reserve(
            output_dir, _iname.image_name(stem, i, len(items)))
        dest = output_dir / name
        _comfy.download(base, it, dest)
        if not dest.exists() or dest.stat().st_size == 0:
            fail(f"downloaded an empty file for {it.get('filename')}")
        produced.append(name)
        say(f"[worker] image {i + 1}/{len(items)} written -> {name}")
    return produced


def face_fix_hook(params, cfg, seed):
    """2.322.0: scripts/face_fix.py as a run_comfy graph hook - or None when
    the job did not ask. The Impact Pack is checked on THIS ComfyUI first: a
    missing pack skips the face fix (said) instead of failing the render."""
    spec = params.get("face_fix")
    if not spec:
        return None
    try:
        import face_fix as _ff
    except Exception as e:                                 # noqa: BLE001
        say(f"[worker] face fix skipped: scripts/face_fix.py could not be imported ({e})")
        return None
    base = _comfy.base_url(cfg)
    miss = _comfy.missing_classes(base, {str(i): {"class_type": c} for i, c in enumerate(_ff.CLASSES)})
    if miss:
        say("[worker] face fix skipped: ComfyUI does not have " + ", ".join(miss) + " - install "
            "ComfyUI-Impact-Pack and ComfyUI-Impact-Subpack (Manager), and put a face detector such as "
            "face_yolov8m.pt in models/ultralytics/bbox")
        return None

    def hook(graph):
        graph, notes = _ff.apply(graph, spec, seed=seed)
        for n in notes:
            say(f"[worker] {n}")
        return graph
    return hook


def run_controlnet(params, cfg, style, output_dir, first_files, seed):
    """scripts/cn_stage.py: the control map + the final for each first image."""
    try:
        import cn_stage as _cn
    except Exception as e:                                 # noqa: BLE001
        fail(f"scripts/cn_stage.py could not be imported: {e}")
    cn = params["controlnet"]
    base = _comfy.base_url(cfg)
    say(f"[worker] ControlNet: {cn.get('type')} -> {cn.get('controlnet') or cn.get('model')} "
        f"(strength {cn.get('strength', 1)}, steps {cn.get('steps') or 'the style'}, "
        f"cfg {cn.get('cfg') if cn.get('cfg') is not None else 'the style'}, "
        f"{len(cn.get('loras') or [])} LoRA(s))")

    def prepare(g):
        # 2.319.0 (KeyError 'coarse'): every widget the preprocessor declares
        # goes out, optional ones included, from this ComfyUI's own schema
        for nid, node in g.items():
            ct = str(node.get("class_type") or "")
            if ct in _cn.PRE_NODES.values():
                info = _comfy.object_info(base, ct)
                spec = ((info or {}).get(ct) or {}).get("input") if isinstance(info, dict) else None
                for name, val, why in _cn.complete_inputs(g, nid, spec or {}):
                    say(f"[worker]   {ct}.{name} = {val!r} ({why})")
        for nid, key, old, new in _comfy.canonicalise_combos(base, g):
            say(f"[worker]   node {nid}.{key}: {old} -> as ComfyUI lists it: {new}")
        for nid, ct, name, val, src in _comfy.fill_required_inputs(base, g):
            say(f"[worker]   schema fill: node {nid} {ct}.{name} = {val!r} ({src})")
        miss = _comfy.missing_classes(base, g)
        if miss:
            raise RuntimeError("ComfyUI does not have " + ", ".join(miss) + " - install "
                               "comfyui_controlnet_aux (Manager -> Install Missing Custom Nodes)")
        return g
    comfy = {"upload": lambda p: _comfy.upload_image(base, str(p)), "prepare": prepare,
             "queue": lambda g: _cprog.queue_live(_comfy, base, g, say),      # 2.574.0: with its steps
             "wait": lambda pid: _cprog.wait_live(_comfy, base, pid, say),
             "images": lambda outs: [it for it in _comfy.output_images(outs)
                                     if it.get("type", "output") == "output"],
             "download": lambda it, dest: _comfy.download(base, it, dest)}
    fp, fst = _cn.final_params(params, style, cn)
    # 2.321.0: say which prompt the second model renders
    say("[worker] ControlNet final prompt: " + ("the prompt docker's" if fp.get("prompt") == params.get("prompt")
        else f"its own - {str(fp.get('prompt'))[:120]!r}")
        + (f"; negative {str(fp.get('negative'))[:120]!r}" if cn.get("negative") else ""))

    ff = face_fix_hook(params, cfg, seed)     # 2.322.0: the FINAL image only

    def render(stem2, hook, size=None):
        p2 = dict(fp)
        if size:                    # 2.317.0: the first image's size - the map lines up
            p2["width"], p2["height"] = size
        both = (lambda g: ff(hook(g))) if ff else hook
        return run_comfy(p2, cfg, fst, output_dir, stem2, 1, seed, graph_hook=both)
    try:
        return _cn.run(first_files, output_dir, cn, say=say, comfy=comfy, render=render,
                       reserve=lambda n, d=None: _iname.reserve(Path(d) if d else output_dir, n))
    except (_cimg.PatchError, _comfy.ComfyError, ValueError, RuntimeError) as e:
        if cn.get("final_only") and cn.get("temp_dir"):      # 2.320.0: kept out of the gallery
            fail(f"ControlNet: {e} (the first image and any control image are in "
                 f"{cn['temp_dir']} as gen_* / ctn_*)")
        say("@@OUTS " + json.dumps(first_files))
        fail(f"ControlNet: {e} (the first image is in the gallery)")


def run_preprocess(params, cfg, output_dir, stem):
    """2.333.0: the image editor's control layer "From image" - the picture
    through the type's preprocessor (scripts/cn_stage.PRE_NODES) and back as
    <stem>_ctl_<type>.png. No style, no model render."""
    try:
        import cn_stage as _cn
    except Exception as e:                                 # noqa: BLE001
        fail(f"scripts/cn_stage.py could not be imported: {e}")
    if _comfy is None:
        fail(f"the ComfyUI modules could not be imported: {_comfy_err}")
    spec = params.get("preprocess") or {}
    typ = str(spec.get("type") or "")
    src = (params.get("images") or [None])[0]
    if not src or not Path(resolve(cfg["_app_dir"], src)).exists():
        fail("From image: the picture was not received")
    sp = resolve(cfg["_app_dir"], src)
    base = _comfy.base_url(cfg)
    try:
        g, notes = _cn.preprocess_graph(_comfy.upload_image(base, sp), typ, "",
                                        _cn.detect_resolution(_cn.png_size(sp)), "bitgen_ctl",
                                        pose_face=bool(spec.get("pose_face")))
        for n in notes:
            say(f"[worker] {n}")
        for nid, node in g.items():
            ct = str(node.get("class_type") or "")
            if ct in _cn.PRE_NODES.values() and ct != "Canny":
                info = _comfy.object_info(base, ct)
                spc = ((info or {}).get(ct) or {}).get("input") if isinstance(info, dict) else None
                for name, val, why in _cn.complete_inputs(g, nid, spc or {}):
                    say(f"[worker]   {ct}.{name} = {val!r} ({why})")
        for nid, ct, name, val, srcw in _comfy.fill_required_inputs(base, g):
            say(f"[worker]   schema fill: node {nid} {ct}.{name} = {val!r} ({srcw})")
        miss = _comfy.missing_classes(base, g)
        if miss:
            fail("ComfyUI does not have " + ", ".join(miss) + " - install comfyui_controlnet_aux "
                 "(Manager -> Install Missing Custom Nodes)")
        say(f"[worker] ===== control layer from the picture: {typ} ({_cn.PRE_NODES.get(typ)})")
        _pid, outs = _cprog.run(_comfy, base, g, say, label="preprocessing")   # 2.574.0
        items = [it for it in _comfy.output_images(outs) if it.get("type", "output") == "output"]
        if not items:
            fail("the preprocessor finished but saved no control map")
        name = f"{stem}_ctl_{typ}.png"
        _comfy.download(base, items[0], output_dir / name)
    except (_comfy.ComfyError, ValueError, RuntimeError) as e:
        fail(f"From image: {e}")
    say(f"[worker] control map written -> {name}")
    return [name]


def aiedit_controls_hook(params, cfg):
    """2.333.0: the image editor's CONTROL LAYERS on an AI edit - one
    ControlNetLoader + ControlNetApplyAdvanced per layer, chained on the
    primary sampler (scripts/cn_stage.apply_controlnet first_only)."""
    ctl = params.get("aiedit_controls") or []
    if not ctl:
        return None
    try:
        import cn_stage as _cn
    except Exception as e:                                 # noqa: BLE001
        fail(f"scripts/cn_stage.py could not be imported: {e}")
    base = _comfy.base_url(cfg)

    def hook(graph):
        for i, c in enumerate(ctl):
            sp = resolve(cfg["_app_dir"], c.get("image"))
            if not Path(sp).exists():
                raise _comfy.ComfyError(f"control layer {i + 1}: its picture was not received")
            up = _comfy.upload_image(base, sp)
            graph, notes = _cn.apply_controlnet(graph, up, c.get("model"), c.get("strength", 1.0),
                                                c.get("end", 1.0), start=c.get("start", 0.0), first_only=True)
            say(f"[worker] control layer {i + 1} ({c.get('type')}): " + "; ".join(notes))
        return graph
    return hook


def main() -> None:
    if len(sys.argv) != 2:
        fail("usage: image_worker.py <job.json>")
    try:
        job = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as e:
        fail(f"cannot read job file: {e}")

    params, cfg = job["params"], job["config"]
    cfg["sd_cli"] = os.environ.get("SD_CLI", cfg["sd_cli"])      # test override
    cfg["_app_dir"] = job.get("app_dir", str(Path.cwd()))
    output_dir = Path(job["output_dir"])
    output_dir.mkdir(parents=True, exist_ok=True)
    workdir = Path.cwd()

    if params.get("mode") != "image":
        fail(f"image_worker.py only runs mode=image (got {params.get('mode')!r})")
    if _img is None:
        fail(f"scripts/image_gen.py could not be imported: {_img_err}")

    for kv in str(((cfg.get("gpu") or {}).get("engine_env")) or "").split():
        if "=" in kv:
            k, _, v = kv.partition("=")
            RUN_ENV[k.strip()] = v.strip()

    # 2.333.0: a control layer's "From image" - no style, no render
    if params.get("preprocess"):
        stem0 = _iname.build_stem(workdir.name, 0, time.time())
        produced = run_preprocess(params, cfg, output_dir, stem0)
        say("@@OUTS " + json.dumps(produced))
        say("@@OUT " + produced[-1])
        sys.exit(0)

    stored = params.get("style") or {}
    if not stored:
        fail("no image style was sent — create one in Settings -> Image.")

    engine = str(stored.get("engine") or "comfy")
    batch = max(1, min(8, int(params.get("batch") or 1)))
    seed = int(params.get("seed", -1))
    fresh = bool(params.get("seed_random"))
    # ONE clock reading for the whole job, so a batch does not straddle a second
    # boundary and end up with two different timestamps in one set of files.
    started = time.time()
    # The job dir's name IS the job id (lib/core.js makeJob), and it is fresh
    # per press — which is what makes the filename unique even for a pinned
    # seed rendered twice in the same second. Names are built in
    # scripts/image_name.py, the one place that decides them.
    stem = _iname.build_stem(workdir.name, seed, started)
    if fresh:
        say(f"[worker] seed {seed} — freshly rolled for this press "
            "(it is in the filename, so the picture can be made again)")

    # ---------------------------------------------------------------- comfy
    # THE DEFAULT PATH. This install already runs ComfyUI for video, so making a
    # still must not require a second inference engine and a second copy of
    # every model. sd-cli is not touched, not checked and not needed below.
    if engine == "comfy":
        if _cimg is None or _comfy is None:
            fail(f"the ComfyUI image modules could not be imported: {_comfy_err}")
        say(f"[worker] image: style='{stored.get('name')}' engine=comfy "
            f"batch={batch} seed={seed}")
        try:
            # NOT resolve_style(): in comfy mode the model/VAE/TE fields name
            # files inside ComfyUI's OWN models folders, not paths on this disk.
            # 2.322.0: Face fix on a plain render; with ControlNet it runs on
            # the second model's final instead (run_controlnet)
            ff = None if params.get("controlnet") else face_fix_hook(params, cfg, seed)
            # 2.333.0: the image editor's control layers ride an AI edit
            ah = aiedit_controls_hook(params, cfg)
            if ah is not None:
                ff = (lambda g, _a=ah, _f=ff: _f(_a(g))) if ff else ah
            produced = run_comfy(params, cfg, stored, output_dir, stem, batch, seed, graph_hook=ff)
        except _cimg.PatchError as e:
            fail(str(e))
        except _comfy.ComfyError as e:
            fail(str(e))
        # 2.316.0 (Tim: "show the first image generated, the controlnet
        # preprocessor gen and the final generation in the gallery"): Basic
        # Settings -> ControlNet - the map and the final after the first image
        if params.get("controlnet"):
            produced = run_controlnet(params, cfg, stored, output_dir, produced, seed)
        say("@@OUTS " + json.dumps(produced))
        say("@@OUT " + produced[-1])
        say(f"[worker] {len(produced)} image(s) complete")
        sys.exit(0)

    # ---------------------------------------------------------------- sd-cli
    style = resolve_style(cfg["_app_dir"], stored)

    arch = _img.arch_by_id(str(style.get("arch") or ""))
    if arch is None:
        fail(f"unknown image architecture {style.get('arch')!r} — "
             "the style was saved against a catalogue entry that no longer exists.")

    # Everything that can be checked without touching the GPU, checked first.
    miss = _img.missing_slots(style)
    if miss:
        fail(f"style '{style.get('name') or style.get('id')}' is missing: "
             + ", ".join(miss) + " — fill it in under Settings -> Image.")
    require("sd-cli", cfg["sd_cli"])
    require("model", style.get("model"))
    if str(style.get("vae") or "").strip():
        require("VAE", style["vae"])
    for i, slot in enumerate(arch["te"]):
        got = str(((style.get("te") or [])[i] if i < len(style.get("te") or []) else "") or "").strip()
        if got:
            require(slot["label"], got)
    for l in style.get("loras") or []:
        p = str((l or {}).get("path") or "").strip()
        if not p:
            continue
        # A LoRA is resolved by sd.cpp against --lora-model-dir, so an absolute
        # path that does not exist is worth saying out loud; a bare name is not
        # checkable here and is left to sd-cli to resolve.
        if os.path.isabs(p) or os.sep in p or "/" in p:
            rp = resolve(cfg["_app_dir"], p)
            if not Path(rp).exists():
                fail(f"LoRA not found: {rp}")

    say(f"[worker] image: style='{style.get('name')}' engine=sdcli "
        f"arch={arch['id']} batch={batch} seed={seed}")

    produced = []
    for i in range(batch):
        # A batch with a FIXED seed would be N identical pictures, which is not
        # what "give me four" means. Walk the seed; a -1 (random) seed is left
        # alone so sd-cli rolls a fresh one per run.
        p = dict(params)
        p["seed"] = seed if seed < 0 else seed + i
        # Each picture in a batch was drawn by its OWN seed, so each carries its
        # own seed in its own name — otherwise all four files claim the seed of
        # the first and three of them are wrong.
        name = _iname.reserve(output_dir, _iname.image_name(
            _iname.build_stem(workdir.name, p["seed"], started), i, batch))
        out = output_dir / name
        try:
            argv = _img.build_image_command(p, cfg, style, out)
        except ValueError as e:
            fail(str(e))
        if i == 0:
            say("@@CMD " + json.dumps([str(a) for a in argv]))
        # The STABLE protocol string core.js parses for the progress bar. Image
        # i of N is the same shape of fact as chunk i of N; reusing it means the
        # progress bar works with no parser change. Do not reword it.
        say(f"[worker] ===== chunk {i + 1}/{batch}")
        rc = run(argv, echo_cmd=(i == 0))
        if rc != 0 or not out.exists():
            hint = ""
            if rc != 0:
                hint = (" — check the model/VAE/text-encoder paths for this style, "
                        "and that this sd-cli build supports "
                        f"{arch['label']}. Architecture flags live in lib/imageArch.json.")
            fail(f"image {i + 1}/{batch} failed (exit {rc}){hint}")
        produced.append(name)
        say(f"[worker] image {i + 1}/{batch} written -> {name}")

    # @@OUT is THE output (job.output, what the completion check and the asset
    # registration use). @@OUTS carries the rest of a batch so every picture
    # reaches the dock, not just the last one.
    say("@@OUTS " + json.dumps(produced))
    say("@@OUT " + produced[-1])
    say(f"[worker] {len(produced)} image(s) complete")
    sys.exit(0)


if __name__ == "__main__":
    main()
