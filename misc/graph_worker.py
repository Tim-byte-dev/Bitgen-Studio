#!/usr/bin/env python3
"""bitGen Studio — the WIRED-GRAPH worker (2.120.0).

A FOURTH worker, beside worker.py (video), image_worker.py (stills) and
music_worker.py (songs), by the standing rule: a new generation kind gets its
own worker and an entry in `WORKER_FOR` (lib/core.js), never a branch inside
another one. Running an arbitrary user-supplied ComfyUI graph has nothing to
do with frame grids, style validation or lyric handling, and must not be able
to perturb any of them.

WHAT ARRIVES HERE IS ALREADY PATCHED. The binding (which control writes which
node input) lives in `lib/comfyGraphs.js`, and routes/index.js applies it
before the job is queued, so `params.graph` is a finished API prompt. There is
therefore NO second implementation of the control model in Python to drift
away from the JavaScript one — this file is transport and collection only.
That is deliberate: the last time two copies of "how a graph is patched"
existed (worker.py and comfy_client.py), they drifted.

Speaks the SAME control protocol as the other three:

    @@OUT <filename>           THE output file (relative to output_dir)
    @@OUTS <json [filenames]>  every file this job produced
    [worker] ===== chunk i/N   the STABLE progress line lib/core.js parses; 1/1.

COLLECTION IS BY EXTENSION, not by node class. A wired graph can end in
SaveImage, SaveAudio, a VHS video combine node or a pack's own saver, and the
history reports whatever key that node chose. Every list in the outputs dict is
walked and the FILENAME decides what the thing is — the same rule
comfy_client.output_audio() already applies, generalised.
"""
import json
import os
import signal
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

for _s in (sys.stdout, sys.stderr):
    try:
        _s.reconfigure(encoding="utf-8", errors="replace")
    except Exception:                                      # noqa: BLE001
        pass

VIDEO_EXT = (".mp4", ".webm", ".avi", ".mov", ".mkv", ".gif")
IMAGE_EXT = (".png", ".jpg", ".jpeg", ".webp", ".bmp")
AUDIO_EXT = (".mp3", ".wav", ".flac", ".ogg", ".opus", ".m4a", ".aac")
KNOWN_EXT = VIDEO_EXT + IMAGE_EXT + AUDIO_EXT


def say(line: str) -> None:
    try:
        print(line, flush=True)
    except UnicodeEncodeError:
        print(line.encode("ascii", "replace").decode("ascii"), flush=True)


def fail(msg: str) -> None:
    say("[worker] ERROR: " + msg)
    sys.exit(1)


def on_term(signum, _frame):
    """Cancel. ComfyUI keeps running; we simply stop waiting and collecting."""
    sys.exit(143)


for _sig in (signal.SIGTERM, signal.SIGINT):
    try:
        signal.signal(_sig, on_term)
    except Exception:                                      # noqa: BLE001
        pass


def collect(outputs):
    """Every produced file in a history outputs dict, in node order.

    Extension-driven on purpose (see the module header): a wired graph's saver
    node is whatever the user put there, so the key it reports under cannot be
    the test.
    """
    items = []
    for node_out in (outputs or {}).values():
        if not isinstance(node_out, dict):
            continue
        for lst in node_out.values():
            if not isinstance(lst, list):
                continue
            for it in lst:
                if not isinstance(it, dict):
                    continue
                if str(it.get("filename") or "").lower().endswith(KNOWN_EXT):
                    items.append(it)
    return items


