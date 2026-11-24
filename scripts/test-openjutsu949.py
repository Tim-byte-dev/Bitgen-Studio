#!/usr/bin/env python3
"""bitGen Studio — 2.949.0: the ⇄ Swap dialog's OpenJutsu engine (Tim: "is this worth adding? https://github.com/D3voz/openjutsu"
-> "lets do it").
  1. scripts/openjutsu_pick.py: a loader whose file ComfyUI does not list is pointed at the nearest one of that kind (the NVFP4
     text encoder for OpenJutsu's INT4, the fp16 video VAE for its int8); a listed one keeps ComfyUI's own spelling; a kind
     with nothing listed is reported; an input ComfyUI does not declare is left alone;
  2. LIVE: lib/openjutsu.js builds the job (node, the real code), misc/openjutsu_worker.py runs it on the stub ComfyUI -
     simple (the window cut out with its sound, the video uploaded, the model names moved to what is there), advanced with
     2 characters, object remove (no picture), 👁 mask (a temp VideoCombine), 🎨 colours and 🙂 faces on a take; a ComfyUI
     without the Oneclick pack and one without the DMAD LoRA each fail in words naming the add-on.
Run from repo root: python3 scripts/test-openjutsu949.py"""
import json
import os
import socket
import subprocess
import sys
import tempfile
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
import openjutsu_pick as OP  # noqa: E402

FAILED, PASSED = [], []


def check(name, cond, extra=""):
    print(("PASS: " if cond else "FAIL: ") + name + ("" if cond else f" {str(extra)[:1500]}"))
    (PASSED if cond else FAILED).append(name)


