#!/usr/bin/env python3
"""bitGen Studio — the MUSIC generation worker (2.90.0).

A THIRD worker, beside worker.py (video) and image_worker.py (stills), for the
same reason the image one exists: a song has nothing to do with frame grids,
chunk hand-off or seam drops, and a change to how a song is collected must not
be able to perturb a render. lib/core.js WORKER_FOR maps mode=music here; there
is no `if mode == "music"` anywhere in the other two.

WHY NOT A MODE INSIDE image_worker.py: the collection step is different in
kind. An image graph ends in SaveImage and the history reports `images`; a
music graph ends in SaveAudioAdvanced and reports `audio`, and the file lands
in the project's sound/ assets rather than images/. Everything ABOVE that step
(load the workflow, patch it, canonicalise combo spellings, check node classes,
queue, wait) is the shared transport in scripts/comfy_client.py and the shared
patcher in scripts/comfy_image.py — the things that must not be duplicated are
already in one place each.

Launched exactly like the others — `python music_worker.py <job.json>` — and
speaks the SAME control protocol back to lib/core.js:

    @@CMD <json argv>          not used here (no command line; ComfyUI is HTTP)
    @@OUT <filename>           THE output file (relative to output_dir)
    @@OUTS <json [filenames]>  every file this job produced
    [worker] ===== chunk i/N   the STABLE progress line core.js parses; 1/1.

TWO ENGINES since 2.229.0 (Tim: "use dropdown to change from minimax to
yue2(we will probably add more models later"). The dispatch is BY ARCH ID
(ENGINE_FOR below — the shared style normalizer clamps the style's own
engine field to "comfy", so the arch is the truth): every comfy arch rides
an Export (API) workflow through the user's ComfyUI exactly as before;
"yue2" shells the OFFICIAL YuE2 pipeline (pinned yue2-v0.1.6) from its own
venv — install it in Settings > Add-ons (2.540.4; get-yue2.ps1 is the manual route), first run downloads m-a-p/YuE2-3B from
Hugging Face. Adding a model later = a musicArch entry + a starter style
+ (a workflow for comfy, or a run_<engine> branch here).

THE LYRICS ARE THE PROMPT; the caption is the style's. Both reach the graph
through scripts/comfy_image.py, which writes the prompt into the encoder's
`lyrics` widget and the style's caption into `caption`.
"""
import json
import os
import re
import shutil
import signal
import subprocess
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))
try:
    import comfy_image as _cimg
    import comfy_client as _comfy
except Exception as _e:                                    # noqa: BLE001
    _cimg, _comfy, _comfy_err = None, None, _e
# THE one place that decides what a generated file is called — shared with the
# image worker, and extension-agnostic by design, so a song and a still are
# named by the same rule: <stamp>_s<seed>_<job id>.<ext>.
import image_name as _iname
import comfy_progress as _CP          # 2.401.3: live step lines from ComfyUI's websocket

# Windows consoles default to cp1252; force UTF-8 (with replacement) so a log
# line can never crash the worker with UnicodeEncodeError. Same guard as the
# other two workers — worker log strings stay ASCII regardless.
for _s in (sys.stdout, sys.stderr):
    try:
        _s.reconfigure(encoding="utf-8", errors="replace")
    except Exception:                                      # noqa: BLE001
        pass


def say(line: str) -> None:
    try:
        print(line, flush=True)
    except UnicodeEncodeError:
        print(line.encode("ascii", "replace").decode("ascii"), flush=True)


def fail(msg: str) -> None:
    say("[worker] ERROR: " + msg)
    sys.exit(1)


def on_term(signum, _frame):
    """Cancel. There is no child process here — ComfyUI keeps running and its
    queue entry is left to finish or be cleared from its own UI — so cancelling
    simply stops waiting and collecting."""
    sys.exit(143)


for _sig in (signal.SIGTERM, signal.SIGINT):
    try:
        signal.signal(_sig, on_term)
    except Exception:                                      # noqa: BLE001
        pass




# arch id -> runner. "comfy" is the default for any arch not listed.
ENGINE_FOR = {"yue2": "yue2"}


def _yue2_cli(app_dir: Path):
    """The pinned pipeline's CLI inside its own venv (Settings > Add-ons / get-yue2.ps1)."""
    for p in (app_dir / "yue2" / ".venv" / "Scripts" / "yue2.exe",
              app_dir / "yue2" / ".venv" / "bin" / "yue2"):
        if p.exists():
            return p
    return None


