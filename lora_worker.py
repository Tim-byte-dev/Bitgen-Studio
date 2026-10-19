#!/usr/bin/env python3
"""bitGen Studio - lora_worker.py (2.520.0): the LoRA trainer's queue jobs (lib/loraTrain.js).

Tim (verbatim): "build a lora floating docker for creating lora's like ai toolkit by ostris. keep our theme."

    mode install_aitoolkit   git clone ostris/ai-toolkit into <app>/ai-toolkit (or its zip when git is missing),
                             a venv (venvs/aitoolkit), PyTorch for this card (the torch index lib/setupGpu picks),
                             its requirements.txt, then <ai-toolkit>/.bitgen-installed
    mode lora_train          <venv python> run.py <config.yaml> in the ai-toolkit folder; its tqdm progress becomes
                             "step N/M" lines (the queue's progress bar); then the final LoRA is copied into ComfyUI's
                             loras folder as trained/<name>.safetensors + <name>.bitgen.json (the Model manager's card)
                             + <name>.preview.<ext> (the last sample)

    2.521.0: a FULL fine-tune (the presets marked "full", L["full"]) - ai-toolkit saves it in diffusers format; finish_full
    joins the transformer / unet shards into ONE .safetensors (merge_safetensors - pure Python, no torch) in ComfyUI's
    diffusion_models/trained/<name>.safetensors (+ its card + preview) - ComfyUI's UNETLoader reads diffusers keys

    python lora_worker.py job.json
"""
import json
import os
import re
import shutil
import subprocess
import sys
import time
import urllib.request
import zipfile
from datetime import date

IS_WIN = os.name == "nt"


def say(msg):
    print(msg, flush=True)


def run(cmd, cwd=None, env=None, progress=False):
    """Run a command, streaming its output; tqdm's carriage returns become lines (at most one a second)."""
    say("[lora] $ " + " ".join(str(c) for c in cmd))
    p = subprocess.Popen(cmd, cwd=cwd, env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, bufsize=0)
    buf, last = b"", 0.0
    rx = re.compile(r"(\d+)/(\d+)\s*\[")
    while True:
        ch = p.stdout.read(4096)
        if not ch:
            break
        buf += ch
        while True:
            m = re.search(rb"[\r\n]", buf)
            if not m:
                break
            line, buf = buf[:m.start()].decode("utf-8", "replace").strip(), buf[m.end():]
            if not line:
                continue
            hit = rx.search(line)
            if hit and progress:
                now = time.time()
                if now - last < 1.0 and hit.group(1) != hit.group(2):
                    continue
                last = now
                loss = re.search(r"loss[:=]\s*([0-9.eE+-]+)", line)
                say(f"[lora] step {hit.group(1)}/{hit.group(2)}" + (f" loss {loss.group(1)}" if loss else "") + "  " + line[-120:])
            elif hit:
                now = time.time()
                if now - last >= 2.0:
                    last = now
                    say(line[-200:])
            else:
                say(line[-400:])
    if buf.strip():
        say(buf.decode("utf-8", "replace").strip()[-400:])
    return p.wait()


def venv_python(venv):
    return os.path.join(venv, "Scripts" if IS_WIN else "bin", "python.exe" if IS_WIN else "python")


def install(L):
    aitk, venv = L["aitk_dir"], L["venv"]
    if not os.path.exists(os.path.join(aitk, "run.py")):
        git = shutil.which("git")
        if git:
            code = run([git, "clone", "--depth", "1", "https://github.com/ostris/ai-toolkit.git", aitk])
            if code != 0:
                say("[lora] git clone failed")
                return 1
        else:
            say("[lora] no git here - downloading ai-toolkit's zip")
            tmp = aitk + ".zip"
            urllib.request.urlretrieve("https://github.com/ostris/ai-toolkit/archive/refs/heads/main.zip", tmp)
            with zipfile.ZipFile(tmp) as z:
                z.extractall(os.path.dirname(aitk))
            os.remove(tmp)
            src = os.path.join(os.path.dirname(aitk), "ai-toolkit-main")
            if os.path.isdir(src) and not os.path.exists(aitk):
                os.rename(src, aitk)
        sub = shutil.which("git")
        if sub and os.path.isdir(os.path.join(aitk, ".git")):
            run([sub, "submodule", "update", "--init", "--recursive"], cwd=aitk)
    say("[lora] ai-toolkit is in " + aitk)
    py = venv_python(venv)
    if not os.path.exists(py):
        code = run([sys.executable, "-m", "venv", venv])
        if code != 0:
            say("[lora] could not make the venv")
            return 1
    run([py, "-m", "pip", "install", "--upgrade", "pip"])
    torch = ["torch", "torchvision", "torchaudio"]
    idx = L.get("torch") or ""
    if L.get("cuda") and idx:
        code = run([py, "-m", "pip", "install", "--no-cache-dir"] + torch + ["--index-url", "https://download.pytorch.org/whl/" + idx])
    else:
        code = run([py, "-m", "pip", "install", "--no-cache-dir"] + torch)
    if code != 0:
        say("[lora] PyTorch did not install")
        return 1
    code = run([py, "-m", "pip", "install", "-r", os.path.join(aitk, "requirements.txt")], cwd=aitk)
    if code != 0:
        say("[lora] ai-toolkit's requirements did not install - see above")
        return 1
    with open(os.path.join(aitk, ".bitgen-installed"), "w") as f:
        f.write(json.dumps({"when": time.strftime("%Y-%m-%d %H:%M:%S"), "torch": idx}))
    say("[lora] ai-toolkit is ready - the LoRA trainer can start")
    return 0


