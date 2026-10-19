#!/usr/bin/env python3
"""ComfyUI transport — queue a graph, wait, fetch what it made.

Only the HTTP plumbing lives here: no MiniMax knowledge, no image knowledge, no
graph patching. scripts/comfy_image.py decides WHAT to send; this decides how.

NOTE ON DUPLICATION, READ BEFORE "TIDYING": worker.py has its own copy of this
plumbing (_http_json / _comfy_upload_image / the history poll). It is NOT
imported from here on purpose. Hoisting the video worker onto this module is a
refactor of a 2400-line file that the whole video pipeline depends on, and doing
it as a side effect of an image feature is how a working renderer gets broken by
a change nobody was testing. That migration is a session of its own, with its
own test run — it is written up in HANDOVER.md. Until then: a fix here probably
belongs there too.

ONE EXCEPTION, deliberate (2.98.0): the VRAM helpers at the bottom of this file
(free_before_gen / vram / free_memory / is_oom, and explain_execution_error) are
imported by worker.py as well as by the image and music workers. They are new
code with no counterpart in the video worker, so importing them adds nothing to
the duplication above — and an out-of-memory clip needs the same clear and the
same explanation whichever worker hits it. worker.py guards the import and logs
if it ever fails, so the video renderer never depends on it to render.
"""
import json
import os
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
from pathlib import Path


def explain_execution_error(messages):
    """A targeted explanation for failures whose text does not explain itself.

    THE ONE THIS EXISTS FOR: OSError [Errno 22] Invalid argument inside a
    sampler node. It has cost DAYS on this project. It is not the graph, not the
    seed (both shipped as fixes; both disproved by the next render), and not the
    model: it is ComfyUI's own stderr dying on Windows. tqdm starts writing
    progress when sampling starts -- which is why it always fails IN the sampler
    -- and ComfyUI-Manager's prestartup wrapper flushes a handle that raises
    EINVAL when the process has no usable console (Manager #2458, ComfyUI PR
    #11629 "Ignore Windows stderr flush errors").

    The raw event gives a user nothing to act on, and this exact message has now
    been pasted back four times. Recognise it and say what to DO. Deliberately
    conservative: an unrecognised failure gets no speculation appended.
    """
    try:
        blob = json.dumps(messages)
    except Exception:
        return ""
    if is_oom(messages):
        return OOM_ADVICE
    if is_h3_internals_mismatch(messages):
        # BEFORE the sage branch on purpose: a traceback that walks through a
        # patched attention path mentions sageattention, and blaming Sage for a
        # FinalLayer signature error sends the user to fix the wrong thing.
        return H3_INTERNALS_ADVICE
    if "sageatt" in blob.lower():
        # The video style's Sage accelerator reached the graph but the
        # `sageattention` library inside ComfyUI's python is missing or was
        # built for a different torch ("DLL load failed while importing
        # _fused" - exactly what a cu128 wheel does on a cu130 torch).
        return (
            "\n\n[worker] Sage attention failed INSIDE ComfyUI: the sageattention"
            "\n[worker] library is missing there, or its wheel was built for a"
            "\n[worker] different torch ('DLL load failed while importing _fused')."
            "\n[worker] Fix: Settings -> ComfyUI -> Video accelerators -> Install"
            "\n[worker] Sage attention (it picks the wheel matching ComfyUI's own"
            "\n[worker] torch/CUDA), restart ComfyUI, render again. Manual wheels:"
            "\n[worker]   https://github.com/woct0rdho/SageAttention/releases"
            "\n[worker] Or set the video style's Sage attention to Off"
            "\n[worker] (Settings -> Video styles).")
    if "[Errno 22] Invalid argument" not in blob or "OSError" not in blob:
        return ""
    return (
        "\n\n[worker] This is the known ComfyUI-on-Windows stderr crash, not a"
        "\n[worker] problem with this prompt: the progress bar writes to stderr"
        "\n[worker] once sampling starts, and a wrapper installed by"
        "\n[worker] ComfyUI-Manager fails to flush it when ComfyUI has no usable"
        "\n[worker] console (ComfyUI-Manager issue #2458)."
        "\n[worker] In order of preference:"
        "\n[worker]   1. Settings -> ComfyUI -> '⤴ Relaunch ComfyUI in a real console'"
        "\n[worker]      (2.100.0). A ComfyUI H3 launched from 2.100.0 on already writes"
        "\n[worker]      to comfy.log instead of a pipe; a real window is the other way."
        "\n[worker]   2. If YOU start ComfyUI: put `set TQDM_DISABLE=1` at the top of"
        "\n[worker]      your ComfyUI .bat (an env var, no ComfyUI file changes) and"
        "\n[worker]      render again - or start it in a normal console window."
        "\n[worker]   3. UPDATE ComfyUI-Manager (the fix is upstream), then restart"
        "\n[worker]      ComfyUI."
        "\n[worker] RUN clear-comfy.bat (in the bitGen Studio folder) FIRST, whichever"
        "\n[worker] you pick. Until 2.81.3 a quit could leave the ComfyUI we"
        "\n[worker] launched alive and HIDDEN, still holding :8188 - so a"
        "\n[worker] 'restarted' ComfyUI was often the old one answering, and every"
        "\n[worker] test of this crash so far may have been measuring that."
        "\n[worker] clear-comfy.bat kills whatever holds the port, empties the node"
        "\n[worker] cache, and can relaunch in a real console for option 3."
    )


# ----------------------------------------------------------- VRAM (2.98.0)
# "15 sec videos used to work. 10 seconds work but 15 doesn't."  The sampler
# reported torch.OutOfMemoryError on a 362-frame ref2va that had rendered fine
# before. ComfyUI keeps EVERY model it has used resident (the H3 transformer,
# FLUX from the last still, Music3 from the last song, text encoders, VAEs) and
# only evicts when its own estimate says the next graph will not fit; the
# torch caching allocator also keeps freed blocks, so after a day of mixed
# renders the card is full of things nobody is using and the free VRAM is
# fragmented. A 10 s clip squeezes in; a 15 s one does not. ComfyUI's own
# answer is POST /free {unload_models, free_memory}: its prompt thread calls
# unload_all_models(), resets the execution cache, then gc + empty_cache().
# Weights come back from RAM in a few seconds, which is nothing against a
# multi-minute render — so every generation now starts from an empty card
# unless Settings -> ComfyUI turns it off.

def free_before_gen(cfg) -> bool:
    """engine.comfy.free_before_gen: default ON; only an explicit false turns it off."""
    c = (((cfg or {}).get("engine") or {}).get("comfy") or {})
    return c.get("free_before_gen") is not False


def vram(base, timeout=5):
    """[{name, free, total}] in bytes from /system_stats — [] when it cannot say."""
    try:
        st = http_json(f"{base}/system_stats", timeout=timeout) or {}
    except Exception:                                       # noqa: BLE001
        return []
    out = []
    for d in (st.get("devices") or []):
        try:
            out.append({"name": str(d.get("name") or d.get("type") or "gpu"),
                        "free": int(d.get("vram_free") or 0),
                        "total": int(d.get("vram_total") or 0)})
        except Exception:                                   # noqa: BLE001
            continue
    return out


