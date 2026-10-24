#!/usr/bin/env python3
"""bitGen Studio — 2.368.0: Wan 2.1 / Wan 2.2 (scripts/wan_graph.py + wan_worker.py).
Tim: "add a wan2.1 style so we can use wan as well, also wan2.2".
  1. frames (4k+1 at 16 fps), sizes, the family from a file name;
  2. pick_models: the mode's file from ComfyUI's list (t2v / i2v 480-720p / flf2v / vace; the 2.2 high + low
     pair, FLF on the i2v pair), the style's own file when it fits, a missing file named with what to download;
  3. build: every mode of both families from ComfyUI's core Wan nodes with their REAL inputs (CLIP vision only
     for 2.1's picture modes, VACE trimmed, 2.2's two KSamplerAdvanced split), LoRAs + shift on each model;
  4. settings: the family's steps / cfg, a Lightning LoRA = 4 / 1, explicit values win;
  5. finish_args: 24 fps (interpolated), the sound laid under it;
  6. wan_worker.py LIVE against the stub ComfyUI (its Wan schemas validate every required input): an i2v job
     with a sound -> a 24 fps mp4 with that sound; the queued graph; a missing model refused in words; a VACE
     job with no VACE file falls back to i2v, said.
Run from repo root: python3 scripts/test-wangraph.py"""
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
import wan_graph as WG  # noqa: E402

FAILED = []


def check(name, cond, extra=""):
    print(("PASS: " if cond else "FAIL: ") + name + ("" if cond else f" {extra}"))
    if not cond:
        FAILED.append(name)


def of(g, ct):
    return [k for k, v in g.items() if v.get("class_type") == ct]


# 1
check("frames: 4k+1, 5..161 (5 s = 81)", WG.frames_for(5) == 81 and WG.snap_frames(1) == 5 and WG.snap_frames(999) == 161
      and all((WG.snap_frames(n) - 1) % 4 == 0 for n in range(5, 170)))
check("a16: 16-px aligned and clamped", WG.a16(1281) == 1280 and WG.a16(10) == 256 and WG.a16(5000) == 1920)
check("family_of: wan2.1 / Wan2_2 / neither",
      WG.family_of("Wan2.1/wan2.1_i2v_720p_14B_fp8_e4m3fn.safetensors") == "wan21"
      and WG.family_of("wan2.2_t2v_high_noise_14B_fp8_scaled.safetensors") == "wan22"
      and WG.family_of("Wan2_2-I2V-A14B-LOW.safetensors") == "wan22" and WG.family_of("flux1-dev.safetensors") is None)

# 2
NAMES = ["flux1-dev.safetensors", "wan2.1_t2v_1.3B_fp16.safetensors", "wan2.1_t2v_14B_fp8_e4m3fn.safetensors",
         "wan2.1_i2v_480p_14B_fp8_e4m3fn.safetensors", "wan2.1_i2v_720p_14B_fp8_e4m3fn.safetensors",
         "wan2.1_flf2v_720p_14B_fp16.safetensors", "wan2.1_vace_14B_fp16.safetensors",
         "wan2.2_t2v_high_noise_14B_fp8_scaled.safetensors", "wan2.2_t2v_low_noise_14B_fp8_scaled.safetensors",
         "wan22/wan2.2_i2v_high_noise_14B_fp8_scaled.safetensors", "wan22/wan2.2_i2v_low_noise_14B_fp8_scaled.safetensors",
         "wan2.2_ti2v_5B_fp16.safetensors"]
p = WG.pick_models(NAMES, "wan21", "t2v")
check("2.1 t2v: the 14B fp8 file (not 1.3B, not i2v)", p.get("models") == ["wan2.1_t2v_14B_fp8_e4m3fn.safetensors"], p)
p = WG.pick_models(NAMES, "wan21", "i2v", height=720)
p2 = WG.pick_models(NAMES, "wan21", "i2v", height=480)
check("2.1 i2v: the 720p file at 720, the 480p file at 480",
      p.get("models") == ["wan2.1_i2v_720p_14B_fp8_e4m3fn.safetensors"]
      and p2.get("models") == ["wan2.1_i2v_480p_14B_fp8_e4m3fn.safetensors"], (p, p2))
