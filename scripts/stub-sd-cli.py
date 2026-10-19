#!/usr/bin/env python3
"""Stub sd-cli for e2e tests. Understands the app's real invocations:
  vid_gen  -> writes a testsrc2 video WITH sine audio (H3 generates audio)
  convert  -> writes a dummy .gguf
Prints step lines so the UI's (\\d+)/(\\d+) progress regex has food."""
import subprocess, sys, time

def arg(name, default=None):
    return sys.argv[sys.argv.index(name) + 1] if name in sys.argv else default

mode = arg("--mode", "vid_gen")

if mode == "img_gen":
    # A FAITHFUL stub matters more than a convenient one: a mock that is less
    # capable than the real thing lets tests pass while the real machine fails.
    # sd-cli writes ONE image at --output for a plain (non-%d) path, at exactly
    # --width x --height, so that is what this does.
    import os
    out = arg("--output", "out.png")
    w, h = arg("--width", "512"), arg("--height", "512")
    steps = int(arg("--steps", "20"))
    prompt = arg("--prompt", "")
    # e2e hook: a way to exercise the worker's failure path without a real model
    if "[imgfail]" in prompt:
        print("[stub sd-cli] cannot load model: unsupported architecture", flush=True)
        sys.exit(1)
    print(f"[stub sd-cli] img_gen {w}x{h} steps={steps} seed={arg('--seed', '-1')}", flush=True)
    print(f"[stub sd-cli] prompt: {prompt}", flush=True)
    for i in range(1, steps + 1):
        print(f"  step {i}/{steps} sampling", flush=True)
    # colour keyed on the seed so a batch is visibly N DIFFERENT pictures —
    # a stub that returned identical bytes would hide a seed-walk regression
    seed = int(arg("--seed", "0"))
    hue = (abs(seed) * 37) % 360
    rc = subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "lavfi",
                         "-i", f"color=c=0x{(hue * 7) % 256:02x}4080:s={w}x{h}",
                         "-frames:v", "1", out]).returncode
    print(f"[stub sd-cli] save result image 0 to '{out}'", flush=True)
    sys.exit(rc)

if mode == "convert":
    src, out = arg("-m"), arg("-o")
    qt = arg("--type", "q8_0")
    print(f"[stub sd-cli] convert {src} -> {out} ({qt})", flush=True)
    for i in range(1, 4):
        print(f"  quantizing {i}/3", flush=True); time.sleep(0.1)
    with open(out, "wb") as f:
        f.write(b"GGUF-stub\x00" + qt.encode())
    sys.exit(0)

w, h = arg("--width", "192"), arg("--height", "108")
frames = int(arg("--video-frames", "121"))
out = arg("--output")
seed = arg("--seed", "0")
prompt = arg("--prompt", "")
# e2e hook: simulate a compute-buffer OOM until segmented execution is used
import os
if "[vmmtest]" in prompt and os.environ.get("GGML_CUDA_DISABLE_GRAPHS") != "1":
    for l in ["[ERROR] ggml_extend.hpp:72   - CUDA error: device not ready",
              "[ERROR] ggml_extend.hpp:72   -   cuMemSetAccess(start_ptr, reserve_size, &access, 1)",
              "ggml-cuda.cu:106: CUDA error"]:
        print(l, flush=True)
    sys.exit(1)
oom2 = "[oomtest2]" in prompt and "--offload-to-cpu" not in sys.argv
if oom2 or ("[oomtest]" in prompt and "[oomtest2]" not in prompt and "--max-vram" not in sys.argv):
    for l in [
        "ggml_cuda_init: found 2 CUDA devices (Total VRAM: 57182 MiB):",
        "  Device 0: NVIDIA GeForce RTX 5090, compute capability 12.0, VMM: yes, VRAM: 32606 MiB",
        "  Device 1: NVIDIA GeForce RTX 3090, compute capability 8.6, VMM: yes, VRAM: 24575 MiB",
        "[INFO ] stable-diffusion.cpp:1757 - total params memory size = 44506.01MB "
        "(VRAM 25641.26MB, RAM 18864.74MB): text_encoders 18864.74MB(RAM), "
        "diffusion_model 20083.17MB(VRAM), vae 5558.09MB(VRAM), controlnet 0.00MB(N/A)",
        "[ERROR] ggml_extend.hpp:72   - ggml_backend_cuda_buffer_type_alloc_buffer: "
        "allocating 14890.27 MiB on device 0: cudaMalloc failed: out of memory",
        "[ERROR] ggml_extend.hpp:2234 - minimax_h3: failed to allocate the compute buffer",
    ]:
        print(l, flush=True)
    sys.exit(1)
fmt = out.rsplit(".", 1)[-1].lower()
steps = int(arg("--steps", "4"))
for i in range(1, steps + 1):
    print(f"  step {i}/{steps} sampling", flush=True); time.sleep(0.05)
dur = frames / 24.0
vcodec = ["-c:v", "mpeg4", "-q:v", "4"] if fmt == "avi" else ["-c:v", "libvpx-vp9", "-crf", "34", "-b:v", "0"]
acodec = ["-c:a", "pcm_s16le"] if fmt == "avi" else ["-c:a", "libopus"]
cmd = ["ffmpeg", "-y", "-loglevel", "error",
       "-f", "lavfi", "-i", f"testsrc2=size={w}x{h}:rate=24",
       "-f", "lavfi", "-i", f"sine=frequency={300 + int(seed) % 500}:sample_rate=48000",
       "-frames:v", str(frames), "-t", f"{dur:.6f}",
       "-pix_fmt", "yuv420p", *vcodec, *acodec, "-shortest", out]
sys.exit(subprocess.run(cmd).returncode)
