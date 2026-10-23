// bitGen Studio — lib/llmAddon.js (2.586.0): Settings ▸ Add-ons ▸ LLM - the chat / writing LLMs as a DROPDOWN download.
//
// Tim: "what would be the best llm base to build our checkpoint, add it as a download in addons in a dropdown called llm".
// The .gguf goes into the LLM folder (Settings ▸ LLM - llama-server runs it); the LLM dropdown, 🔁 Compare LLMs and the
// 🎓 trainer's base model (lib/finetunePresets.json - the trainer downloads the ORIGINAL weights itself; a .gguf cannot
// be trained) pair with it. Checked against the repos' file lists, 23 Oct 2026:
//   ★ Qwen3.8 27B (unsloth/Qwen3.8-27B-GGUF, Apache 2.0, Aug 2026, dense, 262K context) - the base we recommend
//     for our checkpoint: the newest strong dense model that a 32 GB card can QLoRA-train and a 24 GB card can run
//   Gemma 4 31B (unsloth/gemma-4-31B-it-GGUF, Apache 2.0) - the other strong writer, the same class
//   Gemma 4 12B QAT (unsloth/gemma-4-12B-it-qat-GGUF) - fast, cheap to train with long prompts
//   Qwen3.5 9B / Qwen3 14B, 8B, 4B - the smaller ones (the setup wizard's picks)
//   ITEMS                       [{id, label, for, files: [catalog ids], base, rec}]
//   status()                    {installed (any is there), note, items: [{id, label, for, size, present, dflt}]}
//   install(log, picks, deps)   -> {ok, error}  the picked one into the LLM folder (deps: download, dir)
//   remove(log, picks, deps)    -> {ok, error}  the picked one deleted (not one the LLM server is running)
"use strict";
const fs = require("fs");
const path = require("path");

const ITEMS = [
  { id: "qwen38_q4xl", label: "★ Qwen3.8 27B - UD-Q4_K_XL (17.6 GB) - the base for our checkpoint", files: ["llm_qwen38_q4xl"], base: "qwen38_27b", rec: true,
    for: "Alibaba's newest dense 27B (Aug 2026, Apache 2.0, 262K context): strong writing and instruction following - screenplays, prompts, songs. Runs on a 24 GB card (the second GPU) with room for context; the 🎓 trainer QLoRA-trains its original weights on a 32 GB card" },
  { id: "qwen38_q5xl", label: "Qwen3.8 27B - UD-Q5_K_XL (20.9 GB)", files: ["llm_qwen38_q5xl"], base: "qwen38_27b",
    for: "the same model a step closer to full quality - a 24 GB card with a short context, or a 32 GB card" },
  { id: "qwen38_q8", label: "Qwen3.8 27B - Q8_0 (29 GB)", files: ["llm_qwen38_q8"], base: "qwen38_27b",
    for: "near full quality - a 32 GB card (the 5090) on its own" },
  { id: "gemma4_31b", label: "Gemma 4 31B - UD-Q4_K_XL (18.8 GB)", files: ["llm_gemma4_31b_q4xl"], base: "gemma4_31b",
    for: "Google's largest Gemma 4 (dense 31B, Apache 2.0) - the other strong writer; a 24 GB card. Compare it with Qwen3.8 in 🔁 Compare LLMs before you train" },
  { id: "gemma4_12b", label: "Gemma 4 12B - QAT UD-Q4_K_XL (6.7 GB)", files: ["llm_gemma4_12b_qat"], base: "gemma4_12b",
    for: "Gemma 4 12B trained to run at 4-bit - fast, an 8-12 GB card; the quick one to fine-tune (long bitGen prompts fit)" },
  { id: "qwen35_9b", label: "Qwen3.5 9B - Q8_0 (9.5 GB)", files: ["llm_qwen35_9b_q8"], base: "qwen35_9b",
    for: "a good small model near full quality - a 12 GB card" },
  { id: "qwen3_14b", label: "Qwen3 14B - Q4_K_M (9 GB)", files: ["llm_14b"], base: "",
    for: "the setup wizard's pick for a second GPU with 12 GB+" },
  { id: "qwen3_8b", label: "Qwen3 8B - Q4_K_M (5 GB)", files: ["llm_8b"], base: "", for: "the setup wizard's pick for one 24 GB card" },
  { id: "qwen3_4b", label: "Qwen3 4B - Q4_K_M (2.5 GB)", files: ["llm_4b"], base: "", for: "small - shares one GPU with the video model" },
];
const DEFAULT = "qwen38_q4xl";

