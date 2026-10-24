#!/usr/bin/env python3
"""bitGen Studio — 2.399.0: the timeline camera path in the Wan and LTX workers.
Tim: "can we add camera movement to follow a 3d path, pan,roll and dolly, height and angle to the tools in timeline docker.
will we be able to tell mmh3 , wan and ltx to follow these paths and camera movement" (asked: "Also an exact-path guide").
  1. wan_graph: mode camera (WanCameraEmbedding -> WanCameraImageToVideo, CLIP vision on 2.1) and vctrl (LoadVideo ->
     GetVideoComponents -> WanVaceToVideo control_video + the first picture as reference, trimmed); refused in words
     without a start picture / a guide / a known move; a Fun Camera file is never picked for a plain mode, vctrl runs on
     the VACE file(s);
  2. ltx_graph: camera_lora finds the move's LoRA in ComfyUI's list (a subfolder too), not another move's;
  3. wan_worker.py LIVE against the stub ComfyUI (its schemas hold the real required inputs of the camera nodes):
     a Fun Camera move with the Fun Camera pair listed; the EXACT path with a VACE file (the depth guide resampled to
     16 fps, uploaded, the control video); no camera model = the words carry it, said; no picture = said.
Run from repo root: python3 scripts/test-campathgen.py"""
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
import ltx_graph as LG  # noqa: E402

FAILED = []


def check(name, cond, extra=""):
    print(("PASS: " if cond else "FAIL: ") + name + ("" if cond else f" {extra}"))
    if not cond:
        FAILED.append(name)


def of(g, ct):
    return [k for k, v in g.items() if v.get("class_type") == ct]


# 1
g, notes = WG.build({"family": "wan22", "mode": "camera", "models": ["h", "l"], "images": {"start": "s.png"},
                     "camera": {"pose": "Zoom In", "speed": 1.6}, "frames": 81, "width": 832, "height": 480})
emb, i2v = of(g, "WanCameraEmbedding"), of(g, "WanCameraImageToVideo")
ins = g[i2v[0]]["inputs"] if i2v else {}
check("camera (2.2): WanCameraEmbedding (the move, the speed, the size, the length) -> WanCameraImageToVideo (start picture + camera_conditions), two samplers",
      len(emb) == 1 and g[emb[0]]["inputs"] == {"camera_pose": "Zoom In", "width": 832, "height": 480, "length": 81, "speed": 1.6}
      and ins.get("camera_conditions") == [emb[0], 0] and ins.get("start_image", [None])[0] in of(g, "LoadImage")
      and len(of(g, "KSamplerAdvanced")) == 2 and not of(g, "CLIPVisionLoader") and "Fun Camera: Zoom In at speed 1.6" in notes, (g, notes))
g21, _ = WG.build({"family": "wan21", "mode": "camera", "models": ["m"], "images": {"start": "s.png"}, "camera": {"pose": "ClockWise (CW)"}, "frames": 33})
check("camera (2.1): CLIP vision on the picture too", of(g21, "CLIPVisionEncode") and "clip_vision_output" in g21[of(g21, "WanCameraImageToVideo")[0]]["inputs"])
gv, nv = WG.build({"family": "wan21", "mode": "vctrl", "models": ["vace"], "images": {"control": "camguide_wan.mp4", "ref": "first.png"}, "frames": 81})
vace = gv[of(gv, "WanVaceToVideo")[0]]["inputs"]
check("vctrl: LoadVideo (the guide) -> GetVideoComponents -> WanVaceToVideo control_video, the first picture its reference, trimmed",
      gv[of(gv, "LoadVideo")[0]]["inputs"] == {"file": "camguide_wan.mp4"} and vace.get("control_video") == [of(gv, "GetVideoComponents")[0], 0]
      and vace.get("reference_image", [None])[0] in of(gv, "LoadImage") and of(gv, "TrimVideoLatent") and vace.get("strength") == 1.0, gv)
for o, want in ((dict(mode="camera", images={}, camera={"pose": "Zoom In"}), "needs a start picture"),
                (dict(mode="camera", images={"start": "s"}, camera={"pose": "Barrel roll"}), "unknown Wan camera move"),
                (dict(mode="vctrl", images={}), "depth guide video")):
    try:
        WG.build(dict({"family": "wan21", "models": ["m"], "frames": 17}, **o))
        check(f"refused: {want}", False)
    except ValueError as e:
        check(f"refused in words: {want}", want in str(e), str(e))
