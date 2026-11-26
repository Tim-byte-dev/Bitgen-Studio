// bitGen Studio — lib/hyworldAddon.js (2.975.0): Settings ▸ Add-ons ▸ HunyuanWorld 1.0 - the WALK-IN WORLD of 🧱 Picture → 3D
// scene (step 5b): the 360° panorama the scene made -> a layered 3D mesh world (the sky, the background, the foreground
// objects each a layer you can walk round) -> one .glb in the project's 3D models.
// Tim: "is this worth adding to sketcher docker https://github.com/neilsonnn/image-blaster" -> "yes, please do 1-5".
//
// HunyuanWorld 1.0 (Tencent; github.com/Tencent-Hunyuan/HunyuanWorld-1.0). LICENCE: the "Tencent HunyuanWorld 1.0 Community
// License" - it does NOT apply in the European Union, the United Kingdom or South Korea (no use there), and its scene
// generation fills hidden parts with FLUX.1 Fill [dev] (black-forest-labs - gated on Hugging Face, NON-COMMERCIAL licence).
// Heavy: ~45 GB of models on the first run; 24 GB of graphics memory with the low-memory switches (the authors' "lite").
//
// The install (the authors' README), into <app>/hyworld/:
//   HunyuanWorld-1.0/   the code (git clone, or GitHub zips)
//   Real-ESRGAN/        its upscaler (pip install -e, with basicsr-fixed facexlib gfpgan)
//   ZIM/                ZIM Anything (pip install -e) + zim_vit_l_2092/{encoder,decoder}.onnx (naver-iv/zim-anything-vitl),
//                       linked into HunyuanWorld-1.0/ZIM/zim_vit_l_2092 too (the demo looks there from its own folder)
//   .venv/              its own Python (3.10 - 3.12), torch for THIS card, the pip part of docker/HunyuanWorld.yaml
//                       without the torch pins, + trimesh (bitGen turns its .ply layers into one .glb)
//   the Hugging Face models (its cache): tencent/HunyuanWorld-1 (the panorama LoRAs) and black-forest-labs/FLUX.1-Fill-dev
//                       (GATED - your token + access); the rest (MoGe, Grounding DINO) downloads on its first run
//   paths(base) / status(base) / missing(base) / installHyworld(ctx) / remove() / LINKS / NOTICE / yamlPip(text)
"use strict";
const fs = require("fs");
const path = require("path");
const core = require("./core");
const X = require("./setupExec");
const SA = () => require("./speechAddons");

const REPO = "https://github.com/Tencent-Hunyuan/HunyuanWorld-1.0";
const ESRGAN = "https://github.com/xinntao/Real-ESRGAN";
const ZIM = "https://github.com/naver-ai/ZIM";
const ZIM_CKPT = { repo: "naver-iv/zim-anything-vitl", files: ["zim_vit_l_2092/encoder.onnx", "zim_vit_l_2092/decoder.onnx"] };
const HF = [
  { id: "lora", repo: "tencent/HunyuanWorld-1", what: "the HunyuanWorld 1.0 LoRAs", gated: false },
  { id: "flux", repo: "black-forest-labs/FLUX.1-Fill-dev", what: "FLUX.1 Fill [dev] (fills what the layers hid)", gated: true },
];
const TORCH = ["torch==2.10.0", "torchvision==0.25.0"];
const NOTICE = "LICENCE: the Tencent HunyuanWorld 1.0 Community License does not apply in the EU, the UK or South Korea, and "
  + "FLUX.1 Fill [dev] (which it needs) is NON-COMMERCIAL. ~45 GB of models; 24 GB of graphics memory with Low memory on.";
const LINKS = [
  { label: "FLUX.1 Fill [dev] - accept its licence on Hugging Face (gated), then set your token in Settings", url: "https://huggingface.co/black-forest-labs/FLUX.1-Fill-dev", kind: "model", dest: "downloaded by Install once you have access" },
  { label: "HunyuanWorld 1.0 (GitHub) - the code and its licence", url: REPO, kind: "pack", dest: "hyworld/HunyuanWorld-1.0" },
  { label: "HunyuanWorld 1.0 models (Hugging Face)", url: "https://huggingface.co/tencent/HunyuanWorld-1", kind: "model", dest: "the Hugging Face cache" },
];