# 1 the picks
G = {"15": {"class_type": "UNETLoader", "inputs": {"unet_name": "minimax_h3_ref2va_pruned_int8_convrot.safetensors"}, "_meta": {"title": "H3 Diffusion Model"}},
     "16": {"class_type": "LoraLoaderModelOnly", "inputs": {"lora_name": "minimax_h3_DMAD_4step_full_lora_avg_rank_39_bf16.safetensors"}, "_meta": {"title": "DMAD LoRA"}},
     "13": {"class_type": "CLIPLoader", "inputs": {"clip_name": "qwen3vl_8b_int8_convrot.safetensors"}, "_meta": {"title": "Describer: Qwen3-VL 8B"}},
     "19": {"class_type": "CLIPLoader", "inputs": {"clip_name": "qwen3vl_32b_minimax_h3_int4_convrot.safetensors"}, "_meta": {"title": "H3 Text Encoder"}},
     "20": {"class_type": "VAELoader", "inputs": {"vae_name": "minimax_h3_video_vae_int8_convrot.safetensors"}, "_meta": {"title": "Video VAE"}},
     "21": {"class_type": "VAELoader", "inputs": {"vae_name": "minimax_h3_audio_vae_fp32.safetensors"}, "_meta": {"title": "Audio VAE"}},
     "6": {"class_type": "H3FaceTrackCrop", "inputs": {"detector": "bbox\\face_yolov8m.pt", "fallback_detector": "segm\\person_yolov8m-seg.pt"}},
     "23": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": "sam3.1_multiplex_fp16.safetensors"}, "_meta": {"title": "SAM 3.1"}}}
lists = {("UNETLoader", "unet_name"): ["minimax_h3_ref2va_viggle_pruned_int8_convrot.safetensors", "minimax_h3_ref2va_pruned_int8_convrot.safetensors"],
         ("LoraLoaderModelOnly", "lora_name"): ["other.safetensors", "minimax_h3_DMAD_4step_full_lora_avg_rank_39_bf16.safetensors"],
         ("CLIPLoader", "clip_name"): ["qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors", "qwen3vl_8b_int8_convrot.safetensors"],
         ("VAELoader", "vae_name"): ["minimax_h3_video_vae_fp16.safetensors", "minimax_h3_audio_vae_fp32.safetensors"],
         ("H3FaceTrackCrop", "detector"): ["bbox/face_yolov8m.pt"], ("H3FaceTrackCrop", "fallback_detector"): ["segm/person_yolov8m-seg.pt"]}
ch, miss = OP.pick(G, lists)
check("pick: the NVFP4 text encoder for the INT4 one, the fp16 video VAE for the int8 one; the listed ones kept",
      G["19"]["inputs"]["clip_name"] == "qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors" and G["20"]["inputs"]["vae_name"] == "minimax_h3_video_vae_fp16.safetensors"
      and G["15"]["inputs"]["unet_name"] == "minimax_h3_ref2va_pruned_int8_convrot.safetensors" and G["13"]["inputs"]["clip_name"] == "qwen3vl_8b_int8_convrot.safetensors"
      and not miss, (ch, miss))
check("pick: a listed detector takes ComfyUI's own spelling (bbox/ not bbox\\); an undeclared input (SAM's checkpoint) is left alone",
      G["6"]["inputs"]["detector"] == "bbox/face_yolov8m.pt" and G["6"]["inputs"]["fallback_detector"] == "segm/person_yolov8m-seg.pt"
      and G["23"]["inputs"]["ckpt_name"] == "sam3.1_multiplex_fp16.safetensors", G["6"])
G2 = {"15": {"class_type": "UNETLoader", "inputs": {"unet_name": "minimax_h3_ref2va_pruned_int8_convrot.safetensors"}, "_meta": {"title": "H3 Diffusion Model"}},
      "16": {"class_type": "LoraLoaderModelOnly", "inputs": {"lora_name": "minimax_h3_DMAD_4step_full_lora_avg_rank_39_bf16.safetensors"}, "_meta": {"title": "DMAD LoRA"}}}
ch, miss = OP.pick(G2, {("UNETLoader", "unet_name"): ["minimax_h3_ref2va_viggle_pruned_int8_convrot.safetensors", "minimax_h3_fl2va_pruned_int8_convrot.safetensors"],
                        ("LoraLoaderModelOnly", "lora_name"): []})
check("pick: never a Viggle / fl2va model for the swap, an empty LoRA folder -> both reported with what they are",
      len(miss) == 2 and {m[3] for m in miss} == {"the MiniMax H3 ref2va model", "the DMAD 4-step LoRA (or turn DMAD off)"} and not ch, (ch, miss))

# 2 LIVE on the stub ComfyUI
T = Path(tempfile.mkdtemp(prefix="oj949-"))
models = T / "models"
FILES = [("diffusion_models", "minimax_h3_ref2va_pruned_int8_convrot.safetensors"), ("loras", "minimax_h3_DMAD_4step_full_lora_avg_rank_39_bf16.safetensors"),
         ("text_encoders", "qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors"), ("text_encoders", "qwen3vl_8b_int8_convrot.safetensors"),
         ("vae", "minimax_h3_video_vae_fp16.safetensors"), ("vae", "minimax_h3_audio_vae_fp32.safetensors"), ("checkpoints", "sam3.1_multiplex_fp16.safetensors")]
for k, rel in FILES:
    (models / k).mkdir(parents=True, exist_ok=True)
    (models / k / rel).write_bytes(b"x")


def start_stub(extra, mroot=models):
    s = socket.socket(); s.bind(("127.0.0.1", 0)); port = s.getsockname()[1]; s.close()
    pr = subprocess.Popen([sys.executable, str(ROOT / "scripts" / "stub-comfy.py"), str(port), str(T / f"out{port}")],
                          env=dict(os.environ, STUB_MODELS_ROOT=str(mroot), **extra), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    for _ in range(80):
        try:
            socket.create_connection(("127.0.0.1", port), 0.2).close()
            break
        except OSError:
            time.sleep(0.1)
    return pr, port


def probe(f):
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "stream=codec_type,width,height:format=duration", "-of", "json", str(f)],
                       capture_output=True, text=True)
    d = json.loads(r.stdout or "{}")
    st = d.get("streams") or []
    v = next((s for s in st if s.get("codec_type") == "video"), {})
    return {"w": v.get("width"), "h": v.get("height"), "dur": float((d.get("format") or {}).get("duration") or 0),
            "audio": any(s.get("codec_type") == "audio" for s in st)}


def params_for(o):
    """the job params from the REAL lib/openjutsu.js"""
    r = subprocess.run(["node", "-e", "const OJ=require('./lib/openjutsu');process.stdout.write(JSON.stringify(OJ.jobParams(JSON.parse(process.argv[1]))))",
                        json.dumps(o)], cwd=str(ROOT), capture_output=True, text=True, timeout=60)
    return json.loads(r.stdout or "{}")


def run_job(port, name, o):
    jd = T / name
    jd.mkdir()
    p = params_for(o)
    if p.get("error"):
        return None, [], jd, p
    job = {"params": p, "config": {"engine": {"backend": "comfy", "comfy": {"url": f"http://127.0.0.1:{port}"}}},
           "output_dir": str(jd / "out"), "app_dir": str(ROOT)}
    (jd / "job.json").write_text(json.dumps(job))
    r = subprocess.run([sys.executable, "-u", str(ROOT / "misc" / "openjutsu_worker.py"), str(jd / "job.json")], cwd=str(jd),
                       capture_output=True, text=True, timeout=300)
    return r, sorted((jd / "out").glob("*.mp4")) if (jd / "out").exists() else [], jd, p


