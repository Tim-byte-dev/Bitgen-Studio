#!/usr/bin/env python3
"""bitGen Studio — 2.729.0: NITROFUSION2 (Z-Image-Turbo in 1-2 steps) as three image styles.
Tim (verbatim): "can u add this please https://chendaryen.github.io/NitroFusion2.github.io/"
  1. the workflows = the authors' (github.com/ChenDarYen/NitroFusion2 workflows/*.json) flattened: nf2-bf16 + qwen_3_4b
     (lumina2) + ae, shift 3 / 6, euler simple, cfg 1, a zeroed negative, 1024 x 1024; the 2-step = their de-distillation
     LoRA at 0.5 on step 0->1, NitroFusion2 alone on 1->2 (one 2-step schedule); GGUF = UnetLoaderGGUF nf2-Q4_K_M;
  2. through the patcher (scripts/comfy_image.py): the prompt on the positive (the zeroed negative stays zeroed), the size,
     ONE seed on both samplers, steps 2 on both, a style LoRA in a slot - never in the "(fixed)" de-distillation node;
  3. the app side (node): the three starters, the catalog's files + group, Settings ▸ Add-ons ▸ NitroFusion2 (its
     picks, ComfyUI-GGUF only for a GGUF file, the shared encoder + VAE kept on Remove), the model cards (nf2-* = Z-Image,
     the style it makes);
  4. LIVE: misc/image_worker.py renders each style against the stub ComfyUI - a PNG back, the graph ComfyUI got as above.
Run from repo root: python3 scripts/test-nf2729.py"""
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
import comfy_image as C  # noqa: E402

FAILED = []


def check(name, cond, extra=""):
    print(("PASS: " if cond else "FAIL: ") + name + ("" if cond else f" {str(extra)[:700]}"))
    if not cond:
        FAILED.append(name)


def wf(name):
    g = json.loads((ROOT / "comfy_workflows" / name).read_text(encoding="utf-8"))
    return {k: v for k, v in g.items() if not k.startswith("_")}


def of(g, ct):
    return [k for k, v in g.items() if v.get("class_type") == ct]


one, two, gg = wf("img_nf2_t2i.json"), wf("img_nf2_2step_t2i.json"), wf("img_nf2_gguf_t2i.json")
for nm, g in (("1 step", one), ("2 steps", two), ("GGUF", gg)):
    cl = g[of(g, "CLIPLoader")[0]]["inputs"]
    check(f"{nm}: Qwen3 4B as lumina2, ae.safetensors, EmptySD3LatentImage 1024 x 1024, a zeroed negative, 4 empty LoRA slots",
          cl["clip_name"] == "qwen_3_4b.safetensors" and cl["type"] == "lumina2" and g[of(g, "VAELoader")[0]]["inputs"]["vae_name"] == "ae.safetensors"
          and g[of(g, "EmptySD3LatentImage")[0]]["inputs"] == {"width": 1024, "height": 1024, "batch_size": 1}
          and len(of(g, "ConditioningZeroOut")) == 1 and sum(1 for k in of(g, "LoraLoaderModelOnly") if g[k]["inputs"]["lora_name"] == "") == 4)
k1 = one[of(one, "KSampler")[0]]["inputs"]
check("1 step: nf2-bf16 (UNETLoader), shift 3, KSampler 1 step cfg 1 euler simple - the authors' nitrofusion2_1step.json",
      one[of(one, "UNETLoader")[0]]["inputs"]["unet_name"] == "nf2-bf16.safetensors" and one[of(one, "ModelSamplingAuraFlow")[0]]["inputs"]["shift"] == 3.0
      and (k1["steps"], k1["cfg"], k1["sampler_name"], k1["scheduler"]) == (1, 1.0, "euler", "simple"))