# 2.540.6: the ways to run YuE2's attention, fastest first - "auto" = scripts/yue2_run.py decides
# (FlashAttention when PyTorch really has it, else cuDNN in the CUDA graph); "sdpa" = PyTorch's own
# attention in the CUDA graph; "torch-eager" = no CUDA graph at all (the pipeline's --backend)
YUE2_WAYS = ("auto", "sdpa", "torch-eager")
ATTN_ERR = re.compile(r"FLASH_ATTENTION|FlashAttention|flash_attention|[Cc]u[Dd][Nn][Nn]|CUDNN|No available kernel|sdpa_kernel")


def _yue2_state(cli: Path) -> Path:
    """yue2/bitgen-attention.txt - next to yue2/.venv (cli = yue2/.venv/<Scripts|bin>/yue2)"""
    return cli.parent.parent.parent / "bitgen-attention.txt"


def _yue2_ways(cli: Path):
    """the ways to try, starting with the one that worked last time"""
    try:
        last = _yue2_state(cli).read_text(encoding="utf-8").strip()
    except OSError:
        last = ""
    return YUE2_WAYS[YUE2_WAYS.index(last):] if last in YUE2_WAYS else YUE2_WAYS


def _yue2_remember(cli: Path, way: str) -> None:
    try:
        st = _yue2_state(cli)
        if way == "auto":
            if st.exists():
                st.unlink()
        else:
            st.write_text(way, encoding="utf-8")
    except OSError:
        pass


def run_yue2(params, cfg, style, output_dir, stem, batch, seed):
    """One song (or a small batch) through the OFFICIAL YuE2 pipeline —
    lyrics are the prompt, the style's caption IS YuE2's style prompt, one
    fresh seed per song (seed + i, said in the log). Output: 48 kHz stereo
    FLAC, named by the same rule as every other generation."""
    import subprocess
    import tempfile
    app_dir = Path(cfg.get("_app_dir") or ".")
    cli = _yue2_cli(app_dir)
    if cli is None:
        fail("YuE2 is not installed - install it in Settings > Add-ons > "
             "YuE2 music (its own venv in yue2\\.venv, PyTorch + the pinned "
             "pipeline). Needs an NVIDIA GPU with BF16 and ~24 GB VRAM.")
    lyrics = str(params.get("prompt") or "").strip()
    if not lyrics:
        fail("YuE2 needs lyrics - the lyrics box is the prompt.")
    caption = str(style.get("caption") or "").strip()
    if not caption:
        fail("YuE2 needs a style prompt - the style's caption (genre, "
             "voice, instruments, mood, BPM).")
    if params.get("max_duration") is not None:
        say("[worker] YuE2: song length follows the lyrics and the model's "
            "own plan - the Length field does not apply")
    model = str(style.get("model") or "").strip() or "m-a-p/YuE2-3B"
    produced = []
    for i in range(batch):
        s_i = seed + i
        req = {"id": f"{stem}_{i}", "style": caption, "lyrics": lyrics,
               "cot": "full", "seed": s_i}
        with tempfile.TemporaryDirectory(prefix="yue2-") as td:
            req_file = Path(td) / "request.json"
            req_file.write_text(json.dumps(req), encoding="utf-8")
            out_dir = Path(td) / "song"
            say(f"[worker] ===== chunk {i + 1}/{batch}")
            say(f"[worker] YuE2 seed {s_i} - generating (first run downloads "
                f"{model} from Hugging Face; later runs are offline-capable)")
            # 2.540.4: the pipeline's CLI is `yue2 generate --request FILE` (`--input` belongs to
            # `yue2 batch`, and there is no default sub-command); the song lands in
            # <output>/<id>/audio.flac. PYTHONUTF8: it reads the request with the
            # locale's encoding - lyrics beyond ASCII need UTF-8 on Windows.
            # 2.540.6: through scripts/yue2_run.py in the same venv - on Windows it stops
            # huggingface_hub from symlinking its cache (WinError 1314 without Developer
            # Mode); the plain CLI is the fallback when the venv's python is not found
            vpy = cli.parent / ("python.exe" if os.name == "nt" else "python")
            runner = Path(__file__).resolve().parent.parent / "scripts" / "yue2_run.py"
            head = [str(vpy), str(runner)] if vpy.exists() and runner.exists() else [str(cli)]
            # 2.540.6: an attention kernel this PyTorch build lacks ("USE_FLASH_ATTENTION was
            # not enabled for build" - the Windows wheels) -> the next way: sdpa in the CUDA
            # graph, then --backend torch-eager; what worked is remembered (yue2/bitgen-attention.txt)
            ways = _yue2_ways(cli)
            for k, way in enumerate(ways):
                cmd = head + ["generate", "--model", model, "--request", str(req_file),
                              "--output", str(out_dir), "--quiet"]
                env = {**os.environ, "PYTHONUTF8": "1"}
                if way == "sdpa":
                    env["BITGEN_YUE2_ATTN"] = "sdpa"
                elif way == "torch-eager":
                    cmd += ["--backend", "torch-eager"]
                if way != "auto":
                    say(f"[worker] YuE2 attention: {way}")
                say("@@CMD " + json.dumps(cmd))
                try:
                    proc = subprocess.Popen(cmd, stdout=subprocess.PIPE,
                                            stderr=subprocess.STDOUT, text=True,
                                            encoding="utf-8", errors="replace", env=env)
                    tail = []
                    for line in proc.stdout:
                        line = line.rstrip()
                        if line:
                            tail = (tail + [line])[-12:]
                            say("[yue2] " + line)
                    rc = proc.wait()
                except OSError as e:
                    fail(f"could not launch the YuE2 pipeline: {e}")
                if rc == 0:
                    _yue2_remember(cli, way)
                    break
                if k + 1 < len(ways) and ATTN_ERR.search("\n".join(tail)):
                    say(f"[worker] YuE2: this PyTorch cannot run that attention kernel - trying {ways[k + 1]}")
                    shutil.rmtree(out_dir, ignore_errors=True)    # a fresh start for the next way
                    continue
                fail("YuE2 exited with code " + str(rc) + " - last lines:\n"
                     + "\n".join(tail))
            flac = out_dir / req["id"] / "audio.flac"
            if not flac.exists():
                found = sorted(out_dir.rglob("*.flac")) if out_dir.exists() else []
                if found:
                    flac = found[0]
                else:
                    fail("YuE2 finished but wrote no audio.flac in its output "
                         "folder - the run kept its score/settings there for "
                         "debugging: " + str(out_dir))
            name = _iname.reserve(
                output_dir, _iname.image_name(stem, i, batch, ext=".flac"))
            dest = output_dir / name
            dest.write_bytes(flac.read_bytes())
            if dest.stat().st_size == 0:
                fail("the copied song is empty: " + name)
            name = to_format(dest, params.get("audio_format"), say)
            produced.append(name)
            say(f"[worker] song {i + 1}/{batch} written -> {name}")
    return produced


