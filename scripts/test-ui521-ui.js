#!/usr/bin/env node
/* bitGen Studio — 2.521.0 in a REAL browser: the trainer's FINE-TUNES end to end - 💬 an LLM fine-tune (typed + imported
 * chats -> ▶ -> a .gguf in the LLM folder), 👁 a vision fine-tune (pictures + answers -> .gguf + mmproj in the vision
 * folder), 🧱 a checkpoint fine-tune (ai-toolkit, diffusers shards joined into diffusion_models/trained) and ⧉ BAKE a LoRA
 * into a new checkpoint (through ComfyUI).
 * Tim (verbatim): "can we add a checkpoint finetune option to the lora creator docker to build on existing llm, vision and
 * image models? reccomend the best base models for the tasks"
 * Against the running app (H3_URL, default :8311) in THIS folder, with stand-ins: Unsloth (scripts/ftfixture521.js - the
 * REAL scripts/ft_unsloth.py and finetune_worker.py run), llama.cpp's converter, ai-toolkit (run.py) and a ComfyUI that
 * answers /prompt + /history. Each stand-in is made only when there is none and removed afterwards; every setting it
 * touches is put back; the files it made are deleted. */
"use strict";
const path = require("path"), fs = require("fs"), os = require("os"), http = require("http");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.521 browser test did not run"); process.exit(0); }
if (process.platform === "win32") { console.log("SKIP: the stand-in Unsloth venv is a POSIX shell script - the 2.521 browser test runs on Linux / macOS"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, cond, got) => { if (cond) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const api = async (u, body, method) => (await fetch(URL_ + u.replace(/^\//, ""), body === undefined && !method ? {} : { method: method || "POST", headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) })).json();
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAGUlEQVR4nGM8oaHBQApgIkn1qIZRDUNKAwCMLQE4ZidSiAAAAABJRU5ErkJggg==", "base64");
const J = { llm: "e2e_ft_llm", vis: "e2e_ft_vis", ck: "e2e_ft_ck", lo: "e2e_ft_lo" };

(async () => {
  const cfg0 = await api("/api/config");
  const comfy0 = Object.assign({}, (cfg0.engine || {}).comfy || {});
  const T = fs.mkdtempSync(path.join(os.tmpdir(), "bg521ui-"));
  const F = require("./mmfixture518.js").make(T);
  const FX = require("./ftfixture521.js").make(T);

  // a stand-in ComfyUI for ⧉ bake: /prompt writes what CheckpointSave / ModelSave would, /history says success
  const OUT = path.join(F.comfy, "output");
  const srv = http.createServer((q, s) => {
    let b = ""; q.on("data", (c) => { b += c; }); q.on("end", () => {
      s.setHeader("Content-Type", "application/json");
      if (q.url === "/system_stats") return s.end(JSON.stringify({ system: {}, devices: [] }));
      if (q.url === "/prompt") { const g = JSON.parse(b).prompt, pre = g[3].inputs.filename_prefix; fs.mkdirSync(path.join(OUT, path.dirname(pre)), { recursive: true }); fs.writeFileSync(path.join(OUT, pre + "_00001_.safetensors"), "baked:" + g[2].inputs.lora_name); return s.end(JSON.stringify({ prompt_id: "bake1" })); }
      if (q.url.startsWith("/history/")) return s.end(JSON.stringify({ bake1: { status: { status_str: "success", completed: true }, outputs: {} } }));
      s.end("{}");
    });
  });
  await new Promise((r) => srv.listen(0, "127.0.0.1", r));
  await api("/api/config", { engine: { comfy: { dir: F.comfy, url: "http://127.0.0.1:" + srv.address().port } } });

  // stand-ins: Unsloth's venv + llama.cpp's converter; ai-toolkit (LoRA + full fine-tune)
  const UV = path.join(ROOT, "venvs", "unsloth"), LS = path.join(ROOT, "tools", "llama.cpp"), AT = path.join(ROOT, "ai-toolkit"), AV = path.join(ROOT, "venvs", "aitoolkit");
  const made = { uv: !fs.existsSync(UV), ls: !fs.existsSync(LS), tools: !fs.existsSync(path.join(ROOT, "tools")), at: !fs.existsSync(AT), av: !fs.existsSync(AV) };
  if (made.uv) FX.venv(UV);
  if (made.ls) FX.llamaSrc(LS);
  if (made.at) {
    fs.mkdirSync(AT, { recursive: true });
    fs.writeFileSync(path.join(AT, "run.py"), [
      "import sys, os, time, re, json, struct, base64",
      "cfg = open(sys.argv[1]).read()",
      "name = re.search(r'name: \"([^\"]+)\"', cfg).group(1)",
      "tf = re.search(r'training_folder: \"([^\"]+)\"', cfg).group(1)",
      "steps = int(re.search(r'\\n\\s+steps: (\\d+)', cfg).group(1))",
      "out = os.path.join(tf, name); os.makedirs(os.path.join(out, 'samples'), exist_ok=True)",
      "for i in range(0, 101, 50):",
      "    sys.stdout.write(f'\\r{name}:  {i}%|##  | {i*steps//100}/{steps} [00:0{i//50}<00:10, 1.0it/s, loss: 3.{i}e-01]'); sys.stdout.flush(); time.sleep(0.3)",
      "print()",
      "if 'save_format: \"diffusers\"' in cfg:",
      "    d = os.path.join(out, name, 'transformer'); os.makedirs(d, exist_ok=True)",
      "    h = json.dumps({'w.weight': {'dtype': 'BF16', 'shape': [2], 'data_offsets': [0, 4]}}).encode()",
      "    open(os.path.join(d, 'diffusion_pytorch_model.safetensors'), 'wb').write(struct.pack('<Q', len(h)) + h + b'\\x01\\x02\\x03\\x04')",
      "else:",
      "    open(os.path.join(out, name + '.safetensors'), 'wb').write(b'lora')",
      `open(os.path.join(out, 'samples', '1730000000__000000050_0.png'), 'wb').write(base64.b64decode('${PNG.toString("base64")}'))`,
      "print('done training')", ""].join("\n"));
    fs.writeFileSync(path.join(AT, ".bitgen-installed"), "{}");
  }
  if (made.av) { fs.mkdirSync(path.join(AV, "bin"), { recursive: true }); fs.symlinkSync(FX.py3, path.join(AV, "bin", "python")); fs.writeFileSync(path.join(AV, "pyvenv.cfg"), "home = " + path.dirname(FX.py3) + "\n"); }
  const LLMDIR = path.join(ROOT, ((cfg0.llm || {}).dir) || "llm-models");
  const absLlm = path.isAbsolute(((cfg0.llm || {}).dir) || "") ? cfg0.llm.dir : LLMDIR;
  const visRoot = ((cfg0.captioner || {}).dir) ? cfg0.captioner.dir : path.join(absLlm, "vision");
  const madeFiles = [];

  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1900, height: 1150 } });
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  const ev = (f, a) => p.evaluate(f, a);
  const runText = () => ev(() => (document.getElementById("ltP_run") || {}).textContent || "");
  const newJob = async (name, kind) => {
    await ev((n) => { window.askText = () => n; }, name);
    await p.click("#ltNew"); await p.waitForTimeout(900);
    await p.selectOption("#ltKind", kind); await p.waitForTimeout(1200);
  };
  const addPictures = async (n) => {
    await p.click('.ltd [data-ltab="dataset"]'); await p.waitForTimeout(300);
    const files = [];
    for (let i = 1; i <= n; i++) { const f = path.join(T, `p${i}.png`); fs.writeFileSync(f, PNG); files.push(f); }
    await p.setInputFiles("#ltFile", files);
    await p.waitForFunction((k) => document.querySelectorAll("#ltDsGrid .lim").length >= k, n, { timeout: 15000 }).catch(() => {});
  };
  const startAndWait = async (doneRe, ms) => {
    await p.click('.ltd [data-ltab="run"]'); await p.waitForTimeout(500);
    await p.click("#ltStart");
    await p.waitForFunction((re) => new RegExp(re).test(((document.getElementById("ltP_run") || {}).querySelector(".lok") || {}).textContent || ""), doneRe, { timeout: ms || 90000 }).catch(() => {});
  };
  try {
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3LoraTrain && document.getElementById("ltBtn"), null, { timeout: 60000 });
    await p.waitForTimeout(1000);
    await p.click("#ltBtn");
    await p.waitForFunction(() => document.querySelectorAll("#ltJob option").length > 0 && document.getElementById("ltAitk").textContent.length > 0, null, { timeout: 30000 }).catch(() => {});
    const t0 = await ev(() => ({ title: document.querySelector("#sf-loratrain") ? document.querySelector("#sf-loratrain").textContent.slice(0, 40) : "" }));
    check("the docker is the 'LoRA & fine-tune trainer'", /LoRA & fine-tune trainer/i.test(t0.title), t0);

    /* ---- 💬 LLM */
    await newJob(J.llm, "llm");
    const f1 = await ev(() => ({ kinds: [...document.querySelectorAll("#ltKind option")].map((o) => o.value), pre: [...document.querySelectorAll("#ltPre option")].map((o) => o.textContent), method: [...document.querySelectorAll("#ltMethod option")].map((o) => o.value), eng: document.getElementById("ltAitk").textContent, q: document.getElementById("ltQ").value }));
    check("Type -> 💬 LLM fine-tune: Qwen3.5 4B ★ first, Gemma 4, Qwen3.8; Method LoRA / full; Q4_K_M; Unsloth ✓ (the stand-in)",
      f1.kinds.join() === "lora,ckpt,llm,vision" && /^★ Qwen3\.5 4B/.test(f1.pre[0]) && f1.pre.some((t) => /Gemma 4 E4B/.test(t)) && f1.pre.some((t) => /Qwen3\.8 27B/.test(t)) && f1.method.join() === "lora,full" && f1.q === "q4_k_m" && /Unsloth ✓/.test(f1.eng), f1);
    await p.fill("#ltMax", "6"); await p.fill("#ltSys", "You are bitGen's helper."); await p.click("#ltSaveBtn"); await p.waitForTimeout(700);
    await p.click('.ltd [data-ltab="dataset"]'); await p.waitForTimeout(400);
    const d1 = await ev(() => ({ chat: getComputedStyle(document.getElementById("ltDsChat")).display !== "none", pics: getComputedStyle(document.getElementById("ltDsPics")).display === "none" }));
    check("Dataset for an LLM job is the chat editor (no picture grid)", d1.chat && d1.pics, d1);
    await p.click("#ltChatAdd"); await p.waitForTimeout(300);
    await p.fill("#ltChatList .lchat:first-child textarea[data-ct='0']", "How do I add a fade?");
    await p.fill("#ltChatList .lchat:first-child textarea[data-ct='1']", "Select the clip, then Effects -> Fade in.");
    await p.waitForTimeout(1200);
    const c1 = await api("/api/loratrain/chat/" + J.llm);
    check("＋ Example: typed into 'They ask' / 'It answers' and saved by itself", Array.isArray(c1) && c1.length === 1 && c1[0].messages[1].content === "Select the clip, then Effects -> Fade in.", c1);
    const imp = path.join(T, "more.jsonl");
    fs.writeFileSync(imp, [JSON.stringify({ instruction: "Name a colour", output: "Tiger orange." }), JSON.stringify({ conversations: [{ from: "human", value: "Hi" }, { from: "gpt", value: "Hello!" }] }), "{oops"].join("\n"));
    await p.setInputFiles("#ltChatFile", imp); await p.waitForTimeout(1500);
    const m1 = await ev(() => ({ msg: document.getElementById("ltMsg").textContent, n: document.querySelectorAll("#ltChatList .lchat").length, info: document.getElementById("ltChatInfo").textContent }));
    check("⤒ Import a JSONL: 2 added (instruction / output + ShareGPT), 1 skipped, 3 in all", /2 examples from more\.jsonl \(jsonl\) · 1 skipped/.test(m1.msg) && m1.n === 3 && /^3 examples/.test(m1.info), m1);
    await startAndWait("the model is in the LLM folder");
    const r1 = await runText();
    const g1 = path.join(absLlm, J.llm + "-F16.gguf"), g1q = path.join(absLlm, J.llm + "-Q4_K_M.gguf");
    const got1 = fs.existsSync(g1q) ? g1q : g1;
    if (fs.existsSync(got1)) madeFiles.push(got1);
    check("▶ Start the fine-tune: the queue runs the real ft_unsloth.py ([ft] step N/M, loss) and the converter - '✓ the model is in the LLM folder'",
      /✓ the model is in the LLM folder/.test(r1) && /\[ft\] step 6\/6 loss/.test(r1) && fs.existsSync(got1) && fs.readFileSync(got1).slice(0, 4).toString() === "GGUF", r1.slice(0, 700));
    check("…in the LLM folder as <name>-Q4_K_M.gguf, or the F16 with a word why (no llama-quantize here)", fs.existsSync(g1q) || /no llama-quantize/.test(r1), r1.slice(-400));

    /* ---- 👁 vision */
    await newJob(J.vis, "vision");
    const f2 = await ev(() => ({ pre: document.getElementById("ltPre").options[0].textContent, instr: document.getElementById("ltInstr").value }));
    check("Type -> 👁 Vision fine-tune: Qwen3.5 4B vision ★ first, the instruction filled in", /^★ Qwen3\.5 4B vision/.test(f2.pre) && /^Describe this picture/.test(f2.instr), f2);
    await p.fill("#ltInstr", "Caption this for a storyboard."); await p.fill("#ltMax", "2"); await p.click("#ltSaveBtn"); await p.waitForTimeout(600);
    await addPictures(2);
    const ph = await ev(() => (document.querySelector("#ltDsGrid textarea[data-cap]") || {}).placeholder || "");
    check("its pictures ask for 'the answer the vision model should give'", /the answer the vision model should give/.test(ph), ph);
    await p.fill("#ltDsGrid .lim:nth-child(1) textarea[data-cap]", "A red square on black."); await p.dispatchEvent("#ltDsGrid .lim:nth-child(1) textarea[data-cap]", "change");
    await p.fill("#ltDsGrid .lim:nth-child(2) textarea[data-cap]", "Another red square."); await p.dispatchEvent("#ltDsGrid .lim:nth-child(2) textarea[data-cap]", "change");
    await p.waitForTimeout(800);
    await startAndWait("the vision model is in");
    const r2 = await runText();
    const vdir = path.join(visRoot, J.vis);
    const vf = fs.existsSync(vdir) ? fs.readdirSync(vdir) : [];
    check("▶ the vision fine-tune: '✓ the vision model is in … (+ its mmproj)'; the .gguf + mmproj in the vision folder where the captioner scans",
      /the vision model is in .*\+ its mmproj/.test(r2) && vf.some((f) => /^e2e_ft_vis-(F16|Q4_K_M)\.gguf$/.test(f)) && vf.includes("mmproj-e2e_ft_vis-F16.gguf"), { r2: r2.slice(0, 400), vf });

    /* ---- 🧱 checkpoint fine-tune */
    await newJob(J.ck, "ckpt");
    const f3 = await ev(() => ({ pre: [...document.querySelectorAll("#ltPre option")].map((o) => o.value), opt: document.getElementById("ltOpt").disabled, swap: !!document.getElementById("ltSwap"), rank: !!document.getElementById("ltRank") }));
    check("Type -> 🧱 Checkpoint fine-tune: Lumina 2 / Flex.1 / FLUX.2 klein / SDXL full presets; adafactor (fixed); parameter swapping; no LoRA rank",
      f3.pre.join() === "lumina2_ft,flex1_ft,flux2_klein_4b_ft,sdxl_ft" && f3.opt && f3.swap && !f3.rank, f3);
    await p.fill("#ltSteps", "100"); await p.click("#ltSaveBtn"); await p.waitForTimeout(600);
    const y3 = await api("/api/loratrain/yaml/" + J.ck);
    check("its YAML has no network block, saves in diffusers format, trains with adafactor", !/network:/.test(y3.yaml || "") && /save_format: "diffusers"/.test(y3.yaml || "") && /optimizer: "adafactor"/.test(y3.yaml || ""), (y3.yaml || "").slice(0, 300));
    await addPictures(2);
    await startAndWait("the fine-tuned model is in ComfyUI");
    const r3 = await runText();
    const ckf = path.join(F.comfy, "models", "diffusion_models", "trained", J.ck + ".safetensors");
    let hdr = null; try { const buf = fs.readFileSync(ckf); hdr = JSON.parse(buf.slice(8, 8 + Number(buf.readBigUInt64LE(0))).toString()); } catch { hdr = null; }
    check("▶ the full fine-tune: the diffusers save joined into ONE .safetensors in ComfyUI's diffusion_models/trained (+ its card)",
      /fine-tuned model is in ComfyUI/.test(r3) && hdr && hdr["w.weight"] && fs.existsSync(ckf.replace(/\.safetensors$/, ".bitgen.json")), { r3: r3.slice(0, 300), hdr });

    /* ---- 🎨 LoRA -> ⧉ bake */
    await newJob(J.lo, "lora");
    await p.selectOption("#ltPre", "sdxl"); await p.waitForTimeout(800);
    await p.fill("#ltTrig", "b4k"); await p.fill("#ltSteps", "100"); await p.click("#ltSaveBtn"); await p.waitForTimeout(600);
    await addPictures(2);
    await startAndWait("the LoRA is in ComfyUI");
    await p.waitForFunction(() => document.querySelectorAll("#ltBBase option").length > 0 && document.getElementById("ltBBase").value, null, { timeout: 20000 }).catch(() => {});
    const bk = await ev(() => ({ panel: !!document.getElementById("ltBake"), opts: [...document.querySelectorAll("#ltBBase option")].map((o) => o.textContent), out: document.getElementById("ltBOut").value }));
    check("a finished picture LoRA offers ⧉ Bake into a new checkpoint: ComfyUI's checkpoints + diffusion models, the SDXL ones ★ first; name <job>_merged",
      bk.panel && /^★ /.test(bk.opts[0]) && /checkpoint, sdxl/i.test(bk.opts[0]) && bk.opts.some((o) => /diffusion model/.test(o)) && bk.out === J.lo + "_merged", bk);
    await p.fill("#ltBStr", "0.8");
    await p.click("#ltBGo");
    await p.waitForFunction(() => /\[bake\] the new/.test((document.getElementById("ltP_run") || {}).textContent || ""), null, { timeout: 60000 }).catch(() => {});
    const r4 = await runText();
    const bkf = fs.existsSync(path.join(F.comfy, "models", "checkpoints", "trained")) ? fs.readdirSync(path.join(F.comfy, "models", "checkpoints", "trained")) : [];
    let bcard = null; try { bcard = JSON.parse(fs.readFileSync(path.join(F.comfy, "models", "checkpoints", "trained", J.lo + "_merged.bitgen.json"), "utf8")); } catch { bcard = null; }
    check("⧉ Bake: ComfyUI merges + saves; the new checkpoint is moved into checkpoints/trained with a card (strength 0.8, the trigger)",
      /\[bake\] the new checkpoint is in ComfyUI's checkpoints folder/.test(r4) && bkf.includes(J.lo + "_merged.safetensors") && bcard && /strength 0\.8/.test(bcard.user.description) && bcard.user.keywords[0] === "b4k"
      && fs.readFileSync(path.join(F.comfy, "models", "checkpoints", "trained", J.lo + "_merged.safetensors"), "utf8") === "baked:trained/" + J.lo + ".safetensors", { r4: r4.slice(0, 500), bkf });

    /* ---- the usage log names them */
    const u = await api("/api/usage");
    const whats = (u.jobs || []).map((x) => x.what);
    check("the usage log lists them: Fine-tune <llm> / <vision> / <checkpoint>, LoRA <lora>, Bake <lora>",
      [`Fine-tune ${J.llm}`, `Fine-tune ${J.vis}`, `Fine-tune ${J.ck}`, `LoRA ${J.lo}`, `Bake ${J.lo}`].every((w) => whats.includes(w)), whats.slice(0, 10));
    check("no page errors", errs.length === 0, errs);
  } catch (e) {
    check("the run did not throw", false, String(e && e.stack || e).slice(0, 700));
  } finally {
    await b.close().catch(() => {});
    srv.close();
    for (const n of Object.values(J)) await api("/api/loratrain/job/" + n, undefined, "DELETE").catch(() => {});
    await api("/api/config", { engine: { comfy: comfy0 } }).catch(() => {});
    for (const f of madeFiles) fs.rmSync(f, { force: true });
    for (const f of [path.join(absLlm, J.llm + "-F16.gguf"), path.join(absLlm, J.llm + "-Q4_K_M.gguf")]) fs.rmSync(f, { force: true });
    fs.rmSync(path.join(visRoot, J.vis), { recursive: true, force: true });
    if (made.uv) fs.rmSync(UV, { recursive: true, force: true });
    if (made.ls) fs.rmSync(LS, { recursive: true, force: true });
    if (made.tools) fs.rmSync(path.join(ROOT, "tools"), { recursive: true, force: true });
    if (made.at) fs.rmSync(AT, { recursive: true, force: true });
    if (made.av) fs.rmSync(AV, { recursive: true, force: true });
    fs.rmSync(T, { recursive: true, force: true });
  }
  console.log(`RESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
