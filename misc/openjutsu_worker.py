#!/usr/bin/env python3
"""bitGen Studio — the OpenJutsu worker (2.949.0): mode "openjutsu" - the ⇄ Swap dialog's OpenJutsu engine.

Tim: "is this worth adding? https://github.com/D3voz/openjutsu" -> "lets do it".

One job = one OpenJutsu workflow run (lib/openjutsu.js fills the graph - simple / advanced / one pass per person /
object, or 👁 the mask check, 🎨 Fix colours, 🙂 Fix faces on a finished take):
  1. ComfyUI is asked for every node class the graph uses (missing ones -> the pack that has them, in words) and for
     the model files: a file it does not list is pointed at the nearest one of that kind it does (scripts/openjutsu_pick)
  2. the window is cut out of the video (ffmpeg, the sound kept) and uploaded with the character picture(s)
  3. the graph is queued and waited on (OpenJutsu's Context Loop chains ~6 s clips itself; a long window takes a while)
  4. the final video (the Final Video / Fixed video node's) -> the project's output as H.264 + AAC -> @@OUT

params: mode "openjutsu", kind, graph, uploads [{node, input, path}], final (node id), cut {start, length},
packs {class: pack folder}, seed, notes, openjutsu {...the summary's fields}.
"""
import json
import shutil
import subprocess
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))
import seedvr2_worker as W                                 # say / fail / listed / first_video / probe
import image_name as _iname
import comfy_progress as _CP
import openjutsu_pick as OP

say, fail = W.say, W.fail
STAGES = 4
ADDON = "Settings ▸ Add-ons ▸ OpenJutsu swap installs them - then restart ComfyUI"
CORE_MIN = "0.41.2"
TIMEOUT = 6 * 3600                                         # a minute of video at 1080p on a small card is hours


def stage(i, what):
    say(f"[worker] step {i}/{STAGES} - {what}")


def listed(base, cls, key):
    """ComfyUI's list for one loader input - None when it does not declare that input (then it is left alone and
    ComfyUI's own validation speaks), [] when the folder is empty."""
    info = W._comfy.object_info(base, cls)
    spec = (((info or {}).get(cls) or {}).get("input") or {})
    for group in ("required", "optional"):
        got = (spec.get(group) or {}).get(key)
        if got is not None:
            return W.SG.combo_list(got)
    return None


def cut_window(src, start, length, dest):
    """The part of the video OpenJutsu works on, sound kept (VHS cuts nothing then: skip 0, cap = the length)."""
    args = ["ffmpeg", "-y", "-loglevel", "error"]
    if start > 0:
        args += ["-ss", f"{start:.3f}"]
    args += ["-i", str(src)]
    if length > 0:
        args += ["-t", f"{length:.3f}"]
    args += ["-map", "0:v:0", "-map", "0:a:0?", "-c:v", "libx264", "-preset", "fast", "-crf", "10", "-pix_fmt", "yuv420p",
             "-c:a", "aac", "-b:a", "256k", str(dest)]
    r = subprocess.run(args, capture_output=True, text=True)
    if r.returncode != 0 or not Path(dest).is_file():
        fail("ffmpeg could not cut the window: " + (r.stderr or "").strip()[-300:])