def title_lead(title):
    """2.243.0: the filename-safe lead a song title becomes — alnum/space/
    dash/underscore kept, spaces to dashes, 60 chars, edges trimmed; an
    unusable title leads with nothing (the plain stem stands)."""
    t = "".join(c if (c.isalnum() or c in " -_") else "_" for c in str(title or "").strip())
    return "-".join(t.split())[:60].strip("-_")


def to_format(path, fmt, say=lambda s: None):
    """2.238.0 (Tim: "add a filetype to save the song to ... flac, mp3, wav"):
    convert a finished song to the picked container with ffmpeg. The graphs
    keep saving LOSSLESS flac (SaveAudioAdvanced's own options are flac/mp3/
    opus - wav is not one of them - and plain SaveAudio is flac-only), so
    one post-conversion covers EVERY engine identically: flac -> mp3 (lame
    V0) or wav (16-bit PCM) loses nothing a native save would keep. Returns
    the (possibly new) filename; on any ffmpeg trouble the flac is KEPT and
    named - a song you can play beats a format you asked for."""
    fmt = str(fmt or "").lower().lstrip(".")
    p = Path(path)
    if not fmt or p.suffix.lower() == "." + fmt:
        return p.name
    codec = {"mp3": ["-c:a", "libmp3lame", "-q:a", "0"],
             "wav": ["-c:a", "pcm_s16le"],
             "flac": ["-c:a", "flac"]}.get(fmt)
    if codec is None:
        say(f"[worker] unknown save format '{fmt}' - keeping {p.name}")
        return p.name
    out = p.with_suffix("." + fmt)
    try:
        r = subprocess.run(["ffmpeg", "-y", "-loglevel", "error",
                            "-i", str(p), *codec, str(out)],
                           capture_output=True, text=True, timeout=600)
        if r.returncode != 0 or not out.exists() or out.stat().st_size == 0:
            say("[worker] ffmpeg could not write ." + fmt + " ("
                + (r.stderr or "").strip()[:200] + ") - keeping " + p.name)
            out.unlink(missing_ok=True)
            return p.name
        p.unlink()
        say(f"[worker] converted -> {out.name}")
        return out.name
    except (OSError, subprocess.TimeoutExpired) as e:
        say(f"[worker] ffmpeg unavailable ({e}) - keeping {p.name}")
        return p.name


