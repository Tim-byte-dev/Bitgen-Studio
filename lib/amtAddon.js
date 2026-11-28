// bitGen Studio — lib/amtAddon.js (3.11.0): Settings ▸ Add-ons ▸ ✍ Continue (Anticipatory Music Transformer) - the Edit Booth's
// piano roll writes the next bars of a note clip in the same style. Step 2 of "our own Magenta" (step 1: 🥁 Drumify, 2.992.0).
// Tim: "okay let go with 1" (the Anticipatory Music Transformer over EleutherAI's Aria - any instruments, and it can fill a gap
// later = Interpolate).
//
// The Anticipatory Music Transformer (John Thickstun, David Hall, Chris Donahue, Percy Liang - Stanford CRFM; code github.com/
// jthickstun/anticipation, Apache-2.0, checked at af373979): GPT-2 models on the Hugging Face hub, Apache-2.0:
//   small   stanford-crfm/music-small-800k    128M, ~0.5 GB  - Lakh MIDI; fast, runs on the CPU too
//   medium  stanford-crfm/music-medium-800k   360M, ~1.4 GB  - Lakh MIDI
//   large   stanford-crfm/music-large-800k    780M, ~3 GB    - Lakh MIDI, MetaMIDI, and transcriptions of the FMA set and 450k
//                                                               commercial records (their model card)
// The install, into <app>/amt/:
//   anticipation/  the code (git clone - its own package, used from there: nothing compiled)
//   .venv/         Python 3.12 (3.10 - 3.12): torch 2.8.0 (cu128 on an NVIDIA card, else the CPU wheels), transformers 4.x
//                  (its requirements pin 4.29.2 - its GPT-2 models load the same in later 4.x, which have wheels for 3.12),
//                  mido, numpy, tqdm, huggingface_hub
//   the models:    the Hugging Face cache - tick which (small + medium by default)
// paths / missing / status / install / remove / jobParams (pure: scripts/test-31100.js)
"use strict";
const fs = require("fs");
const path = require("path");
const core = require("./core");
const X = require("./setupExec");
const SA = () => require("./speechAddons");
const AN = require("./amtNotes");

const REPO = "https://github.com/jthickstun/anticipation";
const CHECKED = "af37397922665a0fb8d474d7988b0f3755a38d45";
const TORCH = ["torch==2.8.0"];
const PKGS = ["transformers>=4.44,<5", "mido>=1.2.10", "numpy>=1.26,<3", "tqdm", "huggingface_hub", "safetensors"];
const ITEMS = [
  { id: "small", label: "Small (128M, ~0.5 GB) - fast, runs on the CPU too", for: "stanford-crfm/music-small-800k - trained on the Lakh MIDI set", repo: "stanford-crfm/music-small-800k", dflt: true, size: "~0.5 GB" },
  { id: "medium", label: "Medium (360M, ~1.4 GB)", for: "stanford-crfm/music-medium-800k - trained on the Lakh MIDI set", repo: "stanford-crfm/music-medium-800k", dflt: true, size: "~1.4 GB" },
  { id: "large", label: "Large (780M, ~3 GB) - the most musical", for: "stanford-crfm/music-large-800k - also trained on transcriptions of commercial records (its model card)", repo: "stanford-crfm/music-large-800k", dflt: false, size: "~3 GB" },
];
const NOTICE = "The Anticipatory Music Transformer (Stanford CRFM, Apache-2.0 code and models) writes the next bars of your notes in the same "
  + "style - a start you finish in the piano roll (light tasks). It runs on this computer (an NVIDIA card is quicker; the small model runs on "
  + "the CPU too); nothing leaves your PC.";
const LINKS = [
  { label: "anticipation (GitHub, Apache-2.0)", url: REPO, kind: "pack", dest: "amt/anticipation" },
].concat(ITEMS.map((i) => ({ label: i.repo + " (Hugging Face, Apache-2.0)", url: "https://huggingface.co/" + i.repo, kind: "model", dest: "the Hugging Face cache" })));

