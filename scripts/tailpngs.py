"""bitGen Studio — THE TAKE'S LAST 2 SECONDS AS HIGH-RES PNGs (2.313.0).

Tim (verbatim): "can we save the last 2 seconds of the video as 1080p png,
and use one of those frames to continue the video or first frame for next
video, i am still losing a lot of quality when getting to scene 8. save the
png's to song name\\scene_<n>\\song name_scene_<n>_x.png. add option in video
docker settings for png size, upscaler dropdown.
https://docs.comfy.org/tutorials/basic/upscale"

After a scene render the worker writes the take's last `seconds` (2 s = 48
frames) as PNGs at the chosen size, read from the take's LOSSLESS master
when there is one:
  upscaler ""      ffmpeg lanczos straight to the size (fast, no ComfyUI)
  upscaler <file>  ComfyUI's image-upscale workflow, one frame per prompt
                   (comfy_workflows/image_upscale_model.json - the docs'
                   LoadImage -> UpscaleModelLoader -> ImageUpscaleWithModel
                   -> SaveImage, plus ImageScale to land on the size); a
                   failure falls back to lanczos for the whole set, said
Files: <dir>/<stem>_<x>.png, x = 1..count in time order (the last one is
the take's final frame), plus <dir>/tail.json {take, files, first_index,
count, fps, time_from, width, height, upscaler, source}. The app continues
the next scene from these (lib/tailFrames.js).
"""
import copy
import json
import shutil
import time
from pathlib import Path

TEMPLATE = Path(__file__).resolve().parents[1] / "comfy_workflows" / "image_upscale_model.json"
META = "tail.json"
# 2.314.0 (Tim: "please use this workflow to upscale images - seedvr2 model"):
# his own export, verbatim - SeedVR2 7B int8 (LoadImage -> Resize x N ->
# SeedVR2Preprocess -> VAEEncodeTiled -> SeedVR2Conditioning -> KSampler 1
# step -> VAEDecodeTiled -> SeedVR2PostProcessing -> SaveImage)
SEEDVR2 = "seedvr2"
SEEDVR2_TEMPLATE = (Path(__file__).resolve().parents[1] / "comfy_workflows"
                    / "utility_seedvr2_7b_int8_upscale_image_api.json")
SEEDVR2_SEED = 42           # one seed for every frame: neighbouring frames stay alike


def png_size(p):
    """(width, height) straight from a PNG's IHDR - no ffprobe needed."""
    b = Path(p).read_bytes()[:24]
    if b[:8] != b"\x89PNG\r\n\x1a\n":
        return None
    return int.from_bytes(b[16:20], "big"), int.from_bytes(b[20:24], "big")


def graph_seedvr2(image, src_w, src_h, width, height, prefix, seed=SEEDVR2_SEED, template=None):
    """Tim's SeedVR2 workflow for ONE frame: the picture, the resize
    multiplier that reaches the PNG size (SeedVR2 refines at that size), the
    save prefix, a fixed seed; the ImageCompare preview node (UI-only, it
    reads the SaveImage) is dropped - there is no one to look at it."""
    g = copy.deepcopy(template if template is not None
                      else json.loads(SEEDVR2_TEMPLATE.read_text(encoding="utf-8")))
    for k in [k for k, v in g.items() if v.get("class_type") == "ImageCompare"]:
        g.pop(k)
    mult = round(max(width / max(1, src_w), height / max(1, src_h)), 4)
    for v in g.values():
        ct, ins = v.get("class_type"), v.setdefault("inputs", {})
        if ct == "LoadImage":
            ins["image"] = image
        elif ct == "ResizeImageMaskNode" and "resize_type.multiplier" in ins:
            ins["resize_type"] = "scale by multiplier"
            ins["resize_type.multiplier"] = mult
        elif ct == "SaveImage":
            ins["filename_prefix"] = prefix
        elif ct in ("KSampler", "KSamplerAdvanced") and "seed" in ins:
            ins["seed"] = int(seed)
    return g


def save_node(g):
    return next((k for k, v in g.items() if v.get("class_type") == "SaveImage"), None)


def plan(total_frames, fps=24, seconds=2.0):
    """(first index, count) of the tail window."""
    total = max(0, int(total_frames))
    count = min(total, max(1, int(round(float(seconds) * fps))))
    return total - count, count


def names(stem, count):
    return [f"{stem}_{x}.png" for x in range(1, count + 1)]


def extract_cmd(src, first, count, pattern, width=None, height=None):
    """ffmpeg: frames first..first+count-1 of src as a numbered PNG set
    (starting at 1), lanczos-scaled when a size is given."""
    vf = f"select=between(n\\,{int(first)}\\,{int(first) + int(count) - 1})"
    if width and height:
        vf += f",scale={int(width)}:{int(height)}:flags=lanczos"
    return ["ffmpeg", "-y", "-loglevel", "error", "-i", str(src), "-vf", vf,
            "-vsync", "0", "-start_number", "1", "-frames:v", str(int(count)), str(pattern)]