def run_comfy(params, cfg, style, output_dir, stem, batch, seed):
    """Render one song (or a batch) through the user's ComfyUI."""
    base = _comfy.base_url(cfg)
    say(f"[worker] engine=comfy url={base}")
    _comfy.preflight(base)

    rel = str(style.get("workflow") or "").strip()
    if not rel:
        fail("this music style has no ComfyUI workflow. In ComfyUI: open the "
             "MiniMax Music3 template (or your own song graph), Workflow -> "
             "Export (API), save the file, then pick it in Settings -> Music.")
    wf = Path(rel) if Path(rel).is_absolute() else Path(cfg["_app_dir"]) / rel
    if not wf.exists():
        fail(f"workflow not found: {wf}")
    graph = _cimg.load_workflow(str(wf))
    say(f"[worker] workflow {wf.name} ({len(graph)} nodes)")

    p = dict(params)
    p["batch"] = batch
    # 2.236.0 (YuE2 cover): the reference audio the route saved beside the
    # job is uploaded to ComfyUI's input folder FIRST, and the graph's
    # LoadAudio is pointed at the uploaded name (comfy_image.patch does the
    # pointing via p["ref_audio"]).
    ref = str(p.get("ref_path") or "")
    if ref:
        rp = Path(ref)
        if not rp.exists():
            fail(f"the reference audio is gone: {rp}")
        p["ref_audio"] = _comfy.upload_image(base, str(rp))
        say(f"[worker] reference audio uploaded -> {p['ref_audio']}")
    # The seed arrives ALREADY DRAWN from routes/index.js (lib/imageSeed.js — one
    # press, one seed, one filename), so the graph, the log line and the file
    # name all carry the same number.
    p["seed"] = seed
    graph, report = _cimg.patch(graph, style, p)
    for line in report:
        say(f"[worker]   {line}")

    # A saved style can spell a model name the other way round from ComfyUI's
    # list (the separator, 2.84.2); combo validation is an exact string match.
    for nid, key, old, new in _comfy.canonicalise_combos(base, graph):
        say(f"[worker]   node {nid}.{key}: matched ComfyUI's spelling -> {new}")

    missing = _comfy.missing_classes(base, graph)
    if missing:
        fail("ComfyUI does not have these node types: " + ", ".join(missing)
             + ". MiniMax Music3 needs a ComfyUI new enough to ship its native "
             "nodes (update ComfyUI), or install the node pack that provides "
             "them (Manager -> Install Missing Custom Nodes).")

    say("[worker] ===== chunk 1/1")
    _comfy.clear_before_gen(base, cfg, say)   # empty card first (2.98.0)
    # 2.401.3: live "[comfy] step v/m" lines from ComfyUI's websocket (scripts/comfy_progress.py) - the job's
    # progress, the queue card and the status bar move instead of saying "loading" until the end
    pid, outputs = _CP.run(_comfy, base, graph, say, "rendering")

    # 2.236.0 (Tim: "add a tab to our music docker for sheet music"): the ABC
    # notation rides the history as PreviewAny text. A sheet-only job
    # (want="abc") produces ONLY the .abc file; a song job writes the sheet
    # beside its audio, one press = the song AND its score.
    abc_texts = _comfy.output_text(outputs)
    if str(p.get("want") or "") == "abc":
        if not abc_texts:
            fail("ComfyUI finished but returned no ABC notation - does the "
                 "workflow end in a PreviewAny node fed by the ABC output?")
        name = _iname.reserve(output_dir, _iname.image_name(stem, 0, 1, ext=".abc"))
        (output_dir / name).write_text("\n\n".join(abc_texts), encoding="utf-8")
        say(f"[worker] sheet music written -> {name}")
        return [name]

    items = _comfy.output_audio(outputs)
    if not items:
        fail("ComfyUI finished but produced no audio - does the workflow end in "
             "a SaveAudio / SaveAudioAdvanced node?")
    produced = []
    use = items[:batch] if len(items) >= batch else items
    for i, it in enumerate(use):
        ext = Path(str(it.get("filename") or "")).suffix.lower() or ".mp3"
        # reserve() before every write: a name already on disk is a song
        # somebody rendered, and overwriting it is the one failure here that
        # destroys work instead of reporting it.
        name = _iname.reserve(
            output_dir, _iname.image_name(stem, i, len(use), ext=ext))
        dest = output_dir / name
        _comfy.download(base, it, dest)
        if not dest.exists() or dest.stat().st_size == 0:
            fail(f"downloaded an empty file for {it.get('filename')}")
        name = to_format(dest, p.get("audio_format"), say)
        produced.append(name)
        say(f"[worker] song {i + 1}/{len(use)} written -> {name}")
    if abc_texts:
        # the batch shares one score (the latent batch rides one conditioning)
        sheet = Path(produced[0]).stem + ".abc"
        try:
            (output_dir / sheet).write_text("\n\n".join(abc_texts), encoding="utf-8")
            say(f"[worker] sheet music written beside the song -> {sheet}")
        except OSError as e:
            say(f"[worker] sheet music not written ({e}) - the song stands alone")
    return produced


