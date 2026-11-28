// bitGen Studio — lib/d3v3Addon.js (3.7.0): Settings ▸ Add-ons ▸ 💎 Fine detail (Direct3D-V3) - a rough 3D model of a picture
// (🧊 Convert to 3D's Hunyuan3D 2.1 / TRELLIS.2) carved into a finely detailed one, up to 1536³ signed-distance voxels.
// Tim: "can you add this to sketcher. https://dreamtechai.github.io/Direct3D-V3/"
//
// Direct3D-V3 (Shuang Wu et al., Nanjing University / DreamTech / HKU / Oxford, SIGGRAPH Asia 2026 - github.com/DreamTechAI/
// Direct3D-V3): MIT code; the weights wushuang98/Direct3D-V3 (512 / 1024 / 1536 denoisers); its picture encoder DINOv3 ViT-H+
// (facebook/dinov3-vith16plus-pretrain-lvd1689m - GATED: the DINOv3 licence accepted on Hugging Face + your token) and BiRefNet
// (ZhengPeng7/BiRefNet, MIT) for the background. It needs a rough mesh the same way round as the picture - its own coarse
// model is not released; the README points to Hunyuan3D 2.1, which bitGen already runs (🧊 Convert to 3D).
//
// The install, into <app>/direct3d_v3/:
//   Direct3D-V3/  the code (git clone, or GitHub's zip)
//   .venv/        Python 3.12 (3.11 fits too) - the app's, another on this computer, or uv fetches one (lib/pyVersion.js);
//                 torch 2.8.0 for THIS card (cu128 runs RTX 50 - the README's 2.14 + CUDA 13 is Linux-only), its
//                 requirements.txt; flash-attn: Windows = a prebuilt wheel from GitHub (cpXY + win_amd64 + torch 2.8 + cu12x),
//                 Linux = pip; its voxelizer + hole filler = pip-built from third_party/ (needs the CUDA toolkit + a C++
//                 compiler). A part that will not install is NOT a failure: misc/d3v3_run.py uses bitGen's stand-ins
//                 (misc/d3v3_shims - PyTorch's own attention, a sampled voxelizer, a fan hole filler) and says so.
//   the weights: the Hugging Face cache (each repo its own step and marker - a gated DINOv3 leaves the others done)
// paths / missing / status / reqLines / pickFlashWheel / installD3 / remove / jobParams (pure: scripts/test-3700.js)
"use strict";
const fs = require("fs");
const path = require("path");
const core = require("./core");
const X = require("./setupExec");
const SA = () => require("./speechAddons");

const REPO = "https://github.com/DreamTechAI/Direct3D-V3";
const HF = { d3: "wushuang98/Direct3D-V3", dino: "facebook/dinov3-vith16plus-pretrain-lvd1689m", biref: "ZhengPeng7/BiRefNet" };
const TORCH_VER = "2.8.0";
const TORCH = ["torch==2.8.0", "torchvision==0.23.0"];
const FA_WIN_REPOS = ["kingbri1/flash-attention"];
const DROP = /^(torch|torchvision|torchaudio|flash[_-]attn|gradio)\b/i;
const RES = [512, 1024, 1536];
const NOTICE = "Direct3D-V3 (MIT code, DreamTech / Nanjing University): carves fine detail into a rough 3D model of a picture. "
  + "Its picture encoder DINOv3 is under Meta's DINOv3 licence (accept it on Hugging Face); check the weights' own terms "
  + "before commercial use. Needs an NVIDIA card - 24 GB is comfortable at 1024, Low memory for less.";
const DINO_HELP = "the DINOv3 picture encoder is GATED: open https://huggingface.co/" + HF.dino + ", accept Meta's DINOv3 licence, "
  + "put your Hugging Face token in Settings ▸ Paths ▸ Hugging Face, then Install again";
const LINKS = [
  { label: "Direct3D-V3 (GitHub, MIT)", url: REPO, kind: "pack", dest: "direct3d_v3/Direct3D-V3" },
  { label: "Direct3D-V3 weights (Hugging Face)", url: "https://huggingface.co/" + HF.d3, kind: "model", dest: "the Hugging Face cache" },
  { label: "DINOv3 ViT-H+ (Hugging Face, gated - DINOv3 licence)", url: "https://huggingface.co/" + HF.dino, kind: "model", dest: "the Hugging Face cache" },
  { label: "BiRefNet (Hugging Face, MIT)", url: "https://huggingface.co/" + HF.biref, kind: "model", dest: "the Hugging Face cache" },
];

