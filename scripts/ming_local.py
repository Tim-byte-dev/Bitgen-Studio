#!/usr/bin/env python3
"""bitGen Studio 2.594.0 - Ming-3.0 TTS (inclusionAI, 0.5B, 44.1 kHz) for lib/tts.js. Runs in <app>/ming-tts/.venv.

Tim (verbatim): "can you add https://nomorecoding.github.io/Ming-3.0-tts/ as an option for tts".

It drives the repository's own CLI (src/infer.py) so the model is used exactly the way its authors run it:
  a cloned voice    --task TTS --prompt_wav_path <clip> --prompt_text <its transcript> (--use_spk_emb when infer.py has it)
  a designed voice  --task VOICE_DESIGN + the description (the flag name is read from infer.py --help: --instruct,
                    --instruction, --caption, --voice_description, --description or --prompt_instruct)
  no voice          --task TTS with the text only
  always            --model_path <model> --text <text> --output <wav>, --language_id <language> when set,
                    --no_text_normalization when pynini (the text normaliser) is not installed here
infer.py's own output goes to stderr (the app shows it as progress); ONE JSON line on stdout is the answer.

  python ming_local.py <job.json>        job = {op: "speak" | "check", src, model, text, out, ref_audio, ref_text,
                                                instruct, language, device, emotion (高兴 …), emotion_en (happy …)}
  2.621.0 an emotion: --task EMOTION + --emotion (or --controls '{"emotion": …}') - with a cloned voice too; a designed
          voice + an emotion: --task FREEFORM + one instruction; a build with neither reads it plainly (and says so)
  python ming_local.py --check <src> <model>     the install's check (no speech)
Pure (tests): parse_flags(help_text), pick(flags, *names), build_cmd(job, flags, normalize).
"""
import json
import os
import re
import shutil
import subprocess
import sys
import time

TA_COMPAT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "ta_compat.py")   # 2.601.0: torchaudio without TorchCodec

EMOTION_FLAGS = ("--emotion", "--emo", "--emotion_label")     # 2.621.0: the EMOTION task's value (高兴 悲伤 愤怒 恐惧 厌恶 惊讶 中性)
FREEFORM_FLAGS = ("--instruction", "--instruct", "--prompt_instruct")
DESIGN_FLAGS = ("--instruct", "--instruction", "--caption", "--voice_description", "--description", "--prompt_instruct")
OUT_FLAGS = ("--output", "--output_path", "--out", "--save_path")


def out(obj):
    sys.stdout.write(json.dumps(obj) + "\n")
    sys.stdout.flush()


def log(s):
    sys.stderr.write("[tts] " + str(s) + "\n")
    sys.stderr.flush()


def parse_flags(text):
    """every --flag infer.py --help names (argparse prints them as '--name' or '--name VALUE')"""
    return sorted(set(re.findall(r"(?<![\w-])(--[A-Za-z][\w-]*)", str(text or ""))))


def pick(flags, *names):
    for n in names:
        if n in flags:
            return n
    return ""


def has_pynini():
    try:
        import pynini  # noqa: F401
        return True
    except Exception:  # noqa: BLE001
        return False


def help_flags(src):
    """infer.py --help, cached beside it (keyed on its size + time, so an update reads it again)"""
    infer = os.path.join(src, "infer.py")
    st = os.stat(infer)
    key = "%d:%d" % (st.st_size, int(st.st_mtime))
    cache = os.path.join(src, ".h3flags.json")
    try:
        with open(cache, "r", encoding="utf-8") as fh:
            c = json.load(fh)
        if c.get("key") == key and c.get("flags"):
            return c["flags"]
    except Exception:  # noqa: BLE001
        pass
    r = subprocess.run([sys.executable, infer, "--help"], cwd=src, capture_output=True, text=True, timeout=600)
    flags = parse_flags((r.stdout or "") + "\n" + (r.stderr or ""))
    if "--text" not in flags:
        raise RuntimeError("infer.py --help did not list --text - " + ((r.stderr or r.stdout or "").strip().splitlines() or ["no output"])[-1])
    try:
        with open(cache, "w", encoding="utf-8") as fh:
            json.dump({"key": key, "flags": flags}, fh)
    except Exception:  # noqa: BLE001
        pass
    return flags


def build_cmd(job, flags, normalize):
    """the infer.py command line for a job -> (args, out_flag) - raises ValueError for a job it cannot speak"""
    text = str(job.get("text") or "").strip()
    if not text:
        raise ValueError("nothing to say")
    args = ["infer.py", "--model_path", str(job.get("model") or "")]
    ref, instruct = job.get("ref_audio"), str(job.get("instruct") or "").strip()
    emo, emo_en = str(job.get("emotion") or "").strip(), str(job.get("emotion_en") or "").strip()
    task = "TTS"
    if emo and instruct and pick(flags, *FREEFORM_FLAGS) and "--task" in flags:
        # 2.621.0: a designed voice + an emotion = one free-form instruction (EMOTION and VOICE_DESIGN do not mix)
        task = "FREEFORM"
        args += [pick(flags, *FREEFORM_FLAGS), "%s. Speak with a %s emotion." % (instruct.rstrip(". "), emo_en or emo)]
        instruct = ""
    elif instruct:
        f = pick(flags, *DESIGN_FLAGS)
        if not f:
            raise ValueError("this Ming-3.0 TTS build has no voice-design option (infer.py --help names none) - use a cloned voice")
        task = "VOICE_DESIGN"
        args += [f, instruct]
    elif ref:
        rt = str(job.get("ref_text") or "").strip()
        if not rt:
            raise ValueError("Ming-3.0 TTS clones from the clip AND its exact transcript - this voice has no transcript (add it in Settings ▸ Audio ▸ Voice clones)")
        args += ["--prompt_wav_path", str(ref), "--prompt_text", rt]
        if "--use_spk_emb" in flags:
            args.append("--use_spk_emb")
    if emo and task == "TTS":
        # 2.621.0: the EMOTION task (with a cloned voice too); a build without an emotion option speaks it plainly
        ef = pick(flags, *EMOTION_FLAGS)
        if ef:
            task = "EMOTION"
            args += [ef, emo]
        elif "--controls" in flags:
            task = "EMOTION"
            args += ["--controls", json.dumps({"emotion": emo}, ensure_ascii=False)]
    if "--task" in flags:
        args += ["--task", task]
    lang = str(job.get("language") or "").strip()
    if lang and "--language_id" in flags:
        args += ["--language_id", lang]
    args += ["--text", text]
    of = pick(flags, *OUT_FLAGS)
    if of:
        args += [of, str(job.get("out") or "")]
    if not normalize and "--no_text_normalization" in flags:
        args.append("--no_text_normalization")
    return args, of


