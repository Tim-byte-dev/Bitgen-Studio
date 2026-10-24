#!/usr/bin/env python3
"""bitGen Studio - finetune_worker.py (2.521.0): the trainer's FINE-TUNE queue jobs (lib/fineTune.js).

Tim (verbatim): "can we add a checkpoint finetune option to the lora creator docker to build on existing llm, vision and
image models?"

    mode install_unsloth   venvs/unsloth (uv + `uv pip install unsloth --torch-backend=auto`, torchao first on Windows),
                           + llama.cpp's source in <app>/tools/llama.cpp (convert_hf_to_gguf.py - the GGUF converter)
    mode ft_llm / ft_vision  scripts/ft_unsloth.py <config.json> in the Unsloth venv -> output/merged (16-bit), then
                           convert_hf_to_gguf.py -> F16 (+ --mmproj for a vision model's projector) -> the app's
                           llama-quantize -> <name>-Q4_K_M.gguf (or the size picked) into the LLM folder / the vision folder
    mode lora_merge        ⧉ bake a LoRA into its base model with ComfyUI (CheckpointLoaderSimple / UNETLoader ->
                           LoraLoader -> CheckpointSave / ModelSave), the file moved into checkpoints|diffusion_models/trained

    python finetune_worker.py job.json
"""
import glob
import json
import os
import shutil
import subprocess
import sys
import time
import urllib.error
import urllib.request
import uuid
import zipfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lora_worker import run, say, venv_python  # noqa: E402  (one streaming runner for both trainers)

IS_WIN = os.name == "nt"


def install(F):
    venv = F["venv"]
    py = venv_python(venv)
    if not os.path.exists(py):
        if run([sys.executable, "-m", "venv", venv]) != 0:
            say("[ft] could not make the venv")
            return 1
    run([py, "-m", "pip", "install", "--upgrade", "pip", "uv"])
    uv = [py, "-m", "uv", "pip", "install", "--python", py]
    if IS_WIN:
        run(uv + ["torchao"])                                  # Unsloth's Windows steps: torchao first
    code = run(uv + ["unsloth", "--torch-backend=auto"])
    if code != 0:
        say("[ft] uv could not install Unsloth - trying pip")
        code = run([py, "-m", "pip", "install", "unsloth"])
        if code != 0:
            say("[ft] Unsloth did not install - the lines above say why")
            return 1
    run(uv + ["sentencepiece", "protobuf"])                    # the GGUF converter's tokenizer needs
    if run([py, "-c", "import unsloth, trl, transformers; print('[ft] unsloth', unsloth.__version__, '- trl', trl.__version__, '- transformers', transformers.__version__)"]) != 0:
        say("[ft] Unsloth installed but does not import - the lines above say why")
        return 1
    src = F["llama_src"]
    if not os.path.exists(os.path.join(src, "convert_hf_to_gguf.py")):
        os.makedirs(os.path.dirname(src), exist_ok=True)
        git = shutil.which("git")
        if git:
            run([git, "clone", "--depth", "1", "https://github.com/ggml-org/llama.cpp.git", src])
        if not os.path.exists(os.path.join(src, "convert_hf_to_gguf.py")):
            say("[ft] downloading llama.cpp's source (the GGUF converter)")
            tmp = src + ".zip"
            urllib.request.urlretrieve("https://github.com/ggml-org/llama.cpp/archive/refs/heads/master.zip", tmp)
            with zipfile.ZipFile(tmp) as z:
                z.extractall(os.path.dirname(src))
            os.remove(tmp)
            got = os.path.join(os.path.dirname(src), "llama.cpp-master")
            if os.path.isdir(got) and not os.path.exists(src):
                os.rename(got, src)
    if not os.path.exists(os.path.join(src, "convert_hf_to_gguf.py")):
        say("[ft] llama.cpp's converter is missing - fine-tunes train, but the .gguf step will fail")
    with open(os.path.join(venv, ".bitgen-installed"), "w") as f:
        f.write(json.dumps({"when": time.strftime("%Y-%m-%d %H:%M:%S")}))
    say("[ft] Unsloth is ready - LLM and vision fine-tunes can start")
    return 0


