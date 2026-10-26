#!/usr/bin/env python3
"""
bitGen Studio — Python side.

Invoked by the Node server as:  python -u worker.py <path/to/job.json>

Generation pipelines (4n+1 frame grid, 361-frame single-run ceiling, 24fps):
  single       one sd-cli run; 15s = 360f fits ONE 361f generation -> trim 1
               (best character consistency — the Auto pipeline prefers this)
  chunked      fl2va hand-off per chunk, seam duplicate dropped at join,
               progressive joined preview after every chunk, exact end trim
  png_rebuild  chunks exploded to PNGs, seam PNGs dropped, renumbered and
               rebuilt frame-exact at 24fps (audio muxed from the join)
Tool modes: export (timeline compile), install_llm, download (HF repo file
into models/), convert (sd-cli safetensors -> GGUF quantization, e.g. q8_0).

Control lines to Node:
    @@CMD <json argv>   the (first) command
    @@OUT <filename>    final output file (relative to output_dir)

STABLE LOG PROTOCOL — UI progress/preview-reload parse these; never change:
    [worker] ===== chunk i/N
    [worker] joined preview updated

Stdlib only (huggingface_hub used opportunistically for downloads).
Exit code decides done/failed on the Node side.
"""

import copy
import json
import math
import os
import random
import re
import shutil
import signal
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

# Transitions: the catalogue and the xfade arithmetic live in
# scripts/transitions.py, which reads the same lib/transitions.json the UI
# dropdown is built from. Imported by path because the worker is launched as
# a bare file from the project directory.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))
try:
    import transitions as _tr
except Exception as _e:            # noqa: BLE001 - transitions degrade to cuts
    _tr, _tr_err = None, _e

# How long a compile must run for. scripts/timeline_span.py is THE one place
# that is decided (mirrored in lib/timelineSpan.js for the export route); it is
# imported the same way and for the same reason as transitions above.
try:
    import timeline_span as _span
except Exception as _e2:           # noqa: BLE001 - fall back to the base track
    _span, _span_err = None, _e2

# 2.406.0: a clip's speed / reverse / ramp, grade + LUT and sound clean-up (rendered once before the compile), the mix's
# roles + ducking + loudness, and the caption track - each in its own module under scripts/
import clipfx_render as _cfx      # noqa: E402
import cliptail as _ctail          # noqa: E402  2.572.0: ✨ Auto transition - a clip held under the next one
import mixfx as _mixfx            # noqa: E402
import captions_ass as _caps      # noqa: E402
import deliver as _dl             # noqa: E402
import vfx_filters as _vfx        # noqa: E402  2.409.0: ✨ effects for adjustment layers  2.407.0: the 📤 Export queue (H.265, ProRes, DNxHR, WebM, GIF, sound; reframes)

# ComfyUI's VRAM: the clear-before-generation and the out-of-memory advice
# (2.98.0) live in scripts/comfy_client.py, shared with the image and music
# workers. ONLY those helpers are imported — the rest of this worker's ComfyUI
# plumbing stays its own on purpose (see the note at the top of comfy_client).
# A failed import is logged in comfy_generate and the render goes ahead.
try:
    import comfy_client as _cc
except Exception as _e3:           # noqa: BLE001 - render without the clear
    _cc, _cc_err = None, _e3

# 2.301.0 (Tim: "we create 2 separate files, 1 raw files and 1 mp4 to
# playback ... save the raw renders in project name\raw"): the LOSSLESS
# scene master - the graph's PNG/FLAC taps, the FFV1 .avi, the joins - lives
# in scripts/rawmaster.py. Without it a render still completes, mp4-only.
try:
    import rawmaster as _rm
except Exception as _e4:           # noqa: BLE001 - mp4-only takes
    _rm, _rm_err = None, _e4

# 2.305.0 (Tim's Scene 7 report: "Return type mismatch ... ref_video_0,
# received_type(VIDEO) mismatch input_type(IMAGE)"): a refusal that names a
# VIDEO link on an IMAGE input is repaired in place (GetVideoComponents in
# between) and queued once more - scripts/comfy_typefix.py.
try:
    import comfy_typefix as _tf
except Exception:                  # noqa: BLE001 - the refusal is reported as before
    _tf = None

# 2.312.0 (Tim: "... upscaler dropdown, upscale resolution. Add a workflow for
# comfyui upscaler"): the MMH3 Ultimate Upscale stage - spliced after the
# sampler, or an existing one re-aimed - scripts/upscalestage.py.
try:
    import upscalestage as _us
except Exception:                  # noqa: BLE001 - said when a job asks for it
    _us = None

# 2.366.0 (Tim: "even your prompt didn't work , cfg was 1, i am trying 3"):
# Basic Settings' cfg above 1 turns the H3 BasicGuider into a real CFGGuider -
# scripts/truecfg.py.
try:
    import truecfg as _tc
except Exception:                  # noqa: BLE001 - the render says cfg was ignored
    _tc = None

# 2.573.0 (Tim: "please add this workflow https://www.fasth3-omni.com/en, fasth3 omni"): a FastH3 diffusion model
# gets its recipe (sigma shift, VSA sparse attention, 8 steps, cfg 1) in any H3 graph - scripts/fasth3.py.
try:
    import fasth3 as _f3
except Exception:                  # noqa: BLE001 - the shipped FastH3 Omni graph carries the recipe itself
    _f3 = None

# 2.353.0 (Tim: "the h3_Video_ref workflow doesn't use video reference, can we
# add video and sound slots when a reference video and/or sound is added"): an
# H3 reference graph saved with pictures only gets its video / sound slots
# from scripts/refslots.py before the slot fill.
try:
    import refslots as _rs
except Exception:                  # noqa: BLE001 - the fill then says "0 video slot(s)" as before
    _rs = None

# 2.352.0 (Tim: "can we incorporate viggle into these worklows but make it a
# new viggle workflow?"): the H3_Viggle style - a graph built around
# ViggleAnimateConditioning is filled by scripts/h3viggle.py (the motion
# video drives, the sheet / first frame performs), not by the H3 patcher.
try:
    import h3viggle as _hv
except Exception as _e5:           # noqa: BLE001 - said when a Viggle graph arrives
    _hv, _hv_err = None, _e5

# 2.313.0 (Tim: "save the last 2 seconds of the video as 1080p png, and use
# one of those frames to continue the video"): scripts/tailpngs.py
try:
    import tailpngs as _tp
except Exception:                  # noqa: BLE001 - said when a job asks for it
    _tp = None

# 2.388.0 (Tim: the reference dock's video dropdown "Append" / "prepend"): scripts/clipjoin.py - the frame upscaled
# before the render, the new part joined to the video after it
try:
    import clipjoin as _cj
except Exception:                  # noqa: BLE001 - said when a job asks for it
    _cj = None


def _tail_comfy(cfg):
    """The four ComfyUI calls the tail PNG upscale needs (2.313.0)."""
    base = _comfy_url(cfg)

    def queue(g):
        r = _http_json(base + "/prompt", {"prompt": g, "client_id": uuid.uuid4().hex},
                       read_error_body=True)
        if not r.get("prompt_id"):
            raise RuntimeError("ComfyUI refused the upscale graph: "
                               + json.dumps(r.get("error") or r.get("node_errors") or r)[:300])
        return r["prompt_id"]

    def wait(pid, limit=600):
        t0 = time.time()
        while time.time() - t0 < limit:
            h = (_http_json(f"{base}/history/{pid}", timeout=15) or {}).get(pid)
            if h:
                st = h.get("status") or {}
                if st.get("status_str") == "error":
                    raise RuntimeError("the upscale graph failed in ComfyUI")
                if h.get("outputs"):
                    return h["outputs"]
            time.sleep(0.5)
        raise RuntimeError("the upscale graph timed out")

    return {"base": base, "upload": lambda p: _comfy_upload_image(base, p), "queue": queue,
            "wait": wait, "fetch": lambda it, dest: _fetch_output(base, it, dest)}


def _tail_pngs(params, cfg, final, raw_dir):
    """2.313.0: the take's last 2 s as PNGs at the chosen size (from the
    lossless master when there is one) - never fails the take."""
    spec = params.get("tail_pngs")
    if not spec:
        return
    if _tp is None:
        say("[tail] scripts/tailpngs.py did not load - no tail PNGs")
        return
    master = (raw_dir / _rm.master_name(final.name)) if (raw_dir and _rm) else None
    src = master if master is not None and master.exists() else final
    try:
        _tp.run(spec, src, final.name, say=say, run_cmd=lambda c: run(c, echo_cmd=False),
                probe_frames=probe_frames,
                comfy=_tail_comfy(cfg) if spec.get("upscaler") else None)
    except Exception as e:                  # noqa: BLE001 - the take is already safe
        say(f"[tail] tail PNGs failed: {e}")


def _fade(t, where, at, length=None, alpha=False, audio=False):
    """A layer-boundary fade fragment, or "" for a cut / absent catalogue.

    Wrapping _tr here keeps every call site free of the None check: if
    scripts/transitions.py could not be imported, everything degrades to a
    hard cut rather than taking the whole compile down with it."""
    if _tr is None or not t:
        return ""
    try:
        return _tr.fade_filter(t, where, at, length=length, alpha=alpha, audio=audio)
    except Exception:              # noqa: BLE001 - a bad transition is never fatal
        return ""


def _atempo(s):
    """2.412.0: atempo for any speed 0.1 .. 10 - a chain of steps inside 0.5 .. 2 (what every ffmpeg takes)"""
    s = max(0.1, min(10.0, float(s or 1)))
    steps = []
    while s > 2.0:
        steps.append(2.0)
        s /= 2.0
    while s < 0.5:
        steps.append(0.5)
        s /= 0.5
    steps.append(s)
    return ",".join(f"atempo={x:.6f}" for x in steps)


def _shape(parts, src, out, t_in, t_out, length, tag, say=None):
    """2.415.0: a layer boundary drawn as its shape (scripts/transitions.py boundary_chain) -> (entry_done, exit_done)"""
    if _tr is None or not hasattr(_tr, "boundary_chain"):
        return False, False
    try:
        done = _tr.boundary_chain(parts, src, out, t_in, t_out, length, tag)
    except Exception:              # noqa: BLE001 - a bad transition is never fatal
        return False, False
    if say and (done[0] or done[1]):
        say(f"[worker] layer boundary drawn as its shape: " + ", ".join(
            n for n, d in ((_tr.shape_of(t_in), done[0]), (_tr.shape_of(t_out), done[1])) if d))
    return done


def _fade_any(c):
    """True when this clip carries an active boundary transition either side."""
    if _tr is None:
        return False
    return any(_tr.is_active(c.get(k)) for k in ("fade_in", "fade_out") if c.get(k))


# Windows consoles default to cp1252; force UTF-8 (with replacement) so a
# log line can never crash the worker with UnicodeEncodeError.
for _s in (sys.stdout, sys.stderr):
    try:
        _s.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

FPS = 24
MAX_SINGLE_RUN = 361      # model ceiling, on the 4n+1 grid
MAX_FRAMES = 300 * 24     # 5 minutes (music-video ceiling)


def snap_4n1_up(n: int) -> int:
    if n < 1:
        n = 1
    r = (n - 1) % 4
    return n if r == 0 else n + (4 - r)


def snap_4n1_down(n: int) -> int:
    if n < 1:
        return 1
    return n - ((n - 1) % 4)


# ComfyUI's NATIVE MiniMaxH3 nodes snap frame counts to the 17k+5 grid
# (5, 22, 39, ... 345, 362) instead of sd-cli's 4n+1. 5 sits on both grids.
MAX_SINGLE_RUN_COMFY = 362      # 17*21+5 = 15.08s, the official 15s snap


def snap_17k5_up(n: int) -> int:
    if n <= 5:
        return 5
    r = n % 17
    return n if r == 5 else n + (5 - r) % 17


def snap_17k5_down(n: int) -> int:
    if n <= 5:
        return 5
    m = n - (n % 17 - 5) % 17
    return m if m >= 5 else 5


GRIDS = {  # grid -> (snap_up, snap_down, single-run ceiling)
    "4n1":  (snap_4n1_up,  snap_4n1_down,  MAX_SINGLE_RUN),
    "17k5": (snap_17k5_up, snap_17k5_down, MAX_SINGLE_RUN_COMFY),
}
# 2.503.0: MiniMax H3 LONG SINGLE RUNS (lib/h3Long.js, Tim's "secret sauce" workflow: low-VRAM attention + chunked
# feed-forward) - one generation up to 17*42+5 = 719 frames (29.96 s) when the video style's accel.long is "on".
# GRID_MAX = the most a caller may pass as `ceiling` (lib/framePlan.js GRIDS[...].max mirrors it).
LONG_SINGLE_RUN_COMFY = 719
GRID_MAX = {"4n1": MAX_SINGLE_RUN, "17k5": LONG_SINGLE_RUN_COMFY}


def long_on(vstyle) -> bool:
    """2.503.0: does this video style ask for H3 long single runs? (lib/h3Long.on mirrored)"""
    s = vstyle if isinstance(vstyle, dict) else {}
    if s.get("kind") not in (None, "", "video"):
        return False
    if s.get("arch") not in (None, "", "minimax-h3"):
        return False
    return str((s.get("accel") or {}).get("long") or "off") == "on"


def plan_chunks(target: int, max_chunk: int = MAX_SINGLE_RUN, grid: str = "4n1",
                force: bool = False, ceiling: int = 0) -> dict:
    """Frame-grid chunk plan (mirror of lib/framePlan.js — keep in sync).
    grid: '4n1' for sd-cli, '17k5' for the native ComfyUI MiniMaxH3 nodes.
    fl2va hand-off: chunks 2+ contribute (frames - 1) unique frames; the seam
    duplicate is dropped at join. Final chunk snapped UP (snapping down caused
    a wasteful extra chunk); overshoot (<=3 on 4n+1, <=16 on 17k+5) is
    absorbed by the end trim.
    ceiling (2.99.0): a single-run ceiling LOWER than the grid's own — the
    VRAM ceiling learned when a longer single run died of GPU out-of-memory."""
    snap_up, snap_down, grid_ceiling = GRIDS[grid]
    ceiling = (max(5, min(snap_down(int(ceiling)), GRID_MAX.get(grid, grid_ceiling)))
               if ceiling and int(ceiling) > 0 else grid_ceiling)
    # Anything that fits ONE generation is never segmented, whatever the
    # segment length says (a 15 s clip is a single run on both engines).
    # force=True is the low-VRAM escape hatch that splits anyway.
    if not force and target <= ceiling:
        c = snap_up(target)
        return {"chunks": [c], "unique": c, "trim": c - target}
    max_chunk = max(5, min(snap_down(max_chunk), ceiling))
    if target <= max_chunk:
        c = snap_up(target)
        return {"chunks": [c], "unique": c, "trim": c - target}
    chunks, unique = [max_chunk], max_chunk
    per = max_chunk - 1
    remaining = target - max_chunk
    n_more = math.ceil(remaining / per)
    for _ in range(n_more - 1):
        chunks.append(max_chunk)
        unique += per
    last = snap_up(remaining - per * (n_more - 1) + 1)
    if last > max_chunk:
        last = max_chunk
    chunks.append(last)
    unique += last - 1
    return {"chunks": chunks, "unique": unique, "trim": unique - target}

current_proc = None
recent_lines = []          # tail of engine output, for failure diagnosis
RUN_ENV = dict(os.environ)  # env for spawned engines; main() may extend it

# Stability env for ggml's CUDA backend: disables CUDA graphs (runtime knob)
# and asks for no VMM pooling (honored only if the build supports it; harmless
# otherwise). Works around cuMemSetAccess CUDA_ERROR_NOT_READY driver bugs.
STABILITY_ENV = {"GGML_CUDA_DISABLE_GRAPHS": "1", "GGML_CUDA_NO_VMM": "1"}


def say(line: str) -> None:
    try:
        print(line, flush=True)
    except UnicodeEncodeError:   # exotic console encodings: degrade, never die
        print(line.encode("ascii", "replace").decode("ascii"), flush=True)


def fail(msg: str) -> None:
    say(f"[worker] {msg}")
    sys.exit(2)


def on_term(signum, _frame):
    if current_proc and current_proc.poll() is None:
        current_proc.terminate()


for _sig in ("SIGTERM", "SIGINT", "SIGBREAK"):
    if hasattr(signal, _sig):
        signal.signal(getattr(signal, _sig), on_term)


def run(argv, echo_cmd=True, env=None) -> int:
    global current_proc
    if echo_cmd:
        say("[worker] " + " ".join(f'"{a}"' if " " in a else a for a in argv))
    current_proc = subprocess.Popen(
        argv, stdin=subprocess.DEVNULL,        # 2.308.0: a child never waits on stdin
        stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
        text=True, bufsize=1, errors="replace", env=env or RUN_ENV,
    )
    for line in current_proc.stdout:
        line = line.rstrip("\r\n")
        recent_lines.append(line)
        if len(recent_lines) > 400:
            del recent_lines[:200]
        say(line)
    return current_proc.wait()


def diagnose_engine_failure() -> str:
    """Turn known sd-cli failure walls into one actionable line."""
    tail = "\n".join(recent_lines[-400:])
    if "wrong shape in model metadata" in tail:
        if "Conditioner model tensor" in tail:
            return ("DIAGNOSIS: this sd-cli build cannot read this TEXT ENCODER's "
                    "packing (int8_convrot per-channel scales on the Qwen3-VL MLP). "
                    "Fix: Settings -> Paths -> Text encoder -> point at a GGUF "
                    "(e.g. qwen3vl_32b_minimax_h3-Q4_K_M.gguf — one-click download in "
                    "Settings -> Models, tagged ✓safe) or a bf16 safetensors. "
                    "Your diffusion model validated fine and can stay as-is. "
                    "A newer sd-cli build may also add support (Settings -> Install sd-cli).")
        return ("DIAGNOSIS: a model file uses a packing this sd-cli build cannot "
                "read. Swap the failing component (see the first 'wrong shape' "
                "lines above) to a GGUF or bf16 variant, or update sd-cli.")
    if "cuMemSetAccess" in tail or "device not ready" in tail:
        return ("DIAGNOSIS: the CUDA driver's virtual-memory pool crashed while "
                "growing (cuMemSetAccess: device not ready) - a driver/VMM bug, "
                "not a capacity problem. Turn on Settings -> GPU -> CUDA "
                "stability mode (disables CUDA graphs and requests no VMM "
                "pooling; the latter depends on the sd-cli build honoring it), "
                "update the NVIDIA driver, and try a newer sd-cli build "
                "(Settings -> Install sd-cli). Offload-free fallback: VAE on "
                "the second GPU + Low-VRAM budget ~10.")
    if "out of memory" in tail.lower() or "cudaMalloc" in tail:
        return ("DIAGNOSIS: GPU out of memory allocating the compute buffer. "
                "The segment budget must sit BELOW the free VRAM left on the "
                "diffusion card after weights load. Fast path on a dual-GPU "
                "box: Settings -> GPU -> the dual-GPU preset button (splits "
                "diffusion weights across both cards, VAE on the second card, "
                "13 GiB budget). Single-GPU: Low-VRAM segmented execution with "
                "a small budget, move the VAE to the other GPU, or lower the "
                "resolution.")
    return ""


def oom_since(mark: int) -> bool:
    tail = "\n".join(recent_lines[mark:])
    return ("cudaMalloc failed: out of memory" in tail
            or "alloc compute buffer failed" in tail
            or "failed to allocate" in tail and "buffer" in tail)


def vmm_error_since(mark: int) -> bool:
    tail = "\n".join(recent_lines[mark:])
    return ("cuMemSetAccess" in tail or "device not ready" in tail
            or ("ggml-cuda.cu" in tail and "CUDA error" in tail))


def parse_vram_state():
    """Device totals + weight placement, parsed from the engine's own log."""
    txt = "\n".join(recent_lines)
    devs = {int(m.group(1)): int(m.group(2))
            for m in re.finditer(r"Device (\d+):.*?VRAM: (\d+) MiB", txt)}
    dm = re.search(r"diffusion_model ([\d.]+)MB\(VRAM\)", txt)
    vm = re.search(r"vae ([\d.]+)MB\(VRAM\)", txt)
    return devs, (float(dm.group(1)) if dm else None), (float(vm.group(1)) if vm else None)


def try_move_vae(argv, cfg):
    """If VAE shares the (single) diffusion card and another GPU exists,
    point vae= at the other card for this retry. Returns new index or None."""
    gpu = cfg.get("gpu") or {}
    diff_dev, vae_dev = gpu.get("diffusion", "cuda0"), gpu.get("vae", "cuda0")
    if "&" in diff_dev or vae_dev != diff_dev or "--backend" not in argv:
        return None
    devs, _, _ = parse_vram_state()
    if len(devs) < 2:
        return None
    try:
        cur = int(diff_dev.replace("cuda", ""))
    except ValueError:
        return None
    new = 1 if cur == 0 else 0
    k = argv.index("--backend")
    argv[k + 1] = re.sub(r"vae=cuda\d+", f"vae=cuda{new}", argv[k + 1])
    return new


def estimate_vram_budget(cfg, vae_moved_to=None) -> int:
    """Segment budget (GiB) = free VRAM on the diffusion card(s) after
    weights, minus 1 GiB headroom. Conservative fallback: 5."""
    devs, diff_mb, vae_mb = parse_vram_state()
    gpu = cfg.get("gpu") or {}
    try:
        diff_devs = [int(d.replace("cuda", ""))
                     for d in gpu.get("diffusion", "cuda0").split("&")]
        vae_dev = vae_moved_to if vae_moved_to is not None \
            else int(str(gpu.get("vae", "cuda0")).replace("cuda", ""))
    except ValueError:
        return 5
    if not devs or diff_mb is None:
        return 5
    free = []
    for d in diff_devs:
        if d not in devs:
            return 5
        load = diff_mb / len(diff_devs)
        if vae_mb and vae_dev == d:
            load += vae_mb
        free.append(devs[d] - load - 1024)
    budget = int(min(free) // 1024)
    return max(2, min(budget, 24))


def require(label: str, p: str) -> None:
    if not Path(p).exists():
        fail(f"{label} not found: {p} — fix the path in Settings.")


def build_command(params, cfg, *, seg_mode, refs, first_frame, last_frame, frames, out_path):
    models, flags = cfg["models"], cfg["flags"]
    model_key = "ref2va" if seg_mode == "ref2va" else "fl2va"

    argv = [
        cfg["sd_cli"],
        "--mode", "vid_gen",
        "--diffusion-model", models[model_key],
        "--llm", models["text_encoder"],
        "--vae", models["video_vae"],
        "--audio-vae", models["audio_vae"],
        "--prompt", params["prompt"],
        "--width", str(int(params["width"])),
        "--height", str(int(params["height"])),
        "--video-frames", str(int(frames)),
        "--fps", "24",   # H3 is fixed 24fps; some builds otherwise mux at 16fps
        "--steps", str(int(params["steps"]) or BASE_STEPS),   # 0 = auto -> base count (2.100.0)
        # 1.0 unless the Basic-Settings CFG slider was moved (2.93.0). H3 is
        # distilled, so 1.0 is the intended value; the knob exists for
        # finetunes that want otherwise.
        "--cfg-scale", str(params.get("cfg", 1.0)),
        "--seed", str(int(params.get("seed", -1))),
    ]

    # Flash attention is non-negotiable for H3 video: without it, attention
    # memory is quadratic in sequence length (a 10s render tried to allocate
    # 325 GB). Always on unless the user explicitly passes an fa flag.
    extra_probe = (params.get("extra_args") or cfg.get("extra_args") or "")
    if "--diffusion-fa" not in extra_probe and "--fa" not in extra_probe.split():
        argv += ["--diffusion-fa"]

    lora_dir = cfg.get("lora_dir")
    if lora_dir and Path(lora_dir).is_dir():
        argv += ["--lora-model-dir", lora_dir]

    if seg_mode == "ref2va":
        argv += ["--increase-ref-index"]
        for r in refs:
            argv += [flags["ref_image"], r]
        for d in params.get("_ref_video_dirs", []):
            argv += ["--ref-video", d]
        for a in params.get("_ref_audio_wavs", []):
            argv += ["--ref-audio", a]
    elif seg_mode == "fl2va":
        if first_frame:
            argv += [flags["first_frame"], first_frame]
        if last_frame:
            argv += [flags["last_frame"], last_frame]

    argv += ["--output", str(out_path)]

    extra = (params.get("extra_args") or cfg.get("extra_args") or "").strip()

    if "--cache-mode" not in extra:
        speed = params.get("speed", "quality")
        if speed == "balanced":
            argv += ["--cache-mode", "easycache"]
        elif speed == "fast":
            argv += ["--cache-mode", "easycache", "--cache-option", "threshold=0.2"]
        elif speed == "turbo":
            argv += ["--cache-mode", "easycache", "--cache-option", "threshold=0.3"]

    gpu = cfg.get("gpu") or {}
    if "--backend" not in extra:
        diff_dev = gpu.get("diffusion", "cuda0")
        argv += ["--backend",
                 f"diffusion={diff_dev},"
                 f"te={gpu.get('te', 'cpu')},"
                 f"vae={gpu.get('vae', 'cuda0')}"]
        if "&" in diff_dev and "--split-mode" not in extra:
            argv += ["--split-mode", "layer"]
    if gpu.get("vae_tiling") and "--vae-tiling" not in extra:
        argv += ["--vae-tiling"]
    if gpu.get("low_vram") and "--max-vram" not in extra:
        # Explicit budget: auto-detect (-N) measures free VRAM before weights
        # load and over-budgets; a fixed per-segment ceiling is reliable.
        budget = gpu.get("vram_budget") or 11   # H3's largest graph segment is ~9.5GB at 540p/243f
        argv += ["--max-vram", str(budget)]
    if gpu.get("offload_cpu"):
        off = (cfg.get("flags", {}).get("offload_cpu") or "--offload-to-cpu")
        if off.split()[0] not in extra:
            argv += off.split()
    if extra:
        argv += extra.split()
    return argv



# ======================= ComfyUI engine (API-format workflows) ==============
# Drives the user's EXISTING ComfyUI over HTTP (RH_MinMaxH3 node pack):
# upload inputs -> patch an API-format workflow's values -> POST /prompt ->
# poll /history -> download the produced video via /view. Nothing inside the
# ComfyUI install is modified. Templates: comfy_workflows/<mode>.json,
# exported once from ComfyUI via "Export (API)" from the bundled examples.
import uuid


# ---- RUNPOD SERVERLESS TRANSPORT (2.197.0, by instruction) -----------------
# The verified worker-comfyui protocol (docs.runpod.io/tutorials/serverless/
# comfyui): POST {base}/v2/{endpoint}/run with Bearer auth and
# {"input": {"workflow": <API graph>, "images": [{"name", "image": b64}]}},
# poll {base}/v2/{endpoint}/status/{id} until COMPLETED, outputs ride the
# response as base64 (or s3_url when the worker is S3-configured).

def _runpod_cfg(cfg):
    """engine.runpod when enabled, else None. Missing endpoint/key is a
    named failure, not a silent local fallback — the user asked for the
    cloud and must know it is not configured."""
    rp = ((cfg.get("engine") or {}).get("runpod") or {})
    if not rp.get("enabled"):
        return None
    ep = str(rp.get("endpoint") or "").strip()
    key = str(rp.get("api_key") or "").strip()
    if not ep or not key:
        fail("RunPod serverless is enabled but engine.runpod.endpoint or "
             "engine.runpod.api_key is empty — fill both (Settings), or set "
             "engine.runpod.enabled to false to render locally")
    return {"endpoint": ep, "api_key": key,
            "poll": max(2, int(rp.get("poll_seconds") or 5)),
            "base": str(rp.get("base_url") or "https://api.runpod.ai").rstrip("/")}


def _fetch_output(base, fitem, dest):
    """Bring one selected output to dest: a runpod-mode item is already on
    disk (subfolder = the local runpod dir); everything else is ComfyUI's
    /view."""
    if fitem.get("type") == "runpod":
        shutil.copyfile(os.path.join(fitem.get("subfolder", ""), fitem["filename"]), dest)
        return
    from urllib.parse import urlencode
    q = urlencode({"filename": fitem["filename"],
                   "subfolder": fitem.get("subfolder", ""),
                   "type": fitem.get("type", "output")})
    with urllib.request.urlopen(f"{base}/view?{q}", timeout=600) as r, open(dest, "wb") as f:
        shutil.copyfileobj(r, f)


def _rp_map_outputs(g, names, rp_dir):
    """Serverless answers a FLAT file list; the selection logic downstream
    ranks by the SAVE NODE's class. Map each returned file back to its save
    node by filename_prefix (SegmentSave vs ChainAssemble vs VideoCombine
    all carry one), so segment-vs-film preference works exactly as it does
    locally; an unmatched file gets a synthetic node id and middle rank."""
    outs, syn = {}, 0
    savey = ("segmentsave", "videocombine", "savevideo", "chainassemble",
             "saveimage", "saveaudio")
    for nm in names:
        nid = ""
        best = -1
        for k, nd in (g or {}).items():
            c = str((nd or {}).get("class_type", "")).lower()
            if not any(t in c for t in savey):
                continue
            px = str(((nd or {}).get("inputs") or {}).get("filename_prefix") or "")
            stem = Path(px).name
            if stem and Path(nm).name.startswith(stem) and len(stem) > best:
                best, nid = len(stem), str(k)   # the LONGEST matching prefix wins
        if not nid:
            syn += 1
            nid = f"rp{syn}"
        key = ("videos" if nm.lower().endswith((".webm", ".mp4", ".mkv", ".avi", ".mov"))
               else "audio" if nm.lower().endswith((".wav", ".mp3", ".flac", ".ogg"))
               else "images")
        outs.setdefault(nid, {}).setdefault(key, []).append(
            {"filename": Path(nm).name, "subfolder": rp_dir, "type": "runpod"})
    return outs


def _runpod_attempt(rp, graph, rp_files, out_path, say):
    """The serverless _attempt: base64 the refs into the request, /run,
    poll /status, write every returned output into a local dir, and answer
    the SAME (outputs, blame, msgs) shape the local attempt does — blame is
    always empty (no accelerator re-queue loop over a paid endpoint)."""
    import base64 as _b64
    url = f"{rp['base']}/v2/{rp['endpoint']}"
    hdr = {"Content-Type": "application/json",
           "Authorization": "Bearer " + rp["api_key"]}
    images, total = [], 0
    for name, p in rp_files:
        try:
            enc = _b64.b64encode(open(p, "rb").read()).decode()
        except Exception as e:
            fail(f"[runpod] could not read reference {name}: {e}")
        total += len(enc)
        images.append({"name": name, "image": enc})
    if total > 9_500_000:
        fail(f"[runpod] the reference files are ~{total / 1_000_000:.1f} MB as "
             "base64 — over the ~10 MB /run request cap. Shrink the sheets / "
             "trim the voice refs, or render this on a pod instead "
             "(docs/RUNPOD.md).")
    say(f"[runpod] submitting to {url}/run "
        f"({len(images)} ref file(s), ~{total / 1_000_000:.1f} MB encoded)")
    body = {"input": {"workflow": graph}}
    if images:
        body["input"]["images"] = images
    req = urllib.request.Request(url + "/run", method="POST", headers=hdr,
                                 data=json.dumps(body).encode())
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            sub = json.loads(r.read().decode() or "{}")
    except urllib.error.HTTPError as e:
        fail(f"[runpod] /run answered {e.code}: {(e.read() or b'').decode()[:400]}")
    except Exception as e:
        fail(f"[runpod] could not reach {url}/run: {e}")
    jid = sub.get("id")
    if not jid:
        fail(f"[runpod] /run returned no job id: {json.dumps(sub)[:300]}")
    say(f"[runpod] job {jid} {sub.get('status', '')}")
    last, t0 = "", time.time()
    while True:
        time.sleep(rp["poll"])
        sreq = urllib.request.Request(f"{url}/status/{jid}", headers=hdr)
        try:
            with urllib.request.urlopen(sreq, timeout=60) as r:
                st = json.loads(r.read().decode() or "{}")
        except Exception as e:
            say(f"[runpod] status poll failed ({e}) — retrying")
            continue
        status = str(st.get("status") or "")
        if status != last:
            say(f"[runpod] {status.lower()} ({time.time() - t0:.0f}s)")
            last = status
        elif time.time() - t0 > 0 and int(time.time() - t0) % 60 < rp["poll"]:
            say(f"[runpod] still {status.lower()} ({time.time() - t0:.0f}s)")
        if status in ("FAILED", "CANCELLED", "TIMED_OUT"):
            out = st.get("output")
            fail(f"[runpod] job {jid} {status}"
                 + (f": {json.dumps(out)[:500]}" if out else "")
                 + " — the endpoint's own logs (RunPod console) have the "
                   "node-level story")
        if status == "COMPLETED":
            break
    out = st.get("output") or {}
    items = []
    for key in ("images", "videos", "gifs", "files"):
        for it in out.get(key) or []:
            if isinstance(it, dict) and it.get("data"):
                items.append(it)
    if not items and isinstance(out.get("message"), str) and out["message"]:
        items.append({"filename": "runpod_output.png", "type": "base64",
                      "data": out["message"]})
    if not items:
        fail(f"[runpod] job {jid} completed but returned no output files: "
             f"{json.dumps(out)[:400]} — a video chain needs a worker "
             "version that returns video outputs (or S3 configured)")
    rp_dir = str(Path(out_path).parent / f"runpod_{jid[:8]}")
    os.makedirs(rp_dir, exist_ok=True)
    names = []
    for it in items:
        nm = str(it.get("filename") or f"runpod_{len(names)}.bin")
        data = str(it.get("data") or "")
        dest = os.path.join(rp_dir, Path(nm).name)
        if it.get("type") == "s3_url" or data.startswith("http"):
            say(f"[runpod] downloading {nm} from S3")
            with urllib.request.urlopen(data, timeout=600) as r, open(dest, "wb") as f:
                shutil.copyfileobj(r, f)
        else:
            if "," in data and data.strip().startswith("data:"):
                data = data.split(",", 1)[1]
            open(dest, "wb").write(_b64.b64decode(data))
        say(f"[runpod] received {nm} ({os.path.getsize(dest)} bytes)")
        names.append(Path(nm).name)
    return _rp_map_outputs(graph, names, rp_dir), "", []


def _comfy_url(cfg) -> str:
    return (((cfg.get("engine") or {}).get("comfy") or {})
            .get("url") or "http://127.0.0.1:8188").rstrip("/")


def _http_json(url, payload=None, timeout=30, read_error_body=False):
    data = json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request(
        url, data=data,
        headers={"Content-Type": "application/json"} if data else {})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return json.loads(r.read().decode() or "{}")
    except urllib.error.HTTPError as e:
        # ComfyUI puts validation results (error + node_errors) in the BODY of
        # a 400 - read it instead of crashing so the caller can report them.
        if not read_error_body:
            raise
        try:
            return json.loads(e.read().decode() or "{}")
        except Exception:
            fail(f"ComfyUI returned HTTP {e.code} with an unreadable body")


def _comfy_upload_image(base, path) -> str:
    boundary = uuid.uuid4().hex
    name = Path(path).name
    if name.lower().endswith(".jxl"):                   # 2.479.0: ComfyUI cannot read JPEG XL - its PNG goes
        import jxl_png
        path, name = jxl_png.png_for(path), Path(path).stem + ".png"
    body = (f"--{boundary}\r\nContent-Disposition: form-data; "
            f'name="image"; filename="{name}"\r\n'
            f"Content-Type: application/octet-stream\r\n\r\n").encode()         + Path(path).read_bytes()         + (f"\r\n--{boundary}\r\nContent-Disposition: form-data; "
           f'name="overwrite"\r\n\r\ntrue\r\n--{boundary}--\r\n').encode()
    req = urllib.request.Request(
        base + "/upload/image", data=body,
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}"})
    with urllib.request.urlopen(req, timeout=120) as r:
        j = json.loads(r.read().decode() or "{}")
    sub = j.get("subfolder") or ""
    return (sub + "/" if sub else "") + (j.get("name") or name)


# RUN TMP (2.223.17, Tim: "create a tmp workflow for each workflow and add
# input nodes as required, then use the workflow name_tmp.json to generate.
# the original workflows won't be touched"): whichever loader resolved the
# graph leaves its SOURCE PATH here, and every queue attempt materializes
# the fully patched graph as <stem>_tmp.json beside that source, then queues
# what it just wrote. The original export is never modified; the _tmp file
# is exactly what ran - open it in ComfyUI to see (or fix) a failing render.
_LAST_WF_PATH = None


def _load_api_workflow(cfg, mode):
    global _LAST_WF_PATH
    wf_map = (((cfg.get("engine") or {}).get("comfy") or {}).get("workflows") or {})
    rel = wf_map.get(mode) or f"comfy_workflows/{mode}.json"
    path = Path(rel) if Path(rel).is_absolute() else Path(cfg["_app_dir"]) / rel
    _LAST_WF_PATH = str(path)
    if not path.exists():
        fail(f"ComfyUI workflow for mode '{mode}' not found: {path}. One-time "
             f"setup: open the matching example from comfy_workflows/ in "
             f"ComfyUI, use Export (API), and save it to that path.")
    g = json.loads(path.read_text(encoding="utf-8"))
    if not (isinstance(g, dict) and all(isinstance(v, dict) and "class_type" in v
                                        for v in g.values())):
        fail(f"{path.name} is a UI export, not an API export. In ComfyUI use "
             f"'Export (API)' (enable dev mode options) and save over it.")
    return g


# ---- VIDEO STYLES (2.110.0, Tim: "use the video style to generate videos") --
MODEL_LOADER_KEYS = ("unet_name", "ckpt_name", "model_name")


def _fill_trim_window(g, job):
    """2.288.0 (the trim pivot): the job's audio_start/audio_dur land on
    every TrimAudioDuration node - the graph cuts the scene's window out
    of the ONE loaded song, so no segment files exist at all. Input names
    differ between builds; fill whichever of the known aliases the node
    carries (or, failing that, the canonical pair)."""
    a = job.get("audio_start"); d = job.get("audio_dur")
    if a is None and d is None:
        return 0
    hit = 0
    for v in g.values():
        if not isinstance(v, dict):
            continue
        if "TrimAudioDuration" not in str(v.get("class_type", "")):
            continue
        ins = v.get("inputs")
        if not isinstance(ins, dict):
            ins = {}
            v["inputs"] = ins
        if a is not None:
            done = False
            for k in ("start_index", "start_time", "start", "offset"):
                if k in ins:
                    ins[k] = float(a); done = True
                    break
            if not done:
                ins["start_index"] = float(a)
        if d is not None:
            done = False
            for k in ("duration", "dur", "length"):
                if k in ins:
                    ins[k] = float(d); done = True
                    break
            if not done:
                ins["duration"] = float(d)
        hit += 1
    if hit:
        say(f"[comfy] trim window: start {a}s duration {d}s on {hit} "
            f"TrimAudioDuration node(s)")
    return hit


def _style_workflow(style, cfg, mode):
    """The template a VIDEO STYLE brings for this mode: style.workflows[mode],
    else style.workflow (one graph for every mode), else the Settings ->
    ComfyUI template. Returns (graph, note)."""
    st = style or {}
    global _LAST_WF_PATH
    rel = str(((st.get("workflows") or {}).get(mode)) or st.get("workflow") or "").strip()
    if not rel:
        return None, ""
    path = Path(rel) if Path(rel).is_absolute() else Path(cfg["_app_dir"]) / rel
    _LAST_WF_PATH = str(path)
    if not path.exists():
        fail(f"video style \"{st.get('name')}\": workflow for {mode} not found: {path}")
    g = json.loads(path.read_text(encoding="utf-8"))
    if not (isinstance(g, dict) and all(isinstance(v, dict) and "class_type" in v
                                        for k, v in g.items() if not str(k).startswith("_"))):
        fail(f"video style \"{st.get('name')}\": {path.name} is a UI export, not an API export.")
    g = {k: v for k, v in g.items() if not str(k).startswith("_")}
    return g, f"video style \"{st.get('name')}\": workflow {path.name} for {mode}"


def _nodes_with_key(g, keys):
    """Node ids (in graph order) whose inputs carry any of `keys` as a literal."""
    out = []
    for nid, v in g.items():
        ins = v.get("inputs") or {}
        if any(k in ins and not isinstance(ins[k], list) for k in keys):
            out.append(nid)
    return out


def _sampler_nodes(g):
    """Samplers in graph order: nodes that take a model and carry `steps`
    (KSampler/Advanced) or a sigmas link (SamplerCustomAdvanced) — the ones a
    PHASE's steps/cfg belong to. BasicScheduler carries the steps for the
    custom sampler, so it is listed for that graph instead."""
    ks = [nid for nid, v in g.items() if "steps" in (v.get("inputs") or {}) and
          str(v.get("class_type")) not in ("BasicScheduler",)]
    if ks:
        return ks
    return [nid for nid, v in g.items() if str(v.get("class_type")) == "BasicScheduler"]


def apply_video_style(g, style, explicit_steps=0):
    """Write a VIDEO STYLE's overrides into a graph. Blank = leave the template's.

      phases[i]  -> the i-th model loader (unet_name/ckpt_name in graph order),
                    the i-th sampler's steps and cfg (Wan 2.2 high/low = 2)
      te[0]      -> every CLIPLoader-style clip_name / clip_name1
      vae        -> every vae_name
      loras      -> a LoraLoaderModelOnly chain in front of phase 1's model
                    (built, so hand-exported graphs without LoRA nodes work)
    Phase 1's steps/cfg are never written: Basic Settings inherited them
    when the style was picked and is what the render uses (2.111.3).
    Returns (graph, notes)."""
    notes = []
    st = style or {}
    loaders = _nodes_with_key(g, MODEL_LOADER_KEYS)
    samplers = _sampler_nodes(g)
    phases = [p for p in (st.get("phases") or []) if isinstance(p, dict)]
    for i, ph in enumerate(phases):
        model = str(ph.get("model") or "").strip()
        if model and i < len(loaders):
            nid = loaders[i]
            key = next(k for k in MODEL_LOADER_KEYS if k in g[nid]["inputs"])
            g[nid]["inputs"][key] = model
            notes.append(f"phase {i + 1}: model -> {nid}.{key} = {model}")
            # 2.409.0: a .gguf model (Basic Settings' Override model, or a style's) needs ComfyUI-GGUF's loader - a plain
            # UNETLoader refuses it
            if model.lower().endswith(".gguf") and g[nid].get("class_type") == "UNETLoader":
                g[nid] = {"class_type": "UnetLoaderGGUF", "inputs": {"unet_name": model}}
                notes.append(f"phase {i + 1}: {model} is GGUF - {nid} loads it with UnetLoaderGGUF (ComfyUI-GGUF)")
        elif model:
            notes.append(f"phase {i + 1}: model \"{model}\" given but the graph has only {len(loaders)} model loader(s) - ignored")
        # 2.303.0 (Tim: "add the 8-bit loading option for users who are using
        # the bf16 models"): the phase's LOAD PRECISION -> its UNETLoader's
        # weight_dtype. fp8 halves a bf16/fp16 model in VRAM. A file that is
        # ALREADY quantized (int8 / fp8 / fp4 / GGUF - read off its name) is
        # left alone: it would not shrink, and int8 weights carry their own
        # scales that a plain fp8 cast would break.
        dtype = str(ph.get("dtype") or "").strip()
        if dtype and i < len(loaders):
            nid = loaders[i]
            ins = g[nid]["inputs"]
            mname = str(model or next((ins[k] for k in MODEL_LOADER_KEYS if k in ins), "")).lower()
            if "weight_dtype" not in ins:
                notes.append(f"phase {i + 1}: load as {dtype} - {nid} ({g[nid].get('class_type')}) "
                             "has no weight_dtype input (only UNETLoader does) - ignored")
            elif dtype != "default" and re.search(r"int8|int4|fp8|fp4|nvfp|e4m3|e5m2|\.gguf$|(^|[_\-.])q[2-8](_|$)", mname):
                notes.append(f"phase {i + 1}: load as {dtype} skipped - {mname or 'the model'} is already "
                             "quantized (8-bit loading is for bf16/fp16 files)")
            else:
                ins["weight_dtype"] = dtype
                notes.append(f"phase {i + 1}: load as {dtype} -> {nid}.weight_dtype")
        elif dtype:
            notes.append(f"phase {i + 1}: load as {dtype} given but the graph has only {len(loaders)} model loader(s) - ignored")
        steps = ph.get("steps")
        if i == 0:
            steps = None       # phase 1's steps/cfg live in BASIC SETTINGS (inherited on pick, 2.111.3)
        if steps is not None and int(steps) > 0 and i < len(samplers):
            sid = samplers[i]
            if "steps" in g[sid]["inputs"] and not isinstance(g[sid]["inputs"]["steps"], list):
                g[sid]["inputs"]["steps"] = int(steps)
                notes.append(f"phase {i + 1}: steps {int(steps)} -> {sid}")
            elif "steps" in g[sid]["inputs"]:
                # H3's switch-driven steps: set both arms (same helper as Basic Settings)
                _set_steps(g, g[sid]["inputs"], int(steps))
                notes.append(f"phase {i + 1}: steps {int(steps)} -> {sid} (switch arms)")
        cfgv = None if i == 0 else ph.get("cfg")
        if cfgv is not None and i < len(samplers) and "cfg" in g[samplers[i]]["inputs"] \
                and not isinstance(g[samplers[i]]["inputs"]["cfg"], list):
            g[samplers[i]]["inputs"]["cfg"] = float(cfgv)
            notes.append(f"phase {i + 1}: cfg {float(cfgv)} -> {samplers[i]}")
    te = str(((st.get("te") or [""])[0]) or "").strip()
    if te:
        for nid in _nodes_with_key(g, ("clip_name", "clip_name1")):
            key = "clip_name" if "clip_name" in g[nid]["inputs"] else "clip_name1"
            g[nid]["inputs"][key] = te
            notes.append(f"text encoder -> {nid}.{key} = {te}")
    vae = str(st.get("vae") or "").strip()
    if vae:
        # the VIDEO vae only: H3 graphs also carry an AUDIO VAE loader, which the
        # style's vae must never overwrite (its current name says "audio")
        cands = [nid for nid in _nodes_with_key(g, ("vae_name",))
                 if "audio" not in str(g[nid]["inputs"].get("vae_name", "")).lower()]
        for nid in cands[:1]:
            g[nid]["inputs"]["vae_name"] = vae
            notes.append(f"vae -> {nid}.vae_name = {vae}")
        if not cands:
            notes.append(f"vae \"{vae}\" given but the graph has no video VAE loader - ignored")
    loras = [l for l in (st.get("loras") or []) if isinstance(l, dict) and str(l.get("path") or "").strip()]
    if loras and loaders:
        src = loaders[0]
        # every node that takes phase 1's MODEL output gets the chain instead
        consumers = [(nid, k) for nid, v in g.items() for k, val in (v.get("inputs") or {}).items()
                     if isinstance(val, list) and len(val) == 2 and str(val[0]) == str(src) and val[1] == 0
                     and k in ("model", "on_true", "on_false")]
        prev = [src, 0]
        for j, l in enumerate(loras):
            nid = f"h3lora{j + 1}"
            g[nid] = {"class_type": "LoraLoaderModelOnly",
                      "inputs": {"lora_name": str(l["path"]).strip(),
                                 "strength_model": float(l.get("weight", 1.0) if l.get("weight") is not None else 1.0),
                                 "model": prev}}
            prev = [nid, 0]
            notes.append(f"lora {j + 1}: {l['path']} @ {g[nid]['inputs']['strength_model']} (built {nid})")
        for nid, k in consumers:
            g[nid]["inputs"][k] = prev
    elif loras:
        notes.append("loras given but the graph has no model loader to hang them on - ignored")
    return g, notes


# ---- VIDEO ACCELERATORS (2.116.0, Tim: "add sage + spectrum accelerators ----
# to our minimax style"). Two MODEL patches a video style can ask for:
#   sage      KJNodes' attention patch ("PathchSageAttentionKJ" - their own
#             spelling, do not fix it) or, for "memeff", the H3-specific
#             MiniMaxH3MemoryEfficientSageAttentionPatch. Needs the
#             `sageattention` wheel inside ComfyUI's python (Settings ->
#             ComfyUI -> Video accelerators installs it).
#   spectrum  xmarre/ComfyUI-Spectrum-MiniMax-H3's SpectrumApplyMiniMaxH3 -
#             skips ~30% of H3 transformer steps by forecasting features. It is
#             APPROXIMATE (motion can differ from a native run), H3-only, and
#             its parameter surface grows release by release - so only
#             `enabled` (+ the aggressive preset's two knobs) is written here
#             and _schema_sync fills everything else from the live server's own
#             /object_info defaults, which since v0.2.1 are the audio-safe path.
# Injected AFTER _patch_workflow (lora bypass and pruning have settled the
# chain) and BEFORE _schema_sync (so missing required inputs get server
# defaults and an absent node pack fails with install guidance, not a 400).
# Placement per Spectrum's README: model loader -> LoRA and other patches ->
# [sage] -> [spectrum] -> guider and sampler.
ACCEL_SAGE_GENERIC = "PathchSageAttentionKJ"
ACCEL_SAGE_MEMEFF = "MiniMaxH3MemoryEfficientSageAttentionPatch"
ACCEL_SPECTRUM = "SpectrumApplyMiniMaxH3"
# 2.503.0 LONG VIDEO (Tim's "secret sauce" export - class names, widget names and values verbatim from it):
ACCEL_LOWVRAM = "MiniMaxLowVRAMAttention"          # KJNodes: head_chunks 4
ACCEL_CHUNKFF = "MiniMaxChunkFeedForward"          # KJNodes: chunks 2, seq_threshold 4096
ACCEL_ATTN_BACKEND = "ModelAttentionBackend"       # ComfyUI core 0.32+: attention "comfy kitchen attention"
# 2.536.0 (Tim: "add veda as an optional video accelerator"): Veda sparse attention for MiniMax H3
# (github.com/veda-sparse/Veda-on-ComfyUI, ComfyUI 0.38+): a learned predictor (ComfyUI/models/veda/) keeps ~10 % of
# the attention tiles and a Triton kernel skips the rest - about 2.9x end to end at its trained sizes (its README:
# 342 s default / 231 s sage / 130 s Veda, 1344x768 5 s, 8-step Turbo LoRA, RTX 5070). It REPLACES attention, so it
# goes LAST on the model wire (after LoRAs / Spectrum, before the guider) and the Sage patch is not used with it.
ACCEL_VEDA = "VedaSparseAttention"
VEDA_PRESETS = {   # widget values written onto the node (strings, as the node takes them)
    "on": {"generated_sparsity": "90%", "reference_sparsity": "90%"},                 # the authors' defaults
    "quality": {"generated_sparsity": "75%", "reference_sparsity": "50%",               # denser: closer to full
                "full_attention_steps": "0"},                                            # attention, slower
}
VEDA_DEFAULT_PREDICTOR = "minimax_h3_t2va_veda_8nfe_600step_preview_fp8.safetensors"   # step- and mode-agnostic (its card)
VEDA_TRAINED_SIZES = ((1344, 768), (768, 1344), (768, 768), (1024, 768))
LONG_PARAMS = {ACCEL_LOWVRAM: {"head_chunks": 4}, ACCEL_CHUNKFF: {"chunks": 2, "seq_threshold": 4096},
               ACCEL_ATTN_BACKEND: {"attention": "comfy kitchen attention"}}
ACCEL_INSTALL_HINTS = {
    ACCEL_SAGE_GENERIC: ("ComfyUI-KJNodes - Settings -> ComfyUI -> Video "
                         "accelerators -> Install KJNodes (or git clone "
                         "https://github.com/kijai/ComfyUI-KJNodes into custom_nodes)"),
    ACCEL_SAGE_MEMEFF: ("the LATEST ComfyUI-KJNodes (the H3 patch is recent - "
                        "git pull inside custom_nodes/ComfyUI-KJNodes, or the "
                        "Install KJNodes button updates it)"),
    ACCEL_SPECTRUM: ("ComfyUI-Spectrum-MiniMax-H3 - Settings -> ComfyUI -> Video "
                     "accelerators -> Install Spectrum (or git clone "
                     "https://github.com/xmarre/ComfyUI-Spectrum-MiniMax-H3 into custom_nodes)"),
    ACCEL_LOWVRAM: ("the LATEST ComfyUI-KJNodes (its MiniMax H3 nodes are recent - Settings -> ComfyUI -> "
                    "Video accelerators -> Update KJNodes, or git pull inside custom_nodes/ComfyUI-KJNodes)"),
    ACCEL_CHUNKFF: ("the LATEST ComfyUI-KJNodes (Settings -> ComfyUI -> Video accelerators -> Update KJNodes)"),
    ACCEL_VEDA: ("Veda-on-ComfyUI (needs ComfyUI 0.38 or later) - Settings -> ComfyUI -> Video accelerators -> "
                  "Install Veda (or git clone https://github.com/veda-sparse/Veda-on-ComfyUI into custom_nodes); its "
                  "predictor goes in ComfyUI/models/veda (Settings -> Models -> Model catalog -> Veda predictor)"),
    ACCEL_ATTN_BACKEND: ("ComfyUI 0.32 or later with comfy-kitchen installed (Settings -> ComfyUI -> Comfy "
                         "Kitchen -> Install); or untick Comfy kitchen in the video docker's settings"),
}
SPECTRUM_PRESETS = {   # written onto the node; every OTHER knob = the node's
    "on": {},          # own (audio-safe, conservative) defaults via schema sync
    "aggressive": {"blend_weight": 0.75, "flex_window": 3.0},   # README's preset
}


def _kitchen_attn(base):
    """2.573.0: does this ComfyUI offer "comfy kitchen attention" in ModelAttentionBackend? True / False / None (unknown)"""
    try:
        info = _http_json(f"{base}/object_info/ModelAttentionBackend", timeout=10) or {}
        spec = (((info.get("ModelAttentionBackend") or {}).get("input") or {}).get("required") or {}).get("attention")
        return "comfy kitchen attention" in _combo_list(spec) if spec else None
    except Exception:              # noqa: BLE001 - unknown: the graph keeps its value
        return None


def _accel_model_edge(g):
    """The FINAL model edge - where an accelerator belongs. (src, consumers):
    src = the link feeding a guider-like node's `model` (a node with both a
    linked `model` and a `conditioning` input, e.g. BasicGuider), else the
    first sampler's linked `model`; consumers = every (nid, "model") input in
    the graph carrying that SAME link. In Tim's fl2va the switch output feeds
    BasicGuider AND BasicScheduler (both repointed); in ref2va the scheduler
    reads the raw loader instead and correctly keeps it (sigmas only)."""
    def model_link(nid):
        v = (g.get(nid, {}).get("inputs") or {}).get("model")
        return v if isinstance(v, list) and len(v) == 2 else None
    src = None
    for nid, v in g.items():
        ins = v.get("inputs") or {}
        if isinstance(ins.get("model"), list) and "conditioning" in ins:
            src = model_link(nid)
            break
    if src is None:
        for nid in _sampler_nodes(g):
            if model_link(nid):
                src = model_link(nid)
                break
    if src is None:
        return None, []
    cons = [(nid, "model") for nid, v in g.items()
            if isinstance((v.get("inputs") or {}).get("model"), list)
            and len(v["inputs"]["model"]) == 2
            and str(v["inputs"]["model"][0]) == str(src[0])
            and v["inputs"]["model"][1] == src[1]]
    return src, cons


def apply_video_accel(g, accel):
    """Inject the accelerator patches a VIDEO STYLE asked for. accel =
    {sage: off|auto|memeff|<sageattn mode>, spectrum: off|on|aggressive}
    (normalized by lib/styles.js). Off/blank/absent = graph untouched.
    Spectrum and the memeff sage patch are H3-only: on a graph with no native
    MiniMaxH3 node they are skipped WITH A NOTE, never sent to fail at the
    server. Returns (g, notes)."""
    ac = accel if isinstance(accel, dict) else {}
    sage = str(ac.get("sage") or "off").strip()
    spectrum = str(ac.get("spectrum") or "off").strip()
    long = str(ac.get("long") or "off").strip() == "on"          # 2.503.0
    kitchen_attn = long and bool(ac.get("kitchen_attn"))
    veda = str(ac.get("veda") or "off").strip()                 # 2.536.0
    veda = veda if veda in VEDA_PRESETS else "off"
    if sage in ("", "off") and spectrum in ("", "off") and not long and veda == "off":
        return g, []
    notes = []
    h3 = any("MiniMaxH3" in str(v.get("class_type") or "") for v in g.values())
    # 2.573.0: FastH3 runs VSA sparse attention (BlockSparseAttention) and must keep it - nothing that replaces
    # attention goes in front of it; Spectrum (step caching) is not for an 8-step distilled model either. Long video
    # keeps only its chunked feed-forward (exact).
    vsa = any((v or {}).get("class_type") == "BlockSparseAttention" for v in g.values())
    if vsa:
        off = [n for n, x in (("sage", sage), ("spectrum", spectrum), ("veda", veda)) if x not in ("", "off")]
        if off:
            notes.append("accel: " + ", ".join(off) + " skipped - this graph runs VSA sparse attention (FastH3), "
                         "which must not be replaced")
        sage = spectrum = veda = "off"
        kitchen_attn = False
    if veda != "off" and not h3:
        notes.append("accel: Veda is MiniMax H3-only and this graph has no native MiniMaxH3 node - skipped")
        veda = "off"
    if veda != "off" and long:
        notes.append("accel: Veda skipped - Long video runs its own low-VRAM attention patch (two attention "
                     "replacements on one model is not a verified combination)")
        veda = "off"
    if veda != "off" and sage not in ("", "off"):
        notes.append(f"accel: sage {sage} skipped - Veda replaces attention itself (its INT8 kernel is "
                     "derived from SageAttention), so a Sage patch in front of it would do nothing")
        sage = "off"
    if long and not h3:
        notes.append("accel: Long video is MiniMax H3-only and this graph has no native MiniMaxH3 node - skipped")
        long = kitchen_attn = False
    if long and sage not in ("", "off"):
        # the export runs its own low-VRAM attention and no Sage patch - two attention patches on one model is
        # not a combination anyone has verified, so the long run keeps the export's
        notes.append(f"accel: sage {sage} skipped - Long video uses the low-VRAM attention patch instead")
        sage = "off"
    if sage == "memeff" and not h3:
        notes.append("accel: sage memeff is H3-only and this graph has no native "
                     "MiniMaxH3 node - skipped")
        sage = "off"
    if spectrum not in ("", "off") and not h3:
        notes.append("accel: Spectrum is H3-only and this graph has no native "
                     "MiniMaxH3 node - skipped")
        spectrum = "off"
    if sage in ("", "off") and spectrum in ("", "off") and not long and veda == "off":
        return g, notes
    src, consumers = _accel_model_edge(g)
    if src is None:
        notes.append("accel: no guider/sampler with a model input in this graph - skipped")
        return g, notes
    prev = src
    if long:     # 2.503.0: the secret-sauce order - [attention backend] -> low-VRAM attention -> chunked feed-forward
        chain = ([("h3attnbe", ACCEL_ATTN_BACKEND)] if kitchen_attn else []) \
            + ([] if vsa else [("h3lowvram", ACCEL_LOWVRAM)]) + [("h3chunkff", ACCEL_CHUNKFF)]
        for nid, ct in chain:
            g[nid] = {"class_type": ct, "inputs": dict({"model": prev}, **LONG_PARAMS[ct])}
            prev = [nid, 0]
        notes.append("accel: Long video -> " + " -> ".join(f"{nid} ({ct})" for nid, ct in chain)
                     + " - head_chunks 4, FF chunks 2 / seq_threshold 4096"
                     + (", comfy kitchen attention" if kitchen_attn else ""))
    if sage not in ("", "off"):
        if sage == "memeff":
            g["h3sage"] = {"class_type": ACCEL_SAGE_MEMEFF, "inputs": {"model": prev}}
            notes.append(f"accel: sage memeff -> h3sage ({ACCEL_SAGE_MEMEFF})")
        else:
            g["h3sage"] = {"class_type": ACCEL_SAGE_GENERIC,
                           "inputs": {"model": prev, "sage_attention": sage}}
            notes.append(f"accel: sage {sage} -> h3sage ({ACCEL_SAGE_GENERIC})")
        prev = ["h3sage", 0]
    if spectrum not in ("", "off"):
        ins = {"model": prev, "enabled": True}
        ins.update(SPECTRUM_PRESETS.get(spectrum, {}))
        g["h3spectrum"] = {"class_type": ACCEL_SPECTRUM, "inputs": ins}
        notes.append(f"accel: spectrum {spectrum} -> h3spectrum ({ACCEL_SPECTRUM})"
                     + (" - blend_weight 0.75, flex_window 3.0"
                        if spectrum == "aggressive" else
                        " - the node's own audio-safe defaults"))
        prev = ["h3spectrum", 0]
    if veda != "off":                                            # LAST: it replaces attention for the sampler
        ins = {"model": prev, "predictor": str(ac.get("veda_predictor") or "").strip() or VEDA_DEFAULT_PREDICTOR}
        ins.update(VEDA_PRESETS[veda])
        g["h3veda"] = {"class_type": ACCEL_VEDA, "inputs": ins}
        notes.append(f"accel: veda {veda} -> h3veda ({ACCEL_VEDA}) - generated {ins['generated_sparsity']}, "
                     f"reference {ins['reference_sparsity']}"
                     + (", full attention on step 0" if ins.get("full_attention_steps") == "0" else ""))
        sz = _graph_size(g)
        if sz and sz not in VEDA_TRAINED_SIZES:
            notes.append(f"accel: Veda's predictor is trained for 1344x768, 768x1344, 768x768 and 1024x768 (5 / 10 / 14 s); "
                         f"{sz[0]}x{sz[1]} uses the nearest trained size's tile plan - compare with Veda off if a "
                         "shot looks softer")
        prev = ["h3veda", 0]
    for nid, key in consumers:
        g[nid]["inputs"][key] = prev
    return g, notes


def _graph_size(g):
    """(width, height) the graph renders at - the first node with integer width + height inputs - or None."""
    for v in g.values():
        ins = (v or {}).get("inputs") or {}
        w, h = ins.get("width"), ins.get("height")
        if isinstance(w, int) and isinstance(h, int) and not isinstance(w, bool) and w > 0 and h > 0:
            return (w, h)
    return None


def _combo_list(spec):
    """A ComfyUI combo input's choices - [[...], {...}] (old) or ["COMBO", {"options": [...]}] (new) -> list."""
    if isinstance(spec, list) and spec:
        if isinstance(spec[0], list):
            return [str(x) for x in spec[0]]
        if spec[0] == "COMBO" and len(spec) > 1 and isinstance(spec[1], dict):
            return [str(x) for x in (spec[1].get("options") or [])]
    return []


def pick_veda_predictor(wanted, listed, ref2va):
    """The predictor file to use (pure): the style's own when ComfyUI lists it (by file name, any subfolder);
    else an R2VA one for a reference graph, else a T2VA one, else the first listed; "" when none is there."""
    L = [str(x) for x in (listed or [])]
    if not L:
        return ""
    w = str(wanted or "").strip().replace("\\", "/")
    if w:
        for x in L:
            if x == w or x.replace("\\", "/").split("/")[-1].lower() == w.split("/")[-1].lower():
                return x
    for key in (("r2va", "t2va") if ref2va else ("t2va", "r2va")):
        for x in L:
            if key in x.lower():
                return x
    return L[0]


def _veda_resolve(base, g):
    """2.536.0: point h3veda at a predictor this ComfyUI lists (or say where to get one). Never touches a graph
    without h3veda; a server that does not answer leaves it to schema sync (which names a missing pack)."""
    node = g.get("h3veda")
    if not (isinstance(node, dict) and node.get("class_type") == ACCEL_VEDA):
        return
    try:
        info = (_http_json(f"{base}/object_info/{ACCEL_VEDA}", timeout=10) or {}).get(ACCEL_VEDA)
    except Exception:                                            # noqa: BLE001
        return
    if not info:
        return                                                   # the pack is missing: _schema_sync fails with how to install it
    inp = info.get("input") or {}
    listed = _combo_list((inp.get("required") or {}).get("predictor") or (inp.get("optional") or {}).get("predictor"))
    ref2va = any("ReferenceToVideo" in str(v.get("class_type") or "") for v in g.values())
    want = node["inputs"].get("predictor", "")
    got = pick_veda_predictor("" if want == VEDA_DEFAULT_PREDICTOR else want, listed, ref2va)   # the default = "pick one"
    if not got:
        fail("the video style asks for Veda sparse attention but ComfyUI/models/veda has no predictor. Download "
             "it: Settings -> Models -> Model catalog -> \"Veda predictor (MiniMax H3)\" (275 MB, from "
             "Veda-Sparse/Minimax-H3-T2VA-Veda-8NFE-600Step-Preview), restart ComfyUI and generate again - or set "
             "the style's Veda to Off (Settings -> Video styles).")
    node["inputs"]["predictor"] = got
    say(f"[comfy] veda: predictor {got}" + (f" (the style's {want} is not listed)" if want and got.split('/')[-1] != str(want).split('/')[-1] else ""))


ACCEL_NODE_IDS = ("h3sage", "h3spectrum", "h3attnbe", "h3lowvram", "h3chunkff", "h3veda")


def accel_nodes(g):
    """{node_id: class_type} for the accelerators THIS graph actually carries.

    Only the ids apply_video_accel injects, and only when the class is one of
    ours: a template that happens to contain a Sage node of its own is the
    workflow's business, not something to rip out on a failure.
    """
    ours = set(ACCEL_INSTALL_HINTS)
    return {nid: str((g.get(nid) or {}).get("class_type") or "")
            for nid in ACCEL_NODE_IDS
            if str((g.get(nid) or {}).get("class_type") or "") in ours}


def drop_accel_node(g, nid):
    """Remove ONE injected accelerator and heal the model chain over the gap.

    The passthrough is exactly the one the LoRA bypass already does: every
    input pointing at `nid` is repointed to that node's OWN `model` input, so
    loader -> [sage] -> [spectrum] -> guider becomes loader -> [sage] ->
    guider when spectrum goes, and loader -> [spectrum] -> guider when sage
    does. The OTHER accelerator is never touched — only one of them failed.
    Returns (g, True) when it was removed, (g, False) when there was nothing to
    remove or nothing to rewire to (which would silently break the graph).
    """
    node = g.get(nid)
    if not isinstance(node, dict):
        return g, False
    up = (node.get("inputs") or {}).get("model")
    if not (isinstance(up, list) and len(up) == 2):
        return g, False
    for other, v in g.items():
        if other == nid:
            continue
        for k, val in list((v.get("inputs") or {}).items()):
            if isinstance(val, list) and len(val) == 2 and str(val[0]) == str(nid):
                v["inputs"][k] = list(up)
    g.pop(nid, None)
    return g, True


def _strip_upscale(g):
    """Remove the in-line upscale resample stage — the fast-render bypass.

    Tim's MM3 export runs MMH3UltimateUpscale BETWEEN the sampler and the
    decode/segment-save, so every render pays the upscale pass. API-format
    ComfyUI has no boolean/conditional execution: bypass IS physical removal
    (the Ctrl+B rule the LoRA bypass already follows). Each *UltimateUpscale
    node's consumers are repointed to that node's own `latent` input — the
    un-upscaled sampler output — and the node is deleted; its private feeders
    (upscale/split params, its own noise/sampler/scheduler and model chain)
    become detached and the sink-ancestor prune sweeps them. Returns
    (g, [names removed]); a node whose `latent` is not wired is LEFT IN and
    named, because removing it would leave its consumers dangling.
    """
    removed = []
    for nid in list(g.keys()):
        v = g.get(nid) or {}
        ct = str(v.get("class_type", ""))
        if "ultimateupscale" not in ct.lower():
            continue
        up = (v.get("inputs") or {}).get("latent")
        if not (isinstance(up, list) and len(up) == 2):
            say(f"[comfy] upscale bypass: {ct}#{nid} has no wired `latent` "
                "input, so it stays in the graph")
            continue
        for other, ov in g.items():
            if other == nid:
                continue
            for k, val in list((ov.get("inputs") or {}).items()):
                if isinstance(val, list) and len(val) == 2 and str(val[0]) == str(nid):
                    ov["inputs"][k] = list(up)
        g.pop(nid, None)
        removed.append(f"{ct}#{nid}")
    return g, removed


def _accel_preflight(base, g):
    """Say, BEFORE the first queue, when an accelerator pack looks out of date.

    The cure the seatbelt below cannot provide: ComfyUI 0.34 moved sigma
    shifting into the MiniMax H3 model (its own new `MiniMaxH3SigmaShift` node
    is the marker), and a Spectrum build older than that calls the transformer
    with the pre-0.34 argument list. We cannot read a pack's version over HTTP,
    so this does not block anything — it warns, and says what will happen if it
    is right. Never fatal: a server that will not answer /object_info still
    renders.
    """
    nodes = accel_nodes(g)
    if not any(ct == ACCEL_SPECTRUM for ct in nodes.values()):
        return
    try:
        info = _http_json(f"{base}/object_info/MiniMaxH3SigmaShift", timeout=10)
    except Exception:                                       # noqa: BLE001
        return
    if not (info or {}).get("MiniMaxH3SigmaShift"):
        return
    say("[comfy] accel preflight: this ComfyUI has the native MiniMaxH3SigmaShift "
        "node, i.e. it is 0.34+ and sigma shifting lives inside the H3 model now. "
        "A Spectrum build older than that calls the model the old way and fails in "
        "the sampler; if that happens this run drops Spectrum and re-queues rather "
        "than throwing the render away. Settings -> ComfyUI -> Video accelerators "
        "-> Install Spectrum updates the pack.")


LOADER_KINDS = {  # loader class -> (kind, filename input key candidates)
    "LoadImage": ("images", ("image",)),
    "LoadImageMask": ("images", ("image",)),
    "LoadVideo": ("videos", ("file", "video")),
    "VHS_LoadVideo": ("videos", ("video", "file")),
    "LoadAudio": ("audios", ("audio", "file")),
    # 2.144.0, from Tim's Scene 1 failure ("only one was filled"): the
    # MM3_Characters chain's voice loaders are VHS_LoadAudioUpload (his own
    # export, and the class buildChain emits). Absent from this table, the
    # worker reported "0/0 audio", never wrote the UPLOADED name back into
    # the node (the tmp file's value is the project-disk basename, which is
    # only right by coincidence of names), and could never prune an unused
    # voice slot. The input key is "audio" in his export - not guessed.
    "VHS_LoadAudioUpload": ("audios", ("audio", "file")),
}


def _remove_nodes(g, dead):
    """Delete nodes and REWIRE the reference chain through the gap (this is the
    'bypass': consumers of a deleted node get repointed to that node's own
    upstream chain link, followed transitively; no upstream -> input drops).
    Two chain vocabularies exist: the RH pack links Reference nodes with
    'references'; the MM3 scheduled chain links Scheduled*Reference nodes with
    'previous' (2.144.0). Both are healed the same way - removing one link of
    a chain must never orphan everything downstream of it."""
    def resolve(nid, seen=None):
        seen = seen or set()
        if nid not in dead:
            return None                      # alive - caller keeps its own link
        if nid in seen:
            return "drop"
        seen.add(nid)
        ins = g.get(nid, {}).get("inputs") or {}
        up = ins.get("references") or ins.get("previous")
        if not (isinstance(up, list) and up):
            return "drop"
        return up if str(up[0]) not in dead else resolve(str(up[0]), seen) or up
    for v in g.values():
        ins = v.get("inputs") or {}
        for key in list(ins):
            val = ins[key]
            if isinstance(val, list) and val and str(val[0]) in dead:
                r = resolve(str(val[0]))
                if r == "drop" or r is None:
                    ins.pop(key)
                else:
                    ins[key] = r
    for nid in dead:
        g.pop(nid, None)


def _frame_slot_loaders(g):
    """Map a native I2V gen node's first_frame/last_frame inputs to the
    LoadImage nodes that actually feed them.

    Image loaders are otherwise assigned in node-id order, which only lands
    the right way round by luck: an export whose last-frame loader happens to
    carry the lower id would silently swap the two keyframes. Following the
    links instead makes the fl2va hand-off independent of how ComfyUI numbered
    the nodes on export.
    """
    out = {}
    for gv in g.values():
        if "MiniMaxH3" not in str(gv.get("class_type", "")):
            continue
        ins = gv.get("inputs") or {}
        for slot in ("first_frame", "last_frame"):
            link, seen = ins.get(slot), set()
            while isinstance(link, list) and link and str(link[0]) not in seen:
                nid = str(link[0])
                seen.add(nid)
                node = g.get(nid)
                if not node:
                    break
                if LOADER_KINDS.get(node.get("class_type"), ("",))[0] == "images":
                    out[slot] = nid           # found the loader behind the slot
                    break
                link = (node.get("inputs") or {}).get("image")   # hop resizers etc.
    return out


def _steps_value_nodes(g, link, hops=0, seen=None):
    """Every PrimitiveInt-like value node reachable from a scheduler's 'steps'
    link, following BOTH arms of any ComfySwitchNode on the way.

    The official H3 templates gate steps behind a boolean feeding a
    ComfySwitchNode: on_false = full step count, on_true = the distilled (LoRA)
    count. Which arm is live depends on the LoRA toggle, and that toggle is
    flipped LATER in patching than this runs — so instead of guessing the arm,
    set the user's step count on EVERY reachable value node. Only one is ever
    selected; writing the same value to both keeps the graph correct whichever
    the switch picks, and never depends on evaluation order. Returns a list of
    the input dicts to write 'value' into.
    """
    seen = seen or set()
    out = []
    if not (isinstance(link, list) and link) or hops >= 50:
        return out
    nid = str(link[0])
    if nid in seen:
        return out
    seen.add(nid)
    v = g.get(nid)
    if not v:
        return out
    ins = v.get("inputs") or {}
    ct = str(v.get("class_type", ""))
    if "switch" in ct.lower() and ("on_true" in ins or "on_false" in ins):
        out += _steps_value_nodes(g, ins.get("on_true"), hops + 1, seen)
        out += _steps_value_nodes(g, ins.get("on_false"), hops + 1, seen)
        return out
    if "value" in ins and not isinstance(ins["value"], list):
        out.append(ins)                        # a PrimitiveInt-like literal node
    return out


BASE_STEPS = 20        # the official H3 exports' base-model step count
LORA_STEPS_FALLBACK = 8  # a turbo LoRA whose file name does not say its count


def _switch_arm_value(g, link, arm, hops=0):
    """Follow a scheduler's 'steps' link to the literal on ONE arm of the LoRA
    steps-switch (arm = "on_true" | "on_false"). Returns an int or None."""
    seen = set()
    while isinstance(link, list) and link and hops < 50:
        nid = str(link[0])
        if nid in seen:
            return None
        seen.add(nid)
        v = g.get(nid) or {}
        ins = v.get("inputs") or {}
        if "switch" in str(v.get("class_type", "")).lower() and arm in ins:
            link = ins[arm]
        elif "value" in ins and not isinstance(ins["value"], list):
            return int(ins["value"]) if isinstance(ins["value"], (int, float)) else None
        else:
            return None
        hops += 1
    return None


def resolve_steps(g, steps, use_lora):
    """STEPS FOLLOW THE LoRA TOGGLE (2.100.0). `steps` <= 0 means AUTO:

      * LoRA enabled  -> the LoRA's own count, parsed from its file name
        ("minimax_h3_fl2v_turbo_8step_..." -> 8, "..._4step_..." -> 4), else 8.
      * LoRA disabled -> the template's base literal: a literal BasicScheduler
        .steps, or the on_false arm of its steps-switch (20 in the official
        exports and in Tim's own), else BASE_STEPS.

    A positive `steps` is the user's explicit override and is used as-is.
    Why: one Steps field used to drive every workflow with the fixed default 8
    — the LoRA count — patched into BASE-model runs, which underbakes them
    (Tim's working r2v export runs the base model at 20). Returns (steps, note).
    """
    try:
        steps = int(steps or 0)
    except (TypeError, ValueError):
        steps = 0
    if steps > 0:
        return steps, f"steps={steps} (explicit)"
    if use_lora:
        for v in g.values():
            if "loraloader" not in str(v.get("class_type", "")).lower():
                continue
            name = str((v.get("inputs") or {}).get("lora_name", ""))
            m = re.search(r"(\d+)\s*[-_]?step", name, re.I)
            if m:
                return int(m.group(1)), f"steps={m.group(1)} (auto: LoRA {Path(name).name})"
        return LORA_STEPS_FALLBACK, (f"steps={LORA_STEPS_FALLBACK} (auto: LoRA enabled, "
                                     f"its file name does not say its step count)")
    for v in g.values():
        if str(v.get("class_type", "")) != "BasicScheduler":
            continue
        ins2 = v.get("inputs") or {}
        # 2.147.0 (Tim's high-noise character-ref render): a partial-denoise
        # scheduler is a REFINE pass, never the base count. The MM3H export's
        # upscale stage runs BasicScheduler steps=1 denoise=0.2 — taking that
        # literal as "the template's base literal" made the MAIN sampler run
        # ONE step, which is a render that is mostly noise.
        d = ins2.get("denoise")
        if isinstance(d, (int, float)) and not isinstance(d, bool) and d < 1:
            continue
        cur = ins2.get("steps")
        if isinstance(cur, (int, float)) and not isinstance(cur, bool) and cur > 0:
            return int(cur), f"steps={int(cur)} (auto: template literal, base model)"
        base = _switch_arm_value(g, cur, "on_false")
        if base:
            return base, f"steps={base} (auto: template base arm, LoRA off)"
        if isinstance(cur, list) and cur \
                and "Chain" in str((g.get(str(cur[0])) or {}).get("class_type", "")):
            # the chain pipeline feeds per-shot steps from plan_json — the
            # graph drives its own count and NOTHING should be written (0 is
            # the do-not-write sentinel _set_steps honours)
            return 0, ("steps: the graph drives its own per-shot count "
                       "(ChainCurrent link) — left untouched")
    return BASE_STEPS, f"steps={BASE_STEPS} (auto: base model, template has no step literal)"


def _set_steps(g, sched_ins, steps):
    """Set a scheduler's step count WITHOUT severing a switch that drives it.

    Literal 'steps': overwrite it. Link into the LoRA steps-switch: set the
    user's count on every value node BOTH arms reach (see _steps_value_nodes) —
    order-independent and correct whichever arm the toggle selects — and leave
    the link in place so the switch stays whole. Severing that link is the
    Errno-22 scheduler bug. Returns a short note for the log.
    """
    if not isinstance(steps, int) or steps <= 0:
        # 0 is resolve_steps' do-not-write sentinel: the graph (a chain plan)
        # drives its own count. Writing a 0 here is a degenerate schedule and
        # was the "high noise" half of Tim's character-ref failure.
        return "steps left as the graph wires them (graph-driven)"
    d = sched_ins.get("denoise")
    if isinstance(d, (int, float)) and not isinstance(d, bool) and d < 1:
        # a partial-denoise REFINE pass keeps its exported count — stamping the
        # base count onto a denoise-0.2 polish stage changes what it is
        return (f"refine scheduler (denoise {d}) left at its exported count "
                f"of {sched_ins.get('steps')}")
    cur = sched_ins.get("steps")
    if not isinstance(cur, list):              # already a literal: plain set
        sched_ins["steps"] = steps
        return f"steps={steps} (literal)"
    targets = _steps_value_nodes(g, cur)
    if targets:
        for t in targets:
            t["value"] = steps
        where = "both switch branches" if len(targets) > 1 else "the switch branch"
        return f"steps={steps} (set on {where}, link kept — switch intact)"
    # An unresolvable LINK is LEFT WIRED (2.147.0). The old fallback forced a
    # literal over it, which on a chain graph replaced the per-shot step feed
    # (ChainCurrent) with one number — a link is never overwritten with a
    # scalar unless what feeds it was actually resolved (the 2.127.0 rule).
    return ("steps left WIRED — this scheduler is driven by the graph "
            "(a chain plan or an unmodelled source); the requested count "
            f"of {steps} does not apply to it")


def _apply_refmods(g, names):
    """CHARACTER REFMODS (2.225.0): splice Load H3 RefMods + Apply H3 RefMod
    between MiniMaxH3ReferenceToVideo's conditioning output and its
    consumer(s) (BasicGuider in the shipped ref2va export). Every node/input
    name is VERIFIED against ComfyUI-MiniMaxH3Mod @ cd27d1109a0d (see
    lib/refmods.js for the pin): the loader's slots are mod_1..8 /
    strength_1..8 / copies_1..8 with "(none)" for empty; Apply accepts the
    native CONDITIONING and returns the same type, so the guider never
    knows the difference. No-op without names or without an R2V node —
    the chain flow and plain extend graphs pass through untouched."""
    names = [str(n) for n in (names or []) if n]
    if not names:
        return g
    r2v = next((k for k, v in g.items() if isinstance(v, dict)
                and "ReferenceToVideo" in str(v.get("class_type", ""))), None)
    via = "ReferenceToVideo"
    if not r2v:
        # 2.388.0 (Tim: "is it possible to use refmods in fl2va?"): yes - fl2va's MiniMaxH3ImageToVideo hands the
        # guider the same CONDITIONING (output 0) the R2V node does, so the mods splice in at the same place. A
        # scene's fl2va hand-off chunks keep the cast's mods now. Said as experimental: the pack is built around R2V.
        r2v = next((k for k, v in g.items() if isinstance(v, dict)
                    and "ImageToVideo" in str(v.get("class_type", ""))
                    and "MiniMaxH3" in str(v.get("class_type", ""))), None)
        via = "ImageToVideo"
    if not r2v:
        say("[comfy] refmods requested but the graph has no "
            "MiniMaxH3ReferenceToVideo / MiniMaxH3ImageToVideo node - skipped")
        return g
    if via == "ImageToVideo":
        say("[comfy] refmods on fl2va: spliced after MiniMaxH3ImageToVideo's conditioning "
            "(experimental - the mods were made for References renders)")
    if len(names) > 8:
        say(f"[comfy] {len(names) - 8} refmod(s) beyond the loader's 8 slots stay out: "
            + ", ".join(names[8:]))
        names = names[:8]
    lid, aid = "refmod_loader", "refmod_apply"
    loader = {"show_info": False}
    for i in range(1, 9):
        loader[f"mod_{i}"] = names[i - 1] if i <= len(names) else "(none)"
        loader[f"strength_{i}"] = 1.0
        loader[f"copies_{i}"] = 1
    g[lid] = {"class_type": "MiniMaxH3RefModsLoader", "inputs": loader}
    g[aid] = {"class_type": "MiniMaxH3RefModApply", "inputs": {
        "conditioning": [r2v, 0], "mods": [lid, 0],
        "override": False, "retention": 1.0,
        "curve_direction": "constant", "curve_shape": "linear",
        "curve_value": 1.0, "scramble_seed": -1,
        "scramble_mode": "legacy_subset", "scramble_keep": 1,
        "graph_preset": "", "save_preset_as": "", "max_total_tokens": 0}}
    moved = 0
    for nid, node in g.items():
        if nid == aid or not isinstance(node, dict):
            continue
        for key, v in list((node.get("inputs") or {}).items()):
            if isinstance(v, list) and len(v) == 2                     and str(v[0]) == str(r2v) and int(v[1]) == 0:
                node["inputs"][key] = [aid, 0]
                moved += 1
    say(f"[comfy] refmods: {len(names)} spliced before the sampler "
        f"({', '.join(names)}); {moved} conditioning consumer(s) rewired")
    return g



def _patch_workflow(g, *, prompt, seed, frames, width, height, steps,
                    images, videos=(), audios=(), use_lora=False, cfg=1.0,
                    clip_device="", upscale=True, force_seed=False, plan_seed=None):
    """Set values by key presence on the pack's nodes; assign uploaded refs to
    loader slots in order; prune every unused loader + its reference node and
    rewire the chain, so the graph always matches the loaded ref counts.
    use_lora: keep the workflow's LoRA node(s) and flip its enable switch
    (Settings -> ComfyUI -> 4-step LoRA); otherwise every LoraLoader is
    bypassed like Ctrl+B, with model/clip rewired straight through.
    upscale=False: strip the in-line *UltimateUpscale stage (fast render) —
    see _strip_upscale; its detached feeders fall to the prune below."""
    if not upscale:
        g, up_removed = _strip_upscale(g)
        if up_removed:
            say(f"[comfy] upscale bypass: removed {', '.join(up_removed)} "
                "(fast render; consumers rewired to the un-upscaled latent)")
        else:
            say("[comfy] upscale bypass requested, but this workflow has no "
                "*UltimateUpscale node - nothing to remove")
    dur = round(frames / FPS, 3)
    gen_hit = False
    chain_kept = set()          # plan-driven inputs deliberately left wired
    g_remove = []               # nodes bypassed this run (ScenePromptEditor)
    for k, v in g.items():
        ins = v.setdefault("inputs", {})
        ct = str(v.get("class_type", ""))
        if ct == "MiniMaxH3ChainReview":
            # BEFORE the generic MiniMaxH3 branch, which would swallow it.
            # An API render has no reviewer: with review on, every segment
            # idles for auto_continue_timeout_minutes waiting for a click in
            # ComfyUI's UI that will never come — "doesn't complete". Off for
            # this run only; the export on disk is untouched.
            if ins.get("enabled"):
                ins["enabled"] = False
                say(f"[comfy] ChainReview#{k} disabled for this run - an API "
                    "render has no reviewer; segments would idle "
                    f"{ins.get('auto_continue_timeout_minutes', '?')} min each")
        elif ct == "MiniMaxH3ChainScenePromptEditor":
            # 2.167.0 (Tim: "setting the default duration doesn't change the
            # duration ... only rendering scene 1 ... the settings in the
            # character ref workflow are not following all the inputs from
            # the app"). This node sits BETWEEN ChainPlan and ChainLoopStart
            # in his export (9 -> 11 -> 17): an interactive per-scene editor
            # — the same species as ChainReview — whose UI-edited state rides
            # the workflow and OVERRIDES the plan_json the app just wrote.
            # An API render has no editor at the desk, and THE PLAN IS THE
            # TRUTH: the node is bypassed for this run (consumers rewired to
            # its own `plan` input — physical removal, the Ctrl+B rule) so
            # the app's plan reaches the loop unedited. The export on disk
            # keeps its editor. A pure pass-through loses nothing; a node
            # holding stale edits stops shadowing every duration, prompt and
            # scene the app sets.
            up = ins.get("plan")
            if isinstance(up, list) and len(up) == 2:
                for other, ov in g.items():
                    if other == k:
                        continue
                    for ik, val in list((ov.get("inputs") or {}).items()):
                        if (isinstance(val, list) and len(val) == 2
                                and str(val[0]) == str(k)):
                            ov["inputs"][ik] = list(up)
                say(f"[comfy] ScenePromptEditor#{k} bypassed for this run - "
                    "an API render has no editor at the desk; the plan the "
                    "app wrote flows through unedited")
                g_remove.append(k)
            else:
                say(f"[comfy] ScenePromptEditor#{k} has no wired plan input, "
                    "so it stays - check this workflow's plan path if scenes "
                    "ignore the app's settings")
        elif "MiniMaxH3" in ct:                           # RH pack OR native
            # native official exports feed prompt/width/height/length via
            # primitive+math nodes; writing literals here detaches those
            # helpers (pruned as dangling below). 'length' is the native
            # frame-count input — the worker owns the 17k+5 snap.
            # 2.147.0 (Tim's character-ref render): on a CHAIN graph these
            # inputs are LINKED from ChainCurrent — the plan's per-shot
            # prompt/seed/length/size. Overwriting a chain link with one
            # literal renders every scene with the same prompt at one length;
            # a helper link may be severed (it is pruned after), a chain link
            # never. Key presence still satisfies the gen-node check.
            for key, val in (("prompt", prompt), ("seed", seed),
                             ("duration_seconds", dur), ("length", frames),
                             ("width", width), ("height", height),
                             ("steps", steps), ("sigma_points", steps),
                             ("cfg", cfg)):
                if key in ins:
                    gen_hit = gen_hit or key == "prompt"
                    if key in ("steps", "sigma_points") and (
                            not isinstance(steps, int) or steps <= 0):
                        continue          # graph-driven: the do-not-write sentinel
                    cur = ins[key]
                    # 2.384.0: a seed the user set (the scene card / the ⚙ "same seed") beats the plan's link -
                    # one scene renders, so only the seed input leaves the chain
                    if isinstance(cur, list) and cur and "Chain" in str(
                            (g.get(str(cur[0])) or {}).get("class_type", "")) and not (key == "seed" and force_seed):
                        chain_kept.add(key)
                        continue
                    ins[key] = val
        elif ct == "RandomNoise" and "noise_seed" in ins:   # native seed node
            cur = ins["noise_seed"]
            if isinstance(cur, list) and cur and "Chain" in str(
                    (g.get(str(cur[0])) or {}).get("class_type", "")) and not force_seed:
                chain_kept.add("noise_seed")            # the plan's per-shot seed
            else:
                ins["noise_seed"] = seed
        elif ct == "BasicScheduler" and "steps" in ins:     # native step count
            note = _set_steps(g, ins, steps)
            say(f"[comfy] BasicScheduler: {note}")
    if not gen_hit:
        fail("no MiniMaxH3 node with a 'prompt' input found in the workflow "
             "- is this an Export (API) of a MiniMax H3 graph (native "
             "MiniMaxH3ReferenceToVideo/ImageToVideo or the RH pack)?")
    if force_seed:
        say(f"[comfy] seed used: {seed} (set for this scene)")
    elif ("seed" in chain_kept or "noise_seed" in chain_kept) and plan_seed is not None:
        say(f"[comfy] seed used: {plan_seed} (the plan's, for this scene)")   # 2.384.0: the job's metadata
    if chain_kept:
        say("[comfy] chain graph: " + ", ".join(sorted(chain_kept))
            + " ride the PLAN (ChainCurrent links kept) - Basic Settings' "
            "values do not apply to plan-driven inputs; edit the screenplay "
            "or the scene board instead")
    # the bypassed editors leave the graph AFTER the walk (consumers already
    # rewired to their plan input above; popping mid-iteration would raise)
    for k in g_remove:
        g.pop(k, None)
    files = {"images": list(images), "videos": list(videos), "audios": list(audios)}
    if _rs is not None and (videos or audios):      # 2.353.0: slots for the references given
        for n in _rs.add_missing(g, len(videos), len(audios), {c: k[0] for c, k in LOADER_KINDS.items()}):
            say(f"[comfy] {n}")
    # NATIVE dynamic ref inputs (ref_images.ref_image_0, ...): official
    # exports usually carry ONE slot per kind; clone the loader node and add
    # the next dotted input for every extra reference (model limit 9/3/3).
    for kind_key, stem in (("images", "ref_image"), ("videos", "ref_video"),
                           ("audios", "ref_audio")):
        have = files[kind_key]
        for gid, gv in g.items():
            if "MiniMaxH3" not in str(gv.get("class_type", "")):
                continue
            slot_keys = [key for key in (gv.get("inputs") or {})
                         if re.fullmatch(rf"\w+\.{stem}_\d+", key)]
            if not slot_keys or len(have) <= len(slot_keys):
                continue
            first = min(slot_keys, key=lambda s: int(s.rsplit("_", 1)[1]))
            link = gv["inputs"][first]
            if not (isinstance(link, list) and link and str(link[0]) in g):
                continue
            proto, prefix = g[str(link[0])], first.split(".", 1)[0]
            # 2.290.0: only a LOADER is a slot to clone. In the NativeAudio
            # export ref_audio_0 hangs off TrimAudioDuration (song -> trim
            # -> slot 0): cloning THAT would feed every extra slot the same
            # trimmed song and leave the voices ignored. The export ships
            # its own 9/3 loaders now; a non-loader head grows nothing.
            if str(proto.get("class_type", "")) not in LOADER_KINDS:
                say(f"[comfy] {gv.get('class_type')}#{gid}.{first} is fed by "
                    f"{proto.get('class_type')} (not a loader) - no extra {stem} "
                    "slots cloned; the graph's own loaders take the references")
                continue
            nid = max((int(x) for x in g if str(x).isdigit()), default=1000)
            idx = max(int(s.rsplit("_", 1)[1]) for s in slot_keys)
            extra = len(have) - len(slot_keys)
            for _ in range(extra):
                nid, idx = nid + 1, idx + 1
                g[str(nid)] = copy.deepcopy(proto)
                gv["inputs"][f"{prefix}.{stem}_{idx}"] = [str(nid), 0]
            say(f"[comfy] cloned {extra} extra {stem} loader slot(s)")
            break
    # IMAGEBATCHMULTI SLOT GROWTH (2.223.13; the export that introduced it
    # was removed in 2.227.0, kept for ANY graph that batches refs): a
    # KJNodes ImageBatchMulti (inputcount + image_1..image_N, each fed by its
    # own LoadImage). An export carries a FIXED slot count; more pictures
    # than slots would be "ignored" by the generic fill below, so — mirroring
    # the dotted-slot cloning above — the prototype loader behind image_1 is
    # cloned per missing slot and the node's inputcount follows. Growth only
    # covers the graph-wide loader SHORTFALL, so a graph whose other image
    # loaders already absorb the files never over-clones. The shrink half
    # (fewer pictures than slots) runs after slot assignment, where the dead
    # loaders are known.
    for gid, gv in g.items():
        if str(gv.get("class_type", "")) != "ImageBatchMulti":
            continue
        ins = gv.setdefault("inputs", {})
        slot_keys = sorted([k for k in ins if re.fullmatch(r"image_\d+", k)],
                           key=lambda s: int(s.rsplit("_", 1)[1]))
        if not slot_keys:
            continue
        link = ins[slot_keys[0]]
        if not (isinstance(link, list) and link and str(link[0]) in g
                and LOADER_KINDS.get(g[str(link[0])].get("class_type"),
                                     ("",))[0] == "images"):
            continue                      # not a loader-backed batch: hands off
        total_loaders = sum(1 for v in g.values()
                            if LOADER_KINDS.get(v.get("class_type"),
                                                ("",))[0] == "images")
        extra = min(len(files["images"]) - total_loaders,
                    len(files["images"]) - len(slot_keys))
        if extra <= 0:
            continue
        proto = g[str(link[0])]
        nid = max((int(x) for x in g if str(x).isdigit()), default=1000)
        idx = max(int(s.rsplit("_", 1)[1]) for s in slot_keys)
        for _ in range(extra):
            nid, idx = nid + 1, idx + 1
            g[str(nid)] = copy.deepcopy(proto)
            ins[f"image_{idx}"] = [str(nid), 0]
        if "inputcount" in ins and not isinstance(ins["inputcount"], list):
            ins["inputcount"] = len(slot_keys) + extra
        say(f"[comfy] ImageBatchMulti#{gid}: grew {extra} image slot(s) "
            f"({len(slot_keys)} -> {len(slot_keys) + extra}) for the "
            "loaded reference pictures")
        break
    dead = set()
    # STABLE TAGS (2.145.0, from a live node error on Tim's machine): the
    # Scheduled*Reference pack validates its tag widget - "Reference tag must
    # be a stable tag such as 'hero_face' or '@hero-face'". buildChain now
    # emits clean tags, but an OLD tmp file or a VERBATIM export (the
    # MM3H-Character-ref style's demo tags are "jinx voice" / "shazaib
    # voice", spaces and all) would still die at execution. This is a
    # separator-class repair (canonicalise_combos' doctrine): the same tag in
    # the accepted spelling, reported, never a different tag.
    for nid, gv in g.items():
        ct = str(gv.get("class_type", ""))
        if not ("Scheduled" in ct and "Reference" in ct):
            continue
        t = (gv.get("inputs") or {}).get("tag")
        if not isinstance(t, str) or re.fullmatch(r"@?[A-Za-z0-9_-]+", t):
            continue
        at = "@" if t.startswith("@") else ""
        fixed = at + (re.sub(r"[^A-Za-z0-9_-]+", "_", t.lstrip("@")).strip("_") or "ref")
        gv["inputs"]["tag"] = fixed
        say(f"[comfy] tag '{t}' -> '{fixed}' on {nid} ({ct}) - the reference "
            "pack requires stable tags (letters, digits, _ and - only)")
    slots = _frame_slot_loaders(g)
    for kind_key in ("images", "videos", "audios"):
        load_ids = sorted([k for k, v in g.items()
                           if LOADER_KINDS.get(v.get("class_type"), ("",))[0] == kind_key],
                          key=lambda x: int(x) if str(x).isdigit() else 0)
        have = files[kind_key]
        # fl2va: the caller passes [first] or [first, last], so putting the
        # first_frame loader at index 0 and the last_frame loader at index 1
        # means a missing last frame leaves ITS loader unassigned -> pruned
        # below -> the gen node's last_frame key is dropped. That drop IS the
        # bypass: supply a last image and the slot is wired, omit it and the
        # graph goes out as a plain first-frame render.
        if kind_key == "images" and slots:
            head = [slots[s] for s in ("first_frame", "last_frame")
                    if slots.get(s) in load_ids]
            load_ids = head + [k for k in load_ids if k not in head]
        # one slot per loader (2.291.0: the OBVPM four-slot compose
        # loader left with its workflow)
        pairs = [(node_id, None) for node_id in load_ids]
        if len(have) > len(pairs):
            say(f"[comfy] template has {len(pairs)} {kind_key[:-1]} slot(s); "
                f"{len(have) - len(pairs)} extra reference(s) ignored")
        touched = {}
        for (node_id, fixed_key), name in zip(pairs, have):
            if fixed_key is None:
                keys = LOADER_KINDS[g[node_id]["class_type"]][1]
                key = next((c for c in keys if c in g[node_id]["inputs"]), keys[0])
            else:
                key = fixed_key
            g[node_id]["inputs"][key] = name
            touched[node_id] = touched.get(node_id, 0) + 1
        dead.update(nid for nid in load_ids if not touched.get(nid))
        files[kind_key + "_slots"] = (min(len(have), len(pairs)), len(pairs))
    say("[comfy] slots filled: " + ", ".join(
        f"{files[k + '_slots'][0]}/{files[k + '_slots'][1]} {k[:-1]}"
        for k in ("images", "videos", "audios")))
    # IMAGEBATCHMULTI SLOT SHRINK (2.223.13, the other half of the growth
    # above): fewer pictures than slots leaves the tail loaders in `dead`.
    # Without this, ONE dead image_k link would take the whole batch node in
    # the cascade below — and the gen node's ref_images with it, losing the
    # pictures that WERE supplied. So while at least one slot is live, the
    # dead-backed image_k keys are dropped and inputcount follows (KJNodes
    # reads exactly inputcount inputs); the dead loaders themselves stay in
    # `dead` for physical removal — the Ctrl+B rule, empty values fail
    # validation. With NO live slot the node is left alone on purpose: the
    # cascade removes it and the gen node's ref_images key drops — extending
    # from the previous take alone is a legal render.
    for gid, gv in g.items():
        if str(gv.get("class_type", "")) != "ImageBatchMulti":
            continue
        ins = gv.get("inputs") or {}
        img_keys = sorted([k for k in ins if re.fullmatch(r"image_\d+", k)],
                          key=lambda s: int(s.rsplit("_", 1)[1]))
        gone = [k for k in img_keys
                if isinstance(ins.get(k), list) and ins[k]
                and str(ins[k][0]) in dead]
        live = [k for k in img_keys if k not in gone]
        if not gone or not live:
            continue
        for k in gone:
            ins.pop(k, None)
        # KJNodes reads image_1..image_inputcount, so the survivors must be
        # CONTIGUOUS from 1. Tim's export numbers slots in loader-id order
        # (the tail dies first), but an export numbered the other way round
        # would leave a gap — renumber whenever the live set is not already
        # image_1..image_N.
        want = [f"image_{i + 1}" for i in range(len(live))]
        if live != want:
            vals = [ins.pop(k) for k in live]
            for k, v in zip(want, vals):
                ins[k] = v
        if "inputcount" in ins and not isinstance(ins["inputcount"], list):
            ins["inputcount"] = len(live)
        say(f"[comfy] ImageBatchMulti#{gid}: {len(gone)} unused image slot(s) "
            f"dropped, inputcount {len(live)} - batching the "
            f"{len(live)} supplied picture(s)")
    if slots:
        for s in ("first_frame", "last_frame"):
            nid = slots.get(s)
            if not nid:
                continue
            say(f"[comfy] {s}: " + ("bypassed (no image supplied)" if nid in dead
                                    else f"wired from loader {nid}"))
    # cascade: a node dies when any input link (except the RH 'references'
    # chain and the MM3 scheduled chain's 'previous' link, which are REWIRED,
    # never deleted) points at a dead node — this takes RH Reference nodes AND
    # native helpers like GetVideoComponents
    # (a video's soundtrack extractor must die with its LoadVideo). MiniMaxH3
    # gen nodes never die; their dead dotted slot keys are dropped instead.
    # A Scheduled*Reference whose OWN loader died (its `image`/`audio` key)
    # still dies here — that is the point — but the reference AFTER it in the
    # chain survives and _remove_nodes heals its `previous` through the gap,
    # so one missing file costs one reference, never the whole cast (2.144.0).
    def _protected(v):    # gen nodes: literal-patched, never deleted
        ct = str(v.get("class_type", ""))
        return "MiniMaxH3" in ct and ("prompt" in (v.get("inputs") or {})
                                      or ct.endswith("ToVideo"))
    # 2.279.0 (Tim's field report: "rejected: prompt_no_outputs" on the
    # music-video chain): the pack's SOURCE-TRACK LoadAudio feeds
    # ChainLoopStart/ChainCurrent/ChainAssemble as `source_audio`. With no
    # chapter sound the loader is unfilled -> dead, and this cascade killed
    # LoopStart AND EVERYTHING DOWNSTREAM - sampler, decodes, SegmentSave,
    # Review, LoopEnd, Assemble - so ComfyUI received a graph with no
    # output node at all. The pack's own mode B says an absent source
    # track means "generate the audio", so a MiniMaxH3Chain* node whose
    # input link points at a dead node DROPS THAT KEY and runs on the
    # node's default instead of dying (the same treatment gen nodes
    # already get). Scheduled*Reference nodes keep the 2.144.0 rule -
    # they die with their own loader, and the chain heals `previous`.
    changed = True
    while changed:
        changed = False
        for k, v in list(g.items()):
            if k in dead or _protected(v):
                continue
            ct = str(v.get("class_type", ""))
            for key, val in list((v.get("inputs") or {}).items()):
                if (key not in ("references", "previous") and isinstance(val, list)
                        and val and str(val[0]) in dead):
                    # (2.291.0: the OBVPM pack's "(obvpm)"/H3* mode-B
                    # exemption left with its workflow)
                    if "MiniMaxH3Chain" in ct:
                        v["inputs"].pop(key, None)
                        say(f"[comfy] {ct}#{k}.{key}: its source is not supplied "
                            "- key dropped, the node runs on its own default "
                            "(the pack's mode B: H3 generates the audio)")
                        continue
                    dead.add(k)
                    changed = True
                    break
    # an unwirable chain reference is REPORTED BY NAME, never silently skipped
    # (the standing rule; its absence is exactly what character drift looks like)
    for k in sorted(dead, key=str):
        ct = str((g.get(k) or {}).get("class_type", ""))
        if "Scheduled" in ct and "Reference" in ct:
            tag = ((g.get(k) or {}).get("inputs") or {}).get("tag", "?")
            say(f"[comfy] chain reference {k} ({ct}, tag '{tag}') removed - "
                "its loader has no file; that tag will not anchor this render")
    # ---- keep the text encoder OFF the graphics card (2.99.2) --------------
    # The H3 templates load a 32B text encoder (qwen3vl_32b_..._int8) beside a
    # ~21 GB video model. On a 32 GB card the two cannot both be resident, so a
    # long clip only ever rendered because ComfyUI offloaded the encoder after
    # encoding. Newer ComfyUI builds ("Using RAM pressure cache") decide that
    # differently and can hold it through sampling — which is why the same clip
    # that rendered at 2.85.3 now dies in SamplerCustomAdvanced while a shorter
    # one squeezes in. CLIPLoader takes a `device` input: "cpu" pins the encoder
    # in system RAM for good, so the sampler gets the whole card. Costs a few
    # seconds of prompt encoding; nothing inside ComfyUI is changed. Only set
    # when the node really has that input (schema sync would drop it otherwise).
    if clip_device:
        hit = []
        for nid, v in g.items():
            if "cliploader" in str(v.get("class_type", "")).lower() \
                    and "device" in (v.get("inputs") or {}):
                v["inputs"]["device"] = clip_device
                hit.append(f"{v.get('class_type')}#{nid}")
        if hit:
            say(f"[comfy] text encoder on {clip_device}: {', '.join(hit)} "
                f"(keeps the 32B encoder out of the sampler's VRAM)")

    _remove_nodes(g, {str(d) for d in dead})
    # the TEMPLATE's own (switch-gated turbo) LoRA nodes only: a video style's
    # chain (h3loraN, 2.110.0) is the user's choice and is never bypassed
    loras = {k: v for k, v in g.items() if "loraloader" in str(v.get("class_type", "")).lower()
             and not str(k).startswith("h3lora")}
    if loras and use_lora:
        # LoRA ENABLED: keep the loader(s) AND flip the graph's own enable
        # switch. Official templates gate the LoRA behind a boolean feeding an
        # If/Else switch whose on_true side reaches the loader, so setting that
        # boolean to true is what actually routes the model through it.
        def _reaches_lora(val, hops=0):
            while isinstance(val, list) and val and hops < 50:
                nid = str(val[0])
                if nid in loras:
                    return True
                nxt = g.get(nid, {}).get("inputs") or {}
                val = nxt.get("model") or nxt.get("on_true")
                hops += 1
            return False
        flipped = 0
        for k, v in g.items():
            if "switch" not in str(v.get("class_type", "")).lower():
                continue
            ins = v.get("inputs") or {}
            if not _reaches_lora(ins.get("on_true")):
                continue
            sw = ins.get("switch")
            if isinstance(sw, list) and sw and str(sw[0]) in g:
                b = g[str(sw[0])]
                if "value" in (b.get("inputs") or {}):
                    b["inputs"]["value"] = True
                    flipped += 1
                    continue
            ins["switch"] = True                 # literal-valued switch
            flipped += 1
        say(f"[comfy] turbo LoRA ENABLED ({len(loras)} node(s), {flipped} switch(es) "
            f"set) - Steps 0 (auto) follows the LoRA's own step count")
    elif loras:
        slotmap = {0: "model", 1: "clip"}
        def _thru(val, hops=0):
            while (isinstance(val, list) and val and str(val[0]) in loras and hops < 50):
                val = (loras[str(val[0])].get("inputs") or {}).get(
                    slotmap.get(int(val[1]) if len(val) > 1 else 0, "model"))
                hops += 1
            return val
        for k, v in g.items():
            if k in loras:
                continue
            ins = v.get("inputs") or {}
            for key in list(ins):
                nv = _thru(ins[key])
                if nv is None and isinstance(ins[key], list) and ins[key] \
                        and str(ins[key][0]) in loras:
                    ins.pop(key)
                elif nv is not ins[key]:
                    ins[key] = nv
        for k in loras:
            g.pop(k, None)
        say(f"[comfy] bypassed {len(loras)} LoRA node(s)")
    # Literal patching detaches the UI export's helper chains (primitive
    # prompt/duration nodes, math snap, step switches, resolution selector).
    # Keep only ancestors of the Save* sinks so detached helpers never hit
    # validation or schema sync.
    # 2.99.4: an export can end in VHS_VideoCombine (the Video Helper Suite
    # node) instead of SaveVideo — Tim's own working r2v export does. With only
    # a "save" test that graph has NO sink, the prune is skipped entirely, and
    # every detached helper goes to ComfyUI and fails validation.
    # 2.147.0: the CHAIN pipeline ends in ChainSegmentSave → ChainReview →
    # ChainLoopEnd → ChainAssemble. Only SegmentSave matched the name test, so
    # everything DOWNSTREAM of it — the review gate, the node that closes the
    # loop, and the assembler that writes the film — was pruned as "detached
    # helpers": the loop never iterated and the run stopped after one segment
    # (Tim's "doesn't complete"). ChainAssemble is the terminal writer (it
    # has the filename input), so "assemble" joins the sink vocabulary and
    # its ancestor walk keeps the whole tail.
    sinks = [k for k, v in g.items()
             if any(t in str(v.get("class_type", "")).lower()
                    for t in ("save", "videocombine", "previewvideo", "assemble"))]
    if sinks:
        keep, stack = set(), list(sinks)
        while stack:
            nid = stack.pop()
            if nid in keep:
                continue
            keep.add(nid)
            for val in (g[nid].get("inputs") or {}).values():
                if isinstance(val, list) and val and str(val[0]) in g:
                    stack.append(str(val[0]))
        drop = [k for k in g if k not in keep]
        dropped_cts = sorted({str((g[k] or {}).get("class_type") or "?")
                              for k in drop})
        for k in drop:
            g.pop(k)
        if drop:
            # 2.176.0 (the LoopStart audio-policy hunt): NAME what left. A
            # bare count once hid whether anything policy- or audio-relevant
            # was among the detached helpers; the classes settle it at a
            # glance.
            say(f"[comfy] pruned {len(drop)} detached helper node(s): "
                + ", ".join(dropped_cts)[:300])
    return g


def _diagnose_sampler(g):
    """Print the SamplerCustomAdvanced chain's resolved inputs before queueing.

    This exists because '[Errno 22] Invalid argument' in SamplerCustomAdvanced
    has TWO very different causes: ComfyUI-on-Windows flushing a dead stderr
    (a process/console problem), OR the sampler being handed a malformed
    sigmas/scheduler/guider input (a graph problem the patcher can cause when
    it severs one arm of the LoRA switch). The raw error cannot tell them
    apart; this can. It reports what feeds sigmas, how many steps the scheduler
    was set to and which model it schedules against, which model the guider
    uses, and the live state of every switch + boolean — so a glance at the log
    says whether the graph reaching the sampler is the one that should.
    Read-only; never raises.
    """
    try:
        samplers = [(k, v) for k, v in g.items()
                    if str(v.get("class_type", "")) == "SamplerCustomAdvanced"]
        if not samplers:
            return
        def label(link):
            if not (isinstance(link, list) and link):
                return repr(link)
            nid = str(link[0])
            v = g.get(nid)
            if not v:
                return f"[{nid} MISSING]"
            ct = v.get("class_type", "?")
            ins = v.get("inputs") or {}
            # show the literal a primitive carries
            if "value" in ins and not isinstance(ins["value"], list):
                return f"{ct}#{nid}(value={ins['value']!r})"
            return f"{ct}#{nid}"
        for sk, sv in samplers:
            ins = sv.get("inputs") or {}
            say(f"[comfy] DIAG sampler #{sk} inputs:")
            for key in ("noise", "guider", "sampler", "sigmas", "latent_image"):
                say(f"[comfy]   .{key:12s} <- {label(ins.get(key))}")
            # follow sigmas -> scheduler, report steps + the model it schedules
            sig = ins.get("sigmas")
            if isinstance(sig, list) and sig and str(sig[0]) in g:
                sch = g[str(sig[0])]
                si = sch.get("inputs") or {}
                st = si.get("steps")
                if not isinstance(st, list):
                    st_txt = f"{st}"
                else:
                    # resolve THROUGH the LoRA steps-switch (a link into an intact
                    # switch is correct, not the Errno-22 shape — 2.99.1)
                    vals = [n.get("value") for n in _steps_value_nodes(g, st)]
                    uniq = sorted(set(v for v in vals if v is not None))
                    if len(uniq) == 1:
                        st_txt = f"{uniq[0]} (via {label(st)}, switch intact)"
                    elif len(uniq) > 1:
                        st_txt = f"{vals} (via {label(st)}; branches DISAGREE — check the switch)"
                    else:
                        st_txt = f"link {label(st)} (could not resolve to a value — check this graph)"
                say(f"[comfy]   sigmas from {sch.get('class_type')}#{sig[0]}: "
                    f"steps={st_txt}, scheduler={si.get('scheduler')!r}, "
                    f"denoise={si.get('denoise')}, model<-{label(si.get('model'))}")
            # follow guider -> model
            gd = ins.get("guider")
            if isinstance(gd, list) and gd and str(gd[0]) in g:
                gi = g[str(gd[0])].get("inputs") or {}
                say(f"[comfy]   guider model <- {label(gi.get('model'))}")
        # every switch + boolean still in the graph, and where it points
        for k, v in g.items():
            ct = str(v.get("class_type", ""))
            if "switch" in ct.lower():
                ins = v.get("inputs") or {}
                say(f"[comfy]   switch #{k}: switch={label(ins.get('switch'))} "
                    f"on_true<-{label(ins.get('on_true'))} "
                    f"on_false<-{label(ins.get('on_false'))}")
            elif ct == "PrimitiveBoolean":
                say(f"[comfy]   boolean #{k} = "
                    f"{(v.get('inputs') or {}).get('value')!r}")
    except Exception as e:                                  # noqa: BLE001
        say(f"[comfy] DIAG failed (non-fatal): {str(e)[:150]}")


def _apply_node_bypass(g, cfg):
    """USER-PINNED NODE BYPASS (2.177.0, Tim: "can we bypass nodes that
    aren't used and enable them when needed?"). The app already bypasses
    per run automatically (upscale stage, ScenePromptEditor, ChainReview,
    LoRA nodes, unused loaders, detached helpers); this is the USER list
    for everything else: engine.comfy.node_bypass = ["ClassName", "#17",
    ...] — physical removal (the Ctrl+B rule) with passthrough rewiring.
    Passthrough per consumer input: the removed node's SAME-NAMED
    connection input wins (model->model, images->images); else its only
    connection input; else the bypass of THAT node is refused by name —
    a node with no clean passthrough must be removed on the canvas, not
    guessed around. Sinks (Save*, VHS_VideoCombine) are never bypassed.
    Enabling again = removing the entry from the config list. Chains of
    bypassed nodes resolve transitively (bounded)."""
    spec = ((cfg.get("engine") or {}).get("comfy") or {}).get("node_bypass") or []
    if not isinstance(spec, list) or not spec:
        return
    wants_id = {str(s)[1:] for s in spec if str(s).startswith("#")}
    wants_ct = {str(s) for s in spec if not str(s).startswith("#")}
    matched_ct, refused = set(), set()
    for _pass in range(50):
        targets = [k for k, v in g.items() if isinstance(v, dict)
                   and k not in refused
                   and (k in wants_id
                        or str(v.get("class_type")) in wants_ct)]
        if not targets:
            break
        progressed = False
        for k in targets:
            v = g[k]
            ct = str(v.get("class_type"))
            if ct in wants_ct:
                matched_ct.add(ct)
            if ct.startswith("Save") or ct == "VHS_VideoCombine":
                say(f"[comfy] node bypass REFUSED for {ct}#{k} - a sink; "
                    "the graph must keep its output")
                refused.add(k)
                continue
            conn = {n: val for n, val in (v.get("inputs") or {}).items()
                    if isinstance(val, list) and len(val) == 2}
            # pre-check every consumer before touching anything
            plan, blocked = [], None
            for ck, cv in g.items():
                if ck == k or not isinstance(cv, dict):
                    continue
                for iname, ival in (cv.get("inputs") or {}).items():
                    if not (isinstance(ival, list) and ival
                            and str(ival[0]) == k):
                        continue
                    repl = conn.get(iname) if iname in conn \
                        else (next(iter(conn.values())) if len(conn) == 1
                              else None)
                    if repl is None:
                        blocked = (f"{cv.get('class_type')}#{ck}.{iname} has "
                                   f"no passthrough ({len(conn)} connection "
                                   "input(s), none named to match)")
                        break
                    plan.append((cv, iname, repl))
                if blocked:
                    break
            if blocked:
                say(f"[comfy] node bypass REFUSED for {ct}#{k} - {blocked}; "
                    "remove it on the canvas and re-export instead")
                refused.add(k)
                continue
            for cv, iname, repl in plan:
                cv["inputs"][iname] = list(repl)
            g.pop(k)
            progressed = True
            say(f"[comfy] node bypass: removed {ct}#{k}"
                + (f", {len(plan)} consumer input(s) rewired through it"
                   if plan else " (nothing consumed it)"))
        if not progressed:
            break
    for ct in wants_ct - matched_ct:
        say(f"[comfy] node bypass: no {ct} in this graph, nothing to remove")


def _apply_widget_overrides(g, cfg):
    """USER-PINNED WIDGET VALUES (2.175.0, Tim's "we had this working
    before" LoopStart audio-policy refusal). When a node-pack update adds a
    required widget the export predates, _schema_sync fills it from the
    server's default or a combo's first choice — and that guess can be a
    policy the graph cannot satisfy. engine.comfy.widget_overrides in the
    app config is the user's explicit word: {"ClassName.input_name": value}
    applied to EVERY node of that class, AFTER schema sync so it wins over
    the fill. Connection inputs are never overwritten (a wire is the
    export's truth); a class absent from the graph is said and skipped.
    Nothing here is guessed - only values the user typed are written."""
    ov = (((cfg.get("engine") or {}).get("comfy") or {})
          .get("widget_overrides") or {})
    if not isinstance(ov, dict):
        return
    for key, val in ov.items():
        parts = str(key).split(".", 1)
        if len(parts) != 2 or not parts[0] or not parts[1]:
            say(f"[comfy] widget override {key!r} ignored - the key must be "
                "'ClassName.input_name'")
            continue
        ct, name = parts
        hit = skipped = 0
        for v in g.values():
            if not (isinstance(v, dict) and v.get("class_type") == ct):
                continue
            ins = v.setdefault("inputs", {})
            if isinstance(ins.get(name), list):
                skipped += 1     # a CONNECTION - the export's wiring stands
                continue
            ins[name] = val
            hit += 1
        if hit:
            say(f"[comfy] widget override: {ct}.{name} = {val!r} "
                f"on {hit} node(s)")
        if skipped:
            say(f"[comfy] widget override {ct}.{name} skipped on {skipped} "
                "node(s) - that input is a CONNECTION there and wires are "
                "the export's truth")
        if not hit and not skipped:
            say(f"[comfy] widget override {ct}.{name} - no {ct} in this "
                "graph, nothing to pin")


def _chain_audio_census(g):
    """WHAT AUDIO THIS GRAPH ACTUALLY CARRIES (2.176.0, Tim: "are we
    creating extra voice nodes? are we using the tmp workflow?"). Said once
    per chain queue so the question answers itself from the log: the
    scheduled audio references (voice clips, by tag), the audio loaders,
    whether any Source-Timeline-ish node exists, and ChainPlan's own
    audio_mode widget verbatim. Pure reporting — nothing is changed."""
    if not any(isinstance(v, dict)
               and v.get("class_type") == "MiniMaxH3ChainLoopStart"
               for v in g.values()):
        return
    tags, loaders, srcish, amode = [], 0, [], None
    for v in g.values():
        if not isinstance(v, dict):
            continue
        ct = str(v.get("class_type") or "")
        ins = v.get("inputs") or {}
        if "Scheduled" in ct and "AudioReference" in ct:
            tags.append(str(ins.get("tag", "?")))
        if ct == "VHS_LoadAudioUpload":
            loaders += 1
        if "sourcetimeline" in ct.lower().replace(" ", ""):
            srcish.append(ct)
        if ct == "MiniMaxH3ChainPlan" and "audio_mode" in ins \
                and not isinstance(ins.get("audio_mode"), list):
            amode = ins.get("audio_mode")
    say("[comfy] audio census: "
        + f"{len(tags)} scheduled audio reference(s)"
        + (f" [{', '.join(tags)}]" if tags else "")
        + f", {loaders} VHS_LoadAudioUpload loader(s), "
        + (f"source-timeline nodes: {', '.join(srcish)}"
           if srcish else "NO source-timeline node")
        + (f", ChainPlan.audio_mode={amode!r}" if amode is not None
           else ", ChainPlan carries no audio_mode widget"))


def _chain_continuity_check(base, g):
    """CONTINUITY PREFLIGHT (2.172.0, Tim: "i am not getting a continuous
    scene"). Node shapes are NEVER guessed: MiniMaxH3ChainContext's outputs
    are read from the live server's own /object_info. The one wiring that
    silently kills scene-to-scene continuity: the context node declares a
    LATENT output that NOTHING in the graph consumes, while the sampler's
    latent_image is fed straight from the node that feeds the context's own
    `latent` input - the previous scene's tail is spliced into an output
    nobody reads, and every scene samples from a fresh latent. Diagnosis
    ONLY: the export is Tim's truth and is never rewired here; the say()
    lines name the exact wire to move in ComfyUI. Never fatal - a server
    that will not answer /object_info stays silent, exactly like
    _schema_sync."""
    ctxs = [(k, v) for k, v in g.items() if isinstance(v, dict)
            and v.get("class_type") == "MiniMaxH3ChainContext"]
    if not ctxs:
        return
    consumed = set()
    for v in g.values():
        for iv in (v.get("inputs") or {}).values():
            if isinstance(iv, list) and len(iv) == 2:
                try:
                    consumed.add((str(iv[0]), int(iv[1])))
                except (TypeError, ValueError):
                    pass
    try:
        info = (_http_json(f"{base}/object_info/MiniMaxH3ChainContext",
                           timeout=10) or {}).get("MiniMaxH3ChainContext")
    except Exception:
        return
    if not isinstance(info, dict):
        return
    types = [str(t) for t in (info.get("output") or [])]
    names = [str(n) for n in (info.get("output_name") or [])]
    lat = [i for i, t in enumerate(types) if t.upper() == "LATENT"]
    if not lat:
        if types:
            say("[comfy] continuity check: ChainContext outputs are "
                + ", ".join(names or types) + " - no latent output, the "
                "context rides the conditioning; this wiring is complete")
        return
    for k, v in ctxs:
        dead = [i for i in lat if (str(k), i) not in consumed]
        if not dead:
            say(f"[comfy] continuity check: ChainContext#{k}'s latent output "
                "is consumed; wiring OK")
            continue
        nm = names[dead[0]] if dead[0] < len(names) else f"output {dead[0]}"
        src = (v.get("inputs") or {}).get("latent")
        src_id = str(src[0]) if isinstance(src, list) and src else None
        bypassers = []
        for sk, sv in g.items():
            li = (sv.get("inputs") or {}).get("latent_image")
            if isinstance(li, list) and li and src_id and str(li[0]) == src_id:
                bypassers.append(f"{sv.get('class_type')}#{sk}")
        say(f"[comfy] CONTINUITY: ChainContext#{k}'s '{nm}' (LATENT) output "
            "is consumed by NOTHING in this graph")
        if bypassers:
            say(f"[comfy]   {', '.join(bypassers)} takes latent_image straight "
                f"from node {src_id}, bypassing the context splice - the "
                "previous scene's tail never reaches the sampler, so scenes "
                "cannot continue from each other")
        say(f"[comfy]   fix IN COMFYUI: wire ChainContext.{nm} -> the "
            "sampler's latent_image, then Export (API) and replace the "
            "workflow (the app never rewires your export)")
    # single-scene renders lean on the run's stored history for their opening
    # context - name that dependency so a fresh-history render explains itself
    for k, v in g.items():
        if not (isinstance(v, dict)
                and v.get("class_type") == "MiniMaxH3ChainLoopStart"):
            continue
        ins = v.get("inputs") or {}
        m = re.fullmatch(r"(\d+):(\d+)", str(ins.get("scene_range", "")))
        if m and m.group(1) == m.group(2) and int(m.group(1)) > 1:
            if ins.get("verify_resume_history"):
                say(f"[comfy] scene {m.group(1)} renders alone - its opening "
                    "context comes from the run's stored history, so the "
                    "scenes before it must already have rendered under this "
                    "run")
            else:
                say(f"[comfy] scene {m.group(1)} renders alone with "
                    "verify_resume_history OFF - there is NO source for its "
                    "opening context")


_SYNC_FILLS = {}   # node id -> ["input=value", ...] filled by _schema_sync this graph


def _dyn_pick(ins, name, choice, depth=0):
    """2.292.0 (Tim's log: "schema sync: SaveVideo.format = {'key': 'auto',
    'inputs': {...}} (first choice)"): a V3 DYNAMIC COMBO
    (COMFY_DYNAMICCOMBO_V3) lists its options as {key, inputs} objects.
    The VALUE is the option's key string; the chosen option's own required
    inputs ride beside it as dotted keys (format.codec), the same dotted
    convention the native nodes' autogrow slots use. Returns the value
    written. A plain choice is written as it is."""
    if not (isinstance(choice, dict) and "key" in choice):
        ins[name] = choice
        return choice
    ins[name] = choice["key"]
    req = ((choice.get("inputs") or {}).get("required") or {}) if depth < 4 else {}
    for sub, ssp in req.items():
        k = f"{name}.{sub}"
        if k in ins:
            continue
        o = ssp[1] if isinstance(ssp, (list, tuple)) and len(ssp) > 1 \
            and isinstance(ssp[1], dict) else (ssp if isinstance(ssp, dict) else {})
        opts = o.get("options") if isinstance(o, dict) else None
        if isinstance(ssp, (list, tuple)) and ssp and isinstance(ssp[0], list) and ssp[0]:
            opts = ssp[0]
        if isinstance(o, dict) and "default" in o:
            ins[k] = o["default"]
        elif isinstance(opts, (list, tuple)) and opts:
            _dyn_pick(ins, k, opts[0], depth + 1)
    return ins[name]


def _schema_sync(base, g):
    """Best-effort input-name repair against the live server's /object_info.
    For each node, when the set of unknown input keys and the set of missing
    schema inputs have the SAME size, rename in order (values kept). Connection
    input names come from the pack's own exports so only widget-name guesses
    ever differ; equal-count ordered rename fixes those. Anything else is left
    for /prompt's node_errors to explain precisely."""
    cache = {}
    missing_rh = set()
    missing_accel = set()
    _SYNC_FILLS.clear()   # per-graph record: which nodes got REQUIRED inputs
                          # the export never had (2.175.0)
    for _nid, v in g.items():
        ct = str(v.get("class_type") or "")
        if ct not in cache:
            spec = {"names": [], "req": {}, "all": {}}
            try:
                info = _http_json(f"{base}/object_info/{urllib.parse.quote(ct)}",
                                  timeout=10).get(ct)
                if info is None and ct.startswith("RHMiniMaxH3"):
                    missing_rh.add(ct)          # server answered; class absent
                if info is None and ct in ACCEL_INSTALL_HINTS:
                    missing_accel.add(ct)       # accelerator pack not installed
                inp = (info or {}).get("input") or {}
                for sec in ("required", "optional"):
                    for name, sp in (inp.get(sec) or {}).items():
                        spec["names"].append(name)
                        spec["all"][name] = sp
                        if sec == "required":
                            spec["req"][name] = sp
            except Exception:
                pass
            cache[ct] = spec
        names = cache[ct]["names"]
        if not names:
            continue
        # 2.280.0 (Tim's field report: schema sync SAID it filled clip_name /
        # vae_name / unet_name, yet /prompt still answered "Required input
        # is missing"): `v.get("inputs") or {}` hands back a THROWAWAY dict
        # whenever inputs is {} — an empty dict is falsy — so every fill for
        # a pure-widget node (the loaders have no link inputs) landed in an
        # orphan and the queued node stayed empty. The dict must live ON THE
        # NODE.
        ins = v.get("inputs")
        if not isinstance(ins, dict):
            ins = v["inputs"] = {}
        # dotted keys are the native nodes' DYNAMIC inputs (ref_images.
        # ref_image_0, ...) — they never appear in /object_info; leave them.
        unknown = [k for k in ins if k not in names and "." not in k]
        missing = [n for n in names if n not in ins]
        if unknown and len(unknown) == len(missing):
            for old, new in zip(unknown, missing):
                ins[new] = ins.pop(old)
                say(f"[comfy] schema sync: {ct}.{old} -> {new}")
        for k in [k for k in ins if k not in names and "." not in k]:
            say(f"[comfy] schema sync: dropping unknown {ct}.{k}")
            ins.pop(k)
        # fill required inputs the template never had, from the server's own
        # declared defaults (or a combo's first choice)
        for name, sp in cache[ct]["req"].items():
            if name in ins:
                continue
            opts = sp[1] if isinstance(sp, (list, tuple)) and len(sp) > 1 \
                and isinstance(sp[1], dict) else {}
            if "default" in opts:
                ins[name] = opts["default"]
                _SYNC_FILLS.setdefault(str(_nid), []).append(f"{name}={opts['default']!r}")
                _SYNC_FILLS.setdefault("class:" + ct, []).append(f"{name}={opts['default']!r}")
                say(f"[comfy] schema sync: {ct}.{name} = {opts['default']} (server default)")
            elif isinstance(sp, (list, tuple)) and sp and isinstance(sp[0], list) and sp[0]:
                ins[name] = sp[0][0]
                _SYNC_FILLS.setdefault(str(_nid), []).append(f"{name}={sp[0][0]!r}")
                _SYNC_FILLS.setdefault("class:" + ct, []).append(f"{name}={sp[0][0]!r}")
                say(f"[comfy] schema sync: {ct}.{name} = {sp[0][0]!r} (first choice)")
            else:
                # 2.280.0: modern combo shapes — ["COMBO", {options: [...]}]
                # (opts already unpacked above) and the OBJECT-form spec
                # {type: "COMBO", options: [...]} — carried the choices in
                # `options`, which the classic first-choice branch never
                # read; KSamplerSelect.sampler_name and
                # BasicScheduler.scheduler stayed unfilled on Tim's box.
                oo = opts if opts else (sp if isinstance(sp, dict) else {})
                if isinstance(oo, dict) and "default" in oo:
                    ins[name] = oo["default"]
                    _SYNC_FILLS.setdefault(str(_nid), []).append(f"{name}={oo['default']!r}")
                    _SYNC_FILLS.setdefault("class:" + ct, []).append(f"{name}={oo['default']!r}")
                    say(f"[comfy] schema sync: {ct}.{name} = {oo['default']} (server default)")
                    continue
                ch = oo.get("options") if isinstance(oo, dict) else None
                if ch is None and isinstance(oo, dict):
                    ch = oo.get("values")
                if isinstance(ch, (list, tuple)) and ch:
                    picked = _dyn_pick(ins, name, ch[0])
                    _SYNC_FILLS.setdefault(str(_nid), []).append(f"{name}={picked!r}")
                    _SYNC_FILLS.setdefault("class:" + ct, []).append(f"{name}={picked!r}")
                    subs = sorted(k for k in ins if k.startswith(name + "."))
                    say(f"[comfy] schema sync: {ct}.{name} = {picked!r} (first choice)"
                        + (f" + {', '.join(f'{k}={ins[k]!r}' for k in subs)}" if subs else ""))
        # 2.292.0: a dynamic combo the graph already carries (SaveVideo
        # format "auto" from a pre-V3 export) gets its chosen option's
        # required sub-inputs as dotted keys; a dict value (an older
        # schema sync wrote the whole option) becomes its key.
        for name, sp in cache[ct]["all"].items():
            o = sp[1] if isinstance(sp, (list, tuple)) and len(sp) > 1 \
                and isinstance(sp[1], dict) else (sp if isinstance(sp, dict) else {})
            dch = o.get("options") if isinstance(o, dict) else None
            if not (isinstance(dch, list) and dch and all(isinstance(c, dict) and "key" in c for c in dch)):
                continue
            cur = ins.get(name)
            if isinstance(cur, dict) and "key" in cur:
                cur = cur["key"]
            hit = next((c for c in dch if c["key"] == cur), None)
            if hit is not None:
                before = set(ins)
                _dyn_pick(ins, name, hit)
                for k in sorted(set(ins) - before):
                    say(f"[comfy] schema sync: {ct}.{k} = {ins[k]!r} (dynamic combo "
                        f"'{name}={cur}' needs it)")
        # 2.292.0 (Tim's card: "MiniMaxH3ReferenceToVideo input
        # 'ref_image_size': Value not in list ref_image_size: '' not in
        # ['match', 'max']"): an EMPTY string sitting in a combo input is
        # never a choice - it is a lost widget value (the converter's
        # positional slip). The server's default (else its first choice)
        # goes in, said by name. A NON-empty value outside the list is
        # left for ComfyUI to refuse - that one may be a real pick.
        for name, val in list(ins.items()):
            if val != "":
                continue
            sp = cache[ct]["all"].get(name)
            opts = sp[1] if isinstance(sp, (list, tuple)) and len(sp) > 1 \
                and isinstance(sp[1], dict) else (sp if isinstance(sp, dict) else {})
            choices = sp[0] if isinstance(sp, (list, tuple)) and sp \
                and isinstance(sp[0], list) else None
            if choices is None and isinstance(opts, dict):
                choices = opts.get("options") or opts.get("values")
            if not (isinstance(choices, (list, tuple)) and choices
                    and all(isinstance(c, str) for c in choices)):
                continue                       # not a plain combo: hands off
            pick = opts.get("default") if isinstance(opts, dict) \
                and opts.get("default") in choices else choices[0]
            ins[name] = pick
            _SYNC_FILLS.setdefault(str(_nid), []).append(f"{name}={pick!r}")
            say(f"[comfy] schema sync: {ct}.{name} was EMPTY (not a choice) -> "
                f"{pick!r} ({'server default' if isinstance(opts, dict) and opts.get('default') == pick else 'first choice'})")
        # THE OPTIONAL-WIDGET TELL (2.176.0, Tim's LoopStart card persisting
        # through 2.175.0): required fills are recorded and said above — but
        # an OPTIONAL widget a pack update added is never filled here, the
        # node runs on ITS OWN server-side default, and the failure looks
        # like the export changed when nothing app-side did. Record what the
        # LIVE schema knows that the queued graph still does not carry
        # (after renames and required fills), so the error path can name it.
        unsent = [nm for nm in names if nm not in ins]
        if unsent:
            _SYNC_FILLS["unsent:" + str(_nid)] = unsent
            _SYNC_FILLS.setdefault("unsent-class:" + ct, []).extend(
                nm for nm in unsent
                if nm not in _SYNC_FILLS.get("unsent-class:" + ct, []))
        # clamp numeric values into the server's declared min/max (e.g. seed)
        for name, val in list(ins.items()):
            sp = cache[ct]["all"].get(name)
            opts = sp[1] if isinstance(sp, (list, tuple)) and len(sp) > 1 \
                and isinstance(sp[1], dict) else {}
            if isinstance(val, (int, float)) and not isinstance(val, bool):
                nv = val
                if opts.get("min") is not None and nv < opts["min"]:
                    nv = opts["min"]
                if opts.get("max") is not None and nv > opts["max"]:
                    nv = opts["max"]
                if nv != val:
                    ins[name] = nv
                    say(f"[comfy] schema sync: clamped {ct}.{name} {val} -> {nv}")
    if missing_accel:
        want = "; ".join(f"{ct}: install {ACCEL_INSTALL_HINTS[ct]}"
                         for ct in sorted(missing_accel))
        fail("the video style asks for an accelerator this ComfyUI does not "
             f"have. {want}. Restart ComfyUI afterwards and generate again - "
             "or set the style's accelerators back to Off (Settings -> Video "
             "styles).")
    if missing_rh:
        some = ", ".join(sorted(missing_rh)[:3])
        fail(f"your ComfyUI does not have the RH_MinMaxH3 custom node pack "
             f"(missing node types: {some}, ...). In ComfyUI: open a bundled "
             f"example from comfy_workflows/ (drag the .json onto the canvas), "
             f"then Manager -> Install Missing Custom Nodes, restart ComfyUI, "
             f"and generate again.")
    return g


def _comfy_ws_progress(base, client_id, stop, pidbox, g, seen):
    """Live progress from ComfyUI's WebSocket (/ws?clientId=...), stdlib-only.
    Emits '[comfy] step v/m — <node>' lines that the UI progress bar parses
    (the x/y regex) and 'running <node>' on node changes. Any failure exits
    silently — the elapsed-time heartbeat in the wait loop still covers us.
    2.401.3: the listener lives in scripts/comfy_progress.py, shared with every
    other worker (Wan, LTX, the swap ... printed no steps before)."""
    try:
        import comfy_progress as _cp
    except Exception:                                      # noqa: BLE001
        return
    _cp.listen(base, client_id, stop, pidbox, g, seen, say)


class ComfyOOM(Exception):
    """A chunk of `frames` frames failed for lack of GPU memory. Raised (not
    fail()ed) so main() re-plans the render into chunks that fit and retries —
    the ComfyUI path's version of the sd-cli OOM ladder (2.99.0). Covers a
    clean torch OOM AND the OSError [Errno 22] a sampler throws under the same
    memory pressure (2.99.1); `oom` records which, and `advice` is the text to
    print only if the ladder runs out of room."""
    def __init__(self, frames, msg="", advice="", oom=True):
        super().__init__(msg)
        self.frames = frames
        self.advice = advice
        self.oom = oom


# Below this a "ceiling" is nonsense, not a memory limit: a 107f (4.5 s) chunk
# is already the smallest split worth making, and a render cut finer than that
# is 30 hand-offs and 30 ComfyUI jobs for a 5 s clip. 2.99.4 exists because the
# 2.99.1 ladder walked a NON-memory failure down to the 5-frame floor and SAVED
# it, so every later render was chunked to death. Never learn below this.
MIN_LEARNED_CEILING = 107


def vram_fallback_ceiling(frames: int, grid: str = "17k5") -> int:
    """The next single-run ceiling to try after `frames` ran out of memory:
    ~70% of it, snapped DOWN to the grid, never below the grid minimum.
    362 -> 243 (the 10 s clip that renders on a 32 GB card next to a 21 GB
    int8 model), 243 -> 158, 158 -> 107. Mirrored in lib/framePlan.js."""
    _up, snap_down, _c = GRIDS[grid]
    return max(5, snap_down(max(5, int(frames * 0.7))))


def _chunk_on_oom(cfg) -> bool:
    """engine.comfy.chunk_on_oom (2.99.4): may a render that runs out of VRAM be
    re-planned into segments? Default FALSE — Tim: "don't do chunks". A seam in
    the middle of a clip is worse than being told the clip will not fit."""
    return (((cfg or {}).get("engine") or {}).get("comfy") or {}) \
        .get("chunk_on_oom") is True


def _clip_device(cfg) -> str:
    """engine.comfy.clip_device: "cpu" pins the text encoder in system RAM;
    "default" (the shipped default, 2.99.3) hands the choice back to ComfyUI.
    Anything else is ignored."""
    v = str((((cfg or {}).get("engine") or {}).get("comfy") or {})
            .get("clip_device", "default") or "").strip().lower()
    return v if v in ("cpu",) else ""


def _comfy_clear_vram(base, cfg) -> None:
    """Start this generation from an EMPTY card (2.98.0).

    ComfyUI keeps every model it has touched resident and evicts on its own
    estimate of the next graph; after a still, a song and a 10 s clip a 15 s
    sampler found the card full and died with torch.OutOfMemoryError on a
    graph that used to render. POST /free makes ComfyUI unload all models and
    reset its execution cache, then empty the torch cache. Weights reload from
    RAM in seconds. Off only by an explicit engine.comfy.free_before_gen=false.
    Never fatal: a ComfyUI without /free (old build) still gets to render.
    """
    if _cc is None:
        say(f"[comfy] VRAM clear skipped: scripts/comfy_client.py did not import ({_cc_err})")
        return
    _cc.clear_before_gen(base, cfg, say)


def _crop_take(p, w, h):
    """2.380.0 the "up" H3 size: a chunk rendered at the next 32-px step (1280x736) is cropped back to the size asked
    for (1280x720), top-left anchored - the extra rows / columns are the ones the keyframes were extended into. The
    sound is copied; the lossless master (FFV1) stays lossless. True when the file now has that size."""
    p = Path(p)
    if not p.exists():
        return False
    wh = _image_wh(p)
    if wh == (int(w), int(h)):
        return True
    tmp = p.with_name(p.stem + ".crop" + p.suffix)
    codec = _stream_codec(p, "v")
    venc = (["-c:v", "ffv1", "-level", "3"] if codec == "ffv1" else
            ["-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "18", "-row-mt", "1"] if p.suffix.lower() == ".webm" else
            ["-c:v", "libx264", "-preset", "medium", "-crf", "14", "-pix_fmt", "yuv420p"])
    rc = subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(p), "-map", "0", "-vf", f"crop={int(w)}:{int(h)}:0:0"]
                        + venc + ["-c:a", "copy", str(tmp)], capture_output=True, text=True)
    if rc.returncode != 0 or not tmp.exists():
        tmp.unlink(missing_ok=True)
        return False
    tmp.replace(p)
    return True


def _image_wh(p):
    """(width, height) of a picture, or None when ffprobe cannot read it."""
    r = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height",
                        "-of", "csv=p=0:s=x", str(p)], capture_output=True, text=True)
    try:
        w, h = (r.stdout or "").strip().splitlines()[0].split("x")[:2]
        return int(w), int(h)
    except (ValueError, IndexError):
        return None


def _fit_keyframe(p, width, height, pad_to=None):
    """2.379.1: an H3 first / last frame must be EXACTLY the size of the video the node makes. MiniMaxH3ImageToVideo
    rounds the video DOWN to 32-px multiples (1280x720 -> a 1280x704 latent: 44 rows) but encodes the keyframe picture
    at its own size (720 -> 45 rows), and the sampler then failed with
    "shape '[1, 24, 1, 1, 22, 2, 40, 2]' is invalid for input of size 86400" (Tim's fl2va scene with its own First
    picture; Cont worked because a take's last frame already has the video's size). The picture is scaled to cover and
    centre-cropped to that size, as a copy in the job folder's keyframe_<W>x<H>/ under the same name (the scene's own
    file is never touched; ComfyUI sees the name it always did). Returns
    (path to upload, note or None)."""
    W, H = max(32, (int(width) // 32) * 32), max(32, (int(height) // 32) * 32)
    wh = _image_wh(p)
    if pad_to:
        # 2.380.0 the "up" H3 size: the picture fits the size ASKED for (1280x720), then its right / bottom edge is
        # smeared out to the render size (1280x736) - the rows the take loses again when it is cropped back, so a
        # Cont chain never zooms in step by step
        PW, PH = int(pad_to[0]), int(pad_to[1])
        if wh == (PW, PH):
            return str(p), None
        W, H = int(width), int(height)
        out = Path.cwd() / f"keyframe_{PW}x{PH}" / (Path(p).stem + ".png")
        out.parent.mkdir(parents=True, exist_ok=True)
        vf = (f"scale={W}:{H}:force_original_aspect_ratio=increase:flags=lanczos,crop={W}:{H},"
              f"pad={PW}:{PH}:0:0:black,fillborders=right={PW - W}:bottom={PH - H}:mode=smear")
        rc = subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(p), "-frames:v", "1", "-vf", vf, str(out)],
                            capture_output=True, text=True)
        if rc.returncode != 0 or not out.exists():
            return str(p), (f"{Path(p).name} could not be fitted to {PW}x{PH} ({(rc.stderr or '').strip()[:120]}) - "
                            "sent as it is; H3 needs the keyframe at the video's size")
        was = f"{wh[0]}x{wh[1]}" if wh else "its size"
        return str(out), (f"{Path(p).name} {was} -> {W}x{H}, its edge extended to {PW}x{PH} (the render size; the "
                          f"take is cropped back to {W}x{H})")
    if wh == (W, H):
        return str(p), None
    out = Path.cwd() / f"keyframe_{W}x{H}" / (Path(p).stem + ".png")   # the SAME name in ComfyUI (only the size changes)
    out.parent.mkdir(parents=True, exist_ok=True)
    rc = subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(p), "-frames:v", "1", "-vf",
                         f"scale={W}:{H}:force_original_aspect_ratio=increase:flags=lanczos,crop={W}:{H}",
                         str(out)], capture_output=True, text=True)
    if rc.returncode != 0 or not out.exists():
        return str(p), (f"{Path(p).name} could not be fitted to {W}x{H} ({(rc.stderr or '').strip()[:120]}) - "
                        "sent as it is; H3 needs the keyframe at the video's size")
    was = f"{wh[0]}x{wh[1]}" if wh else "its size"
    return str(out), (f"{Path(p).name} {was} -> {W}x{H} (scaled to cover + centre-cropped): H3 makes the video in "
                      f"32-px steps ({int(width)}x{int(height)} -> {W}x{H}) and the keyframe must match it exactly")


def _frame_sources(g, seg_mode, refs, first_frame, last_frame):
    """Which images this chunk sends to ComfyUI, and what to say about it.

    THE 15-SECOND CHARACTER RESET (2.130.0). Long-form renders in chunks, and
    chunk 2+ hands off the previous chunk's exact last frame as an fl2va first
    frame. That is correct ONLY for a template with a real `first_frame` input.
    Tim's `h3_scene_api.json` — like every MiniMaxH3ReferenceToVideo export — has
    no such input: its only image path is `ref_images.ref_image_0`. So the
    hand-off frame was landing in the REFERENCE slot, and because the chunk loop
    also emptied the reference list on continuation, the character-defining
    references were gone. Every 15 seconds the model was re-rolling the character
    from one arbitrary, often motion-blurred frame. It changed completely, which
    is exactly what Tim saw.

    The rule now: a keyframe template gets keyframes; a reference template gets
    the references AND the hand-off frame, so identity is anchored by the same
    pictures in every chunk. Either way it is said out loud — a slot that cannot
    be wired is reported by name, never silently accepted.
    """
    notes = []
    if seg_mode == "ref2va":
        return list(refs), notes
    keys = [x for x in (first_frame, last_frame) if x]
    if _frame_slot_loaders(g):
        if refs:
            notes.append(f"template has keyframe slots, so the {len(refs)} project "
                         f"reference(s) stay out of this chunk: the first frame is "
                         f"what carries the character across the join")
        return keys, notes
    if not keys:
        return list(refs), notes
    if refs:
        notes.append(f"this template has no first_frame input (it is a REFERENCE "
                     f"workflow), so the hand-off frame goes in as a reference "
                     f"BESIDE the {len(refs)} anchor image(s) - holding the same "
                     f"picture in every chunk is what keeps the character from "
                     f"changing across the 15s join")
    else:
        notes.append("this template has no first_frame input (it is a REFERENCE "
                     "workflow) and this chunk has no anchor image, so the "
                     "hand-off frame is its ONLY reference. Expect the character "
                     "to drift. Add a reference image, or point the style's "
                     "fl2va workflow at a first-frame H3 template.")
    return list(refs) + keys, notes


def _write_run_tmp(src_path, graph):
    """The queued graph, on disk: <stem>_tmp.json beside its source export
    (a stem already ending _tmp keeps its own name - the MM3 chain's tmp is
    overwritten with the final patched graph, which is the truer artifact).
    Returns (tmp_path, graph re-read from the file): what is queued IS the
    file, byte for byte, so debugging the file is debugging the run."""
    p = Path(src_path)
    stem = re.sub(r"_tmp$", "", p.stem)
    tmp = p.with_name(stem + "_tmp.json")
    tmp.write_text(json.dumps(graph, indent=2), encoding="utf-8")
    return tmp, json.loads(tmp.read_text(encoding="utf-8"))


def _viggle_job(params):
    """2.352.0: an H3_Viggle job (the board's flow marks it; a prompt-docker
    render is known by its style) - its reference video is the MOTION, cut
    per chunk by scripts/h3viggle.py, never extracted to PNG frames."""
    if params.get("viggle"):
        return True
    st = params.get("video_style") if isinstance(params.get("video_style"), dict) else {}
    names = [str(st.get("workflow") or "")] + [str(v or "") for v in (st.get("workflows") or {}).values()]
    return st.get("name") == "H3_Viggle" or any(Path(n).name.startswith("H3_Viggle_") for n in names if n)


def _h3_size(g, width, height, fit="down"):
    """2.379.2: an H3 graph renders in 32-px steps. Tim: "i think it is rendering at 1280x720, but ... mm can only do
    1280x704 so it is 16px vignette at the bottom of the video" (the "bluish bar at the bottom" of 2.377.1, and the
    fl2va keyframe crash of 2.379.1). A size that is not a 32-px multiple is rounded DOWN for every H3 graph
    (MiniMaxH3* nodes; 1280x720 -> 1280x704): the take is exactly what the model draws - no strip below it.
    Returns (width, height, note or None)."""
    if not any(isinstance(v, dict) and "MiniMaxH3" in str(v.get("class_type", "")) for v in (g or {}).values()):
        return int(width), int(height), None
    if fit == "up":
        # 2.380.0 (Tim: "add the 736 as an option"): the next 32-px step UP; the take is cropped back afterwards
        W, H = -(-int(width) // 32) * 32, -(-int(height) // 32) * 32
        if (W, H) == (int(width), int(height)):
            return W, H, None
        return W, H, (f"render size {int(width)}x{int(height)} -> {W}x{H} (H3's 32-px steps, rounded UP - the "
                      f"video docker's ⚙ H3 size); the take is cropped back to {int(width)}x{int(height)}")
    W, H = max(32, (int(width) // 32) * 32), max(32, (int(height) // 32) * 32)
    if (W, H) == (int(width), int(height)):
        return W, H, None
    return W, H, (f"render size {int(width)}x{int(height)} -> {W}x{H}: H3 renders in 32-px steps, and the rows past "
                  f"the last full step came out as a {int(height) - H}-px strip at the bottom of the take"
                  if H != int(height) else
                  f"render size {int(width)}x{int(height)} -> {W}x{H}: H3 renders in 32-px steps")


def _is_viggle_graph(g):
    """2.352.0: an H3_Viggle graph (built around ViggleAnimateConditioning)."""
    if not any(isinstance(v, dict) and v.get("class_type") == "ViggleAnimateConditioning" for v in (g or {}).values()):
        return False
    if _hv is None:
        fail(f"this is a Viggle-Animate graph (the H3_Viggle style) but scripts/h3viggle.py did not load: {_hv_err}")
    return True


def _viggle_fill(g, params, seg_mode, refs, first_frame, frames, up, uploads, vstyle):
    """2.352.0: fill an H3_Viggle graph for this chunk. The motion video is the
    job's first reference video; chunk 2+ carry on from params["_chunk_offset"].
    -> (graph, the frames rendered, [video uploads], [audio uploads])."""
    seed = int(params.get("seed", -1))
    if seed < 0:
        seed = random.randrange(0, 2**31)
        say(f"[comfy] seed -1 -> random seed {seed}")
    vids = [x for x in (params.get("ref_videos") or []) if x]
    sent = []

    def _upl(x):
        say(f"[comfy] uploading {Path(x).name}")
        name = up(x)
        sent.append(name)
        return name
    try:
        g2, n, notes = _hv.prepare(g, {
            "seg_mode": seg_mode, "refs": refs, "first_frame": first_frame,
            "motion": vids[0] if vids else None, "offset": int(params.get("_chunk_offset") or 0),
            "frames": int(frames), "width": int(params["width"]), "height": int(params["height"]),
            "seed": seed, "steps": int(params.get("viggle_steps") or 0) or _hv.STEPS,
            "loras": (vstyle or {}).get("loras") or [], "workdir": str(Path.cwd()),
            "prefix": f"bitgen_{Path.cwd().name}"}, _upl)
    except (ValueError, RuntimeError) as e:
        fail(str(e))
    for nline in notes:
        say(f"[comfy] {nline}")
    if len(vids) > 1:
        say(f"[comfy] H3_Viggle: {len(vids) - 1} more reference video(s) left out - the first one is the motion")
    uploads.extend(sent[:1])
    return g2, n, sent[1:], []


def comfy_generate(params, cfg, seg_mode, refs, first_frame, last_frame,
                   frames, out_path: Path, free_vram: bool = True) -> None:
    base = _comfy_url(cfg)
    # RUNPOD SERVERLESS (2.197.0, Tim: "how can we use a runpod gpu to render
    # our videos? serverless flash ... something we already have"). When
    # engine.runpod.enabled, the GRAPH pipeline below runs unchanged — style,
    # patch, bypass, overrides, census, sampler diagnosis — and only the
    # TRANSPORT changes: refs ride the request as base64, /run + /status
    # replace queue + websocket, and outputs come back in the response
    # instead of /view. Checks that need a live local ComfyUI are skipped
    # with a note each.
    rp = _runpod_cfg(cfg)
    if rp:
        say(f"[runpod] serverless endpoint {rp['endpoint']} — local ComfyUI "
            "checks (preflight, schema sync, continuity, accel preflight, "
            "VRAM clear) are skipped: there is no live server to ask")
    else:
        try:                                # preflight: is ComfyUI even up?
            _http_json(base + "/system_stats", timeout=5)
        except Exception:
            fail(f"ComfyUI is not reachable at {base}. Start it first - use the "
                 f"'Start ComfyUI' button under Generate (or Settings -> ComfyUI), "
                 f"wait for '✓ API is up' in the console, then generate again.")
    vstyle = params.get("video_style") if isinstance(params.get("video_style"), dict) else None
    g, vnote = (_style_workflow(vstyle, cfg, seg_mode) if vstyle else (None, ""))
    if g is None:
        g = _load_api_workflow(cfg, seg_mode if seg_mode != "t2va" else
                               ("t2va" if (((cfg.get("engine") or {}).get("comfy") or {})
                                           .get("workflows") or {}).get("t2va") else "fl2va"))
    elif vnote:
        say(f"[comfy] {vnote}")
    # 2.323.0 (Tim: "if screenplay then there won't be a song, but i would
    # still like to render with the nativeaudio workflow"): no song -> the
    # lock and the song loader come OUT before any loader is filled, so the
    # voices land in the voice slots and the model makes the sound itself
    if params.get("no_song"):
        try:
            import nosong as _ns
            g, nsnotes = _ns.unlock(g)
            for n in nsnotes:
                say(f"[comfy] {n}")
        except Exception as e:                 # noqa: BLE001
            fail(f"no-song render: scripts/nosong.py failed ({e})")
    uploads = []
    rp_files = []                       # runpod mode: (name, abs path) pairs
    def _up(x):
        if rp:
            rp_files.append((Path(x).name, str(x)))
            return Path(x).name         # serverless writes it by this name
        return _comfy_upload_image(base, x)
    # 2.352.0 (Tim: "can we incorporate viggle into these worklows but make it
    # a new viggle workflow?"): an H3_Viggle graph is filled by
    # scripts/h3viggle.py - the motion video + the sheet / first frame - and
    # none of the H3 patching below applies to it
    viggle = _is_viggle_graph(g)
    if viggle:
        g, frames, up_vids, up_auds = _viggle_fill(g, params, seg_mode, refs, first_frame, frames,
                                                   _up, uploads, vstyle)
    else:
        # 2.379.2: H3 renders in 32-px steps - never ask it for the strip it cannot draw (the bottom "vignette")
        # 2.380.0: the size ASKED for stays in _req_w / _req_h (every chunk re-reads it); "up" renders the next
        # 32-px step and the main loop crops each chunk back (_h3_crop)
        _rw = int(params.setdefault("_req_w", int(params["width"])))
        _rh = int(params.setdefault("_req_h", int(params["height"])))
        _fit = "up" if str(params.get("h3_fit") or "") == "up" else "down"
        _w32, _h32, _sznote = _h3_size(g, _rw, _rh, _fit)
        if params.get("upscale_take"):
            _sznote = None       # ⏫ of an existing take: the TAKE's own size decides, nothing is sampled at this size
        if _sznote:
            say(f"[comfy] {_sznote}")
            params["width"], params["height"] = _w32, _h32
            if _fit == "up":
                params["_h3_crop"] = [_rw, _rh]
            st_ = params.get("upscale_stage")
            if isinstance(st_, dict) and st_.get("width") and st_.get("height"):
                # the upscaler keeps the take's TRUE aspect (else 1280x704 would be stretched to 1920x1080)
                uw, uh = int(st_["width"]), int(st_["height"])
                if uw >= uh:
                    uh = max(32, int(round(uw * _h32 / _w32 / 32.0)) * 32)
                else:
                    uw = max(32, int(round(uh * _w32 / _h32 / 32.0)) * 32)
                if (uw, uh) != (int(st_["width"]), int(st_["height"])):
                    say(f"[comfy] upscale size {st_['width']}x{st_['height']} -> {uw}x{uh} (the take's own aspect)")
                    params["upscale_stage"] = dict(st_, width=uw, height=uh)
                if _fit == "up":
                    # the take comes out UPSCALED: crop back by the same factor (1920x1104 -> 1920x1080)
                    ev = lambda v: max(2, int(round(v / 2.0)) * 2)
                    params["_h3_crop"] = [ev(_rw * uw / _w32), ev(_rh * uh / _h32)]
        srcs, snotes = _frame_sources(g, seg_mode, refs, first_frame, last_frame)
        for nline in snotes:
            say(f"[comfy] {nline}")
        # 2.379.1: the H3 keyframe slots take the picture at its own size - fit first / last frames to the video's
        if seg_mode != "ref2va" and _frame_slot_loaders(g):
            keyset = {str(x) for x in (first_frame, last_frame) if x}
            fitted = []
            for x in srcs:
                if str(x) in keyset:
                    if params.get("_h3_crop"):
                        x, fnote = _fit_keyframe(x, params["_req_w"], params["_req_h"],
                                                 pad_to=(params["width"], params["height"]))
                    else:
                        x, fnote = _fit_keyframe(x, params["width"], params["height"])
                    if fnote:
                        say(f"[comfy] keyframe: {fnote}")
                fitted.append(x)
            srcs = fitted
        for x in srcs:
            say(f"[comfy] uploading {Path(x).name}")
            uploads.append(_up(x))
        up_vids, up_auds = [], []
        # 2.292.0: an fl2va graph that LOADS audio/video (MMH3_NativeAudio_MV_fl2va:
        # the board song feeds TrimAudioDuration -> NativeAudioLock) gets its
        # references too - before this only ref2va uploaded them, and an fl2va
        # native-audio scene would have starved the song loader.
        _av_loaders = {"LoadAudio", "LoadVideo", "VHS_LoadAudio", "VHS_LoadAudioUpload",
                       "VHS_LoadVideo"}
        _fl_takes_av = seg_mode == "fl2va" and (any(
            isinstance(nd, dict) and nd.get("class_type") in _av_loaders
            for nd in (g or {}).values()) or (_rs is not None and _rs.takes_av(g or {})))
        if seg_mode == "ref2va" or _fl_takes_av:   # video/sound references (project assets)
            for x in params.get("ref_videos") or []:
                say(f"[comfy] uploading {Path(x).name}")
                up_vids.append(_up(x))
            for x in params.get("ref_audios") or []:
                say(f"[comfy] uploading {Path(x).name}")
                up_auds.append(_up(x))
        seed = int(params.get("seed", -1))
        if seed < 0:
            seed = random.randrange(0, 2**31)
            say(f"[comfy] seed -1 -> random seed {seed}")
        use_lora = bool((((cfg.get("engine") or {}).get("comfy") or {}).get("lora_4step")))
        steps, steps_note = resolve_steps(g, params.get("steps", 0), use_lora)
        say(f"[comfy] {steps_note}")
        cfg_val = params.get("cfg", 1.0)
        if vstyle:
            # the style's phases (model/steps/cfg per sampler), te, vae, loras.
            # Phase 1's steps/cfg become THE steps/cfg the shared patch writes,
            # unless Basic Settings set an explicit step count.
            # phase 1's steps/cfg/size are NOT taken from the style here: Basic
            # Settings inherited them when the style was picked and is the
            # authority for the render (2.111.3). Later phases keep their own.
            g, vnotes = apply_video_style(g, vstyle, explicit_steps=int(params.get("steps", 0) or 0))
            for n in vnotes:
                say(f"[comfy] style: {n}")
        g = _patch_workflow(g, prompt=params["prompt"], seed=seed,
                            frames=frames, width=params["width"], height=params["height"],
                            steps=steps, cfg=cfg_val,
                            images=uploads,
                            videos=up_vids, audios=up_auds, use_lora=use_lora,
                            clip_device=_clip_device(cfg),
                            force_seed=bool(params.get("force_seed")) and seed >= 0,
                            plan_seed=params.get("plan_seed"),
                            upscale=bool(params.get("upscale", True)) or bool(params.get("upscale_stage")))
        g = _apply_refmods(g, params.get("refmods"))   # 2.225.0: cast identity mods
        if _f3 is not None and _f3.detect(g):  # 2.573.0: FastH3 Omni - its recipe, whatever graph carries it
            g, f3notes = _f3.apply(g, explicit_steps=int(params.get("steps", 0) or 0),
                                   kitchen=None if rp else _kitchen_attn(base))
            for n in f3notes:
                say(f"[comfy] {n}")
            if float(cfg_val or 1) > 1:
                say(f"[comfy] FastH3: cfg {cfg_val} -> 1 (the model is distilled with guidance built in)")
                cfg_val = 1.0
        if params.get("upscale_stage"):        # 2.312.0: the video docker's upscaler
            if _us is None and params.get("upscale_take"):
                raise RuntimeError("scripts/upscalestage.py did not load - the take cannot be upscaled")
            if _us is None:
                say("[comfy] upscale requested but scripts/upscalestage.py did not load - rendering without it")
            else:
                g, unotes = _us.apply(g, params["upscale_stage"], seed=seed)
                for n in unotes:
                    say(f"[comfy] {n}")
                # 2.315.0 (Tim: "i would prefer to press the button so i can
                # preview the scene"): the ⏫ upscales THE TAKE he previewed -
                # the stage reads it (VAE-encoded) instead of a fresh sample
                if params.get("upscale_take"):
                    tk = Path(str(params["upscale_take"]))
                    if not tk.exists():
                        raise RuntimeError(f"the take to upscale is gone ({tk.name}) - "
                                           "render the scene again, then ⏫")
                    say(f"[comfy] uploading {tk.name} (the take to upscale)")
                    g, tnotes = _us.from_take(g, _up(tk))
                    for n in tnotes:
                        say(f"[comfy] {n}")
                    if not any(n.startswith("upscale: the stage reads the TAKE") for n in tnotes):
                        raise RuntimeError("could not feed the take to the upscale stage: "
                                           + "; ".join(tnotes))
        # 2.366.0 (Tim: "even your prompt didn't work , cfg was 1, i am
        # trying 3"): the H3 graphs guide with BasicGuider - no cfg input, so
        # cfg 3 never reached them. Above 1, scripts/truecfg.py swaps in a
        # CFGGuider with a negative clone of the H3 generator (same refs,
        # negative text). Last, after the upscale stage read its guider.
        if _tc is not None:
            g, tc_notes = _tc.apply(
                g, cfg_val, use_lora=use_lora,
                negative=params.get("negative_prompt")
                or (((cfg.get("engine") or {}).get("comfy") or {}).get("negative_prompt")))
            for n in tc_notes:
                say(f"[comfy] {n}")
        elif float(cfg_val or 1) > 1:
            say(f"[comfy] cfg {cfg_val} ignored: scripts/truecfg.py did not load and the H3 guider has no cfg input")
    # 2.301.0: the lossless master's taps (PNG frames + FLAC audio beside the
    # video save) - added before schema sync so the live server fills them
    raw_fps = None
    if params.get("raw_master"):
        if _rm is None:
            say(f"[comfy] lossless master unavailable (scripts/rawmaster.py: {_rm_err}) - mp4-only take")
        elif rp:
            say("[comfy] lossless master: not available through RunPod serverless - "
                "this take stays mp4-only")
        else:
            g, rnote, raw_fps = _rm.add_taps(g)
            say(f"[comfy] {rnote}")
    # 2.267.0 (Tim: "when i selected all the scenes, and rendered all, it
    # only rendered the first scene 4 times"): the LAST-MOMENT scene pin.
    # A queued board scene names itself in the job (scene.n); the chain
    # graph must ask ComfyUI for EXACTLY that scene. The app writes the
    # range at queue time, but the tmp file is shared and every cast/env/
    # refs mutation rebuilds it - a rebuild landing between queue and this
    # read resets the loop to the export's own range (the base ships
    # "1:2"), and every queued scene then renders the same opening. The
    # pin is applied HERE, on the graph this very job submits, so no
    # rebuild can race it.
    sc = params.get("scene") or {}
    sc_n = sc.get("n")
    if sc_n and not sc.get("ref_style") and not sc.get("upscale"):
        want = f"{int(sc_n)}:{int(sc_n)}"
        for v in g.values():
            if not (isinstance(v, dict)
                    and v.get("class_type") == "MiniMaxH3ChainLoopStart"):
                continue
            ins = v.setdefault("inputs", {})
            have = str(ins.get("scene_range", ""))
            if have != want:
                say(f"[comfy] scene pin: the queued graph said scene_range "
                    f"'{have or '(unset)'}' but this job renders board scene "
                    f"{sc_n} - pinned to {want} (a tmp rebuild raced the queue)")
                ins["scene_range"] = want
            else:
                say(f"[comfy] scene pin: rendering board scene {sc_n} ({want})")
    if vstyle and isinstance(vstyle.get("accel"), dict) and not viggle:
        # accelerators go in AFTER the lora bypass/pruning settled the model
        # chain, and BEFORE schema sync fills their parameters (see the block
        # above apply_video_accel for why this exact spot).
        g, anotes = apply_video_accel(g, vstyle.get("accel"))
        for n in anotes:
            say(f"[comfy] {n}")
        if not rp:
            _veda_resolve(base, g)          # 2.536.0: a predictor ComfyUI lists
    _apply_node_bypass(g, cfg)         # 2.177.0: the user's bypass list, first
    if not rp:
        _fill_trim_window(g, params)
        g = _schema_sync(base, g)
    _apply_widget_overrides(g, cfg)    # 2.175.0: the user's word wins over fills
    _chain_audio_census(g)             # 2.176.0: "are we creating extra voice nodes?"
    if not rp:
        _chain_continuity_check(base, g)   # 2.172.0: "not a continuous scene"
    _diagnose_sampler(g)           # what the sampler will actually receive
    if free_vram and not rp:       # once per job: chunk 2+ keeps the model warm
        _comfy_clear_vram(base, cfg)
    if not rp:
        _accel_preflight(base, g)  # a pack older than this ComfyUI? (2.129.0)

    wf_src = _LAST_WF_PATH               # the export this graph came from
    typefix = {"done": False}            # 2.305.0: one repair-and-requeue per job

    def _attempt(graph):
        """Queue THIS graph and wait for it. Returns (outputs, blame, msgs):
        outputs on success; otherwise blame = the id of an accelerator WE
        injected that this failure names, and msgs = the failure events.
        Anything else ends here (fail(), or ComfyOOM for main()'s re-plan)."""
        # RUN TMP (2.223.17): materialize, then queue the FILE's content -
        # the original export is untouched; <stem>_tmp.json is the run.
        if wf_src:
            try:
                tmp_p, graph = _write_run_tmp(wf_src, graph)
                say(f"[comfy] run graph written: comfy_workflows/{tmp_p.name} "
                    "(the original export is untouched)")
            except Exception as e:          # a read-only folder never stops a render
                say(f"[comfy] run-tmp write skipped: {e}")
        if rp:
            return _runpod_attempt(rp, graph, rp_files, out_path, say)
        client = uuid.uuid4().hex
        # live progress: WS listener starts BEFORE queueing so no message is lost
        import threading
        stop_ws = threading.Event()
        pidbox = {"pid": None}
        seen = {"t": time.time()}              # last time the WS said anything
        ws_thread = threading.Thread(target=_comfy_ws_progress,
                                     args=(base, client, stop_ws, pidbox, graph, seen),
                                     daemon=True)
        ws_thread.start()
        say(f"[comfy] queueing on {base} ({seg_mode}, {frames}f = {frames / FPS:.2f}s, "
            f"{len(uploads)} img / {len(up_vids)} vid / {len(up_auds)} aud ref)")
        if _cc is not None:                    # 2.384.0: the job's metadata (seed, steps, cfg, models, loras)
            _cc.print_meta(graph)
        resp = _http_json(base + "/prompt", {"prompt": graph, "client_id": client},
                          read_error_body=True)
        pid = resp.get("prompt_id")
        pidbox["pid"] = pid
        if not pid:
            stop_ws.set()
            err = resp.get("error") or {}
            say(f"[comfy] rejected: {err.get('type', '')} {err.get('message', '')}"[:300])
            for nid, ne in (resp.get("node_errors") or {}).items():
                ct = (graph.get(str(nid)) or {}).get("class_type", "?")
                for e in (ne or {}).get("errors", []):
                    xi = e.get("extra_info") or {}
                    say((f"[comfy]   node {nid} ({ct})"
                         + (f" input '{xi.get('input_name')}'" if xi.get("input_name") else "")
                         + f": {e.get('message', '')} {e.get('details', '')}"
                         + (f" (got: {xi.get('received_value')})"
                            if xi.get("received_value") is not None else ""))[:500])
            # 2.305.0: a link THIS ComfyUI refuses as VIDEO-on-IMAGE (newer
            # builds take a reference video's FRAMES) is split and re-queued
            if _tf is not None and not typefix["done"]:
                fixes = _tf.repair(graph, _tf.mismatches(resp.get("node_errors")))
                if fixes:
                    typefix["done"] = True
                    for f in fixes:
                        say(f"[comfy] link repair: {f}")
                    say("[comfy] queueing again with the repaired links")
                    return _attempt(graph)
            fail("ComfyUI rejected the workflow - the node errors above name the "
                 "exact inputs; fix them in the template or re-export from ComfyUI.")
        t0 = time.time()
        outputs = None
        try:
            while True:
                time.sleep(2)
                hist = _http_json(f"{base}/history/{pid}", timeout=15).get(pid)
                if hist:
                    st = (hist.get("status") or {})
                    if st.get("status_str") == "error" or (st.get("completed") is False
                                                           and st.get("status_str")):
                        msgs = st.get("messages", [])
                        for m in msgs[-6:]:
                            say(f"[comfy] {json.dumps(m, ensure_ascii=False)[:900]}")
                            if isinstance(m, list) and len(m) > 1 and isinstance(m[1], dict):
                                for fld in ("exception_message", "exception_type"):
                                    if m[1].get(fld):
                                        say(f"[comfy]   {fld}: {m[1][fld]}"[:900])
                        # An ACCELERATOR we injected? Hand it back to the loop,
                        # which removes that ONE node and re-queues (2.129.0).
                        # Checked before the memory ladder: a patch pack calling
                        # the model with the wrong signature is a TypeError, not
                        # an allocation failure, and re-planning it smaller would
                        # fail identically at every rung.
                        blame = (_cc.failed_accelerator(msgs, accel_nodes(graph))
                                 if _cc is not None else "")
                        if blame and blame not in dropped:
                            stop_ws.set()
                            return None, blame, msgs
                        # A single run that failed for lack of VRAM is re-planned
                        # smaller and retried by main()'s ladder (2.99.0), whether it
                        # surfaced as a clean torch OOM or as the OSError [Errno 22] a
                        # sampler throws under the same memory pressure (2.99.1 - the
                        # identical 362f run gives one or the other on Tim's card).
                        # The advice rides on the exception and is printed by main()
                        # ONLY if the ladder shrinks to its floor and still fails.
                        if _cc is not None and _cc.is_retryable_sampler_failure(msgs):
                            stop_ws.set()
                            is_true_oom = _cc.is_oom(msgs)
                            reason = (f"GPU out of memory at {frames}f ({frames / FPS:.1f}s) "
                                      f"{params['width']}x{params['height']}"
                                      if is_true_oom else
                                      f"the sampler failed with OSError [Errno 22] at {frames}f "
                                      f"({frames / FPS:.1f}s, {params['width']}x{params['height']}) "
                                      f"- the memory-pressure form of the same failure")
                            raise ComfyOOM(frames, reason,
                                           advice=_cc.explain_execution_error(msgs),
                                           oom=is_true_oom)
                        # NOT a memory failure: print whatever we recognise, then stop.
                        if _cc is not None:
                            for line in _cc.explain_execution_error(msgs).split("\n"):
                                if line.strip():
                                    say(line)
                        # The verdict names the REAL culprit from ComfyUI's own
                        # event (2.143.1). The old generic advice ("check the
                        # MiniMax H3 nodes exist... model files in ComfyUI's OWN
                        # folders") was wrong by construction here: missing node
                        # classes and unknown model filenames are rejected at
                        # /prompt VALIDATION and never reach execution - by the
                        # time an execution_error arrives, the nodes exist and
                        # the filenames resolved. Tim received exactly that
                        # misleading advice on a scene card; the card prefers
                        # "[comfy] node ..." lines (scenes.reasonFromLog), so
                        # they are said in that shape before the fail.
                        culps = (_cc.execution_culprits(msgs) if _cc is not None else [])
                        dets = dict(_cc.culprit_details(msgs)) if _cc is not None else {}
                        for nid, ntype, etype, emsg in culps:
                            say((f"[comfy] node {nid} ({ntype}): "
                                 + (f"{etype}: " if etype else "") + emsg)[:400])
                            # the itemized lines under the summary (2.153.0,
                            # the H3 preflight puts its actual errors and
                            # warnings on the FOLLOWING lines of the message)
                            for ln in dets.get(str(nid), []):
                                say(f"[comfy]   {ln}"[:300])
                            # THE PACK-UPDATE TELL (2.175.0, Tim: "we had this
                            # working before"): when the failing node ran with
                            # REQUIRED inputs the export never had — filled by
                            # schema sync from the server's default or a
                            # combo's first choice — say so. An updated node
                            # pack adding a widget (an audio policy, say) whose
                            # default does not suit this graph looks EXACTLY
                            # like a working workflow that suddenly refuses.
                            fills = (_SYNC_FILLS.get(str(nid))
                                     or sorted(set(_SYNC_FILLS.get("class:" + str(ntype), []))))
                            if fills:
                                say((f"[comfy]   note: this node ran with schema-FILLED "
                                     f"inputs the export never had: {', '.join(fills)} — "
                                     "a node-pack update likely added them. Pin a value "
                                     "via engine.comfy.widget_overrides "
                                     f"(e.g. {{\"{ntype}.{fills[0].split('=')[0]}\": ...}}) "
                                     "or re-export the workflow from the updated pack")[:400])
                            # 2.176.0: the OPTIONAL half — inputs the LIVE
                            # schema knows that the queued graph never sent;
                            # the node used ITS OWN defaults for them. When a
                            # pack update ships a new optional policy widget
                            # with a demanding default, THIS is the only tell.
                            unsent = (_SYNC_FILLS.get("unsent:" + str(nid))
                                      or sorted(set(_SYNC_FILLS.get(
                                          "unsent-class:" + str(ntype), []))))
                            if unsent:
                                say((f"[comfy]   note: this node's LIVE schema also "
                                     f"declares inputs the queued graph did not send: "
                                     f"{', '.join(unsent[:8])}"
                                     + ("…" if len(unsent) > 8 else "")
                                     + " — the node used its OWN defaults for them. "
                                     "If one is a new policy/mode a pack update added, "
                                     "pin it via engine.comfy.widget_overrides "
                                     f"{{\"{ntype}.<name>\": value}} or set it on the "
                                     "canvas and re-export")[:400])
                        if culps:
                            nid, ntype, etype, emsg = culps[-1]
                            fail((f"ComfyUI execution error in node {nid} ({ntype}): "
                                  + (f"{etype}: " if etype else "") + emsg)[:350])
                        fail("ComfyUI reported an execution error without naming a "
                             "node - the [comfy] lines above carry ComfyUI's own "
                             "message verbatim.")
                    if hist.get("outputs"):
                        outputs = hist["outputs"]
                        break
                el = int(time.time() - t0)
                # heartbeat only when the WS has been quiet (no steps for 15s) -
                # with live step lines flowing this stays out of the way
                if el % 10 < 2 and time.time() - seen["t"] > 15:
                    say(f"[comfy] rendering... {el}s elapsed (no step reported for "
                        f"{int(time.time() - seen['t'])}s)")
                if el > 7200:
                    fail("ComfyUI job timed out after 2h")
        finally:
            stop_ws.set()
            ws_thread.join(timeout=2)
        return outputs, "", []

    # THE ACCELERATOR SEATBELT (2.129.0). An accelerator that fails takes the
    # whole render with it, and it fails LATE: ComfyUI runs the expensive encode
    # first and only then reaches the patched sampler, so Tim's run 1 threw away
    # ~6 minutes of GPU work to a Sage wheel that was never going to load. When a
    # failure names an accelerator WE injected, that ONE node is removed (its
    # consumers rewired to its own model input) and the graph is queued again.
    # The retry is cheap, and that is measured rather than hoped for: run 2's log
    # says "18 node(s) served from cache" - ComfyUI keeps its execution cache, so
    # the encode is not repeated. It is also why _comfy_clear_vram sits OUTSIDE
    # this loop: /free resets that cache, and clearing it before the retry would
    # turn seconds back into minutes. Each accelerator is dropped AT MOST ONCE,
    # and only the one that failed - a Spectrum failure never costs the user Sage.
    dropped = set()
    while True:
        outputs, blame, msgs = _attempt(g)
        if outputs is not None:
            break
        cls = accel_nodes(g).get(blame, "?")
        if _cc is not None:
            for line in _cc.explain_execution_error(msgs).split("\n"):
                if line.strip():
                    say(line)
        say(f"[comfy] that failure blames {blame} ({cls}) - a video-style "
            f"accelerator this render injected, not part of the workflow.")
        g, removed = drop_accel_node(g, blame)
        dropped.add(blame)
        if not removed:
            fail(f"the failure blames the {blame} accelerator but it could not be "
                 f"removed from the graph safely - set that accelerator to Off in "
                 f"Settings -> Video styles and generate again.")
        kept = ", ".join(sorted(accel_nodes(g))) or "none"
        say(f"[comfy] re-queueing WITHOUT {blame}, everything else unchanged "
            f"(accelerators kept: {kept}). ComfyUI keeps its execution cache, so "
            f"the work already done is not repeated - this costs seconds, not "
            f"another full render.")
    fitem = None
    # THE FILE IS CHOSEN BY CLASS, NOT BY DICT ORDER (2.165.0, Tim: "I don't
    # think sound is being rendered. the volume button on the preview is
    # disabled" — a disabled volume control means the FILE has no audio
    # track). The old pick took the FIRST video-looking file across the
    # history outputs; on a chain render that can be a SEGMENT artifact
    # instead of the ASSEMBLED film that carries the muxed audio. Rank:
    # the assemble's film first, then a generic video-combine, then anything
    # — and SAY which node's file was taken, so a silent take names its
    # source instead of leaving a mute mystery.
    # RENDER-AWARE RANKING (2.170.0, Tim: "when i select the scenes and
    # click generate selected, only the first scene is rendered ... the
    # first scene is generated 6 times"). His loop runs with
    # verify_resume_history, so on a SINGLE-SCENE render the ASSEMBLE can
    # write a film that resumes from history — a file that STARTS AT SCENE
    # 1 no matter which scene was asked for. 2.165.0's assemble-first pick
    # (the sound fix) then harvested that film for every queued scene:
    # audible, but always opening on scene 1. The pick now reads the
    # queued graph's own scene_range: a single-scene render prefers the
    # scene's SEGMENT; a full render keeps the assembled film first.
    single_scene = None
    for v in g.values():
        if isinstance(v, dict) and v.get("class_type") == "MiniMaxH3ChainLoopStart":
            m = re.fullmatch(r"(\d+):(\d+)", str((v.get("inputs") or {}).get("scene_range", "")))
            if m and m.group(1) == m.group(2):
                single_scene = int(m.group(1))
            break
    def _rank(cls):
        c = cls.lower()
        if single_scene is not None:
            if "segmentsave" in c: return 0
            if "videocombine" in c or "savevideo" in c: return 1
            if "chainassemble" in c: return 3
            return 2
        if "chainassemble" in c: return 0
        if "videocombine" in c or "savevideo" in c: return 1
        if "segmentsave" in c: return 3
        return 2
    cands = []
    for onid, node_out in outputs.items():
        cls = str((g.get(str(onid)) or {}).get("class_type", "?"))
        for key in ("videos", "gifs", "images", "audio"):
            for it in node_out.get(key, []):
                nm = str(it.get("filename", ""))
                if nm.lower().endswith((".webm", ".mp4", ".mkv", ".avi", ".mov")):
                    cands.append((_rank(cls), str(onid), cls, it))
    if cands:
        cands.sort(key=lambda c: c[0])
        _, cnid, ccls, fitem = cands[0]
        say(f"[comfy] taking {fitem['filename']} from {ccls}#{cnid}"
            + (f" ({len(cands)} video output(s) in history)" if len(cands) > 1 else "")
            + (f" - scene {single_scene} render, so the scene's own segment wins"
               if single_scene is not None and "segmentsave" in ccls.lower() else ""))
    if not fitem:
        fail("ComfyUI finished but produced no video output - does the "
             "workflow end in a video save node?")
    raw = out_path.with_suffix(".comfy" + Path(fitem["filename"]).suffix)
    say(f"[comfy] downloading {fitem['filename']}")
    _fetch_output(base, fitem, raw)
    # 2.301.0: a LOSSLESS MASTER when the taps ran - and then the playback
    # file is encoded ONCE from it (ComfyUI's own H.264 is not re-encoded)
    master = out_path.with_suffix(".raw.avi")
    built = bool(params.get("raw_master") and _rm is not None and not rp
                 and _build_master(base, outputs, master, raw_fps or FPS))
    if built:
        rc = run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(master), "-r", str(FPS)]
                 + enc_args(out_path.suffix.lstrip("."), crf=16) + [str(out_path)], echo_cmd=False)
        if rc != 0 or not out_path.exists():
            fail("could not encode the playback copy from the lossless master")
        say(f"[comfy] playback {out_path.suffix.lstrip('.')} encoded once from the master")
    else:
        # normalize container/codec/fps so joins and trims behave identically
        rc = run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(raw),
                  "-r", str(FPS)] + enc_args(out_path.suffix.lstrip("."))
                 + [str(out_path)], echo_cmd=False)
        if rc != 0 or not out_path.exists():
            fail("could not normalize the ComfyUI output with ffmpeg")
    raw.unlink(missing_ok=True)
    if viggle and _hv.black(out_path):             # 2.352.0: never file a black take
        fail(_hv.BLACK_WORDS)
    # THE SILENT-SEGMENT SAFETY NET (2.170.0): if a single-scene render's
    # segment carries no audio track (the very fault 2.165.0 fixed by
    # preferring the assemble), fall back DETERMINISTICALLY: download the
    # assembled film and cut this scene's window out of it — the offsets are
    # not guesses, they are the plan's own lengths. Every step is logged.
    if single_scene is not None:
        def _has_audio(f):
            pr = subprocess.run(["ffmpeg", "-i", str(f)], capture_output=True, text=True)
            return "Audio:" in (pr.stderr or "")
        if not _has_audio(out_path):
            say(f"[comfy] the scene {single_scene} segment has NO audio track")
            asm = next((c for c in cands if "chainassemble" in c[2].lower()), None)
            plan = None
            for v in g.values():
                if isinstance(v, dict) and v.get("class_type") == "MiniMaxH3ChainPlan":
                    try: plan = json.loads(str((v.get("inputs") or {}).get("plan_json", "")))
                    except Exception: plan = None
                    break
            shots = (plan or {}).get("shots") or []
            if asm and len(shots) >= single_scene:
                start = sum(int(sh.get("length", 0)) for sh in shots[:single_scene - 1]) / FPS
                dur = int(shots[single_scene - 1].get("length", 0)) / FPS
                afit = asm[3]
                araw = out_path.with_suffix(".film" + Path(afit["filename"]).suffix)
                say(f"[comfy] cutting scene {single_scene} ({start:.2f}s +{dur:.2f}s, "
                    f"the plan's own offsets) out of the assembled film "
                    f"{afit['filename']} to bring its audio along")
                _fetch_output(base, afit, araw)
                rc2 = run(["ffmpeg", "-y", "-loglevel", "error",
                           "-ss", f"{start:.3f}", "-t", f"{dur:.3f}", "-i", str(araw),
                           "-r", str(FPS)] + enc_args(out_path.suffix.lstrip("."))
                          + [str(out_path)], echo_cmd=False)
                araw.unlink(missing_ok=True)
                if rc2 != 0 or not out_path.exists():
                    fail("could not cut the scene's window out of the assembled film")
            else:
                say("[comfy] no assembled film in this run's outputs to borrow "
                    "audio from - the take stays as the segment wrote it")


MASTER_FETCH_BUDGET = 600      # s - the whole frame download (2.308.0)
MASTER_FETCH_TIMEOUT = 60      # s - one frame


def _fetch_all(base, jobs, budget=MASTER_FETCH_BUDGET, workers=8):
    """Fetch [(item, dest)] with a small thread pool. Raises on the first
    failure, or when the whole set is not down inside `budget` seconds
    (2.308.0 - the caller keeps the take mp4-only and says so)."""
    import concurrent.futures as cf
    from urllib.parse import urlencode
    deadline = time.time() + budget

    def one(pair):
        it, dest = pair
        if it.get("type") == "runpod":
            return _fetch_output(base, it, dest)
        q = urlencode({"filename": it["filename"], "subfolder": it.get("subfolder", ""),
                       "type": it.get("type", "output")})
        with urllib.request.urlopen(f"{base}/view?{q}", timeout=MASTER_FETCH_TIMEOUT) as r, \
                open(dest, "wb") as f:
            shutil.copyfileobj(r, f)

    ex = cf.ThreadPoolExecutor(max_workers=max(1, workers))
    try:
        futs = [ex.submit(one, j) for j in jobs]
        done = 0
        for fu in cf.as_completed(futs, timeout=max(1.0, deadline - time.time())):
            fu.result()
            done += 1
            if done % 100 == 0 and done < len(jobs):
                say(f"[comfy] lossless master: {done}/{len(jobs)} frame(s)...")
    except cf.TimeoutError:
        raise RuntimeError(f"the frame download passed its {budget}s budget")
    finally:
        try:
            ex.shutdown(wait=False, cancel_futures=True)
        except TypeError:                 # Python < 3.9
            ex.shutdown(wait=False)


def _build_master(base, outputs, master: Path, fps) -> bool:
    """2.301.0: download the lossless taps (PNG frames in batch order + the
    FLAC) and write the FFV1 master. False (said) = an mp4-only take."""
    frames, aud = _rm.tap_outputs(outputs)
    if not frames:
        say("[comfy] the lossless tap returned no frames - this take stays mp4-only")
        return False
    d = master.parent / (master.stem + "_frames")
    shutil.rmtree(d, ignore_errors=True)
    d.mkdir(parents=True, exist_ok=True)
    try:
        # 2.308.0 (Tim: "the queued scene doesn't stop running ... even when
        # the comfyui job is completed"): the frames come down IN PARALLEL,
        # each with a short timeout, the whole step inside a time budget,
        # and the log says where it is - a slow or stuck download can no
        # longer hold the scene (and the queue behind it) "running": past
        # the budget the take is kept mp4-only, said in words.
        say(f"[comfy] lossless master: fetching {len(frames)} frame(s) from ComfyUI...")
        t0 = time.time()
        _fetch_all(base, [(it, d / f"{i:06d}.png") for i, it in enumerate(frames, start=1)],
                   budget=MASTER_FETCH_BUDGET)
        say(f"[comfy] lossless master: {len(frames)} frame(s) fetched in {time.time() - t0:.0f}s"
            " - writing the FFV1 master")
        af = None
        if aud:
            af = d / ("audio" + (Path(str(aud.get("filename", ""))).suffix or ".flac"))
            _fetch_output(base, aud, af)
        rc = run(_rm.master_cmd(d / "%06d.png", af, master, fps), echo_cmd=False)
    except Exception as e:                  # noqa: BLE001 - never lose the take
        say(f"[comfy] lossless master failed ({e}) - this take stays mp4-only")
        return False
    finally:
        shutil.rmtree(d, ignore_errors=True)
    if rc != 0 or not master.exists():
        say("[comfy] ffmpeg could not write the lossless master - this take stays mp4-only")
        master.unlink(missing_ok=True)
        return False
    say(f"[comfy] lossless master: {len(frames)} frame(s)" + (" + audio" if aud else "")
        + f" -> {master.name} (FFV1, full RGB, every frame a keyframe)")
    return True


def extract_last_frame(video: Path, frame_index: int, out_png: Path) -> None:
    """Exact frame by index (fl2va hand-off must be the true last frame)."""
    rc = run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(video),
              "-vf", f"select=eq(n\\,{frame_index})", "-vsync", "0",
              "-frames:v", "1", str(out_png)], echo_cmd=False)
    if rc != 0 or not out_png.exists():
        fail(f"could not extract frame {frame_index} from {video.name}")


FORMATS = ("mp4", "webm", "avi")
DEFAULT_FORMAT = "mp4"     # 2.102.1 (Tim): webm does not share over Messenger


def enc_args(fmt: str, crf=None) -> list:
    """Per-generation container codecs. The LAST TWO entries are always the
    audio codec pair (callers slice [:-2] / [-2:] for video-only / mux).
    crf (2.301.0): the mp4 quality - a playback copy encoded ONCE from a
    lossless master uses 16 (near-transparent); everything else 20."""
    if fmt == "avi":
        return ["-c:v", "mpeg4", "-q:v", "4", "-pix_fmt", "yuv420p",
                "-c:a", "pcm_s16le"]
    if fmt == "mp4":
        # H.264/AAC + faststart: plays in Messenger/WhatsApp/iOS/Windows
        # without a transcode; the compile (mp4_args) uses the same choice
        return ["-c:v", "libx264", "-preset", "medium", "-crf", str(crf or 20),
                "-pix_fmt", "yuv420p", "-movflags", "+faststart",
                "-c:a", "aac"]
    return ["-c:v", "libvpx-vp9", "-crf", "30", "-b:v", "0",
            "-pix_fmt", "yuv420p", "-row-mt", "1", "-c:a", "libopus"]


def probe_frames(p: Path) -> int:
    r = subprocess.run(["ffprobe", "-v", "error", "-count_frames",
                        "-select_streams", "v:0",
                        "-show_entries", "stream=nb_read_frames",
                        "-of", "csv=p=0", str(p)],
                       capture_output=True, text=True)
    try:
        return int(r.stdout.strip())
    except ValueError:
        return -1


def probe_has_audio(p: Path) -> bool:
    r = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "a",
                        "-show_entries", "stream=codec_type",
                        "-of", "csv=p=0", str(p)],
                       capture_output=True, text=True)
    return "audio" in (r.stdout or "")


def join_seam_drop(segments, out_path: Path, fmt: str, limit_frames=None) -> None:
    """Concat chunks dropping the seam-duplicate first frame (and 1/24s of
    audio) of chunks 2+. H3 audio is generated jointly, so audio is preserved.
    limit_frames caps the output for the exact-duration trim."""
    n = len(segments)
    if n == 1 and limit_frames is None:
        shutil.copyfile(segments[0], out_path)
        return
    has_a = probe_has_audio(segments[0])
    cmd = ["ffmpeg", "-y", "-loglevel", "error"]
    for s in segments:
        cmd += ["-i", str(s)]
    vparts, aparts, pairs = [], [], []
    for k in range(n):
        if k == 0:
            vparts.append("[0:v]setpts=PTS-STARTPTS[v0]")
            if has_a:
                aparts.append("[0:a]asetpts=PTS-STARTPTS[a0]")
        else:
            vparts.append(f"[{k}:v]trim=start_frame=1,setpts=PTS-STARTPTS[v{k}]")
            if has_a:
                aparts.append(f"[{k}:a]atrim=start={1 / FPS:.6f},asetpts=PTS-STARTPTS[a{k}]")
        pairs.append(f"[v{k}]" + (f"[a{k}]" if has_a else ""))
    if has_a:
        fc = ";".join(vparts + aparts) + ";" + "".join(pairs) + \
            f"concat=n={n}:v=1:a=1[vo][ao]"
        maps = ["-map", "[vo]", "-map", "[ao]"]
    else:
        fc = ";".join(vparts) + ";" + "".join(pairs) + f"concat=n={n}:v=1:a=0[vo]"
        maps = ["-map", "[vo]"]
    cmd += ["-filter_complex", fc] + maps + ["-r", str(FPS)]
    if limit_frames:
        cmd += ["-frames:v", str(limit_frames), "-t", f"{limit_frames / FPS:.6f}"]
    cmd += enc_args(fmt) + [str(out_path)]
    rc = run(cmd, echo_cmd=False)
    if rc != 0 or not out_path.exists():
        fail("seam-drop join failed (is ffmpeg on PATH?)")


def _join_masters(masters, out_path: Path, limit_frames=None) -> None:
    """2.301.0: the chunks' lossless masters -> one master (seam frames
    dropped, exact length), still lossless. One chunk and no trim = a copy."""
    if len(masters) == 1 and not limit_frames:
        shutil.copyfile(masters[0], out_path)
        return
    rc = run(_rm.join_cmd(masters, out_path, FPS, limit_frames,
                          has_audio=probe_has_audio(masters[0])), echo_cmd=False)
    if rc != 0 or not out_path.exists():
        fail("could not join the lossless masters")


def _trim_head(final: Path, master, n: int, fmt: str) -> None:
    """2.302.0 (Tim: "remove the first frame of the video from the raw and
    compressed versions"): drop the first n frames (and n/24 s of audio).
    With a lossless master: trim the master (still FFV1, lossless) and encode
    the playback file ONCE from it; without one: re-encode the take itself."""
    before = probe_frames(final)
    src = master if master is not None and Path(master).exists() else final
    has_a = probe_has_audio(src)
    filt = ["-vf", f"trim=start_frame={n},setpts=PTS-STARTPTS"]
    if has_a:
        filt += ["-af", f"atrim=start={n / FPS:.6f},asetpts=PTS-STARTPTS"]
    if src is not final:
        cut = Path(master).with_suffix(".head.avi")
        rc = run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(master)] + filt
                 + _rm.ffv1_args() + (_rm.pcm_args() if has_a else ["-an"]) + [str(cut)],
                 echo_cmd=False)
        if rc != 0 or not cut.exists():
            fail("trim first frame: could not trim the lossless master")
        cut.replace(master)
        tmp = final.with_suffix(".head" + final.suffix)
        rc = run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(master), "-r", str(FPS)]
                 + enc_args(fmt, crf=16) + [str(tmp)], echo_cmd=False)
    else:
        tmp = final.with_suffix(".head" + final.suffix)
        rc = run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(final)] + filt
                 + ["-r", str(FPS)] + enc_args(fmt, crf=16) + [str(tmp)], echo_cmd=False)
    if rc != 0 or not tmp.exists():
        fail("trim first frame: could not trim the take")
    tmp.replace(final)
    say(f"[worker] trim first frame: dropped {n} frame(s) and {n / FPS:.4f}s of audio "
        f"from the take{' and its lossless master' if src is not final else ''} "
        f"- {before} -> {probe_frames(final)} frames")


def safe_stem(name):
    """A project name turned into a safe FILE stem.

    The project name is already validated as a directory name by
    lib/projects.js, but it may still contain spaces and dots that are awkward
    in a filename, so trim it and strip anything that is not clearly safe."""
    stem = re.sub(r"[^A-Za-z0-9._ -]+", "_", str(name or "project")).strip(" .")
    return stem or "project"


def mp4_args(audio=True, crf="20"):
    """Encoder flags for the compiled <project>.mp4.

    THE one place the compile's codecs are chosen. mp4 must carry H.264/AAC to
    play everywhere, so a stream copy from the VP9 working files is never
    valid here however little compositing happened. yuv420p + faststart are
    what make the result open in Windows players and browsers alike."""
    a = ["-c:v", "libx264", "-preset", "medium", "-crf", crf,
         "-pix_fmt", "yuv420p", "-movflags", "+faststart"]
    if audio:
        a += ["-c:a", "aac", "-b:a", "192k"]
    return a


def seg_duration(p: Path) -> float:
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                        "-of", "csv=p=0", str(p)], capture_output=True, text=True)
    try:
        return float(r.stdout.strip())
    except ValueError:
        return 0.0


def compile_span(tl, base_dur: float) -> float:
    """How long the compiled movie must be, in seconds.

    THE BUG THIS FIXES (2.63.0): the composite pass hands the joined V1 track
    to ffmpeg as input 0, and `overlay` emits exactly as many frames as its
    MAIN input has while `amix=duration=first` stops with the first stream in
    the mix. Both of those meant "as long as the base video track", so a V2
    clip, an image or a soundtrack that ran past the last frame of V1 was
    truncated with nothing in the log to say so. Everything downstream of this
    number pads V1 up to it instead.

    The arithmetic itself lives in scripts/timeline_span.py so the route, the
    worker and the tests all agree. Clips carrying neither `out` nor `dur` are
    ffprobed here — that is the only reason this wrapper exists rather than
    calling the module directly.
    """
    if _span is None:
        say("[worker] WARNING: scripts/timeline_span.py did not import "
            f"({_span_err}); the compile can only reach the end of the video track")
        return base_dur
    seen = {}

    def probe(p):
        if not p:
            return None
        if p not in seen:
            seen[p] = seg_duration(Path(p))
        return seen[p]

    try:
        return _span.compile_span(tl, base_dur=base_dur, probe=probe,
                                  hint=tl.get("scene_end"))
    except Exception as e:         # noqa: BLE001 - never lose an export to this
        say(f"[worker] WARNING: could not measure the timeline ({e}); "
            "falling back to the length of the video track")
        return base_dur


def has_audio(p: Path) -> bool:
    """True when the file carries at least one audio stream.

    fade_v1 needs this because passing -af to a file with no audio makes
    ffmpeg fail the whole pass ("Cannot find a matching stream"), which would
    turn a missing soundtrack into a lost export."""
    r = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "a",
                        "-show_entries", "stream=index", "-of", "csv=p=0", str(p)],
                       capture_output=True, text=True)
    return bool(r.stdout.strip())


def join_v1(segments, transition, final: Path) -> None:
    """Join the V1 segments, with a transition between them if one is set.

    A cut takes the plain concat path unchanged - concat is stream-copy fast and
    lossless, so transitions must never cost anything when nobody asked for one.
    Anything that goes wrong falls back to concat rather than failing the export:
    losing a wipe is a far better outcome than losing the render.
    """
    if _tr is None or not _tr.is_active(transition):
        concat_segments(segments, final)
        return
    n = _tr.normalize(transition)
    durs = [seg_duration(p) for p in segments]
    if any(d <= 0 for d in durs):
        say("[worker] could not probe every segment - falling back to a hard cut")
        concat_segments(segments, final)
        return
    used = _tr.clamp_duration(durs, n["dur"])
    if used < n["dur"] - 1e-3:
        # a transition cannot be longer than half the shortest clip it joins
        say(f"[worker] transition shortened to {used:.2f}s "
            f"(shortest clip is {min(durs):.2f}s)")
    total = _tr.joined_length(durs, n["dur"])
    say(f"[worker] transition: {n['type']} {used:.2f}s across {len(segments)} segments "
        f"- {sum(durs):.2f}s of clips becomes {total:.2f}s "
        "(each transition overlaps the two clips it joins)")
    cmd = _tr.ffmpeg_args(segments, durs, n, final, fps=FPS, audio=True)
    if run(cmd) != 0 or not final.exists():
        say("[worker] transition join failed - falling back to a hard cut")
        concat_segments(segments, final)


def fade_v1(allv: Path, tl) -> Path:
    """Apply V1's IN/OUT boundary transitions to the joined base track.

    Returns the path to use downstream — the original when there is nothing to
    do, so a cut still costs zero extra encodes. Unlike an overlay, the base
    track fills the frame, so it dips through a COLOUR (black, or white for dip
    to white) rather than ramping alpha; there is nothing behind it.

    Failure is never fatal: if the pass does not produce a file the un-faded
    track is returned and the export continues, matching join_v1's policy that
    losing a transition beats losing the render.
    """
    if _tr is None:
        return allv
    t_in, t_out = tl.get("video_transition_in"), tl.get("video_transition_out")
    # NOTE: on V1 the OUT transition does double duty — join_v1 has already used
    # it as the xfade BETWEEN adjacent clips, and here it also closes the track.
    want_in, want_out = _tr.is_active(t_in), _tr.is_active(t_out)
    if not want_in and not want_out:
        return allv
    dur = seg_duration(allv)
    if dur <= 0:
        say("[worker] could not probe the joined track - skipping the V1 boundary fades")
        return allv
    vf = [f for f in (_fade(t_in, "in", 0.0, dur) if want_in else "",
                      _fade(t_out, "out", dur, dur) if want_out else "") if f]
    af = [f for f in (_fade(t_in, "in", 0.0, dur, audio=True) if want_in else "",
                      _fade(t_out, "out", dur, dur, audio=True) if want_out else "") if f]
    if not vf:
        return allv
    say(f"[worker] V1 boundary: in={_tr.normalize(t_in)['type'] if want_in else 'cut'} "
        f"out={_tr.normalize(t_out)['type'] if want_out else 'cut'} over {dur:.2f}s")
    # 2.215.0: the faded track keeps the joined track's container, and the
    # encoder follows it - vp9/opus for webm; x264/aac otherwise, which is
    # faster and already what the final .mp4 wants
    out = allv.parent / ("allv_faded" + allv.suffix)
    webm = allv.suffix == ".webm"
    cmd = ["ffmpeg", "-y", "-loglevel", "error", "-i", str(allv),
           "-vf", ",".join(vf)]
    if af and has_audio(allv):
        cmd += ["-af", ",".join(af), "-c:a", "libopus" if webm else "aac"]
    cmd += (["-c:v", "libvpx-vp9", "-crf", "34", "-b:v", "0"] if webm
            else ["-c:v", "libx264", "-preset", "veryfast", "-crf", "18",
                  "-pix_fmt", "yuv420p"])
    cmd += ["-r", str(FPS), str(out)]
    if run(cmd, echo_cmd=False) != 0 or not out.exists():
        say("[worker] V1 boundary fade failed - keeping the un-faded track")
        return allv
    return out


# ---- 2.491.0 BLEND MODES + TRACK MATTES ------------------------------------------------------------------------------
# Tim: "go with 1,2,4,5 and 6 as you suggested" - AFTER-EFFECTS-GAP.md item 6. A layer's blend mode / track matte
# (lib/tlKeys.layerKeys: blend, matte {mode, by: the layer above}, matteonly, lk) - the canvas draws the same
# (ext/timelinedock/canvas.js drawLayer / applyMatte). The canvas's blend names -> ffmpeg's blend modes:
_BLENDS = {"multiply": "multiply", "screen": "screen", "overlay": "overlay", "darken": "darken", "lighten": "lighten",
           "color-dodge": "dodge", "color-burn": "burn", "hard-light": "hardlight", "soft-light": "softlight",
           "difference": "difference", "exclusion": "exclusion", "add": "addition"}
# 2.495.0 (Tim: "is there someway to get hue saturation, clor, luminosity blend modes to work?"): the four colour modes
# ffmpeg's blend filter has no way to do (they mix the three colour channels) - worked out in full-range BT.601 YUV
# with look-up tables (_hsl_blend); the canvas does the same sums (ext/timelinedock/canvas.js blendYUV)
_HSL = ("hue", "saturation", "color", "luminosity")


def _hsl_blend(parts, a, b, mode, out, i):
    """Layer [b] over base [a] (both gbrp, the whole frame) in a colour mode -> [out] (gbrp):
    luminosity = the layer's brightness (Y) + the base's colour (U V); color = the base's Y + the layer's U V;
    hue = the base's Y, the layer's colour DIRECTION at the base's colour STRENGTH; saturation = the base's Y and colour
    direction at the layer's colour strength. Each step a LUT (lut2 / mergeplanes) - fast."""
    M = "hypot(x-128,y-128)"
    j = lambda *ls: "".join(f"[hz{l}{i}]" for l in ls)

    def merge(yy, uu, vv):
        parts.append(f"{j(yy, uu, vv)}mergeplanes=map0s=0:map0p=0:map1s=1:map1p=0:map2s=2:map2p=0:format=yuvj444p,format=gbrp[{out}]")
    if mode == "luminosity":
        parts.append(f"[{a}]format=yuvj444p,extractplanes=u+v{j('hU', 'hV')}")
        parts.append(f"[{b}]format=yuvj444p,extractplanes=y{j('sY')}")
        return merge("sY", "hU", "hV")
    if mode == "color":
        parts.append(f"[{a}]format=yuvj444p,extractplanes=y{j('hY')}")
        parts.append(f"[{b}]format=yuvj444p,extractplanes=u+v{j('sU', 'sV')}")
        return merge("hY", "sU", "sV")
    D, S_ = ("s", "h") if mode == "hue" else ("h", "s")          # the colour's direction from D, its strength from S_
    parts.append(f"[{a}]format=yuvj444p,extractplanes=y+u+v{j('hY', 'hU', 'hV')}")
    parts.append(f"[{b}]format=yuvj444p,extractplanes=u+v{j('sU', 'sV')}")
    parts.append(f"{j(S_ + 'U', S_ + 'V')}lut2=c0='{M}'{j('m')}")
    parts.append(f"{j('m')}split{j('m1', 'm2')}")
    parts.append(f"{j(D + 'U')}split{j('dU1', 'dU2')}")
    parts.append(f"{j(D + 'V')}split{j('dV1', 'dV2')}")
    dirf = f"if(gt({M},0),128+127*(x-128)/{M},128)"
    parts.append(f"{j('dU1', 'dV1')}lut2=c0='{dirf}'{j('eU')}")
    parts.append(f"{j('dV2', 'dU2')}lut2=c0='{dirf}'{j('eV')}")
    parts.append(f"{j('eU', 'm1')}lut2=c0='clip(128+(x-128)*y/127,0,255)'{j('nU')}")
    parts.append(f"{j('eV', 'm2')}lut2=c0='clip(128+(x-128)*y/127,0,255)'{j('nV')}")
    return merge("hY", "nU", "nV")


def _composite_ops(parts, ops, vprev, fw, fh, span, say):
    """Every layer clip put on the picture in order. A plain clip = an overlay (as before). A matte layer's clips go
    onto that layer's own see-through picture instead (never onto the picture); a matted clip, on a full-frame
    see-through picture, gets its alpha multiplied by the matte's alpha / brightness (inverted: 1 - it); a blended
    clip is blended with what is under it in RGB (ffmpeg blend) and laid on by its own alpha."""
    T = max(1.0, float(span or 0) + 1.0)
    canvas = f"color=c=black@0:s={int(fw)}x{int(fh)}:r={FPS}:d={T:.3f},format=rgba"
    mcan, users, n = {}, {}, 0
    for op in ops:
        c = op.get("c") or {}
        m = c.get("matte") if isinstance(c.get("matte"), dict) else None
        if m and m.get("by") and not c.get("matteonly"):
            users[m["by"]] = users.get(m["by"], 0) + 1
    for op in ops:                                    # the matte layers' own pictures
        c = op.get("c") or {}
        if not c.get("matteonly"):
            continue
        lk = str(c.get("lk") or "?")
        if lk not in mcan:
            parts.append(f"{canvas}[mc{n}]")
            mcan[lk] = f"mc{n}"
            n += 1
        # a still picture is ONE frame: it must repeat (overlay's default), a video ends (pass)
        parts.append(f"[{mcan[lk]}][{op['src']}]overlay={'eof_action=pass:' if op.get('eof') else ''}x={op['x']}:y={op['y']}:enable='{op['en']}'[mc{n}]")
        mcan[lk] = f"mc{n}"
        n += 1
    msplit = {}
    for j, (lk, k) in enumerate(sorted(users.items())):
        if lk not in mcan:
            continue
        outs = [f"ms{j}_{q}" for q in range(k)]
        parts.append(f"[{mcan[lk]}]split={k}" + "".join(f"[{o}]" for o in outs) if k > 1 else f"[{mcan[lk]}]null[{outs[0]}]")
        msplit[lk] = outs
    for op in ops:
        if "fn" in op:
            vprev = op["fn"](vprev)
            continue
        c, i, src = op["c"], op["i"], op["src"]
        if c.get("matteonly"):
            continue
        m = c.get("matte") if isinstance(c.get("matte"), dict) else None
        blend = _BLENDS.get(c.get("blend")) or (c.get("blend") if c.get("blend") in _HSL else None)
        if m and not msplit.get(m.get("by")):
            say(f"[worker] layer clip {i}: its track matte has no layer above it - drawn plainly")
            m = None
        if not m and not blend:
            parts.append(f"[{vprev}][{src}]overlay={'eof_action=pass:' if op.get('eof') else ''}"
                         f"x={op['x']}:y={op['y']}:enable='{op['en']}'[v{i}]")
            vprev = f"v{i}"
            continue
        parts.append(f"{canvas}[cf{i}]")
        parts.append(f"[cf{i}][{src}]overlay={'eof_action=pass:' if op.get('eof') else ''}x={op['x']}:y={op['y']}:enable='{op['en']}',format=rgba[ff{i}]")
        full = f"ff{i}"
        if m:
            ml, mode = msplit[m["by"]].pop(), m.get("mode")
            if mode in ("luma", "lumainv"):
                parts.append(f"color=c=black:s={int(fw)}x{int(fh)}:r={FPS}:d={T:.3f}[mk0{i}]")
                parts.append(f"[mk0{i}][{ml}]overlay=format=auto,format=gray{',negate' if mode == 'lumainv' else ''}[mk{i}]")
            else:
                parts.append(f"[{ml}]alphaextract{',negate' if mode == 'alphainv' else ''}[mk{i}]")
            parts.append(f"[{full}]split[fa{i}][fb{i}]")
            parts.append(f"[fa{i}]alphaextract[ca{i}]")
            parts.append(f"[ca{i}][mk{i}]blend=all_mode=multiply[na{i}]")
            parts.append(f"[fb{i}][na{i}]alphamerge[fm{i}]")
            full = f"fm{i}"
            say(f"[worker] layer clip {i}: a {mode} track matte (the layer above it)")
        if blend:
            parts.append(f"[{vprev}]format=gbrp,split[bA{i}][bB{i}]")
            parts.append(f"[{full}]split[fA{i}][fB{i}]")
            parts.append(f"[fA{i}]alphaextract[al{i}]")
            parts.append(f"[fB{i}]format=gbrp[fp{i}]")
            if blend in _HSL:
                _hsl_blend(parts, f"bA{i}", f"fp{i}", blend, f"bx{i}", i)
            else:
                parts.append(f"[bA{i}][fp{i}]blend=all_mode={blend}[bx{i}]")
            parts.append(f"[bx{i}][al{i}]alphamerge[bm{i}]")
            parts.append(f"[bB{i}][bm{i}]overlay=format=auto[v{i}]")
            say(f"[worker] layer clip {i}: blend mode {c.get('blend')}")
        else:
            parts.append(f"[{vprev}][{full}]overlay=format=auto[v{i}]")
        vprev = f"v{i}"
    return vprev


_FF_MAJOR = None


def _fc_args(graph):
    """2.489.0: the filter graph as arguments - or, when it is long (Bézier tweens, curved motion paths: big per-frame
    expressions), from a file, so the command line never runs past the system's limit (ffmpeg 7+: -/filter_complex,
    before that -filter_complex_script)."""
    global _FF_MAJOR
    if len(graph) < 60000:
        return ["-filter_complex", graph]
    if _FF_MAJOR is None:
        try:
            out = subprocess.run(["ffmpeg", "-version"], capture_output=True, text=True, timeout=20).stdout
            m = re.search(r"ffmpeg version n?(\d+)", out)
            _FF_MAJOR = int(m.group(1)) if m else 6
        except Exception:
            _FF_MAJOR = 6
    fp = Path.cwd() / "filtergraph.txt"
    fp.write_text(graph, encoding="utf-8")
    return ["-/filter_complex", str(fp)] if _FF_MAJOR >= 7 else ["-filter_complex_script", str(fp)]


_WEBM_V = {"vp8", "vp9", "av1"}
_WEBM_A = {"vorbis", "opus"}


def _tf_chain(tf):
    """2.377.0: a layer clip's canvas transform (lib/clipTransform: x / y = its centre's offset from the picture's
    centre in pixels, scale = times its default size, rot = degrees clockwise) -> (filters to put after format=rgba,
    "+X" for the overlay's x, "+Y" for its y). The rotation keeps the whole picture (the box grows, the corners stay
    transparent) and the overlay still centres the box - so the clip's centre lands exactly where the canvas showed
    it. No transform = ("", "", "")."""
    if not isinstance(tf, dict):
        return "", "", ""
    try:
        x, y = float(tf.get("x") or 0), float(tf.get("y") or 0)
        sc = float(tf.get("scale") if tf.get("scale") is not None else 1)
        rot = float(tf.get("rot") or 0)
        ax, ay = float(tf.get("ax") or 0), float(tf.get("ay") or 0)
    except (TypeError, ValueError):
        return "", "", ""
    sc = min(20.0, max(0.01, sc))
    f = ""
    if abs(sc - 1) > 1e-4:
        f += f"scale=w='max(2,trunc(iw*{sc:.5f}/2)*2)':h='max(2,trunc(ih*{sc:.5f}/2)*2)',"
    if abs(rot) > 0.01:
        a = f"{rot:.4f}*PI/180"
        f += f"rotate=a={a}:c=none:ow='rotw({a})':oh='roth({a})',"
    if abs(ax) > 0.01 or abs(ay) > 0.01:     # 2.489.0: the anchor point - the box's centre moves by -R(rot)·scale·anchor
        r = math.radians(rot)
        x -= sc * (ax * math.cos(r) - ay * math.sin(r))
        y -= sc * (ax * math.sin(r) + ay * math.cos(r))
    tx = f"+({x:.2f})" if abs(x) > 0.01 else ""
    ty = f"+({y:.2f})" if abs(y) > 0.01 else ""
    return f, tx, ty


# ---- 2.379.0 ◆ KEYFRAMES + TWEENS in the compile -------------------------------------------------------------------
# Tim: "say we add a text to the preview canvas add a keyframe to the timeline on that text layer then add another
# keyframe at a different time and scale or move or change color can we create a tween between the keyframes?"
# MIRROR of static/keyframes.js (value / ease) - the page, the canvas and the exporter use that file; a fix there
# belongs here too (scripts/test-keyframes.js runs both on the same cases).
#   position / scale / rotation -> pad the clip onto a transparent canvas, then `perspective` (sense=destination,
#                                  eval=frame) moves the canvas's corners per frame: the tween as an ffmpeg expression
#                                  of the clip's own frame number (fps forced to KF_FPS)
#   opacity / text colour       -> `colorchannelmixer` driven per frame by `sendcmd` (values computed HERE, so the
#                                  easing is exactly the page's); a text colour tints the white-fill twin picture
#   volume (sound clips)        -> `volume=eval=frame` with the same expression builder
KF_FPS = 24
KF_EASES = ("linear", "in", "out", "inout", "hold", "bezier")


def _kf_okbz(b):
    try:
        return isinstance(b, (list, tuple)) and len(b) == 4 and all(math.isfinite(float(v)) for v in b)
    except (TypeError, ValueError):
        return False


def _kf_okt(t):
    try:
        return isinstance(t, (list, tuple)) and len(t) == 2 and all(math.isfinite(float(v)) for v in t) and (float(t[0]) != 0 or float(t[1]) != 0)
    except (TypeError, ValueError):
        return False


def _kf_bezier(b, f):
    """2.489.0: static/keyframes.js bezier() - CSS cubic-bezier(x1, y1, x2, y2) at time f (Newton, then halving)."""
    x1, y1, x2, y2 = max(0.0, min(1.0, float(b[0]))), float(b[1]), max(0.0, min(1.0, float(b[2]))), float(b[3])
    bx = lambda s: 3 * (1 - s) ** 2 * s * x1 + 3 * (1 - s) * s * s * x2 + s ** 3
    by = lambda s: 3 * (1 - s) ** 2 * s * y1 + 3 * (1 - s) * s * s * y2 + s ** 3
    dx = lambda s: 3 * (1 - s) ** 2 * x1 + 6 * (1 - s) * s * (x2 - x1) + 3 * s * s * (1 - x2)
    s = f
    for _ in range(8):
        e, d = bx(s) - f, dx(s)
        if abs(e) < 1e-7:
            return by(s)
        if abs(d) < 1e-6:
            break
        s = max(0.0, min(1.0, s - e / d))
    lo, hi, s = 0.0, 1.0, f
    for _ in range(40):
        v = bx(s)
        if abs(v - f) < 1e-7:
            break
        if v < f:
            lo = s
        else:
            hi = s
        s = (lo + hi) / 2
    return by(s)


def _kf_ease(name, f, bz=None):
    f = 0.0 if f < 0 else 1.0 if f > 1 else f
    if name == "bezier":
        return _kf_bezier(bz, f) if _kf_okbz(bz) else f
    if name == "in":
        return f * f
    if name == "out":
        return 1 - (1 - f) * (1 - f)
    if name == "inout":
        return f * f * (3 - 2 * f)
    if name == "hold":
        return 0.0
    return f


def _kf_hex(c):
    s = str(c or "").strip().lower()
    if re.fullmatch(r"#[0-9a-f]{3}", s):
        s = "#" + s[1] * 2 + s[2] * 2 + s[3] * 2
    return s if re.fullmatch(r"#[0-9a-f]{6}", s) else None


def _kf_rgb(c):
    h = _kf_hex(c) or "#ffffff"
    return [int(h[1:3], 16), int(h[3:5], 16), int(h[5:7], 16)]


def _kf_keys(kf, prop):
    out = []
    for k in (kf if isinstance(kf, list) else []):
        if isinstance(k, dict) and k.get(prop) is not None:
            try:
                out.append(dict(k, at=float(k.get("at"))))
            except (TypeError, ValueError):
                pass
    return sorted(out, key=lambda k: k["at"])


def _kf_has(kf, prop):
    return bool(_kf_keys(kf, prop))


def _kf_value(kf, at, prop, fb):
    """static/keyframes.js value(): held before the first / after the last keyframe, eased between."""
    ks = _kf_keys(kf, prop)
    if not ks:
        return fb
    is_c = prop == "color"
    v = (lambda k: _kf_hex(k[prop]) or "#ffffff") if is_c else (lambda k: float(k[prop]))
    if at <= ks[0]["at"]:
        return v(ks[0])
    if at >= ks[-1]["at"]:
        return v(ks[-1])
    for a, b in zip(ks, ks[1:]):
        if a["at"] <= at < b["at"]:
            f = _kf_ease(a.get("ease"), (at - a["at"]) / max(1e-9, b["at"] - a["at"]), a.get("bz"))
            if is_c:
                A, B = _kf_rgb(v(a)), _kf_rgb(v(b))
                return "#" + "".join("%02x" % max(0, min(255, int(round(x + (y - x) * f)))) for x, y in zip(A, B))
            ix = 0 if prop == "x" else 1 if prop == "y" else -1
            if ix >= 0 and a.get("ease") != "hold" and (_kf_okt(a.get("to")) or _kf_okt(b.get("ti"))):   # 2.489.0: a curved path
                p0, p3 = v(a), v(b)
                p1 = p0 + (float(a["to"][ix]) if _kf_okt(a.get("to")) else 0.0)
                p2 = p3 + (float(b["ti"][ix]) if _kf_okt(b.get("ti")) else 0.0)
                u = 1 - f
                return u ** 3 * p0 + 3 * u * u * f * p1 + 3 * u * f * f * p2 + f ** 3 * p3
            return v(a) + (v(b) - v(a)) * f
    return v(ks[-1])


def _kf_n(v):
    return f"{float(v):.6f}"


def _kf_expr(kf, prop, fb, tv):
    """The tween of `prop` as an ffmpeg expression of the time expression `tv` (seconds into the clip) - the same
    curve _kf_value draws. No keyframes -> the fallback as a constant."""
    ks = _kf_keys(kf, prop)
    if not ks:
        return _kf_n(fb)
    segs = []
    for a, b in zip(ks, ks[1:]):
        dt = max(1e-6, b["at"] - a["at"])
        F = f"clip(({tv}-{_kf_n(a['at'])})/{_kf_n(dt)},0,1)"
        e = a.get("ease")
        if e == "bezier" and _kf_okbz(a.get("bz")):
            # 2.489.0: a Bézier speed curve as 32 straight pieces (an ffmpeg expression cannot solve the curve)
            pts = [(i / 32, _kf_bezier(a["bz"], i / 32)) for i in range(33)]
            E = _kf_n(pts[-1][1])
            for (f0, y0), (f1, y1) in reversed(list(zip(pts, pts[1:]))):
                E = f"if(lt({F},{_kf_n(f1)}),({_kf_n(y0)}+({_kf_n((y1 - y0) / (f1 - f0))})*({F}-{_kf_n(f0)})),{E})"
            E = f"({E})"
        else:
            E = (f"({F}*{F})" if e == "in" else f"(1-(1-{F})*(1-{F}))" if e == "out"
                 else f"({F}*{F}*(3-2*{F}))" if e == "inout" else "0" if e == "hold" else F)
        va, vb = float(a[prop]), float(b[prop])
        ix = 0 if prop == "x" else 1 if prop == "y" else -1
        if ix >= 0 and e != "hold" and (_kf_okt(a.get("to")) or _kf_okt(b.get("ti"))):          # 2.489.0: a curved path
            p1 = va + (float(a["to"][ix]) if _kf_okt(a.get("to")) else 0.0)
            p2 = vb + (float(b["ti"][ix]) if _kf_okt(b.get("ti")) else 0.0)
            # the cubic in Horner form (the eased progress written 3 times, not 12)
            c1, c2, c3 = 3 * (p1 - va), 3 * (va - 2 * p1 + p2), vb - va + 3 * (p1 - p2)
            seg = f"({_kf_n(va)}+{E}*({_kf_n(c1)}+{E}*({_kf_n(c2)}+{E}*{_kf_n(c3)})))"
        else:
            seg = f"({_kf_n(va)}+({_kf_n(vb - va)})*{E})"
        segs.append(seg)
    if not segs:
        return _kf_n(ks[0][prop])
    # 2.495.0: the pieces as a BALANCED tree of if()s (depth log n, not n) - a video layer following a parent sends
    # its world position as many keys (ext/timelinedock/tlparent.js worldKeys)

    def tree(lo, hi):
        if lo == hi:
            return segs[lo]
        mid = (lo + hi) // 2
        return f"if(lt({tv},{_kf_n(ks[mid + 1]['at'])}),{tree(lo, mid)},{tree(mid + 1, hi)})"
    expr = f"if(lt({tv},{_kf_n(ks[-1]['at'])}),{tree(0, len(segs) - 1)},{_kf_n(ks[-1][prop])})"
    return f"if(lt({tv},{_kf_n(ks[0]['at'])}),{_kf_n(ks[0][prop])},{expr})"


def _kf_moves(kf):
    return any(_kf_has(kf, p) for p in ("x", "y", "scale", "rot", "ax", "ay"))


def _kf_perspective(kf, tf, frame_w, frame_h, tv=None):
    """pad (a transparent canvas at least the frame's size, a clear border so nothing smears) + perspective: the
    canvas's corners scaled, rotated and moved per frame about its centre - the clip's centre lands at the frame's
    centre + (x, y), exactly where static/keyframes.js puts it on the canvas."""
    tf = tf if isinstance(tf, dict) else {}
    tv = tv or f"((in-1)/{KF_FPS})"     # perspective counts its input frames from 1 (in = frame_count_out + 1)
    X = _kf_expr(kf, "x", float(tf.get("x") or 0), tv)
    Y = _kf_expr(kf, "y", float(tf.get("y") or 0), tv)
    Sc = _kf_expr(kf, "scale", float(tf.get("scale") if tf.get("scale") is not None else 1), tv)
    A = f"(({_kf_expr(kf, 'rot', float(tf.get('rot') or 0), tv)})*PI/180)"
    S_ = f"max(0.01,{Sc})"
    # 2.489.0: the anchor point - position puts it there, scale and rotation pivot on it
    AX = _kf_expr(kf, "ax", float(tf.get("ax") or 0), tv)
    AY = _kf_expr(kf, "ay", float(tf.get("ay") or 0), tv)
    corners = []
    for sx, sy in ((-1, -1), (1, -1), (-1, 1), (1, 1)):
        dx, dy = f"(({sx}*W/2-({AX}))*{S_})", f"(({sy}*H/2-({AY}))*{S_})"
        corners.append((f"W/2+({X})+{dx}*cos({A})-{dy}*sin({A})", f"H/2+({Y})+{dx}*sin({A})+{dy}*cos({A})"))
    opts = ":".join(f"x{i}='{cx}':y{i}='{cy}'" for i, (cx, cy) in enumerate(corners))
    return (f"pad=w='trunc((max(iw,{int(frame_w)})+9)/2)*2':h='trunc((max(ih,{int(frame_h)})+9)/2)*2':"
            f"x='(ow-iw)/2':y='(oh-ih)/2':color=black@0,"
            f"perspective={opts}:sense=destination:eval=frame")


def _kf_cmd(kf, tag, length, op_static, lop, tint_color, cmd_path):
    """The per-frame opacity (op keyframes x the layer's opacity) and tint (a keyed text colour) for
    colorchannelmixer@<tag>, written as a sendcmd file. Returns the filter text that applies it."""
    keyed_op = _kf_has(kf, "op")
    tint = tint_color is not None
    # after the last keyframe every value holds - nothing to send past it
    last_at = max([float(k.get("at") or 0) for k in kf if isinstance(k, dict)] + [0.0])
    length = min(float(length or 1e9), last_at + 0.5)
    n = int(math.ceil(max(0.05, length) * KF_FPS)) + 1
    lines, last = [], None
    first = None
    for i in range(n):
        tau = i / KF_FPS
        a = (_kf_value(kf, tau, "op", op_static) * lop) if keyed_op else op_static
        rgb = _kf_rgb(_kf_value(kf, tau, "color", tint_color)) if tint else [255, 255, 255]
        cur = (round(max(0.0, min(1.0, a)), 4), *[round(c / 255.0, 4) for c in rgb])
        if first is None:
            first = cur
        if cur != last:
            cmds = [f"colorchannelmixer@{tag} aa {cur[0]}"]
            if tint:
                cmds += [f"colorchannelmixer@{tag} rr {cur[1]}", f"colorchannelmixer@{tag} gg {cur[2]}",
                         f"colorchannelmixer@{tag} bb {cur[3]}"]
            lines.append(f"{tau:.4f} " + ", ".join(cmds) + ";")
            last = cur
    Path(cmd_path).write_text("\n".join(lines) + "\n")
    init = f"aa={first[0]}" + (f":rr={first[1]}:gg={first[2]}:bb={first[3]}" if tint else "")
    return f"sendcmd=f={Path(cmd_path).name},colorchannelmixer@{tag}={init}"


def _fit_frame(src, fr, run, say):
    """2.513.0: the timeline's FRAME SIZE (ext/timelinedock/tlsizebar.js, static/framesize.js): the joined V1 track
    scaled to fit inside w x h (its aspect kept) and centred on black - exactly how the canvas draws V1 in a frame of
    another size (canvas.js box "v1": k = min(W / vw, H / vh), centred). Every layer is then placed on that frame.
    No frame (or the track already that size) = the track as it is."""
    try:
        w, h = int(fr["w"]), int(fr["h"])
    except (TypeError, KeyError, ValueError):
        return src
    if w < 16 or h < 16:
        return src
    cw, ch = _video_wh(src)
    if (cw, ch) == (w, h):
        return src
    out = Path(src).with_name(Path(src).stem + f"_frame{w}x{h}.mp4")
    vf = (f"scale={w}:{h}:force_original_aspect_ratio=decrease:flags=bicubic,"
          f"pad={w}:{h}:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1")
    a = has_audio(src)
    rc = run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(src), "-vf", vf]
             + mp4_args(audio=a, crf="14") + ([] if a else ["-an"]) + [str(out)], echo_cmd=False)
    if rc != 0 or not out.exists():
        say(f"[worker] the frame size {w}x{h} could not be applied - the V1 size {cw}x{ch} is kept")
        return src
    say(f"[worker] frame {w}x{h}: V1 ({cw}x{ch}) fitted in")
    return out


def _video_wh(p):
    r = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height",
                        "-of", "csv=p=0:s=x", str(p)], capture_output=True, text=True)
    try:
        w, h = (r.stdout or "").strip().splitlines()[0].split("x")[:2]
        return int(w), int(h)
    except (ValueError, IndexError):
        return 1280, 720


def has_alpha(p) -> bool:
    """2.373.0: a VP9 / VP8 webm that CARRIES an alpha channel (the karaoke overlay: alpha_mode=1). ffmpeg's
    built-in vp9 decoder drops the alpha plane, so such a clip must be read through libvpx-vp9 (vp8: libvpx)
    or the overlay layer composites as a black frame."""
    r = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0",
                        "-show_entries", "stream=codec_name:stream_tags=alpha_mode",
                        "-of", "json", str(p)], capture_output=True, text=True)
    try:
        st = (json.loads(r.stdout or "{}").get("streams") or [{}])[0]
    except ValueError:
        return False
    tags = {k.lower(): v for k, v in (st.get("tags") or {}).items()}
    return str(tags.get("alpha_mode", "")).strip() == "1" and st.get("codec_name") in ("vp9", "vp8")


def _stream_codec(p, kind: str) -> str:
    """First video ('v') or audio ('a') codec name of a media file, '' when absent."""
    r = subprocess.run(["ffprobe", "-v", "error", "-select_streams", kind + ":0",
                        "-show_entries", "stream=codec_name", "-of", "csv=p=0",
                        str(p)], capture_output=True, text=True)
    s = (r.stdout or "").strip()
    return s.splitlines()[0].strip() if s else ""


def joined_container(seg) -> str:
    """The join intermediate's suffix, chosen by what the segments CARRY.

    2.215.0 (Tim's hardware log): the join's whole point is `-c copy` -
    lossless and instant - and a stream copy only muxes if the container
    admits the codecs. webm takes vp8/vp9/av1 + vorbis/opus and NOTHING else,
    so Tim's h264 ComfyUI takes hit "Only VP8 or VP9 or AV1 ... supported for
    WebM", and the export paid a full vp9 re-encode for a container nobody
    asked for - the final file is .mp4 anyway. Matroska takes practically
    everything, so anything not webm-legal joins into .mkv and the copy just
    works; unknown codecs also go to .mkv, the container that cannot object.
    The re-encode fallback in concat_segments stays for genuinely mixed-codec
    segment sets, which no container can save from a copy refusal."""
    v, a = _stream_codec(seg, "v"), _stream_codec(seg, "a")
    if v in _WEBM_V and (a in _WEBM_A or not a):
        return ".webm"
    say(f"[worker] segments carry {v or 'unknown'}/{a or 'no audio'} - webm cannot hold them")
    return ".mkv"


def concat_segments(segments, final: Path) -> None:
    lst = final.parent / "concat.txt"
    lst.write_text("".join(f"file '{Path(s).as_posix()}'\n" for s in segments), encoding="utf-8")
    say(f"[worker] concatenating {len(segments)} segments -> {final.name}")
    # try lossless stream copy first
    rc = run(["ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0",
              "-i", str(lst), "-c", "copy", str(final)], echo_cmd=False)
    if rc == 0 and final.exists():
        return
    say("[worker] stream copy failed, re-encoding join (slower, one-time)")
    # the fallback encodes INTO the chosen container's family - vp9/opus for
    # webm as always; x264/aac otherwise, which is both faster and what the
    # final .mp4 wants anyway (2.215.0)
    enc = (["-c:v", "libvpx-vp9", "-crf", "30", "-b:v", "0", "-c:a", "libopus"]
           if final.suffix == ".webm"
           else ["-c:v", "libx264", "-preset", "veryfast", "-crf", "18",
                 "-pix_fmt", "yuv420p", "-c:a", "aac"])
    rc = run(["ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0",
              "-i", str(lst)] + enc + [str(final)], echo_cmd=False)
    if rc != 0 or not final.exists():
        fail("ffmpeg concat failed")


def main() -> None:
    if len(sys.argv) != 2:
        fail("usage: worker.py <job.json>")
    try:
        job = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as e:
        fail(f"cannot read job file: {e}")

    params, cfg = job["params"], job["config"]
    cfg["sd_cli"] = os.environ.get("SD_CLI", cfg["sd_cli"])  # test override
    cfg["_app_dir"] = job.get("app_dir", str(Path.cwd()))
    engine = os.environ.get("H3_ENGINE") or (cfg.get("engine") or {}).get("backend", "sdcli")
    # 2.110.0: a VIDEO STYLE is a ComfyUI graph + overrides; a job carrying one
    # runs through ComfyUI whatever the engine setting says (sd-cli cannot
    # take a workflow, so silently dropping the style would be worse).
    if isinstance(params.get("video_style"), dict) and engine != "comfy":
        say(f"[worker] video style \"{params['video_style'].get('name')}\" selected -> ComfyUI engine for this job")
        engine = "comfy"
    gpu_cfg = cfg.get("gpu") or {}
    for kv in str(gpu_cfg.get("engine_env") or "").split():
        if "=" in kv:
            k, _, v = kv.partition("=")
            RUN_ENV[k.strip()] = v.strip()
    if gpu_cfg.get("cuda_stability"):
        RUN_ENV.update(STABILITY_ENV)
    output_dir = Path(job["output_dir"])
    output_dir.mkdir(parents=True, exist_ok=True)
    # 2.301.0: where the scene's lossless master goes (projects/<p>/raw)
    raw_dir = Path(job["raw_dir"]) if job.get("raw_dir") else None
    if job.get("h3_fit") and not params.get("h3_fit"):     # 2.380.0: the video docker's ⚙ H3 size
        params["h3_fit"] = job["h3_fit"]
    workdir = Path.cwd()
    models_dir = Path(job.get("models_dir") or Path(job.get("app_dir", ".")) / "models")

    mode = params["mode"]

    if mode == "download":
        repo, rel = params["repo"], params["file_path"]
        models_dir.mkdir(parents=True, exist_ok=True)
        dest = models_dir / Path(rel).name
        if dest.exists() and dest.stat().st_size > 0:
            say(f"[worker] already present: {dest.name} — delete it to re-download.")
            sys.exit(0)
        say(f"[worker] downloading {repo} :: {rel}")
        # Gated/private repos 401 without a token; public ones ignore it.
        hf_token = (params.get("hf_token") or "").strip() or None
        if hf_token:
            say("[worker] using the HuggingFace token from Settings")
        try:
            from huggingface_hub import hf_hub_download
            got = hf_hub_download(repo_id=repo, filename=rel,
                                  local_dir=str(workdir / "hf"), token=hf_token)
            shutil.move(got, dest)
        except ImportError:
            url = f"https://huggingface.co/{repo}/resolve/main/{rel}"
            say(f"[worker] huggingface_hub not installed; streaming {url}")
            tmp = dest.with_suffix(dest.suffix + ".part")
            headers = {"User-Agent": "bitgen-studio"}
            if hf_token:
                headers["Authorization"] = "Bearer " + hf_token
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req) as r, open(tmp, "wb") as f:
                total = int(r.headers.get("Content-Length") or 0)
                done = 0
                last_pct = -5
                while True:
                    buf = r.read(1 << 22)
                    if not buf:
                        break
                    f.write(buf)
                    done += len(buf)
                    if total:
                        pct = int(done * 100 / total)
                        if pct >= last_pct + 2:
                            last_pct = pct
                            say(f"[worker] download {pct}% "
                                f"({done / 1e9:.2f}/{total / 1e9:.2f} GB)")
            tmp.rename(dest)
        say(f"[worker] saved -> {dest}")
        sys.exit(0)

    if mode == "convert":
        # Generate a GGUF quantization (q8_0 = int8, q6_K, ...) from a local
        # source — e.g. the Comfy-Org repo's bf16 / int8_convrot safetensors.
        # Flag names live in Settings → flag names; check `sd-cli --help`.
        require("sd-cli", cfg["sd_cli"])
        src = params["source"]
        require("source model", src)
        out = models_dir / params["out_file"]
        mode_flag = (cfg.get("flags", {}).get("convert_mode") or "--mode convert").split()
        type_flag = cfg.get("flags", {}).get("convert_type") or "--type"
        argv = [cfg["sd_cli"], *mode_flag, "-m", src, "-o", str(out),
                type_flag, params.get("qtype", "q8_0")]
        say("@@CMD " + json.dumps(argv))
        rc = run(argv)
        if rc != 0 or not out.exists():
            d = diagnose_engine_failure()
            if d:
                say(f"[worker] {d}")
            fail("conversion failed — check Settings → flag names against "
                 "`sd-cli --help`, and whether this build can read the source "
                 "format (bf16 safetensors is the safest source; int8_convrot "
                 "is a ComfyUI packing that not every sd.cpp build ingests).")
        say(f"[worker] gguf written -> {out.name}")
        sys.exit(0)

    if mode == "install_llm":
        app_dir = Path(job.get("app_dir", Path.cwd().parent.parent.parent))
        script = app_dir / "misc" / "get-llama.ps1"
        require("installer script", str(script))
        if sys.platform != "win32":
            fail("engine install is Windows-only here; on other systems install llama.cpp manually into llama-cpp/")
        say("[worker] installing llama.cpp engine (this downloads a few hundred MB)...")
        # 2.104.1: pick the CUDA generation the DRIVER supports (nvidia-smi's
        # "CUDA Version: 13.0" line). CUDA 13 builds on a CUDA 12 driver fail
        # at load with "no kernel image"/"driver too old"; 12 is the safe fallback.
        cuda = "13"
        try:
            smi = subprocess.run(["nvidia-smi"], capture_output=True, text=True, timeout=15).stdout
            m = re.search(r"CUDA Version:\s*(\d+)\.(\d+)", smi)
            if m and int(m.group(1)) < 13:
                cuda = "12"
            say(f"[worker] driver CUDA {m.group(1) + '.' + m.group(2) if m else 'unknown'} -> llama.cpp CUDA {cuda} build")
        except Exception:                                            # noqa: BLE001
            say("[worker] nvidia-smi not available - trying the CUDA 13 build")
        rc = run(["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", str(script), "-Cuda", cuda])
        if rc != 0:
            fail(f"installer exited with code {rc}")
        say("[worker] llama.cpp engine installed.")
        sys.exit(0)

    if mode == "install_sdcli":
        app_dir = Path(job.get("app_dir", Path.cwd().parent.parent.parent))
        script = app_dir / "misc" / "get-sd-cli.ps1"
        require("installer script", str(script))
        if sys.platform != "win32":
            fail("sd-cli auto-install is Windows-only here. Manual install: grab "
                 "the win-cuda12-x64 zip AND the cudart zip from "
                 "https://github.com/leejet/stable-diffusion.cpp/releases and "
                 "extract both into sd-cpp/ so sd-cli(.exe) sits directly in it, "
                 "then check the path in Settings.")
        say("[worker] installing sd-cli (stable-diffusion.cpp CUDA build, "
            "~900 MB with the CUDA runtime)...")
        rc = run(["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", str(script)])
        if rc != 0:
            fail(f"installer exited with code {rc} — the full log is above; "
                 "if GitHub was rate-limited, wait a few minutes and retry.")
        say("[worker] sd-cli installed into sd-cpp/.")
        sys.exit(0)

    if mode in ("install_whisper", "install_omnivoice", "install_demucs", "install_viggle", "install_native"):
        # 2.351.0: viggle = Viggle (native) - torch + diffusers' minimax_h3
        # pipeline for our own ComfyUI-free Viggle engine, then its weights
        # 2.269.0: demucs (Meta htdemucs) joins - vocal/instrumental stem
        # separation in its own venv, same contract as the others
        # Build a dedicated venv per tool. They are kept apart on purpose:
        # fish-speech pins torch/transformers versions that routinely conflict
        # with faster-whisper's ctranslate2 stack, and one broken shared venv
        # takes both features down. OmniVoice (2.102.0) pins torch 2.8+ and
        # gets its own too.
        which = mode[len("install_"):]
        if which == "viggle":        # 2.352.0: Viggle (native) runs on the native engine (venvs/native)
            which = "native"
        want_cuda = not str(params.get("device") or "").startswith("cpu")
        # Plain `pip install torch` serves the CPU-ONLY wheel on Windows, which
        # is why a GPU box ends up with "Torch not compiled with CUDA enabled".
        # For a CUDA device, default to a CUDA wheel index.
        # Wheel index by GPU generation. sm_120 (Blackwell: RTX 50-series) has
        # NO kernels in CUDA 12.4 builds — it needs 12.8 — and the failure is
        # "no kernel image is available for execution on the device", NOT a
        # missing-CUDA error, so torch.cuda.is_available() still returns True.
        index = params.get("torch_index") or ""
        if index == "cpu":                 # explicit CPU-only choice from the UI
            index, want_cuda = "", False
            say("[worker] CPU-only torch requested - skipping the CUDA wheels")
        if not index and want_cuda and which in ("omnivoice", "demucs", "native"):
            cap = float(params.get("cuda_capability") or 0)
            index = ("https://download.pytorch.org/whl/cu128" if cap >= 12.0
                     else "https://download.pytorch.org/whl/cu124")
            if which == "omnivoice" and cap < 12.0:
                index = "https://download.pytorch.org/whl/cu126"   # its README pins torch 2.8
            say(f"[worker] GPU compute capability {cap or 'unknown'} -> {index}")
        steps = (5 if index else 4) + (1 if which == "native" and params.get("fetch", True) else 0)
        step = [0]

        def stage(msg):
            step[0] += 1
            say(f"[worker] step {step[0]}/{steps}: {msg}")

        vdir = Path(params["venv"])
        vdir.parent.mkdir(parents=True, exist_ok=True)
        py = sys.executable
        # pip writes progress with \r and buffers when not on a tty, which made
        # a long install look frozen in the job console
        env = dict(os.environ, PYTHONUNBUFFERED="1", PIP_NO_INPUT="1")

        # (2.264.0: the openaudio install branch was removed with the engine)
        stage(f"creating the venv at {vdir}")
        if not vdir.exists():
            if run([py, "-m", "venv", str(vdir)]) != 0:
                fail(f"could not create a venv at {vdir} using {py}. If that python is "
                     "the Microsoft Store stub, install real Python from python.org and "
                     "set it in Settings > Paths.")
        else:
            say("[worker] venv already exists - reusing it")
        vpy = vdir / ("Scripts" if os.name == "nt" else "bin") / ("python.exe" if os.name == "nt" else "python")
        if not vpy.exists():
            fail(f"venv python missing at {vpy} - delete the folder and retry")

        stage("upgrading pip and wheel")
        run([str(vpy), "-m", "pip", "install", "--upgrade", "pip", "wheel",
             "--progress-bar", "off"], env=env)

        if index:
            stage(f"installing torch from {index} (this is the big one)")
            # --index-url REPLACES PyPI, so anything that index does not host
            # cannot resolve. torch/torchaudio live there; torchcodec does not
            # on every CUDA index, and bundling it here made the whole install
            # fail (taking torch with it) on indexes that lack it.
            if run([str(vpy), "-m", "pip", "install", "torch", "torchaudio"]
                   + (["torchvision"] if which == "native" else [])     # 2.352.0: the MiniMax-H3 pipeline's processors
                   + ["--index-url", index, "--progress-bar", "off"], env=env) != 0:
                fail(f"could not install torch from {index}. That index may not carry "
                     "wheels for this Python version - try a different CUDA build in "
                     "Settings > Audio (12.8 is the one 50-series cards need).")
            # torchcodec resolves from PyPI, which picks a build matching torch
            if run([str(vpy), "-m", "pip", "install", "torchcodec",
                    "--progress-bar", "off"], env=env) != 0:
                say("[worker] torchcodec could not be installed - reference-clip "
                    "decoding may fail with 'torch codec is required'")

        if which == "whisper":
            # CTranslate2 (faster-whisper's engine) links cuBLAS and cuDNN at
            # load time but does not depend on them via pip, which is why a
            # "successful" install still dies with
            #   Library cublas64_12.dll is not found or cannot be loaded
            # These wheels ship those DLLs; scripts/asr_local.py then adds
            # site-packages/nvidia/*/bin to the search path. Skipped for a CPU
            # device, where they are ~600 MB of dead weight.
            # 2.600.1: PyAV 19 dropped av.open(metadata_errors=...), which faster-whisper (1.2.1) still passes - the
            # scripts read the audio themselves now (asr_local.load_audio), and the venv keeps a PyAV that has it
            pkgs = ["faster-whisper", "av<19"]
            if not str(params.get("device") or "").startswith("cpu"):
                pkgs += ["nvidia-cublas-cu12", "nvidia-cudnn-cu12"]
        elif which == "omnivoice":
            # the PyPI package is code + the HF loader; the weights come from
            # k2-fsa/OmniVoice on first use (or the model id set in Settings)
            pkgs = [params.get("source") or "omnivoice", "soundfile"]
        elif which == "demucs":
            # 2.269.0: demucs pulls htdemucs weights from its own hub cache on
            # first separate; soundfile writes the stems
            pkgs = ["demucs", "soundfile"]
        elif which == "native":
            # 2.351.0: diffusers PINNED to the commit Viggle-Animate was tested
            # with (its minimax_h3 modular pipeline is newer than any release);
            # through git when there is one, else GitHub's source archive
            commit = str(params.get("diffusers_commit") or "d6726f3")
            pkgs = [(f"diffusers @ git+https://github.com/huggingface/diffusers@{commit}" if shutil.which("git")
                     else f"diffusers @ https://github.com/huggingface/diffusers/archive/{commit}.zip"),
                    "transformers", "accelerate", "peft", "safetensors", "av", "huggingface_hub[hf_xet]", "numpy", "pillow"]
            if not index:
                pkgs += ["torch", "torchvision"]    # a CUDA index installs both with torch above
        else:
            pkgs = ["soundfile"]
        # (2.264.0: the openaudio install branch was removed with the engine)
        stage(f"installing {', '.join(pkgs)} (several minutes, and quiet while it resolves)")
        if run([str(vpy), "-m", "pip", "install", *pkgs, "--progress-bar", "off"], env=env) != 0:
            fail(f"installing {which} failed - read the pip output above; the usual causes "
                 "are no network, a proxy, or a torch version conflict")

        # (2.264.0: the openaudio install branch was removed with the engine)
        # (2.264.0: the openaudio install branch was removed with the engine)
        stage("verifying the import")
        # 2.269.0: the else-arm still imported fish-speech after 2.264 removed
        # it - every OMNIVOICE install "verified" against a package it never
        # installs. Each venv now proves ITS OWN import.
        check = {"whisper": "import faster_whisper, sys; sys.stderr.write(faster_whisper.__name__)",
                 "omnivoice": "import omnivoice; print('omnivoice OK')",
                 "demucs": "import demucs.separate; print('demucs OK')",
                 "native": "from diffusers.modular_pipelines.minimax_h3 import MiniMaxH3VideoReference; "
                           "import torchvision, accelerate, peft, av, torch; print('native engine OK, cuda', torch.cuda.is_available())"}[which]
        if run([str(vpy), "-c", check], env=env) != 0:
            fail(f"{which} installed but its modules do not import - the venv is not "
                 "usable. For fish-speech this usually means a plain pip install was "
                 "used; delete the venv folder and press Install again.")
        if which == "whisper":
            # report the CUDA libraries now rather than at the first transcription
            probe = (str(Path(__file__).resolve().parent.parent / "scripts" / "asr_local.py"))
            r = run([str(vpy), "-c",
                     "import glob,os,sysconfig;"
                     "d=glob.glob(os.path.join(sysconfig.get_paths()['purelib'],'nvidia','*','bin'))"
                     "+glob.glob(os.path.join(sysconfig.get_paths()['purelib'],'nvidia','*','lib'));"
                     "print('CUDALIBS', len(d))"], env=env)
            say("[worker] if transcription later reports a missing cublas/cudnn DLL, "
                "re-run this install, or set Device to cpu in Settings > Audio.")
        comps = [str(c) for c in (params.get("fetch_components") or []) if str(c)]
        if which == "native" and params.get("fetch", True) and comps:
            # 2.352.0: only the official parts still missing (lib/nativeEngine.js decides which -
            # your ComfyUI Viggle files are used when the engine can read them)
            stage(f"downloading {', '.join(comps)} into {params.get('weights_root')} (resumable)")
            fetch = Path(__file__).resolve().parent.parent / "scripts" / "native" / "fetch.py"
            fenv = dict(env)
            if params.get("hf_token"):
                fenv["HF_TOKEN"] = str(params["hf_token"])
            if run([str(vpy), "-u", str(fetch), str(params.get("weights_root") or ""), ",".join(comps)], env=fenv) != 0:
                fail("the native engine download stopped - read the [fetch] lines above; ⤓ Install again resumes it")
        # (2.264.0: the openaudio install branch was removed with the engine)
        say(f"[worker] {which} is installed and importable: {vpy}")
        say(f"[worker] {which} venv ready")
        sys.exit(0)

    if mode == "lyrics":
        # Burn a karaoke ASS subtitle onto a finished video. Kept as its own
        # mode (rather than a flag on export) so lyrics can be added to any
        # existing render without recompiling the timeline.
        if not shutil.which("ffmpeg"):
            fail("burning lyrics needs ffmpeg on PATH (winget install Gyan.FFmpeg).")
        src = Path(params["source"])
        ass = Path(params["ass"])
        if not src.exists():
            fail(f"video not found: {src}")
        if not ass.exists():
            fail(f"subtitle file not found: {ass}")
        # `proj` is assigned inside the export branch further down, so this
        # mode has to read it for itself
        proj = params.get("project", "project")
        n = 1
        while (output_dir / f"{proj}+{n}.webm").exists():
            n += 1
        out_name = f"{proj}+{n}.webm"
        final = output_dir / out_name
        say("@@OUT " + out_name)
        say(f"[worker] burning lyrics from {ass.name} onto {src.name}")
        # ffmpeg's subtitles= filter takes a FILE PATH inside a filter string,
        # where ':' , '\\' and ',' are all separators. On Windows a path like
        # C:\proj\a.ass therefore has to be escaped or the filter fails to parse.
        f = str(ass).replace("\\", "/")
        f = f.replace(":", "\\:").replace("'", "\\'")
        vf = f"subtitles='{f}'"
        rc = run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
                  "-i", str(src), "-vf", vf,
                  "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "30",
                  "-c:a", "copy", str(final)], echo_cmd=False)
        if rc != 0 or not final.exists():
            fail("burning the lyrics failed - see the log above")
        say(f"[worker] lyrics video complete: {out_name}")
        sys.exit(0)

    if mode == "export":
        if not shutil.which("ffmpeg"):
            fail("timeline export needs ffmpeg on PATH (winget install Gyan.FFmpeg).")
        # 2.301.0: a compile from the scenes' LOSSLESS masters is encoded
        # ONCE, near-transparent (params.crf = 14); everything else as before
        export_crf = str(int(params.get("crf") or 20))
        tl = params["timeline"]
        _dl.JOB = sys.argv[1]                       # 2.412.0: ProRes 4444's alpha passes re-run this job
        # 2.412.0: what shows where nothing is drawn (V1's gaps, past its end, a see-through V1) - black, or white for
        # the second alpha pass (scripts/deliver.py alpha_passes)
        bgc = "white" if params.get("bg") == "white" else "black"
        # 2.406.0: speed / reverse / ramps, the colour grade + LUT and the sound clean-up are rendered FIRST; the clips
        # then point at those files (in 0, out = their timeline length) and everything below treats them as plain clips
        for v in tl["video"]:
            require("video clip", v["path"])
        try:
            _nfx = _cfx.prepare(tl, Path.cwd(), say, run)
        except RuntimeError as e:
            fail(str(e))
        if _nfx:
            say(f"[worker] {_nfx} clip(s) rendered with their speed / colour / sound fx")
        # 2.572.0: ✨ Auto transition - a clip with a tail stays under the next one for its transition (nothing moves)
        try:
            _ntl = _ctail.prepare(tl, Path.cwd(), say, run)
        except Exception as e:                      # noqa: BLE001
            _ntl = 0
            say(f"[worker] transition tails skipped: {e}")
        if _ntl:
            say(f"[worker] {_ntl} clip(s) held under the next one for its transition")
        vids = tl["video"]
        caps = tl.get("captions") or {}
        caps_on = bool(caps.get("burn") and _caps.cues(caps))
        # a .srt sidecar is written only by the full pass below, so it (like a burn or the mix) skips the fast paths
        post = caps_on or bool(caps.get("srt") and _caps.cues(caps)) or _mixfx.active(tl.get("mix")) \
            or _mixfx.panned(tl)                       # 2.415.0: 🎚 a panned track / the master fader
        # A track is {clips, transition_in, transition_out} from 2.60.0 on, and
        # a bare list of clips in anything older. mark_track() flattens either
        # shape and stamps the layer's transitions onto the FIRST and LAST clip
        # of the track, because that is where the layer enters and leaves.
        def mark_track(track):
            cl = track if isinstance(track, list) else (track.get("clips") or [])
            if not isinstance(track, list) and cl:
                cl = [dict(c) for c in cl]
                order = sorted(range(len(cl)), key=lambda i: float(cl[i].get("start") or 0))
                cl[order[0]]["fade_in"] = track.get("transition_in")
                cl[order[-1]]["fade_out"] = track.get("transition_out")
            return cl

        clips = [c for track in tl.get("audio", []) for c in mark_track(track)]
        for c in clips:
            require("audio clip", c["path"])
        imgs = [c for track in tl.get("images", []) for c in mark_track(track)]
        for c in imgs:
            require("image", c["baked"] if c.get("baked") else c["path"])   # 2.492.0: a baked shape has no picture of its own
        # V2+ video layers: each clip is overlaid on the base track at its own
        # start time, with its own opacity, and its audio joins the mix unless
        # the layer is muted
        vlayers = tl.get("video_layers") or []
        overlays = []
        for zi, L in enumerate(vlayers):
            made = []
            for c in L.get("clips", []):
                require("video layer clip", c["path"])
                made.append(dict(c, muted=bool(L.get("muted")),
                                 lvol=float(L.get("volume", 1) or 0),
                                 lpan=float(L.get("pan") or 0),          # 2.415.0: 🎚 the layer's pan
                                 lopacity=float(L.get("opacity", 1) or 0),
                                 z=zi))
            # the layer's transitions belong to where the LAYER enters and
            # leaves, i.e. its earliest and latest clip — not to every clip
            if made:
                order = sorted(range(len(made)), key=lambda i: float(made[i].get("start") or 0))
                made[order[0]]["fade_in"] = L.get("transition_in")
                made[order[-1]]["fade_out"] = L.get("transition_out")
            overlays.extend(made)
        # Stacking order is the LAYER order, not the clip start time. Sorting by
        # start meant a clip that began earlier always drew underneath one that
        # began later, so the timeline's own z-order was ignored; ties keep the
        # earlier start first purely for a stable, predictable filter chain.
        overlays.sort(key=lambda c: (c["z"], float(c.get("start") or 0)))

        proj = params.get("project", "project")
        # A compile is THE project's movie: one deterministic file in the
        # project root, REPLACED on each compile, rather than a numbered render
        # in final/. output_dir is the project root for mode=export (lib/core.js).
        out_name = f"{safe_stem(proj)}.mp4"
        if params.get("out_name"):                  # 2.412.0: an alpha pass writes beside the master, not over it
            out_name = Path(str(params["out_name"])).name
        final = output_dir / out_name
        if not params.get("bg"):
            say("@@OUT " + out_name)
        say(f"[worker] compiling every visible layer -> {final}")
        say(f"[worker] timeline export: {len(vids)} video, {len(overlays)} overlay-layer, "
            f"{len(clips)} audio, {len(imgs)} image clip(s)")
        # The composite plan, bottom-up. The full ffmpeg command is not echoed
        # for exports, so without this there is no way to tell from a job log
        # which layer ended up on top or what opacity/volume was applied.
        v1vol_l = float(tl.get("video_volume", 1) or 0)
        say(f"[worker] composite z0 base: opacity={float(tl.get('video_opacity', 1) or 0):.3f} "
            f"volume={v1vol_l:.3f} muted={bool(tl.get('video_muted', False))}")
        for zi, L in enumerate(vlayers):
            say(f"[worker] composite z{zi + 1} '{L.get('name') or ('V' + str(zi + 2))}': "
                f"opacity={float(L.get('opacity', 1) or 0):.3f} "
                f"volume={float(L.get('volume', 1) or 0):.3f} "
                f"muted={bool(L.get('muted'))} clips={len(L.get('clips', []))}")
        if overlays:
            say("[worker] overlay draw order (back to front): "
                + ", ".join(f"z{c['z'] + 1}@{float(c.get('start') or 0):.2f}s" for c in overlays))

        # 1) cut trimmed clips (re-encode for frame accuracy), pass untrimmed through
        cut = []
        for i, v in enumerate(vids, start=1):
            vin = float(v.get("in") or 0)
            vout = v.get("out")
            vop = float(v.get("opacity", 1))
            trimmed = vin > 0.01 or vout
            if not trimmed and vop >= 0.995:
                cut.append(Path(v["path"]))
                continue
            seg = Path.cwd() / f"cut_{i:02d}.webm"
            say(f"[worker] processing clip {i}: {vin:.2f}s -> {vout or 'end'}"
                + (f", opacity {vop:.0%}" if vop < 0.995 else ""))
            a = ["ffmpeg", "-y", "-loglevel", "error", "-ss", str(vin)]
            if vout:
                a += ["-to", str(vout)]
            a += ["-i", v["path"]]
            if vop < 0.995:
                a += ["-f", "lavfi", "-i", f"color={bgc}",
                      "-filter_complex",
                      f"[1:v][0:v]scale2ref[bg][fg0];"
                      f"[fg0]format=rgba,colorchannelmixer=aa={vop:.3f}[fg];"
                      f"[bg][fg]overlay=shortest=1[v]",
                      "-map", "[v]", "-map", "0:a?"]
            a += ["-c:v", "libvpx-vp9", "-crf", "30", "-b:v", "0",
                  "-c:a", "libopus", str(seg)]
            if run(a, echo_cmd=False) != 0 or not seg.exists():
                fail(f"processing of clip {i} failed")
            cut.append(seg)

        # 2.407.0: an untrimmed clip passes through as its own file - but when a trimmed one became a vp9 webm segment
        # and the untrimmed one is an h264 mp4, the join mixed codecs and the concat came out minutes long. One codec
        # family for the whole set: the passed-through ones are cut too when the set would be mixed.
        if len({joined_container(p) for p in cut}) > 1:
            for i, v in enumerate(vids, start=1):
                if cut[i - 1] != Path(v["path"]):
                    continue
                seg = Path.cwd() / f"cut_{i:02d}.webm"
                say(f"[worker] processing clip {i}: whole clip (the join needs one codec)")
                if run(["ffmpeg", "-y", "-loglevel", "error", "-i", v["path"], "-c:v", "libvpx-vp9", "-crf", "30", "-b:v", "0",
                        "-c:a", "libopus", str(seg)], echo_cmd=False) != 0 or not seg.exists():
                    fail(f"processing of clip {i} failed")
                cut[i - 1] = seg

        # gaps between positioned clips -> black filler segments
        def probe_wh(p):
            r = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0",
                                "-show_entries", "stream=width,height",
                                "-of", "csv=p=0", str(p)],
                               capture_output=True, text=True)
            try:
                ww, hh = r.stdout.strip().split(",")
                return int(ww), int(hh)
            except ValueError:
                fail(f"cannot probe dimensions of {p}")

        starts = [float(v.get("start") or 0) for v in vids]
        ordered = sorted(range(len(cut)), key=lambda i: starts[i])
        # 2.215.0: the join container is decided ONCE, from the first real
        # clip, and the black gap fillers are cut in the SAME codec family -
        # a vp9 filler between h264 takes would make the segment set mixed
        # and hand the whole join back to the re-encode fallback.
        join_suffix = joined_container(cut[ordered[0]])
        seq, cursor = [], 0.0
        Wpx = Hpx = None
        for gi, oi in enumerate(ordered):
            st = max(starts[oi], cursor)
            gap = st - cursor
            if gap > 0.05:
                if Wpx is None:
                    Wpx, Hpx = probe_wh(cut[ordered[0]])
                filler = Path.cwd() / f"gap_{gi:02d}{join_suffix}"
                say(f"[worker] inserting {gap:.2f}s {bgc} gap")
                genc = (["-c:v", "libvpx-vp9", "-crf", "40", "-b:v", "0",
                         "-c:a", "libopus"] if join_suffix == ".webm"
                        else ["-c:v", "libx264", "-preset", "veryfast",
                              "-crf", "28", "-pix_fmt", "yuv420p", "-c:a", "aac"])
                rc = run(["ffmpeg", "-y", "-loglevel", "error",
                          "-f", "lavfi", "-i", f"color={bgc}:s={Wpx}x{Hpx}:r=24:d={gap:.3f}",
                          "-f", "lavfi", "-t", f"{gap:.3f}",
                          "-i", "anullsrc=channel_layout=stereo:sample_rate=48000"]
                         + genc + ["-shortest", str(filler)], echo_cmd=False)
                if rc != 0 or not filler.exists():
                    fail("gap filler failed")
                seq.append(filler)
                cursor += gap
            seg = cut[oi]
            if Wpx is None:
                Wpx, Hpx = probe_wh(seg)
            seq.append(seg)
            vv = vids[oi]
            cursor += max(0.1, (float(vv.get("out") or vv.get("dur") or 0) or 1e9) - float(vv.get("in") or 0)) \
                      if vv.get("out") else cursor * 0
            # recompute precisely from probe if trims unknown
            if not vv.get("out"):
                r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                                    "-of", "csv=p=0", str(seg)], capture_output=True, text=True)
                cursor = st + (float(r.stdout.strip() or 0) or 5)
            else:
                cursor = st + (float(vv["out"]) - float(vv.get("in") or 0))

        # 2.215.0: the intermediate's NAME matches its BYTES - one segment
        # keeps its own container (a pure byte copy), several join into
        # whatever their codecs can STREAM-COPY into (joined_container).
        if len(seq) == 1:
            allv = Path.cwd() / ("allv" + (Path(seq[0]).suffix or ".mkv"))
            shutil.copyfile(seq[0], allv)
        else:
            allv = Path.cwd() / ("allv" + join_suffix)
            if join_suffix != ".webm":
                say(f"[worker] joining into {allv.name} - the segments' codecs "
                    "stream-copy there, so the lossless join can actually mux")
            # the OUT transition is the join between adjacent clips: it is how
            # the outgoing clip leaves. video_transition is the 2.57.0 key,
            # still read so an older payload keeps working.
            join_v1(seq, tl.get("video_transition_out") or tl.get("video_transition"), allv)

        # V1's own IN and OUT boundary fades: how the base track opens and
        # closes. Done as its own pass right after the join so that everything
        # downstream — including the "no overlays, just copy" fast path below —
        # sees an already-faded track and cannot skip them.
        allv = fade_v1(allv, tl)
        allv = _fit_frame(allv, tl.get("frame"), run, say)      # 2.513.0: the timeline's own frame size (V1 fitted in)

        # ---- how long the finished movie has to be ----------------------
        # The base track is now final, so measure it and compare against the
        # end of the LAST clip on ANY layer. Anything the upper layers need
        # beyond the base is made up with black + silence in the composite
        # pass below; before 2.63.0 the compile simply stopped here.
        base_dur = seg_duration(allv)
        span = compile_span(tl, base_dur)
        pad = _span.pad_needed(span, base_dur) if _span else 0.0

        # V1 volume is part of the audio mix, so a turned-down base track must
        # not take the "nothing to do, just copy" fast path
        v1vol = float(tl.get("video_volume", 1) or 0)
        v1quiet = abs(v1vol - 1) > 1e-3
        # pad > 0 disqualifies BOTH fast paths: they transcode allv straight to
        # the final file, so a timeline that outlasts the video track would be
        # cut short again the moment nothing needed compositing.
        if (not clips and not imgs and not overlays and not v1quiet and not post
                and pad <= 0 and not tl.get("video_muted", False)):
            # 2.215.0: when the joined track ALREADY carries mp4-legal codecs
            # (h264 + aac or no audio - exactly what a stream-copied join of
            # ComfyUI takes holds), the export is a lossless REMUX: -c copy
            # keeps the very bytes the renders produced, in seconds. A webm/
            # VP9 track (or anything else) still transcodes, because an .mp4
            # must carry H.264/AAC to play everywhere - a webm wearing an
            # .mp4 extension is never acceptable.
            _v, _a = _stream_codec(allv, "v"), _stream_codec(allv, "a")
            if _v == "h264" and _a in ("aac", ""):
                rc = run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(allv),
                          "-c", "copy", "-movflags", "+faststart", str(final)],
                         echo_cmd=False)
                if rc == 0 and final.exists():
                    _dl.finish(final, tl, say, run)          # 2.407.0
                    say(f"[worker] no overlay layers; losslessly remuxed the video track as {out_name}")
                    sys.exit(0)
                say("[worker] lossless remux refused - transcoding instead")
            rc = run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(allv)]
                     + mp4_args(audio=True, crf=export_crf) + [str(final)], echo_cmd=False)
            if rc != 0 or not final.exists():
                fail("export transcode failed")
            _dl.finish(final, tl, say, run)          # 2.407.0
            say(f"[worker] no overlay layers; exported the video track as {out_name}")
            sys.exit(0)
        if (not clips and not imgs and not overlays and pad <= 0 and not post
                and tl.get("video_muted", False)):
            say("[worker] muting video track audio")
            # 2.215.0: same remux rule for the muted path - h264 video copies,
            # -an drops the audio without touching a single video byte
            if _stream_codec(allv, "v") == "h264":
                rc = run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(allv),
                          "-c:v", "copy", "-an", "-movflags", "+faststart",
                          str(final)], echo_cmd=False)
                if rc == 0 and final.exists():
                    _dl.finish(final, tl, say, run)          # 2.407.0: the deliverables, made from the master
                    say(f"[worker] timeline export complete: {out_name}")
                    sys.exit(0)
                say("[worker] lossless remux refused - transcoding instead")
            rc = run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(allv)]
                     + mp4_args(audio=False, crf=export_crf) + ["-an", str(final)], echo_cmd=False)
            if rc != 0 or not final.exists():
                fail("mute pass failed")
            _dl.finish(final, tl, say, run)          # 2.407.0: the deliverables, made from the master
            say(f"[worker] timeline export complete: {out_name}")
            sys.exit(0)

        # 2) single ffmpeg pass: image overlays + audio mix
        # keep is ANDed with has_audio because every [0:a] reference below
        # would otherwise fail the whole pass on a silent base video with
        # "Cannot find a matching stream" — the same trap fade_v1 guards.
        keep = (tl.get("keep_original_audio", True)
                and not tl.get("video_muted", False) and has_audio(allv))
        args = ["ffmpeg", "-y", "-loglevel", "error", "-i", str(allv)]
        for c in overlays:                      # video layers, trimmed on input
            oin = float(c.get("in") or 0)
            ex = ["-ss", str(oin)]
            if c.get("out"):
                ex += ["-t", str(max(0.05, float(c["out"]) - oin))]
            if has_alpha(c["path"]):          # 2.373.0: keep the karaoke overlay see-through
                ex += ["-c:v", "libvpx-vp9" if _stream_codec(c["path"], "v") == "vp9" else "libvpx"]
                say(f"[worker] {Path(c['path']).name}: transparent overlay (alpha read through libvpx)")
            args += ex + ["-i", c["path"]]
        # 2.379.0: the frame size the canvas worked in (the keyframed transforms are placed on it)
        fw, fh = _video_wh(allv)
        for c in imgs:
            # A still is ONE frame with one timestamp, so a time-based fade has
            # nothing to ramp over. When this image layer has a transition, loop
            # the still into a real stream of the layer's length first; without
            # one, the plain single-frame input is left exactly as it was.
            # 2.379.0: a KEYFRAMED still (◆ tweens) loops too, at KF_FPS - the tween needs its frames; a text layer
            # whose colour is keyframed reads its white-fill twin (tinted per frame below)
            if c.get("baked") and Path(c["baked"]).exists():
                # 2.490.0: a layer the page baked (a parented layer - lib/layerBake.js): its own transparent video
                c["_anim"] = False
                c["_tint"] = False
                args += ["-c:v", "libvpx-vp9", "-i", c["baked"]]
                continue
            c.pop("baked", None)
            c["_anim"] = bool(c.get("kf"))
            c["_tint"] = bool(c.get("tint") and _kf_has(c.get("kf"), "color") and Path(c["tint"]).exists())
            if c.get("tint") and _kf_has(c.get("kf"), "color") and not c["_tint"]:
                say(f"[worker] {Path(c['path']).name}: its keyframed colour has no white twin on disk - "
                    "the text compiles in its static colour (edit the text once to save it)")
            if c["_anim"]:
                args += ["-loop", "1", "-framerate", str(KF_FPS), "-t", f"{max(0.1, float(c['len'])):.3f}"]
            elif _fade_any(c):
                args += ["-loop", "1", "-t", f"{max(0.1, float(c['len'])):.3f}"]
            pic = c["tint"] if c["_tint"] else c["path"]
            if str(pic).lower().endswith(".jxl"):        # 2.479.0: ffmpeg may not read JPEG XL - its PNG (scripts/jxl_png.py)
                import jxl_png
                pic = jxl_png.png_for(pic)
            args += ["-i", pic]
        for c in clips:
            aud_in = float(c.get("in") or 0)
            a_extra = ["-ss", str(aud_in)]
            if c.get("out"):
                a_extra += ["-t", str(max(0.05, float(c["out"]) - aud_in))]
            args += a_extra + ["-i", c["path"]]
        # 2.498.0: a video layer's ✒ masks - the grey mask video the page made (tlmask.js), after every other input
        mask_in, nxt_in = {}, 1 + len(overlays) + len(imgs) + len(clips)
        for i, c in enumerate(overlays, start=1):
            mv = c.get("maskv")
            if c.get("vbaked") and Path(c["vbaked"]).exists():
                continue                                   # 2.506.0: baked whole - its masks are in the frames
            if mv and Path(mv).exists():
                args += ["-i", mv]
                mask_in[i] = nxt_in
                nxt_in += 1
        # 2.505.0: a video layer's 〰 distortion - the two grey map videos (across, up-down) the page made (tldist.js)
        dmap_in = {}
        for i, c in enumerate(overlays, start=1):
            mx_, my_ = c.get("dmapx"), c.get("dmapy")
            if c.get("vbaked") and Path(c["vbaked"]).exists():
                continue
            if mx_ and my_ and Path(mx_).exists() and Path(my_).exists():
                args += ["-i", mx_, "-i", my_]
                dmap_in[i] = (nxt_in, nxt_in + 1)
                nxt_in += 2
        # 2.506.0: a video layer the page baked WHOLE (tlvbake.js - ☀ rays, warps, 3D ...): its frames, already placed
        vb_in = {}
        for i, c in enumerate(overlays, start=1):
            vb = c.get("vbaked")
            if vb and Path(vb).exists():
                args += ["-c:v", "libvpx-vp9", "-i", vb]
                vb_in[i] = nxt_in
                nxt_in += 1

        parts = []
        # THE FIX: extend the base track to the end of the timeline before
        # anything is drawn on it. `overlay` produces as many frames as its
        # MAIN input, so without this every upper layer is cut off at the last
        # frame of V1 — which is exactly the "compile stops at the end of the
        # first video layer" report. tpad appends solid black; apad appends
        # silence so the mix has something to sit on for the same stretch.
        vbase, abase = "0:v", "0:a"
        if pad > 0:
            say(f"[worker] timeline runs {span:.2f}s but the video track is only "
                f"{base_dur:.2f}s - padding it with {pad:.2f}s of black so the "
                f"upper layers play out")
            parts.append(f"[0:v]tpad=stop_mode=add:color={bgc}:"
                         f"stop_duration={pad:.3f}[vbase]")
            vbase = "vbase"
            if keep:
                parts.append(f"[0:a]apad=pad_dur={pad:.3f}[abase]")
                abase = "abase"
        else:
            say(f"[worker] timeline length {span:.2f}s matches the video track")
        vprev = vbase
        ops = []                                       # 2.491.0: every layer clip's composite, in order
        for i, c in enumerate(overlays, start=1):      # layer clips first
            op = float(c.get("opacity", 1)) * float(c.get("lopacity", 1))
            s0 = float(c.get("start") or 0)
            dur = (float(c["out"]) - float(c.get("in") or 0)) if c.get("out") else None
            s1 = s0 + dur if dur else 1e6
            # An overlay has nothing behind it to dip through, so its boundary
            # transitions ramp ALPHA. setpts has already shifted this stream
            # onto the timeline, so the fade's st= is an absolute second.
            # 2.415.0: a wipe / slide / iris ... is drawn as its shape (the clip against a see-through copy of itself);
            # a dissolve stays the alpha ramp
            if i in vb_in:
                # 2.506.0: the page's frames of the whole clip (its move, masks, distortion, rays ...), placed in the picture:
                # overlaid as they are while the clip is on - its sound still comes from the clip's file ([i:a])
                vfade = "".join("," + f for f in (_fade(c.get("fade_in"), "in", s0, dur, alpha=True),
                                                   _fade(c.get("fade_out"), "out", s1, dur, alpha=True)) if f)
                parts.append(f"[{vb_in[i]}:v]setpts=PTS-STARTPTS+{s0:.3f}/TB,format=rgba{vfade}[ov{i}]")
                ops.append({"src": f"ov{i}", "x": "(main_w-overlay_w)/2", "y": "(main_h-overlay_h)/2",
                            "en": f"between(t,{s0:.3f},{s1:.3f})", "c": c, "i": i, "eof": True})
                say(f"[worker] {Path(c['path']).name}: baked whole by the page ({Path(c['vbaked']).name})")
                continue
            src_v = f"[{i}:v]"
            if i in dmap_in:
                # 2.505.0: 〰 every pixel moved by its map (128 = still, whole pixels, the edges smeared) - planar RGB so
                # each plane moves alike (a grey map has no chroma to steer chroma planes)
                xi, yi = dmap_in[i]
                parts.append(f"[{i}:v]setpts=PTS-STARTPTS,format=gbrp[dsb{i}]")
                parts.append(f"[{xi}:v]setpts=PTS-STARTPTS,format=gbrp[dsx{i}]")
                parts.append(f"[{yi}:v]setpts=PTS-STARTPTS,format=gbrp[dsy{i}]")
                parts.append(f"[dsx{i}][dsb{i}]scale2ref[dsx2{i}][dsb2{i}]")
                parts.append(f"[dsy{i}][dsb2{i}]scale2ref[dsy2{i}][dsb3{i}]")
                parts.append(f"[dsb3{i}][dsx2{i}][dsy2{i}]displace=edge=smear,format=rgba[dsd{i}]")
                src_v = f"[dsd{i}]"
                say(f"[worker] {Path(c['path']).name}: its distortion (the maps {Path(c['dmapx']).name} / {Path(c['dmapy']).name})")
            if i in mask_in:
                # 2.498.0: ✒ the masks as the clip's alpha (the mask video sized to the clip; one frame = it holds)
                m = mask_in[i]
                parts.append(f"[{m}:v]format=gray,setpts=PTS-STARTPTS[mq{i}]")
                parts.append(f"{src_v}setpts=PTS-STARTPTS,format=rgba[mb{i}]")
                parts.append(f"[mq{i}][mb{i}]scale2ref[mr{i}][mc{i}]")
                parts.append(f"[mc{i}][mr{i}]alphamerge[mm{i}]")
                src_v = f"[mm{i}]"
                say(f"[worker] {Path(c['path']).name}: its masks (the mask video {Path(c['maskv']).name})")
            sin, sout = _shape(parts, src_v, f"[shp{i}]", c.get("fade_in"), c.get("fade_out"), dur, f"bo{i}", say)
            vin = f"[shp{i}]" if (sin or sout) else src_v
            ofade = "".join("," + f for f in (
                "" if sin else _fade(c.get("fade_in"), "in", s0, dur, alpha=True),
                "" if sout else _fade(c.get("fade_out"), "out", s1, dur, alpha=True)) if f)
            tfv, tx, ty = _tf_chain(c.get("tf"))       # 2.377.0: the canvas's position / scale / rotation
            kf = c.get("kf")
            pin = c.get("pin") if isinstance(c.get("pin"), list) and c.get("pin") else None
            if pin:
                # 2.499.0: ▢ a CORNER PIN (ext/timelinedock/tltrack.js) - the clip stretched over the frame (a 2 px clear
                # border), its corners moved to the pinned ones each frame (perspective; the corners keyed, in frame px)
                tv = f"((in-1)/{KF_FPS})"
                P = {k: _kf_expr(pin, k, float(pin[0][k]), tv) for k in ("p0x", "p0y", "p1x", "p1y", "p2x", "p2y", "p3x", "p3y")}
                corners = ":".join(f"x{n}='{P[f'p{n}x']}':y{n}='{P[f'p{n}y']}'" for n in range(4))
                lop = float(c.get("lopacity", 1))
                mix = (_kf_cmd(kf, f"kf{i}", dur, float(c.get("opacity", 1)), lop, None, Path.cwd() / f"kf{i}.cmd")
                       if kf and _kf_has(kf, "op") else f"colorchannelmixer=aa={op:.3f}")
                parts.append(f"{vin}setpts=PTS-STARTPTS,fps={KF_FPS},format=rgba,scale={max(2, int(fw) - 4)}:{max(2, int(fh) - 4)},"
                             f"pad={int(fw)}:{int(fh)}:2:2:color=black@0,perspective={corners}:sense=destination:eval=frame,"
                             f"{mix},setpts=PTS+{s0:.3f}/TB{ofade}[ov{i}]")
                ops.append({"src": f"ov{i}", "x": "0", "y": "0", "en": f"between(t,{s0:.3f},{s1:.3f})", "c": c, "i": i, "eof": True})
                say(f"[worker] {Path(c['path']).name}: corner-pinned ({len(pin)} key(s))")
                continue
            if kf:
                # 2.379.0: ◆ keyframes - opacity per frame (sendcmd), position / scale / rotation per frame
                # (perspective on a transparent canvas); the clip's own frame count drives both (fps = KF_FPS)
                lop = float(c.get("lopacity", 1))
                mix = _kf_cmd(kf, f"kf{i}", dur, float(c.get("opacity", 1)) if _kf_has(kf, "op") else op,
                              lop, None, Path.cwd() / f"kf{i}.cmd")
                moves = _kf_moves(kf)
                # 2.500.0: ⏱ TIME on the layer (ext/timelinedock/tltime.js): motion blur = the move sampled N times a
                # frame, the last K (the shutter) averaged (premultiplied, like the canvas); Posterize Time = the
                # picture and the move held at <post> a second; Echo = copies of it from earlier, back to front
                tm = c.get("tm") if isinstance(c.get("tm"), dict) else {}
                post = float(tm.get("post") or 0)
                nsamp = max(2, min(16, int(tm.get("samples") or 8))) if (tm.get("blur") and moves) else 1
                rate = KF_FPS * nsamp
                kblur = max(2, round(nsamp * max(1.0, min(720.0, float(tm.get("shutter") or 180))) / 360.0)) if nsamp > 1 else 1
                tvx = f"((in-1)/{rate})"
                if post > 0:
                    tvx = f"(floor({tvx}*{post:.4f}+0.000001)/{post:.4f})"
                geo = ("," + _kf_perspective(kf, c.get("tf"), fw, fh, tvx)) if moves else ""
                if moves:
                    tx = ty = ""
                pq = f"setpts='floor(T*{post:.4f}+0.000001)/{post:.4f}/TB'," if post > 0 else ""
                blur = f",premultiply=inplace=1,tmix=frames={min(kblur, nsamp)},unpremultiply=inplace=1" if nsamp > 1 else ""
                echo = tm.get("echo") if isinstance(tm.get("echo"), dict) and moves else None
                tail = f"[ov{i}]" if not echo else f"[eb{i}]"
                parts.append(f"{vin}setpts=PTS-STARTPTS,{pq}fps={rate},format=rgba,{'' if moves else tfv}{mix},"
                             f"setpts=PTS+{s0:.3f}/TB{ofade}{geo}{blur}{tail}")
                if echo:
                    n_e = max(1, min(8, int(echo.get("n") or 3)))
                    dt_e, i0_e, dec_e = max(1.0 / KF_FPS, float(echo.get("dt") or 0.1)), max(0.0, min(1.0, float(echo.get("i0") or 0.6))), max(0.0, min(1.0, float(echo.get("decay") or 0.6)))
                    parts.append(f"[eb{i}]split={n_e + 2}" + "".join(f"[ee{i}_{k}]" for k in range(n_e + 2)))
                    parts.append(f"[ee{i}_0]colorchannelmixer=aa=0[ez{i}]")          # a clear canvas the clip's size + length
                    cur = f"ez{i}"
                    for k in range(n_e, 0, -1):
                        w_e = i0_e * dec_e ** (k - 1)
                        parts.append(f"[ee{i}_{k}]setpts=PTS+{k * dt_e:.4f}/TB,colorchannelmixer=aa={w_e:.4f}[ed{i}_{k}]")
                        parts.append(f"[{cur}][ed{i}_{k}]overlay=eof_action=pass:format=rgb[ec{i}_{k}]")
                        cur = f"ec{i}_{k}"
                    parts.append(f"[{cur}][ee{i}_{n_e + 1}]overlay=format=rgb,format=rgba[ov{i}]")
                    say(f"[worker] {Path(c['path']).name}: echo ({n_e} copies, {dt_e:.2f} s apart)")
                if nsamp > 1:
                    say(f"[worker] {Path(c['path']).name}: motion blur ({kblur} of {nsamp} samples a frame)")
                if post > 0:
                    say(f"[worker] {Path(c['path']).name}: posterize time ({post:g} a second)")
                say(f"[worker] {Path(c['path']).name}: {len(kf)} keyframe(s) tweened"
                    + (" (position / scale / rotation)" if moves else "") + (" (opacity)" if _kf_has(kf, "op") else ""))
            else:
                tm0 = c.get("tm") if isinstance(c.get("tm"), dict) else {}
                post0 = float(tm0.get("post") or 0)
                pq0 = f"fps={KF_FPS},setpts='floor(T*{post0:.4f}+0.000001)/{post0:.4f}/TB',fps={KF_FPS}," if post0 > 0 else ""   # 2.500.0: posterize time
                parts.append(f"{vin}setpts=PTS-STARTPTS,{pq0}setpts=PTS-STARTPTS+{s0:.3f}/TB,format=rgba,{tfv}"
                             f"colorchannelmixer=aa={op:.3f}{ofade}[ov{i}]")
            # 2.491.0: composited later, in order (_composite_ops: blend modes + track mattes)
            ops.append({"src": f"ov{i}", "x": f"(main_w-overlay_w)/2{tx}", "y": f"(main_h-overlay_h)/2{ty}",
                        "en": f"between(t,{s0:.3f},{s1:.3f})", "c": c, "i": i, "eof": True})
        for i, c in enumerate(imgs, start=1 + len(overlays)):
            op = float(c.get("opacity", 1))
            s0 = float(c["start"])
            s1 = s0 + float(c["len"])
            if c.get("adjust") is not None:
                # 2.409.0: an ADJUSTMENT LAYER - its grade (the baked LUT) + effects on everything composited so far,
                # only while it is on the timeline (each filter's enable=); its placeholder picture is never drawn
                adj = c.get("adjust") or {}
                lut = _cfx._fx_path(adj["lut_file"]) if adj.get("lut_file") else None
                if lut or _vfx.any_vfx(adj.get("vfx")):
                    def _adj_op(vp, i=i, adj=adj, lut=lut, s0=s0, s1=s1):
                        an = _vfx.build(parts, f"[{vp}]", f"[v{i}]", adj.get("vfx") or {}, fw, fh,
                                        enable=f"between(t,{s0:.3f},{s1:.3f})", tag=f"adj{i}", clip=False, lut=lut,
                                        t0=s0, dur=s1 - s0, fps=FPS,   # 2.412.0: its effect keyframes count from its start
                                        mask=adj.get("mask"))          # 2.416.0: its mask (in the frame; a track from its start)
                        say(f"[worker] adjustment layer {s0:.2f}-{s1:.2f}s: " + ", ".join((["graded"] if lut else []) + an))
                        return f"v{i}"
                    ops.append({"fn": _adj_op})
                else:
                    say(f"[worker] adjustment layer {s0:.2f}-{s1:.2f}s: nothing set - skipped")
                continue
            # a looped still starts at PTS 0; shift it onto the timeline so the
            # fade's absolute st= means the same second the overlay is enabled
            shift = f"setpts=PTS-STARTPTS+{s0:.3f}/TB," if _fade_any(c) else ""
            # 2.415.0: a picture layer's wipe / slide / iris ... drawn as its shape (it is looped into a stream already)
            iin, iout = _shape(parts, f"[{i}:v]", f"[ishp{i}]", c.get("fade_in"), c.get("fade_out"), float(c["len"]), f"bi{i}", say) \
                if _fade_any(c) and not c.get("_anim") else (False, False)
            ifade = "".join("," + f for f in (
                "" if iin else _fade(c.get("fade_in"), "in", s0, float(c["len"]), alpha=True),
                "" if iout else _fade(c.get("fade_out"), "out", s1, float(c["len"]), alpha=True)) if f)
            if c.get("baked"):
                # 2.490.0: the page's frames, already placed in the picture: overlaid as they are, while the clip is on
                bsrc = f"[ishp{i}]" if (iin or iout) else f"[{i}:v]"
                parts.append(f"{bsrc}setpts=PTS-STARTPTS+{s0:.3f}/TB,format=rgba{ifade}[im{i}]")
                ops.append({"src": f"im{i}", "x": "(main_w-overlay_w)/2", "y": "(main_h-overlay_h)/2",
                            "en": f"between(t,{s0:.3f},{s1:.3f})", "c": c, "i": i, "eof": True})
                say(f"[worker] {Path(c['baked']).name}: a baked layer (it follows its parent)")
                continue
            tfi, tx, ty = _tf_chain(c.get("tf"))       # 2.377.0: an image / text layer placed on the canvas
            # 2.379.0: plain `scale` to the frame's width (never wider), the picture's OWN aspect kept. scale2ref's
            # h=-1 kept the REFERENCE's aspect instead (ffmpeg's scale2ref semantics): every picture / text layer
            # compiled squashed or stretched to the frame's 16:9 - a square logo came out 16:9-flat.
            isrc = f"[ishp{i}]" if (iin or iout) else f"[{i}:v]"      # 2.415.0: its boundary shape drawn first
            parts.append(f"{isrc}scale=w='min(iw,{fw})':h=-1[img{i}]")
            kf = c.get("kf") if c.get("_anim") else None
            if kf:
                # 2.379.0: ◆ keyframes (see the video layers above); a keyed TEXT colour tints the white twin
                lop = float(c.get("lopacity", 1))
                tint0 = None
                if c.get("_tint"):
                    tint0 = _kf_value(kf, 0, "color", "#ffffff")
                mix = _kf_cmd(kf, f"kf{i}", float(c["len"]), (op / max(1e-6, lop)) if _kf_has(kf, "op") else op,
                              lop, tint0, Path.cwd() / f"kf{i}.cmd")
                moves = _kf_moves(kf)
                geo = ("," + _kf_perspective(kf, c.get("tf"), fw, fh)) if moves else ""
                if moves:
                    tx = ty = ""
                parts.append(f"[img{i}]setpts=PTS-STARTPTS,format=rgba,{'' if moves else tfi}{mix},"
                             f"setpts=PTS+{s0:.3f}/TB{ifade}{geo}[im{i}]")
                say(f"[worker] {Path(c['path']).name}: {len(kf)} keyframe(s) tweened"
                    + (" (position / scale / rotation)" if moves else "") + (" (opacity)" if _kf_has(kf, "op") else "")
                    + (" (colour)" if c.get("_tint") else ""))
            else:
                parts.append(f"[img{i}]{shift}format=rgba,{tfi}colorchannelmixer=aa={op:.3f}{ifade}[im{i}]")
            ops.append({"src": f"im{i}", "x": f"(main_w-overlay_w)/2{tx}", "y": f"(main_h-overlay_h)/2{ty}",
                        "en": f"between(t,{s0:.3f},{s1:.3f})", "c": c, "i": i, "eof": False})
        vprev = _composite_ops(parts, ops, vprev, fw, fh, span, say)     # 2.491.0
        vout_lbl = f"[{vprev}]" if (imgs or overlays) else f"[{vbase}]"

        _mute = tl.get("v1_mute") or []
        if keep and _mute:
            # 2.407.0: J / L cuts - V1's own sound silenced where a neighbour's sound runs over it (lib/splitEdit.js)
            _ex = "+".join(f"between(t,{float(a):.3f},{float(b):.3f})" for a, b in _mute)
            parts.append(f"[{abase}]volume=volume=0:enable='{_ex}'[abm]")
            abase = "abm"
            say(f"[worker] J / L cuts: {len(_mute)} split edit(s)")
        mix_in = []
        roles = []                                     # 2.406.0: voice / music / sfx, for the ducking
        pans = []                                      # 2.415.0: 🎚 each input's pan (scripts/mixfx.py pan_inputs)
        if keep:
            if v1quiet:
                parts.append(f"[{abase}]volume={v1vol:.3f}[a0v]")
                mix_in.append("[a0v]")
            else:
                mix_in.append(f"[{abase}]")
            roles.append(tl.get("video_role") or "voice")
            pans.append(tl.get("video_pan") or 0)
        for i, c in enumerate(overlays, start=1):      # layer audio into the mix
            lvol = float(c.get("lvol", 1))
            if c.get("muted") or lvol <= 0:
                continue
            if not has_audio(Path(c["path"])):         # 2.373.0: a silent overlay (karaoke) has no [i:a]
                continue
            ms = int(round(float(c.get("start") or 0) * 1000))
            vol = "" if abs(lvol - 1) < 1e-3 else f",volume={lvol:.3f}"
            # 2.412.0: J / L cuts on this layer - this clip's sound silenced where a neighbour's runs over it
            am = c.get("amute") or []
            amx = (",volume=volume=0:enable='" + "+".join(f"between(t,{float(a):.3f},{float(b):.3f})" for a, b in am) + "'") if am else ""
            if _kf_has(c.get("kf"), "vol"):          # 2.379.0: ◆ volume keyframes on a video layer's sound
                vol = f",asetpts=PTS-STARTPTS,volume=eval=frame:volume='{lvol:.4f}*({_kf_expr(c.get('kf'), 'vol', 1.0, 't')})'"
                parts.append(f"[{i}:a]{vol[1:]},adelay={ms}|{ms}{amx}[la{i}]")
            else:
                parts.append(f"[{i}:a]adelay={ms}|{ms}{vol}{amx}[la{i}]")
            if am:
                say(f"[worker] {Path(c['path']).name}: silenced under {len(am)} J / L cut(s) on its layer")
            mix_in.append(f"[la{i}]")
            roles.append(c.get("role") or "voice")
            pans.append(c.get("lpan") or 0)
        aoff = 1 + len(overlays) + len(imgs)
        for i, c in enumerate(clips):
            idx = aoff + i
            ms = int(round(float(c["start"]) * 1000))
            cv = float(c.get("volume", 1) or 0)
            vol = "" if abs(cv - 1) < 1e-3 else f",volume={cv:.3f}"
            # adelay has already placed this clip on the timeline, so the
            # afade st= is an absolute second, exactly as on the video side
            cs0 = float(c["start"])
            clen = (float(c["out"]) - float(c.get("in") or 0)) if c.get("out") else None
            afd = "".join("," + f for f in (
                _fade(c.get("fade_in"), "in", cs0, clen, audio=True),
                _fade(c.get("fade_out"), "out", cs0 + clen, clen, audio=True)
                if clen else "") if f)
            # 2.412.0: a J / L cut of a RETIMED clip - its sound at the clip's speed (atempo), backwards when reversed
            pre = ""
            if c.get("rev"):
                pre += "areverse,"
            if c.get("tempo"):
                pre += _atempo(float(c["tempo"])) + ","
            if pre:
                pre = "asetpts=PTS-STARTPTS," + pre
            if _kf_has(c.get("kf"), "vol"):
                # 2.379.0: ◆ volume keyframes, tweened per frame of the clip's own time (the layer volume on top)
                vx = _kf_expr(c.get("kf"), "vol", 1.0, "t")
                parts.append(f"[{idx}:a]{pre}asetpts=PTS-STARTPTS,volume=eval=frame:volume='{cv:.4f}*({vx})',"
                             f"adelay={ms}|{ms}{afd}[a{idx}]")
            else:
                parts.append(f"[{idx}:a]{pre}adelay={ms}|{ms}{vol}{afd}[a{idx}]")
            mix_in.append(f"[a{idx}]")
            roles.append(c.get("role") or "music")
            pans.append(c.get("pan") or 0)
        mix_in = _mixfx.pan_inputs(parts, mix_in, pans, say)     # 2.415.0: 🎚 pan (the balance law)
        if _mixfx.active(tl.get("mix")) and mix_in:
            # 2.406.0: the roles, the music ducked under the voices, the loudness
            aout_lbl = _mixfx.mix(parts, list(zip(mix_in, roles)), tl.get("mix"), say)
        elif len(mix_in) > 1:
            # duration=LONGEST, not first. `first` is the base track's own
            # audio, so a soundtrack that outlasted the video used to be cut
            # off at the same instant the picture was. The output is capped
            # by -t below, so "longest" can never run past the timeline.
            parts.append(f"{''.join(mix_in)}amix=inputs={len(mix_in)}:duration=longest:normalize=0[aout]")
            aout_lbl = "[aout]"
        elif len(mix_in) == 1:
            parts.append(f"{mix_in[0]}anull[aout]")
            aout_lbl = "[aout]"
        else:
            aout_lbl = None   # no audio at all (muted, no clips)
        aout_lbl = _mixfx.master_out(parts, aout_lbl, tl.get("master"), say)   # 2.415.0: 🎚 the master fader

        if caps_on:
            # 2.406.0: the caption track burned in (libass), styled as the canvas showed it
            cw, ch = _video_wh(allv)
            assf = Path.cwd() / "captions.ass"
            assf.write_text(_caps.ass(caps, cw, ch), encoding="utf-8")
            parts.append(f"{vout_lbl}subtitles=filename={_cfx._fx_path(assf)}[vcap]")
            vout_lbl = "[vcap]"
            say(f"[worker] captions: {len(_caps.cues(caps))} burned in")
        args += _fc_args(";".join(parts))      # 2.489.0: a long graph (Bézier tweens) goes in a file
        # 2.406.0: a full pass that only touched the sound (the mix, a .srt) leaves V1's picture as the input stream itself
        args += ["-map", "0:v" if vout_lbl == "[0:v]" else vout_lbl]
        if aout_lbl:
            args += ["-map", aout_lbl]
        # The output container is mp4, so a VP9 stream copy is not an option
        # even when nothing was composited — mp4 must carry H.264/AAC to play
        # everywhere. mp4_args() is the ONE place that choice is made.
        args += mp4_args(audio=bool(aout_lbl), crf=export_crf)
        # The exact length of the timeline. An untrimmed overlay runs for as
        # long as its source file, which may be longer than the slot it was
        # given on the timeline, so the mix is trimmed back to the span rather
        # than being allowed to define it.
        args += ["-t", f"{span:.3f}"]
        args += [str(final)]
        say("@@CMD " + json.dumps(args))
        rc = run(args, echo_cmd=False)
        if rc != 0 or not final.exists():
            fail("ffmpeg export failed")
        if caps.get("srt") and _caps.cues(caps):
            # 2.406.0: the captions as a .srt beside the movie (YouTube / players take it as a track)
            (final.with_suffix(".srt")).write_text(_caps.srt(caps), encoding="utf-8")
            say(f"[worker] captions: {final.with_suffix('.srt').name} written beside it")
        _dl.finish(final, tl, say, run)          # 2.407.0: the deliverables, made from the master
        say(f"[worker] timeline export complete: {out_name}")
        sys.exit(0)

        keep = tl.get("keep_original_audio", True) and not tl.get("video_muted", False)
        args = ["ffmpeg", "-y", "-loglevel", "error", "-i", str(allv)]
        for c in clips:
            args += ["-i", c["path"]]
        parts, mix_in = [], []
        if keep:
            mix_in.append("[0:a]")
        for i, c in enumerate(clips, start=1):
            ms = int(round(c["start"] * 1000))
            parts.append(f"[{i}:a]adelay={ms}|{ms}[a{i}]")
            mix_in.append(f"[a{i}]")
        n = len(mix_in)
        fc = ";".join(parts + [f"{''.join(mix_in)}amix=inputs={n}:duration=first:normalize=0[aout]"]) if n > 1              else (parts[0].replace(f"[a1]", "[aout]") if parts else "[0:a]anull[aout]")
        args += ["-filter_complex", fc, "-map", "0:v", "-map", "[aout]"]
        args += mp4_args(audio=True, crf=export_crf) + [str(final)]
        say("@@CMD " + json.dumps(args))
        rc = run(args, echo_cmd=False)
        if rc != 0 or not final.exists():
            fail("ffmpeg export failed")
        _dl.finish(final, tl, say, run)          # 2.407.0: the deliverables, made from the master
        say(f"[worker] timeline export complete: {out_name}")
        sys.exit(0)

    total = max(1, min(MAX_FRAMES, int(params["frames"])))
    refs = params.get("reference_files", [])
    # 2.388.0: Append / Prepend - the video's frame (already one of the references) upscaled to the render's size
    fop = params.get("frame_op") if isinstance(params.get("frame_op"), dict) else None
    if fop:
        if _cj is None:
            fail("scripts/clipjoin.py did not load - Append / Prepend cannot run")
        _cj.prepare(fop, say, lambda c: run(c, echo_cmd=False), _tail_comfy(cfg) if fop.get("upscaler") and engine == "comfy" else None)
    # native ComfyUI MiniMaxH3 nodes live on the 17k+5 grid; sd-cli on 4n+1
    grid = "17k5" if engine == "comfy" else "4n1"
    snap_up, _snap_down, model_ceiling = GRIDS[grid]
    if grid == "17k5" and long_on(params.get("video_style")):
        # 2.503.0: Long video - low-VRAM attention + chunked feed-forward ride the graph (apply_video_accel)
        model_ceiling = LONG_SINGLE_RUN_COMFY
        say(f"[worker] Long video: one generation up to {model_ceiling}f ({model_ceiling / FPS:.2f}s) "
            f"- MiniMax low-VRAM attention + chunked feed-forward")
    # The VRAM ceiling this machine has LEARNED (2.99.0): a single run longer
    # than it died of GPU out-of-memory before, so plans are made below it.
    # 0 = the model's own ceiling. Only the comfy grid learns one.
    vram_ceiling = 0
    if engine == "comfy":
        try:
            vram_ceiling = int(((cfg.get("engine") or {}).get("comfy") or {})
                               .get("vram_ceiling") or 0)
        except (TypeError, ValueError):
            vram_ceiling = 0
    if 0 < vram_ceiling < MIN_LEARNED_CEILING:
        # repair a bad value written by 2.99.0-2.99.3 (Tim's settings held 5f,
        # which turned a 5 s clip into 30 chunks). Ignore it and say so.
        say(f"[worker] ignoring a saved VRAM ceiling of {vram_ceiling}f - below the "
            f"{MIN_LEARNED_CEILING}f floor, so it is not a real memory limit. "
            f"Settings -> ComfyUI -> Model max clears it for good.")
        vram_ceiling = 0
    if not _chunk_on_oom(cfg):
        vram_ceiling = 0            # chunking off: never let a learned ceiling split a clip
    ceiling = (max(5, min(_snap_down(vram_ceiling), model_ceiling))
               if vram_ceiling > 0 else model_ceiling)
    if ceiling < model_ceiling:
        say(f"[worker] VRAM ceiling {ceiling}f ({ceiling / FPS:.2f}s) in force "
            f"(model max {model_ceiling}f): longer clips render in chunks. "
            f"Settings -> ComfyUI resets it.")
    max_chunk = min(ceiling,
                    snap_up(int(params.get("segment_frames") or ceiling)))
    pipeline = params.get("pipeline", "auto")
    if pipeline == "auto":   # Auto: ONE generation whenever it fits the ceiling
        pipeline = "single" if total <= ceiling else "chunked"
    if pipeline == "single" and total > model_ceiling:
        fail(f"single-run ceiling is {model_ceiling} frames ({model_ceiling / FPS:.2f}s); "
             f"use Auto/chunked.")
    if pipeline == "single" and total > ceiling:
        # an explicit Single run over the LEARNED ceiling: plan the chunks it
        # will need, rather than spending the minutes to fail the same way
        say(f"[worker] Single run asked for {total}f but {ceiling}f is the VRAM "
            f"ceiling learned on this machine - rendering in chunks instead.")
        pipeline = "chunked"
    trim_exact = bool(params.get("trim_exact", True))
    force_chunks = bool(params.get("force_chunks"))
    p = plan_chunks(total, model_ceiling if pipeline == "single" else max_chunk,
                    grid=grid, force=force_chunks and pipeline != "single",
                    ceiling=ceiling)
    chunks = p["chunks"]
    n = len(chunks)
    # ---- music video: one shot per segment, each on the frame grid ----
    # shots = [{prompt, seconds}]; segment k keeps round(seconds*24) unique
    # frames, generated as snap_up(keep + 1) so the seam duplicate the join
    # drops still leaves the shot its exact length. The song is muxed at the
    # end, so shot boundaries land on exact song timestamps.
    shots = params.get("shots") or []
    music = params.get("music")
    if shots:
        chunks, keeps = [], []
        for k, sh in enumerate(shots):
            keep = max(1, int(round(float(sh.get("seconds") or 15) * FPS)))
            gen = snap_up(keep + (1 if k else 0))       # +1 seam frame after #1
            if gen > ceiling:
                fail(f"shot {k + 1} is {keep / FPS:.2f}s - the single-run "
                     f"ceiling is {(ceiling - 1) / FPS:.2f}s per shot on this engine")
            chunks.append(gen)
            keeps.append(keep)
        total = sum(keeps)
        if total > MAX_FRAMES:
            fail(f"music videos are capped at {MAX_FRAMES / FPS / 60:.0f} minutes "
                 f"({MAX_FRAMES} frames); this shot list is {total / FPS:.1f}s")
        n = len(chunks)
        p = {"chunks": chunks, "unique": total, "trim": 0}
        pipeline = "chunked" if n > 1 else "single"
        trim_exact = True
        say(f"[worker] music video: {n} shot(s), {total}f = {total / FPS:.2f}s"
            + (f", song {Path(music).name}" if music else ", no song"))
    say(f"[worker] pipeline={pipeline} grid={grid} target={total}f "
        f"({total / FPS:.2f}s @ {FPS}fps) "
        f"plan={chunks} unique={p['unique']} trim={p['trim']}")

    # validation up front, before touching the GPU
    if engine != "comfy":
        # comfy mode renders with ComfyUI's OWN models folders; bitGen Studio's
        # model paths are only validated for the sd-cli engine.
        require("sd-cli", cfg["sd_cli"])
        require("text encoder", cfg["models"]["text_encoder"])
        require("video VAE", cfg["models"]["video_vae"])
        require("audio VAE", cfg["models"]["audio_vae"])
        if mode == "ref2va":
            require("ref2va denoiser", cfg["models"]["ref2va"])
        if mode != "ref2va" or n > 1:
            require("fl2va denoiser", cfg["models"]["fl2va"])
    if (engine != "comfy" and shots
            and any(str(sh.get("mode") or "") == "ref" and sh.get("refs") for sh in shots)):
        require("ref2va denoiser", cfg["models"]["ref2va"])
    # 2.353.0: on ComfyUI a reference video or sound is a reference too (the graph gets its slots)
    av_refs = engine == "comfy" and bool(params.get("ref_videos") or params.get("ref_audios"))
    if mode == "ref2va" and not (1 <= len(refs) <= 9 or (av_refs and not refs)):
        fail("ref2va needs 1-9 reference images" + ("." if engine == "comfy" else " (a reference video or sound "
             "alone works on the ComfyUI engine)."))
    if mode == "fl2va" and len(refs) > 2:
        fail("fl2va takes at most 2 frames (first, last).")
    for r in refs:
        require("reference image", r)
    needs_ffmpeg = n > 1 or pipeline == "png_rebuild" or (trim_exact and p["trim"] > 0)
    if needs_ffmpeg and not shutil.which("ffmpeg"):
        fail("this render needs ffmpeg on PATH (winget install Gyan.FFmpeg) "
             "for frame hand-off, seam-drop joining and the exact trim.")

    fmt = params.get("format") or DEFAULT_FORMAT
    if fmt not in FORMATS:
        fmt = DEFAULT_FORMAT
    out_name = f"{time.strftime('%Y%m%d-%H%M%S')}_{workdir.name}.{fmt}"
    final = output_dir / out_name
    say("@@OUT " + out_name)

    # reference videos -> 24fps frame dirs; reference audio -> wav
    ref_video_dirs, ref_audio_wavs = [], []
    rvids, rauds = params.get("ref_videos", []), params.get("ref_audios", [])
    if mode == "ref2va" and (rvids or rauds) and not _viggle_job(params):
        if not shutil.which("ffmpeg"):
            fail("reference video/audio needs ffmpeg on PATH.")
        for i, rv in enumerate(rvids, start=1):
            require("reference video", rv)
            d = Path.cwd() / f"refv_{i:02d}"
            d.mkdir(exist_ok=True)
            say(f"[worker] extracting frames from reference video {i}")
            if run(["ffmpeg", "-y", "-loglevel", "error", "-i", rv, "-vf", "fps=24",
                    str(d / "%05d.png")], echo_cmd=False) != 0:
                fail(f"frame extraction failed for {rv}")
            ref_video_dirs.append(str(d))
        for i, ra in enumerate(rauds, start=1):
            require("reference audio", ra)
            if ra.lower().endswith(".wav"):
                ref_audio_wavs.append(ra)
            else:
                wv = Path.cwd() / f"refa_{i:02d}.wav"
                if run(["ffmpeg", "-y", "-loglevel", "error", "-i", ra, str(wv)], echo_cmd=False) != 0:
                    fail(f"wav conversion failed for {ra}")
                ref_audio_wavs.append(str(wv))

    params["_ref_video_dirs"] = ref_video_dirs
    params["_ref_audio_wavs"] = ref_audio_wavs

    # ----- generation loop (single is the n == 1 case) -----
    preview = workdir / f"preview.{fmt}"
    segments = []
    masters = []       # 2.301.0: each chunk's lossless master (None = mp4-only)
    master_join = workdir / "preview.raw.avi"
    handoff = None
    anchor = None      # chunk 1's opening frame, when the job has no references
    # ----- the OOM re-plan (2.99.0) -----
    # A ComfyUI single run that dies of GPU out-of-memory is re-planned into
    # chunks under a LOWER ceiling (vram_fallback_ceiling: 362 -> 243 -> 158)
    # and the whole render is started again from chunk 1. The learned ceiling
    # is reported to the server over @@CFG and saved, so the NEXT long clip is
    # planned to fit from the start. Bounded: three re-plans, then the advice.
    # Music videos (shots) are per-shot lengths and are not re-planned here.
    oom_tries = 0
    while True:
        try:
            for i, cframes in enumerate(chunks, start=1):
                seg_out = workdir / f"chunk_{i:02d}.{fmt}"
                if i == 1:
                    seg_mode, seg_refs = mode, refs
                    first = refs[0] if mode == "fl2va" and refs else None
                    last = refs[1] if mode == "fl2va" and len(refs) > 1 else None
                else:   # fl2va hand-off from the previous chunk's exact last frame
                    # The references travel WITH the hand-off (2.130.0). They used
                    # to be dropped here, on the assumption that a first_frame
                    # input carries the character forward - true for a keyframe
                    # template, false for the reference templates H3 actually
                    # ships, where dropping them made the character re-roll every
                    # 15s. _frame_sources() decides what the graph can use.
                    seg_mode, seg_refs = "fl2va", list(refs) or (
                        [str(anchor)] if anchor and Path(anchor).exists() else [])
                    first, last = str(handoff), None
                if shots:                      # each segment renders its own shot
                    sh = shots[min(i, len(shots)) - 1]
                    params["prompt"] = str(sh.get("prompt") or params["prompt"])
                    smode = str(sh.get("mode") or ("cont" if i > 1 else "ref"))
                    srefs = [x for x in (sh.get("refs") or []) if x]
                    if smode == "ref" and srefs:
                        # fresh reference shot: re-anchors the character instead of
                        # inheriting drift from the previous frame (a hard cut, which
                        # is what a music video wants most of the time)
                        seg_mode, seg_refs, first, last = "ref2va", srefs, None, None
                    elif smode == "t2va":
                        seg_mode, seg_refs, first, last = "t2va", [], None, None
                    elif i > 1:                 # continuity from the previous shot
                        seg_mode, seg_refs = "fl2va", list(srefs or refs) or (
                            [str(anchor)] if anchor and Path(anchor).exists() else [])
                        first, last = str(handoff), None
                    grp = sh.get("ref_group")
                    say(f"[worker] shot {i}/{n} [{seg_mode}"
                        + (f" · {len(seg_refs)} ref" if seg_refs else "")
                        + (f" · group {grp}" if grp else "")
                        + f"]: {params['prompt'][:80]}")
                say(f"[worker] ===== chunk {i}/{n} =====")
                if engine == "comfy":
                    if i == 1:
                        say("@@CMD " + json.dumps(["comfyui", _comfy_url(cfg), seg_mode]))
                    # 2.352.0: where this chunk starts in the take (H3_Viggle
                    # cuts its motion video from here; the seam frame repeats)
                    params["_chunk_offset"] = sum(c - 1 for c in chunks[:i - 1])
                    comfy_generate(params, cfg, seg_mode, seg_refs, first, last,
                                   cframes, seg_out, free_vram=(i == 1))
                    mst = seg_out.with_suffix(".raw.avi")
                    if params.get("_h3_crop"):           # 2.380.0 the "up" H3 size: back to the size asked for
                        cw, ch = params["_h3_crop"]
                        okc = _crop_take(seg_out, cw, ch) and (not mst.exists() or _crop_take(mst, cw, ch))
                        say(f"[worker] chunk {i} cropped to {cw}x{ch} (rendered {params['width']}x{params['height']})"
                            if okc else f"[worker] chunk {i} could NOT be cropped to {cw}x{ch} - it keeps "
                            f"{params['width']}x{params['height']}")
                    segments.append(seg_out)
                    masters.append(mst if mst.exists() else None)
                    if i < n:
                        # 2.301.0: the hand-off frame comes from the LOSSLESS
                        # master when there is one (never a compressed frame)
                        handoff = workdir / f"handoff_{i:02d}.png"
                        extract_last_frame(mst if mst.exists() else seg_out, cframes - 1, handoff)
                    if i == 1 and i < n and not refs:
                        # NO project reference to hold the character: chunk 1's
                        # OPENING frame becomes one (2.130.0). Anchoring every
                        # later chunk on the same picture turns cumulative drift
                        # (chunk 3 copying chunk 2's copy of chunk 1) into
                        # bounded drift. It is not as good as a real reference
                        # image, and _frame_sources says so.
                        anchor = workdir / "anchor.png"
                        extract_last_frame(mst if mst.exists() else seg_out, 0, anchor)
                        say("[worker] no project reference: chunk 1's opening frame "
                            "is the anchor every later chunk keeps its character from")
                    limit = total if (i == n and trim_exact) else None
                    if masters and all(masters):
                        # 2.301.0: join the MASTERS losslessly, then encode the
                        # playback preview ONCE from that join
                        _join_masters(masters, master_join, limit)
                        rc = run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(master_join),
                                  "-r", str(FPS)] + enc_args(fmt, crf=16) + [str(preview)],
                                 echo_cmd=False)
                        if rc != 0 or not preview.exists():
                            fail("could not encode the playback preview from the lossless master")
                    else:
                        master_join.unlink(missing_ok=True)
                        join_seam_drop(segments, preview, fmt, limit_frames=limit)
                    say("[worker] joined preview updated")
                    continue
                argv = build_command(params, cfg, seg_mode=seg_mode, refs=seg_refs,
                                     first_frame=first, last_frame=last,
                                     frames=cframes, out_path=seg_out)
                if i == 1:
                    say("@@CMD " + json.dumps(argv))
                mark = len(recent_lines)
                rc = run(argv)
                # Compute-buffer OOM: retry ONCE with a budget derived from the free
                # VRAM the engine itself just reported (config budgets often assume
                # the dual-GPU split and overshoot on a single card).
                if (rc != 0 or not seg_out.exists()) and oom_since(mark):
                    argv2 = list(argv)
                    moved = try_move_vae(argv2, cfg)
                    budget = estimate_vram_budget(cfg, vae_moved_to=moved)
                    had = "--max-vram" in argv2
                    same = had and argv2[argv2.index("--max-vram") + 1] == str(budget) and moved is None
                    if not same:
                        if had:
                            argv2[argv2.index("--max-vram") + 1] = str(budget)
                        else:
                            argv2 += ["--max-vram", str(budget)]
                        say(f"[worker] OOM allocating the compute buffer - retrying chunk {i} "
                            f"with segmented execution (--max-vram {budget}, measured from free VRAM)"
                            + (f", VAE moved to cuda{moved} for this run" if moved is not None else "")
                            + ". Make it permanent in Settings -> GPU (the dual-GPU preset is the fast path).")
                        argv = argv2
                        mark = len(recent_lines)
                        rc = run(argv)
                # Stage 2: still OOM -> park the weights in system RAM and stream them
                # to the GPU on demand (--offload-to-cpu). Slower per step, near-unOOMable.
                if (rc != 0 or not seg_out.exists()) and oom_since(mark):
                    off = (cfg.get("flags", {}).get("offload_cpu") or "--offload-to-cpu")
                    if off.split()[0] not in argv:
                        argv = list(argv) + off.split()
                        say(f"[worker] still OOM - retrying chunk {i} with CPU weight offload "
                            f"({off.split()[0]}): weights parked in system RAM, streamed to the "
                            f"GPU on demand. Make it permanent in Settings -> GPU -> CPU weight offload.")
                        mark = len(recent_lines)
                        rc = run(argv)
                # Stage 3: VMM/driver crash (cuMemSetAccess / device not ready) ->
                # retry once with CUDA graphs off + no-VMM pooling requested.
                if ((rc != 0 or not seg_out.exists()) and vmm_error_since(mark)
                        and RUN_ENV.get("GGML_CUDA_DISABLE_GRAPHS") != "1"):
                    RUN_ENV.update(STABILITY_ENV)
                    say(f"[worker] CUDA VMM allocator crash detected - retrying chunk {i} "
                        f"in CUDA stability mode (GGML_CUDA_DISABLE_GRAPHS=1, "
                        f"GGML_CUDA_NO_VMM=1). Make it permanent in Settings -> GPU.")
                    mark = len(recent_lines)
                    rc = run(argv)
                if rc != 0 or not seg_out.exists():
                    d = diagnose_engine_failure()
                    if d:
                        say(f"[worker] {d}")
                    fail(f"chunk {i} failed (exit {rc}); earlier chunks are kept in the job folder.")
                # 2.102.1: sd-cli writes whatever container its own encoder
                # picked for the extension; an .mp4 from it is not guaranteed
                # H.264/AAC (Messenger-safe), so normalize it the way the
                # ComfyUI path already does. A webm/avi is left as it came.
                if fmt == "mp4" and shutil.which("ffmpeg"):
                    raw = seg_out.with_suffix(".sdcli.mp4")
                    seg_out.replace(raw)
                    if run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(raw),
                            "-r", str(FPS)] + enc_args(fmt) + [str(seg_out)], echo_cmd=False) != 0 \
                            or not seg_out.exists():
                        raw.replace(seg_out)     # keep the engine's file rather than nothing
                        say("[worker] could not re-encode the sd-cli mp4 to H.264/AAC; kept as written")
                segments.append(seg_out)
                if i < n:
                    handoff = workdir / f"handoff_{i:02d}.png"
                    extract_last_frame(seg_out, cframes - 1, handoff)
                # progressive preview: seam-dropped join of everything so far, audio kept
                limit = total if (i == n and trim_exact) else None
                join_seam_drop(segments, preview, fmt, limit_frames=limit)
                say("[worker] joined preview updated")

            break                               # every chunk rendered
        except ComfyOOM as oom:
            oom_tries += 1
            if not _chunk_on_oom(cfg):
                # "don't do chunks": say what happened and stop. Splitting a
                # clip behind the user's back is not a fix, it is a different
                # (worse) clip. Settings -> ComfyUI can turn it back on.
                for line in (oom.advice or "").split("\n"):
                    if line.strip():
                        say(line)
                say("[worker] Not splitting this clip into segments (Settings -> "
                    "ComfyUI: 'Split a clip that runs out of VRAM' is off).")
                fail(str(oom))
            # SIZE-INDEPENDENCE TEST (2.99.3). A real out-of-memory failure gets
            # BETTER as the run gets shorter. If a substantially shorter run
            # fails the SAME way, the size is not the variable and shrinking
            # further only wastes minutes — Tim's log went 243f -> 158f -> 107f
            # -> 73f (a 3 s clip!) with an identical [Errno 22] each time, on a
            # card with 30 GB free. That is proof it is NOT memory. So a
            # non-OOM failure (the [Errno 22] form) gets exactly ONE shrink as a
            # test, and if that fails too we stop and say what it really is.
            if not oom.oom and oom_tries > 1:
                for line in (oom.advice or "").split("\n"):
                    if line.strip():
                        say(line)
                say("[worker] A shorter run failed the SAME way, so this is NOT "
                    "a memory limit - the clip size is not the variable.")
                fail(f"{oom} - and a shorter run failed identically, so shrinking "
                     f"cannot fix it. This is the ComfyUI-on-Windows stderr crash, "
                     f"not VRAM.")
            if shots or oom_tries > 3 or oom.frames <= 5:
                # out of room to shrink: NOW print the advice the failure carried
                # (the OOM options, or — if a tiny clip STILL Errno-22s — the
                # genuine ComfyUI-on-Windows stderr case and its decisive test).
                for line in (oom.advice or "").split("\n"):
                    if line.strip():
                        say(line)
                fail(f"{oom} - and it still failed after shrinking the run. A smaller "
                     f"model or memory-efficient (sage/flash) attention in ComfyUI would "
                     f"fit this in one run; the chunked path could not get under the limit.")
            new_ceiling = vram_fallback_ceiling(oom.frames, grid)
            if new_ceiling >= oom.frames:
                for line in (oom.advice or "").split("\n"):
                    if line.strip():
                        say(line)
                fail(f"{oom} - cannot plan a shorter chunk on the {grid} grid.")
            ceiling = new_ceiling
            max_chunk = min(ceiling, max_chunk)
            p = plan_chunks(total, max_chunk, grid=grid, force=True, ceiling=ceiling)
            chunks, n = p["chunks"], len(p["chunks"])
            pipeline = "chunked" if n > 1 else "single"
            say(f"[worker] {oom}")
            say(f"[worker] re-planning under a {ceiling}f VRAM ceiling: {n} chunk(s) "
                f"{chunks} (unique {p['unique']}, trim {p['trim']}), fl2va hand-off "
                f"between them. Try {oom_tries}/3.")
            # LEARN only from a real memory limit, and only a sane value. 2.99.4:
            # 2.99.1 walked a NON-memory failure down to the 5-frame floor and
            # SAVED it, so Tim's next 5 s clip was planned as THIRTY 5-frame
            # chunks. Re-planning this render is still worth trying; teaching the
            # app from it is not.
            if oom.oom and ceiling >= MIN_LEARNED_CEILING:
                when = time.strftime("%Y-%m-%d %H:%M")
                note = (f"learned {when}: {oom.frames}f ({oom.frames / FPS:.1f}s) at "
                        f"{params['width']}x{params['height']} ran out of GPU memory; "
                        f"single runs now capped at {ceiling}f ({ceiling / FPS:.2f}s)")
                say("@@CFG " + json.dumps({"engine": {"comfy": {
                    "vram_ceiling": ceiling, "vram_ceiling_note": note}}}))
            else:
                say(f"[worker] not saving a {ceiling}f ceiling "
                    + ("(that failure was not a memory limit)" if not oom.oom
                       else f"(below the {MIN_LEARNED_CEILING}f floor - chunking "
                            f"that fine is not a fix)"))
            segments, masters, handoff = [], [], None
            for old in workdir.glob("chunk_*.*"):
                old.unlink(missing_ok=True)

    if pipeline == "png_rebuild":
        seq = workdir / "frames"
        seq.mkdir(exist_ok=True)
        counter = 0
        for i, seg in enumerate(segments, start=1):
            cdir = workdir / f"png_{i:02d}"
            cdir.mkdir(exist_ok=True)
            if run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(seg),
                    "-vsync", "0", str(cdir / "f_%05d.png")], echo_cmd=False) != 0:
                fail(f"png extraction failed for chunk {i}")
            names = sorted(x.name for x in cdir.iterdir())
            drop = 1 if i > 1 else 0   # seam duplicate
            kept = 0
            for nm in names[drop:]:
                if trim_exact and counter >= total:
                    break
                counter += 1
                kept += 1
                (cdir / nm).replace(seq / f"{counter:06d}.png")
            shutil.rmtree(cdir, ignore_errors=True)
            say(f"[worker] png rebuild: chunk {i} contributed {kept} frames "
                f"(seam dropped: {drop}), total {counter}")
        vid_only = workdir / f"rebuild_v.{fmt}"
        rc = run(["ffmpeg", "-y", "-loglevel", "error", "-framerate", str(FPS),
                  "-i", str(seq / "%06d.png"), "-frames:v", str(counter),
                  "-r", str(FPS)] + enc_args(fmt)[:-2] + [str(vid_only)],
                 echo_cmd=False)
        if rc != 0 or not vid_only.exists():
            fail("png rebuild encode failed")
        if probe_has_audio(preview):   # mux joined (seam-dropped, trimmed) audio
            rc = run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(vid_only),
                      "-i", str(preview), "-map", "0:v", "-map", "1:a",
                      "-c", "copy", "-shortest", str(final)], echo_cmd=False)
            if rc != 0 or not final.exists():
                shutil.copyfile(vid_only, final)
        else:
            shutil.copyfile(vid_only, final)
        say(f"[worker] final rebuilt from PNG sequence: {probe_frames(final)} frames")
        if int(params.get("trim_head") or 0) > 0:          # 2.302.0
            _trim_head(final, None, int(params["trim_head"]), fmt)
    else:
        shutil.copyfile(preview, final)   # last join already trimmed exactly
        say(f"[worker] final joined: {probe_frames(final)} frames "
            f"(target {total}, trim {p['trim']})")
        # 2.302.0: the scene's "trim first frame" - the repeated start frame goes
        if int(params.get("trim_head") or 0) > 0:
            _trim_head(final, master_join if master_join.exists() else None,
                       int(params["trim_head"]), fmt)
        # 2.301.0: the scene's LOSSLESS MASTER beside the take, in
        # projects/<project>/raw/<take stem>.avi (lib/rawMaster.js finds it)
        if raw_dir and master_join.exists() and not music:
            try:
                raw_dir.mkdir(parents=True, exist_ok=True)
                dest = raw_dir / _rm.master_name(final.name)
                shutil.move(str(master_join), str(dest))
                mf, pf = probe_frames(dest), probe_frames(final)
                say(f"[worker] lossless master saved: raw/{dest.name} ({mf} frames"
                    + (", the same as the take)" if mf == pf else f" - the take has {pf})"))
            except Exception as e:          # noqa: BLE001 - the take is already safe
                say(f"[worker] could not save the lossless master to {raw_dir}: {e}")
        elif raw_dir and params.get("raw_master"):
            say("[worker] no lossless master for this take (see the [comfy] lines above) - "
                "the mp4 is the only copy")

    if music:
        require("song", music)
        if not shutil.which("ffmpeg"):
            fail("muxing the song needs ffmpeg on PATH.")
        start = float(params.get("music_start") or 0)
        muxed = workdir / f"muxed.{fmt}"
        say(f"[worker] muxing song from {start:.2f}s over "
            f"{probe_frames(final)} frames ({total / FPS:.2f}s)")
        # the video is exactly total/24 s long, so the song slice starting at
        # music_start lines up sample-for-sample; -shortest cuts a longer song
        rc = run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(final),
                  "-ss", f"{start:.3f}", "-i", str(music),
                  "-map", "0:v", "-map", "1:a", "-c:v", "copy"]
                 + enc_args(fmt)[-2:] + ["-shortest", str(muxed)], echo_cmd=False)
        if rc != 0 or not muxed.exists():
            fail("could not mux the song onto the video")
        muxed.replace(final)
        say(f"[worker] song synced: {probe_frames(final)} frames @ {FPS}fps")

    if fop:                                       # 2.388.0: the new part joined to the video
        part = final.with_name(final.stem + "_part" + final.suffix)
        shutil.copyfile(final, part)
        try:
            _cj.join(fop, part, final, say, lambda c: run(c, echo_cmd=False))
            say(f"[frame-op] the new part alone is kept as {part.name}")
        except Exception as e:                    # noqa: BLE001
            fail(f"could not {fop.get('op')} the new part to {Path(str(fop.get('video'))).name}: {e} (the part is {part.name})")
    _tail_pngs(params, cfg, final, raw_dir)       # 2.313.0
    say(f"[worker] {'chained' if n > 1 else 'single'} render complete: {final.name}")
    sys.exit(0)


if __name__ == "__main__":
    main()