check("2.1 flf2v / ref: the flf2v file / the VACE file",
      WG.pick_models(NAMES, "wan21", "flf2v").get("models") == ["wan2.1_flf2v_720p_14B_fp16.safetensors"]
      and WG.pick_models(NAMES, "wan21", "ref").get("models") == ["wan2.1_vace_14B_fp16.safetensors"])
p = WG.pick_models(NAMES, "wan22", "t2v")
check("2.2 t2v: the high + low pair, in that order",
      p.get("models") == ["wan2.2_t2v_high_noise_14B_fp8_scaled.safetensors", "wan2.2_t2v_low_noise_14B_fp8_scaled.safetensors"], p)
p = WG.pick_models(NAMES, "wan22", "flf2v")
check("2.2 first+last: the i2v pair (subfolder spelling kept), said",
      p.get("models") == ["wan22/wan2.2_i2v_high_noise_14B_fp8_scaled.safetensors", "wan22/wan2.2_i2v_low_noise_14B_fp8_scaled.safetensors"]
      and any("i2v pair" in n for n in p["notes"]), p)
p = WG.pick_models(NAMES, "wan22", "ref")
check("2.2 ref with no VACE pair: an error naming what to download",
      "error" in p and "VACE" in p["error"] and "high-noise + low-noise" in p["error"], p)
p = WG.pick_models(["flux1-dev.safetensors"], "wan21", "t2v")
check("2.1 with no Wan file at all: the repackaged file names + the repo", "error" in p and "wan2.1_t2v_14B" in p["error"]
      and "Wan_2.1_ComfyUI_repackaged" in p["error"], p)
p = WG.pick_models(NAMES, "wan21", "i2v", wanted=["my_wan21_i2v_merge.safetensors"])
check("the style's own file wins when it fits the mode", p.get("models") == ["my_wan21_i2v_merge.safetensors"], p)
p = WG.pick_models(NAMES, "wan21", "i2v", wanted=["wan2.1_t2v_14B_fp8_e4m3fn.safetensors"])
check("...a style file for ANOTHER mode is not used for this one",
      p.get("models") == ["wan2.1_i2v_720p_14B_fp8_e4m3fn.safetensors"], p)
check("pick_file: the style's te when listed, else the umt5 file, else the hint",
      WG.pick_file(["a.safetensors", "umt5_xxl_fp8_e4m3fn_scaled.safetensors"], "", r"umt5", WG.TE_HINT) == "umt5_xxl_fp8_e4m3fn_scaled.safetensors"
      and WG.pick_file(["x.safetensors", "mine.safetensors"], "mine.safetensors", r"umt5", WG.TE_HINT) == "mine.safetensors"
      and WG.pick_file([], "", r"umt5", WG.TE_HINT) == WG.TE_HINT)

# 3
BASE = {"prompt": "a dancer", "negative": "blurry", "width": 1281, "height": 721, "frames": 81, "seed": 7,
        "te": "umt5.safetensors", "vae": "wan_2.1_vae.safetensors", "clip_vision": "clip_vision_h.safetensors",
        "images": {"start": "s.png", "end": "e.png", "ref": "r.png"}}
g, n = WG.build({**BASE, "family": "wan21", "mode": "t2v", "models": ["m21.safetensors"], "steps": 30, "cfg": 6})
ks = g[of(g, "KSampler")[0]]["inputs"]
check("2.1 t2v: UNET -> ModelSamplingSD3 (shift 8) -> KSampler (uni_pc / simple), EmptyHunyuanLatentVideo 1280x720x81",
      of(g, "EmptyHunyuanLatentVideo") and g[of(g, "EmptyHunyuanLatentVideo")[0]]["inputs"] == {"width": 1280, "height": 720, "length": 81, "batch_size": 1}
      and ks["sampler_name"] == "uni_pc" and ks["scheduler"] == "simple" and ks["steps"] == 30 and ks["cfg"] == 6.0 and ks["seed"] == 7
      and g[ks["model"][0]]["class_type"] == "ModelSamplingSD3" and g[ks["model"][0]]["inputs"]["shift"] == 8.0
      and not of(g, "CLIPVisionLoader"), g)
cl = g[of(g, "CLIPLoader")[0]]["inputs"]
check("...CLIPLoader type wan; positive / negative CLIPTextEncode; VAEDecode -> CreateVideo 16 fps -> SaveVideo",
      cl == {"clip_name": "umt5.safetensors", "type": "wan", "device": "default"}
      and sorted(v["inputs"]["text"] for v in g.values() if v["class_type"] == "CLIPTextEncode") == ["a dancer", "blurry"]
      and g[of(g, "CreateVideo")[0]]["inputs"]["fps"] == 16.0 and of(g, "SaveVideo") and of(g, "VAEDecode"))