function paths(base) {
  const b = base || process.env.BITGEN_ADDON_BASE || core.BASE;
  const dir = path.join(b, "hyworld"), src = path.join(dir, "HunyuanWorld-1.0"), venv = path.join(dir, ".venv");
  return { dir, src, venv, python: SA().venvPy(venv), script: path.join(src, "demo_scenegen.py"),
    esrgan: path.join(dir, "Real-ESRGAN"), zim: path.join(dir, "ZIM"),
    zimCkpt: path.join(dir, "ZIM", "zim_vit_l_2092", "encoder.onnx"), zimLink: path.join(src, "ZIM", "zim_vit_l_2092"),
    marker: (id) => path.join(dir, id + ".ok") };
}
const has = (p) => { try { return fs.statSync(p).size > 0; } catch { return false; } };

/** what is not there yet -> [{id, what, how}] (empty = ready) */
function missing(base) {
  const p = paths(base), out = [];
  if (!has(p.python)) out.push({ id: "venv", what: "its Python", how: "Install" });
  if (!has(p.script)) out.push({ id: "code", what: "the HunyuanWorld 1.0 code", how: "Install" });
  if (!has(p.marker("packages"))) out.push({ id: "packages", what: "its Python packages", how: "Install" });
  if (!has(p.zimCkpt)) out.push({ id: "zim", what: "ZIM Anything (the cut-out model)", how: "Install" });
  if (!has(p.marker("lora"))) out.push({ id: "lora", what: "the HunyuanWorld 1.0 LoRAs", how: "Install" });
  if (!has(p.marker("flux"))) out.push({ id: "flux", what: "FLUX.1 Fill [dev]", how: "accept its licence on huggingface.co/black-forest-labs/FLUX.1-Fill-dev, set your token in Settings, Install again" });
  return out;
}
function ready(base) { return !missing(base).length; }
function status(base) {
  const m = missing(base), p = paths(base);
  if (!m.length) return { installed: true, note: "ready - 🧱 Picture → 3D scene's 🌍 Walk-in world. " + NOTICE };
  return { installed: false, note: !fs.existsSync(p.dir) ? "not installed. " + NOTICE : "almost: " + m.map((x) => `${x.what} (${x.how})`).join("; ") };
}

/** the pip part of the authors' conda file (docker/HunyuanWorld.yaml) without torch / CUDA pins */
function yamlPip(text) {
  const lines = String(text || "").split(/\r?\n/);
  const out = []; let inPip = false, pipIndent = -1;
  for (const l of lines) {
    if (/^\s*-\s*pip\s*:\s*$/.test(l)) { inPip = true; pipIndent = l.search(/\S/); continue; }
    if (!inPip) continue;
    const ind = l.search(/\S/);
    if (ind < 0) continue;
    if (ind <= pipIndent || !/^\s*-\s+/.test(l)) { inPip = false; continue; }
    const pkg = l.replace(/^\s*-\s+/, "").replace(/\s+#.*$/, "").trim();
    if (!pkg || /^--/.test(pkg)) continue;
    if (/^(torch|torchvision|torchaudio|triton|xformers)\b/i.test(pkg) || /^nvidia-/i.test(pkg)) continue;
    out.push(pkg);
  }
  return out;
}

async function linkDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const f of fs.readdirSync(from)) {
    const a = path.join(from, f), b = path.join(to, f);
    if (has(b)) continue;
    try { fs.linkSync(a, b); } catch { fs.copyFileSync(a, b); }
  }
}

