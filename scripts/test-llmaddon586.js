#!/usr/bin/env node
/* bitGen Studio — scripts/test-llmaddon586.js (2.586.0): Settings ▸ Add-ons ▸ LLM - the chat / writing LLMs as one
 * dropdown (lib/llmAddon.js) and the trainer's base models (lib/finetunePresets.json).
 * Tim: "what would be the best llm base to build our checkpoint, add it as a download in addons in a dropdown called llm".
 * The items and their catalog files (the repos' file names, checked 23 Oct 2026), ★ Qwen3.8 27B UD-Q4_K_XL the default,
 * the file goes into the LLM folder (wherever Settings ▸ LLM points), one pick at a time, delete refuses the running
 * model, the add-on registered as a dropdown; the presets: Qwen3.8 27B = 4-bit QLoRA on Unsloth's checkpoint (FastModel),
 * Gemma 4 12B added, the small Qwen3.5 4B still the default for a new job. No network. */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };

const L = require("../lib/llmAddon");
const SM = require("../lib/setupModels");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "bg-llmaddon586-"));

(async () => {
  try {
    const cat = JSON.parse(fs.readFileSync(path.join(ROOT, "lib", "modelCatalog.json"), "utf8")).models;
    const by = (id) => cat.find((m) => m.id === id);
    check("every dropdown item is one catalog file: an LLM .gguf for the LLM folder", L.ITEMS.every((it) => it.files.length === 1 && by(it.files[0]) && by(it.files[0]).llm === true && by(it.files[0]).dest === "app/llm-models" && /\.gguf$/.test(by(it.files[0]).file)), L.ITEMS.map((i) => i.files[0]));
    check("the new files are the repos' own names (checked 23 Oct 2026)",
      by("llm_qwen38_q4xl").repo === "unsloth/Qwen3.8-27B-GGUF" && by("llm_qwen38_q4xl").file === "Qwen3.8-27B-UD-Q4_K_XL.gguf" && by("llm_qwen38_q8").file === "Qwen3.8-27B-Q8_0.gguf"
      && by("llm_gemma4_31b_q4xl").repo === "unsloth/gemma-4-31B-it-GGUF" && by("llm_gemma4_31b_q4xl").file === "gemma-4-31B-it-UD-Q4_K_XL.gguf"
      && by("llm_gemma4_12b_qat").file === "gemma-4-12B-it-qat-UD-Q4_K_XL.gguf" && by("llm_qwen35_9b_q8").file === "Qwen3.5-9B-Q8_0.gguf");
    check("★ Qwen3.8 27B UD-Q4_K_XL is the default and the recommended one; the old Qwen3 4B / 8B / 14B are there too",
      L.DEFAULT === "qwen38_q4xl" && L.ITEMS[0].id === "qwen38_q4xl" && /^★/.test(L.ITEMS[0].label) && ["qwen3_4b", "qwen3_8b", "qwen3_14b"].every((id) => L.ITEMS.some((i) => i.id === id)));
    check("picked: the dropdown's one (an unknown id = the default)", L.picked(["gemma4_12b"]).id === "gemma4_12b" && L.picked(["nope"]).id === "qwen38_q4xl" && L.picked(null).id === "qwen38_q4xl");
    const dir = path.join(tmp, "my llms");
    const pl = L.inDir(by("llm_gemma4_12b_qat"), dir);
    check("the file lands in the LLM folder itself, wherever Settings ▸ LLM points", SM.destPath(pl.entry, pl.paths) === path.join(dir, "gemma-4-12B-it-qat-UD-Q4_K_XL.gguf"));
    let st = L.status(dir);
    check("status: none there yet - not installed, a dropdown (select), nine items with sizes", !st.installed && st.select && st.items.length === 9 && st.items.every((i) => !i.present && i.size), st.items.slice(0, 2));
    const got = [], lines = [];
    const r = await L.install((l) => lines.push(l), ["gemma4_12b"], { dir, download: async (m, p) => { got.push([m.file, SM.destPath(m, p)]); fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(SM.destPath(m, p), "GGUF"); return { ok: true }; } });
    check("install: only the picked one, into the LLM folder; says to pick it in the LLM dropdown + the trainer's base + llama.cpp for Gemma 4",
      r.ok && got.length === 1 && got[0][0] === "gemma-4-12B-it-qat-UD-Q4_K_XL.gguf" && got[0][1] === path.join(dir, "gemma-4-12B-it-qat-UD-Q4_K_XL.gguf")
      && lines.some((l) => /LLM dropdown/.test(l)) && lines.some((l) => /Base model "gemma4_12b"/.test(l)) && lines.some((l) => /recent llama\.cpp/.test(l)), lines);
    st = L.status(dir);
    check("status: installed, the item marked present, said in the note", st.installed && st.items.find((i) => i.id === "gemma4_12b").present && /Gemma 4 12B/.test(st.note), st.note);
    check("a failed download is said", /the download failed|nope/.test((await L.install(() => {}, ["qwen3_4b"], { dir, download: async () => ({ ok: false, error: "nope" }) })).error || ""));
    const rm = await L.remove(() => {}, ["gemma4_12b"], { dir });
    check("remove: the picked one deleted", rm.ok && !fs.existsSync(path.join(dir, "gemma-4-12B-it-qat-UD-Q4_K_XL.gguf")));
    check("remove: one that is not there is fine", (await L.remove(() => {}, ["qwen3_8b"], { dir })).ok);
    const A = require("../lib/addons");
    const reg = A.LIST.find((a) => a.id === "llm");
    check("Settings ▸ Add-ons: \"LLM\" registered as a dropdown add-on; remove gets the pick", reg && reg.label === "LLM" && reg.select === true && /picks/.test(reg.remove.toString()) && /a\.remove\(opts \|\| \{\}\)/.test(fs.readFileSync(path.join(ROOT, "lib", "addons.js"), "utf8")));
    const UI = fs.readFileSync(path.join(ROOT, "static", "addons.js"), "utf8");
    check("the Add-ons tab draws a dropdown (data-aosel) with ✓ for what is there, ⤓ Download / 🗑 Delete it for the picked one, and sends {items: [pick]} for both",
      /data-aosel=/.test(UI) && /⤓ Download/.test(UI) && /🗑 Delete it/.test(UI) && /var sel = L\.querySelector\('\[data-aosel="' \+ id \+ '"\]'\); if \(sel\) return \[sel\.value\]/.test(UI) && /hasItems && \(action === "install" \|\| a\.select\)/.test(UI));

    // ---------------------------------------------------------------- the trainer's base models
    const FT = require("../lib/fineTune").FT.llm, q = FT.find((p) => p.id === "qwen38_27b"), g12 = FT.find((p) => p.id === "gemma4_12b"), g31 = FT.find((p) => p.id === "gemma4_31b");
    check("trainer: ★ Qwen3.8 27B = Unsloth's 4-bit checkpoint, FastModel, QLoRA only, 24 GB (Unsloth's Qwen3.8 guide), the #10010 fallback said",
      q && /^★/.test(q.label) && q.model === "unsloth/Qwen3.8-27B-unsloth-bnb-4bit" && q.loader === "model" && q.methods.join() === "qlora" && q.vram_gb === 24 && /10010/.test(q.note) && /Gemma 4 31B/.test(q.note), q);
    check("trainer: Gemma 4 12B added (QLoRA default, the VRAM said as an estimate); Gemma 4 31B checked (22 GB QLoRA); a new job still starts on Qwen3.5 4B",
      g12 && g12.model === "google/gemma-4-12B-it" && g12.method === "qlora" && /estimate/.test(g12.note) && g31.checked === true && FT[0].id === "qwen35_4b");
  } catch (e) { fail++; console.log("FAIL: crashed - " + (e && e.stack || e)); }
  finally { try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* fine */ } }
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
  process.exit(fail ? 1 : 0);
})();