def fmt_vram(devs) -> str:
    """'28.9/31.8 GB free' per device, or 'unknown' when ComfyUI gave nothing."""
    return ", ".join(f"{d['free'] / 2**30:.1f}/{d['total'] / 2**30:.1f} GB free"
                     for d in (devs or [])) or "unknown"


def free_memory(base, unload_models=True, free_memory=True, settle=15.0,
                timeout=30, poll=0.5, min_wait=2.0):
    """POST /free, then WAIT for it to land. Returns (before, after) device lists.

    /free only SETS FLAGS. ComfyUI's prompt thread acts on them the next time it
    wakes, so a /prompt sent the very next instant can be popped BEFORE the
    flags are read — ComfyUI would then run the graph first and unload
    everything after, the opposite of what was asked. And the unload itself is
    not instant: 30 GB of weights walking back to RAM takes seconds, during
    which the free figure climbs. So this polls /system_stats and returns when
    the figure has MOVED away from `before` and then held still for one more
    poll (the unload finished), or — when nothing moves, i.e. nothing was
    loaded — after `min_wait` seconds, which is longer than the flag hand-off.
    Two readings of the OLD figure are not "stable": the unit test in
    scripts/test-comfyfree.py fakes a card that only shows the unload after a
    delay, and a client that returned on that would queue into a full card.
    `settle` caps the whole wait. No device list (older builds, a stub without
    a card): the wait is `min_wait` and the readouts come back empty.
    """
    before = vram(base)
    http_json(f"{base}/free",
              {"unload_models": bool(unload_models), "free_memory": bool(free_memory)},
              timeout=timeout)
    tol = 64 * 2**20
    base_key = tuple(d["free"] for d in before)
    same = lambda a, b: len(a) == len(b) and all(abs(x - y) < tol for x, y in zip(a, b))  # noqa: E731
    last, cur, moved = None, [], False
    t0 = time.time()
    while True:
        time.sleep(poll)
        cur = vram(base)
        key = tuple(d["free"] for d in cur)
        el = time.time() - t0
        if not moved and key and not same(key, base_key):
            moved = True                      # the unload is landing
        elif moved and last is not None and same(key, last):
            break                             # ...and has stopped moving
        elif not moved and el >= min_wait:
            break                             # nothing to unload (or no card)
        if el >= settle:
            break
        last = key
    return before, cur


def clear_before_gen(base, cfg, say) -> bool:
    """The workers' shared 'start from an empty card' step; True if it ran.

    Called once per job, right before the first /prompt (after the graph has
    passed its checks, so a missing node fails BEFORE the unload, not after).
    Never raises: a ComfyUI without /free, or one that refuses, still renders.
    """
    # 2.352.0: a running native Viggle engine hands its model back first (RAM + VRAM)
    try:
        import native_client as _nc
        _nc.free_for_comfy(cfg, say)
    except Exception:                                       # noqa: BLE001  (never blocks a ComfyUI job)
        pass
    if not free_before_gen(cfg):
        say("[comfy] VRAM clear before generation is OFF (Settings -> ComfyUI)")
        return False
    try:
        before, after = free_memory(base)
    except Exception as e:                                  # noqa: BLE001
        say(f"[comfy] VRAM clear failed ({str(e)[:120]}) - rendering anyway")
        return False
    if before or after:
        say(f"[comfy] VRAM: {fmt_vram(before)} -> {fmt_vram(after)} "
            "(models unloaded, cache emptied)")
    else:
        say("[comfy] VRAM: ComfyUI models unloaded + cache emptied before this run")
    return True


def is_oom(messages) -> bool:
    """Did an execution_error blob say the GPU ran out of memory?"""
    try:
        blob = json.dumps(messages)
    except Exception:                                       # noqa: BLE001
        return False
    low = blob.lower()
    return ("outofmemoryerror" in low or "out of memory" in low
            or "allocation on device" in low or "cuda_error_out_of_memory" in low)


def is_retryable_sampler_failure(messages) -> bool:
    """True when a chunk should be RE-PLANNED SMALLER and retried, not failed.

    Two cases, and they are the SAME failure:
      1. a real torch out-of-memory (is_oom);
      2. an OSError / '[Errno 22] Invalid argument' raised INSIDE a Sampler node.

    Case 2 was written off as the ComfyUI-on-Windows stderr-flush bug for three
    sessions. Tim's logs disprove that: the IDENTICAL 362-frame run, on a
    cleared card, throws a clean torch.OutOfMemoryError one time and OSError
    [Errno 22] the next. A pure stdio bug would be deterministic; a clean OOM
    on the same clip proves the sampler is hitting a real allocation failure,
    and [Errno 22] is that same failure when a CUDA alloc on the edge of the
    card fails and leaves the context (and the flush) in a bad state. So the
    fix for both is the same: a shorter run. This is deliberately NARROW — the
    Errno-22 must be in a *Sampler* node. A non-sampler [Errno 22] is left to
    explain_execution_error (the genuine stderr-flush case), and if the ladder
    shrinks the clip to its floor and it STILL fails, that advice is printed.
    """
    if is_oom(messages):
        return True
    try:
        for m in (messages or []):
            if not (isinstance(m, list) and len(m) > 1 and isinstance(m[1], dict)):
                continue
            d = m[1]
            if str(d.get("exception_type", "")) != "OSError":
                continue
            if "[Errno 22] Invalid argument" not in str(d.get("exception_message", "")):
                continue
            if "sampler" in str(d.get("node_type", "")).lower():
                return True
    except Exception:                                       # noqa: BLE001
        return False
    return False


# ------------------------------------------- ACCELERATOR FAILURES (2.129.0)
# A video style can inject two MODEL patches (worker.py: `h3sage`,
# `h3spectrum`). Both are third-party packs that reach INSIDE ComfyUI's MiniMax
# H3 model, so both go stale when ComfyUI's internals move — and when one dies
# it takes the whole render with it, including an encode that has already cost
# minutes. The recognisers live HERE, next to is_oom, because one file knows
# what an error SHAPE means; worker.py decides what to do about it.
SAGE_NODE_TYPES = ("PathchSageAttentionKJ",
                   "MiniMaxH3MemoryEfficientSageAttentionPatch")
SPECTRUM_NODE_TYPE = "SpectrumApplyMiniMaxH3"
VEDA_NODE_TYPE = "VedaSparseAttention"     # 2.536.0: replaces attention (a Triton kernel) - worker.apply_video_accel
H3_INTERNAL_ARGS = ("sigma", "sample_sigmas", "shifts")


def _error_dicts(messages):
    """The dicts of every ['execution_error', {...}] style event. Never raises."""
    out = []
    try:
        for m in (messages or []):
            if isinstance(m, list) and len(m) > 1 and isinstance(m[1], dict):
                out.append(m[1])
            elif isinstance(m, dict):
                out.append(m)
    except Exception:                                       # noqa: BLE001
        return []
    return out


def _error_text(d) -> str:
    try:
        return " ".join([str(d.get("exception_type", "")),
                         str(d.get("exception_message", "")),
                         json.dumps(d.get("traceback") or [])])
    except Exception:                                       # noqa: BLE001
        return ""