g, n = WG.build({**BASE, "family": "wan21", "mode": "i2v", "models": ["m.safetensors"]})
wi = g[of(g, "WanImageToVideo")[0]]["inputs"]
check("2.1 i2v: WanImageToVideo with start_image + CLIP vision (crop none), the sampler reads ITS conditioning + latent",
      g[wi["start_image"][0]]["inputs"]["image"] == "s.png" and g[wi["clip_vision_output"][0]]["class_type"] == "CLIPVisionEncode"
      and g[wi["clip_vision_output"][0]]["inputs"]["crop"] == "none"
      and all(k in wi for k in ("positive", "negative", "vae", "width", "height", "length", "batch_size"))
      and g[of(g, "KSampler")[0]]["inputs"]["positive"] == [of(g, "WanImageToVideo")[0], 0]
      and g[of(g, "KSampler")[0]]["inputs"]["latent_image"] == [of(g, "WanImageToVideo")[0], 2], wi)
g, n = WG.build({**BASE, "family": "wan21", "mode": "flf2v", "models": ["m.safetensors"]})
fl = g[of(g, "WanFirstLastFrameToVideo")[0]]["inputs"]
check("2.1 flf2v: start + end pictures, both CLIP vision encodes",
      g[fl["start_image"][0]]["inputs"]["image"] == "s.png" and g[fl["end_image"][0]]["inputs"]["image"] == "e.png"
      and "clip_vision_start_image" in fl and "clip_vision_end_image" in fl)
g, n = WG.build({**BASE, "family": "wan21", "mode": "ref", "models": ["vace.safetensors"]})
va = of(g, "WanVaceToVideo")[0]
tr = g[of(g, "TrimVideoLatent")[0]]["inputs"]
check("2.1 ref: WanVaceToVideo (strength 1, the reference picture), the latent trimmed by its trim_latent before decode",
      g[g[va]["inputs"]["reference_image"][0]]["inputs"]["image"] == "r.png" and g[va]["inputs"]["strength"] == 1.0
      and tr["trim_amount"] == [va, 3] and g[of(g, "VAEDecode")[0]]["inputs"]["samples"] == [of(g, "TrimVideoLatent")[0], 0]
      and any("ONE reference" in x for x in n))
g, n = WG.build({**BASE, "family": "wan22", "mode": "i2v", "models": ["hi.safetensors", "lo.safetensors"], "steps": 20, "cfg": 3.5,
                 "loras": [{"name": "lightx2v_hi.safetensors", "strength": 0.8}]})
ka = of(g, "KSamplerAdvanced")
hi, lo = g[ka[0]]["inputs"], g[ka[1]]["inputs"]
check("2.2 i2v: two KSamplerAdvanced - high noise 0-10 with leftover noise, low 10-end reading it, no CLIP vision",
      hi["add_noise"] == "enable" and hi["start_at_step"] == 0 and hi["end_at_step"] == 10 and hi["return_with_leftover_noise"] == "enable"
      and lo["add_noise"] == "disable" and lo["start_at_step"] == 10 and lo["end_at_step"] == 10000
      and lo["latent_image"] == [ka[0], 0] and hi["sampler_name"] == "euler" and not of(g, "CLIPVisionLoader")
      and "clip_vision_output" not in g[of(g, "WanImageToVideo")[0]]["inputs"], (hi, lo))
units = [g[k]["inputs"]["unet_name"] for k in of(g, "UNETLoader")]
loras = [g[k]["inputs"] for k in of(g, "LoraLoaderModelOnly")]
check("...the high model feeds the first sampler, the low the second; the LoRA on each, then the shift",
      units == ["hi.safetensors", "lo.safetensors"] and len(loras) == 2 and all(l["strength_model"] == 0.8 for l in loras)
      and g[hi["model"][0]]["class_type"] == "ModelSamplingSD3"
      and g[g[hi["model"][0]]["inputs"]["model"][0]]["class_type"] == "LoraLoaderModelOnly")
try:
    WG.build({**BASE, "family": "wan22", "mode": "t2v", "models": ["only-one.safetensors"]})
    ok = False
except ValueError as e:
    ok = "high-noise and a low-noise" in str(e)
