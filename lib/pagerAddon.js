// bitGen Studio — lib/pagerAddon.js (2.994.0): Settings ▸ Add-ons ▸ ⛰ Panorama depth (PaGeR) - the shape of a 360° panorama:
// depth in metres, surface normals and the sky, from ONE equirectangular picture (ETH Zurich / Google / Meta / Athlence,
// NeurIPS 2026; github.com/prs-eth/PaGeR). Tim: "is this worth adding? https://pager360.github.io/" -> "yes do it please,
// first time dl, add disclaimer that these models are for non-commercial use only".
//
// LICENCES: the code is Apache-2.0; the WEIGHTS (prs-eth/PaGeR on Hugging Face) are CC BY-NC 4.0 - NON-COMMERCIAL USE ONLY
// (inherited from its Depth Anything 3 ViT-Giant backbone). NOTICE says so wherever it is offered (the add-on, the download
// box, the panorama view's message, USAGE, FEATURES, misc/NOTICE.md).
//
// The install, into <app>/pager/:
//   PaGeR/     the code (git clone, or GitHub zips) - its own src/ holds the Depth Anything 3 backbone code
//   .venv/     Python 3.10 - 3.12 (its pyproject says <3.13): the app's Python when it fits, else uv makes a 3.11 one;
//              torch 2.8.0 + torchvision 0.23.0 for THIS card (cu128 runs RTX 50), its requirements.txt (minus torch /
//              torchvision), then `pip install -e . --no-deps`
//   weights:   prs-eth/PaGeR config.yaml + model.safetensors (Hugging Face cache) + open_clip's ViT-B-32 "openai" (its
//              indoor / outdoor scale head pick) - fetched at install, so the first run needs nothing more
// Each run is a job (misc/pager_worker.py, mode "panodepth"; the model runs in the venv: misc/pager_run.py).
//   paths / missing / ready / status / installPager(ctx) / remove / jobParams / reqLines (pure: tests)
"use strict";
const fs = require("fs");
const path = require("path");
const core = require("./core");
const X = require("./setupExec");
const SA = () => require("./speechAddons");

const REPO = "https://github.com/prs-eth/PaGeR";
const HF_REPO = "prs-eth/PaGeR";
const TORCH = ["torch==2.8.0", "torchvision==0.23.0"];
const DROP = /^(torch|torchvision|torchaudio|gradio)\b/i;
const NOTICE = "⛰ Panorama depth uses PaGeR (code Apache-2.0). Its model weights are CC BY-NC 4.0: for NON-COMMERCIAL use only "
  + "(personal, research, education) - not for paid or commercial work, including what you make with it.";
const LINKS = [
  { label: "PaGeR (GitHub, code Apache-2.0)", url: REPO, kind: "pack", dest: "pager/PaGeR" },
  { label: "PaGeR weights (Hugging Face, CC BY-NC 4.0 - non-commercial only)", url: "https://huggingface.co/" + HF_REPO, kind: "model", dest: "the Hugging Face cache" },
];
const SCENES = ["auto", "indoor", "outdoor"];

function paths(base) {
  const b = base || process.env.BITGEN_ADDON_BASE || core.BASE;
  const dir = path.join(b, "pager"), src = path.join(dir, "PaGeR"), venv = path.join(dir, ".venv");
  return { dir, src, venv, python: SA().venvPy(venv), app: path.join(src, "src", "pager.py"), marker: (id) => path.join(dir, id + ".ok") };
}
const has = (p) => { try { return fs.statSync(p).size > 0; } catch { return false; } };