def is_h3_internals_mismatch(messages) -> bool:
    """True for 'a node pack called the H3 model with the OLD signature'.

    THE SHAPE (Tim's run 2, ComfyUI 0.34, node 333 SamplerCustomAdvanced):
        TypeError: FinalLayer.forward() missing 3 required positional
                   arguments: 'sigma', 'sample_sigmas', and 'shifts'
    ComfyUI 0.34 moved sigma shifting INTO the H3 model — it also ships a new
    native `MiniMaxH3SigmaShift` node — so the transformer's own methods grew
    those arguments. Nothing in a stock graph calls them directly; a patch pack
    built against pre-0.34 internals does, and this is what that looks like.
    Deliberately narrow: a TypeError, on a `forward()`, naming at least one of
    the three arguments that moved. An ordinary TypeError gets nothing.
    """
    for d in _error_dicts(messages):
        if "TypeError" not in str(d.get("exception_type", "")):
            continue
        msg = str(d.get("exception_message", ""))
        if "forward()" not in msg:
            continue
        if ("missing" in msg and "positional argument" in msg
                and any(a in msg for a in H3_INTERNAL_ARGS)):
            return True
        if ("unexpected keyword argument" in msg
                and any(f"'{a}'" in msg for a in H3_INTERNAL_ARGS)):
            return True
    return False


def is_sage_failure(messages) -> bool:
    """True when SAGE ATTENTION itself is what failed.

    Two forms: the patch node raised (node_type is one of SAGE_NODE_TYPES —
    Tim's run 1: ImportError, 'DLL load failed while importing _fused', a
    sageattention wheel built for a different torch than ComfyUI's), or the
    text of some failure names the library. The H3-internals mismatch above is
    excluded: Sage patches ATTENTION, not the final layer, and blaming it for
    that error would disable the wrong accelerator.
    """
    if is_h3_internals_mismatch(messages):
        return False
    for d in _error_dicts(messages):
        if str(d.get("node_type", "")) in SAGE_NODE_TYPES:
            return True
        if "sageatt" in _error_text(d).lower():
            return True
    return False


def execution_culprits(messages):
    """The nodes an execution error actually blames, from ComfyUI's own
    history events: [(node_id, node_type, exception_type, first line of
    exception_message)], in event order.

    This exists because the worker's fallback verdict used to be generic
    advice ("check the MiniMax H3 nodes exist... model files in ComfyUI's
    OWN folders") which is WRONG BY CONSTRUCTION for an execution error:
    a missing node class or model filename is rejected at /prompt
    VALIDATION and never reaches execution, so by the time an
    execution_error arrives the nodes exist and the files resolved. The
    honest verdict names the failing node and its exception - which is
    exactly what the scene card's reasonFromLog wants to show. Never
    raises; junk messages yield [].
    """
    out = []
    try:
        for m in (messages or []):
            if not (isinstance(m, list) and len(m) > 1 and isinstance(m[1], dict)):
                continue
            d = m[1]
            if not (d.get("node_id") or d.get("node_type")):
                continue
            lines = str(d.get("exception_message") or "").strip().splitlines()
            out.append((str(d.get("node_id") or "?"),
                        str(d.get("node_type") or "?"),
                        str(d.get("exception_type") or ""),
                        lines[0].strip() if lines else ""))
    except Exception:                                       # noqa: BLE001
        return []
    return out


def culprit_details(messages):
    """The lines AFTER the first of each execution error's message, plus a
    traceback tail when the message was a one-liner: [(node_id, [line, ...])].

    Exists for the H3 preflight class of failure (2.153.0, Tim's card:
    "ValueError: H3 preflight error: 2 error(s), 2 warning(s), 3 scene(s).")
    - the pack puts the SUMMARY on line one and the itemized errors and
    warnings on the following lines of the same exception message, so a
    card built from line one alone names a count and nothing else. Never
    raises; junk yields [].
    """
    out = []
    try:
        for m in (messages or []):
            if not (isinstance(m, list) and len(m) > 1 and isinstance(m[1], dict)):
                continue
            d = m[1]
            if not (d.get("node_id") or d.get("node_type")):
                continue
            lines = [ln.strip() for ln in
                     str(d.get("exception_message") or "").strip().splitlines()[1:]
                     if ln.strip()]
            if not lines:
                tb = [str(t).rstrip() for t in (d.get("traceback") or []) if str(t).strip()]
                lines = [ln.strip() for ln in tb[-3:]]
            out.append((str(d.get("node_id") or "?"), lines[:12]))
    except Exception:                                       # noqa: BLE001
        return []
    return out


def failed_accelerator(messages, accel_nodes) -> str:
    """Which INJECTED accelerator node this failure blames, or "".

    `accel_nodes` is {node_id: class_type} for the accelerators actually in the
    graph, so nothing that is not there can be blamed and a run with one
    accelerator never loses the other. The H3-internals mismatch belongs to
    whichever pack reaches into the model: Spectrum first, else KJNodes' H3
    memory-efficient patch. The GENERIC Sage node is never blamed for it —
    it only replaces the attention function, so removing it would not fix the
    error and would cost the user speed for nothing; that case is reported
    with the advice text instead.
    """
    nodes = accel_nodes if isinstance(accel_nodes, dict) else {}
    if not nodes:
        return ""
    if is_h3_internals_mismatch(messages):
        for want in (SPECTRUM_NODE_TYPE, "MiniMaxH3MemoryEfficientSageAttentionPatch"):
            for nid, ct in nodes.items():
                if str(ct) == want:
                    return str(nid)
        return ""
    # 2.536.0: Veda - its own node failed, or the sampler died in a Veda / Triton kernel while Veda was the only
    # attention patch (its kernel runs inside the sampler's forward pass)
    veda = [str(nid) for nid, ct in nodes.items() if str(ct) == VEDA_NODE_TYPE]
    if veda:
        for d in _error_dicts(messages):
            t = _error_text(d).lower()
            if "out of memory" in t or "outofmemory" in t:
                continue                                    # memory: main()'s ladder, not the accelerator
            if str(d.get("node_type") or "") == VEDA_NODE_TYPE or str(d.get("node_id") or "") in veda or "veda" in t \
                    or ("triton" in t and not any(str(ct) in SAGE_NODE_TYPES for ct in nodes.values())):
                return veda[0]
    if is_sage_failure(messages):
        for nid, ct in nodes.items():
            if str(ct) in SAGE_NODE_TYPES:
                return str(nid)
    return ""


H3_INTERNALS_ADVICE = (
    "\n\n[worker] A node pack called the MiniMax H3 model with the OLD argument"
    "\n[worker] list ('FinalLayer.forward() missing ... sigma, sample_sigmas,"
    "\n[worker] shifts'). ComfyUI 0.34 moved sigma shifting INTO the H3 model"
    "\n[worker] (it ships a native MiniMaxH3SigmaShift node), so a patch pack"
    "\n[worker] built against the older internals no longer fits. The graph, the"
    "\n[worker] loaders and the references are fine - everything upstream of the"
    "\n[worker] sampler ran or came from cache."
    "\n[worker] In order of preference:"
    "\n[worker]   1. UPDATE the Spectrum pack: Settings -> ComfyUI -> Video"
    "\n[worker]      accelerators -> Install Spectrum (it git-pulls), then"
    "\n[worker]      restart ComfyUI."
    "\n[worker]   2. Set the video style's Spectrum to Off (Settings -> Video"
    "\n[worker]      styles). Sage attention can stay on - it patches attention"
    "\n[worker]      and is not what failed here."
    "\n[worker]   3. Use ComfyUI 0.34's own MiniMaxH3SigmaShift node in the"
    "\n[worker]      workflow instead of the third-party pack."
)


