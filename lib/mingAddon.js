// bitGen Studio — lib/mingAddon.js (3.9.0): Settings ▸ Add-ons ▸ 🧩 Ming layered design - Ming-Image-0.2-Design makes a design
// from your layer list, Ming-Image-0.1-Design-Layer splits it into those layers (transparent PNGs). Both inclusionAI, MIT.
// Tim: "can u add this to image editor please. https://huggingface.co/inclusionAI/Ming-Image-0.2-Design ... it is supposed to be
// able to generate separate layers. please check it" (what was checked: lib/mingLayers.js).
//
// The install, into <app>/ming_image/:
//   Ming-Image/   the code (github.com/inclusionAI/Ming-Image - checked at commit d5615110; its infer.py runs both models)
//   .venv/        Python 3.12 (3.10 - 3.12): torch 2.8.0 for THIS card (its requirements pin torch 2.4.0, which has no RTX 50
//                 kernels - 2.8 + cu128 runs RTX 50 and older cards alike); its requirements.txt without torch / torchvision /
//                 transformer-engine (optional - its code falls back to its own RMSNorm; no Windows wheels) and with numpy < 2
//                 for the pinned 1.23.1 (no wheels past Python 3.11). Attention: eager (its default) - flash-attn is optional.
//   the weights:  the Hugging Face cache - tick what you want in the Download box:
//                 gen   Ming-Image-0.2-Design         (makes the design)
//                 layer Ming-Image-0.1-Design-Layer   (splits a picture into layers)
// Memory: inclusionAI validated ONE 80 GB card (BF16). Its code also spreads the language model over several cards
// (--device-map balanced --num-gpus N): an RTX 5090 + 3090 (56 GB) is the way to try it here; not validated by them. With less,
// run it on OpenRouter (☁ in the dialog - Ming 0.1 Design + Design-Layer are free there) or a rented GPU.
// paths / missing / status / reqLines / install / remove / jobParams (pure: scripts/test-3900.js)
"use strict";
const fs = require("fs");
const path = require("path");
const core = require("./core");
const X = require("./setupExec");
const SA = () => require("./speechAddons");
const ML = require("./mingLayers");

const REPO = "https://github.com/inclusionAI/Ming-Image";
const CHECKED = "d5615110e3ae7d27f270eafe5556d669b2069971";
const HF = { gen: "inclusionAI/Ming-Image-0.2-Design", layer: "inclusionAI/Ming-Image-0.1-Design-Layer" };
const OR = { gen: ["inclusionai/ming-image-0.2-design", "inclusionai/ming-image-0.1-design"], layer: "inclusionai/ming-image-0.1-design-layer" };
const TORCH = ["torch==2.8.0", "torchvision==0.23.0"];
const DROP = /^(torch|torchvision|torchaudio|transformer[-_]engine|flash[_-]attn|numpy)\b/i;
const NOTICE = "Ming-Image (inclusionAI, MIT): 0.2-Design makes the design from your layer list, 0.1-Design-Layer splits it into those "
  + "layers. inclusionAI validated one 80 GB card; bitGen spreads the language model over every NVIDIA card here (an RTX 5090 + "
  + "3090 = 56 GB is the way to try it - not validated by them). Less than that: ☁ OpenRouter in the dialog (free) or a rented GPU.";
const ITEMS = [
  { id: "gen", label: "Ming-Image-0.2-Design (makes the design)", for: "the picture from your layer list - Hugging Face " + HF.gen, dflt: true, repo: HF.gen },
  { id: "layer", label: "Ming-Image-0.1-Design-Layer (splits it into layers)", for: "the separate transparent layers - also splits the picture already open; Hugging Face " + HF.layer, dflt: true, repo: HF.layer },
];
const LINKS = [
  { label: "Ming-Image code (GitHub, MIT)", url: REPO, kind: "pack", dest: "ming_image/Ming-Image" },
  { label: "Ming-Image-0.2-Design (Hugging Face, MIT)", url: "https://huggingface.co/" + HF.gen, kind: "model", dest: "the Hugging Face cache" },
  { label: "Ming-Image-0.1-Design-Layer (Hugging Face, MIT)", url: "https://huggingface.co/" + HF.layer, kind: "model", dest: "the Hugging Face cache" },
];

function paths(base) {
  const b = base || process.env.BITGEN_ADDON_BASE || core.BASE;
  const dir = path.join(b, "ming_image"), src = path.join(dir, "Ming-Image"), venv = path.join(dir, ".venv");
  return { dir, src, venv, python: SA().venvPy(venv), infer: path.join(src, "infer.py"), marker: (id) => path.join(dir, id + ".ok") };
}
const has = (p) => { try { return fs.statSync(p).size > 0; } catch { return false; } };
const read = (p) => { try { return fs.readFileSync(p, "utf8").trim(); } catch { return ""; } };

