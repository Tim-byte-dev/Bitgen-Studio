// bitGen Studio — lib/visionAddon.js (2.595.0): Settings ▸ Add-ons ▸ WeVisOne-VL - Tencent's vision model as a DROPDOWN
// download into the user's VISION folder.
//
// Tim: "can we add https://tencent.github.io/WeVisOne-VL/, add it to addons to dl, dl it to the llm vision folder set by
// the user".
//   WeVisOne-VL (Tencent WeChat Vision, Apache-2.0, built on Qwen3-VL) in GGUF (mradermacher/WeVisOne-VL-4B-GGUF and
//   -2B-GGUF, architecture qwen3vl - llama-server runs it like the other vision models): the model file + its mmproj
//   projector (f16) go into <vision folder>/WeVisOne-VL-<size>/ - one subfolder per size, because the pairing
//   (captioner.pairFiles) matches an mmproj by the first 12 letters of the name, which the 2B and 4B share. The
//   prompt docker's vision dropdown lists it from there (captioner.scan walks one level deep).
//   The vision folder: Settings ▸ LLM ▸ the vision models folder (config captioner.dir) when it is set; otherwise
//   <LLM folder>/vision (part of the automatic scan); without an LLM folder <app>/qwen3vl.
//   NOTE: in llama.cpp it describes / reads pictures (the vision dropdown's job); its pixel decoder (segmentation,
//   matting) is not part of a GGUF.
//   ITEMS                    [{id, label, for, size, files: [{repo, file, size}], sub, rec}]
//   visionDir()              where it goes (above)
//   status(dir)              {installed, note, items: [{id, label, for, size, present, dflt, rec}], select}
//   install(log, picks, deps) the picked one: its model + mmproj (only what is missing) -> {ok, error}
//   remove(log, picks, deps)  the picked one's model file (the mmproj too when no other model in that folder needs it)
"use strict";
const fs = require("fs");
const path = require("path");

const R4 = "mradermacher/WeVisOne-VL-4B-GGUF", R2 = "mradermacher/WeVisOne-VL-2B-GGUF";
const MM4 = { repo: R4, file: "WeVisOne-VL-4B.mmproj-f16.gguf", size: 900000000 };
const MM2 = { repo: R2, file: "WeVisOne-VL-2B.mmproj-f16.gguf", size: 900000000 };
const ITEMS = [
  { id: "wv4_q4km", label: "★ WeVisOne-VL 4B - Q4_K_M (2.7 GB + projector 0.9 GB)", sub: "WeVisOne-VL-4B", rec: true,
    files: [{ repo: R4, file: "WeVisOne-VL-4B.Q4_K_M.gguf", size: 2720000000 }, MM4],
    for: "the recommended one - sharp at reading pictures, text (OCR), counting and finding things; ~5 GB VRAM with the projector" },
  { id: "wv4_q6k", label: "WeVisOne-VL 4B - Q6_K (3.6 GB + projector 0.9 GB)", sub: "WeVisOne-VL-4B",
    files: [{ repo: R4, file: "WeVisOne-VL-4B.Q6_K.gguf", size: 3630000000 }, MM4], for: "very close to full quality" },
  { id: "wv4_q8", label: "WeVisOne-VL 4B - Q8_0 (4.7 GB + projector 0.9 GB)", sub: "WeVisOne-VL-4B",
    files: [{ repo: R4, file: "WeVisOne-VL-4B.Q8_0.gguf", size: 4700000000 }, MM4], for: "near full quality - ~7 GB VRAM" },
  { id: "wv2_q8", label: "WeVisOne-VL 2B - Q8_0 (2.2 GB + projector 0.9 GB)", sub: "WeVisOne-VL-2B",
    files: [{ repo: R2, file: "WeVisOne-VL-2B.Q8_0.gguf", size: 2170000000 }, MM2], for: "the small one at near full quality - shares a GPU easily" },
  { id: "wv2_q4km", label: "WeVisOne-VL 2B - Q4_K_M (1.3 GB + projector 0.9 GB)", sub: "WeVisOne-VL-2B",
    files: [{ repo: R2, file: "WeVisOne-VL-2B.Q4_K_M.gguf", size: 1280000000 }, MM2], for: "the smallest - a 4-6 GB card" },
];
const DEFAULT = "wv4_q4km";
const Models = () => require("./setupModels");
const fmt = (b) => require("./aiFillAddon").fmt(b);
const total = (it) => it.files.reduce((s, f) => s + f.size, 0);