OOM_ADVICE = (
    "\n\n[worker] The GPU ran out of memory inside the sampler: this clip does not"
    "\n[worker] fit in the VRAM ComfyUI had for it. Every generation now starts"
    "\n[worker] with ComfyUI's models and cache cleared (the 'VRAM' line above"
    "\n[worker] shows what was free), so what is left is the graph itself."
    "\n[worker] In order of least damage to the result:"
    "\n[worker]   1. Generate -> Advanced: tick 'force split' and set Max seconds"
    "\n[worker]      per segment to 10 -- two chunks with the fl2va hand-off"
    "\n[worker]      instead of one 15 s run (10 s clips render, so this fits)."
    "\n[worker]   2. A smaller frame size: memory grows with width x height x"
    "\n[worker]      frames, and the sampler's attention buffers are the peak."
    "\n[worker]   3. Close whatever else sits on that card -- the status bar"
    "\n[worker]      shows used/total VRAM per GPU. A browser, a game launcher or"
    "\n[worker]      a second ComfyUI can hold gigabytes; make sure ComfyUI runs on"
    "\n[worker]      the bigger card (CUDA_VISIBLE_DEVICES / --cuda-device)."
    "\n[worker]   4. Start ComfyUI with --reserve-vram 4 (in its launch .bat, or"
    "\n[worker]      the custom launch command in Settings -> ComfyUI). ComfyUI"
    "\n[worker]      then streams part of the model from RAM and keeps that much"
    "\n[worker]      free for the sampler: slower per step, but longer clips fit."
    "\n[worker] If this run said the clear was OFF, turn it back on in Settings ->"
    "\n[worker] ComfyUI, or press 'Free VRAM now' there before generating."
)


class ComfyError(Exception):
    """Anything the caller should report to the user rather than trace."""


def base_url(cfg) -> str:
    return (((cfg.get("engine") or {}).get("comfy") or {})
            .get("url") or "http://127.0.0.1:8188").rstrip("/")


def http_json(url, payload=None, timeout=30, read_error_body=False):
    data = json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request(
        url, data=data,
        headers={"Content-Type": "application/json"} if data else {})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return json.loads(r.read().decode() or "{}")
    except urllib.error.HTTPError as e:
        # ComfyUI puts validation results (error + node_errors) in the BODY of a
        # 400. Reading it is the difference between "Value not in list:
        # 'flux1-dev.safetensors'" and an unexplained HTTP 400.
        if not read_error_body:
            raise
        try:
            return json.loads(e.read().decode() or "{}")
        except Exception:                                   # noqa: BLE001
            raise ComfyError(f"ComfyUI returned HTTP {e.code} with an unreadable body")


def preflight(base, timeout=5):
    """Is ComfyUI actually up? Checked BEFORE anything is uploaded, because the
    alternative is a ConnectionRefused traceback halfway through a job."""
    try:
        http_json(f"{base}/system_stats", timeout=timeout)
    except Exception as e:                                  # noqa: BLE001
        raise ComfyError(
            f"cannot reach ComfyUI at {base} ({e}). Start it first — the "
            "Start ComfyUI button under Generate, or Settings -> ComfyUI.")


def object_info(base, class_type=None, timeout=15):
    # 2.338.0: the class name is URL-encoded - "Power Lora Loader (rgthree)" /
    # "Any Switch (rgthree)" carry spaces and parentheses; unquoted, urllib
    # refused the URL and the class read as "no answer" (never checked)
    url = f"{base}/object_info" + (f"/{urllib.parse.quote(str(class_type), safe='')}" if class_type else "")
    try:
        return http_json(url, timeout=timeout)
    except Exception:                                       # noqa: BLE001
        return None            # a network hiccup must not read as "class absent"


def missing_classes(base, graph):
    """Class types the running ComfyUI does not have.

    Checked up front so a missing node pack fails with its own name in the
    message instead of a validation 400 listing node ids. A server that will not
    answer at all yields [] — an unreachable server is preflight's problem, and
    guessing "everything is missing" from a network error sends the user off to
    reinstall node packs they already have.
    """
    probe = object_info(base)
    if not isinstance(probe, dict) or not probe:
        return []
    missing = []
    for node in graph.values():
        ct = str(node.get("class_type") or "")
        if not ct or ct in missing:
            continue
        info = object_info(base, ct)
        if isinstance(info, dict) and ct not in info:
            missing.append(ct)
    return missing


def upload_image(base, path) -> str:
    boundary = uuid.uuid4().hex
    name = Path(path).name
    if name.lower().endswith(".jxl"):                   # 2.479.0: ComfyUI cannot read JPEG XL - its PNG goes
        import jxl_png
        path, name = jxl_png.png_for(path), Path(path).stem + ".png"
    body = (f"--{boundary}\r\nContent-Disposition: form-data; "
            f'name="image"; filename="{name}"\r\n'
            f"Content-Type: application/octet-stream\r\n\r\n").encode() \
        + Path(path).read_bytes() \
        + (f"\r\n--{boundary}\r\nContent-Disposition: form-data; "
           f'name="overwrite"\r\n\r\ntrue\r\n--{boundary}--\r\n').encode()
    req = urllib.request.Request(
        base + "/upload/image", data=body,
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}"})
    with urllib.request.urlopen(req, timeout=120) as r:
        j = json.loads(r.read().decode() or "{}")
    sub = j.get("subfolder") or ""
    return (sub + "/" if sub else "") + (j.get("name") or name)


COMBO_FIX_KEYS = ("unet_name", "ckpt_name", "model_name", "model_path",
                  "vae_name", "lora_name", "clip_name", "clip_name1",
                  "clip_name2", "clip_name3", "t5_name", "style_model_name",
                  "control_net_name", "upscale_model_name")


def canonicalise_combos(base, graph, keys=COMBO_FIX_KEYS):
    """Rewrite loader filenames to ComfyUI's OWN spelling, in place.

    THE CASE THIS FIXES: a style saved while ComfyUI was not running holds a
    name from our folder scan, which builds it with forward slashes. ComfyUI
    builds the same name with `os.path.relpath`, which on Windows returns
    BACKSLASHES. The file is the same file; the string is not, and combo
    validation is an exact string match, so the render is rejected for a model
    that is sitting right there.

    ONLY A SEPARATOR- OR CASE-ONLY DIFFERENCE IS REPAIRED, and only when
    exactly ONE entry matches. That is a spelling of the same path, not a guess:
    there is no file it could resolve to other than the one asked for. Anything
    less certain is left alone to be rejected with a suggestion, because
    rendering with quietly the wrong model looks like a bad checkpoint and
    costs far more than an error does.

    Returns [(node_id, input_name, old, new)] for logging. Never raises.
    """
    fixed = []
    cache = {}
    norm = lambda s: str(s).replace("\\", "/").lower()               # noqa: E731
    for nid, node in list(graph.items()):
        if str(nid).startswith("_") or not isinstance(node, dict):
            continue
        ct = str(node.get("class_type") or "")
        ins = node.get("inputs") or {}
        for key in keys:
            v = ins.get(key)
            if not isinstance(v, str) or not v.strip():
                continue
            ck = (ct, key)
            if ck not in cache:
                try:
                    cache[ck] = combo_values(base, ct, key)
                except Exception:                               # noqa: BLE001
                    cache[ck] = []
            names = cache[ck]
            if not names or v in names:
                continue                     # nothing to check, or already exact
            hits = [n for n in names if norm(n) == norm(v)]
            if len(hits) == 1:
                ins[key] = hits[0]
                fixed.append((str(nid), key, v, hits[0]))
    # 2.525.0: a diffusion model in ANOTHER loader's list (checkpoints) or another subfolder - every worker that
    # canonicalises gets it (relocate_model_loaders, below)
    try:
        fixed.extend(relocate_model_loaders(base, graph))
    except Exception:                                                   # noqa: BLE001
        pass
    return fixed