def graph(image, model, width, height, prefix, template=None):
    """The image-upscale workflow for ONE frame."""
    g = copy.deepcopy(template if template is not None else json.loads(TEMPLATE.read_text(encoding="utf-8")))
    sub = {"@image": image, "@model": model, "@width": int(width), "@height": int(height), "@prefix": prefix}
    for v in g.values():
        for k, val in list((v.get("inputs") or {}).items()):
            if isinstance(val, str) and val in sub:
                v["inputs"][k] = sub[val]
    return g


def clear(d, stem):
    d = Path(d)
    if not d.exists():
        return 0
    n = 0
    for f in list(d.glob(f"{stem}_*.png")) + [d / META]:
        try:
            f.unlink()
            n += 1
        except FileNotFoundError:
            pass
    return n


def run(spec, src, take_name, *, say, run_cmd, probe_frames, comfy=None):
    """Write the tail PNGs. comfy = {base, upload(path)->name,
    queue(graph)->prompt_id, wait(prompt_id)->outputs, fetch(item, dest)}
    - only needed with an upscaler. Returns the meta dict (or None)."""
    d = Path(spec["dir"])
    stem = str(spec["stem"])
    w, h = int(spec["width"]), int(spec["height"])
    fps = int(spec.get("fps") or 24)
    up = str(spec.get("upscaler") or "")
    d.mkdir(parents=True, exist_ok=True)
    clear(d, stem)
    total = probe_frames(src)
    if total <= 0:
        say(f"[tail] could not count the frames of {Path(src).name} - no tail PNGs")
        return None
    first, count = plan(total, fps, spec.get("seconds", 2))
    files = names(stem, count)
    how = "lanczos"
    t0 = time.time()
    if up and comfy:
        tmp = d / (".native_" + stem)
        shutil.rmtree(tmp, ignore_errors=True)
        tmp.mkdir(parents=True)
        try:
            rc = run_cmd(extract_cmd(src, first, count, tmp / "%d.png"))
            nat = [tmp / f"{x}.png" for x in range(1, count + 1)]
            if rc != 0 or not all(p.exists() for p in nat):
                raise RuntimeError("could not extract the native frames")
            seedvr = up == SEEDVR2
            say(f"[tail] upscaling {count} frame(s) "
                + ("with SeedVR2 7B (your ComfyUI workflow)" if seedvr else f"with {up}")
                + f" to {w}x{h}")
            pids, saves = [], []
            for i, p in enumerate(nat):
                name = comfy["upload"](p)
                prefix = f"bitgen_tail/{stem}_{i + 1}"
                if seedvr:
                    sw, sh = png_size(p) or (w, h)
                    gr = graph_seedvr2(name, sw, sh, w, h, prefix)
                else:
                    gr = graph(name, up, w, h, prefix)
                saves.append(save_node(gr))
                pids.append(comfy["queue"](gr))
            for i, pid in enumerate(pids):
                outs = comfy["wait"](pid) or {}
                items = ((outs.get(saves[i]) or {}).get("images")) or []
                if not items:
                    raise RuntimeError(f"frame {i + 1}: the upscale returned no image")
                comfy["fetch"](items[0], d / files[i])
                if seedvr and png_size(d / files[i]) != (w, h):
                    # the multiplier lands NEAR the size (SeedVR2 pads to its
                    # grid): one lanczos step makes it exact
                    fit = d / (".fit_" + files[i])
                    rc2 = run_cmd(["ffmpeg", "-y", "-loglevel", "error", "-i", str(d / files[i]),
                                   "-vf", f"scale={w}:{h}:flags=lanczos", str(fit)])
                    if rc2 != 0 or not fit.exists():
                        raise RuntimeError(f"frame {i + 1}: could not fit the SeedVR2 output to {w}x{h}")
                    fit.replace(d / files[i])
            how = up
        except Exception as e:                  # noqa: BLE001 - lanczos never fails the take
            say(f"[tail] the ComfyUI upscale failed ({e}) - lanczos for the tail instead")
            clear(d, stem)
            up = ""
        finally:
            shutil.rmtree(tmp, ignore_errors=True)
    if not up:
        rc = run_cmd(extract_cmd(src, first, count, d / f"{stem}_%d.png", w, h))
        if rc != 0:
            say("[tail] ffmpeg could not write the tail PNGs")
            return None
    got = [f for f in files if (d / f).exists()]
    meta = {"take": take_name, "files": got, "first_index": first, "count": len(got), "fps": fps,
            "time_from": round(first / fps, 4), "width": w, "height": h, "upscaler": how,
            "source": Path(src).name}
    (d / META).write_text(json.dumps(meta, indent=2), encoding="utf-8")
    say(f"[tail] {len(got)} PNG(s) of the last {count / fps:.1f}s at {w}x{h} ({how}) -> "
        f"{d.name}/{stem}_1..{len(got)}.png in {time.time() - t0:.0f}s")
    return meta
