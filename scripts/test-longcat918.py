#!/usr/bin/env python3
"""bitGen Studio — 2.918.0: LongCat-Video-Avatar 1.6 (a person talking / singing to a sound) in the ComfyUI-LongCat-Avatar pack.
Tim (verbatim): "https://meigen-ai.github.io/LongCat-Video-Avatar-1.6-Page/, can you add this"
  1. scripts/longcat_graph.py: the graph wired as the pack needs it (LongCatAvatarModelLoader, CLIPLoader umT5 type wan, Wan 2.1
     VAE, AudioEncoderLoader Whisper -> LongCatAvatarAudioEncode on the SAME LoadAudio, LongCatAvatarVideo with the DMD + OPSD
     LoRAs, SaveVideo), with / without the start picture; the files picked from what ComfyUI lists (int8 first, missing ones
     named with the add-on); the release's 480p / 720p buckets by the picture's shape; segments for a length;
  2. LIVE on the stub ComfyUI: the video as long as the speech (25 fps, the speech in it), a start picture uploaded, the speech
     cut from a start; a ComfyUI without the pack, missing files and no speech each fail in words.
Run from repo root: python3 scripts/test-longcat918.py"""
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
import longcat_graph as LG  # noqa: E402

FAILED, PASSED = [], []


def check(name, cond, extra=""):
    print(("PASS: " if cond else "FAIL: ") + name + ("" if cond else f" {extra}"))
    (PASSED if cond else FAILED).append(name)


F = {"model": "longcat-video-avatar/longcat_video_avatar_1.6_int8_convrot.safetensors",
     "dmd": "longcat-video-avatar/longcat_video_avatar_1.6_dmd_lora_bf16.safetensors",
     "opsd": "longcat-video-avatar/longcat_video_avatar_1.6_opsd_lora_bf16.safetensors",
     "whisper": "whisper_large_v3_encoder_fp16.safetensors", "te": "umt5_xxl_fp8_e4m3fn_scaled.safetensors", "vae": "wan_2.1_vae.safetensors"}
# 1 the graph
g, notes = LG.build(dict(F, prompt="A woman in a red jacket talks to the camera in a bright studio", audio="speech.wav", image="",
                         width=832, height=480, seed=7, prefix="p/x"))
ct = {k: v["class_type"] for k, v in g.items()}
inv = {v: k for k, v in ct.items()}
I = lambda c: g[inv[c]]["inputs"]   # noqa: E731
check("graph: the pack's three nodes + ComfyUI's loaders, no picture = no LoadImage (and said)",
      set(ct.values()) == set(LG.REQUIRED) - {"LoadImage"} and any("prompt and the speech alone" in n for n in notes), sorted(ct.values()))
v = I("LongCatAvatarVideo")
check("LongCatAvatarVideo: model / prompt / VAE / features / audio wired, the DMD + OPSD LoRAs, the release's mix (4 steps DMD, alpha 1), euler, ref index 10",
      v["model"] == [inv["LongCatAvatarModelLoader"], 0] and v["positive"] == [inv["CLIPTextEncode"], 0] and v["vae"] == [inv["VAELoader"], 0]
      and v["audio_features"] == [inv["LongCatAvatarAudioEncode"], 0] and v["audio"] == [inv["LoadAudio"], 0]
      and v["dmd_lora"] == F["dmd"] and v["opsd_lora"] == F["opsd"] and v["mix_steps"] == 4 and v["mix_alpha"] == 1.0
      and v["sampler_name"] == "euler" and v["ref_img_index"] == 10 and v["max_segments"] == 0 and (v["width"], v["height"]) == (832, 480), v)
check("the encoder hears the SAME LoadAudio through Whisper; the text encoder is a CLIPLoader of type wan",
      I("LongCatAvatarAudioEncode")["audio"] == [inv["LoadAudio"], 0] and I("LongCatAvatarAudioEncode")["audio_encoder"] == [inv["AudioEncoderLoader"], 0]
      and I("AudioEncoderLoader")["audio_encoder_name"] == F["whisper"] and I("CLIPLoader")["type"] == "wan" and I("CLIPLoader")["clip_name"] == F["te"])
g2, _ = LG.build(dict(F, prompt="x", audio="s.wav", image="person.png", width=512, height=768, seed=1))
lid = next(k for k, x in g2.items() if x["class_type"] == "LoadImage")
check("a start picture = LoadImage -> start_image", g2[lid]["inputs"]["image"] == "person.png"
      and next(x for x in g2.values() if x["class_type"] == "LongCatAvatarVideo")["inputs"]["start_image"] == [lid, 0])