def env_for(device):
    e = dict(os.environ, PYTHONUTF8="1", PYTHONUNBUFFERED="1")
    d = str(device or "cuda")
    if d == "cpu":
        e["CUDA_VISIBLE_DEVICES"] = ""
    else:
        m = re.match(r"cuda:(\d+)$", d)
        if m:
            e["CUDA_VISIBLE_DEVICES"] = m.group(1)
    return e


def newest_wav(d, since):
    best = None
    for root, _dirs, files in os.walk(d):
        for f in files:
            if f.lower().endswith(".wav"):
                p = os.path.join(root, f)
                t = os.path.getmtime(p)
                if t >= since and (best is None or t > best[0]):
                    best = (t, p)
    return best[1] if best else None


def speak(job):
    src, model, dest = job.get("src") or "", job.get("model") or "", job.get("out") or ""
    if not os.path.isfile(os.path.join(src, "infer.py")):
        return {"error": "Ming-3.0 TTS is not installed (no infer.py in %s) - Settings ▸ Add-ons ▸ Ming-3.0 TTS" % src}
    if not os.path.isdir(model):
        return {"error": "the Ming-3.0 TTS model is not there (%s) - Install it again in Settings ▸ Add-ons" % model}
    flags = help_flags(src)
    norm = has_pynini()
    try:
        args, of = build_cmd(job, flags, norm)
    except ValueError as e:
        return {"error": str(e)}
    os.makedirs(os.path.dirname(os.path.abspath(dest)), exist_ok=True)
    t0 = time.time()
    if job.get("emotion") and not (pick(flags, *EMOTION_FLAGS) or "--controls" in flags or (job.get("instruct") and pick(flags, *FREEFORM_FLAGS))):
        log("this Ming-3.0 TTS build's infer.py has no emotion option - read plainly")
    log("Ming-3.0 TTS: %s%s" % ("voice design" if job.get("instruct") else "clone" if job.get("ref_audio") else "default voice",
                                "" if norm else " (no text normalisation - pynini is not installed)"))
    # 2.601.0: through ta_compat - torchaudio 2.9+ without TorchCodec reads / writes audio anyway (it stopped with
    # "TorchCodec is required for load_with_torchcodec")
    p = subprocess.Popen([sys.executable, TA_COMPAT] + args, cwd=src, env=env_for(job.get("device")),
                         stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, encoding="utf-8", errors="replace")
    tail = []
    for line in p.stdout:
        line = line.rstrip()
        if line:
            log(line)
            tail = (tail + [line])[-6:]
    code = p.wait()
    if code != 0:
        return {"error": "Ming-3.0 TTS stopped (%d): %s" % (code, " | ".join(tail[-3:]) or "no output")}
    if not os.path.isfile(dest):
        found = newest_wav(src, t0 - 1)          # an infer.py without an output flag writes under its own folder
        if not found:
            return {"error": "Ming-3.0 TTS finished but wrote no .wav%s" % ("" if of else " (infer.py has no output option)")}
        shutil.move(found, dest)
    return {"ok": True, "out": dest, "seconds": round(time.time() - t0, 1), "normalize": norm}


def check(src, model):
    try:
        flags = help_flags(src)
    except Exception as e:  # noqa: BLE001
        return {"error": str(e)}
    try:
        import torch
        dev = "cuda" if torch.cuda.is_available() else "cpu"
    except Exception as e:  # noqa: BLE001
        return {"error": "PyTorch does not load: %s" % e}
    return {"ok": True, "flags": flags, "normalize": has_pynini(), "device": dev, "model": os.path.isdir(model),
            "design": bool(pick(flags, *DESIGN_FLAGS))}


def main():
    if len(sys.argv) >= 4 and sys.argv[1] == "--check":
        out(check(sys.argv[2], sys.argv[3]))
        return 0
    if len(sys.argv) < 2:
        out({"error": "usage: ming_local.py <job.json> | --check <src> <model>"})
        return 2
    with open(sys.argv[1], "r", encoding="utf-8") as fh:
        job = json.load(fh)
    try:
        r = check(job.get("src") or "", job.get("model") or "") if job.get("op") == "check" else speak(job)
    except Exception as e:  # noqa: BLE001
        r = {"error": "Ming-3.0 TTS: %s" % e}
    out(r)
    return 0 if not r.get("error") else 1


if __name__ == "__main__":
    sys.exit(main())