check("2.2 with one model: refused in words", ok)
try:
    WG.build({**BASE, "family": "wan21", "mode": "i2v", "models": ["m"], "images": {}})
    ok = False
except ValueError as e:
    ok = "start picture" in str(e)
check("i2v with no picture: refused in words", ok)

# 4
st, n = WG.settings("wan22", 0, None, [])
st2, n2 = WG.settings("wan21", 0, None, [{"path": "Wan21_CausVid_14B_T2V_lora_rank32.safetensors"}])
st3, _ = WG.settings("wan22", 8, 2.0, [{"name": "lightx2v.safetensors"}])
check("settings: 2.2 = 20 / 3.5; a CausVid / Lightning LoRA = 4 / 1 (said); explicit values win",
      (st["steps"], st["cfg"]) == (20, 3.5) and (st2["steps"], st2["cfg"]) == (4, 1.0) and n2 and (st3["steps"], st3["cfg"]) == (8, 2.0))

# 5
a = WG.finish_args("raw.mp4", "out.mp4", "song.wav", 12.5)
check("finish_args: motion-interpolated to 24 fps, the sound from its start under the take (shortest), +faststart",
      "minterpolate=fps=24" in a[a.index("-vf") + 1] and a[a.index("-ss") + 1] == "12.500" and "1:a:0" in a and "-shortest" in a
      and "+faststart" in a)
a = WG.finish_args("raw.mp4", "out.mp4", None, 0, None, False)
check("...no sound given: the take's own (if any); interpolation off = fps=24", "0:a:0?" in a and a[a.index("-vf") + 1].startswith("fps=24"))

# 6 LIVE
T = Path(tempfile.mkdtemp(prefix="wan368_"))
models = T / "models"
(models / "diffusion_models" / "wan22").mkdir(parents=True)
for nm in ("wan2.1_i2v_720p_14B_fp8_e4m3fn.safetensors", "wan22/wan2.2_t2v_high_noise_14B_fp8_scaled.safetensors",
           "wan22/wan2.2_t2v_low_noise_14B_fp8_scaled.safetensors"):
    (models / "diffusion_models" / nm).write_bytes(b"x")