def main():
    if len(sys.argv) != 2:
        fail("usage: openjutsu_worker.py <job.json>")
    try:
        job = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as e:
        fail(f"cannot read job file: {e}")
    params, cfg = job["params"], job["config"]
    output_dir = Path(job["output_dir"])
    output_dir.mkdir(parents=True, exist_ok=True)
    work = Path.cwd()
    if params.get("mode") != "openjutsu":
        fail(f"openjutsu_worker.py only runs mode=openjutsu (got {params.get('mode')!r})")
    kind = str(params.get("kind") or "")
    graph = params.get("graph")
    if not isinstance(graph, dict) or not graph:
        fail("the job has no OpenJutsu graph (lib/openjutsu.js builds it)")
    final = str(params.get("final") or "")
    say(f"[worker] openjutsu_worker.py kind={kind}")
    for n in params.get("notes") or []:
        say(f"[worker] {n}")
    _comfy = W._comfy
    if _comfy is None:
        fail(f"the ComfyUI modules could not be imported: {W._comfy_err}")
    base = _comfy.base_url(cfg)
    say(f"[worker] engine=comfy url={base}")
    try:
        _comfy.preflight(base)
    except _comfy.ComfyError as e:
        fail(str(e))

    # 1. the nodes and the files
    stage(1, "checking ComfyUI's nodes and model files")
    miss = _comfy.missing_classes(base, graph)
    if miss:
        packs = params.get("packs") or {}
        by = {}
        for c in miss:
            by.setdefault(packs.get(c) or "ComfyUI itself", []).append(c)
        ver = _comfy.comfy_version(base)
        words = "; ".join(f"{p}: {', '.join(cs)}" for p, cs in by.items())
        core = ""
        if "ComfyUI itself" in by:
            core = f" - OpenJutsu needs ComfyUI {CORE_MIN} or newer" + (f" (this one is {ver})" if ver else "") \
                + " for its MiniMax H3, SAM 3.1 and text-generation nodes: update ComfyUI"
        fail(f"ComfyUI is missing nodes OpenJutsu uses - {words}{core}. {ADDON}"
             + (" (🙂 Fix faces: tick it in the add-on)" if kind == "face" else ""))
    lists = {}
    for (cls, key, *_rest) in OP.RULES:
        if any(n.get("class_type") == cls for n in graph.values()) and (cls, key) not in lists:
            lists[(cls, key)] = listed(base, cls, key)
    changes, missing = OP.pick(graph, lists)
    for nid, key, old, new in changes:
        say(f"[worker]   {nid}.{key}: {old} is not in ComfyUI - using {new}")
    if missing:
        fail("ComfyUI has no " + "; no ".join(f"{what} ({old})" for _n, _k, old, what in missing) + f" - {ADDON}")
    for nid, key, _old, new in _comfy.canonicalise_combos(base, graph):
        say(f"[worker]   node {nid}.{key}: matched ComfyUI's spelling -> {new}")

    # 2. the window + the pictures
    stage(2, "cutting the window and uploading")
    ups = params.get("uploads") or []
    cut = params.get("cut") or {}
    c_start, c_len = max(0.0, float(cut.get("start") or 0)), max(0.0, float(cut.get("length") or 0))
    for i, u in enumerate(ups):
        p = Path(str(u.get("path") or ""))
        if not p.is_file():
            fail(f"{'the video' if u.get('input') == 'video' else 'a character picture'} is gone: {p}")
        src = p
        if u.get("input") == "video":
            info = W.probe(p) or {}
            say(f"[worker] {p.name}: {info.get('width', '?')}x{info.get('height', '?')} · {float(info.get('duration') or 0):.2f}s"
                + (" · with sound" if info.get("audio") else " · silent (OpenJutsu gets silence)")
                + (f" · window {c_start:.2f}s +{c_len:.2f}s" if (c_start or c_len) else ""))
            src = work / f"oj_{work.name}_source.mp4"
            cut_window(p, c_start, c_len, src)
        else:
            src = work / f"oj_{work.name}_{i}{p.suffix.lower() or '.png'}"
            shutil.copyfile(p, src)
        try:
            name = _comfy.upload_image(base, str(src))
        except Exception as e:                             # noqa: BLE001
            fail(f"could not upload {p.name} to ComfyUI: {e}")
        node = graph.get(str(u.get("node")))
        if not node:
            fail(f"the graph has no node {u.get('node')} for {p.name}")
        node.setdefault("inputs", {})[str(u.get("input"))] = name
        say(f"[worker] uploaded {p.name} -> {name}")
    oj = params.get("openjutsu") or {}
    say("[meta] " + json.dumps({"seed": params.get("seed"), "steps": oj.get("steps"), "engine": "openjutsu", "kind": kind,
                                "openjutsu": oj.get("pin")}))
    (work / "openjutsu_queued.json").write_text(json.dumps(graph, indent=1), encoding="utf-8")

    # 3. render
    stage(3, "rendering in ComfyUI (OpenJutsu chains its clips itself)")
    say("[worker] ===== chunk 1/1")
    try:
        _comfy.clear_before_gen(base, cfg, say, graph)
        _pid, outputs = _CP.run(_comfy, base, graph, say, "rendering", timeout=TIMEOUT)
    except _comfy.ComfyError as e:
        fail(str(e))
    it = None
    if final and isinstance((outputs or {}).get(final), dict):
        it = W.first_video({final: outputs[final]})
    it = it or W.first_video(outputs)
    if not it:
        fail("ComfyUI finished but saved no video (the graph ends in its Final Video node)")
    raw = work / ("openjutsu_raw" + (Path(str(it.get("filename") or "")).suffix.lower() or ".mp4"))
    _comfy.download(base, it, raw)
    if not raw.exists() or raw.stat().st_size == 0:
        fail(f"downloaded an empty file for {it.get('filename')}")

    # 4. the take
    stage(4, "writing the video")
    stem = str(params.get("output_name") or "") or _iname.build_stem(work.name, int(params.get("seed") or 0), time.time())
    name = _iname.reserve(output_dir, f"{stem}_openjutsu_{kind}.mp4")
    got = W.probe(raw) or {}
    if raw.suffix.lower() == ".mp4":
        shutil.copyfile(raw, output_dir / name)
    else:
        r = subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(raw), "-c:v", "libx264", "-pix_fmt", "yuv420p",
                            "-c:a", "aac", "-movflags", "+faststart", str(output_dir / name)], capture_output=True, text=True)
        if r.returncode != 0:
            fail("ffmpeg could not write the take: " + (r.stderr or "").strip()[-300:])
    got = W.probe(output_dir / name) or got
    say(f"[worker] {got.get('width', '?')}x{got.get('height', '?')}, {float(got.get('duration') or 0):.1f} s"
        + (", with sound" if got.get("audio") else " (no sound track)"))
    say(f"[worker] file 1/1 written -> {name}")
    say("@@OUT " + name)
    say("[worker] openjutsu complete")


if __name__ == "__main__":
    main()
