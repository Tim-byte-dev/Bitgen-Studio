#!/usr/bin/env python3
"""bitGen Studio — 2.400.0: SeedVR2 video upscaling (scripts/seedvr2_graph.py + seedvr2_worker.py).
Tim: "add seedvr2 for upscaling videos - seedvr2_7b_sharp_fp16.safetensors - ...utility_seedvr2_3b_int8_upscale_video.json"
  1. seedvr2_graph.build: the template's core-node chain, flattened (LoadVideo -> GetVideoComponents -> Resize x mult
     lanczos -> Preprocess -> VAEEncodeTiled 512/128/64/8 -> [TemporalChunk] -> Conditioning -> KSampler 1 step cfg 1
     -> [TemporalMerge] -> VAEDecodeTiled -> PostProcessing (vs the resized original) -> CreateVideo (source fps) ->
     SaveVideo); chunking auto / manual 4n+1 / off; colour validated; bit_depth only when CreateVideo has it;
  2. pick_model: the asked file, else the sharp 7B fp16 first, then any 7B, the 3B; none -> the file to get;
  3. seedvr2_worker.py LIVE against the stub ComfyUI (the SeedVR2 schemas + a render that reads the uploaded video):
     a 320x192 clip with sound -> 1080p (1800x1080), the sound laid back, the sharp 7B picked over the int8;
     a window + an AVI (FFV1) source -> prepared as H.264 first, the window's length; no SeedVR2 model -> refused in
     words naming the file.
Run from repo root: python3 scripts/test-seedvr2.py"""
import json
import os
import shutil
import socket
import subprocess
import sys
import tempfile
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
import seedvr2_graph as SV  # noqa: E402

FAILED = []


def check(name, cond, extra=""):
    print(("PASS: " if cond else "FAIL: ") + name + ("" if cond else f" {extra}"))
    if not cond:
        FAILED.append(name)


def of(g, ct):
    return [k for k, v in g.items() if v.get("class_type") == ct]


def link_cls(g, link):
    return g[str(link[0])]["class_type"] if isinstance(link, list) and str(link[0]) in g else None


# 1
g, notes = SV.build({"video": "clip.mp4", "mult": 2.5, "model": "m.safetensors", "vae": "v.safetensors", "seed": 7,
                     "denoise": 1, "color": "lab", "chunk": "auto", "overlap": 2})
ks = g[of(g, "KSampler")[0]]["inputs"]
rz = g[of(g, "ResizeImageMaskNode")[0]]["inputs"]
enc = g[of(g, "VAEEncodeTiled")[0]]["inputs"]
check("build: the template chain in order (Load -> Components -> Resize -> Preprocess -> EncodeTiled -> Chunk -> Conditioning -> KSampler -> Merge -> DecodeTiled -> PostProcessing -> CreateVideo -> SaveVideo)",
      link_cls(g, g[of(g, "GetVideoComponents")[0]]["inputs"]["video"]) == "LoadVideo"
      and link_cls(g, rz["input"]) == "GetVideoComponents"
      and link_cls(g, g[of(g, "SeedVR2Preprocess")[0]]["inputs"]["resized_images"]) == "ResizeImageMaskNode"
      and link_cls(g, enc["pixels"]) == "SeedVR2Preprocess"
      and link_cls(g, g[of(g, "SeedVR2TemporalChunk")[0]]["inputs"]["latent"]) == "VAEEncodeTiled"
      and link_cls(g, g[of(g, "SeedVR2Conditioning")[0]]["inputs"]["vae_conditioning"]) == "SeedVR2TemporalChunk"
      and link_cls(g, ks["latent_image"]) == "SeedVR2TemporalChunk" and ks["positive"][1] == 0 and ks["negative"][1] == 1
      and link_cls(g, g[of(g, "SeedVR2TemporalMerge")[0]]["inputs"]["latents"]) == "KSampler"
      and g[of(g, "SeedVR2TemporalMerge")[0]]["inputs"]["temporal_overlap"] == [of(g, "SeedVR2TemporalChunk")[0], 1]
      and link_cls(g, g[of(g, "VAEDecodeTiled")[0]]["inputs"]["samples"]) == "SeedVR2TemporalMerge"
      and link_cls(g, g[of(g, "SeedVR2PostProcessing")[0]]["inputs"]["original_resized_images"]) == "ResizeImageMaskNode"
      and link_cls(g, g[of(g, "CreateVideo")[0]]["inputs"]["images"]) == "SeedVR2PostProcessing"
      and g[of(g, "CreateVideo")[0]]["inputs"]["fps"] == [of(g, "GetVideoComponents")[0], 2]
      and link_cls(g, g[of(g, "SaveVideo")[0]]["inputs"]["video"]) == "CreateVideo", g)