function paths(base) {
  const b = base || process.env.BITGEN_ADDON_BASE || core.BASE;
  const dir = path.join(b, "direct3d_v3"), src = path.join(dir, "Direct3D-V3"), venv = path.join(dir, ".venv");
  return { dir, src, venv, python: SA().venvPy(venv), infer: path.join(src, "direct3d", "pipeline.py"), marker: (id) => path.join(dir, id + ".ok") };
}
const has = (p) => { try { return fs.statSync(p).size > 0; } catch { return false; } };
const read = (p) => { try { return fs.readFileSync(p, "utf8").trim(); } catch { return ""; } };

function missing(base) {
  const p = paths(base), out = [];
  if (!has(p.python)) out.push({ id: "venv", what: "its Python 3.12", how: "Install" });
  if (!has(p.infer)) out.push({ id: "code", what: "the Direct3D-V3 code", how: "Install" });
  if (!has(p.marker("packages"))) out.push({ id: "packages", what: "its Python packages", how: "Install" });
  if (!has(p.marker("flash"))) out.push({ id: "flash", what: "flash-attn (or bitGen's stand-in)", how: "Install" });
  if (!has(p.marker("ext"))) out.push({ id: "ext", what: "its voxelizer + hole filler (or bitGen's stand-ins)", how: "Install" });
  if (!has(p.marker("w_d3"))) out.push({ id: "w_d3", what: "the Direct3D-V3 weights", how: "Install" });
  if (!has(p.marker("w_biref"))) out.push({ id: "w_biref", what: "BiRefNet (the background)", how: "Install" });
  if (!has(p.marker("w_dino"))) out.push({ id: "w_dino", what: "DINOv3 (gated - accept its licence on Hugging Face, your token in Settings ▸ Paths)", how: "Install" });
  return out;
}
function ready(base) { return !missing(base).length; }
/** which parts run on bitGen's stand-ins (the markers say "standin") */
function standIns(base) {
  const p = paths(base), out = [];
  if (read(p.marker("flash")) === "standin") out.push("flash-attn");
  if (read(p.marker("ext")) === "standin") out.push("the voxelizer + hole filler");
  return out;
}
function status(base) {
  const m = missing(base), p = paths(base), si = standIns(base);
  if (!m.length) return { installed: true, note: "ready - 💎 Fine detail in the Sketcher." + (si.length ? " Running on bitGen's stand-ins for " + si.join(" and ") + " (slower, the same result)." : "") + " " + NOTICE };
  return { installed: false, note: !fs.existsSync(p.dir) ? "not installed. " + NOTICE : "almost: " + m.map((x) => `${x.what} (${x.how})`).join("; ") };
}