def queued(jd):
    f = jd / "openjutsu_queued.json"
    return json.loads(f.read_text()) if f.exists() else {}


vid = T / "dance.mp4"
subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "lavfi", "-i", "testsrc2=size=640x360:rate=30", "-f", "lavfi", "-i",
                "sine=frequency=330:sample_rate=44100", "-t", "8", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", str(vid)], check=True)
pics = []
for i, sz in enumerate(("600x900", "500x800")):
    pics.append(T / f"char{i + 1}.png")
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "lavfi", "-i", f"testsrc2=size={sz}", "-frames:v", "1", str(pics[-1])], check=True)

stub, port = start_stub({})
try:
    r, files, jd, p = run_job(port, "simple", {"kind": "simple", "settings": {"resolution": "480p"}, "seed": 11, "video": str(vid), "start": 2, "length": 4,
                                               "frames": 96, "picture": str(pics[0])})
    pr = probe(files[0]) if files else {}
    q = queued(jd)
    uploads = [n["inputs"].get("video") for n in q.values() if n["class_type"] == "VHS_LoadVideo"]
    check("LIVE simple: the window (2 s +4 s) cut out WITH its sound, uploaded, read from its start (skip 0, cap 96 frames); 4 s back with sound; the take named _openjutsu_simple",
          r.returncode == 0 and files and files[0].name.endswith("_openjutsu_simple.mp4") and abs(pr["dur"] - 4) < 0.3 and pr["audio"]
          and uploads and uploads[0].startswith("oj_") and "window 2.00s +4.00s" in r.stdout
          and next(n for n in q.values() if n["class_type"] == "VHS_LoadVideo")["inputs"]["skip_first_frames"] == 0
          and next(n for n in q.values() if n["class_type"] == "VHS_LoadVideo")["inputs"]["frame_load_cap"] == 96, (r and r.returncode, pr, r and r.stdout[-1500:]))
    tes = {n["_meta"]["title"]: n["inputs"].get("clip_name") or n["inputs"].get("vae_name") for n in q.values() if n["class_type"] in ("CLIPLoader", "VAELoader")}
    check("LIVE simple: OpenJutsu's INT4 text encoder / int8 video VAE pointed at the NVFP4 / fp16 ones ComfyUI has (said in the log); the describer + audio VAE kept",
          tes.get("H3 Text Encoder") == "qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors" and tes.get("Video VAE") == "minimax_h3_video_vae_fp16.safetensors"
          and tes.get("Describer: Qwen3-VL 8B") == "qwen3vl_8b_int8_convrot.safetensors" and "is not in ComfyUI - using qwen3vl_32b_minimax_h3_nvfp4_awq" in r.stdout, tes)
    rec = json.loads(next((T / f"out{port}").glob("video_*.json")).read_text())
    check("LIVE simple: the stub's packs saw the plan at 480p (the video's 16:9 at a 480 short edge = 864x480), the soundtrack-or-silence reader, the picture",
          rec["_size"] == [864, 480] and "H3SoundtrackOrSilence" in rec["_classes"] and "H3OneClickSwapPlan" in rec["_classes"], rec["_size"])
    check("LIVE simple: the [meta] line (seed, steps, engine) for the queue, and the [worker] step lines",
          '"engine": "openjutsu"' in r.stdout and '"seed": 11' in r.stdout and "step 3/4" in r.stdout)

    r, files, jd, p = run_job(port, "adv", {"kind": "advanced", "settings": {"mode": "advanced", "roles": ["the singer", "the drummer"], "resolution": "custom", "width": 640, "height": 352},
                                             "seed": 5, "video": str(vid), "start": 0, "length": 3, "picture": str(pics[0]), "pictures": [str(pics[1])]})
    q = queued(jd)
    li = sorted(n["inputs"]["image"] for n in q.values() if n["class_type"] == "LoadImage")
    plan = next((n["inputs"] for n in q.values() if n["class_type"] == "H3AdvancedSwapPlan"), {})
    check("LIVE advanced: two characters uploaded under the job's own names, their roles in the plan, the custom size (short edge + the centre-crop ImageScale)",
          r.returncode == 0 and files and len(li) == 2 and all(x.startswith("oj_") for x in li) and plan.get("roles") == "the singer\nthe drummer"
          and plan.get("short_edge") == 352 and any(n["class_type"] == "ImageScale" for n in q.values()), (r.returncode, li, plan.get("roles"), r.stdout[-1200:]))

    r, files, jd, p = run_job(port, "obj", {"kind": "object", "settings": {"mode": "object", "object": {"mode": "remove", "target": "hat"}}, "seed": 2,
                                             "video": str(vid), "start": 1, "length": 2})
    q = queued(jd)
    check("LIVE object remove: no picture needed, none uploaded; SAM told what to remove; a take back",
          r.returncode == 0 and files and not any(n["class_type"] == "LoadImage" for n in q.values())
          and next(n for n in q.values() if n.get("_meta", {}).get("title") == "SAM: what to change")["inputs"]["text"] == "hat", (r.returncode, r.stdout[-900:]))

    r, files, jd, p = run_job(port, "mask", {"kind": "mask", "settings": {"hat": True}, "seed": 0, "video": str(vid), "start": 0, "length": 2})
    pr = probe(files[0]) if files else {}
    check("LIVE 👁 mask: the preview VideoCombine (a temp file, save_output off) downloaded as _openjutsu_mask, side by side (2x the width)",
          r.returncode == 0 and files and files[0].name.endswith("_openjutsu_mask.mp4") and pr.get("w") == 320 and pr.get("h") == 90, (r.returncode, pr, r.stdout[-900:]))

    take = files[0] if files else vid
    r, files, jd, p = run_job(port, "color", {"kind": "color", "settings": {}, "seed": 0, "video": str(vid)})
    pr = probe(files[0]) if files else {}
    check("LIVE 🎨 fix colours: the whole take (no window), detail contrast + tone mapper, the sound kept",
          r.returncode == 0 and files and abs(pr["dur"] - 8) < 0.4 and pr["audio"] and files[0].name.endswith("_openjutsu_color.mp4")
          and "window" not in r.stdout.split("uploaded")[0].split("dance.mp4:")[-1], (r.returncode, pr, r.stdout[-900:]))
    r, files, jd, p = run_job(port, "face_no", {"kind": "face", "settings": {}, "seed": 0, "video": str(vid), "picture": str(pics[0])})
    check("🙂 fix faces without the licence ticked: refused before anything runs (InsightFace non-commercial, YOLO AGPL-3.0)",
          r is None and "non-commercial" in p.get("error", "") and "AGPL-3.0" in p.get("error", ""), p)
    r, files, jd, p = run_job(port, "face", {"kind": "face", "settings": {"face": {"ok": True}}, "seed": 4, "video": str(vid), "picture": str(pics[0])})
    check("LIVE 🙂 fix faces with it ticked: the take + the picture uploaded, a take back",
          r.returncode == 0 and files and files[0].name.endswith("_openjutsu_face.mp4"), (r and r.returncode, r and r.stdout[-900:]))