def finish(L):
    """Copy the finished LoRA into ComfyUI's loras folder with its card + preview."""
    out, name = L["output"], L["name"]
    try:
        files = sorted(f for f in os.listdir(out) if f.endswith(".safetensors"))
    except OSError:
        files = []
    final = name + ".safetensors" if name + ".safetensors" in files else (sorted(f for f in files if f.startswith(name + "_")) or files or [None])[-1]
    if not final:
        say("[lora] no .safetensors in " + out)
        return None
    dest_dir = os.path.join(L["loras_dir"], "trained") if L.get("loras_dir") else os.path.join(L["job_dir"], "result")
    os.makedirs(dest_dir, exist_ok=True)
    dest = os.path.join(dest_dir, name + ".safetensors")
    shutil.copy2(os.path.join(out, final), dest)
    card = {"v": 1, "user": {"title": name, "family": L.get("family") or "", "keywords": [L["trigger"]] if L.get("trigger") else [],
                             "released": date.today().isoformat(),
                             "description": f"Trained in bitGen Studio's LoRA trainer (ai-toolkit) on {L.get('base', '')}: "
                                            f"{L.get('images', 0)} pictures, {L.get('steps', 0)} steps"
                                            + (f", trigger word \"{L['trigger']}\"" if L.get("trigger") else "") + f". From {final}."}}
    with open(os.path.join(dest_dir, name + ".bitgen.json"), "w", encoding="utf-8") as f:
        json.dump(card, f, indent=2)
    sd = os.path.join(out, "samples")
    try:
        samples = sorted(f for f in os.listdir(sd) if re.search(r"\.(png|jpe?g|webp)$", f, re.I))
    except OSError:
        samples = []
    if samples:
        ext = os.path.splitext(samples[-1])[1].lower().replace(".jpg", ".jpeg")
        shutil.copy2(os.path.join(sd, samples[-1]), os.path.join(dest_dir, name + ".preview" + ext))
    with open(os.path.join(L["job_dir"], "installed.json"), "w") as f:
        json.dump({"file": dest, "from": final, "when": time.strftime("%Y-%m-%d %H:%M:%S")}, f)
    say(f"[lora] the LoRA is in ComfyUI's loras folder: trained/{name}.safetensors (the Model manager's LoRAs)")
    return dest


def read_st_header(path):
    """a .safetensors file's header (dict) and where its data starts"""
    with open(path, "rb") as f:
        n = int.from_bytes(f.read(8), "little")
        if n <= 0 or n > 100 * 1024 * 1024:
            raise ValueError(f"{path} is not a .safetensors file")
        head = json.loads(f.read(n).decode("utf-8"))
    return head, 8 + n


def merge_safetensors(files, dest):
    """join shards (diffusion_pytorch_model-0000N-of-0000M.safetensors) into one file, streamed (pure)"""
    tensors, meta = [], {}
    for fp in files:
        head, start = read_st_header(fp)
        for k, v in head.items():
            if k == "__metadata__":
                meta.update(v or {})
                continue
            tensors.append((k, v, fp, start))
    names = [t[0] for t in tensors]
    if len(set(names)) != len(names):
        raise ValueError("the shards share tensor names - not one model")
    out_head, off = {}, 0
    for k, v, fp, start in tensors:
        a, b = v["data_offsets"]
        out_head[k] = {"dtype": v["dtype"], "shape": v["shape"], "data_offsets": [off, off + (b - a)]}
        off += b - a
    meta = dict(meta)
    meta["bitgen"] = "joined by bitGen Studio (lora_worker.merge_safetensors)"
    out_head["__metadata__"] = {str(k): str(v) for k, v in meta.items()}
    hb = json.dumps(out_head, separators=(",", ":")).encode("utf-8")
    hb += b" " * ((8 - len(hb) % 8) % 8)
    tmp = dest + ".part"
    with open(tmp, "wb") as o:
        o.write(len(hb).to_bytes(8, "little"))
        o.write(hb)
        for k, v, fp, start in tensors:
            a, b = v["data_offsets"]
            with open(fp, "rb") as f:
                f.seek(start + a)
                left = b - a
                while left > 0:
                    ch = f.read(min(left, 64 * 1024 * 1024))
                    if not ch:
                        raise ValueError(f"{fp} is cut short")
                    o.write(ch)
                    left -= len(ch)
    os.replace(tmp, dest)
    return len(tensors)