/** the user's vision folder (see above) */
function visionDir() {
  const core = require("./core");
  const c = ((core.getConfig() || {}).captioner || {});
  if (String(c.dir || "").trim()) { try { return require("./captioner").visionDirs(core)[0]; } catch { /* below */ } }
  try { return path.join(core.llmPaths().dir, "vision"); } catch { return path.join(core.BASE, "qwen3vl"); }
}
function picked(picks) { const p = Array.isArray(picks) ? picks : []; return ITEMS.find((i) => p.includes(i.id)) || ITEMS.find((i) => i.id === DEFAULT); }
const fileIn = (dir, it, f) => path.join(dir, it.sub, f.file);
const has = (p) => { try { return fs.statSync(p).size > 0; } catch { return false; } };

function status(dir0) {
  const dir = dir0 || visionDir();
  const items = ITEMS.map((it) => ({ id: it.id, label: it.label, for: it.for, size: fmt(total(it)), dflt: it.id === DEFAULT, rec: !!it.rec,
    present: it.files.every((f) => has(fileIn(dir, it, f))) }));
  const have = items.filter((i) => i.present);
  return { installed: have.length > 0, items, select: true,
    note: have.length ? "in the vision folder: " + have.map((i) => i.label.replace(/^★ /, "").replace(/ \(.*$/, "")).join(", ") + " - pick it in the prompt docker's vision dropdown"
      : "none yet - the vision folder: " + dir };
}

async function install(log, picks, deps) {
  const d = deps || {};
  const dir = d.dir || visionDir();
  const it = picked(picks);
  const to = path.join(dir, it.sub);
  try { fs.mkdirSync(to, { recursive: true }); } catch (e) { return { ok: false, error: `the vision folder ${to}: ${e.message}` }; }
  const core = require("./core");
  const token = ((core.getConfig() || {}).hf || {}).token || "";
  const env = Object.assign({}, process.env, { PYTHONUTF8: "1", PIP_DISABLE_PIP_VERSION_CHECK: "1" });
  const dl = d.download || ((mm, pp) => { let last = -1; return Models().download(mm, { token, paths: pp, python: require("./setupRun").appPython(), log, env, engine: "auto",
    onProgress: (p) => { const pc = p && p.total ? Math.floor((p.got / p.total) * 10) * 10 : -1; if (pc > last) { last = pc; log(`… ${path.basename(mm.file)} ${pc} %`, false); } } }); });
  for (const f of it.files) {
    const dest = path.join(to, f.file);
    if (has(dest)) { log(`[ok] ${f.file} is already there`, false); continue; }
    log(`[..] ${f.repo}/${f.file} (${fmt(f.size)}) -> ${to}`, false);
    const entry = { id: "wevisone_" + f.file.replace(/[^A-Za-z0-9]+/g, "_"), repo: f.repo, file: f.file, size: f.size, dest: "app" };
    const r = await dl(entry, { app: to, comfyModels: "" });
    if (!r || !r.ok) return { ok: false, error: `${f.file}: ${(r && r.error) || "the download failed"}` };
  }
  log(`[ok] ${it.label.replace(/^★ /, "").replace(/ \(.*$/, "")} is in ${to} - pick it in the prompt docker's vision dropdown (📎 a picture in the prompt and the LLM gets its description)`, false);
  log("[ok] WeVisOne-VL is a Qwen3-VL model - it needs a recent llama.cpp (misc\\get-llama.ps1). In llama.cpp it reads and describes pictures; its segmentation / matting decoder is not part of a GGUF.", false);
  return { ok: true, dir: to };
}

async function remove(log, picks, deps) {
  const d = deps || {};
  const dir = d.dir || visionDir();
  const it = picked(picks);
  const model = fileIn(dir, it, it.files[0]);
  if (!has(model)) { log(`[ok] ${it.files[0].file} is not in the vision folder`, false); return { ok: true }; }
  try { const st = require("./captioner").state(); if (st && st.proc && path.resolve(String(st.model || "")) === path.resolve(model)) return { ok: false, error: `${it.files[0].file} is the vision model running now - stop it (Settings ▸ LLM) first` }; } catch { /* not running */ }
  try { fs.unlinkSync(model); log(`[ok] deleted ${model}`, false); } catch (e) { return { ok: false, error: `could not delete ${model}: ${e.message}` }; }
  const others = ITEMS.filter((x) => x.sub === it.sub && x.id !== it.id && has(fileIn(dir, x, x.files[0])));
  if (!others.length) { const mm = fileIn(dir, it, it.files[1]); try { if (has(mm)) { fs.unlinkSync(mm); log(`[ok] deleted ${mm} (no other ${it.sub} model needs it)`, false); } } catch { /* fine */ }
    try { fs.rmdirSync(path.join(dir, it.sub)); } catch { /* not empty */ } }
  return { ok: true };
}

module.exports = { ITEMS, DEFAULT, picked, visionDir, status, install, remove };