/** ctx = {log, run, python, gpu, env, base, git, fetchRepo, hfToken} -> {ok, error, missing} */
async function installHyworld(ctx) {
  const log = ctx.log || (() => {}), run = ctx.run || X.run, p = paths(ctx.base);
  const env = Object.assign({}, SA().envOf(ctx), ctx.hfToken ? { HF_TOKEN: ctx.hfToken } : {});
  log("[!!] " + NOTICE, false);
  const pv = await SA().pythonOk(ctx, "HunyuanWorld 1.0"); if (pv.error) return { ok: false, error: pv.error };
  if (+pv.ver.split(".")[1] > 12 || +pv.ver.split(".")[1] < 10) return { ok: false, error: `HunyuanWorld 1.0 needs Python 3.10 - 3.12; ${ctx.python} is ${pv.ver}` };
  const git = ctx.git === undefined ? X.which("git", require("./setupRun").runtimeDirs()) : ctx.git;
  const fetchRepo = ctx.fetchRepo || require("./setupPacks").fetchRepo;
  fs.mkdirSync(p.dir, { recursive: true });
  // 1 the code: HunyuanWorld-1.0, Real-ESRGAN, ZIM
  for (const [url, dest, check, what] of [[REPO, p.src, p.script, "HunyuanWorld 1.0"], [ESRGAN, p.esrgan, path.join(p.esrgan, "setup.py"), "Real-ESRGAN"], [ZIM, p.zim, path.join(p.zim, "setup.py"), "ZIM Anything"]]) {
    if (has(check)) { log(`[ok] ${what}: ${dest}`, false); continue; }
    log(`[..] ${what} (${url})`, false);
    const fr = await fetchRepo(url + ".git", dest, { log, git, env });
    if (!fr.ok || !has(check)) return { ok: false, error: `could not fetch ${what}: ` + (fr.error || path.basename(check) + " is not in it") };
  }
  // 2 its Python
  const v = await SA().makeVenv(ctx, p.venv); if (v.error) return { ok: false, error: v.error };
  if (!has(p.marker("packages"))) {
    const t = await SA().installTorch(Object.assign({}, ctx, { env }), v.python, TORCH); if (t.error) return { ok: false, error: t.error };
    let req = [];
    try { req = yamlPip(fs.readFileSync(path.join(p.src, "docker", "HunyuanWorld.yaml"), "utf8")); } catch { req = []; }
    if (!req.length) log("[warn] docker/HunyuanWorld.yaml has no pip list here - installing the known core packages", true);
    req = req.concat(["diffusers", "transformers", "accelerate", "peft", "open3d", "opencv-python", "trimesh", "huggingface_hub", "onnxruntime-gpu", "basicsr-fixed", "facexlib", "gfpgan"]);
    const rf = path.join(p.dir, "requirements-bitgen.txt");
    fs.writeFileSync(rf, [...new Set(req)].join("\n") + "\n");
    log(`[..] its Python packages (${new Set(req).size})`, false);
    if (await run(v.python, ["-m", "pip", "install", "-r", rf, "--progress-bar", "off"], { log, env, timeout: 90 * 60000 }) !== 0)
      return { ok: false, error: "pip could not install HunyuanWorld's packages - see the log above" };
    for (const [d, what] of [[p.esrgan, "Real-ESRGAN"], [p.zim, "ZIM Anything"]]) {
      try { const rq = path.join(d, "requirements.txt"); if (fs.existsSync(rq) && await run(v.python, ["-m", "pip", "install", "-r", rq, "--progress-bar", "off"], { log, env, timeout: 30 * 60000 }) !== 0) log(`[warn] some of ${what}'s requirements did not install`, true); } catch { /* none */ }
      if (await run(v.python, ["-m", "pip", "install", "--no-build-isolation", "-e", d, "--progress-bar", "off"], { log, env, timeout: 30 * 60000 }) !== 0)
        return { ok: false, error: `pip could not install ${what} - see the log above` };
    }
    fs.writeFileSync(p.marker("packages"), new Date().toISOString());
  } else log("[ok] its Python packages", false);
  // 3 the models
  const py = (s) => JSON.stringify(String(s));
  if (!has(p.zimCkpt)) {
    const g = await SA().hfGet(Object.assign({}, ctx, { env }), v.python, `from huggingface_hub import hf_hub_download\nfor f in ${JSON.stringify(ZIM_CKPT.files)}:\n    print(hf_hub_download(${py(ZIM_CKPT.repo)}, f, local_dir=${py(p.zim)}))`, "ZIM Anything ViT-L (" + ZIM_CKPT.repo + ")");
    if (g.error) return { ok: false, error: g.error };
  } else log("[ok] ZIM Anything ViT-L", false);
  try { await linkDir(path.dirname(p.zimCkpt), p.zimLink); } catch (e) { log("[warn] could not link the ZIM model into the demo's folder: " + e.message, true); }
  const refused = [];
  for (const h of HF) {
    if (has(p.marker(h.id))) { log(`[ok] ${h.what}`, false); continue; }
    const g = await SA().hfGet(Object.assign({}, ctx, { env }), v.python, `from huggingface_hub import snapshot_download\nprint(snapshot_download(${py(h.repo)}))`, `${h.what} (${h.repo}${h.gated ? ", gated" : ""})`);
    if (g.error) { refused.push(h); continue; }
    fs.writeFileSync(p.marker(h.id), new Date().toISOString());
  }
  const left = missing(ctx.base);
  if (refused.length) log(`[warn] Hugging Face refused ${refused.map((h) => h.repo).join(" and ")} - accept the licence on ${refused.map((h) => "huggingface.co/" + h.repo).join(" / ")}, set your token in Settings ▸ Hugging Face, then Install again`, true);
  if (left.length) return { ok: false, missing: left, error: "almost ready - still needed: " + left.map((m) => m.what).join(", ") + " (see the log), then Install again" };
  log(`[ok] HunyuanWorld 1.0 installed: ${p.dir}. 🧱 Picture → 3D scene's 🌍 Walk-in world can use it.`, false);
  log("[!!] " + NOTICE, false);
  return { ok: true };
}

