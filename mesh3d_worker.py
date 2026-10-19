#!/usr/bin/env python3
"""bitGen Studio — a picture -> a 3D model (.glb) worker (2.404.0): mode "mesh3d".

Tim (verbatim): "can we add option 1 + the image to workflow?" - the image-to-3D half: a picture (one the scene plan
generated for a hero object, or any gallery / asset picture sent to 3D) becomes a .glb in the project's models3d/,
where the Blender scene builder, the .blend preview's + Model and the timeline's 3D layers find it.

  1. ComfyUI's lists: which image-to-3D files it has (lib/mesh3d.LOADERS);
  2. Comfy-Org's template for the engine (Hunyuan3D 2.1 / 2.0 = the shape, TRELLIS.2 / Pixal3D = shape + texture) is
     prepared and converted by the app's node (scripts/mesh3d_convert.js: lib/mesh3d.prepare + lib/graphToApi against
     the live /object_info);
  3. the picture is uploaded, the graph queued and waited on (live step lines);
  4. the .glb is downloaded into models3d/<name>.glb (+ a link in the output folder, which the job's completion reads).

params: mode "mesh3d", picture (abs path), name (file stem), engine (auto|hunyuan|trellis), seed, models_dir (abs, the
project's models3d), label. The four stages print "[worker] step i/4" for the queue's card.
"""
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent / "scripts"))
try:
    import comfy_client as _comfy
except Exception as _e:                                    # noqa: BLE001
    _comfy, _comfy_err = None, _e
import comfy_progress as _CP
import swap_graph as SG

for _s in (sys.stdout, sys.stderr):
    try:
        _s.reconfigure(encoding="utf-8", errors="replace")
    except Exception:                                      # noqa: BLE001
        pass

STAGES = 4
LOADERS = [("ImageOnlyCheckpointLoader", "ckpt_name"), ("UNETLoader", "unet_name"), ("VAELoader", "vae_name"),
           ("CLIPVisionLoader", "clip_name"), ("LoadBackgroundRemovalModel", "bg_removal_name"),
           ("LoadMoGeModel", "model_name")]


def say(line):
    try:
        print(line, flush=True)
    except UnicodeEncodeError:
        print(line.encode("ascii", "replace").decode("ascii"), flush=True)


def fail(msg):
    say("[worker] ERROR: " + msg)
    sys.exit(1)


def stage(i, what):
    say(f"[worker] step {i}/{STAGES} - {what}")


def lists_of(base):
    """{"Class.input": [files]} for every loader ComfyUI has ([] for a class it does not know)."""
    out = {}
    for c, k in LOADERS:
        try:
            info = _comfy.object_info(base, c) or {}
        except Exception:                                  # noqa: BLE001
            info = {}
        spec = ((info.get(c) or {}).get("input") or {})
        got = None
        for g in ("required", "optional"):
            if k in (spec.get(g) or {}):
                got = spec[g][k]
        out[f"{c}.{k}"] = SG.combo_list(got) if got is not None else []
    return out


def node_cmd(job, *args):
    exe = str(job.get("node_exe") or "") or shutil.which("node") or "node"
    script = str(Path(job.get("app_dir") or Path(__file__).resolve().parent) / "scripts" / "mesh3d_convert.js")
    env = dict(os.environ)
    env["ELECTRON_RUN_AS_NODE"] = "1"
    return subprocess.run([exe, script] + [str(a) for a in args], capture_output=True, text=True, env=env, timeout=180)


def glb_of(outputs):
    """The first .glb SaveGLB saved ({filename, subfolder, type}) - its ui key is "3d"."""
    for node_out in (outputs or {}).values():
        for key in ("3d", "meshes", "files"):
            for it in (node_out or {}).get(key) or []:
                if isinstance(it, dict) and str(it.get("filename") or "").lower().endswith((".glb", ".gltf")):
                    return it
    for node_out in (outputs or {}).values():
        for lst in (node_out or {}).values():
            for it in lst if isinstance(lst, list) else []:
                if isinstance(it, dict) and str(it.get("filename") or "").lower().endswith(".glb"):
                    return it
    return None


def free_name(d, stem, ext):
    name, k = f"{stem}{ext}", 1
    while (d / name).exists():
        k += 1
        name = f"{stem}_{k}{ext}"
    return name


