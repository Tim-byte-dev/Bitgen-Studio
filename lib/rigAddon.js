// bitGen Studio — lib/rigAddon.js (2.976.0): Settings ▸ Add-ons ▸ 🦴 Rig it (UniRig) - a skeleton + skin weights for ANY 3D
// model: a person, an animal, a creature, a car's parts - so a model made from a photo (🧊 Convert to 3D, 🧱 Picture → 3D
// scene) can be posed and animated in Blender, Daz-style tools, game engines and the timeline's 3D layers.
// Tim: "are we able to make a 3d model of a person animal and car from a photo... like daz studio does it with facegen?" ->
// (step 1 of the answer: rig what Convert to 3D makes) "yes please".
//
// UniRig (VAST-AI-Research + Tsinghua, SIGGRAPH 2025; github.com/VAST-AI-Research/UniRig) - MIT licence (code + the
// VAST-AI/UniRig checkpoints on Hugging Face). Its scripts are bash; misc/rig_worker.py runs the same Python steps itself
// (extract -> skeleton -> extract the skeleton -> skin -> merge), so it works on Windows too.
//
// The install, into <app>/unirig/:
//   UniRig/      the code (git clone, or GitHub zips)
//   .venv/       Python 3.11 EXACTLY (its bpy==4.2 wheel is 3.11 only) - the app's Python when it is 3.11, else uv makes one;
//                torch 2.8.0 for THIS card (cu128 runs RTX 50), torch_scatter + torch_cluster from PyG's wheels for that
//                torch / CUDA, spconv (cu126 / cu124 / cu121 wheels, the first that installs), numpy 1.26.4, the rest of
//                requirements.txt; flash-attn (UniRig needs it): Windows = a prebuilt wheel found on GitHub (FA_WIN_REPOS:
//                cp311 + win_amd64 + this torch + cu12x), else pip (Linux: its own prebuilt wheel)
//   the checkpoints: VAST-AI/UniRig skeleton/articulation-xl_quantization_256/model.ckpt + skin/articulation-xl/model.ckpt
//   paths / status / missing / installRig(ctx) / remove / jobParams / reqLines / pickFlashWheel (pure: tests)
"use strict";
const fs = require("fs");
const path = require("path");
const core = require("./core");
const X = require("./setupExec");
const SA = () => require("./speechAddons");

const REPO = "https://github.com/VAST-AI-Research/UniRig";
const HF_REPO = "VAST-AI/UniRig";
const CKPTS = ["skeleton/articulation-xl_quantization_256/model.ckpt", "skin/articulation-xl/model.ckpt"];
const TORCH_VER = "2.8.0";
const TORCH = ["torch==2.8.0", "torchvision==0.23.0"];
const SPCONV = ["spconv-cu126", "spconv-cu124", "spconv-cu121"];
const FA_WIN_REPOS = ["kingbri1/flash-attention"];
const DROP = /^(torch|torchvision|torchaudio|flash[_-]attn|numpy|wandb|spconv)\b/i;
const NOTICE = "UniRig (MIT, VAST-AI-Research): a skeleton and skin weights predicted for any model - humans, animals, "
  + "creatures. Check the bones before animating: a missing tail or wing bone spoils the skin weights.";
const LINKS = [
  { label: "UniRig (GitHub, MIT)", url: REPO, kind: "pack", dest: "unirig/UniRig" },
  { label: "UniRig checkpoints (Hugging Face)", url: "https://huggingface.co/" + HF_REPO, kind: "model", dest: "the Hugging Face cache" },
];
const SUFFIX = "obj,fbx,FBX,dae,glb,gltf,vrm";

function paths(base) {
  const b = base || process.env.BITGEN_ADDON_BASE || core.BASE;
  const dir = path.join(b, "unirig"), src = path.join(dir, "UniRig"), venv = path.join(dir, ".venv");
  return { dir, src, venv, python: SA().venvPy(venv), run: path.join(src, "run.py"), marker: (id) => path.join(dir, id + ".ok") };
}
const has = (p) => { try { return fs.statSync(p).size > 0; } catch { return false; } };

function missing(base) {
  const p = paths(base), out = [];
  if (!has(p.python)) out.push({ id: "venv", what: "its Python 3.11", how: "Install" });
  if (!has(p.run)) out.push({ id: "code", what: "the UniRig code", how: "Install" });
  if (!has(p.marker("packages"))) out.push({ id: "packages", what: "its Python packages", how: "Install" });
  if (!has(p.marker("flash"))) out.push({ id: "flash", what: "flash-attn", how: "Install (see its log line if it fails)" });
  if (!has(p.marker("ckpt"))) out.push({ id: "ckpt", what: "the UniRig checkpoints", how: "Install" });
  return out;
}
function ready(base) { return !missing(base).length; }
function status(base) {
  const m = missing(base), p = paths(base);
  if (!m.length) return { installed: true, note: "ready - 🦴 Rig it in the Sketcher. " + NOTICE };
  return { installed: false, note: !fs.existsSync(p.dir) ? "not installed. " + NOTICE : "almost: " + m.map((x) => `${x.what} (${x.how})`).join("; ") };
}

