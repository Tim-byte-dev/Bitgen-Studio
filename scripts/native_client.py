"""bitGen Studio — talking to the native engine server (2.352.0). Runs in the APP's Python (no torch).

    ensure(ncfg, say)            -> base url; starts scripts/native/server.py in
                                    the native venv when nothing answers
    run(base, task, job, say)    -> the server's final dict; its log lines go to say
    health(base) / unload(base) / cancel(base) / shutdown(base)

ncfg = config["native"] (+ "python": the venv's python, "app_dir"). The server
is started DETACHED (it outlives the job that started it - that is the
point: the next job finds the models already loaded) and exits by itself after
idle_exit minutes.
"""
import json
import os
import subprocess
import time
import urllib.error
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
SERVER = HERE / "native" / "server.py"


class NativeError(Exception):
    pass


def base_url(ncfg):
    return f"http://127.0.0.1:{int((ncfg or {}).get('port') or 8199)}"


def _req(url, body=None, timeout=10):
    data = None if body is None else json.dumps(body).encode("utf-8")
    req = urllib.request.Request(url, data=data, method="GET" if body is None else "POST",
                                 headers={"Content-Type": "application/json"})
    return urllib.request.urlopen(req, timeout=timeout)


def health(base, timeout=3):
    try:
        with _req(base + "/health", timeout=timeout) as r:
            return json.loads(r.read() or b"{}")
    except Exception:                                   # noqa: BLE001
        return None


def _post(base, path, timeout=10):
    try:
        with _req(base + path, {}, timeout=timeout) as r:
            return json.loads(r.read() or b"{}")
    except Exception:                                   # noqa: BLE001
        return None


def unload(base):
    return _post(base, "/unload", timeout=120)


def cancel(base):
    return _post(base, "/cancel")


def shutdown(base):
    return _post(base, "/shutdown")


def free_for_comfy(cfg, say):
    """Before a ComfyUI job: a running native server with a model loaded hands back its RAM + VRAM."""
    base = base_url((cfg or {}).get("native") or {})
    h = health(base, timeout=1)
    if h and h.get("ok") and h.get("loaded") and not h.get("busy"):
        unload(base)
        say("[comfy] the native Viggle engine unloaded its model so ComfyUI has the RAM + GPU")


def free_comfy(cfg, say):
    """Before a native render: ask a running ComfyUI to drop its models (RAM + VRAM) - best effort."""
    url = str((((cfg or {}).get("engine") or {}).get("comfy") or {}).get("url") or "")
    if not url:
        return
    try:
        req = urllib.request.Request(url.rstrip("/") + "/free", data=json.dumps({"unload_models": True, "free_memory": True}).encode(),
                                     headers={"Content-Type": "application/json"}, method="POST")
        urllib.request.urlopen(req, timeout=3).read()
        say("[native] asked ComfyUI to free its models first (RAM + GPU)")
    except Exception:                                   # noqa: BLE001  (not running - nothing to free)
        pass


def ensure(ncfg, say, wait_s=240):
    """-> the base url of a live server (starts one if needed)."""
    base = base_url(ncfg)
    h = health(base)
    if h and h.get("ok"):
        return base
    py = str(ncfg.get("python") or "")
    if not py or not Path(py).is_file():
        raise NativeError(f"the native engine's Python is missing ({py or 'not set'}) - the swap dialog's ⚙ -> Viggle native -> ⤓ Install")
    logdir = Path(ncfg.get("log_dir") or (Path(ncfg.get("app_dir") or ".") / "logs"))
    logdir.mkdir(parents=True, exist_ok=True)
    log = open(logdir / "native-engine.log", "ab")
    args = [py, "-u", str(SERVER), "--port", str(int(ncfg.get("port") or 8199)),
            "--ram-budget-gb", str(float(ncfg.get("ram_budget_gb") or 0)), "--pack", str(ncfg.get("pack") or "int8"),
            "--pin", "1" if ncfg.get("pin", True) else "0", "--idle-unload", str(float(ncfg.get("idle_unload_min") or 20)),
            "--idle-exit", str(float(ncfg.get("idle_exit_min") or 120)), "--device", str(ncfg.get("device") or "auto")]
    env = {k: v for k, v in os.environ.items() if k not in ("PYTHONPATH", "PYTHONHOME")}
    env.update(PYTHONUNBUFFERED="1", PYTHONIOENCODING="utf-8", HF_HUB_OFFLINE="1", TRANSFORMERS_OFFLINE="1",
               PYTORCH_CUDA_ALLOC_CONF=env.get("PYTORCH_CUDA_ALLOC_CONF") or "expandable_segments:True")
    kw = dict(stdout=log, stderr=subprocess.STDOUT, stdin=subprocess.DEVNULL, env=env, cwd=str(HERE / "native"))
    if os.name == "nt":
        kw["creationflags"] = 0x00000008 | 0x00000200 | 0x08000000   # DETACHED | NEW_PROCESS_GROUP | NO_WINDOW
    else:
        kw["start_new_session"] = True
    say(f"[native] starting the engine server (port {int(ncfg.get('port') or 8199)}) - it keeps the models loaded between jobs")
    p = subprocess.Popen(args, **kw)
    t0 = time.time()
    while time.time() - t0 < wait_s:
        time.sleep(1.0)
        if p.poll() is not None:
            tail = ""
            try:
                tail = (logdir / "native-engine.log").read_text(encoding="utf-8", errors="replace").strip().splitlines()[-6:]
                tail = " | ".join(tail)
            except OSError:
                pass
            raise NativeError(f"the native engine server exited at once (code {p.returncode}) - {tail[-500:]}")
        h = health(base)
        if h and h.get("ok"):
            say(f"[native] engine server up (pid {h.get('pid')}, {int(time.time() - t0)}s)")
            return base
    raise NativeError(f"the native engine server did not answer on {base} within {wait_s}s (logs/native-engine.log)")


