#!/usr/bin/env python3
"""singvoice_local.py (2.965.0) - SING IT IN MY VOICE: singing voice conversion, run INSIDE an engine's own venv.

Tim: "lets get all of them and add them to a dropdown, we will put a tool row in the synth tab of audio docker above the
timeline. give it a go button ... add another button to separate the vocal from the instrumental".

Invoked as `<engine venv python> singvoice_local.py <job.json>` (the lib/venv.js runJson contract): reads one job, prints ONE
json line on stdout, logs to stderr. Only the standard library is imported here at the top - each engine's own code is
imported (or run as its own program) inside the engine's folder.

Job (convert):
  {"task": "convert", "engine": "seedvc" | "soulx" | "rvc", "src_dir": <the engine's code>, "source": <the vocal wav>,
   "out": <the wav to write>, "shift": semitones (-24..24), "auto_shift": true = fitted to the clip (2.967.0), "quality": "fast" | "good" | "best", "device": "auto" | "cuda" | "cpu",
   seedvc / soulx: "ref": <a clip of the voice>,  soulx: "models_dir": <its downloaded files>,
   rvc: "pth": <the voice model>, "index": <its .index>, "logs_dir": <Applio's models folder>}
Job (train - RVC only, through Applio's own core.py):
  {"task": "train", "engine": "rvc", "src_dir", "logs_dir", "name": <model name>, "dataset": <folder of wavs>, "epochs": n}
  -> {"pth": ..., "index": ...}
Job (check): {"task": "check", "engine": ...} -> {"ok": true} (imports only - the install's last step)
Answer: {"out": <path>, "seconds": n} | {"pth", "index"} | {"ok": true} | {"error": "..."}

  Seed-VC (Plachtaa/seed-vc, GPL-3.0): its own inference.py with --f0-condition True (the 44.1 kHz singing model, whose
          files it fetches from Hugging Face on the first run), --semi-tone-shift, --diffusion-steps 25 / 40 / 60.
  SoulX-Singer SVC (Soul-AILab/SoulX-Singer, Apache-2.0): its RMVPE pitch tracker on the reference and the vocal
          (preprocess/tools/f0_extraction.py), then cli/inference_svc.py's build_model + process - imported here, its
          audio read with soundfile + librosa (newer torchaudio wants torchcodec); n_steps 16 / 32 / 48, cfg 3.
  RVC (IAHispano/Applio, MIT): `core.py infer` with the voice model and its index, rmvpe pitch; `core.py preprocess /
          extract / train` (+ the index, which train makes at the end) for a new voice model.
"""
import glob
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time

STEPS = {"seedvc": {"fast": 25, "good": 40, "best": 60}, "soulx": {"fast": 16, "good": 32, "best": 48}}


def log(*a):
    sys.stderr.write(" ".join(str(x) for x in a) + "\n")
    sys.stderr.flush()


def run(cmd, cwd, env=None):
    """a program of the engine's, its output streamed to our log; -> its exit code"""
    log("$ " + " ".join(os.path.basename(c) if i == 0 else c for i, c in enumerate(cmd)))
    e = dict(os.environ)
    e.update(env or {})
    e.setdefault("PYTHONUTF8", "1")
    e.setdefault("PYTHONIOENCODING", "utf-8")
    p = subprocess.Popen(cmd, cwd=cwd, env=e, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, encoding="utf-8", errors="replace")
    for line in p.stdout:
        line = line.rstrip()
        if line:
            log(line[-400:])
    return p.wait()


def device_of(job):
    d = str(job.get("device") or "auto")
    if d in ("cuda", "cpu"):
        return d
    try:
        import torch  # noqa: the engine's venv has it
        return "cuda" if torch.cuda.is_available() else "cpu"
    except Exception:
        return "cpu"


def shift_of(job):
    try:
        return max(-24, min(24, int(round(float(job.get("shift") or 0)))))
    except Exception:
        return 0