const Models = () => require("./setupModels");
const entry = (id) => Models().byId(id);
const fmt = (b) => require("./aiFillAddon").fmt(b);
/** the LLM folder (Settings ▸ LLM) */
function llmDir() { try { return require("./core").llmPaths().dir; } catch { return path.join(require("./core").BASE, "llm-models"); } }
/** a catalog entry placed straight into the LLM folder - wherever Settings ▸ LLM points (pure apart from the dir) */
function inDir(m, dir) { return { entry: Object.assign({}, m, { dest: "app" }), paths: { app: dir, comfyModels: "" } }; }
const fileOf = (it, dir) => { const m = entry(it.files[0]); return m ? path.join(dir, m.as || path.basename(m.file)) : ""; };
/** the one picked (the dropdown) - an unknown id = the default (pure) */
function picked(picks) { const p = Array.isArray(picks) ? picks : []; const it = ITEMS.find((i) => p.includes(i.id)); return it || ITEMS.find((i) => i.id === DEFAULT); }

function status(dir0) {
  const dir = dir0 || llmDir();
  const items = ITEMS.map((it) => {
    const m = entry(it.files[0]);
    let present = false; try { const st = fs.statSync(fileOf(it, dir)); present = st.size > 0; } catch { present = false; }
    return { id: it.id, label: it.label, for: it.for, size: fmt((m && m.size) || 0), present, dflt: it.id === DEFAULT, rec: !!it.rec };
  });
  const have = items.filter((i) => i.present);
  return { installed: have.length > 0, items, select: true,
    note: have.length ? "in the LLM folder: " + have.map((i) => i.label.replace(/^★ /, "").replace(/ - the base for our checkpoint$/, "")).join(", ") + " - pick it in the prompt docker's LLM dropdown"
      : "none of these yet - the LLM folder: " + dir };
}

async function install(log, picks, deps) {
  const d = deps || {};
  const dir = d.dir || llmDir();
  const it = picked(picks);
  const m = entry(it.files[0]);
  if (!m) return { ok: false, error: it.files[0] + " is not in the model list" };
  try { fs.mkdirSync(dir, { recursive: true }); } catch (e) { return { ok: false, error: `the LLM folder ${dir}: ${e.message}` }; }
  const core = require("./core");
  const token = ((core.getConfig() || {}).hf || {}).token || "";
  const env = Object.assign({}, process.env, { PYTHONUTF8: "1", PIP_DISABLE_PIP_VERSION_CHECK: "1" });
  const place = inDir(m, dir);
  log(`[..] ${it.label.replace(/^★ /, "")}: ${m.repo}/${m.file} -> ${dir}`, false);
  const dl = d.download || ((mm, pp) => { let last = -1; return Models().download(mm, { token, paths: pp, python: require("./setupRun").appPython(), log, env, engine: "auto",
    onProgress: (p) => { const pc = p && p.total ? Math.floor((p.got / p.total) * 10) * 10 : -1; if (pc > last) { last = pc; log(`… ${path.basename(mm.file)} ${pc} %`, false); } } }); });
  const r = await dl(place.entry, place.paths);
  if (!r || !r.ok) return { ok: false, error: `${path.basename(m.file)}: ${(r && r.error) || "the download failed"}` };
  log(`[ok] ${path.basename(m.file)}${r.skipped ? " (already there)" : ""} is in the LLM folder - pick it in the prompt docker's LLM dropdown (or 🔁 Compare LLMs it with the others)`, false);
  if (/Qwen3\.8|gemma-4/i.test(m.file)) log("[ok] Qwen3.8 / Gemma 4 need a recent llama.cpp - if the LLM will not load, update it (get-llama.ps1, or Settings ▸ LLM)", false);
  if (it.base) log(`[ok] to build your own from it: 🎓 LoRA trainer ▸ an LLM job ▸ Base model "${it.base}" (the trainer downloads the original weights - a .gguf cannot be trained)`, false);
  return { ok: true };
}

async function remove(log, picks, deps) {
  const d = deps || {};
  const dir = d.dir || llmDir();
  const it = picked(picks);
  const f = fileOf(it, dir);
  if (!f || !fs.existsSync(f)) { log(`[ok] ${path.basename(f || it.id)} is not in the LLM folder`, false); return { ok: true }; }
  let running = ""; try { const st = require("./core").llamaState() || {}; running = st.proc ? String(st.file || "") : ""; } catch { running = ""; }
  if (running && path.basename(running) === path.basename(f)) return { ok: false, error: `${path.basename(f)} is the LLM running now - pick another in the LLM dropdown (or stop it) first` };
  try { fs.unlinkSync(f); log(`[ok] deleted ${f}`, false); } catch (e) { return { ok: false, error: `could not delete ${f}: ${e.message}` }; }
  return { ok: true };
}

module.exports = { ITEMS, DEFAULT, picked, inDir, status, install, remove, llmDir };