function paths(base) {
  const b = base || process.env.BITGEN_ADDON_BASE || core.BASE;
  const dir = path.join(b, "amt"), src = path.join(dir, "anticipation"), venv = path.join(dir, ".venv");
  return { dir, src, venv, python: SA().venvPy(venv), pkg: path.join(src, "anticipation", "sample.py"), marker: (id) => path.join(dir, id + ".ok") };
}
const has = (p) => { try { return fs.statSync(p).size > 0; } catch { return false; } };

function haveModels(base) { const p = paths(base), o = {}; for (const it of ITEMS) o[it.id] = has(p.marker("w_" + it.id)); return o; }
/** what is missing; o.model = the one a job wants */
function missing(base, o) {
  const p = paths(base), out = [];
  if (!has(p.python)) out.push({ id: "venv", what: "its Python 3.12", how: "Install" });
  if (!has(p.pkg)) out.push({ id: "code", what: "the anticipation code", how: "Install" });
  if (!has(p.marker("packages"))) out.push({ id: "packages", what: "its Python packages", how: "Install" });
  const w = haveModels(base);
  if (o && o.model) { if (!w[o.model]) out.push({ id: "w_" + o.model, what: "the " + o.model + " model", how: "Install (tick it)" }); }
  else if (!ITEMS.some((i) => w[i.id])) out.push({ id: "w_any", what: "a model (small, medium or large)", how: "Install (tick one)" });
  return out;
}
function ready(base) { return !missing(base).length; }
function status(base) {
  const w = haveModels(base), items = ITEMS.map((it) => ({ id: it.id, label: it.label, for: it.for, dflt: it.dflt, need: false, present: w[it.id], size: it.size }));
  if (ready(base)) return { installed: true, items, note: "ready - " + ITEMS.filter((i) => w[i.id]).map((i) => i.id).join(", ") + " (Edit Booth ▸ a note clip's 🎹 piano roll ▸ ✍ Continue). " + NOTICE };
  return { installed: false, items, note: !fs.existsSync(paths(base).dir) ? "not installed. " + NOTICE : "almost: " + missing(base).map((x) => `${x.what} (${x.how})`).join("; ") };
}
const snap = (repo) => `from huggingface_hub import snapshot_download\nprint(snapshot_download(${JSON.stringify(repo)}))`;