finally:
    stub.kill(); stub.wait()

stub, port = start_stub({"STUB_OPENJUTSU_ABSENT": "1"})
try:
    r, files, jd, p = run_job(port, "nopack", {"kind": "simple", "settings": {}, "seed": 1, "video": str(vid), "start": 0, "length": 2, "picture": str(pics[0])})
    check("no Oneclick pack: refused in words - the pack, its classes, the add-on",
          r.returncode != 0 and "comfyui-h3-oneclick-swap: H3OneClickSwapPlan" in r.stdout and "Add-ons ▸ OpenJutsu swap" in r.stdout and not files, r.stdout[-700:])
finally:
    stub.kill(); stub.wait()

bare = T / "bare"
for k, rel in FILES:
    if k != "loras":
        (bare / k).mkdir(parents=True, exist_ok=True)
        (bare / k / rel).write_bytes(b"x")
(bare / "loras").mkdir(parents=True, exist_ok=True)
stub, port = start_stub({}, bare)
try:
    r, files, jd, p = run_job(port, "nolora", {"kind": "simple", "settings": {}, "seed": 1, "video": str(vid), "start": 0, "length": 2, "picture": str(pics[0])})
    check("no DMAD LoRA: refused in words (what it is, or turn DMAD off, the add-on)",
          r.returncode != 0 and "the DMAD 4-step LoRA (or turn DMAD off)" in r.stdout and "Add-ons ▸ OpenJutsu swap" in r.stdout and not files, r.stdout[-700:])
    r, files, jd, p = run_job(port, "nodmad", {"kind": "simple", "settings": {"dmad": False}, "seed": 1, "video": str(vid), "start": 0, "length": 2, "picture": str(pics[0])})
    q = queued(jd)
    check("DMAD off: no LoRA node at all, 20 steps on the plan - it renders without the LoRA",
          r.returncode == 0 and files and not any(n["class_type"] == "LoraLoaderModelOnly" for n in q.values())
          and next(n for n in q.values() if n["class_type"] == "H3OneClickSwapPlan")["inputs"]["steps"] == 20, (r.returncode, r.stdout[-700:]))
finally:
    stub.kill(); stub.wait()

print(f"\n{len(PASSED)} passed, {len(FAILED)} failed")
sys.exit(1 if FAILED else 0)
