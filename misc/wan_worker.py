#!/usr/bin/env python3
"""bitGen Studio — WAN 2.1 / WAN 2.2 worker (2.368.0): mode "wan".

Tim (verbatim): "add a wan2.1 style so we can use wan as well, also wan2.2".

One job = one clip:
  1. the pictures go up to ComfyUI (start / last / reference);
  2. the model files are picked from what ComfyUI lists (scripts/wan_graph.pick_models: the family + the
     mode's word in the name - t2v / i2v / flf2v / vace, high / low for 2.2), the text encoder, VAE and CLIP
     vision likewise (the style's own names first);
  3. the graph is built from ComfyUI's core Wan nodes (scripts/wan_graph.build), queued, waited on;
  4. the 16 fps take becomes 24 fps (motion-interpolated) H.264, with the job's sound laid under it (Wan
     makes no sound) -> @@OUT.

params: mode "wan", wan_family (wan21|wan22), wan_mode (t2v|i2v|flf2v|ref|ati), prompt, negative, width,
height, frames (Wan's, 4k+1 at 16 fps), seconds, seed, steps, cfg, images {start, end, ref} (abs paths),
audio {path, start} | null, interpolate (default true), video_style (the style: phases' models, te, vae,
loras), output_name (optional stem).
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
try:
    import clipjoin as _cj                                 # 2.388.0: Append / Prepend a reference video
except Exception:                                          # noqa: BLE001
    _cj = None
import swap_graph as SG
import wan_graph as WG

for _s in (sys.stdout, sys.stderr):
    try:
        _s.reconfigure(encoding="utf-8", errors="replace")
    except Exception:                                      # noqa: BLE001
        pass


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


def listed(base, class_type, key):
    """ComfyUI's dropdown for one loader input ([] when it does not say)."""
    info = _comfy.object_info(base, class_type)
    spec = (((info or {}).get(class_type) or {}).get("input") or {})
    for group in ("required", "optional"):
        got = (spec.get(group) or {}).get(key)
        if got is not None:
            return SG.combo_list(got)
    return []


def first_video(outputs):
    vids = _comfy.output_videos(outputs) if hasattr(_comfy, "output_videos") else []
    if vids:
        return vids[0]
    for node_out in (outputs or {}).values():
        for lst in (node_out or {}).values():
            for it in lst if isinstance(lst, list) else []:
                if isinstance(it, dict) and str(it.get("filename") or "").lower().endswith(_comfy.VIDEO_EXT):
                    return it
    return None