def auto_of(job):
    """2.967.0: Key = Auto - the song moved to where the clip of your voice sits (Seed-VC --auto-f0-adjust, SoulX-Singer
    auto_shift); only with no shift of its own"""
    return bool(job.get("auto_shift")) and shift_of(job) == 0


def seconds_of(path):
    try:
        import soundfile as sf
        info = sf.info(path)
        return round(info.frames / float(info.samplerate), 2)
    except Exception:
        return None


# ---------------------------------------------------------------- Seed-VC
def seedvc(job):
    src = job["src_dir"]
    if not os.path.isfile(os.path.join(src, "inference.py")):
        return {"error": "Seed-VC's code is not there (" + src + ") - install it again in Settings ▸ Add-ons"}
    work = tempfile.mkdtemp(prefix="h3sing_")
    steps = STEPS["seedvc"].get(job.get("quality") or "good", 40)
    cmd = [sys.executable, "inference.py", "--source", job["source"], "--target", job["ref"], "--output", work,
           "--diffusion-steps", str(steps), "--length-adjust", "1.0", "--inference-cfg-rate", "0.7",
           "--f0-condition", "True", "--auto-f0-adjust", "True" if auto_of(job) else "False", "--semi-tone-shift", str(shift_of(job)),
           "--fp16", "True" if device_of(job) == "cuda" else "False"]
    code = run(cmd, src)
    outs = sorted(glob.glob(os.path.join(work, "*.wav")), key=os.path.getmtime)
    if code != 0 or not outs:
        shutil.rmtree(work, ignore_errors=True)
        return {"error": "Seed-VC stopped (exit %s) - see the log" % code}
    shutil.move(outs[-1], job["out"])
    shutil.rmtree(work, ignore_errors=True)
    return {"out": job["out"], "seconds": seconds_of(job["out"])}


# ---------------------------------------------------------------- SoulX-Singer SVC
def soulx(job):
    src, models = job["src_dir"], job.get("models_dir") or ""
    ckpt = os.path.join(models, "SoulX-Singer", "model-svc.pt")
    rmvpe = os.path.join(models, "SoulX-Singer-Preprocess", "rmvpe", "rmvpe.pt")
    for need, what in ((os.path.join(src, "cli", "inference_svc.py"), "its code"), (ckpt, "its model (model-svc.pt)"), (rmvpe, "its pitch tracker (rmvpe.pt)")):
        if not os.path.isfile(need):
            return {"error": "SoulX-Singer: " + what + " is not there (" + need + ") - install it again in Settings ▸ Add-ons"}
    sys.path.insert(0, src)
    os.chdir(src)                                    # its config and imports are relative to its folder
    import numpy as np
    import soundfile as sf
    import librosa
    import torch
    dev = device_of(job)
    work = tempfile.mkdtemp(prefix="h3sing_")
    # the reference: mono, 30 s at most (its web page's limit)
    ref, sr = librosa.load(job["ref"], sr=44100, mono=True)
    ref = ref[: 44100 * 30]
    pwav = os.path.join(work, "prompt.wav")
    sf.write(pwav, ref, 44100)
    voc, _ = librosa.load(job["source"], sr=44100, mono=True)
    twav = os.path.join(work, "target.wav")
    sf.write(twav, voc, 44100)
    from preprocess.tools.f0_extraction import F0Extractor
    log("[..] the pitch of the reference and the vocal (RMVPE)")
    fx = F0Extractor(model_path=rmvpe, device=dev)
    pf0, tf0 = os.path.join(work, "prompt_f0.npy"), os.path.join(work, "target_f0.npy")
    fx.process(pwav, f0_path=pf0)
    fx.process(twav, f0_path=tf0)
    del fx
    import soulxsinger.utils.audio_utils as AU

    def load_wav(path, sample_rate):                 # no torchaudio.load (torchcodec) - soundfile + librosa
        y, _ = librosa.load(path, sr=sample_rate, mono=True)
        return torch.from_numpy(np.ascontiguousarray(y, dtype=np.float32)).unsqueeze(0)
    AU.load_wav = load_wav
    import cli.inference_svc as SVC
    SVC.load_wav = load_wav
    from soulxsinger.utils.file_utils import load_config
    config = load_config(os.path.join(src, "soulxsinger", "config", "soulxsinger.yaml"))
    fp16 = dev == "cuda"
    log("[..] SoulX-Singer SVC (%s%s)" % (dev, ", fp16" if fp16 else ""))
    model = SVC.build_model(model_path=ckpt, config=config, device=dev, use_fp16=fp16)

    class A:                                         # what cli/inference_svc.py's process() reads
        pass
    a = A()
    a.device, a.prompt_wav_path, a.target_wav_path, a.prompt_f0_path, a.target_f0_path = dev, pwav, twav, pf0, tf0
    a.save_dir, a.auto_shift, a.pitch_shift = work, auto_of(job), shift_of(job)
    a.n_steps, a.cfg, a.use_fp16 = STEPS["soulx"].get(job.get("quality") or "good", 32), 3.0, fp16
    SVC.process(a, config, model)
    gen = os.path.join(work, "generated.wav")
    if not os.path.isfile(gen):
        return {"error": "SoulX-Singer made no generated.wav - see the log"}
    shutil.move(gen, job["out"])
    shutil.rmtree(work, ignore_errors=True)
    return {"out": job["out"], "seconds": seconds_of(job["out"])}