(models / "text_encoders").mkdir()
(models / "text_encoders" / "umt5_xxl_fp8_e4m3fn_scaled.safetensors").write_bytes(b"x")
s = socket.socket(); s.bind(("127.0.0.1", 0)); port = s.getsockname()[1]; s.close()
stub = subprocess.Popen([sys.executable, str(ROOT / "scripts" / "stub-comfy.py"), str(port), str(T / "out")],
                        env=dict(os.environ, STUB_MODELS_ROOT=str(models)), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
try:
    for _ in range(50):
        try:
            socket.create_connection(("127.0.0.1", port), 0.2).close()
            break
        except OSError:
            time.sleep(0.1)
    pic = T / "start.png"
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "lavfi", "-i", "testsrc2=size=320x192", "-frames:v", "1", str(pic)], check=True)
    song = T / "song.wav"
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "lavfi", "-i", "sine=frequency=330:sample_rate=48000",
                    "-t", "8", str(song)], check=True)

    def run_job(params, name):
        jd = T / name
        jd.mkdir()
        job = {"params": params, "config": {"engine": {"backend": "comfy", "comfy": {"url": f"http://127.0.0.1:{port}"}}},
               "output_dir": str(jd / "out"), "app_dir": str(ROOT)}
        (jd / "job.json").write_text(json.dumps(job))
        r = subprocess.run([sys.executable, "-u", str(ROOT / "misc" / "wan_worker.py"), str(jd / "job.json")], cwd=str(jd),
                           capture_output=True, text=True, timeout=180)
        return r, jd
    r, jd = run_job({"mode": "wan", "wan_family": "wan21", "wan_mode": "i2v", "prompt": "a dancer spins",
                     "width": 320, "height": 192, "frames": 33, "seed": 5, "images": {"start": str(pic)},
                     "audio": {"path": str(song), "start": 2.0}, "video_style": {"name": "Wan 2.1", "phases": [{}]}}, "j1")
    out = [x for x in r.stdout.splitlines() if x.startswith("@@OUT ")]
    vid = (jd / "out" / out[0][6:]) if out else None
    pr = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "stream=codec_type,codec_name,r_frame_rate", "-of", "json", str(vid)],
                        capture_output=True, text=True).stdout if vid else "{}"
    streams = json.loads(pr or "{}").get("streams") or []
    check("LIVE i2v: the job finishes with @@OUT <stem>_wan.mp4, H.264 at 24 fps + AAC (the song laid under it)",
          r.returncode == 0 and vid and vid.name.endswith("_wan.mp4") and vid.is_file()
          and any(x.get("codec_name") == "h264" and x.get("r_frame_rate") == "24/1" for x in streams)
          and any(x.get("codec_type") == "audio" for x in streams), (r.returncode, r.stdout[-1500:], streams))
    q = json.loads((jd / "wan_queued.json").read_text())
    unet = [v["inputs"]["unet_name"] for v in q.values() if v["class_type"] == "UNETLoader"]
    check("...the queued graph: ComfyUI's i2v 720p file, the uploaded start picture, CLIP vision, umt5 from the list",
          unet == ["wan2.1_i2v_720p_14B_fp8_e4m3fn.safetensors"]
          and any(v["class_type"] == "LoadImage" and v["inputs"]["image"] == "start.png" for v in q.values())
          and any(v["class_type"] == "CLIPVisionEncode" for v in q.values())
          and any(v["class_type"] == "CLIPLoader" and v["inputs"]["clip_name"] == "umt5_xxl_fp8_e4m3fn_scaled.safetensors" for v in q.values()), unet)
    check("...the log: the files, 16 -> 24 fps interpolated, the sound from 2.00s",
          "16 fps -> 24 fps (motion-interpolated), the sound song.wav from 2.00s" in r.stdout
          and "model wan2.1_i2v_720p_14B_fp8_e4m3fn.safetensors (ComfyUI's Wan 2.1 i2v file)" in r.stdout, r.stdout[-1200:])
    r, jd = run_job({"mode": "wan", "wan_family": "wan22", "wan_mode": "t2v", "prompt": "rain", "width": 320, "height": 192,
                     "frames": 17, "seed": 1, "images": {}, "video_style": {"name": "Wan 2.2", "phases": [{}, {}]}}, "j2")
    q = json.loads((jd / "wan_queued.json").read_text()) if (jd / "wan_queued.json").exists() else {}
    check("LIVE 2.2 t2v: the high / low pair from the subfolder, two samplers, done",
          r.returncode == 0 and [v["inputs"]["unet_name"] for v in q.values() if v["class_type"] == "UNETLoader"]
          == ["wan22/wan2.2_t2v_high_noise_14B_fp8_scaled.safetensors", "wan22/wan2.2_t2v_low_noise_14B_fp8_scaled.safetensors"]
          and sum(1 for v in q.values() if v["class_type"] == "KSamplerAdvanced") == 2, r.stdout[-800:])
    r, jd = run_job({"mode": "wan", "wan_family": "wan21", "wan_mode": "flf2v", "prompt": "x", "width": 320, "height": 192,
                     "frames": 17, "images": {"start": str(pic), "end": str(pic)}, "video_style": {}}, "j3")
    check("LIVE 2.1 flf2v with no flf2v file: refused in words with the file to download",
          r.returncode != 0 and "no Wan 2.1 FLF2V model" in r.stdout and "wan2.1_flf2v_720p_14B_fp16" in r.stdout, r.stdout[-600:])
    r, jd = run_job({"mode": "wan", "wan_family": "wan21", "wan_mode": "ref", "prompt": "x", "width": 320, "height": 192,
                     "frames": 17, "images": {"ref": str(pic)}, "video_style": {}}, "j4")
    q = json.loads((jd / "wan_queued.json").read_text()) if (jd / "wan_queued.json").exists() else {}
    check("LIVE 2.1 ref with no VACE file: rendered image-to-video from the reference picture instead, said",
          r.returncode == 0 and "rendering image-to-video from the reference picture instead" in r.stdout
          and any(v["class_type"] == "WanImageToVideo" for v in q.values()), r.stdout[-800:])
finally:
    stub.kill()
    stub.wait()
    shutil.rmtree(T, ignore_errors=True)

W = (ROOT / "misc" / "wan_worker.py").read_text()
check("wan_worker.py: the graph is built (no export), canonicalised to ComfyUI's spelling, missing classes named",
      "WG.build(" in W and "canonicalise_combos" in W and "missing_classes" in W)

print(f"\nRESULT: {len(FAILED)} failed")
sys.exit(1 if FAILED else 0)