/** requirements.txt without what bitGen installs its own way (torch, flash-attn, numpy pin, spconv) or does not need (wandb) */
function reqLines(text) {
  return String(text || "").split(/\r?\n/).map((l) => l.replace(/#.*$/, "").trim()).filter((l) => l && !/^-/.test(l) && !DROP.test(l));
}
/** a flash-attn wheel among a GitHub release list for cp311 + this OS + this torch (major.minor) + a cu12x build -> url | null */
function pickFlashWheel(releases, o) {
  const x = o || {}, plat = x.plat || "win_amd64", tv = String(x.torch || TORCH_VER).split(".").slice(0, 2).join(".");
  const ok = (n) => /\.whl$/.test(n) && n.includes("cp311") && n.includes(plat) && new RegExp("torch" + tv.replace(".", "\\.") + "(\\.\\d+)?(?!\\d)").test(n) && /cu12\d/.test(n);
  for (const r of releases || []) {
    if (!r || r.draft || r.prerelease) continue;
    const a = (r.assets || []).find((as) => as && ok(String(as.name || "")));
    if (a) return a.browser_download_url || null;
  }
  return null;
}

async function venv311(ctx, p) {
  const run = ctx.run || X.run, log = ctx.log || (() => {});
  const pv = await SA().pythonOk(ctx, "UniRig");
  if (!pv.error && pv.ver.split(".").slice(0, 2).join(".") === "3.11") return SA().makeVenv(ctx, p.venv);
  if (has(p.python)) return { python: p.python };
  const uv = ctx.uv !== undefined ? ctx.uv : X.which("uv", require("./setupRun").runtimeDirs());
  if (!uv) return { error: "UniRig needs Python 3.11 (its Blender module bpy 4.2 is 3.11 only) and uv was not found to fetch one" };
  log("[..] uv makes a Python 3.11 environment for UniRig (bpy 4.2 is 3.11 only)", false);
  if (await run(uv, ["venv", "--seed", "-p", "3.11", p.venv], { log, env: SA().envOf(ctx), timeout: 20 * 60000 }) !== 0 || !has(p.python))
    return { error: "uv could not make a Python 3.11 environment - see the log above" };
  return { python: p.python };
}

/** ctx = {log, run, python, gpu, env, base, git, fetchRepo, uv, fetchJson, hfToken} -> {ok, error, missing} */
async function installRig(ctx) {
  const log = ctx.log || (() => {}), run = ctx.run || X.run, p = paths(ctx.base);
  const env = Object.assign({}, SA().envOf(ctx), ctx.hfToken ? { HF_TOKEN: ctx.hfToken } : {});
  log("[!!] " + NOTICE, false);
  fs.mkdirSync(p.dir, { recursive: true });
  if (!has(p.run)) {
    const git = ctx.git === undefined ? X.which("git", require("./setupRun").runtimeDirs()) : ctx.git;
    const fetchRepo = ctx.fetchRepo || require("./setupPacks").fetchRepo;
    log(`[..] the UniRig code (${REPO})`, false);
    const fr = await fetchRepo(REPO + ".git", p.src, { log, git, env });
    if (!fr.ok || !has(p.run)) return { ok: false, error: "could not fetch UniRig: " + (fr.error || "run.py is not in it") };
  } else log(`[ok] the code is there: ${p.src}`, false);
  const v = await venv311(ctx, p); if (v.error) return { ok: false, error: v.error };
  const pip = (args, t) => run(v.python, ["-m", "pip", "install", ...args, "--progress-bar", "off"], { log, env, timeout: (t || 30) * 60000 });
  let cu = "cu128";
  if (!has(p.marker("packages"))) {
    const t = await SA().installTorch(Object.assign({}, ctx, { env }), v.python, TORCH); if (t.error) return { ok: false, error: t.error };
    cu = /^cu\d+$/.test(t.index || "") ? t.index : cu;
    let req = []; try { req = reqLines(fs.readFileSync(path.join(p.src, "requirements.txt"), "utf8")); } catch { req = []; }
    req = [...new Set(req.concat(["numpy==1.26.4", "psutil", "huggingface_hub", "trimesh"]))];
    const rf = path.join(p.dir, "requirements-bitgen.txt"); fs.writeFileSync(rf, req.join("\n") + "\n");
    log(`[..] its Python packages (${req.length}: ${req.join(" ")})`, false);
    if (await pip(["-r", rf], 60) !== 0) return { ok: false, error: "pip could not install UniRig's packages - see the log above" };
    log(`[..] torch_scatter + torch_cluster (PyG wheels for torch ${TORCH_VER} + ${cu})`, false);
    if (await pip(["torch_scatter", "torch_cluster", "-f", `https://data.pyg.org/whl/torch-${TORCH_VER}+${cu}.html`, "--no-cache-dir"]) !== 0)
      return { ok: false, error: `torch_scatter / torch_cluster have no wheel for torch ${TORCH_VER} + ${cu} here - see the log above` };
    let sp = false;
    for (const s of SPCONV) { log(`[..] ${s}`, false); if (await pip([s]) === 0) { sp = true; break; } }
    if (!sp) return { ok: false, error: "spconv would not install (" + SPCONV.join(" / ") + ") - see the log above" };
    fs.writeFileSync(p.marker("packages"), new Date().toISOString());
  } else log("[ok] its Python packages", false);
  if (!has(p.marker("flash"))) {
    let ok = false;
    if (X.IS_WIN) {
      const fetchJson = ctx.fetchJson || (async (u) => { const r = await fetch(u, { headers: { "User-Agent": "bitGen-Studio" } }); if (!r.ok) throw new Error(r.status + " " + r.statusText); return r.json(); });
      for (const repo of FA_WIN_REPOS) {
        let rel = null; try { rel = await fetchJson(`https://api.github.com/repos/${repo}/releases?per_page=30`); } catch (e) { log(`[warn] ${repo}: ${e.message}`, true); }
        const url = pickFlashWheel(rel, { plat: "win_amd64", torch: TORCH_VER });
        if (!url) { log(`[warn] no flash-attn wheel for Python 3.11 + torch ${TORCH_VER} on ${repo}`, true); continue; }
        log(`[..] flash-attn: ${url}`, false);
        if (await pip([url], 20) === 0) { ok = true; break; }
      }
    } else {
      log("[..] flash-attn (its own prebuilt wheel for this torch - building from source takes an hour if none fits)", false);
      ok = await pip(["flash-attn", "--no-build-isolation"], 120) === 0;
    }
    if (!ok) return { ok: false, missing: missing(ctx.base), error: "flash-attn did not install (UniRig cannot run without it) - see the log above; a wheel for Python 3.11 + torch " + TORCH_VER + " put into its venv by hand also works, then Install again" };
    fs.writeFileSync(p.marker("flash"), new Date().toISOString());
  } else log("[ok] flash-attn", false);
  if (!has(p.marker("ckpt"))) {
    const py = (s) => JSON.stringify(String(s));
    const g = await SA().hfGet(Object.assign({}, ctx, { env }), v.python, `from huggingface_hub import hf_hub_download\nfor f in ${JSON.stringify(CKPTS)}:\n    print(hf_hub_download(${py(HF_REPO)}, f))`, "the UniRig checkpoints (" + HF_REPO + ")");
    if (g.error) return { ok: false, error: g.error };
    fs.writeFileSync(p.marker("ckpt"), new Date().toISOString());
  } else log("[ok] the UniRig checkpoints", false);
  log(`[ok] UniRig installed: ${p.dir}. 🦴 Rig it in the Sketcher rigs the project's 3D models.`, false);
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

/** one rig job: a model of the project's models3d -> {params} | {error, missing} */
function jobParams(model, o) {
  const x = o || {};
  if (!model || !fs.existsSync(model)) return { error: "that 3D model is not in this project" };
  if (!/\.(glb|gltf|obj|fbx|dae|vrm)$/i.test(model)) return { error: "UniRig rigs .glb / .gltf / .obj / .fbx / .dae / .vrm models" };
  const miss = missing();
  if (miss.length) return { error: "🦴 Rig it is not installed - Settings ▸ Add-ons ▸ 🦴 Rig it (UniRig): " + miss.map((m) => m.what).join(", ") + " missing", missing: miss };
  const stem = path.basename(model).replace(/\.[^.]+$/, "").replace(/[^A-Za-z0-9_-]+/g, "_").slice(0, 60) || "model";
  const label = "🦴 Rig " + path.basename(model);
  return { params: { mode: "rig", source: model, name: stem, seed: Number.isFinite(+x.seed) ? Math.floor(+x.seed) : 12345,
    faces: Math.max(5000, Math.min(200000, +x.faces || 50000)), skin: x.skin !== false, suffix: SUFFIX,
    models_dir: x.models_dir || require("./m3d").dir(), unirig: { python: paths().python, src: paths().src }, prompt: label, label, no_assets: true } };
}

module.exports = { REPO, HF_REPO, CKPTS, TORCH, TORCH_VER, SPCONV, FA_WIN_REPOS, NOTICE, LINKS, SUFFIX, paths, missing, ready, status, reqLines, pickFlashWheel, installRig, remove, jobParams };