def to_gguf(F):
    """output/merged -> the .gguf (+ the vision projector) in the LLM / vision folder"""
    merged = os.path.join(F["output"], "merged")
    conv = os.path.join(F["llama_src"], "convert_hf_to_gguf.py")
    if not os.path.exists(conv):
        say("[ft] llama.cpp's convert_hf_to_gguf.py is missing - ⚙ Install Unsloth again (the merged model is in " + merged + ")")
        return None
    names, q = F["files"], F["quant"].lower()
    gdir = os.path.join(F["output"], "gguf")
    os.makedirs(gdir, exist_ok=True)
    py = F["python"]
    first = os.path.join(gdir, names["out"] if q == "q8_0" else names["f16"])
    if run([py, conv, merged, "--outfile", first, "--outtype", "q8_0" if q == "q8_0" else "f16"]) != 0 or not os.path.exists(first):
        say("[ft] the GGUF conversion failed - an architecture newer than the llama.cpp source? ⚙ Install Unsloth again updates it")
        return None
    final = first
    if q not in ("f16", "q8_0"):
        qbin = F.get("quantize") or ""
        target = os.path.join(gdir, names["out"])
        if qbin and os.path.exists(qbin) and run([qbin, first, target, names["quant"]]) == 0 and os.path.exists(target):
            final = target
            try:
                os.remove(first)                                  # the F16 is big; the quantized one is the model
            except OSError:
                pass
        else:
            say("[ft] no llama-quantize next to llama-server (Settings -> LLM) - keeping the F16 file")
    mm = None
    if F["kind"] == "vision":
        mmp = os.path.join(gdir, names["mmproj"])
        run([py, conv, merged, "--mmproj", "--outfile", mmp, "--outtype", "f16"])
        got = sorted(glob.glob(os.path.join(gdir, "mmproj*.gguf")), key=os.path.getmtime)
        mm = got[-1] if got else None
        if not mm:
            say("[ft] the vision projector (mmproj) was not made - the model reads text only until it is")
    dest = F["dest_dir"]
    os.makedirs(dest, exist_ok=True)
    out = os.path.join(dest, os.path.basename(final))
    shutil.move(final, out)
    mm_out = None
    if mm:
        mm_out = os.path.join(dest, os.path.basename(mm))
        shutil.move(mm, mm_out)
    with open(os.path.join(F["job_dir"], "installed.json"), "w") as f:
        json.dump({"file": out, "mmproj": mm_out, "kind": F["kind"], "quant": names["quant"], "when": time.strftime("%Y-%m-%d %H:%M:%S")}, f)
    where = "Settings -> LLM picks it (the assistant)" if F["kind"] == "llm" else "Settings -> LLM -> Vision model picks it (the captioner)"
    say(f"[ft] the fine-tuned model is {out}" + (f" + {os.path.basename(mm_out)}" if mm_out else "") + f" - {where}")
    return out


def fine_tune(F):
    py = F["python"]
    if not os.path.exists(py):
        say("[ft] Unsloth is not installed - the trainer's ⚙ Install Unsloth first")
        return 1
    env = dict(os.environ)
    env["PYTHONUNBUFFERED"] = "1"
    env.setdefault("PYTORCH_CUDA_ALLOC_CONF", "expandable_segments:True")
    env.setdefault("UNSLOTH_DISABLE_STATISTICS", "1")
    say(f"[ft] {F['kind']} fine-tune {F['name']} - {F.get('examples', 0)} examples on {F.get('base', '')} ({F.get('method', '')})")
    code = run([py, F["script"], F["config"]], cwd=F["job_dir"], env=env)
    if code != 0:
        say(f"[ft] the fine-tune stopped (exit {code}) - the lines above say why")
        return code
    return 0 if to_gguf(F) else 1


def http_json(url, payload=None, timeout=30):
    data = json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"} if data else {})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return json.loads(r.read().decode() or "{}")
    except urllib.error.HTTPError as e:
        try:
            return json.loads(e.read().decode() or "{}")
        except Exception:                                         # noqa: BLE001
            return {"error": f"HTTP {e.code}"}