def main():
    if len(sys.argv) != 2:
        fail("usage: mesh3d_worker.py <job.json>")
    try:
        job = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as e:
        fail(f"cannot read job file: {e}")
    params, cfg = job["params"], job["config"]
    output_dir = Path(job["output_dir"])
    output_dir.mkdir(parents=True, exist_ok=True)
    work = Path.cwd()
    if params.get("mode") != "mesh3d":
        fail(f"mesh3d_worker.py only runs mode=mesh3d (got {params.get('mode')!r})")
    pic = Path(str(params.get("picture") or ""))
    if not pic.is_file():
        fail(f"the picture is gone: {pic}")
    models_dir = Path(str(params.get("models_dir") or "")) if params.get("models_dir") else output_dir.parent / "models3d"
    models_dir.mkdir(parents=True, exist_ok=True)
    stem = "".join(ch if ch.isalnum() or ch in "._()-" else "_" for ch in str(params.get("name") or pic.stem))[:80] or "model"
    say(f"[worker] mesh3d_worker.py picture={pic.name} -> models3d/{stem}.glb")

    if _comfy is None:
        fail(f"the ComfyUI modules could not be imported: {_comfy_err}")
    base = _comfy.base_url(cfg)
    say(f"[worker] engine=comfy url={base}")
    try:
        _comfy.preflight(base)
    except _comfy.ComfyError as e:
        fail(str(e))

    # 1. what ComfyUI has
    stage(1, "finding the image-to-3D model")
    lists = lists_of(base)
    up = None
    try:
        up = _comfy.upload_image(base, str(pic))
    except Exception as e:                                 # noqa: BLE001
        fail(f"could not upload {pic.name} to ComfyUI: {e}")
    say(f"[worker] uploaded {pic.name} -> {up}")
    seed = int(params.get("seed") or 0)
    opts = {"engine": params.get("engine") or "auto", "lists": lists, "image": up, "seed": seed,
            "prefix": "bitgen_mesh3d/" + stem}
    (work / "mesh3d_opts.json").write_text(json.dumps(opts), encoding="utf-8")

    # 2. the template, converted against this ComfyUI
    stage(2, "preparing Comfy-Org's template")
    r = node_cmd(job, "classes", work / "mesh3d_opts.json")
    try:
        cls = json.loads(r.stdout or "{}")
    except json.JSONDecodeError:
        fail("the template could not be read: " + (r.stderr or r.stdout or "").strip()[-400:])
    if cls.get("error"):
        fail(cls["error"])
    info = {}
    for c in cls.get("classes") or []:
        try:
            info.update(_comfy.object_info(base, c) or {})
        except Exception:                                  # noqa: BLE001
            pass
    miss = [c for c in cls.get("classes") or [] if c not in info]
    if miss:
        fail(f"this ComfyUI does not have {', '.join(miss)} - {cls.get('label')} needs a recent ComfyUI (update it)")
    (work / "mesh3d_info.json").write_text(json.dumps(info), encoding="utf-8")
    r = node_cmd(job, "convert", work / "mesh3d_opts.json", work / "mesh3d_info.json", work / "mesh3d_api.json")
    try:
        conv = json.loads((work / "mesh3d_api.json").read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        fail("the template did not convert: " + (r.stderr or r.stdout or "").strip()[-400:])
    graph = conv.get("graph")
    if not graph:
        fail("the template did not convert: " + "; ".join(conv.get("warnings") or [])[:400])
    for n in conv.get("notes") or []:
        say(f"[worker] {n}")
    for w in conv.get("warnings") or []:
        if "UI-only" not in w:
            say(f"[worker]   {w}")
    say("[meta] " + json.dumps({"seed": seed, "engine": conv.get("label"), "picture": pic.name}))
    (work / "mesh3d_queued.json").write_text(json.dumps(graph, indent=1), encoding="utf-8")

    # 3. render
    stage(3, f"{conv.get('label')} is building the model")
    try:
        _comfy.clear_before_gen(base, cfg, say)
        pid, outputs = _CP.run(_comfy, base, graph, say, "modelling")
    except _comfy.ComfyError as e:
        fail(str(e))
    it = glb_of(outputs)
    if not it:
        fail("ComfyUI finished but saved no .glb (the graph ends in SaveGLB)")

    # 4. into models3d/
    stage(4, "saving the model")
    name = free_name(models_dir, stem, ".glb")
    dest = models_dir / name
    _comfy.download(base, it, dest)
    if not dest.exists() or dest.stat().st_size < 20 or dest.read_bytes()[:4] != b"glTF":
        fail(f"downloaded a broken .glb for {it.get('filename')}")
    link = output_dir / name
    try:
        if link.exists():
            link.unlink()
        os.link(dest, link)
    except OSError:
        shutil.copyfile(dest, link)
    say(f"[worker] {dest.stat().st_size // 1024} KB -> models3d/{name}")
    say(f"[worker] file 1/1 written -> {name}")
    say("@@MODEL3D " + name)
    say("@@OUT " + name)
    say("[worker] mesh3d complete")


if __name__ == "__main__":
    main()