names = ["wan2.2_fun_camera_high_noise_14B_fp8_scaled.safetensors", "wan2.2_fun_camera_low_noise_14B_fp8_scaled.safetensors",
         "wan2.2_i2v_high_noise_14B_fp8_scaled.safetensors", "wan2.2_i2v_low_noise_14B_fp8_scaled.safetensors",
         "Wan2.1-Fun-V1.1-14B-Control-Camera.safetensors", "wan2.1_i2v_720p_14B_fp8_e4m3fn.safetensors", "wan2.1_vace_14B_fp16.safetensors"]
check("pick_models: the Fun Camera pair for camera, the plain i2v pair for i2v (a camera file never taken for it), 2.1's Fun Camera file",
      WG.pick_models(names, "wan22", "camera")["models"] == names[:2] and WG.pick_models(names, "wan22", "i2v")["models"] == names[2:4]
      and WG.pick_models(names, "wan21", "camera")["models"] == [names[4]] and WG.pick_models(names, "wan21", "i2v")["models"] == [names[5]])
check("pick_models: vctrl runs on the VACE file; no camera file = an error naming the files to download",
      WG.pick_models(names, "wan21", "vctrl")["models"] == [names[6]]
      and "wan2.2_fun_camera_high_noise_14B" in WG.pick_models(names[2:4], "wan22", "camera").get("error", ""))
check("CAMERA_POSES = ComfyUI's WanCameraEmbedding camera_pose list (9)", len(WG.CAMERA_POSES) == 9 and "Anti Clockwise (ACW)" in WG.CAMERA_POSES)

# 2
lst = ["foo.safetensors", "ltx/ltx-2-19b-lora-camera-control-dolly-in.safetensors", "ltx-2-19b-lora-camera-control-jib-up.safetensors"]
check("ltx camera_lora: the move's LoRA (a subfolder too); another move / none -> None",
      LG.camera_lora(lst, "camera[-_ ]?control[-_ ]?dolly[-_ ]?in") == lst[1] and LG.camera_lora(lst, "camera[-_ ]?control[-_ ]?jib[-_ ]?up") == lst[2]
      and LG.camera_lora(lst, "camera[-_ ]?control[-_ ]?dolly[-_ ]?out") is None and LG.camera_lora(lst, "") is None)