/** ctx = {log, run, python, gpu, env, base, git, fetchRepo, hfToken, picks} -> {ok, error, missing} */
async function install(ctx) {
  const log = ctx.log || (() => {}), run = ctx.run || X.run, p = paths(ctx.base);
  const picks = Array.isArray(ctx.picks) && ctx.picks.length ? ctx.picks.filter((id) => ITEMS.some((i) => i.id === id)) : ITEMS.filter((i) => i.dflt).map((i) => i.id);
  const env = Object.assign({}, SA().envOf(ctx), ctx.hfToken ? { HF_TOKEN: ctx.hfToken } : {});
  log("[!!] " + NOTICE, false);
  fs.mkdirSync(p.dir, { recursive: true });
  if (!has(p.pkg)) {
    const git = ctx.git === undefined ? X.which("git", require("./setupRun").runtimeDirs()) : ctx.git;
    const fetchRepo = ctx.fetchRepo || require("./setupPacks").fetchRepo;
    log(`[..] the anticipation code (${REPO}; bitGen was checked with commit ${CHECKED.slice(0, 8)})`, false);
    const fr = await fetchRepo(REPO + ".git", p.src, { log, git, env });
    if (!fr.ok || !has(p.pkg)) return { ok: false, error: "could not fetch the anticipation code: " + (fr.error || "anticipation/sample.py is not in it") };
  } else log(`[ok] the code is there: ${p.src}`, false);
  const v = await require("./pyVersion").venvFor(ctx, { venv: p.venv, want: "3.12", range: "3.10 - 3.12", fits: (m) => m >= 10 && m <= 12, label: "✍ Continue", why: "PyTorch and transformers wheels" });
  if (v.error) return { ok: false, error: v.error };
  if (!has(p.marker("packages"))) {
    const t = await SA().installTorch(Object.assign({}, ctx, { env }), v.python, TORCH); if (t.error) return { ok: false, error: t.error };
    log(`[..] its Python packages (${PKGS.join(" ")})`, false);
    if (await run(v.python, ["-m", "pip", "install", ...PKGS, "--progress-bar", "off"], { log, env, timeout: 30 * 60000 }) !== 0) return { ok: false, error: "pip could not install its packages - see the log above" };
    fs.writeFileSync(p.marker("packages"), new Date().toISOString());
  } else log("[ok] its Python packages", false);
  const H = Object.assign({}, ctx, { env });
  for (const it of ITEMS) {
    if (!picks.includes(it.id)) { if (!has(p.marker("w_" + it.id))) log(`[--] ${it.label}: not ticked - skipped`, false); continue; }
    if (has(p.marker("w_" + it.id))) { log(`[ok] the ${it.id} model`, false); continue; }
    const g = await SA().hfGet(H, v.python, snap(it.repo), `the ${it.id} model (${it.repo})`);
    if (g.error) return { ok: false, missing: missing(ctx.base), error: g.error };
    fs.writeFileSync(p.marker("w_" + it.id), new Date().toISOString());
  }
  log(`[ok] ✍ Continue installed: ${p.dir}. The Edit Booth ▸ a note clip's 🎹 piano roll ▸ ✍ Continue`, false);
  return { ok: true };
}
function remove() {
  return async (log) => {
    const d = paths().dir;
    log(`[..] removing ${d} (the models stay in the Hugging Face cache)`, false);
    const ok = require("./setupPacks").safeRm(d, log);
    return ok ? { ok: true } : { ok: false, error: `could not remove ${d} - close anything using it and try again` };
  };
}

/** a ✍ Continue job: o = {notes, bpm, bars, model, top_p, instr, only, seed} -> {params, plan} | {error, missing, status} */
function jobParams(o) {
  const x = o || {}, model = ITEMS.some((i) => i.id === x.model) ? x.model : "small";
  const pl = AN.plan(x.notes, { bpm: x.bpm, bars: x.bars });
  if (pl.error) return { error: pl.error, status: 400 };
  const miss = missing(undefined, { model });
  if (miss.length) return { error: "✍ Continue needs its add-on - Settings ▸ Add-ons ▸ ✍ Continue: " + miss.map((m) => m.what).join(", ") + " missing", missing: miss, status: 409 };
  const instr = AN.INSTR.some((i) => i.id === +x.instr) ? +x.instr : 0;
  const p = paths(), it = ITEMS.find((i) => i.id === model);
  const label = `✍ Continue ${pl.bars} bar${pl.bars > 1 ? "s" : ""} (${model})`;
  return { plan: pl, params: { mode: "amt", model: it.repo, notes: pl.notes, start: pl.start, end: pl.end, instr, only: x.only !== false,
    top_p: Math.max(0.5, Math.min(1, Number.isFinite(+x.top_p) ? +x.top_p : 0.97)), seed: Number.isFinite(+x.seed) && x.seed !== "" && x.seed != null ? Math.floor(Math.abs(+x.seed)) : Math.floor(Math.random() * 1e9),
    plan: { from: pl.from, to: pl.to, offset: pl.offset }, vel: AN.velOf(x.notes),
    amt: { python: p.python, src: p.src }, prompt: label, label, no_assets: true } };
}

module.exports = { REPO, CHECKED, ITEMS, TORCH, PKGS, NOTICE, LINKS, paths, missing, haveModels, ready, status, install, remove, jobParams };