function missing(base) {
  const p = paths(base), out = [];
  if (!has(p.python)) out.push({ id: "venv", what: "its Python", how: "Install" });
  if (!has(p.app)) out.push({ id: "code", what: "the PaGeR code", how: "Install" });
  if (!has(p.marker("packages"))) out.push({ id: "packages", what: "its Python packages", how: "Install" });
  if (!has(p.marker("weights"))) out.push({ id: "weights", what: "the PaGeR weights (non-commercial)", how: "Install" });
  return out;
}
function ready(base) { return !missing(base).length; }
function status(base) {
  const m = missing(base), p = paths(base);
  if (!m.length) return { installed: true, note: "ready - ⛰ Depth in the 🌐 Panorama 3D view. " + NOTICE };
  return { installed: false, note: !fs.existsSync(p.dir) ? "not installed. " + NOTICE : "almost: " + m.map((x) => `${x.what} (${x.how})`).join("; ") + ". " + NOTICE };
}
/** requirements.txt without what bitGen installs its own way (torch, torchvision) or does not need (gradio) */
function reqLines(text) {
  return String(text || "").split(/\r?\n/).map((l) => l.replace(/#.*$/, "").trim()).filter((l) => l && !/^-/.test(l) && !DROP.test(l));
}

/** Python 3.10 - 3.12: the app's own when it fits, else uv makes a 3.11 one */
async function venvFor(ctx, p) {
  const run = ctx.run || X.run, log = ctx.log || (() => {});
  const pv = await SA().pythonOk(ctx, "PaGeR");
  const mm = pv.error ? null : pv.ver.split(".").map(Number);
  if (mm && mm[1] >= 10 && mm[1] <= 12) return SA().makeVenv(ctx, p.venv);
  if (has(p.python)) return { python: p.python };
  const uv = ctx.uv !== undefined ? ctx.uv : X.which("uv", require("./setupRun").runtimeDirs());
  if (!uv) return { error: "PaGeR needs Python 3.10 - 3.12 and uv was not found to fetch one" };
  log("[..] uv makes a Python 3.11 environment for PaGeR (it runs on 3.10 - 3.12)", false);
  if (await run(uv, ["venv", "--seed", "-p", "3.11", p.venv], { log, env: SA().envOf(ctx), timeout: 20 * 60000 }) !== 0 || !has(p.python))
    return { error: "uv could not make a Python 3.11 environment - see the log above" };
  return { python: p.python };
}

/** ctx = {log, run, python, gpu, env, base, git, fetchRepo, uv, hfToken} -> {ok, error, missing} */
async function installPager(ctx) {
  const log = ctx.log || (() => {}), run = ctx.run || X.run, p = paths(ctx.base);
  const env = Object.assign({}, SA().envOf(ctx), ctx.hfToken ? { HF_TOKEN: ctx.hfToken } : {});
  log("[!!] " + NOTICE, false);
  fs.mkdirSync(p.dir, { recursive: true });
  if (!has(p.app)) {
    const git = ctx.git === undefined ? X.which("git", require("./setupRun").runtimeDirs()) : ctx.git;
    const fetchRepo = ctx.fetchRepo || require("./setupPacks").fetchRepo;
    log(`[..] the PaGeR code (${REPO})`, false);
    const fr = await fetchRepo(REPO + ".git", p.src, { log, git, env });
    if (!fr.ok || !has(p.app)) return { ok: false, error: "could not fetch PaGeR: " + (fr.error || "src/pager.py is not in it") };
  } else log(`[ok] the code is there: ${p.src}`, false);
  const v = await venvFor(ctx, p); if (v.error) return { ok: false, error: v.error };
  const pip = (args, t) => run(v.python, ["-m", "pip", "install", ...args, "--progress-bar", "off"], { log, env, timeout: (t || 30) * 60000 });
  if (!has(p.marker("packages"))) {
    const t = await SA().installTorch(Object.assign({}, ctx, { env }), v.python, TORCH); if (t.error) return { ok: false, error: t.error };
    let req = []; try { req = reqLines(fs.readFileSync(path.join(p.src, "requirements.txt"), "utf8")); } catch { req = []; }
    req = [...new Set(req.concat(["huggingface_hub", "pillow", "numpy<2"]))];
    const rf = path.join(p.dir, "requirements-bitgen.txt"); fs.writeFileSync(rf, req.join("\n") + "\n");
    log(`[..] its Python packages (${req.length}: ${req.join(" ")})`, false);
    if (await pip(["-r", rf], 60) !== 0) return { ok: false, error: "pip could not install PaGeR's packages - see the log above" };
    log("[..] PaGeR itself (pip install -e . --no-deps - its Depth Anything 3 backbone code)", false);
    if (await run(v.python, ["-m", "pip", "install", "-e", ".", "--no-deps", "--progress-bar", "off"], { log, env, cwd: p.src, timeout: 20 * 60000 }) !== 0)
      return { ok: false, error: "pip could not install PaGeR itself - see the log above" };
    fs.writeFileSync(p.marker("packages"), new Date().toISOString());
  } else log("[ok] its Python packages", false);
  if (!has(p.marker("weights"))) {
    const code = "from huggingface_hub import hf_hub_download\n"
      + `for f in ["config.yaml", "model.safetensors"]:\n    print(hf_hub_download(${JSON.stringify(HF_REPO)}, f))\n`
      + "import open_clip\nopen_clip.create_model_and_transforms('ViT-B-32', pretrained='openai', force_quick_gelu=True)\nprint('open_clip ViT-B-32 ready')\n";
    const g = await SA().hfGet(Object.assign({}, ctx, { env }), v.python, code, "the PaGeR weights (" + HF_REPO + ", CC BY-NC 4.0 - non-commercial only) + CLIP ViT-B-32");
    if (g.error) return { ok: false, error: g.error };
    fs.writeFileSync(p.marker("weights"), new Date().toISOString());
  } else log("[ok] the PaGeR weights", false);
  log(`[ok] PaGeR installed: ${p.dir}. ⛰ Depth in the 🌐 Panorama 3D view. ${NOTICE}`, false);
  return { ok: true };
}

function remove() {
  return async (log) => {
    const d = paths().dir;
    log(`[..] removing ${d}`, false);
    const ok = require("./setupPacks").safeRm(d, log);
    return ok ? { ok: true } : { ok: false, error: `could not remove ${d} - close anything using it and try again` };
  };
}

/** one depth job: a picture (abs path) -> {params} | {error, missing} */
function jobParams(picture, o) {
  const x = o || {};
  if (!picture || !fs.existsSync(picture)) return { error: "that picture is not there" };
  if (!/\.(png|jpe?g|webp)$/i.test(picture)) return { error: "⛰ Depth reads a PNG, JPEG or WebP panorama" };
  const miss = missing();
  if (miss.length) return { error: "⛰ Panorama depth is not installed - Settings ▸ Add-ons ▸ ⛰ Panorama depth (PaGeR): " + miss.map((m) => m.what).join(", ") + " missing", missing: miss };
  const stem = path.basename(picture).replace(/\.[^.]+$/, "").replace(/[^A-Za-z0-9_-]+/g, "_").slice(0, 60) || "panorama";
  const scene = SCENES.indexOf(x.scene) >= 0 ? x.scene : "auto";
  const ipd = Math.max(0.04, Math.min(0.08, +x.ipd || 0.064));
  const label = "⛰ Depth " + path.basename(picture);
  return { params: { mode: "panodepth", source: picture, name: stem, scene, ipd, stereo: x.stereo !== false, mesh: x.mesh !== false,
    models_dir: x.models_dir || require("./m3d").dir(), pager: { python: paths().python, src: paths().src, repo: HF_REPO },
    prompt: label, label, no_assets: true } };
}

module.exports = { REPO, HF_REPO, TORCH, NOTICE, LINKS, SCENES, paths, missing, ready, status, reqLines, installPager, remove, jobParams };