# 2.525.0 (Tim, after 2.523: "krea and anima still don't work" - node 70 UNETLoader.unet_name =
# Krea2/jibMixKrea_v60CarolinaReaper.safetensors "not in (list of length 72)": the file is not in
# diffusion_models / unet at all. A Civitai "Checkpoint" with a text encoder or VAE inside stays in
# models/checkpoints, and UNETLoader never lists that folder - but Load Checkpoint does, and ComfyUI's
# checkpoint loader loads a diffusion-model-only file too ("not a checkpoint file, trying to load it as a
# diffusion model only"). Its output 0 is the same MODEL, so the swap leaves the graph's own text encoder /
# VAE loaders in charge.
UNET_CLASSES = ("UNETLoader", "UnetLoaderGGUF", "UnetLoaderGGUFAdvanced")
CKPT_CLASS = "CheckpointLoaderSimple"


def _uses_outputs(graph, nid):
    """The output slots of node `nid` that any other node reads."""
    used = set()
    for _id, n in graph.items():
        if str(_id).startswith("_") or not isinstance(n, dict):
            continue
        for v in (n.get("inputs") or {}).values():
            if isinstance(v, list) and len(v) == 2 and str(v[0]) == str(nid) and isinstance(v[1], int):
                used.add(v[1])
    return used


_CATALOG = None


def catalog_hint(value):
    """2.531.0: a file the app's model catalog (lib/modelCatalog.json) can download -> the words saying where, else ''."""
    global _CATALOG
    if _CATALOG is None:
        try:
            p = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "lib", "modelCatalog.json")
            with open(p, encoding="utf-8") as f:
                _CATALOG = json.load(f).get("models") or []
        except Exception:                                               # noqa: BLE001
            _CATALOG = []
    want = str(value or "").replace("\\", "/").rsplit("/", 1)[-1].lower()
    if not want:
        return ""
    for m in _CATALOG:
        names = {str(m.get("as") or "").lower(), str(m.get("file") or "").rsplit("/", 1)[-1].lower()}
        if want in names:
            size = m.get("size") or 0
            gb = f", {size / 1e9:.1f} GB" if size else ""
            dest = str(m.get("dest") or "").replace("comfy/", "ComfyUI/models/")
            return (f"It is in the app's model catalog: Settings -> Models -> ⤓ Model catalog -> \"{m.get('label') or want}\"{gb} "
                    f"downloads it to {dest} (from huggingface.co/{m.get('repo')}). Restart ComfyUI after.")
    return ""


def find_model_name(names, wanted):
    """`wanted` in a ComfyUI list: the exact entry, else the ONE entry with the same path ignoring separators / case,
    else the ONE entry with the same FILE NAME (the same file in another subfolder). '' when none or ambiguous."""
    if not names or not wanted:
        return ""
    if wanted in names:
        return wanted
    norm = lambda x: str(x).replace("\\", "/").lower()                  # noqa: E731
    hits = [n for n in names if norm(n) == norm(wanted)]
    if len(hits) == 1:
        return hits[0]
    base = norm(wanted).rsplit("/", 1)[-1]
    hits = [n for n in names if norm(n).rsplit("/", 1)[-1] == base]
    return hits[0] if len(hits) == 1 else ""


def relocate_model_loaders(base, graph, lists=None):
    """A diffusion model ComfyUI's loader does not list -> the loader / name that DOES list it, in place.

      UNETLoader / UnetLoaderGGUF + a file only in Load Checkpoint's list -> CheckpointLoaderSimple (ckpt_name)
      any of them + the same file under another subfolder (one match by file name) -> that name
      CheckpointLoaderSimple + a file only UNETLoader lists, and nothing reads its CLIP / VAE -> UNETLoader
    `lists` (tests): {(class, key): [names]}; otherwise the running ComfyUI's own lists (combo_values).
    Returns [(node_id, key, old, new_description)]. Never raises; an unreachable server changes nothing."""
    out, cache = [], {}

    def names(ct, key):
        ck = (ct, key)
        if ck not in cache:
            if lists is not None:
                cache[ck] = list(lists.get(ck) or [])
            else:
                try:
                    cache[ck] = combo_values(base, ct, key)
                except Exception:                                       # noqa: BLE001
                    cache[ck] = []
        return cache[ck]

    for nid, node in list(graph.items()):
        if str(nid).startswith("_") or not isinstance(node, dict):
            continue
        ct = str(node.get("class_type") or "")
        ins = node.get("inputs") or {}
        if ct in UNET_CLASSES:
            key = "unet_name"
        elif ct == CKPT_CLASS:
            key = "ckpt_name"
        else:
            # 2.531.0 (Tim's Anima log: node 71 CLIPLoader.clip_name = qwen_3_06b_base.safetensors "not in (list of
            # length 25)"): every other loader file - a text encoder, a VAE, a LoRA, a ControlNet ... - that sits under
            # ANOTHER subfolder of its own list (one match by file name) is pointed at it too
            for k in COMBO_FIX_KEYS:
                v = ins.get(k)
                if k in ("unet_name", "ckpt_name") or not isinstance(v, str) or not v.strip():
                    continue
                own = names(ct, k)
                if not own or v in own:
                    continue
                hit = find_model_name(own, v)
                if hit:
                    ins[k] = hit
                    out.append((str(nid), k, v, f"{hit} (the same file in another folder of {ct}'s list)"))
            continue
        v = ins.get(key)
        if not isinstance(v, str) or not v.strip():
            continue
        own = names(ct, key)
        if not own or v in own:
            continue                       # no answer from the server, or it is there
        hit = find_model_name(own, v)
        if hit:
            ins[key] = hit
            out.append((str(nid), key, v, f"{hit} (the same file in another folder of {ct}'s list)"))
            continue
        if ct in UNET_CLASSES and not v.lower().endswith(".gguf"):
            hit = find_model_name(names(CKPT_CLASS, "ckpt_name"), v)
            if hit:
                node["class_type"] = CKPT_CLASS
                for k in ("unet_name", "weight_dtype", "dequant_dtype", "patch_dtype", "patch_on_device"):
                    ins.pop(k, None)
                ins["ckpt_name"] = hit
                out.append((str(nid), key, v, f"{hit} - loaded by Load Checkpoint (CheckpointLoaderSimple): the file "
                                              "is in ComfyUI's checkpoints folder, which the diffusion-model loader "
                                              "does not list; the workflow's own text encoder + VAE loaders stay"))
            continue
        if ct == CKPT_CLASS and not (_uses_outputs(graph, nid) & {1, 2}):
            hit = find_model_name(names("UNETLoader", "unet_name"), v)
            if hit:
                node["class_type"] = "UNETLoader"
                ins.pop("ckpt_name", None)
                ins["unet_name"] = hit
                ins.setdefault("weight_dtype", "default")
                out.append((str(nid), key, v, f"{hit} - loaded by UNETLoader: the file is in diffusion_models / unet"))
    return out


