// bitGen Studio — lib/flowhmrAddon.js (2.730.0): Settings ▸ Add-ons ▸ FlowHMR - motion capture from a video.
//
// Tim (verbatim): "and one more for today https://flowhmr.github.io/ . we can add a reference video for motion?" - then,
// asked how it should fit in: "add it to addons with a disclaimer that it is for non commercial use only".
//
// FlowHMR (Tencent Hunyuan's authors; github.com/flowhmr/flowhmr, code Apache-2.0) turns a video of a person into 3D
// motion - SMPL-H (.npz) and an animated skeleton (.fbx) - physically plausible (flow matching + a physics reward).
// NON-COMMERCIAL: the code is Apache-2.0, but it cannot run without files whose licences forbid commercial use: the
// SMPL-H body model (MPI's MANO / AMASS licence - you register and download it yourself), Meta's SAM 3D Body and
// VGGT-Omega (gated on Hugging Face - you request access). bitGen downloads nothing it may not; it says what is missing.
//
// The install (the authors' "V2M" setup, docs/install.md), into <app>/flowhmr/:
//   FlowHMR/            the code (git clone, or GitHub zips) + its three submodules: third_party/vggt-omega, YOLOX,
//                       sam-3d-body (the physics simulator PHC+ / Isaac Gym is training-only - not fetched)
//   .venv/              its own Python (the app's 3.10 - 3.12: numpy < 2 has no 3.13 wheels). The authors pin
//                       torch 2.5.1 + cu118, which cannot drive an RTX 50-series card - here torch 2.10.0 from the CUDA
//                       index for THIS card (cu130 / cu128), their requirements without the torch pins, YOLOX --no-deps,
//                       the FBX SDK when its wheel installs (Python 3.10 only - else .npz only)
//   FlowHMR/checkpoints/flowhmr_latest/   fafsaf1/flowhmr-0.46B (public): the recommended model (GRPO + physics)
//   FlowHMR/ckpts/yolox/yolox_l.pth       YOLOX's release (public)
//   FlowHMR/ckpts/vggt-omega/             facebook/VGGT-Omega          (GATED - your token + access)
//   FlowHMR/ckpts/sam-3d-body-dinov3/     facebook/sam-3d-body-dinov3  (GATED - your token + access)
//   FlowHMR/assets/body_models/smpl_neutral_J_regressor.pt   GVHMR's (public)
//   FlowHMR/assets/body_models/smplh/neutral/model.npz       SMPL-H neutral - YOU put it there (mano.is.tue.mpg.de)
//   paths(base) / status(base) / missing(base) / installFlowhmr(ctx) / remove(log) / LINKS / NOTICE / reqLines(text)
"use strict";
const fs = require("fs");
const path = require("path");
const core = require("./core");
const X = require("./setupExec");
const SA = () => require("./speechAddons");

const REPO = "https://github.com/flowhmr/flowhmr";
const SUBMODULES = [
  { dir: "third_party/vggt-omega", repo: "https://github.com/facebookresearch/vggt-omega" },
  { dir: "third_party/YOLOX", repo: "https://github.com/Megvii-BaseDetection/YOLOX" },
  { dir: "third_party/sam-3d-body", repo: "https://github.com/facebookresearch/sam-3d-body" },
];
const TORCH = ["torch==2.10.0", "torchvision==0.25.0"];
const MODEL = { repo: "fafsaf1/flowhmr-0.46B", sub: "flowhmr_latest", files: ["flowhmr_latest.ckpt", "config.yml"] };
const GATED = [
  { id: "vggt", repo: "facebook/VGGT-Omega", files: ["vggt_omega_1b_512.pt"], dir: "ckpts/vggt-omega", what: "VGGT-Omega (camera)" },
  { id: "sam3d", repo: "facebook/sam-3d-body-dinov3", files: null, dir: "ckpts/sam-3d-body-dinov3", what: "SAM 3D Body (body features)" },
];
const YOLOX_URL = "https://github.com/Megvii-BaseDetection/YOLOX/releases/download/0.1.1rc0/yolox_l.pth";
const JREG_URL = "https://raw.githubusercontent.com/zju3dv/GVHMR/main/hmr4d/utils/body_model/smpl_neutral_J_regressor.pt";
const FBX_PKG = ["fbxsdkpy==2020.1.post2", "--extra-index-url", "https://gitlab.inria.fr/api/v4/projects/18692/packages/pypi/simple"];
const NOTICE = "NON-COMMERCIAL USE ONLY: FlowHMR's code is Apache-2.0, but it needs the SMPL-H body model (MPI licence) and Meta's "
  + "SAM 3D Body and VGGT-Omega, whose licences do not allow commercial use. Motion captured with it is for personal / research use.";