ka = sorted(of(two, "KSamplerAdvanced"), key=lambda k: two[k]["inputs"]["start_at_step"])
a, b = two[ka[0]]["inputs"], two[ka[1]]["inputs"]
lo = two[a["model"][0]]["inputs"]["model"]
check("2 steps: step 0->1 on (de-distillation LoRA 0.5 -> shift 6) with noise, step 1->2 on (shift 6) alone, the leftover noise handed on",
      (a["start_at_step"], a["end_at_step"], a["add_noise"], a["return_with_leftover_noise"]) == (0, 1, "enable", "enable")
      and (b["start_at_step"], b["end_at_step"], b["add_noise"], b["return_with_leftover_noise"]) == (1, 2, "disable", "disable")
      and b["latent_image"] == [ka[0], 0] and a["steps"] == b["steps"] == 2
      and two[lo[0]]["inputs"]["lora_name"] == "nf2-dedistill-lora.safetensors" and two[lo[0]]["inputs"]["strength_model"] == 0.5
      and "(fixed)" in two[lo[0]]["_meta"]["title"] and all(two[x]["inputs"]["shift"] == 6.0 for x in of(two, "ModelSamplingAuraFlow"))
      and two[b["model"][0]]["inputs"]["model"] == two[lo[0]]["inputs"]["model"], two)
check("GGUF: UnetLoaderGGUF nf2-Q4_K_M.gguf, ComfyUI's CLIPLoader for the encoder, 1 step shift 3",
      gg[of(gg, "UnetLoaderGGUF")[0]]["inputs"]["unet_name"] == "nf2-Q4_K_M.gguf" and not of(gg, "UNETLoader") and not of(gg, "CLIPLoaderGGUF")
      and gg[of(gg, "KSampler")[0]]["inputs"]["steps"] == 1)

ST1 = {"kind": "image", "steps": 1, "cfg": 1, "width": 1024, "height": 1024, "negative": "", "loras": []}
o = C.patch(one, ST1, {"prompt": "a neon sign that says bitGen", "width": 1344, "height": 768, "seed": 11})[0]
pos = o[o[of(o, "KSampler")[0]]["inputs"]["positive"][0]]["inputs"]
check("patch 1 step: the prompt on the positive, the negative still zeroed, 1344 x 768, seed 11, 1 step",
      pos["text"] == "a neon sign that says bitGen" and o[of(o, "KSampler")[0]]["inputs"]["negative"][0] in of(o, "ConditioningZeroOut")
      and o[of(o, "EmptySD3LatentImage")[0]]["inputs"]["width"] == 1344 and o[of(o, "EmptySD3LatentImage")[0]]["inputs"]["height"] == 768
      and o[of(o, "KSampler")[0]]["inputs"]["seed"] == 11 and o[of(o, "KSampler")[0]]["inputs"]["steps"] == 1, o)
ST2 = dict(ST1, steps=2, loras=[{"path": "loras/zimage_style.safetensors", "weight": 0.7}])
o2 = C.patch(two, ST2, {"prompt": "x", "seed": 9})[0]
ks = of(o2, "KSamplerAdvanced")
fixed = [k for k in of(o2, "LoraLoaderModelOnly") if "(fixed)" in str((o2[k].get("_meta") or {}).get("title"))]
check("patch 2 steps: one seed on both samplers, steps 2 on both, the style LoRA in a slot, the de-distillation LoRA untouched",
      all(o2[k]["inputs"]["noise_seed"] == 9 and o2[k]["inputs"]["steps"] == 2 for k in ks) and len(fixed) == 1
      and o2[fixed[0]]["inputs"]["lora_name"] == "nf2-dedistill-lora.safetensors" and o2[fixed[0]]["inputs"]["strength_model"] == 0.5
      and any(str(o2[k]["inputs"].get("lora_name")).endswith("zimage_style.safetensors") and o2[k]["inputs"]["strength_model"] == 0.7
              and "(fixed)" not in str((o2[k].get("_meta") or {}).get("title")) for k in of(o2, "LoraLoaderModelOnly")), o2)
check("patch: the empty slots bypassed (no empty lora_name reaches ComfyUI)", all(v["inputs"].get("lora_name") for k, v in o2.items()
      if v.get("class_type") == "LoraLoaderModelOnly"), [o2[k]["inputs"] for k in of(o2, "LoraLoaderModelOnly")])