# Keys that are model-file choices a donor workflow can vouch for. lora_name
# is deliberately absent: LoRA slots belong to the style patcher, never to a
# donor workflow (whose slots are template blanks).
CARRY_KEYS = tuple(k for k in COMBO_FIX_KEYS if k != "lora_name")


def carry_loader_names(graph, donor):
    """Copy model-file names from a PROVEN donor workflow into this one.

    THE CASE THIS FIXES (2.209.0, Tim's hardware): the style's own t2i
    workflow renders daily — its loader filenames are known-good on this
    machine. The sibling edit workflow the reference swap picks was exported
    with its OWN baked names (the Klein edit shipped pointing at the BASE
    variant, 'flux-2-klein-base-9b-fp8.safetensors'), and a name the machine
    does not have fails validation before a single step runs. The donor is
    the workflow that provably loads, so its names outrank the sibling's.

    For each node here (LoraLoader excluded — the patcher owns those slots),
    the donor counterpart is the node with the SAME id and class, else the
    ONLY donor node of that class; two donor candidates is ambiguity and the
    node is left alone. Only CARRY_KEYS present as non-empty strings on BOTH
    sides are copied. Returns [(node_id, key, old, new)] for logging; copies
    in place; never raises.
    """
    out = []
    if not isinstance(donor, dict):
        return out
    by_class = {}
    for did, dn in donor.items():
        if str(did).startswith("_") or not isinstance(dn, dict):
            continue
        by_class.setdefault(str(dn.get("class_type") or ""), []).append((str(did), dn))
    for nid, node in graph.items():
        if str(nid).startswith("_") or not isinstance(node, dict):
            continue
        ct = str(node.get("class_type") or "")
        if not ct or ct == "LoraLoader":
            continue
        cands = by_class.get(ct) or []
        hit = next((dn for did, dn in cands if did == str(nid)), None)
        if hit is None and len(cands) == 1:
            hit = cands[0][1]
        if hit is None:
            continue
        ins = node.setdefault("inputs", {})   # setdefault: an empty-inputs
        dins = hit.get("inputs") or {}        # node must not get an orphan dict
        for key in CARRY_KEYS:
            mine, theirs = ins.get(key), dins.get(key)
            if (isinstance(mine, str) and isinstance(theirs, str)
                    and theirs.strip() and mine != theirs):
                ins[key] = theirs
                out.append((str(nid), key, mine, theirs))
    return out


def fill_required_inputs(base, graph):
    """Fill REQUIRED inputs the workflow export predates, from the server's
    own /object_info — its declared default first, else a combo's first
    choice. A required input with neither is left for validation to name.

    THE CASE THIS FIXES (2.209.0, Tim's hardware): his ComfyUI's
    ImageScaleToTotalPixels grew a required `resolution_steps` the bundled
    export never had — 'Required input is missing' before a single step. The
    video worker has healed this shape since 2.175.0 (_schema_sync); this is
    the image chain's equivalent. The value comes from the running server's
    own node definition — read, never guessed.

    Returns [(node_id, class_type, input_name, value, source)] for logging;
    fills in place; never raises (an unreachable server fills nothing).
    """
    out = []
    cache = {}
    for nid, node in graph.items():
        if str(nid).startswith("_") or not isinstance(node, dict):
            continue
        ct = str(node.get("class_type") or "")
        if not ct:
            continue
        if ct not in cache:
            req = {}
            info = object_info(base, ct)
            if isinstance(info, dict):
                spec = ((info.get(ct) or {}).get("input") or {})
                req = dict(spec.get("required") or {})
            cache[ct] = req
        ins = node.setdefault("inputs", {})   # setdefault, not `or {}` — an
        # empty-inputs node would otherwise be filled into an orphan dict
        for name, sp in cache[ct].items():
            if name in ins:
                continue
            opts = sp[1] if isinstance(sp, (list, tuple)) and len(sp) > 1 \
                and isinstance(sp[1], dict) else {}
            if "default" in opts:
                ins[name] = opts["default"]
                out.append((str(nid), ct, name, opts["default"], "server default"))
            elif isinstance(sp, (list, tuple)) and sp and isinstance(sp[0], list) and sp[0]:
                ins[name] = sp[0][0]
                out.append((str(nid), ct, name, sp[0][0], "first choice"))
    return out


def combo_values(base, class_type, input_name):
    """The exact list ComfyUI's dropdown holds for one input, or [].

    This is the SAME list its validator compares against, so a name taken from
    here cannot be rejected. Never raises: a suggestion is a courtesy on top of
    an error that is already being reported.
    """
    info = object_info(base, class_type)
    if not isinstance(info, dict):
        return []
    spec = ((info.get(class_type) or {}).get("input") or {})
    for group in ("required", "optional"):
        got = (spec.get(group) or {}).get(input_name)
        # A combo input is declared as [[choice, choice, ...], {opts}].
        if isinstance(got, list) and got and isinstance(got[0], list):
            return [str(x) for x in got[0]]
    return []


def nearest_values(names, wanted, limit=4):
    """Entries from `names` that a user asking for `wanted` probably meant.

    THE FAILURE THIS EXISTS FOR: ComfyUI says only
    `'flux_2_klein_9B/B04.safetensors' not in (list of length 430)`. The file is
    usually right there under a different NAME — a different subfolder prefix,
    or none at all, because ComfyUI names each entry relative to whichever
    search path it was found under, and `extra_model_paths.yaml` can make that
    root deeper than the folder bitGen Studio scanned. 430 entries is not a list
    anybody reads, so the one line that would end the problem never gets seen.

    Ordered by how likely the match is, most likely first:
      1. same filename, any folder  -- the near-certain case above
      2. same name ignoring case and slash direction
      3. same stem, different extension (.safetensors vs .sft)
      4. filename contains the wanted stem, or vice versa
    """
    want = str(wanted or "").strip()
    if not want or not names:
        return []
    norm = lambda s: s.replace("\\", "/").lower()                    # noqa: E731
    base_of = lambda s: norm(s).rsplit("/", 1)[-1]                   # noqa: E731
    stem_of = lambda s: base_of(s).rsplit(".", 1)[0]                 # noqa: E731
    wb, ws, wn = base_of(want), stem_of(want), norm(want)
    out = []

    def add(n):
        if n not in out and n != want:
            out.append(n)

    for n in names:
        if base_of(n) == wb:
            add(n)
    for n in names:
        if norm(n) == wn:
            add(n)
    for n in names:
        if stem_of(n) == ws:
            add(n)
    for n in names:
        if ws and (ws in stem_of(n) or stem_of(n) in ws):
            add(n)
    return out[:limit]


# 2.535.0: an option a newer ComfyUI has -> (the model it is for, the first ComfyUI that has it, a note).
# Source: docs.comfy.org/tutorials/flux/flux-3-klein ("need ComfyUI 0.41.0 or later"; the fix is in the 0.41.1 backport)
NEEDS_COMFY = {
    ("CLIPLoader", "type", "flux3"): ("FLUX 3 Klein", "0.41.0", "0.41.1 or newer is best - it has the fix for these templates"),
}
_FILE_INPUTS = ("ckpt_name", "unet_name", "clip_name", "clip_name1", "clip_name2", "clip_name3", "clip_name4", "vae_name",
                "lora_name", "control_net_name", "model_name", "style_model_name", "upscale_model", "gguf_name", "t5_name",
                "image", "audio", "video", "file")