def main():
    if len(sys.argv) != 2:
        fail("usage: wan_worker.py <job.json>")
    try:
        job = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as e:
        fail(f"cannot read job file: {e}")
    params, cfg = job["params"], job["config"]
    output_dir = Path(job["output_dir"])
    output_dir.mkdir(parents=True, exist_ok=True)
    work = Path.cwd()
    if params.get("mode") != "wan":
        fail(f"wan_worker.py only runs mode=wan (got {params.get('mode')!r})")
    fam, wmode = params.get("wan_family"), params.get("wan_mode")
    if fam not in WG.FAMILIES or wmode not in WG.MODES:
        fail(f"unknown Wan job: family {fam!r}, mode {wmode!r}")
    style = params.get("video_style") if isinstance(params.get("video_style"), dict) else {}
    say(f"[worker] wan_worker.py family={fam} mode={wmode}" + (f" style={style.get('name')}" if style else ""))
    if _comfy is None:
        fail(f"the ComfyUI modules could not be imported: {_comfy_err}")
    base = _comfy.base_url(cfg)
    say(f"[worker] engine=comfy url={base}")
    try:
        _comfy.preflight(base)
    except _comfy.ComfyError as e:
        fail(str(e))

    # 2.388.0: Append / Prepend - the video's frame (one of the pictures) upscaled to the render's size first
    fop = params.get("frame_op") if isinstance(params.get("frame_op"), dict) else None
    if fop:
        if _cj is None:
            fail("scripts/clipjoin.py did not load - Append / Prepend cannot run")
        cz = None
        if fop.get("upscaler"):
            cz = {"upload": lambda p: _comfy.upload_image(base, str(p)), "queue": lambda g: _comfy.queue(base, g),
                  "wait": lambda pid: _comfy.wait(base, pid), "fetch": lambda it, dest: _comfy.download(base, it, Path(dest))}
        _cj.prepare(fop, say, lambda c: subprocess.run(c, capture_output=True).returncode, cz)

    # 1. pictures
    imgs = params.get("images") or {}
    up = {}
    for key, what in (("start", "start frame"), ("end", "last frame"), ("ref", "reference picture")):
        p = imgs.get(key)
        if not p:
            continue
        p = Path(str(p))
        if not p.is_file():
            fail(f"the {what} is missing: {p}")
        try:
            up[key] = _comfy.upload_image(base, str(p))
        except Exception as e:                             # noqa: BLE001
            fail(f"could not upload the {what} to ComfyUI: {e}")
        say(f"[worker] uploaded the {what} {p.name} -> {up[key]}")

    # 2.399.0: the timeline's 🎥 camera path (lib/camPlan.forWan): the EXACT path = its depth guide as VACE's control
    # video (a VACE model listed), else the Fun Camera model's move (a Fun Camera model listed + a start picture), else
    # the words already in the prompt carry it - each choice said
    cam = params.get("camera") if isinstance(params.get("camera"), dict) else None
    if cam:
        unets0 = listed(base, "UNETLoader", "unet_name")
        hh = int(params.get("height") or 720)
        picked = False
        if cam.get("exact") and cam.get("depth"):
            dp = Path(str(cam["depth"]))
            vk = WG.pick_models(unets0, fam, "vctrl", [], hh) if dp.is_file() else {"error": f"the depth guide is gone: {dp.name}"}
            if not vk.get("error"):
                g16 = work / "camguide_wan.mp4"
                r = subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(dp), "-vf", "fps=16",
                                    "-frames:v", str(int(params.get("frames") or 81)), "-an", "-c:v", "libx264",
                                    "-pix_fmt", "yuv420p", "-crf", "12", str(g16)], capture_output=True, text=True)
                if r.returncode != 0 or not g16.is_file():
                    say("[camera] could not resample the depth guide to 16 fps: " + (r.stderr or "").strip()[-200:])
                else:
                    try:
                        up["control"] = _comfy.upload_image(base, str(g16))
                    except Exception as e:                 # noqa: BLE001
                        fail(f"could not upload the camera guide to ComfyUI: {e}")
                    if up.get("start") or up.get("ref"):
                        up["ref"] = up.get("start") or up.get("ref")
                    wmode, picked = "vctrl", True
                    say(f"[camera] the exact path: {dp.name} (resampled to 16 fps) is VACE's control video"
                        + (", the first picture its reference" if up.get("ref") else ""))
            else:
                say(f"[camera] exact path: {vk['error']} - trying the Fun Camera move")
        if not picked and cam.get("pose"):
            start = up.get("start") or up.get("ref")
            if not start:
                say("[camera] Wan's Fun Camera starts from a picture - the reference dock has none: the camera words carry it")
            else:
                ck = WG.pick_models(unets0, fam, "camera", [], hh)
                if ck.get("error"):
                    say(f"[camera] {ck['error']} - the camera words carry it")
                else:
                    up["start"] = start
                    wmode, picked = "camera", True
                    say(f"[camera] Fun Camera: {cam['pose']}" + (" (the nearest of its moves)" if cam.get("approx") else ""))
        if picked and up.get("end"):
            say("[camera] the last picture is not used - the camera move decides where the clip ends")

    # 2. files, from what ComfyUI lists
    unets = listed(base, "UNETLoader", "unet_name")
    wanted = [str((ph or {}).get("model") or "") for ph in (style.get("phases") or [])]
    h = int(params.get("height") or 720)
    pk = WG.pick_models(unets, fam, wmode, wanted, h)
    if pk.get("error") and wmode == "ref":
        # no VACE file: the reference picture starts the clip instead (i2v) - said
        alt = WG.pick_models(unets, fam, "i2v", wanted, h)
        if not alt.get("error"):
            say(f"[worker] {pk['error']} - rendering image-to-video from the reference picture instead")
            wmode, pk = "i2v", alt
            up["start"] = up.get("ref")
    if pk.get("error"):
        fail(pk["error"])
    for n in pk.get("notes") or []:
        say(f"[worker] {n}")
    # 2.409.0: Basic Settings' Override model - as it is (Wan 2.1: the model; Wan 2.2: the HIGH-noise one, the low stays)
    bm = str(params.get("basic_model") or "").strip()
    if bm and pk.get("models"):
        pk["models"][0] = bm
        say(f"[worker] model {bm} (Basic Settings - Override style)" + (" as the high-noise model; the low-noise one stays "
            + pk["models"][1] if fam == "wan22" and len(pk["models"]) > 1 else ""))
    te = WG.pick_file(listed(base, "CLIPLoader", "clip_name"), str((style.get("te") or [""])[0] or ""),
                      r"umt5", WG.TE_HINT)
    vae = WG.pick_file(listed(base, "VAELoader", "vae_name"), str(style.get("vae") or ""),
                       r"wan_?2[._]1_?vae|wan2\.1_vae|wan_2\.1_vae", WG.VAE_HINT)
    clipv = WG.pick_file(listed(base, "CLIPVisionLoader", "clip_name"), "", r"clip_vision_h", WG.CLIPV_HINT) \
        if fam == "wan21" and wmode in ("i2v", "flf2v", "ati", "camera") else ""
    say(f"[worker] text encoder {te} · VAE {vae}" + (f" · CLIP vision {clipv}" if clipv else ""))
    loras = [{"name": str(l.get("path") or l.get("name") or ""), "strength": l.get("weight", l.get("strength", 1.0))}
             for l in (style.get("loras") or []) if (l or {}).get("path") or (l or {}).get("name")]
    ph = (style.get("phases") or [{}])[0] or {}
    st, snotes = WG.settings(fam, params.get("steps") or ph.get("steps") or 0,
                             params.get("cfg") if params.get("cfg") not in (None, 0) else ph.get("cfg"), loras)
    for n in snotes:
        say(f"[worker] {n}")
    seed = int(params.get("seed", -1))
    if seed < 0:
        seed = random.randrange(0, 2 ** 31)
        say(f"[worker] seed -1 -> random seed {seed}")
    try:
        graph, notes = WG.build({
            "family": fam, "mode": wmode, "prompt": params.get("prompt") or "",
            "negative": params.get("negative") or style.get("negative") or "",
            "width": params.get("width"), "height": params.get("height"), "frames": params.get("frames"),
            "seed": seed, "steps": st["steps"], "cfg": st["cfg"], "models": pk["models"], "te": te, "vae": vae,
            "clip_vision": clipv, "loras": loras, "images": up, "prefix": "bitgen_wan/" + work.name,
            "tracks": params.get("tracks") or [],          # 2.387.0: the path layers' drawn paths (mode ati)
            "camera": cam or {},                           # 2.399.0: the Fun Camera move / the guide's strength
        })
    except ValueError as e:
        fail(str(e))
    for n in notes:
        say(f"[worker] {n}")
    miss = _comfy.missing_classes(base, graph)
    if miss:
        fail("ComfyUI does not have these node types, which Wan needs: " + ", ".join(miss)
             + " - update ComfyUI (the Wan nodes are core nodes since 2025).")
    for nid, key, _old, new in _comfy.canonicalise_combos(base, graph):
        say(f"[worker]   node {nid}.{key}: matched ComfyUI's spelling -> {new}")
    (work / "wan_queued.json").write_text(json.dumps(graph, indent=1), encoding="utf-8")

    # 3. render
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
        fail("ComfyUI finished but saved no video (the graph ends in SaveVideo)")
    raw = work / ("wan_raw" + (Path(str(it.get("filename") or "")).suffix.lower() or ".mp4"))
    _comfy.download(base, it, raw)
    if not raw.exists() or raw.stat().st_size == 0:
        fail(f"downloaded an empty file for {it.get('filename')}")

    # 4. 24 fps + the sound
    stem = str(params.get("output_name") or "") or _iname.build_stem(work.name, seed, time.time())
    name = _iname.reserve(output_dir, f"{stem}_wan.mp4")
    au = params.get("audio") if isinstance(params.get("audio"), dict) and (params.get("audio") or {}).get("path") else None
    if au and not Path(str(au["path"])).is_file():
        say(f"[worker] the sound {au['path']} is gone - the take stays silent")
        au = None
    interp = params.get("interpolate", True) is not False
    args = WG.finish_args(raw, output_dir / name, au and au["path"], (au or {}).get("start") or 0, None, interp)
    r = subprocess.run(args, capture_output=True, text=True)
    if r.returncode != 0 and interp:
        say("[worker] motion interpolation failed - plain 24 fps instead: " + (r.stderr or "").strip()[-200:])
        r = subprocess.run(WG.finish_args(raw, output_dir / name, au and au["path"], (au or {}).get("start") or 0,
                                          None, False), capture_output=True, text=True)
    if r.returncode != 0:
        fail("ffmpeg could not finish the take: " + (r.stderr or "").strip()[-300:])
    say("[worker] 16 fps -> 24 fps" + (" (motion-interpolated)" if interp else "")
        + (f", the sound {Path(str(au['path'])).name} from {float(au.get('start') or 0):.2f}s laid under it" if au else ""))
    if fop:                                                # 2.388.0: the new part joined to the video
        part_name = _iname.reserve(output_dir, Path(name).stem + "_part.mp4")
        shutil.copyfile(output_dir / name, output_dir / part_name)
        try:
            _cj.join(fop, output_dir / part_name, output_dir / name, say, lambda c: subprocess.run(c, capture_output=True).returncode)
            say(f"[frame-op] the new part alone is kept as {part_name}")
        except Exception as e:                             # noqa: BLE001
            fail(f"could not {fop.get('op')} the new part: {e} (the part is {part_name})")
    say(f"[worker] file 1/1 written -> {name}")
    say("@@OUT " + name)
    say("[worker] wan complete")


if __name__ == "__main__":
    main()