js = r"""
const S = require('./lib/styles'), M = require('./lib/setupModels'), A = require('./lib/nf2Addon'), MC = require('./lib/modelCards');
const st = S.STARTER_STYLES.filter((x) => /NitroFusion2/.test(x.name)).map((x) => ({ n: x.name, a: x.arch, s: x.steps, c: x.cfg, w: x.workflow, neg: x.negative }));
const cat = ['nf2_bf16', 'nf2_dedistill', 'nf2_q4', 'nf2_q8', 'nf2_te', 'flux_ae'].map((id) => { const m = M.byId(id) || {}; return [id, m.repo, m.dest, m.as || m.file]; });
const groups = require('./lib/modelCatalog.json').groups.map((g) => g.id);
(async () => {
  const log = []; const got = []; let packs = 0;
  const pl = { ok: true, models: '/tmp/nf2models', customNodes: '/tmp/nf2nodes', python: 'py' };
  const r1 = await A.install((l) => log.push(l), undefined, { place: pl, download: async (m) => { got.push(m.id); return { ok: true }; }, styles: () => [], packStatus: () => [{ id: 'gguf', present: false, folder: 'ComfyUI-GGUF', url: 'u' }], packInstall: async () => { packs++; return { ok: true }; } });
  const got1 = got.splice(0), p1 = packs;
  const r2 = await A.install((l) => log.push(l), ['q8'], { place: pl, download: async (m) => { got.push(m.id); return { ok: true }; }, styles: () => [], packStatus: () => [{ id: 'gguf', present: false, folder: 'ComfyUI-GGUF', url: 'u' }], packInstall: async () => { packs++; return { ok: true }; } });
  const r3 = await A.install(() => {}, ['te'], { place: pl, download: async () => ({ ok: true }) });
  console.log(JSON.stringify({ st, cat, groups, got1, p1, r1, r2, got2: got, p2: packs, r3, addon: require('./lib/addons').LIST.some((x) => x.id === 'nf2'),
    fam: [MC.nameFamily('nf2-bf16.safetensors'), MC.nameFamily('unet/nf2-Q8_0.gguf'), MC.baseFamily('NitroFusion2')], tpl: MC.FAMILIES['z-image'] }));
})();
"""
r = subprocess.run(["node", "-e", js], cwd=str(ROOT), capture_output=True, text=True, timeout=60)
try:
    J = json.loads(r.stdout.strip().splitlines()[-1])
except Exception:  # noqa: BLE001
    J = {}
    print(r.stderr[-1500:])
st = {x["n"]: x for x in J.get("st", [])}
check("starters: NitroFusion2 (1 step), NitroFusion2 2-step (2), NitroFusion2 GGUF (1) - arch z-image, cfg 1, no negative, their workflows",
      set(st) == {"NitroFusion2", "NitroFusion2 2-step", "NitroFusion2 GGUF"} and st["NitroFusion2"]["s"] == 1 and st["NitroFusion2 2-step"]["s"] == 2
      and st["NitroFusion2 GGUF"]["w"] == "comfy_workflows/img_nf2_gguf_t2i.json" and all(x["a"] == "z-image" and x["c"] == 1 and x["neg"] == "" for x in st.values()), st)
cat = {c[0]: c for c in J.get("cat", [])}
check("catalog: nf2-bf16 -> diffusion_models, the LoRA -> loras, the GGUFs -> unet (ChenDY/NitroFusion2), qwen_3_4b -> text_encoders (Comfy-Org/z_image_turbo), ae shared; group nf2",
      cat.get("nf2_bf16", [0, 0, 0])[1:] == ["ChenDY/NitroFusion2", "comfy/diffusion_models", "nf2-bf16.safetensors"]
      and cat["nf2_dedistill"][2] == "comfy/loras" and cat["nf2_q4"][2] == cat["nf2_q8"][2] == "comfy/unet"
      and cat["nf2_te"][1:] == ["Comfy-Org/z_image_turbo", "comfy/text_encoders", "qwen_3_4b.safetensors"] and cat["flux_ae"][3].endswith("/ae.safetensors")
      and "nf2" in J.get("groups", []), cat)
check("add-on install, default picks: bf16 + the LoRA + the encoder + the VAE, no ComfyUI-GGUF", J.get("r1", {}).get("ok")
      and J.get("got1") == ["nf2_bf16", "nf2_dedistill", "nf2_te", "flux_ae"] and J.get("p1") == 0, J)
check("add-on install, Q8 ticked: ComfyUI-GGUF installed, Q8 + the encoder + the VAE", J.get("r2", {}).get("ok")
      and J.get("got2") == ["nf2_q8", "nf2_te", "flux_ae"] and J.get("p2") == 1, J)
check("add-on: nothing but the encoder ticked = refused in words; Settings ▸ Add-ons lists NitroFusion2",
      J.get("r3", {}).get("ok") is False and "tick at least one" in J["r3"].get("error", "") and J.get("addon") is True, J.get("r3"))