check("build: the template's numbers - lanczos x2.5, tiles 512/128/64/8, 1 step cfg 1 euler simple, the seed, lab, overlap 2",
      rz == {"input": rz["input"], "resize_type": "scale by multiplier", "resize_type.multiplier": 2.5, "scale_method": "lanczos"}
      and (enc["tile_size"], enc["overlap"], enc["temporal_size"], enc["temporal_overlap"]) == (512, 128, 64, 8)
      and (ks["steps"], ks["cfg"], ks["sampler_name"], ks["scheduler"], ks["seed"], ks["denoise"]) == (1, 1.0, "euler", "simple", 7, 1.0)
      and g[of(g, "SeedVR2PostProcessing")[0]]["inputs"]["color_correction_method"] == "lab"
      and g[of(g, "SeedVR2TemporalChunk")[0]]["inputs"]["temporal_overlap"] == 2
      and g[of(g, "SeedVR2TemporalChunk")[0]]["inputs"]["chunking_mode"] == "auto"
      and "bit_depth" not in g[of(g, "CreateVideo")[0]]["inputs"], g)
g2, n2 = SV.build({"video": "c.mp4", "mult": 2, "model": "m", "vae": "v", "chunk": "off", "color": "purple", "bit_depth": True})
check("build: chunk off = no split / merge (the sampler reads the encode), an unknown colour -> lab (said), bit_depth wired when asked",
      not of(g2, "SeedVR2TemporalChunk") and not of(g2, "SeedVR2TemporalMerge")
      and link_cls(g2, g2[of(g2, "KSampler")[0]]["inputs"]["latent_image"]) == "VAEEncodeTiled"
      and g2[of(g2, "SeedVR2PostProcessing")[0]]["inputs"]["color_correction_method"] == "lab"
      and any("purple" in x for x in n2) and g2[of(g2, "CreateVideo")[0]]["inputs"].get("bit_depth") == [of(g2, "GetVideoComponents")[0], 3])
check("chunk_spec: 23 -> manual 21 (4n+1), auto, off", SV.chunk_spec("23") == (True, {"chunking_mode": "manual", "chunking_mode.frames_per_chunk": 21})
      and SV.chunk_spec("auto")[1] == {"chunking_mode": "auto"} and SV.chunk_spec("off") == (False, {}))
for o, want in (({"model": ""}, "no SeedVR2 model"), ({"vae": ""}, "no SeedVR2 VAE")):
    try:
        SV.build(dict({"video": "c", "mult": 2, "model": "m", "vae": "v"}, **o))
        check(f"refused: {want}", False)
    except ValueError as e:
        check(f"refused in words: {want}", want in str(e), str(e))

# 2
L = ["seedvr2_3b_int8_convrot.safetensors", "seedvr2_7b_int8_convrot.safetensors", "sub/seedvr2_7b_sharp_fp16.safetensors", "wan.safetensors"]
check("pick_model: the sharp 7B fp16 first (a subfolder too), the asked file when listed, else 7B > 3B, none = the file to get",
      SV.pick_model(L)[0] == L[2] and SV.pick_model(L, "seedvr2_3b_int8_convrot.safetensors")[0] == L[0]
      and SV.pick_model(L[:2])[0] == L[1] and "seedvr2_7b_sharp_fp16" in SV.pick_model(L[:2])[1]
      and SV.pick_model(L[:1])[0] == L[0] and SV.pick_model(["wan.safetensors"])[0] == ""
      and "seedvr2_7b_sharp_fp16.safetensors" in SV.pick_model([])[1])
check("multiplier: the larger ratio", SV.multiplier(320, 192, 1800, 1080) == 5.625)
check("mux_args: the source's sound (optional map), H.264, the clip's own length",
      "1:a:0?" in SV.mux_args("u.mp4", "s.mp4", "o.mp4", 0, None, 2.0) and SV.mux_args("u", "s", "o", 1.5, 2, 2)[6:10] == ["-ss", "1.500", "-t", "2.000"])

# 3 LIVE
T = Path(tempfile.mkdtemp(prefix="sv400_"))
models = T / "models"
(models / "diffusion_models").mkdir(parents=True)
(models / "vae").mkdir()
for nm in ("seedvr2_7b_int8_convrot.safetensors", "seedvr2_7b_sharp_fp16.safetensors"):
    (models / "diffusion_models" / nm).write_bytes(b"x")
(models / "vae" / "seedvr2_ema_vae_fp16.safetensors").write_bytes(b"x")
s = socket.socket(); s.bind(("127.0.0.1", 0)); port = s.getsockname()[1]; s.close()
stub = subprocess.Popen([sys.executable, str(ROOT / "scripts" / "stub-comfy.py"), str(port), str(T / "out")],
                        env=dict(os.environ, STUB_MODELS_ROOT=str(models)), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def probe(p):
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "stream=codec_type,width,height:format=duration",
                        "-of", "json", str(p)], capture_output=True, text=True)
    d = json.loads(r.stdout or "{}")
    v = [x for x in d.get("streams", []) if x.get("codec_type") == "video"]
    return {"w": v[0]["width"] if v else 0, "h": v[0]["height"] if v else 0,
            "audio": any(x.get("codec_type") == "audio" for x in d.get("streams", [])),
            "dur": float((d.get("format") or {}).get("duration") or 0)}