/** what is not there yet; o.need = ["gen"] / ["layer"] / both (default: the base + whatever weights are wanted) */
function missing(base, o) {
  const p = paths(base), need = (o && o.need) || ["gen", "layer"], out = [];
  if (!has(p.python)) out.push({ id: "venv", what: "its Python 3.12", how: "Install" });
  if (!has(p.infer)) out.push({ id: "code", what: "the Ming-Image code", how: "Install" });
  if (!has(p.marker("packages"))) out.push({ id: "packages", what: "its Python packages", how: "Install" });
  for (const it of ITEMS) if (need.includes(it.id) && !has(p.marker("w_" + it.id))) out.push({ id: "w_" + it.id, what: it.label, how: "Install (tick it)" });
  return out;
}
const haveWeights = (base) => { const p = paths(base); return { gen: has(p.marker("w_gen")), layer: has(p.marker("w_layer")) }; };
function ready(base) { const m = missing(base, { need: [] }), w = haveWeights(base); return !m.length && (w.gen || w.layer); }
function status(base) {
  const p = paths(base), w = haveWeights(base), m = missing(base, { need: [] });
  const items = ITEMS.map((it) => ({ id: it.id, label: it.label, for: it.for, dflt: it.dflt, need: false, present: w[it.id], size: "about 30 - 40 GB" }));
  if (!m.length && (w.gen || w.layer)) {
    const can = [w.gen ? "makes designs" : "", w.layer ? "splits pictures into layers" : ""].filter(Boolean).join(" and ");
    return { installed: true, items, note: `ready - ${can} (Image editor ▸ Layer ▸ 🧩 Ming Layered Design…).` + (!w.gen || !w.layer ? " Tick the other model and Install to have both." : "") + " " + NOTICE };
  }
  return { installed: false, items, note: !fs.existsSync(p.dir) ? "not installed. " + NOTICE : "almost: " + missing(base).map((x) => `${x.what} (${x.how})`).join("; ") };
}
/** requirements.txt without what bitGen installs its own way (torch), cannot install on Windows (transformer-engine), the
 *  optional flash-attn, and the numpy pin (1.23.1 has no wheels past Python 3.11 - numpy < 2 is put in its place) */