def find_diffusers(out, name):
    """the newest transformer/ or unet/ folder ai-toolkit saved (the final one - <name>/ - first)"""
    cands = []
    for root, _dirs, files in os.walk(out):
        if os.path.basename(root) in ("transformer", "unet") and any(f.endswith(".safetensors") for f in files):
            cands.append(root)
    if not cands:
        return None
    final = [c for c in cands if os.path.basename(os.path.dirname(c)) == name]
    return max(final or cands, key=os.path.getmtime)


def finish_full(L):
    """a full fine-tune: one .safetensors in ComfyUI's diffusion_models/trained + its card + preview"""
    out, name = L["output"], L["name"]
    dest_dir = os.path.join(L["models_dir"], "trained") if L.get("models_dir") else os.path.join(L["job_dir"], "result")
    os.makedirs(dest_dir, exist_ok=True)
    dest = os.path.join(dest_dir, name + ".safetensors")
    src = find_diffusers(out, name)
    if src:
        shards = sorted(os.path.join(src, f) for f in os.listdir(src) if f.endswith(".safetensors"))
        say(f"[lora] joining {len(shards)} file(s) from {src} into one checkpoint")
        n = merge_safetensors(shards, dest)
        frm = os.path.relpath(src, out)
        say(f"[lora] {n} tensors -> {dest}")
    else:
        try:
            files = sorted(f for f in os.listdir(out) if f.endswith(".safetensors"))
        except OSError:
            files = []
        one = name + ".safetensors" if name + ".safetensors" in files else (files or [None])[-1]
        if not one:
            say("[lora] no diffusers folder or .safetensors in " + out)
            return None
        shutil.copy2(os.path.join(out, one), dest)
        frm = one
    card = {"v": 1, "user": {"title": name, "family": L.get("family") or "", "keywords": [L["trigger"]] if L.get("trigger") else [],
                             "released": date.today().isoformat(), "category": "image",
                             "description": f"Fine-tuned (every weight) in bitGen Studio's trainer (ai-toolkit) from {L.get('base', '')}: "
                                            f"{L.get('images', 0)} pictures, {L.get('steps', 0)} steps"
                                            + (f", trigger word \"{L['trigger']}\"" if L.get("trigger") else "") + ". Load it with Load Diffusion Model (diffusion_models/trained)."}}
    with open(os.path.join(dest_dir, name + ".bitgen.json"), "w", encoding="utf-8") as f:
        json.dump(card, f, indent=2)
    sd = os.path.join(out, "samples")
    try:
        samples = sorted(f for f in os.listdir(sd) if re.search(r"\.(png|jpe?g|webp)$", f, re.I))
    except OSError:
        samples = []
    if samples:
        ext = os.path.splitext(samples[-1])[1].lower().replace(".jpg", ".jpeg")
        shutil.copy2(os.path.join(sd, samples[-1]), os.path.join(dest_dir, name + ".preview" + ext))
    with open(os.path.join(L["job_dir"], "installed.json"), "w") as f:
        json.dump({"file": dest, "from": frm, "kind": "checkpoint", "when": time.strftime("%Y-%m-%d %H:%M:%S")}, f)
    say(f"[lora] the fine-tuned model is in ComfyUI's diffusion_models folder: trained/{name}.safetensors (the Model manager's models)")
    return dest


def train(L):
    py, aitk = L["python"], L["aitk_dir"]
    if not os.path.exists(py) or not os.path.exists(os.path.join(aitk, "run.py")):
        say("[lora] ai-toolkit is not installed - the trainer's ⚙ Install ai-toolkit first")
        return 1
    env = dict(os.environ)
    env["PYTHONUNBUFFERED"] = "1"
    env.setdefault("PYTORCH_CUDA_ALLOC_CONF", "expandable_segments:True")
    say(f"[lora] training {L['name']} - {L.get('images', 0)} pictures, {L.get('steps', 0)} steps on {L.get('base', '')}"
        + (" (your own YAML)" if L.get("custom_yaml") else ""))
    code = run([py, "run.py", L["config"]], cwd=aitk, env=env, progress=True)
    if code != 0:
        say(f"[lora] ai-toolkit stopped (exit {code}) - the lines above say why; checkpoints so far are in {L['output']}")
        return code
    return 0 if (finish_full(L) if L.get("full") else finish(L)) else 1


def main():
    job = json.load(open(sys.argv[1], encoding="utf-8"))
    p = job.get("params") or {}
    L = p.get("lora") or {}
    mode = p.get("mode")
    if mode == "install_aitoolkit":
        return install(L)
    if mode == "lora_train":
        return train(L)
    say("[lora] unknown mode " + str(mode))
    return 2


if __name__ == "__main__":
    sys.exit(main())