check("model cards: nf2-* and 'NitroFusion2' = the Z-Image family, whose style is NitroFusion2 (GGUF: NitroFusion2 GGUF)",
      J.get("fam") == ["z-image", "z-image", "z-image"] and J.get("tpl", {}).get("template") == ["NitroFusion2"]
      and J["tpl"].get("gguf") == ["NitroFusion2 GGUF"], J.get("fam"))

# 4 LIVE through misc/image_worker.py
T = Path(tempfile.mkdtemp(prefix="nf2_"))
models = T / "models"
for sub, f in (("diffusion_models", "nf2-bf16.safetensors"), ("unet", "nf2-Q4_K_M.gguf"), ("loras", "nf2-dedistill-lora.safetensors"),
               ("loras", "zimage_style.safetensors"), ("text_encoders", "qwen_3_4b.safetensors"), ("vae", "ae.safetensors")):
    (models / sub).mkdir(parents=True, exist_ok=True)
    (models / sub / f).write_bytes(b"x")
s = socket.socket(); s.bind(("127.0.0.1", 0)); port = s.getsockname()[1]; s.close()
out = T / "stubout"
stub = subprocess.Popen([sys.executable, str(ROOT / "scripts" / "stub-comfy.py"), str(port), str(out)],
                        env=dict(os.environ, STUB_MODELS_ROOT=str(models)), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
for _ in range(60):
    try:
        socket.create_connection(("127.0.0.1", port), 0.2).close()
        break
    except OSError:
        time.sleep(0.1)
try:
    for name, wfile, steps, loras in (("NitroFusion2", "img_nf2_t2i.json", 1, []), ("NitroFusion2 2-step", "img_nf2_2step_t2i.json", 2,
                                       [{"path": "zimage_style.safetensors", "weight": 0.7}]), ("NitroFusion2 GGUF", "img_nf2_gguf_t2i.json", 1, [])):
        jd = T / name.replace(" ", "_")
        jd.mkdir()
        style = {"name": name, "kind": "image", "arch": "z-image", "engine": "comfy", "workflow": "comfy_workflows/" + wfile,
                 "steps": steps, "cfg": 1, "width": 1024, "height": 1024, "negative": "", "loras": loras}
        job = {"params": {"mode": "image", "prompt": "a lighthouse at dusk, the sign says OPEN", "width": 1024, "height": 1024, "seed": 42,
                          "batch": 1, "style": style},
               "config": {"engine": {"backend": "comfy", "comfy": {"url": f"http://127.0.0.1:{port}"}}, "sd_cli": ""},
               "output_dir": str(jd / "out"), "app_dir": str(ROOT)}
        (jd / "job.json").write_text(json.dumps(job))
        r = subprocess.run([sys.executable, "-u", str(ROOT / "misc" / "image_worker.py"), str(jd / "job.json")], cwd=str(jd),
                           capture_output=True, text=True, timeout=180)
        pngs = sorted((jd / "out").glob("*.png")) if (jd / "out").exists() else []
        recs = sorted(out.glob("prompt_*.json"), key=lambda p: p.stat().st_mtime)
        rec = json.loads(recs[-1].read_text()) if recs else {}
        want_model = "nf2-Q4_K_M.gguf" if "GGUF" in name else "nf2-bf16.safetensors"
        want_loras = ["nf2-dedistill-lora.safetensors", "zimage_style.safetensors"] if "2-step" in name else []
        check(f"LIVE {name}: image_worker renders it through ComfyUI - a picture back; ComfyUI got the prompt on the positive, "
              f"{want_model}" + (", the de-distillation LoRA + the style's" if want_loras else ""),
              r.returncode == 0 and len(pngs) == 1 and "a lighthouse at dusk, the sign says OPEN" in [v for k, v in rec.items() if not k.startswith("_")]
              and rec.get("_models") == [want_model] and sorted(rec.get("_loras", [])) == want_loras
              and ("KSamplerAdvanced" in rec.get("_classes", [])) == ("2-step" in name),
              (r.returncode, rec, r.stdout[-1200:], r.stderr[-400:]))
finally:
    stub.kill(); stub.wait()

print(f"\nRESULT: {len(FAILED)} failed")
sys.exit(1 if FAILED else 0)
