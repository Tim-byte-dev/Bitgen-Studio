// bitGen Studio — lib/fineTune.js (2.521.0): the trainer's FINE-TUNES beside its LoRAs (lib/loraTrain.js).
// Tim (verbatim): "can we add a checkpoint finetune option to the lora creator docker to build on existing llm, vision and
// image models? reccomend the best base models for the tasks"
//
//   LLM        the app's assistant: a base model (lib/finetunePresets.json - Qwen3.5 0.8B-9B, Gemma 4 E2B / E4B / 31B,
//              Qwen3.8 27B) trained on your own chats (dataset/chat.jsonl: {"messages": [{role, content}...]} - typed in
//              the docker or imported from JSONL / JSON / CSV) with Unsloth (LoRA, 4-bit QLoRA or every weight), merged
//              into a new model and written as a .gguf into the LLM folder (llm-models) - Settings -> LLM picks it
//   VISION     the app's vision model (lib/captioner.js): pictures + the answer you want for each (the picture grid's
//              text) + one instruction, trained with Unsloth's FastVisionModel; the .gguf + its mmproj land in
//              llm-models/vision/<name>/ (or the vision folder picked in Settings), where the captioner scans
//   ⧉ BAKE     a finished picture LoRA merged into its base model -> a NEW checkpoint (any card: ComfyUI does the merge
//              with CheckpointLoaderSimple / UNETLoader -> LoraLoader -> CheckpointSave / ModelSave), moved into
//              checkpoints/trained or diffusion_models/trained with the LoRA's card
//   (the picture FULL fine-tune - every weight - is ai-toolkit's: lib/loraTrain.js with a "full" preset)
//   ENGINE     Unsloth (Apache 2.0) in its own venv (venvs/unsloth, uv + --torch-backend=auto) + llama.cpp's source in
//              <app>/tools/llama.cpp for convert_hf_to_gguf.py (the app's llama-quantize makes the smaller files) -
//              ⚙ Install Unsloth is a queue job (finetune_worker.py install_unsloth)
// Pure (scripts/test-finetune521.js): FT, QUANTS, normalizeFt, buildFtConfig, parseChat, csvRows, chatStats, mergeGraph,
// ggufNames, validMessages; 2.585.0 validPref (+ normalizeFt objective / beta: SFT, DPO, ORPO - scripts/test-ftpref585.js).
"use strict";
const fs = require("fs");
const path = require("path");

const FTP = JSON.parse(fs.readFileSync(path.join(__dirname, "finetunePresets.json"), "utf8"));
const FT = { llm: FTP.llm, vision: FTP.vision };
const QUANTS = FTP.quants;
const KINDS = ["llm", "vision"];
const VISION_INSTRUCTION = "Describe this picture precisely: the subjects, their appearance and clothing, the setting, the light, the mood and any action.";
const TARGETS = ["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"];
const OBJECTIVES = ["sft", "dpo", "orpo"];

const num = (v, lo, hi, d) => { const x = Number(v); return Number.isFinite(x) ? Math.max(lo, Math.min(hi, x)) : d; };
const cleanName = (n) => String(n || "").trim().replace(/[^A-Za-z0-9_-]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 60);