# ---------------------------------------------------------------- RVC (Applio)
def applio_env(job):
    return {"APPLIO_LOGS_DIR": job.get("logs_dir") or "", "APPLIO_ROOT": job["src_dir"]}


def rvc(job):
    src = job["src_dir"]
    if not os.path.isfile(os.path.join(src, "core.py")):
        return {"error": "Applio's code is not there (" + src + ") - install it again in Settings ▸ Add-ons"}
    for k in ("pth", "index"):
        if not os.path.isfile(job.get(k) or ""):
            return {"error": "the voice model's ." + k + " file is not there: " + str(job.get(k))}
    cmd = [sys.executable, "core.py", "infer", "--input-path", job["source"], "--output-path", job["out"],
           "--pth-path", job["pth"], "--index-path", job["index"], "--pitch", str(shift_of(job)),
           "--f0-method", "rmvpe", "--index-rate", "0.75", "--protect", "0.33", "--volume-envelope", "1.0", "--export-format", "WAV"]
    code = run(cmd, src, applio_env(job))
    if code != 0 or not os.path.isfile(job["out"]):
        return {"error": "Applio's infer stopped (exit %s) - see the log" % code}
    return {"out": job["out"], "seconds": seconds_of(job["out"])}


def newest_model(logs, name):
    d = os.path.join(logs, name)
    best, step = None, -1
    for p in glob.glob(os.path.join(d, name + "_*e_*s.pth")):
        m = re.search(r"_(\d+)e_(\d+)s\.pth$", p)
        if m and int(m.group(2)) > step:
            best, step = p, int(m.group(2))
    idx = os.path.join(d, name + ".index")
    if not os.path.isfile(idx):
        more = glob.glob(os.path.join(d, "*.index"))
        idx = more[0] if more else None
    return best, idx