# 3 LIVE
T = Path(tempfile.mkdtemp(prefix="cam399_"))
models = T / "models"
(models / "diffusion_models").mkdir(parents=True)
(models / "text_encoders").mkdir()
(models / "text_encoders" / "umt5_xxl_fp8_e4m3fn_scaled.safetensors").write_bytes(b"x")
for nm in ("wan2.2_fun_camera_high_noise_14B_fp8_scaled.safetensors", "wan2.2_fun_camera_low_noise_14B_fp8_scaled.safetensors",
           "wan2.2_i2v_high_noise_14B_fp8_scaled.safetensors", "wan2.2_i2v_low_noise_14B_fp8_scaled.safetensors",
           "wan2.1_vace_14B_fp16.safetensors", "wan2.1_i2v_720p_14B_fp8_e4m3fn.safetensors"):
    (models / "diffusion_models" / nm).write_bytes(b"x")
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
    guide = T / "camguide_t_depth.mp4"
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "lavfi", "-i", "gradients=size=320x192:rate=24", "-frames:v", "49",
                    "-pix_fmt", "yuv420p", str(guide)], check=True)

    def run_job(params, name):
        jd = T / name
        jd.mkdir()
        job = {"params": params, "config": {"engine": {"backend": "comfy", "comfy": {"url": f"http://127.0.0.1:{port}"}}},
               "output_dir": str(jd / "out"), "app_dir": str(ROOT)}
        (jd / "job.json").write_text(json.dumps(job))
        r = subprocess.run([sys.executable, "-u", str(ROOT / "misc" / "wan_worker.py"), str(jd / "job.json")], cwd=str(jd),
                           capture_output=True, text=True, timeout=180)
        q = json.loads((jd / "wan_queued.json").read_text()) if (jd / "wan_queued.json").exists() else {}
        return r, jd, q
    base = {"mode": "wan", "prompt": "a tree in a meadow. Camera: a push in.", "width": 320, "height": 192, "frames": 33, "seed": 3}
    r, jd, q = run_job(dict(base, wan_family="wan22", wan_mode="i2v", images={"start": str(pic)}, video_style={"name": "Wan 2.2", "phases": [{}, {}]},
                            camera={"pose": "Zoom In", "speed": 1.6, "approx": False, "exact": False, "depth": ""}), "c1")
    unet = [v["inputs"]["unet_name"] for v in q.values() if v["class_type"] == "UNETLoader"]
    emb = [v for v in q.values() if v["class_type"] == "WanCameraEmbedding"]
    check("LIVE Fun Camera (2.2): the Fun Camera pair, WanCameraEmbedding Zoom In @ 1.6, done (@@OUT)",
          r.returncode == 0 and "@@OUT " in r.stdout and unet == ["wan2.2_fun_camera_high_noise_14B_fp8_scaled.safetensors", "wan2.2_fun_camera_low_noise_14B_fp8_scaled.safetensors"]
          and emb and emb[0]["inputs"]["camera_pose"] == "Zoom In" and emb[0]["inputs"]["speed"] == 1.6 and "[camera] Fun Camera: Zoom In" in r.stdout,
          (r.returncode, r.stdout[-1500:], unet))
    r, jd, q = run_job(dict(base, wan_family="wan21", wan_mode="ref", images={"ref": str(pic)}, video_style={"name": "Wan 2.1", "phases": [{}]},
                            camera={"pose": "Zoom In", "speed": 1, "exact": True, "depth": str(guide)}), "c2")
    lv = [v for v in q.values() if v["class_type"] == "LoadVideo"]
    vace = [v for v in q.values() if v["class_type"] == "WanVaceToVideo"]
    rs = subprocess.run(["ffprobe", "-v", "error", "-count_frames", "-show_entries", "stream=nb_read_frames,r_frame_rate", "-of", "csv=p=0",
                         str(jd / "camguide_wan.mp4")], capture_output=True, text=True).stdout.strip()
    check("LIVE exact path (2.1 VACE): the depth guide resampled to 16 fps (33 frames), uploaded, LoadVideo -> VACE's control_video + the picture as its reference, done",
          r.returncode == 0 and "@@OUT " in r.stdout and lv and lv[0]["inputs"]["file"] == "camguide_wan.mp4" and vace
          and "control_video" in vace[0]["inputs"] and "reference_image" in vace[0]["inputs"] and rs.startswith("16/1,33")
          and "[camera] the exact path: camguide_t_depth.mp4 (resampled to 16 fps) is VACE's control video" in r.stdout,
          (r.returncode, r.stdout[-1500:], rs))
    # no Fun Camera model for 2.1 here: the words carry it, said; the clip renders as asked
    r, jd, q = run_job(dict(base, wan_family="wan21", wan_mode="i2v", images={"start": str(pic)}, video_style={"name": "Wan 2.1", "phases": [{}]},
                            camera={"pose": "Pan Left", "speed": 1, "exact": False, "depth": ""}), "c3")
    check("LIVE no Fun Camera model: the words carry it (said with the file to get), rendered image-to-video as asked",
          r.returncode == 0 and "the camera words carry it" in r.stdout and "Fun Camera" in r.stdout
          and any(v["class_type"] == "WanImageToVideo" for v in q.values()) and not any(v["class_type"] == "WanCameraEmbedding" for v in q.values()),
          r.stdout[-1200:])
    r, jd, q = run_job(dict(base, wan_family="wan22", wan_mode="t2v", images={}, video_style={"name": "Wan 2.2", "phases": [{}, {}]},
                            camera={"pose": "Zoom In", "speed": 1, "exact": False, "depth": ""}), "c4")
    check("LIVE no picture: Fun Camera starts from one - said, a text render with the words",
          "the reference dock has none: the camera words carry it" in r.stdout and not any(v["class_type"] == "WanCameraEmbedding" for v in q.values()),
          r.stdout[-800:])
finally:
    stub.kill()
    stub.wait()
    shutil.rmtree(T, ignore_errors=True)

print(f"\nRESULT: {len(FAILED)} failed")
sys.exit(1 if FAILED else 0)