def run(params, cfg, output_dir, stem, seed):
    base = _comfy.base_url(cfg)
    say(f"[worker] engine=comfy url={base}")
    _comfy.preflight(base)

    graph = params.get("graph")
    if not isinstance(graph, dict) or not graph:
        fail("this job carried no workflow. Wire a graph in "
             "Settings -> ComfyUI -> Graphs and pick it in Basic Settings.")
    say(f"[worker] graph '{params.get('graph_name') or '(unnamed)'}' "
        f"({len(graph)} nodes) from {params.get('graph_file') or '(inline)'}")
    for line in (params.get("graph_applied") or []):
        say(f"[worker]   {line}")
    for line in (params.get("graph_warnings") or []):
        say(f"[worker]   ! {line}")

    # THE REFERENCE FILES (2.121.0). The graph already names each loader and
    # the local file the reference dock gave it; ComfyUI cannot see this
    # machine's disk, so each is uploaded to ComfyUI's input folder and the
    # node gets the name ComfyUI hands back. Which loader gets which file, and
    # which unused loaders were bypassed, was decided in lib/comfyGraphs.js --
    # this is the upload and nothing else.
    for up in (params.get("graph_uploads") or []):
        src = Path(str(up.get("path") or ""))
        if not src.exists():
            fail(f"reference file not found: {src}")
        try:
            name = _comfy.upload_image(base, str(src))
        except Exception as e:                             # noqa: BLE001
            fail(f"could not upload {src.name} to ComfyUI: {e}")
        node = graph.get(str(up.get("node")))
        if not node:
            say(f"[worker]   ! uploaded {src.name} but node {up.get('node')} is gone")
            continue
        node.setdefault("inputs", {})[str(up.get("input"))] = name
        say(f"[worker]   uploaded {src.name} -> {name} "
            f"(node {up.get('node')}.{up.get('input')})")

    for nid, key, old, new in _comfy.canonicalise_combos(base, graph):
        say(f"[worker]   node {nid}.{key}: matched ComfyUI's spelling -> {new}")

    missing = _comfy.missing_classes(base, graph)
    if missing:
        fail("ComfyUI does not have these node types: " + ", ".join(missing)
             + ". Install the node pack that provides them (Manager -> Install "
               "Missing Custom Nodes), then re-export the workflow.")

    say("[worker] ===== chunk 1/1")
    _comfy.clear_before_gen(base, cfg, say)
    # 2.401.3: live "[comfy] step v/m" lines from ComfyUI's websocket (scripts/comfy_progress.py) - the job's
    # progress, the queue card and the status bar move instead of saying "loading" until the end
    pid, outputs = _CP.run(_comfy, base, graph, say, "rendering")

    items = collect(outputs)
    if not items:
        fail("ComfyUI finished but produced no file - does this workflow end in "
             "a Save node (SaveImage / SaveAudio / a video combine)? A graph "
             "that only previews writes nothing this app can collect.")
    produced = []
    for i, it in enumerate(items):
        ext = Path(str(it.get("filename") or "")).suffix.lower() or ".png"
        name = _iname.reserve(
            output_dir, _iname.image_name(stem, i, len(items), ext=ext))
        dest = output_dir / name
        _comfy.download(base, it, dest)
        if not dest.exists() or dest.stat().st_size == 0:
            fail(f"downloaded an empty file for {it.get('filename')}")
        produced.append(name)
        say(f"[worker] file {i + 1}/{len(items)} written -> {name}")
    return produced


def main() -> None:
    if len(sys.argv) != 2:
        fail("usage: graph_worker.py <job.json>")
    try:
        job = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as e:
        fail(f"cannot read job file: {e}")

    params, cfg = job["params"], job["config"]
    cfg["_app_dir"] = job.get("app_dir", str(Path.cwd()))
    output_dir = Path(job["output_dir"])
    output_dir.mkdir(parents=True, exist_ok=True)
    workdir = Path.cwd()

    if params.get("mode") != "graph":
        fail(f"graph_worker.py only runs mode=graph (got {params.get('mode')!r})")
    say("[worker] graph_worker.py mode=graph")
    if _comfy is None:
        fail(f"the ComfyUI modules could not be imported: {_comfy_err}")

    seed = int(params.get("seed", -1))
    started = time.time()
    stem = _iname.build_stem(workdir.name, seed, started)
    try:
        produced = run(params, cfg, output_dir, stem, seed)
    except _comfy.ComfyError as e:
        fail(str(e))
    say("@@OUTS " + json.dumps(produced))
    say("@@OUT " + produced[-1])
    say(f"[worker] {len(produced)} file(s) complete")
    sys.exit(0)


if __name__ == "__main__":
    main()