def run(base, task, job, say, timeout=6 * 3600):
    """POST /run and stream its lines. -> the final dict (ok true); raises NativeError with the reason."""
    body = dict(job, task=task)
    try:
        r = _req(base + "/run", body, timeout=timeout)
    except urllib.error.HTTPError as e:
        try:
            msg = json.loads(e.read() or b"{}").get("error")
        except Exception:                              # noqa: BLE001
            msg = None
        raise NativeError(msg or f"the native engine answered HTTP {e.code}")
    except Exception as e:                             # noqa: BLE001
        raise NativeError(f"could not reach the native engine ({type(e).__name__}: {e})")
    final = None
    with r:
        for raw in r:
            try:
                obj = json.loads(raw.decode("utf-8", "replace"))
            except ValueError:
                continue
            if "log" in obj:
                for ln in str(obj["log"]).splitlines():
                    say("[native] " + ln)
            if "ok" in obj:
                final = obj
    if final is None:
        raise NativeError("the native engine stopped answering mid-job (it most likely crashed - logs/native-engine.log)")
    if not final.get("ok"):
        raise NativeError(str(final.get("error") or "the native engine failed"))
    return final


def to_video(meta, frames_path, audio_path, master, out, fmt_args, fps=24, say=print, ffv1=None, pcm=None, keep=None):
    """Raw RGB24 frames (+ f32 audio) -> the FFV1 master (the first `keep` frames), then the playback file
    encoded ONCE from it."""
    w, h, sr, ch = meta["width"], meta["height"], meta.get("sr") or 0, meta.get("channels") or 0
    keep = min(int(keep or meta["frames"]), int(meta["frames"]))
    ffv1 = ffv1 or ["-c:v", "ffv1", "-level", "3", "-g", "1", "-slices", "16", "-slicecrc", "1", "-pix_fmt", "bgr0"]
    pcm = pcm or ["-c:a", "pcm_s24le"]
    cmd = ["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{w}x{h}", "-r", str(fps),
           "-i", str(frames_path)]
    if ch and sr and audio_path and Path(audio_path).is_file():
        cmd += ["-f", "f32le", "-ar", str(sr), "-ac", str(ch), "-i", str(audio_path), "-map", "0:v:0", "-map", "1:a:0"] + ffv1 + pcm + [
            "-af", "apad", "-t", f"{keep / fps:.4f}"]                    # the picture decides the length, never the audio
    else:
        cmd += ffv1 + ["-an"]
    cmd += ["-frames:v", str(keep)]                                      # an OUTPUT option: after every input
    r = subprocess.run(cmd + [str(master)], capture_output=True, text=True)
    if r.returncode != 0 or not Path(master).is_file():
        raise NativeError("ffmpeg could not build the lossless master: " + (r.stderr or "")[-300:])
    r = subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(master), "-r", str(fps)] + list(fmt_args) + [str(out)],
                       capture_output=True, text=True)
    if r.returncode != 0 or not Path(out).is_file():
        raise NativeError("ffmpeg could not encode the playback file from the master: " + (r.stderr or "")[-300:])
    say(f"[native] {keep} frames {w}x{h}" + (f" (of {meta['frames']} rendered)" if keep != meta["frames"] else "") + (f" + {ch}-channel audio @ {sr} Hz" if ch else " (no audio)")
        + f" -> {Path(out).name} (lossless master kept)")