const LINKS = [
  { label: "SMPL-H body model - register, then download the AMASS \"Extended SMPL+H model\" (MANO)", url: "https://mano.is.tue.mpg.de/", kind: "model",
    dest: "flowhmr/FlowHMR/assets/body_models/smplh/neutral/model.npz (its neutral model.npz)" },
  { label: "VGGT-Omega - request access (Hugging Face), then set your token in Settings", url: "https://huggingface.co/facebook/VGGT-Omega", kind: "model", dest: "downloaded by Install once you have access" },
  { label: "SAM 3D Body - request access (Hugging Face)", url: "https://huggingface.co/facebook/sam-3d-body-dinov3", kind: "model", dest: "downloaded by Install once you have access" },
  { label: "FlowHMR (GitHub, Apache-2.0)", url: REPO, kind: "pack", dest: "flowhmr/FlowHMR" },
];

function paths(base) {
  const b = base || process.env.BITGEN_ADDON_BASE || core.BASE;
  const dir = path.join(b, "flowhmr"), src = path.join(dir, "FlowHMR"), venv = path.join(dir, ".venv");
  return { dir, src, venv, python: SA().venvPy(venv),
    script: path.join(src, "run_v2m_demo_generation.py"),
    ckpt: path.join(src, "checkpoints", MODEL.sub, MODEL.files[0]),
    yolox: path.join(src, "ckpts", "yolox", "yolox_l.pth"),
    vggt: path.join(src, "ckpts", "vggt-omega", "vggt_omega_1b_512.pt"),
    sam3d: path.join(src, "ckpts", "sam-3d-body-dinov3", "model.ckpt"),
    jreg: path.join(src, "assets", "body_models", "smpl_neutral_J_regressor.pt"),
    smplh: path.join(src, "assets", "body_models", "smplh", "neutral", "model.npz") };
}
const has = (p) => { try { return fs.statSync(p).size > 0; } catch { return false; } };

/** what is not there yet -> [{id, what, how}] (empty = ready) */
function missing(base) {
  const p = paths(base), out = [];
  if (!has(p.python)) out.push({ id: "venv", what: "its Python", how: "Install" });
  if (!has(p.script)) out.push({ id: "code", what: "the FlowHMR code", how: "Install" });
  if (!has(p.ckpt)) out.push({ id: "model", what: "the FlowHMR model", how: "Install" });
  if (!has(p.yolox)) out.push({ id: "yolox", what: "YOLOX (person detection)", how: "Install" });
  if (!has(p.jreg)) out.push({ id: "jreg", what: "the SMPL joint regressor", how: "Install" });
  if (!has(p.vggt)) out.push({ id: "vggt", what: "VGGT-Omega", how: "request access on huggingface.co/facebook/VGGT-Omega, set your token in Settings, Install again" });
  if (!has(p.sam3d)) out.push({ id: "sam3d", what: "SAM 3D Body", how: "request access on huggingface.co/facebook/sam-3d-body-dinov3, set your token in Settings, Install again" });
  if (!has(p.smplh)) out.push({ id: "smplh", what: "the SMPL-H body model", how: `register on mano.is.tue.mpg.de, download the Extended SMPL+H model and put its neutral model.npz at ${p.smplh}` });
  return out;
}
function status(base) {
  const m = missing(base);
  const p = paths(base);
  const fbx = has(path.join(p.dir, "fbx.ok"));
  if (!m.length) return { installed: true, note: `ready${fbx ? "" : " (.npz motion - the FBX SDK did not install here)"} - ${NOTICE}` };
  const any = fs.existsSync(p.dir);
  return { installed: false, note: !any ? `not installed. ${NOTICE}` : "almost: " + m.map((x) => `${x.what} (${x.how})`).join("; ") };
}