/** requirements.txt without what bitGen installs its own way (torch, flash-attn) or does not need (gradio - the demo) */
function reqLines(text) {
  return String(text || "").split(/\r?\n/).map((l) => l.replace(/#.*$/, "").trim()).filter((l) => l && !/^-/.test(l) && !DROP.test(l));
}
/** a flash-attn wheel among a GitHub release list for this Python (cp312 ...) + OS + torch (major.minor) + a cu12x build */
function pickFlashWheel(releases, o) {
  const x = o || {}, plat = x.plat || "win_amd64", py = x.py || "cp312", tv = String(x.torch || TORCH_VER).split(".").slice(0, 2).join(".");
  const ok = (n) => /\.whl$/.test(n) && n.includes(py + "-" + py) && n.includes(plat) && new RegExp("torch" + tv.replace(".", "\\.") + "(\\.\\d+)?(?!\\d)").test(n) && /cu12\d/.test(n);
  for (const r of releases || []) {
    if (!r || r.draft || r.prerelease) continue;
    const a = (r.assets || []).find((as) => as && ok(String(as.name || "")));
    if (a) return a.browser_download_url || null;
  }
  return null;
}
const snap = (repo) => `from huggingface_hub import snapshot_download\nprint(snapshot_download(${JSON.stringify(repo)}))`;

/** ctx = {log, run, python, gpu, env, base, git, fetchRepo, uv, fetchJson, hfToken} -> {ok, error, missing} */
async function installD3(ctx) {
  const log = ctx.log || (() => {}), run = ctx.run || X.run, p = paths(ctx.base);
  const env = Object.assign({}, SA().envOf(ctx), ctx.hfToken ? { HF_TOKEN: ctx.hfToken } : {});
  log("[!!] " + NOTICE, false);
  fs.mkdirSync(p.dir, { recursive: true });
  if (!has(p.infer)) {
    const git = ctx.git === undefined ? X.which("git", require("./setupRun").runtimeDirs()) : ctx.git;
    const fetchRepo = ctx.fetchRepo || require("./setupPacks").fetchRepo;
    log(`[..] the Direct3D-V3 code (${REPO})`, false);
    const fr = await fetchRepo(REPO + ".git", p.src, { log, git, env });
    if (!fr.ok || !has(p.infer)) return { ok: false, error: "could not fetch Direct3D-V3: " + (fr.error || "direct3d/pipeline.py is not in it") };
  } else log(`[ok] the code is there: ${p.src}`, false);
  const v = await require("./pyVersion").venvFor(ctx, { venv: p.venv, want: "3.12", range: "3.11 - 3.12", fits: (m) => m === 11 || m === 12, label: "Direct3D-V3", why: "its code and the prebuilt flash-attn wheels" });
  if (v.error) return { ok: false, error: v.error };
  const pip = (args, t, o) => run(v.python, ["-m", "pip", "install", ...args, "--progress-bar", "off"], Object.assign({ log, env, timeout: (t || 30) * 60000 }, o || {}));
  if (!has(p.marker("packages"))) {
    const t = await SA().installTorch(Object.assign({}, ctx, { env }), v.python, TORCH); if (t.error) return { ok: false, error: t.error };
    let req = []; try { req = reqLines(fs.readFileSync(path.join(p.src, "requirements.txt"), "utf8")); } catch { req = []; }
    req = [...new Set(req.concat(["trimesh", "huggingface_hub", "setuptools", "wheel", "ninja", "psutil", "packaging"]))];
    const rf = path.join(p.dir, "requirements-bitgen.txt"); fs.writeFileSync(rf, req.join("\n") + "\n");
    log(`[..] its Python packages (${req.length}: ${req.join(" ")})`, false);
    if (await pip(["-r", rf], 60) !== 0) return { ok: false, error: "pip could not install Direct3D-V3's packages - see the log above" };
    fs.writeFileSync(p.marker("packages"), new Date().toISOString());
  } else log("[ok] its Python packages", false);
  // the compiled parts - each falls back to bitGen's stand-in (misc/d3v3_shims), never stops the install
  if (!has(p.marker("flash"))) {
    let ok = false;
    if (X.IS_WIN) {
      let py = "cp312"; await run(v.python, ["-c", "import sys; print('PYV cp%d%d' % sys.version_info[:2])"], { log: (l) => { const m = /PYV (cp\d+)/.exec(l); if (m) py = m[1]; }, env });
      const fetchJson = ctx.fetchJson || (async (u) => { const r = await fetch(u, { headers: { "User-Agent": "bitGen-Studio" } }); if (!r.ok) throw new Error(r.status + " " + r.statusText); return r.json(); });
      for (const repo of FA_WIN_REPOS) {
        let rel = null; try { rel = await fetchJson(`https://api.github.com/repos/${repo}/releases?per_page=30`); } catch (e) { log(`[warn] ${repo}: ${e.message}`, true); }
        const url = pickFlashWheel(rel, { plat: "win_amd64", torch: TORCH_VER, py });
        if (!url) { log(`[warn] no flash-attn wheel for ${py} + torch ${TORCH_VER} on ${repo}`, true); continue; }
        log(`[..] flash-attn: ${url}`, false);
        if (await pip([url], 20) === 0) { ok = true; break; }
      }
    } else {
      log("[..] flash-attn (a prebuilt wheel for this torch when there is one; building it from source can take an hour)", false);
      ok = await pip(["flash-attn", "--no-build-isolation"], 120) === 0;
    }
    if (!ok) log("[warn] flash-attn did not install - bitGen's stand-in (PyTorch's own attention: slower, more memory, the same result) is used", true);
    fs.writeFileSync(p.marker("flash"), ok ? "real" : "standin");
  } else log(`[ok] flash-attn (${read(p.marker("flash"))})`, false);
  if (!has(p.marker("ext"))) {
    log("[..] its voxelizer + hole filler (built here - needs the CUDA toolkit and a C++ compiler; bitGen's stand-ins if not)", false);
    const ok = await pip(["--no-build-isolation", "./third_party/voxelization", "./third_party/fill_holes"], 30, { cwd: p.src }) === 0;
    if (!ok) log("[warn] they did not build here (no CUDA toolkit / compiler) - bitGen's stand-ins are used (the same result, a little slower)", true);
    fs.writeFileSync(p.marker("ext"), ok ? "real" : "standin");
  } else log(`[ok] its voxelizer + hole filler (${read(p.marker("ext"))})`, false);
  const H = Object.assign({}, ctx, { env });
  for (const [k, repo, what] of [["w_d3", HF.d3, "the Direct3D-V3 weights"], ["w_biref", HF.biref, "BiRefNet"], ["w_dino", HF.dino, "DINOv3 ViT-H+ (gated)"]]) {
    if (has(p.marker(k))) { log(`[ok] ${what}`, false); continue; }
    const g = await SA().hfGet(H, v.python, snap(repo), what + " (" + repo + ")");
    if (g.error) return { ok: false, missing: missing(ctx.base), error: k === "w_dino" ? "could not download DINOv3 - " + DINO_HELP : g.error };
    fs.writeFileSync(p.marker(k), new Date().toISOString());
  }
  const si = standIns(ctx.base);
  log(`[ok] Direct3D-V3 installed: ${p.dir}${si.length ? " (bitGen's stand-ins for " + si.join(" and ") + ")" : ""}. 💎 Fine detail in the Sketcher.`, false);
  return { ok: true };
}

function remove() {
  return async (log) => {
    const d = paths().dir;
    log(`[..] removing ${d} (the weights stay in the Hugging Face cache)`, false);
    const ok = require("./setupPacks").safeRm(d, log);
    return ok ? { ok: true } : { ok: false, error: `could not remove ${d} - close anything using it and try again` };
  };
}

const int = (x, lo, hi, d) => { const n = Math.round(+x); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d; };
/** one job: a picture + a rough model of the project -> {params} | {error, missing} */
function jobParams(picture, coarse, o) {
  const x = o || {};
  if (!picture || !fs.existsSync(picture)) return { error: "that picture is not in this project" };
  if (!coarse || !fs.existsSync(coarse)) return { error: "that rough 3D model is not in this project" };
  if (!/\.(glb|gltf|obj|ply|stl)$/i.test(coarse)) return { error: "the rough model must be a .glb / .gltf / .obj / .ply / .stl" };
  const miss = missing();
  if (miss.length) return { error: "💎 Fine detail is not installed - Settings ▸ Add-ons ▸ 💎 Fine detail (Direct3D-V3): " + miss.map((m) => m.what).join(", ") + " missing", missing: miss };
  const res = RES.includes(+x.resolution) ? +x.resolution : 1024;
  const stem = (String(x.name || path.basename(coarse).replace(/\.[^.]+$/, "")).replace(/[^A-Za-z0-9_-]+/g, "_").replace(/_rough$/, "").slice(0, 60)) || "model";
  const faces = x.faces === 0 || x.faces === "all" ? null : int(x.faces, 10000, 5000000, 500000);
  const label = "💎 Fine detail " + path.basename(coarse) + " (" + res + ")";
  return { params: { mode: "d3v3", image: picture, coarse, name: stem, resolution: res, steps: int(x.steps, 1, 50, 15),
    cfg: Number.isFinite(+x.cfg) ? Math.min(15, Math.max(0, +x.cfg)) : 4, seed: Number.isFinite(+x.seed) ? Math.floor(Math.abs(+x.seed)) : 2026,
    max_tokens: x.low ? 60000 : int(x.max_tokens, 20000, 400000, 150000), target_faces: faces,
    models_dir: x.models_dir || require("./m3d").dir(), d3v3: { python: paths().python, src: paths().src }, prompt: label, label, no_assets: true } };
}

module.exports = { REPO, HF, TORCH, TORCH_VER, FA_WIN_REPOS, RES, NOTICE, DINO_HELP, LINKS, paths, missing, ready, standIns, status, reqLines, pickFlashWheel, installD3, remove, jobParams };