def is_file_input(key, value):
    """A model / file input (its value names a file), or an option ComfyUI offers (a type, a sampler ...)?"""
    k = str(key or "")
    if k in ("type", "sampler_name", "scheduler", "weight_dtype", "dequant_dtype", "patch_dtype", "device", "clip_type", "mode", "method", "upscale_method", "crop"):
        return False                                   # options ComfyUI offers, whatever they look like
    if k in _FILE_INPUTS or k.endswith("_name") or k.endswith("_path"):
        return True
    v = str(value or "").lower()
    return "/" in v or "\\" in v or v.endswith((".safetensors", ".gguf", ".ckpt", ".pt", ".pth", ".bin", ".sft", ".onnx", ".png", ".jpg", ".wav", ".mp4"))


def comfy_version(base, timeout=3):
    """The running ComfyUI's version ("0.40.2") from /system_stats - "" when it cannot say."""
    try:
        st = http_json(f"{base}/system_stats", timeout=timeout) or {}
        return str((st.get("system") or {}).get("comfyui_version") or "")
    except Exception:
        return ""


def option_hint(ct, key, value, listed, base=None):
    """What to say when ComfyUI does not offer an OPTION (CLIPLoader.type = flux3): update ComfyUI (pure but the version)."""
    need = NEEDS_COMFY.get((ct, key, str(value)))
    ver = comfy_version(base) if base else ""
    out = [f"    '{value}' is a CHOICE of {ct}.{key}, not a file: this ComfyUI does not offer it - it is older than "
           + ("this model." if need else "this workflow.")]
    if need:
        out.append(f"    {need[0]} needs ComfyUI {need[1]} or newer ({need[2]})."
                   + (f" This one is {ver}." if ver else ""))
    elif ver:
        out.append(f"    This ComfyUI is {ver}.")
    out.append("    Update ComfyUI, then restart it: the portable build - run update\\update_comfyui.bat; a git install - "
               "git pull in the ComfyUI folder, then pip install -r requirements.txt; or ComfyUI-Manager -> Update ComfyUI.")
    if listed:
        out.append(f"    Its {key} choices here: " + ", ".join(str(x) for x in list(listed)[:40]))
    return out


def describe_rejection(res, graph=None, base=None):
    """A /prompt 400 body turned into something worth printing.

    With `graph` and `base`, a rejected combo value is looked up in ComfyUI's
    own list and the likely intended entry is named. Without them the output is
    exactly what it was before, so a caller that has neither loses nothing.
    """
    lines = []
    err = res.get("error") or {}
    if err:
        lines.append(str(err.get("message") or err)[:300])
        if err.get("details"):
            lines.append("  " + str(err["details"])[:300])
    renames = 0
    for nid, ne in (res.get("node_errors") or {}).items():
        for e in (ne.get("errors") or []):
            extra = e.get("extra_info") or {}
            bit = f"  node {nid}: {e.get('message')}"
            if extra.get("input_name"):
                bit += f" [{extra['input_name']}]"
            if extra.get("received_value") is not None:
                bit += f" = {str(extra['received_value'])[:120]}"
            lines.append(bit)
            if e.get("details"):
                lines.append("    " + str(e["details"])[:300])
            got = extra.get("received_value")
            key = extra.get("input_name")
            if not (graph and base and key and isinstance(got, str)):
                continue
            ct = str(((graph.get(str(nid)) or {}).get("class_type")) or "")
            if not ct:
                continue
            listed = combo_values(base, ct, key)
            if not is_file_input(key, got):
                # 2.535.0 (Tim's log: node 71 CLIPLoader.type = flux3 "not in (list of length 29)"): a CHOICE, not a
                # file - this ComfyUI is older than the model; saying "the file is not on a search path" sent him the
                # wrong way
                lines.extend(option_hint(ct, key, got, listed, base))
                continue
            near = nearest_values(listed, got)
            if near:
                lines.append("    ComfyUI lists this file as:")
                for n in near:
                    lines.append(f"      {n}")
                renames += 1
            else:
                lines.append("    ComfyUI has nothing by that name in "
                             f"{ct}.{key} — the file is not on a search path it "
                             "uses. Check extra_model_paths.yaml, or move it "
                             "into ComfyUI's own models folder.")
                hint = catalog_hint(got)
                if hint:
                    lines.append("    " + hint)
                if key in ("unet_name", "ckpt_name"):
                    # 2.525.0: the other loaders were asked too (relocate_model_loaders) - say so, and where to put it
                    lines.append("    It is not in Load Checkpoint's list (models/checkpoints) or the diffusion-model "
                                 "lists (models/diffusion_models, models/unet) either - in ANY subfolder. Put the "
                                 "file in ComfyUI/models/diffusion_models (a subfolder is fine), or add the folder "
                                 "it is in to extra_model_paths.yaml, then restart ComfyUI.")
    if renames:
        # WHY THE NAME DIFFERS AT ALL, said once rather than per node.
        lines.append("")
        lines.append("  ComfyUI names a file RELATIVE TO THE SEARCH PATH it was "
                     "found under, so a folder that is itself a search path in "
                     "extra_model_paths.yaml contributes no prefix. Pick the "
                     "name above in Settings -> Image and save the style; the "
                     "dropdown is rebuilt from ComfyUI whenever it is running.")
    return lines


# 2.384.0 (Tim: "when the job is done ... show metadata - seed, cfg, steps, model used, loras used"): what a graph
# renders with, read from the graph itself just before it is queued. Printed as ONE log line the server keeps as the
# job's metadata (lib/jobMeta.js parses "[meta] {...}"); never raises - metadata must not stop a render.
_MODEL_KEYS = ("unet_name", "ckpt_name", "model_name", "gguf_name", "diffusion_model", "base_model")
_MODEL_EXT = (".safetensors", ".gguf", ".ckpt", ".pt", ".pth", ".bin", ".sft")