def bake(F):
    base = F["comfy_url"].rstrip("/")
    try:
        http_json(base + "/system_stats", timeout=8)
    except Exception as e:                                        # noqa: BLE001
        say(f"[bake] ComfyUI does not answer at {base} ({e}) - start it first")
        return 1
    t0 = time.time()
    res = http_json(base + "/prompt", {"prompt": F["graph"], "client_id": uuid.uuid4().hex}, timeout=60)
    pid = res.get("prompt_id")
    if not pid:
        say("[bake] ComfyUI refused the merge: " + json.dumps(res.get("node_errors") or res.get("error") or res)[:800])
        return 1
    say(f"[bake] {F['lora']} into {F['base']} at strength {F['strength']} (ComfyUI job {pid})")
    last = 0
    while True:
        h = (http_json(f"{base}/history/{pid}", timeout=15) or {}).get(pid)
        if h:
            st = h.get("status") or {}
            if st.get("status_str") == "error":
                say("[bake] ComfyUI could not merge: " + json.dumps((st.get("messages") or [])[-3:])[:800])
                return 1
            if st.get("completed") or st.get("status_str") == "success":
                break
        if time.time() - t0 > 7200:
            say("[bake] gave up after 2 hours")
            return 1
        if time.time() - last >= 10:
            last = time.time()
            say(f"[bake] merging and saving... {int(time.time() - t0)} s")
        time.sleep(1)
    stem = os.path.basename(F["prefix"])
    found = []
    for o in F.get("comfy_outputs") or []:
        found += [p for p in glob.glob(os.path.join(o, os.path.dirname(F["prefix"]), stem + "*.safetensors")) if os.path.getmtime(p) >= t0 - 5]
    if not found:
        say("[bake] ComfyUI finished but the saved file was not found in " + ", ".join(F.get("comfy_outputs") or []))
        return 1
    src = max(found, key=os.path.getmtime)
    os.makedirs(F["dest_dir"], exist_ok=True)
    dest = os.path.join(F["dest_dir"], F["out"] + ".safetensors")
    i = 2
    while os.path.exists(dest):
        dest = os.path.join(F["dest_dir"], f"{F['out']}_{i}.safetensors")
        i += 1
    shutil.move(src, dest)
    stem_dest = os.path.splitext(dest)[0]
    card = {"v": 1, "user": {"title": os.path.basename(stem_dest), "family": F.get("family") or "", "keywords": [F["trigger"]] if F.get("trigger") else [],
                             "released": time.strftime("%Y-%m-%d"), "category": "image",
                             "description": f"LoRA {F['name']} baked into {os.path.basename(F['base'])} at strength {F['strength']} by bitGen Studio's trainer."}}
    with open(stem_dest + ".bitgen.json", "w", encoding="utf-8") as f:
        json.dump(card, f, indent=2)
    lstem = os.path.splitext(F.get("lora_file") or "")[0]
    for ext in (".png", ".jpeg", ".jpg", ".webp"):
        if lstem and os.path.exists(lstem + ".preview" + ext):
            shutil.copy2(lstem + ".preview" + ext, stem_dest + ".preview" + ext)
            break
    log = os.path.join(F["job_dir"], "baked.json")
    try:
        prev = json.load(open(log))
    except Exception:                                             # noqa: BLE001
        prev = []
    prev.append({"file": dest, "base": F["base"], "strength": F["strength"], "when": time.strftime("%Y-%m-%d %H:%M:%S")})
    with open(log, "w") as f:
        json.dump(prev, f, indent=2)
    say(f"[bake] the new {'checkpoint' if F['cat'] == 'checkpoints' else 'model'} is in ComfyUI's {F['cat']} folder: trained/{os.path.basename(dest)}")
    return 0


def main():
    job = json.load(open(sys.argv[1], encoding="utf-8"))
    p = job.get("params") or {}
    F = p.get("ft") or {}
    mode = p.get("mode")
    if mode == "install_unsloth":
        return install(F)
    if mode in ("ft_llm", "ft_vision"):
        return fine_tune(F)
    if mode == "lora_merge":
        return bake(F)
    say("[ft] unknown mode " + str(mode))
    return 2


if __name__ == "__main__":
    sys.exit(main())