for bad, why in ((dict(F, prompt="", audio="s.wav"), "prompt"), (dict(F, prompt="x", audio=""), "speech"), (dict(F, prompt="x", audio="s.wav", width=830), "16-px")):
    try:
        LG.build(bad)
        check(f"refused: {why}", False)
    except ValueError as e:
        check(f"refused in words: {why}", why.split()[0] in str(e) or (why == "speech" and "References docker" in str(e)), str(e))
# the files
p = LG.pick(["stub-unet.safetensors", "longcat-video-avatar/longcat_video_avatar_1.6_bf16.safetensors", F["model"], "wan2.1_t2v_14B.safetensors"],
            ["other.safetensors", F["dmd"], F["opsd"]], [F["whisper"]], ["clip_l.safetensors", F["te"]], ["Wan2.1_VAE.safetensors", F["vae"]])
check("pick: int8 before bf16, the DMD / OPSD LoRAs by name, Whisper, umT5, the Wan 2.1 VAE", not p["error"] and p["model"] == F["model"]
      and p["dmd"] == F["dmd"] and p["opsd"] == F["opsd"] and p["whisper"] == F["whisper"] and p["te"] == F["te"] and p["vae"] in (F["vae"], "Wan2.1_VAE.safetensors"), p)
p = LG.pick(["longcat-video-avatar/longcat_video_avatar_1.6_w4a8.safetensors"], [F["dmd"], F["opsd"]], [F["whisper"]], [F["te"]], [F["vae"]])
check("pick: a W4A8-only install is used", not p["error"] and "w4a8" in p["model"], p)
p = LG.pick(["stub-unet.safetensors"], [], [], ["clip_l.safetensors"], [])
check("pick: nothing there = every missing file named + the add-on", "longcat_video_avatar_1.6_int8_convrot" in p["error"] and "whisper_large_v3" in p["error"]
      and "Add-ons ▸ LongCat Avatar 1.6" in p["error"], p["error"])
# sizes + length
check("size: the picture's shape picks the release's 480p bucket (portrait 2:3 -> 512x768); Basic Settings 1280x720 = 720p",
      LG.size_for(832, 480, (1024, 1536)) == (512, 768, "480p") and LG.size_for(1280, 720, None) == (1280, 720, "720p")
      and LG.size_for(1280, 720, (1080, 1920)) == (720, 1280, "720p") and LG.size_for(0, 0, None) == (832, 480, "480p"))
check("segments: 93 frames, then 80 more each (10.1 s = 3, 16 s = 5, 1 s = 1)", [LG.segments_for(s) for s in (1, 3.7, 10.1, 16)] == [1, 1, 3, 5])

# 2 LIVE on the stub ComfyUI
T = Path(tempfile.mkdtemp(prefix="lc918-"))
models = T / "models"
for k, rel in (("diffusion_models", F["model"]), ("loras", F["dmd"]), ("loras", F["opsd"]), ("audio_encoders", F["whisper"]),
               ("text_encoders", F["te"]), ("vae", F["vae"])):
    (models / k / rel).parent.mkdir(parents=True, exist_ok=True)
    (models / k / rel).write_bytes(b"x")


def start_stub(extra, mroot=models):
    s = socket.socket(); s.bind(("127.0.0.1", 0)); port = s.getsockname()[1]; s.close()
    pr = subprocess.Popen([sys.executable, str(ROOT / "scripts" / "stub-comfy.py"), str(port), str(T / f"out{port}")],
                          env=dict(os.environ, STUB_MODELS_ROOT=str(mroot), **extra), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    for _ in range(60):
        try:
            socket.create_connection(("127.0.0.1", port), 0.2).close()
            break
        except OSError:
            time.sleep(0.1)
    return pr, port


def probe(f):
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "stream=codec_type,r_frame_rate:format=duration", "-of", "json", str(f)],
                       capture_output=True, text=True)
    d = json.loads(r.stdout or "{}")
    st = d.get("streams") or []
    v = next((s for s in st if s.get("codec_type") == "video"), {})
    return v.get("r_frame_rate"), float((d.get("format") or {}).get("duration") or 0), any(s.get("codec_type") == "audio" for s in st)