def graph_meta(graph):
    meta = {"seeds": [], "steps": [], "cfg": [], "samplers": [], "models": [], "loras": []}
    try:
        for nd in (graph or {}).values():
            if not isinstance(nd, dict):
                continue
            ct, ins = str(nd.get("class_type") or ""), nd.get("inputs") or {}
            if not isinstance(ins, dict):
                continue
            for k in ("seed", "noise_seed"):
                v = ins.get(k)
                if isinstance(v, (int, float)) and not isinstance(v, bool) and v >= 0:
                    meta["seeds"].append(int(v))
            if isinstance(ins.get("steps"), (int, float)) and not isinstance(ins.get("steps"), bool):
                meta["steps"].append(int(ins["steps"]))
            if isinstance(ins.get("cfg"), (int, float)) and not isinstance(ins.get("cfg"), bool):
                meta["cfg"].append(round(float(ins["cfg"]), 3))
            if isinstance(ins.get("sampler_name"), str):
                meta["samplers"].append(ins["sampler_name"])
            if "lora" in ct.lower():
                nm = ins.get("lora_name") or ins.get("lora")
                if isinstance(nm, str) and nm:
                    w = ins.get("strength_model", ins.get("strength", ins.get("weight")))
                    meta["loras"].append({"name": nm.replace("\\", "/").split("/")[-1],
                                          "weight": round(float(w), 3) if isinstance(w, (int, float)) and not isinstance(w, bool) else None})
                continue
            if "loader" in ct.lower() or ct in ("UNETLoader", "CheckpointLoaderSimple"):
                for k in _MODEL_KEYS:
                    v = ins.get(k)
                    if isinstance(v, str) and v.lower().endswith(_MODEL_EXT):
                        meta["models"].append(v.replace("\\", "/").split("/")[-1])
    except Exception:                       # noqa: BLE001 - never stop a render over metadata
        pass
    out = {}
    if meta["seeds"]:
        out["seed"] = meta["seeds"][0]
        if len(set(meta["seeds"])) > 1:
            out["seeds"] = sorted(set(meta["seeds"]))[:8]
    if meta["steps"]:
        out["steps"] = max(meta["steps"])
    if meta["cfg"]:
        out["cfg"] = meta["cfg"][0]
    if meta["samplers"]:
        out["sampler"] = meta["samplers"][0]
    seen = set()
    out["models"] = [m for m in meta["models"] if not (m in seen or seen.add(m))][:6]
    lseen = set()
    out["loras"] = [x for x in meta["loras"] if not (x["name"] in lseen or lseen.add(x["name"]))][:12]
    return out


def print_meta(graph, extra=None):
    try:
        m = graph_meta(graph)
        if extra:
            m.update({k: v for k, v in extra.items() if v is not None})
        print("[meta] " + json.dumps(m, separators=(",", ":")), flush=True)
    except Exception:                       # noqa: BLE001
        pass


def queue(base, graph, client_id=None):
    print_meta(graph)
    res = http_json(f"{base}/prompt",
                    {"prompt": graph, "client_id": client_id or uuid.uuid4().hex},
                    timeout=60, read_error_body=True)
    pid = res.get("prompt_id")
    if not pid:
        raise ComfyError("ComfyUI rejected the workflow:\n"
                         + "\n".join(describe_rejection(res, graph, base)))
    return pid


def wait(base, pid, on_tick=None, timeout=7200, poll=1.0):
    """Block until the prompt finishes; return its outputs dict.

    on_tick(elapsed_seconds) is called about once a second so the caller can
    print a heartbeat — a render with no output for two minutes is otherwise
    indistinguishable from a hang.
    """
    t0 = time.time()
    last_tick = -1
    down = 0                    # 2.346.0: polls in a row ComfyUI did not answer
    while True:
        try:
            hist = (http_json(f"{base}/history/{pid}", timeout=15) or {}).get(pid)
            down = 0
        except (urllib.error.URLError, ConnectionError, OSError) as e:
            # Tim's Viggle run: a custom node ABORTED the ComfyUI process
            # mid-render ("Fatal Python error: Aborted"), and the job died as
            # "the worker crashed: URLError ... actively refused it". A few
            # misses are a blip; a run of them is ComfyUI gone - say so.
            down += 1
            if down >= 5:
                raise ComfyError(
                    "ComfyUI stopped answering while rendering - it most likely crashed "
                    f"({getattr(e, 'reason', e)}). Its console (the ComfyUI dock) shows why - "
                    "a custom node or out of memory. Start ComfyUI again and retry.")
            time.sleep(2.0)
            continue
        if hist:
            st = hist.get("status") or {}
            if st.get("status_str") == "error":
                msgs = []
                for m in (st.get("messages") or [])[-6:]:
                    msgs.append(json.dumps(m, ensure_ascii=False)[:600])
                raise ComfyError("ComfyUI reported an execution error:\n"
                                 + "\n".join(msgs)
                                 + explain_execution_error(st.get("messages") or []))
            if hist.get("outputs"):
                return hist["outputs"]
        el = int(time.time() - t0)
        if on_tick and el != last_tick:
            last_tick = el
            on_tick(el)
        if el > timeout:
            raise ComfyError(f"ComfyUI job timed out after {timeout}s")
        time.sleep(poll)


def output_images(outputs):
    """Every image item in a history outputs dict, in node order.

    `type` is carried through: a PreviewImage writes to temp/ rather than
    output/, and /view needs to be told which, or the download 404s on a
    workflow that previews instead of saving.
    """
    items = []
    for node_out in (outputs or {}).values():
        for key in ("images", "gifs"):
            for it in node_out.get(key, []) or []:
                nm = str(it.get("filename") or "")
                if nm.lower().endswith((".png", ".jpg", ".jpeg", ".webp", ".bmp")):
                    items.append(it)
    return items


VIDEO_EXT = (".mp4", ".webm", ".mov", ".mkv", ".avi")


def output_videos(outputs):
    """Every video item in a history outputs dict, in node order (2.223.12).

    A SaveVideo node reports under `videos` (some builds `gifs` or `files`),
    so every list key is read and the EXTENSION decides — the same rule
    output_audio() applies. `type` is carried through: previews write to
    temp/, saved videos to output/, and /view must be told which.
    """
    items = []
    for node_out in (outputs or {}).values():
        if not isinstance(node_out, dict):
            continue
        for key, lst in node_out.items():
            if not isinstance(lst, list):
                continue
            for it in lst:
                if not isinstance(it, dict):
                    continue
                nm = str(it.get("filename") or "")
                if nm.lower().endswith(VIDEO_EXT):
                    items.append(it)
    return items


AUDIO_EXT = (".mp3", ".wav", ".flac", ".ogg", ".opus", ".m4a", ".aac")


def output_text(outputs):
    """Every TEXT a history outputs dict carries, in node order (2.236.0 —
    YuE2 sheet music: PreviewAny is an OUTPUT_NODE whose ui payload is
    {"text": [value]}, and the ABC notation of the song rides it). Strings
    only; anything else a node put under `text` is ignored."""
    texts = []
    for node_out in (outputs or {}).values():
        if not isinstance(node_out, dict):
            continue
        lst = node_out.get("text")
        if not isinstance(lst, list):
            continue
        for t in lst:
            if isinstance(t, str) and t.strip():
                texts.append(t)
    return texts


def output_audio(outputs):
    """Every audio item in a history outputs dict, in node order (2.90.0).

    A SaveAudio* node reports under `audio` (PreviewAudio, older builds and some
    packs under `audios` or `files`), so every list key is read and the
    EXTENSION decides — the same rule output_images() applies to `images`/
    `gifs`. `type` is carried through for the same reason as there: a
    PreviewAudio writes to temp/, and /view has to be told which folder.
    """
    items = []
    for node_out in (outputs or {}).values():
        if not isinstance(node_out, dict):
            continue
        for key, lst in node_out.items():
            if not isinstance(lst, list):
                continue
            for it in lst:
                if not isinstance(it, dict):
                    continue
                nm = str(it.get("filename") or "")
                if nm.lower().endswith(AUDIO_EXT):
                    items.append(it)
    return items


def download(base, item, dest, timeout=600):
    q = urllib.parse.urlencode({"filename": item["filename"],
                                "subfolder": item.get("subfolder", ""),
                                "type": item.get("type", "output")})
    with urllib.request.urlopen(f"{base}/view?{q}", timeout=timeout) as r:
        Path(dest).write_bytes(r.read())
    return dest