def main() -> None:
    if len(sys.argv) != 2:
        fail("usage: music_worker.py <job.json>")
    try:
        job = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as e:
        fail(f"cannot read job file: {e}")

    params, cfg = job["params"], job["config"]
    cfg["_app_dir"] = job.get("app_dir", str(Path.cwd()))
    output_dir = Path(job["output_dir"])
    output_dir.mkdir(parents=True, exist_ok=True)
    workdir = Path.cwd()

    if params.get("mode") != "music":
        fail(f"music_worker.py only runs mode=music (got {params.get('mode')!r})")
    # Named in the log on purpose: three workers share one log format, and
    # "which one actually ran" is the first question when a job goes wrong.
    say("[worker] music_worker.py mode=music")
    if _cimg is None or _comfy is None:
        fail(f"the ComfyUI modules could not be imported: {_comfy_err}")

    stored = params.get("style") or {}
    if not stored:
        fail("no music style was sent - create one in Settings -> Music.")
    if str(stored.get("kind") or "image") != "music":
        fail(f"style '{stored.get('name')}' is an image style, not a music one "
             "- pick a music style (Settings -> Music).")

    batch = max(1, min(4, int(params.get("batch") or 1)))
    seed = int(params.get("seed", -1))
    fresh = bool(params.get("seed_random"))
    started = time.time()
    # The job dir's name IS the job id (lib/core.js makeJob), fresh per press —
    # which is what makes the filename unique even for a pinned seed rendered
    # twice in the same second. scripts/image_name.py owns the rule.
    stem = _iname.build_stem(workdir.name, seed, started)
    # 2.243.0 (Tim: "add a title input for the song"): a titled song LEADS
    # its filename — Neon-Nights_<stamp>_sN_<job>.flac — sanitized flat,
    # with the stamp/seed/job behind it so uniqueness never depends on the
    # title. The .abc score beside the song inherits the same stem.
    title = str(params.get("title") or "").strip()
    if title and title_lead(title):
        stem = title_lead(title) + "_" + stem
        say(f"[worker] song title: '{title}' -> filenames lead with {title_lead(title)}")
    if fresh:
        say(f"[worker] seed {seed} - freshly rolled for this press "
            "(it is in the filename, so the song can be made again)")
    say(f"[worker] music: style='{stored.get('name')}' arch={stored.get('arch')} "
        f"duration={stored.get('max_duration')}s batch={batch} seed={seed}")
    engine = ENGINE_FOR.get(str(stored.get("arch") or ""), "comfy")
    say(f"[worker] engine={engine} (arch decides - ENGINE_FOR)")
    try:
        if engine == "yue2":
            produced = run_yue2(params, cfg, stored, output_dir, stem, batch, seed)
        else:
            produced = run_comfy(params, cfg, stored, output_dir, stem, batch, seed)
    except _cimg.PatchError as e:
        fail(str(e))
    except _comfy.ComfyError as e:
        fail(str(e))
    say("@@OUTS " + json.dumps(produced))
    say("@@OUT " + produced[-1])
    say(f"[worker] {len(produced)} song(s) complete")
    sys.exit(0)


if __name__ == "__main__":
    main()