/** the docker's settings for an LLM / vision job, cleaned (absent = the preset's / the default) */
function normalizeFt(s, kind) {
  const o = s || {};
  const k = KINDS.includes(kind) ? kind : KINDS.includes(o.kind) ? o.kind : "llm";
  const list = FT[k];
  const pre = list.find((p) => p.id === o.preset) || list[0];
  const method = pre.methods.includes(o.method) ? o.method : pre.method;
  // 2.585.0: what it learns from - sft = the answers you want (chat.jsonl); dpo / orpo = your choices, "this, not that"
  // (prefs.jsonl - 🔁 Compare LLMs ▸ 🏆 ▸ To the trainer). Preference training wants a much smaller learning rate.
  const objective = k === "llm" && OBJECTIVES.includes(o.objective) ? o.objective : "sft";
  const lrDefault = objective !== "sft" ? (method === "full" ? 0.000001 : 0.000005) : method === "full" ? Math.min(pre.lr, 0.00002) : pre.lr;
  return {
    name: cleanName(o.name), kind: k, preset: pre.id, model_path: String(o.model_path || "").trim().slice(0, 400), method,
    objective, beta: num(o.beta, 0.01, 1, 0.1),
    rank: Math.round(num(o.rank, 1, 256, 16)), alpha: Math.round(num(o.alpha, 1, 512, 16)),
    lr: num(o.lr, 0, 1, 0) || lrDefault,
    epochs: Math.round(num(o.epochs, 0, 100, 2)), max_steps: Math.round(num(o.max_steps, 0, 1000000, 0)),
    batch: Math.round(num(o.batch, 1, 16, 1)), grad_accum: Math.round(num(o.grad_accum, 1, 64, 4)),
    max_seq: Math.round(num(o.max_seq, 256, 32768, 2048)), warmup: Math.round(num(o.warmup, 0, 10000, 5)),
    save_every: Math.round(num(o.save_every, 0, 1000000, 0)),
    quant: QUANTS.includes(String(o.quant || "").toLowerCase()) ? String(o.quant).toLowerCase() : "q4_k_m",
    system: String(o.system || "").slice(0, 8000),
    instruction: k === "vision" ? (String(o.instruction || "").trim().slice(0, 4000) || VISION_INSTRUCTION) : "",
    device: /^(cuda:\d+|cpu)$/.test(String(o.device)) ? String(o.device) : "cuda:0",
    notes: String(o.notes || "").slice(0, 2000),
  };
}
/** the Unsloth run for these settings (scripts/ft_unsloth.py reads it): paths = {data, images, output} */
function buildFtConfig(settings, paths) {
  const s = normalizeFt(settings, settings && settings.kind);
  const pre = FT[s.kind].find((p) => p.id === s.preset);
  const P = paths || {};
  return {
    v: 1, kind: s.kind, name: s.name || "my_model", model: s.model_path || pre.model, loader: pre.loader, family: pre.family,
    method: s.method, load_in_4bit: s.method === "qlora", full_finetuning: s.method === "full",
    chat_template: pre.chat_template || "", max_seq_length: s.max_seq,
    lora: s.method === "full" ? null : { r: s.rank, alpha: s.alpha, dropout: 0, target_modules: TARGETS, vision_layers: s.kind === "vision", language_layers: true },
    train: { epochs: s.max_steps ? 0 : Math.max(1, s.epochs), max_steps: s.max_steps, lr: s.lr, batch: s.batch, grad_accum: s.grad_accum,
      warmup_steps: s.warmup, optimizer: "adamw_8bit", weight_decay: 0.01, scheduler: "linear", seed: 3407, save_steps: s.save_every, logging_steps: 1 },
    system: s.system, instruction: s.instruction,
    objective: s.objective, beta: s.beta,                       // 2.585.0: sft | dpo | orpo (scripts/ft_unsloth.py)
    prefs: String(P.prefs || "").replace(/\\/g, "/"),
    data: String(P.data || "").replace(/\\/g, "/"), images: String(P.images || "").replace(/\\/g, "/"), output_dir: String(P.output || "output").replace(/\\/g, "/"),
    export: { quant: s.quant },
    meta: { made_by: "bitGen Studio", preset: pre.id, base: pre.label },
  };
}
/** a CSV parser for the import (quotes, "" escapes, commas / newlines inside quotes) (pure) */
function csvRows(text) {
  const rows = []; let row = [], cell = "", q = false;
  const t = String(text || "").replace(/^﻿/, "");
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (q) {
      if (ch === '"') { if (t[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") { if (ch === "\r" && t[i + 1] === "\n") i++; row.push(cell); cell = ""; if (row.some((c) => c !== "")) rows.push(row); row = []; }
    else cell += ch;
  }
  row.push(cell); if (row.some((c) => c !== "")) rows.push(row);
  return rows;
}
const ROLE = { human: "user", user: "user", gpt: "assistant", assistant: "assistant", bot: "assistant", model: "assistant", system: "system" };
/** a message list that can train: roles user / assistant / system, text, at least one user + one assistant (pure) */
function validMessages(m) {
  if (!Array.isArray(m)) return null;
  const out = m.map((x) => ({ role: ROLE[String((x && (x.role || x.from)) || "").toLowerCase()] || "", content: String((x && (x.content != null ? x.content : x.value)) || "").trim() }))
    .filter((x) => x.role && x.content);
  return out.some((x) => x.role === "user") && out.some((x) => x.role === "assistant") ? out : null;
}
/** one record of any common shape -> {messages} | null (pure) */
function recordToChat(r) {
  if (!r || typeof r !== "object") return null;
  if (r.messages || r.conversations) { const m = validMessages(r.messages || r.conversations); return m ? { messages: m } : null; }
  const pick = (...ks) => { for (const k of ks) { const v = r[k]; if (v != null && String(v).trim()) return String(v).trim(); } return ""; };
  const user = pick("instruction", "prompt", "question", "user", "input_text", "human", "query");
  const extra = r.instruction != null ? pick("input", "context") : "";
  const ans = pick("output", "response", "answer", "assistant", "completion", "gpt", "reply");
  if (!user || !ans) return null;
  const sys = pick("system");
  const m = (sys ? [{ role: "system", content: sys }] : []).concat([{ role: "user", content: extra ? `${user}\n\n${extra}` : user }, { role: "assistant", content: ans }]);
  return { messages: m };
}
/** an import file (JSONL / JSON array / CSV with a header row) -> {chats, skipped, format} (pure) */
function parseChat(text, fileName) {
  const t = String(text || "").replace(/^﻿/, "").trim();
  const out = { chats: [], skipped: 0, format: "" };
  if (!t) return out;
  const fn = String(fileName || "").toLowerCase();
  const take = (r) => { const c = recordToChat(r); if (c) out.chats.push(c); else out.skipped++; };
  if (/\.csv$/.test(fn) || (!/^[[{]/.test(t) && /,/.test(t.split(/\r?\n/)[0]))) {
    const rows = csvRows(t);
    const head = (rows.shift() || []).map((h) => String(h).trim().toLowerCase());
    out.format = "csv";
    for (const r of rows) { const o = {}; head.forEach((h, i) => { o[h] = r[i]; }); take(o); }
    return out;
  }
  if (t[0] === "[") {
    out.format = "json";
    let arr = []; try { arr = JSON.parse(t); } catch { arr = null; }
    if (!Array.isArray(arr)) { out.skipped = 1; return out; }
    for (const r of arr) take(r);
    return out;
  }
  out.format = "jsonl";
  for (const line of t.split(/\r?\n/)) {
    if (!line.trim()) continue;
    let r = null; try { r = JSON.parse(line); } catch { r = null; }
    take(r);
  }
  return out;
}
function chatStats(list) {
  const l = Array.isArray(list) ? list : [];
  return { examples: l.length, turns: l.reduce((a, c) => a + ((c.messages || []).filter((m) => m.role === "assistant").length), 0),
    chars: l.reduce((a, c) => a + (c.messages || []).reduce((b, m) => b + m.content.length, 0), 0) };
}
/** the ComfyUI graph that bakes a LoRA into its base model and saves the result (pure)
 *  o = {cat: checkpoints | diffusion_models, base, lora, strength, prefix} */
function mergeGraph(o) {
  const st = Math.max(-2, Math.min(2, Number(o.strength) || 1));
  if (o.cat === "checkpoints") {
    return {
      1: { class_type: "CheckpointLoaderSimple", inputs: { ckpt_name: o.base } },
      2: { class_type: "LoraLoader", inputs: { model: ["1", 0], clip: ["1", 1], lora_name: o.lora, strength_model: st, strength_clip: st } },
      3: { class_type: "CheckpointSave", inputs: { model: ["2", 0], clip: ["2", 1], vae: ["1", 2], filename_prefix: o.prefix } },
    };
  }
  return {
    1: { class_type: "UNETLoader", inputs: { unet_name: o.base, weight_dtype: "default" } },
    2: { class_type: "LoraLoaderModelOnly", inputs: { model: ["1", 0], lora_name: o.lora, strength_model: st } },
    3: { class_type: "ModelSave", inputs: { model: ["2", 0], filename_prefix: o.prefix } },
  };
}
/** the files a GGUF export writes (pure) */
function ggufNames(name, quant) {
  const q = String(quant || "q4_k_m").toUpperCase();
  return { f16: `${name}-F16.gguf`, out: q === "F16" ? `${name}-F16.gguf` : `${name}-${q}.gguf`, mmproj: `mmproj-${name}-F16.gguf`, quant: q };
}

/* ---------------- live */
function core() { return require("./core"); }
function readJson(p, d) { try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return d; } }
/** Unsloth's venv + llama.cpp's converter */
function unsloth() {
  const c = core(), V = require("./venv");
  const v = V.venvReady("unsloth");
  const src = path.join(c.BASE, "tools", "llama.cpp");
  const ready = v.ready && fs.existsSync(path.join(v.dir, ".bitgen-installed"));
  return { venv: v.dir, python: v.python, ready, llama_src: src, convert: fs.existsSync(path.join(src, "convert_hf_to_gguf.py")), quantize: quantizeBin() };
}
function quantizeBin() {
  try { const e = core().llmPaths().eng; const q = path.join(e, process.platform === "win32" ? "llama-quantize.exe" : "llama-quantize"); return fs.existsSync(q) ? q : ""; } catch { return ""; }
}
function llmDir() { try { return core().llmPaths().dir; } catch { return path.join(core().BASE, "llm-models"); } }
function visionRoot() {
  const c = ((core().getConfig() || {}).captioner || {});
  const d = String(c.dir || "").trim().replace(/^["']+|["']+$/g, "").replace(/[\\/]+$/, "");
  if (d) return path.isAbsolute(d) ? d : path.join(core().BASE, d);
  return path.join(llmDir(), "vision");
}
function chatFile(jobDir) { return path.join(jobDir, "dataset", "chat.jsonl"); }
/* 2.585.0: PREFERENCE PAIRS - dataset/prefs.jsonl, one {prompt: [{role, content}...] (ends with the user's turn), chosen,
   rejected} per line (TRL's DPO / ORPO shape; 🔁 Compare LLMs fills it: the reply picked vs each one not picked) */
function prefsFile(jobDir) { return path.join(jobDir, "dataset", "prefs.jsonl"); }
/** a pair that can train (pure) */
function validPref(r) {
  if (!r || typeof r !== "object") return null;
  const p = Array.isArray(r.prompt) ? r.prompt : typeof r.prompt === "string" ? [{ role: "user", content: r.prompt }] : null;
  if (!p) return null;
  const msgs = p.map((x) => ({ role: ROLE[String((x && x.role) || "").toLowerCase()] || "", content: String((x && x.content) || "").trim() })).filter((x) => x.role && x.content);
  const txt = (v) => String(Array.isArray(v) ? ((v.find((x) => x && x.role === "assistant") || {}).content || "") : v || "").trim();
  const chosen = txt(r.chosen), rejected = txt(r.rejected);
  if (!msgs.length || msgs[msgs.length - 1].role !== "user" || !chosen || !rejected || chosen === rejected) return null;
  return { prompt: msgs, chosen, rejected };
}
function readPrefs(jobDir) {
  let t = ""; try { t = fs.readFileSync(prefsFile(jobDir), "utf8"); } catch { return []; }
  const out = [];
  for (const line of t.split(/\r?\n/)) { if (!line.trim()) continue; let r = null; try { r = JSON.parse(line); } catch { r = null; } const v = validPref(r); if (v) out.push(v); }
  return out;
}
function writePrefs(jobDir, list) {
  const ok = (Array.isArray(list) ? list : []).map(validPref).filter(Boolean).slice(0, 200000);
  fs.mkdirSync(path.dirname(prefsFile(jobDir)), { recursive: true });
  fs.writeFileSync(prefsFile(jobDir), ok.map((c) => JSON.stringify(c)).join("\n") + (ok.length ? "\n" : ""), "utf8");
  return ok.length;
}
function readChat(jobDir) {
  let t = ""; try { t = fs.readFileSync(chatFile(jobDir), "utf8"); } catch { return []; }
  return parseChat(t, "chat.jsonl").chats;
}
function writeChat(jobDir, list) {
  const ok = (Array.isArray(list) ? list : []).map((c) => { const m = validMessages(c && c.messages); return m ? { messages: m } : null; }).filter(Boolean).slice(0, 200000);
  fs.mkdirSync(path.dirname(chatFile(jobDir)), { recursive: true });
  fs.writeFileSync(chatFile(jobDir), ok.map((c) => JSON.stringify(c)).join("\n") + (ok.length ? "\n" : ""), "utf8");
  return ok.length;
}
function importChat(jobDir, text, fileName, replace) {
  const p = parseChat(text, fileName);
  const list = (replace ? [] : readChat(jobDir)).concat(p.chats);
  const n = writeChat(jobDir, list);
  return { added: p.chats.length, skipped: p.skipped, format: p.format, examples: n };
}
/** the files a finished fine-tune made (installed.json) */
function runInfo(jobDir) {
  const out = path.join(jobDir, "output");
  let ck = []; try { ck = fs.readdirSync(out).filter((f) => /^checkpoint-\d+$/.test(f)).sort((a, b) => +a.split("-")[1] - +b.split("-")[1]); } catch { ck = []; }
  return { checkpoints: ck, samples: [], final: fs.existsSync(path.join(out, "merged")) ? "merged" : null, installed: readJson(path.join(jobDir, "installed.json"), null) };
}
/** ▶ Start an LLM / vision fine-tune -> the queue job */
function start(n, s, d, imgs, cfgText) {
  const u = unsloth();
  if (!u.ready) { const e = new Error("Unsloth is not installed yet - ⚙ Install Unsloth first (a queue job, ~8 GB)"); e.status = 409; throw e; }
  let examples = 0;
  const pref = s.kind === "llm" && s.objective && s.objective !== "sft";
  if (pref) {                                                    // 2.585.0: DPO / ORPO learn from the pairs
    examples = readPrefs(d).length;
    if (!examples) { const e = new Error("no preference pairs yet - 🔁 Compare LLMs ▸ 🏆 ▸ To the trainer (or Dataset ▸ ⤒ From 🔁 Compare LLMs)"); e.status = 400; throw e; }
  } else if (s.kind === "llm") {
    examples = readChat(d).length;
    if (!examples) { const e = new Error("no chats yet - add examples in Dataset (type them or import a JSONL / CSV)"); e.status = 400; throw e; }
  } else {
    examples = (imgs || []).filter((x) => String(x.caption || "").trim()).length;
    if (!examples) { const e = new Error("no picture has an answer yet - write what the model should say under each picture"); e.status = 400; throw e; }
  }
  fs.writeFileSync(path.join(d, "config.json"), cfgText);
  const pre = FT[s.kind].find((p) => p.id === s.preset);
  const nm = ggufNames(n, s.quant);
  const dest = s.kind === "llm" ? llmDir() : path.join(visionRoot(), n);
  const job = core().makeJob({ mode: s.kind === "llm" ? "ft_llm" : "ft_vision", no_assets: true,
    prompt: `${s.kind === "llm" ? "LLM" : "Vision"} fine-tune ${n} (${pre.label.replace(/ - .*$/, "")}, ${s.method}${pref ? " " + s.objective.toUpperCase() : ""}, ${examples} ${pref ? "preference pairs" : s.kind === "llm" ? "chats" : "pictures"})`,
    ft: { name: n, kind: s.kind, config: path.join(d, "config.json"), python: u.python, job_dir: d, output: path.join(d, "output"),
          llama_src: u.llama_src, quantize: u.quantize, dest_dir: dest, files: nm, quant: s.quant, examples, base: pre.label, method: s.method,
          script: path.join(core().BASE, "scripts", "ft_unsloth.py") } });
  return { job: core().jobDict(job) };
}
/** ⚙ Install Unsloth (a queue job) */
function install() {
  const u = unsloth(), G = require("./setupGpu");
  let p = {}; try { p = G.detect(); } catch { p = {}; }
  const job = core().makeJob({ mode: "install_unsloth", prompt: "Install Unsloth (the LLM / vision fine-tuner)", no_assets: true,
    ft: { venv: u.venv, python: u.python, llama_src: u.llama_src, cuda: !!p.cuda } });
  return { job: core().jobDict(job) };
}
/** the base models a LoRA can be baked into: what ComfyUI has (checkpoints + diffusion_models) */
function bases() {
  let l = { models: [] }; try { l = require("./modelCards").list(); } catch { l = { models: [] }; }
  return (l.models || []).filter((m) => m.cat === "checkpoints" || m.cat === "diffusion_models")
    .map((m) => ({ cat: m.cat, name: m.name, family: m.family || m.type || "", size: m.size || 0 }));
}
function comfyInfo() {
  const c = core(), cc = ((c.getConfig().engine || {}).comfy || {});
  const dir = cc.dir ? c.resolvePath(cc.dir) : "";
  const outs = dir ? [path.join(dir, "output"), path.join(dir, "ComfyUI", "output")] : [];
  return { url: String(cc.url || "http://127.0.0.1:8188").replace(/\/+$/, ""), dir, outputs: outs };
}
/** ⧉ Bake the finished LoRA into a base model -> the queue job */
function merge(n, d, s, b) {
  const inst = readJson(path.join(d, "installed.json"), null);
  if (!inst || !inst.file) { const e = new Error("train the LoRA first - it is baked in once it is in ComfyUI's loras folder"); e.status = 400; throw e; }
  const want = b || {};
  const base = bases().find((m) => m.cat === want.cat && m.name === want.base);
  if (!base) { const e = new Error("pick the base model it was trained for (one of ComfyUI's checkpoints / diffusion models)"); e.status = 400; throw e; }
  const out = cleanName(want.out || `${n}_merged`);
  if (!out) { const e = new Error("a name for the new checkpoint"); e.status = 400; throw e; }
  const ci = comfyInfo();
  if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/i.test(ci.url)) { const e = new Error("baking needs this computer's ComfyUI (Settings -> Remote GPU -> This computer) - the new file is written into its folders"); e.status = 409; throw e; }
  let dest = "";
  try {
    const sc = require("./modelCards").comfyScan(), mi = require("./modelInstall");
    const t = mi.pickTarget((((sc.categories || {})[base.cat]) || {}).roots || []);
    dest = t ? path.join(t.dir, "trained") : "";
  } catch { dest = ""; }
  if (!dest) { const e = new Error(`no ComfyUI ${base.cat} folder found - Settings -> ComfyUI`); e.status = 409; throw e; }
  const lora = "trained/" + path.basename(inst.file);
  const prefix = `bitgen_bake/${out}`;
  const job = core().makeJob({ mode: "lora_merge", no_assets: true,
    prompt: `Bake LoRA ${n} into ${path.basename(base.name)} -> ${out} (strength ${Number(want.strength) || 1})`,
    ft: { name: n, out, cat: base.cat, base: base.name, lora, lora_file: inst.file, strength: Number(want.strength) || 1, prefix,
          graph: mergeGraph({ cat: base.cat, base: base.name, lora, strength: want.strength, prefix }),
          comfy_url: ci.url, comfy_outputs: ci.outputs, dest_dir: dest, job_dir: d, trigger: s.trigger || "", family: base.family } });
  return { job: core().jobDict(job) };
}

module.exports = { OBJECTIVES, prefsFile, validPref, readPrefs, writePrefs, FT, QUANTS, KINDS, VISION_INSTRUCTION, TARGETS, normalizeFt, buildFtConfig, csvRows, parseChat, validMessages, recordToChat, chatStats,
  mergeGraph, ggufNames, unsloth, quantizeBin, llmDir, visionRoot, chatFile, readChat, writeChat, importChat, runInfo, start, install, bases, comfyInfo, merge };