try:
    for _ in range(50):
        try:
            socket.create_connection(("127.0.0.1", port), 0.2).close()
            break
        except OSError:
            time.sleep(0.1)
    clip = T / "take.mp4"
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "lavfi", "-i", "testsrc2=size=320x192:rate=24",
                    "-f", "lavfi", "-i", "sine=frequency=330:sample_rate=48000", "-t", "2", "-pix_fmt", "yuv420p",
                    "-c:v", "libx264", "-c:a", "aac", str(clip)], check=True)
    master = T / "take.avi"
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "lavfi", "-i", "testsrc2=size=320x192:rate=24", "-t", "3",
                    "-c:v", "ffv1", str(master)], check=True)

    def run_job(params, name):
        jd = T / name
        jd.mkdir()
        job = {"params": dict({"mode": "seedvr2"}, **params),
               "config": {"engine": {"backend": "comfy", "comfy": {"url": f"http://127.0.0.1:{port}"}}},
               "output_dir": str(jd / "out"), "app_dir": str(ROOT)}
        (jd / "job.json").write_text(json.dumps(job))
        r = subprocess.run([sys.executable, "-u", str(ROOT / "seedvr2_worker.py"), str(jd / "job.json")], cwd=str(jd),
                           capture_output=True, text=True, timeout=180)
        q = json.loads((jd / "seedvr2_queued.json").read_text()) if (jd / "seedvr2_queued.json").exists() else {}
        outs = sorted((jd / "out").glob("*.mp4")) if (jd / "out").exists() else []
        return r, q, outs

    r, q, outs = run_job({"source": str(clip), "width": 1800, "height": 1080, "color": "wavelet", "chunk": "auto", "seed": 5}, "j1")
    p = probe(outs[0]) if outs else {}
    unet = [v["inputs"]["unet_name"] for v in q.values() if v["class_type"] == "UNETLoader"]
    check("LIVE 320x192 -> 1800x1080: the sharp 7B picked over the int8, x5.625, uploaded as it is, the sound laid back, 4 stages, @@OUT",
          r.returncode == 0 and "@@OUT take_seedvr2_1080p.mp4" in r.stdout and unet == ["seedvr2_7b_sharp_fp16.safetensors"]
          and p.get("w") == 1800 and p.get("h") == 1080 and p.get("audio") and abs(p.get("dur", 0) - 2.0) < 0.2
          and "[worker] step 4/4" in r.stdout and "320x192 -> 1800x1080" in r.stdout
          and [v["inputs"]["file"] for v in q.values() if v["class_type"] == "LoadVideo"] == ["take.mp4"]
          and any(v["inputs"].get("color_correction_method") == "wavelet" for v in q.values()), (r.returncode, r.stdout[-1500:], p))
    r, q, outs = run_job({"source": str(master), "width": 640, "height": 384, "start": 1.0, "duration": 1.5, "chunk": "off",
                          "audio_source": str(clip), "output_name": "scene3_seedvr2.mp4", "model": "seedvr2_7b_int8_convrot.safetensors"}, "j2")
    p = probe(outs[0]) if outs else {}
    unet = [v["inputs"]["unet_name"] for v in q.values() if v["class_type"] == "UNETLoader"]
    check("LIVE an FFV1 master + a window: prepared as H.264 (the window's 1.5 s), the asked int8 file, no split, the take's sound, named as asked",
          r.returncode == 0 and "@@OUT scene3_seedvr2.mp4" in r.stdout and "near-lossless H.264 from the AVI" in r.stdout
          and unet == ["seedvr2_7b_int8_convrot.safetensors"] and not any(v["class_type"] == "SeedVR2TemporalChunk" for v in q.values())
          and p.get("w") == 640 and abs(p.get("dur", 0) - 1.5) < 0.2 and p.get("audio")
          and [v["inputs"]["file"] for v in q.values() if v["class_type"] == "LoadVideo"] == ["seedvr2_src.mp4"],
          (r.returncode, r.stdout[-1500:], p))
    r, q, outs = run_job({"source": str(clip), "width": 160, "height": 96}, "j3")
    check("LIVE smaller than the source: refused in words", r.returncode != 0 and "already larger" in r.stdout, r.stdout[-400:])
    for f in (models / "diffusion_models").iterdir():
        f.unlink()
    (models / "diffusion_models" / "wan.safetensors").write_bytes(b"x")
    r, q, outs = run_job({"source": str(clip), "width": 640, "height": 384}, "j4")
    check("LIVE no SeedVR2 model: refused in words naming seedvr2_7b_sharp_fp16", r.returncode != 0
          and "no SeedVR2 model" in r.stdout and "seedvr2_7b_sharp_fp16.safetensors" in r.stdout, r.stdout[-600:])
finally:
    stub.kill()
    stub.wait()
    shutil.rmtree(T, ignore_errors=True)

print(f"\nRESULT: {len(FAILED)} failed")
sys.exit(1 if FAILED else 0)