/** the authors' requirements.txt without the torch pins / extra index lines (torch comes from the CUDA index first) */
function reqLines(text) {
  return String(text || "").split(/\r?\n/).map((l) => l.replace(/#.*$/, "").trim())
    .filter((l) => l && !/^(-e\s|--)/.test(l))
    .filter((l) => !/^(torch|torchvision|torchaudio)\b/i.test(l.replace(/\s+/g, "")));
}

/** ctx = {log, run, python, gpu, env, base, git, fetchRepo, download, hfToken} -> {ok, error, missing} */
async function installFlowhmr(ctx) {
  const log = ctx.log || (() => {}), run = ctx.run || X.run, p = paths(ctx.base);
  const env = Object.assign({}, SA().envOf(ctx), ctx.hfToken ? { HF_TOKEN: ctx.hfToken } : {});
  log("[!!] " + NOTICE, false);
  const pv = await SA().pythonOk(ctx, "FlowHMR"); if (pv.error) return { ok: false, error: pv.error };
  if (+pv.ver.split(".")[1] > 12) return { ok: false, error: `FlowHMR needs Python 3.10 - 3.12 (its numpy < 2 has no 3.13 wheels); ${ctx.python} is ${pv.ver}` };
  log(`[ok] Python ${pv.ver} (${ctx.python})`, false);
  const git = ctx.git === undefined ? X.which("git", require("./setupRun").runtimeDirs()) : ctx.git;
  const fetchRepo = ctx.fetchRepo || require("./setupPacks").fetchRepo;
  fs.mkdirSync(p.dir, { recursive: true });
  // 1 the code + its submodules (each fetched on its own: a GitHub zip has no submodules)
  if (!has(p.script)) {
    log(`[..] the FlowHMR code (${REPO})`, false);
    const fr = await fetchRepo(REPO + ".git", p.src, { log, git, env });
    if (!fr.ok || !has(p.script)) return { ok: false, error: "could not fetch the FlowHMR code: " + (fr.error || "run_v2m_demo_generation.py is not in it") };
  } else log(`[ok] the code is there: ${p.src}`, false);
  for (const sm of SUBMODULES) {
    const d = path.join(p.src, ...sm.dir.split("/"));
    let full = false; try { full = fs.readdirSync(d).some((f) => !f.startsWith(".")); } catch { full = false; }
    if (full) { log(`[ok] ${sm.dir}`, false); continue; }
    try { fs.rmSync(d, { recursive: true, force: true }); } catch { /* an empty submodule folder */ }
    log(`[..] ${sm.dir} (${sm.repo})`, false);
    const r = await fetchRepo(sm.repo + ".git", d, { log, git, env });
    if (!r.ok) return { ok: false, error: `could not fetch ${sm.dir}: ${r.error || "see the log"}` };
  }
  // 2 its Python: torch for THIS card, the requirements without the torch pins, YOLOX --no-deps, the FBX SDK if it will
  const v = await SA().makeVenv(ctx, p.venv); if (v.error) return { ok: false, error: v.error };
  const t = await SA().installTorch(Object.assign({}, ctx, { env }), v.python, TORCH); if (t.error) return { ok: false, error: t.error };
  let req = [];
  for (const f of ["requirements.txt", path.join("tools", "web", "requirements.txt")]) {
    try { req = req.concat(reqLines(fs.readFileSync(path.join(p.src, f), "utf8"))); } catch { /* not in this version */ }
  }
  req.push("wheel", "huggingface_hub");
  const rf = path.join(p.dir, "requirements-bitgen.txt");
  fs.writeFileSync(rf, [...new Set(req)].join("\n") + "\n");
  log(`[..] its Python packages (${req.length})`, false);
  if (await run(v.python, ["-m", "pip", "install", "-r", rf, "--progress-bar", "off"], { log, env, timeout: 60 * 60000 }) !== 0)
    return { ok: false, error: "pip could not install FlowHMR's packages - see the log above" };
  if (await run(v.python, ["-m", "pip", "install", "--no-build-isolation", "--no-deps", "-e", path.join(p.src, "third_party", "YOLOX"), "--progress-bar", "off"], { log, env, timeout: 30 * 60000 }) !== 0)
    return { ok: false, error: "pip could not install YOLOX (third_party/YOLOX) - see the log above" };
  const fbxOk = await run(v.python, ["-m", "pip", "install", ...FBX_PKG, "--progress-bar", "off"], { log, env, timeout: 20 * 60000 }) === 0;
  try { if (fbxOk) fs.writeFileSync(path.join(p.dir, "fbx.ok"), "1"); else fs.rmSync(path.join(p.dir, "fbx.ok"), { force: true }); } catch { /* a marker */ }
  log(fbxOk ? "[ok] the FBX SDK - motion is saved as .fbx as well as .npz" : "[warn] the FBX SDK would not install (its wheel is for Python 3.10) - motion is saved as .npz only", !fbxOk);
  // 3 the public files
  const dl = ctx.download || ((url, dest) => X.download(url, dest, {}));
  for (const [url, dest, what] of [[YOLOX_URL, p.yolox, "YOLOX large (person detection)"], [JREG_URL, p.jreg, "the SMPL joint regressor (GVHMR)"]]) {
    if (has(dest)) { log(`[ok] ${what}`, false); continue; }
    log(`[..] ${what}: ${url}`, false);
    const r = await dl(url, dest);
    if (!r || !r.ok) return { ok: false, error: `could not download ${what}: ${(r && r.error) || "failed"}` };
  }
  const py = (s) => JSON.stringify(String(s));
  if (!has(p.ckpt)) {
    const g = await SA().hfGet(Object.assign({}, ctx, { env }), v.python, `from huggingface_hub import hf_hub_download\nfor f in ${JSON.stringify(MODEL.files)}:\n    print(hf_hub_download(${py(MODEL.repo)}, ${py(MODEL.sub)} + "/" + f, local_dir=${py(path.join(p.src, "checkpoints"))}))`, `the FlowHMR model (${MODEL.repo}, ${MODEL.sub})`);
    if (g.error) return { ok: false, error: g.error };
  } else log("[ok] the FlowHMR model", false);
  // 4 the gated files - a refusal is said, the rest carries on (Install again once access is granted)
  const refused = [];
  for (const gt of GATED) {
    if (has(gt.id === "vggt" ? p.vggt : p.sam3d)) { log(`[ok] ${gt.what}`, false); continue; }
    const dest = path.join(p.src, ...gt.dir.split("/"));
    const code = gt.files
      ? `from huggingface_hub import hf_hub_download\nfor f in ${JSON.stringify(gt.files)}:\n    print(hf_hub_download(${py(gt.repo)}, f, local_dir=${py(dest)}))`
      : `from huggingface_hub import snapshot_download\nprint(snapshot_download(${py(gt.repo)}, local_dir=${py(dest)}))`;
    const g = await SA().hfGet(Object.assign({}, ctx, { env }), v.python, code, `${gt.what} (${gt.repo}, gated)`);
    if (g.error) refused.push(gt);
  }
  const left = missing(ctx.base).filter((m) => !["venv", "code"].includes(m.id));
  if (refused.length) log(`[warn] Hugging Face refused ${refused.map((g) => g.repo).join(" and ")} - they are gated: request access on ${refused.map((g) => "huggingface.co/" + g.repo).join(" / ")}, set your token in Settings ▸ Hugging Face, then Install again`, true);
  if (left.some((m) => m.id === "smplh")) log(`[warn] the SMPL-H body model is not there: register on mano.is.tue.mpg.de (non-commercial licence), download the Extended SMPL+H model and put its neutral model.npz at ${p.smplh}`, true);
  if (left.length) return { ok: false, missing: left, error: "almost ready - still needed: " + left.map((m) => m.what).join(", ") + " (see the log: each says how), then Install again" };
  log(`[ok] FlowHMR installed: ${p.dir}. 🕺 Motion in the preview bar turns the previewed video into motion (models3d/).`, false);
  log("[!!] " + NOTICE, false);
  return { ok: true };
}

function remove() {
  return async (log) => {
    const d = paths().dir;
    log(`[..] removing ${d} (the SMPL-H file you put there goes too)`, false);
    const ok = require("./setupPacks").safeRm(d, log);
    return ok ? { ok: true } : { ok: false, error: `could not remove ${d} - close anything using it and try again` };
  };
}

module.exports = { REPO, SUBMODULES, TORCH, MODEL, GATED, NOTICE, LINKS, paths, missing, status, reqLines, installFlowhmr, remove };