def train(job):
    src, logs, name = job["src_dir"], job.get("logs_dir") or "", str(job.get("name") or "")
    if not re.match(r"^[A-Za-z0-9_-]{1,40}$", name):
        return {"error": "a model name of letters, numbers, - and _ (up to 40)"}
    if not os.path.isfile(os.path.join(src, "core.py")):
        return {"error": "Applio's code is not there (" + src + ") - install it again in Settings ▸ Add-ons"}
    os.makedirs(logs, exist_ok=True)
    cores = str(max(1, min(16, (os.cpu_count() or 4) - 1)))
    gpu = "0" if device_of(job) == "cuda" else "-"
    epochs = max(20, min(1000, int(job.get("epochs") or 300)))
    env = applio_env(job)
    t0 = time.time()
    steps = [
        ("1/3 cutting your recordings", ["preprocess", "--model-name", name, "--dataset-path", job["dataset"], "--sample-rate", "40000",
                                        "--cpu-cores", cores, "--cut-preprocess", "Automatic"]),
        ("2/3 reading pitch and voice features", ["extract", "--model-name", name, "--f0-method", "rmvpe", "--cpu-cores", cores, "--gpu", gpu,
                                                 "--sample-rate", "40000", "--embedder-model", "contentvec"]),
        ("3/3 training (%d epochs) + the index" % epochs, ["train", "--model-name", name, "--sample-rate", "40000", "--total-epoch", str(epochs),
                                                           "--save-every-epoch", str(max(1, min(100, epochs // 4))), "--save-only-latest",
                                                           "--save-every-weights", "--batch-size", "8", "--gpu", "0",
                                                           "--index-algorithm", "Auto"]),
    ]
    for what, args in steps:
        log("[..] " + what)
        code = run([sys.executable, "core.py"] + args, src, env)
        if code != 0:
            return {"error": "Applio stopped at %s (exit %s) - see the log" % (what, code)}
    pth, idx = newest_model(logs, name)
    if not pth or not idx:
        return {"error": "training finished but no %s_<epochs>e_<steps>s.pth + %s.index came out - see the log" % (name, name)}
    return {"pth": pth, "index": idx, "minutes": round((time.time() - t0) / 60, 1)}


# ---------------------------------------------------------------- the install's check
def check(job):
    eng, src = job.get("engine"), job.get("src_dir") or ""
    try:
        if eng == "seedvc":
            sys.path.insert(0, src); os.chdir(src)
            import torch, librosa, hf_utils  # noqa
            from modules.commons import str2bool  # noqa
        elif eng == "soulx":
            sys.path.insert(0, src); os.chdir(src)
            import torch, librosa, soundfile  # noqa
            from preprocess.tools.f0_extraction import F0Extractor  # noqa
            from soulxsinger.models.soulxsinger_svc import SoulXSingerSVC  # noqa
        elif eng == "rvc":
            sys.path.insert(0, src); os.chdir(src)
            import torch, faiss, librosa  # noqa
            import click  # noqa
        else:
            return {"error": "no such engine: %s" % eng}
        import torch
        return {"ok": True, "cuda": bool(torch.cuda.is_available()), "torch": torch.__version__}
    except ImportError as e:
        return {"error": "missing module: %s" % (getattr(e, "name", None) or e), "missing": getattr(e, "name", None) or ""}
    except Exception as e:
        return {"error": "%s: %s" % (type(e).__name__, e)}


def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "singvoice_local: expected <job.json>"}))
        return 2
    with open(sys.argv[1], "r", encoding="utf-8") as fh:
        job = json.load(fh)
    task, eng = job.get("task") or "convert", job.get("engine")
    try:
        if task == "check":
            out = check(job)
        elif task == "train":
            out = train(job) if eng == "rvc" else {"error": "only RVC models are trained"}
        else:
            if not os.path.isfile(job.get("source") or ""):
                out = {"error": "no such vocal: %s" % job.get("source")}
            elif eng in ("seedvc", "soulx") and not os.path.isfile(job.get("ref") or ""):
                out = {"error": "no clip of your voice: %s" % job.get("ref")}
            else:
                out = {"seedvc": seedvc, "soulx": soulx, "rvc": rvc}.get(eng, lambda j: {"error": "no such engine: %s" % eng})(job)
    except Exception as e:
        import traceback
        log(traceback.format_exc())
        out = {"error": "%s: %s" % (type(e).__name__, e)}
    print(json.dumps(out))
    return 0 if not out.get("error") else 1


if __name__ == "__main__":
    sys.exit(main())