function remove() {
  return async (log) => {
    const d = paths().dir;
    log(`[..] removing ${d} (the Hugging Face cache keeps FLUX.1 Fill - Settings ▸ Models can clear it)`, false);
    const ok = require("./setupPacks").safeRm(d, log);
    return ok ? { ok: true } : { ok: false, error: `could not remove ${d} - close anything using it and try again` };
  };
}

/** one walk-in world job: the panorama + the objects to lift out as their own layer -> {params} | {error, missing} */
function jobParams(pano, o) {
  const x = o || {};
  if (!pano || !fs.existsSync(pano)) return { error: "no panorama to build the world from" };
  const miss = missing();
  if (miss.length) return { error: "HunyuanWorld 1.0 is not ready - Settings ▸ Add-ons ▸ HunyuanWorld 1.0: " + miss.map((m) => m.what).join(", ") + " missing", missing: miss };
  const clean = (L) => (Array.isArray(L) ? L : []).map((s) => String(s).replace(/[^A-Za-z0-9 _-]+/g, " ").trim()).filter(Boolean).slice(0, 6);
  const label = x.label || "🌍 Walk-in world: " + path.basename(pano);
  return { params: { mode: "hyworld", source: pano, name: String(x.name || "world").replace(/[^A-Za-z0-9_-]+/g, "_").slice(0, 60), classes: x.indoor ? "indoor" : "outdoor",
    labels_fg1: clean(x.fg1), labels_fg2: clean(x.fg2), low_memory: x.low_memory !== false, seed: Number.isFinite(+x.seed) ? +x.seed : 42,
    models_dir: x.models_dir || require("./m3d").dir(), hyworld: paths(), prompt: label, label, no_assets: true } };
}

module.exports = { REPO, ESRGAN, ZIM, ZIM_CKPT, HF, TORCH, NOTICE, LINKS, paths, missing, ready, status, yamlPip, installHyworld, remove, jobParams };