def run_job(port, name, params):
    jd = T / name
    jd.mkdir()
    job = {"params": dict({"mode": "longcat", "prompt": "A man sings on a stage under warm lights", "width": 832, "height": 480, "seed": 3}, **params),
           "config": {"engine": {"backend": "comfy", "comfy": {"url": f"http://127.0.0.1:{port}"}}},
           "output_dir": str(jd / "out"), "app_dir": str(ROOT)}
    (jd / "job.json").write_text(json.dumps(job))
    r = subprocess.run([sys.executable, "-u", str(ROOT / "misc" / "longcat_worker.py"), str(jd / "job.json")], cwd=str(jd),
                       capture_output=True, text=True, timeout=240)
    return r, sorted((jd / "out").glob("*.mp4")) if (jd / "out").exists() else [], jd


pic = T / "person.png"
subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "lavfi", "-i", "testsrc2=size=600x900", "-frames:v", "1", str(pic)], check=True)
snd = T / "speech.wav"
subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "lavfi", "-i", "sine=frequency=220:sample_rate=16000", "-t", "5", str(snd)], check=True)
stub, port = start_stub({})
try:
    r, files, jd = run_job(port, "a", {"output_name": "talk", "audio": {"path": str(snd), "start": 0}})
    fr = probe(files[0]) if files else None
    q = json.loads((jd / "longcat_queued.json").read_text()) if (jd / "longcat_queued.json").exists() else {}
    check("LIVE no picture: the video as long as the speech (5 s, 25 fps) WITH the speech, named _longcat, the int8 DiT, 832x480, 2 segments said",
          r.returncode == 0 and files and files[0].name == "talk_longcat.mp4" and fr and fr[0] == "25/1" and abs(fr[1] - 5) < 0.3 and fr[2]
          and any(x["inputs"].get("unet_name") == F["model"] for x in q.values()) and "5.0 s = 2 segment(s)" in r.stdout
          and "832x480 (480p" in r.stdout and "[meta]" in r.stdout and "with the speech" in r.stdout, (r.returncode, fr, r.stdout[-1500:]))
    r, files, jd = run_job(port, "b", {"image": str(pic), "audio": {"path": str(snd), "start": 2}, "width": 1280, "height": 720})
    fr = probe(files[0]) if files else None
    q = json.loads((jd / "longcat_queued.json").read_text()) if (jd / "longcat_queued.json").exists() else {}
    vq = next((x["inputs"] for x in q.values() if x["class_type"] == "LongCatAvatarVideo"), {})
    check("LIVE a start picture (2:3) + the speech from 2 s + Basic Settings 1280x720: the 720p portrait bucket 768x1152, 3 s long, LoadImage -> start_image",
          r.returncode == 0 and files and fr and abs(fr[1] - 3) < 0.3 and (vq.get("width"), vq.get("height")) == (768, 1152)
          and "start_image" in vq and "uploaded the start picture" in r.stdout and "the speech from 2.0 s" in r.stdout, (r.returncode, fr, vq, r.stdout[-1200:]))
    r, files, _ = run_job(port, "c", {})
    check("LIVE no speech: fails in words, no file", r.returncode != 0 and "References docker" in r.stdout and not files, r.stdout[-400:])
finally:
    stub.kill(); stub.wait()

stub, port = start_stub({"STUB_LONGCAT_ABSENT": "1"})
try:
    r, files, _ = run_job(port, "d", {"audio": {"path": str(snd), "start": 0}})
    check("LIVE a ComfyUI without the pack: fails naming its nodes + the add-on, no file",
          r.returncode != 0 and "LongCatAvatarVideo" in r.stdout and "Add-ons ▸ LongCat Avatar 1.6" in r.stdout and not files, r.stdout[-600:])
finally:
    stub.kill(); stub.wait()

bare = T / "bare"
for sub in ("diffusion_models", "text_encoders", "vae", "loras", "audio_encoders"):
    (bare / sub).mkdir(parents=True)
stub, port = start_stub({}, bare)
try:
    r, files, _ = run_job(port, "e", {"audio": {"path": str(snd), "start": 0}})
    check("LIVE the files missing: fails naming them and Settings ▸ Add-ons ▸ LongCat Avatar 1.6",
          r.returncode != 0 and "longcat_video_avatar_1.6_int8_convrot" in r.stdout and "Add-ons ▸ LongCat Avatar 1.6" in r.stdout and not files, r.stdout[-600:])
finally:
    stub.kill(); stub.wait()

print()
print(f"RESULT: {len(PASSED)} passed, {len(FAILED)} failed")
sys.exit(1 if FAILED else 0)