function reqLines(text) {
  const out = String(text || "").split(/\r?\n/).map((l) => l.replace(/#.*$/, "").trim()).filter((l) => l && !/^-/.test(l) && !DROP.test(l));
  return out.concat(["numpy>=1.26,<2"]);
}
const snap = (repo) => `from huggingface_hub import snapshot_download\nprint(snapshot_download(${JSON.stringify(repo)}))`;

/** ctx = {log, run, python, gpu, env, base, git, fetchRepo, hfToken, picks} -> {ok, error, missing} */
async function install(ctx) {
  const log = ctx.log || (() => {}), run = ctx.run || X.run, p = paths(ctx.base);
  const picks = Array.isArray(ctx.picks) && ctx.picks.length ? ctx.picks.filter((id) => ITEMS.some((i) => i.id === id)) : ITEMS.filter((i) => i.dflt).map((i) => i.id);
  const env = Object.assign({}, SA().envOf(ctx), ctx.hfToken ? { HF_TOKEN: ctx.hfToken } : {});
  log("[!!] " + NOTICE, false);
  fs.mkdirSync(p.dir, { recursive: true });
  if (!has(p.infer)) {
    const git = ctx.git === undefined ? X.which("git", require("./setupRun").runtimeDirs()) : ctx.git;
    const fetchRepo = ctx.fetchRepo || require("./setupPacks").fetchRepo;
    log(`[..] the Ming-Image code (${REPO}; bitGen was checked with commit ${CHECKED.slice(0, 8)})`, false);
    const fr = await fetchRepo(REPO + ".git", p.src, { log, git, env });
    if (!fr.ok || !has(p.infer)) return { ok: false, error: "could not fetch Ming-Image: " + (fr.error || "infer.py is not in it") };
  } else log(`[ok] the code is there: ${p.src}`, false);
  const v = await require("./pyVersion").venvFor(ctx, { venv: p.venv, want: "3.12", range: "3.10 - 3.12", fits: (m) => m >= 10 && m <= 12, label: "Ming-Image", why: "its pinned transformers / diffusers" });
  if (v.error) return { ok: false, error: v.error };
  const pip = (args, t) => run(v.python, ["-m", "pip", "install", ...args, "--progress-bar", "off"], { log, env, timeout: (t || 30) * 60000 });
  if (!has(p.marker("packages"))) {
    const t = await SA().installTorch(Object.assign({}, ctx, { env }), v.python, TORCH); if (t.error) return { ok: false, error: t.error };
    let req = []; try { req = reqLines(fs.readFileSync(path.join(p.src, "requirements.txt"), "utf8")); } catch { req = reqLines(""); }
    req = [...new Set(req.concat(["huggingface_hub", "sentencepiece", "protobuf"]))];
    const rf = path.join(p.dir, "requirements-bitgen.txt"); fs.writeFileSync(rf, req.join("\n") + "\n");
    log(`[..] its Python packages (${req.length}: ${req.join(" ")})`, false);
    if (await pip(["-r", rf], 60) !== 0) return { ok: false, error: "pip could not install Ming-Image's packages - see the log above" };
    fs.writeFileSync(p.marker("packages"), new Date().toISOString());
  } else log("[ok] its Python packages", false);
  const H = Object.assign({}, ctx, { env });
  for (const it of ITEMS) {
    if (!picks.includes(it.id)) { if (!has(p.marker("w_" + it.id))) log(`[--] ${it.label}: not ticked - skipped`, false); continue; }
    if (has(p.marker("w_" + it.id))) { log(`[ok] ${it.label}`, false); continue; }
    const g = await SA().hfGet(H, v.python, snap(it.repo), it.label + " (" + it.repo + ")");
    if (g.error) return { ok: false, missing: missing(ctx.base, { need: picks }), error: g.error };
    fs.writeFileSync(p.marker("w_" + it.id), new Date().toISOString());
  }
  log(`[ok] Ming-Image installed: ${p.dir}. Image editor ▸ Layer ▸ 🧩 Ming Layered Design…`, false);
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
/** the job: o = {rows, engine "local" | "openrouter", split (layers wanted), input (a picture to split - no generation), w, h,
 *  level 1024 | 2048, layer_res 512 | 1024, style, lighting, steps, seed, gpus, name, orKey} -> {params} | {error, missing, status} */
function jobParams(o) {
  const x = o || {}, rows = ML.clean(x.rows), engine = x.engine === "openrouter" ? "openrouter" : "local";
  const input = x.input && fs.existsSync(x.input) ? x.input : "";
  if (x.input && !input) return { error: "the picture to split is gone", status: 400 };
  if (!rows.length) return { error: "add at least one layer - its name and what goes in it", status: 400 };
  const split = !!input || (x.split !== false && rows.length > 1);
  if (input && rows.length < 2) return { error: "splitting a picture needs at least two layers (the front ones and the background)", status: 400 };
  const gen = !input, need = [gen ? "gen" : "", split ? "layer" : ""].filter(Boolean);
  if (engine === "local") {
    const miss = missing(undefined, { need });
    if (miss.length) return { error: "🧩 Ming-Image is not installed here - Settings ▸ Add-ons ▸ 🧩 Ming layered design: " + miss.map((m) => m.what).join(", ") + " missing (or pick ☁ OpenRouter in the dialog)", missing: miss, status: 409 };
  } else if (!x.orKey) return { error: "☁ OpenRouter needs your API key - 🖥 GPU ▸ Remote generation ▸ OpenRouter (Ming 0.1 Design and Design-Layer are free there)", status: 400 };
  const sz = ML.sizeFor(x.w, x.h, x.level), name = ML.stem(x.name || rows[0].name || "design");
  const label = "🧩 Ming " + (gen ? "design" : "split") + (split ? " · " + rows.length + " layers" : "") + (engine === "openrouter" ? " (OpenRouter)" : "");
  const p = paths();
  const params = { mode: "ming", engine, name, rows, generate: gen, split, input: input || null,
    width: sz.w, height: sz.h, layer_res: +x.layer_res === 512 ? 512 : 1024,
    t2i_prompt: gen ? ML.t2iPrompt(rows, { w: sz.w, h: sz.h, style: x.style, lighting: x.lighting }) : null,
    layer_plan: split ? ML.layerPlan(rows) : null,
    steps: x.steps ? int(x.steps, 4, 50, 12) : null, seed: Number.isFinite(+x.seed) && x.seed !== "" && x.seed != null ? Math.floor(Math.abs(+x.seed)) : 42,
    gpus: x.gpus === "1" || x.gpus === 1 ? 1 : 0, prompt: label, label, no_assets: true,
    ming: engine === "local" ? { python: p.python, src: p.src, gen: HF.gen, layer: HF.layer } : { gen: OR.gen, layer: OR.layer } };
  // the OpenRouter key rides the job the way OpenRouter pictures do (lib/orRender.js jobApis - never in the job's params)
  if (engine === "openrouter") params.style = { api_id: require("./orRender").API_ID, name: "Ming-Image on OpenRouter" };
  return { params };
}

module.exports = { REPO, CHECKED, HF, OR, TORCH, ITEMS, NOTICE, LINKS, paths, missing, haveWeights, ready, status, reqLines, install, remove, jobParams };
