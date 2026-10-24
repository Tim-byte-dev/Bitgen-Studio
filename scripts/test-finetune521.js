#!/usr/bin/env node
/* bitGen Studio — 2.521.0 units: the trainer's FINE-TUNES - checkpoint (picture, ai-toolkit full fine-tune), LLM and
 * vision (Unsloth: lib/fineTune.js, scripts/ft_unsloth.py, finetune_worker.py) and ⧉ BAKE a LoRA into a checkpoint.
 * Tim (verbatim): "can we add a checkpoint finetune option to the lora creator docker to build on existing llm, vision and
 * image models? reccomend the best base models for the tasks"
 * The REAL ft_unsloth.py runs against a stand-in Unsloth (scripts/ftfixture521.js - no GPU); the GGUF step against a
 * stand-in convert_hf_to_gguf.py + llama-quantize; the bake against a stand-in ComfyUI (/prompt, /history); the full
 * fine-tune's shard join against real .safetensors files. Not run here: real training on a GPU. */
"use strict";
const fs = require("fs"), os = require("os"), path = require("path"), http = require("http"), { spawnSync } = require("child_process");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, cond, got) => { if (cond) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 800))); } };
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
const FTM = require("../lib/fineTune.js"), LT = require("../lib/loraTrain.js"), UI = require("../static/loratrain.js");
const PY = process.platform === "win32" ? "python" : "python3";
const T = fs.mkdtempSync(path.join(os.tmpdir(), "ft521-"));
const py = (code, ...args) => spawnSync(PY, ["-c", "import sys,json; sys.dont_write_bytecode = True; sys.path.insert(0, sys.argv[1]); sys.path.insert(0, sys.argv[1] + '/misc');\n" + code, ROOT, ...args], { encoding: "utf8" });

(async () => {
  /* ---- the base models */
  const L = FTM.FT.llm, V = FTM.FT.vision;
  check("LLM base models: Qwen3.5 0.8B / 2B / 4B / 9B, Gemma 4 E2B / E4B / 31B, Qwen3.8 27B - Qwen3.5 4B first",
    L[0].id === "qwen35_4b" && ["qwen35_9b", "qwen35_2b", "qwen35_0_8b", "gemma4_e4b", "gemma4_e2b", "gemma4_31b", "qwen38_27b"].every((i) => L.some((p) => p.id === i)), L.map((p) => p.id));
  check("vision base models: Qwen3.5 4B / 9B / 2B, Gemma 4 E4B / E2B - Qwen3.5 4B first", V[0].id === "qwen35_4b_vl" && V.length === 5 && V.every((p) => p.loader === "vision"), V.map((p) => p.id));
  check("each has a repo, a loader, VRAM, methods incl. its default, a licence; ★ recommended ones exist for both",
    L.concat(V).every((p) => p.model && ["language", "model", "vision"].includes(p.loader) && p.vram_gb > 0 && p.methods.includes(p.method) && p.licence) && L.some((p) => p.rec) && V.some((p) => p.rec));
  check("Qwen3.5 trains in 16-bit (no QLoRA - Unsloth's advice); Gemma 4 31B only as QLoRA", L.filter((p) => p.family === "qwen3.5").every((p) => !p.methods.includes("qlora")) && L.find((p) => p.id === "gemma4_31b").methods.join() === "qlora");
  const PRE = LT.PRESETS;
  check("picture full fine-tune presets: Lumina 2 (checked), Flex.1 (checked), FLUX.2 klein 4B + SDXL (experimental, flagged)",
    ["lumina2_ft", "flex1_ft"].every((i) => PRE.find((p) => p.id === i && p.full && p.checked)) && ["flux2_klein_4b_ft", "sdxl_ft"].every((i) => PRE.find((p) => p.id === i && p.full && p.checked === false)), PRE.filter((p) => p.full).map((p) => [p.id, p.checked]));
  check("a FLUX.2 klein base 4B LoRA preset (arch flux2_klein_4b, BFL's repo, 1e-4, ~1800 steps)", (() => { const k = PRE.find((p) => p.id === "flux2_klein_4b"); return k && !k.full && k.model.arch === "flux2_klein_4b" && k.model.name_or_path === "black-forest-labs/FLUX.2-klein-base-4B" && k.train.lr === 0.0001 && k.train.steps === 1800; })());

  /* ---- normalize */
  const n0 = FTM.normalizeFt({}, "llm");
  check("normalizeFt(llm): Qwen3.5 4B, LoRA 16-bit, 2e-4, 2 epochs, rank 16, 2048 tokens, Q4_K_M", n0.kind === "llm" && n0.preset === "qwen35_4b" && n0.method === "lora" && n0.lr === 0.0002 && n0.epochs === 2 && n0.rank === 16 && n0.max_seq === 2048 && n0.quant === "q4_k_m", n0);
  const n1 = FTM.normalizeFt({ preset: "qwen35_9b", method: "full", quant: "EVIL", max_seq: 99, batch: 99, name: "a b" }, "llm");
  check("normalizeFt: a method the model can't do -> its own; quant allow-listed; numbers clamped; name made safe", n1.method === "lora" && n1.quant === "q4_k_m" && n1.max_seq === 256 && n1.batch === 16 && n1.name === "a_b", n1);
  const n2 = FTM.normalizeFt({ preset: "qwen35_2b", method: "full" }, "llm");
  check("normalizeFt: a full fine-tune starts from a small learning rate (2e-5)", n2.method === "full" && n2.lr === 0.00002, n2);
  check("normalizeFt(vision): the instruction defaults to a describe question", FTM.normalizeFt({}, "vision").instruction === FTM.VISION_INSTRUCTION && FTM.normalizeFt({ instruction: "  Caption it  " }, "vision").instruction === "Caption it");
  check("loraTrain.normalize: kind llm / vision goes to fineTune; ckpt picks a full preset; lora never a full one",
    LT.normalize({ kind: "llm" }).preset === "qwen35_4b" && LT.normalize({ kind: "vision" }).preset === "qwen35_4b_vl" && LT.normalize({ kind: "ckpt" }).preset === "lumina2_ft"
    && LT.normalize({ kind: "lora", preset: "flex1_ft" }).preset === "zimage_turbo" && LT.normalize({ kind: "nope" }).kind === "lora");
  check("ckpt: the optimizer is the preset's (adafactor), parameter swapping only for a full preset", LT.normalize({ kind: "ckpt", optimizer: "adamw8bit" }).optimizer === "adafactor" && LT.normalize({ kind: "lora", param_swap: true }).param_swap === false);

  /* ---- the configs */
  const c1 = FTM.buildFtConfig({ kind: "llm", name: "me", preset: "gemma4_e4b", method: "qlora", max_steps: 120, system: "Be brief." }, { data: "C:\\j\\dataset\\chat.jsonl", output: "C:\\j\\output" });
  check("buildFtConfig: model, loader, 4-bit for QLoRA, LoRA r/alpha + targets, the chat template, max_steps (epochs 0), paths with /",
    c1.model === "unsloth/gemma-4-E4B-it" && c1.loader === "model" && c1.load_in_4bit === true && c1.full_finetuning === false && c1.lora.r === 16 && c1.lora.target_modules.includes("gate_proj")
    && c1.chat_template === "gemma-4" && c1.train.max_steps === 120 && c1.train.epochs === 0 && c1.data === "C:/j/dataset/chat.jsonl" && c1.output_dir === "C:/j/output" && c1.system === "Be brief.", c1);
  const c2 = FTM.buildFtConfig({ kind: "llm", preset: "qwen35_0_8b", model_path: "D:\\models\\mine" }, {});
  check("buildFtConfig: full fine-tune = no LoRA block, full_finetuning; your own model path wins", c2.lora === null && c2.full_finetuning === true && c2.model === "D:\\models\\mine", c2);
  const c3 = FTM.buildFtConfig({ kind: "vision", preset: "qwen35_4b_vl" }, { images: "/j/dataset" });
  check("buildFtConfig(vision): FastVisionModel, vision layers trained, the instruction, the picture folder", c3.loader === "vision" && c3.lora.vision_layers === true && c3.instruction === FTM.VISION_INSTRUCTION && c3.images === "/j/dataset");
  const pf = LT.buildConfig({ kind: "ckpt", preset: "flex1_ft", param_swap: true, swap_factor: 0.5, trigger: "zz" }, { dataset: "d", training_folder: "o" }).config.process[0];
  check("ai-toolkit full fine-tune: NO network block, saved in diffusers format (bf16), adafactor, EMA, parameter swapping when ticked",
    !("network" in pf) && pf.save.save_format === "diffusers" && pf.save.dtype === "bf16" && pf.train.optimizer === "adafactor" && pf.train.ema_config.use_ema === true
    && pf.train.do_paramiter_swapping === true && pf.train.paramiter_swapping_factor === 0.5 && pf.model.only_if_contains.length === 2 && pf.train.bypass_guidance_embedding === true, pf);
  const pl = LT.buildConfig({ kind: "lora", preset: "sdxl" }, {}).config.process[0];
  check("…a LoRA still has its network and no diffusers save", pl.network && pl.network.type === "lora" && !pl.save.save_format && !pl.train.do_paramiter_swapping);
  const hasYaml = spawnSync(PY, ["-c", "import yaml"]).status === 0;
  if (hasYaml) {
    const ok = PRE.filter((p) => p.full).every((p) => {
      fs.writeFileSync(path.join(T, "f.yaml"), LT.toYaml(LT.buildConfig({ kind: "ckpt", preset: p.id }, { dataset: "d", training_folder: "o" })));
      return spawnSync(PY, ["-c", "import yaml,sys; d=yaml.safe_load(open(sys.argv[1])); p=d['config']['process'][0]; assert 'network' not in p and p['save']['save_format']=='diffusers' and isinstance(p['train']['lr'], float)", path.join(T, "f.yaml")]).status === 0;
    });
    check("every full fine-tune config parses in PyYAML (lr a number, no network)", ok);
  }

  /* ---- importing chats */
  const P = FTM.parseChat([
    JSON.stringify({ messages: [{ role: "system", content: "s" }, { role: "user", content: "q1" }, { role: "assistant", content: "a1" }] }),
    JSON.stringify({ conversations: [{ from: "human", value: "q2" }, { from: "gpt", value: "a2" }] }),
    JSON.stringify({ instruction: "Translate", input: "hola", output: "hello" }),
    JSON.stringify({ prompt: "p", completion: "c" }),
    JSON.stringify({ question: "why", answer: "because" }),
    JSON.stringify({ user: "only a question" }), "not json", "",
  ].join("\n"), "x.jsonl");
  check("parseChat JSONL: messages, ShareGPT conversations, instruction / input / output, prompt / completion, question / answer; 2 skipped",
    P.format === "jsonl" && P.chats.length === 5 && P.skipped === 2 && P.chats[1].messages[0].role === "user" && P.chats[2].messages[0].content === "Translate\n\nhola" && P.chats[3].messages[1].content === "c", P);
  const J = FTM.parseChat("\uFEFF" + JSON.stringify([{ prompt: "a", response: "b" }, { foo: 1 }]), "x.json");
  check("parseChat JSON array (with a BOM)", J.format === "json" && J.chats.length === 1 && J.skipped === 1, J);
  const C = FTM.parseChat('instruction,output\n"Say ""hi""","Hi, there\nfriend"\nplain,answer\n', "x.csv");
  check("parseChat CSV: a header row, quotes, \"\" escapes, commas and newlines inside quotes", C.format === "csv" && C.chats.length === 2 && C.chats[0].messages[0].content === 'Say "hi"' && C.chats[0].messages[1].content === "Hi, there\nfriend", C);
  check("csvRows: CRLF and a trailing newline", JSON.stringify(FTM.csvRows("a,b\r\n1,2\r\n")) === JSON.stringify([["a", "b"], ["1", "2"]]));
  check("validMessages: roles mapped, empty turns dropped, needs a user AND an answer", FTM.validMessages([{ role: "Human", content: "x" }, { role: "bot", content: " y " }, { role: "user", content: "" }]).length === 2
    && FTM.validMessages([{ role: "user", content: "x" }]) === null && FTM.validMessages("x") === null);
  check("chatStats", JSON.stringify(FTM.chatStats(P.chats)) === JSON.stringify({ examples: 5, turns: 5, chars: P.chats.reduce((a, c) => a + c.messages.reduce((b, m) => b + m.content.length, 0), 0) }));
  // the docker's own JSONL round trips through the importer
  const jl = UI.chatToJsonl([{ messages: [{ role: "user", content: "q" }, { role: "assistant", content: "a" }] }, { messages: [{ role: "user", content: "" }, { role: "assistant", content: "" }] }]);
  check("the docker's chatToJsonl (empty examples left out) reads back with parseChat", jl.split("\n").length === 1 && FTM.parseChat(jl, "chat.jsonl").chats.length === 1, jl);

  /* ---- bake graph + names */
  const g1 = FTM.mergeGraph({ cat: "checkpoints", base: "sdxl/base.safetensors", lora: "trained/me.safetensors", strength: 0.8, prefix: "bitgen_bake/me_m" });
  check("mergeGraph(checkpoint): CheckpointLoaderSimple -> LoraLoader (model + clip) -> CheckpointSave (model, clip, the base's VAE)",
    g1[1].class_type === "CheckpointLoaderSimple" && g1[2].class_type === "LoraLoader" && g1[2].inputs.strength_clip === 0.8 && g1[3].class_type === "CheckpointSave" && JSON.stringify(g1[3].inputs.vae) === '["1",2]' && g1[3].inputs.filename_prefix === "bitgen_bake/me_m", g1);
  const g2 = FTM.mergeGraph({ cat: "diffusion_models", base: "z.safetensors", lora: "trained/me.safetensors", strength: 9, prefix: "p" });
  check("mergeGraph(diffusion model): UNETLoader -> LoraLoaderModelOnly -> ModelSave; strength clamped to 2", g2[1].class_type === "UNETLoader" && g2[2].class_type === "LoraLoaderModelOnly" && g2[2].inputs.strength_model === 2 && g2[3].class_type === "ModelSave", g2);
  check("ggufNames", JSON.stringify(FTM.ggufNames("me", "q5_k_m")) === JSON.stringify({ f16: "me-F16.gguf", out: "me-Q5_K_M.gguf", mmproj: "mmproj-me-F16.gguf", quant: "Q5_K_M" }) && FTM.ggufNames("me", "f16").out === "me-F16.gguf");

  /* ---- the docker's pure parts */
  const st = { presets: PRE, ft: FTM.FT };
  check("presetsOf: lora = the LoRA presets, ckpt = the full ones, llm / vision = Unsloth's", UI.presetsOf(st, "lora").every((p) => !p.full) && UI.presetsOf(st, "ckpt").every((p) => p.full) && UI.presetsOf(st, "llm") === L && UI.presetsOf(st, "vision") === V);
  check("kindOf / isFt / KINDS", UI.kindOf({ kind: "llm" }) === "llm" && UI.kindOf({ settings: { kind: "ckpt" } }) === "ckpt" && UI.kindOf({}) === "lora" && UI.isFt("vision") && !UI.isFt("ckpt") && UI.KINDS.map((k) => k.id).join() === "lora,ckpt,llm,vision");
  check("doneText per kind", /LLM folder: a\.gguf - Settings -> LLM/.test(UI.doneText("llm", { file: "a.gguf" })) && /\+ its mmproj/.test(UI.doneText("vision", { file: "v.gguf", mmproj: "m.gguf" })) && /no mmproj/.test(UI.doneText("vision", { file: "v.gguf" }))
    && /Load Diffusion Model/.test(UI.doneText("ckpt", { file: "x" })) && UI.doneText("lora", null) === "");

  /* ---- Python: the shard join (lora_worker.merge_safetensors / find_diffusers / finish_full) */
  const mk = py(`
import os, struct
def st(path, tensors):
    head, off, data = {}, 0, b""
    for k, (dt, shape, b) in tensors.items():
        head[k] = {"dtype": dt, "shape": shape, "data_offsets": [off, off + len(b)]}; off += len(b); data += b
    head["__metadata__"] = {"format": "pt"}
    hb = json.dumps(head).encode()
    open(path, "wb").write(struct.pack("<Q", len(hb)) + hb + data)
T = sys.argv[2]
out = os.path.join(T, "output", "me")
for sub in ("me_000000250", "me"):
    d = os.path.join(out, sub, "transformer"); os.makedirs(d, exist_ok=True)
    st(os.path.join(d, "diffusion_pytorch_model-00001-of-00002.safetensors"), {"a.weight": ("BF16", [2], b"\\x01\\x02\\x03\\x04"), "b.weight": ("F32", [1], b"\\x05\\x06\\x07\\x08")})
    st(os.path.join(d, "diffusion_pytorch_model-00002-of-00002.safetensors"), {"c.weight": ("F16", [3], b"\\x09\\x0a\\x0b\\x0c\\x0d\\x0e")})
os.makedirs(os.path.join(out, "samples"), exist_ok=True); open(os.path.join(out, "samples", "1_0.png"), "wb").write(b"png")
import lora_worker as w
print(w.find_diffusers(out, "me"))
L = {"output": out, "name": "me", "models_dir": os.path.join(T, "dm"), "job_dir": T, "trigger": "zz", "family": "flux", "base": "Flex.1", "images": 3, "steps": 100}
print(w.finish_full(L))
h, start = w.read_st_header(os.path.join(T, "dm", "trained", "me.safetensors"))
d = open(os.path.join(T, "dm", "trained", "me.safetensors"), "rb").read()[start:]
print(json.dumps({k: v for k, v in h.items()}))
print(d.hex())
`, T);
  const lines = mk.stdout.trim().split("\n");
  check("find_diffusers: the final save (<name>/transformer) over a checkpoint", mk.status === 0 && /output[\\/]me[\\/]me[\\/]transformer$/.test(lines.find((l) => /transformer$/.test(l)) || ""), mk.stdout + mk.stderr);
  let head = {}; try { head = JSON.parse(lines[lines.length - 2]); } catch { head = {}; }
  check("merge_safetensors: one file, every tensor with new offsets, the data in order, the header 8-byte aligned",
    head["a.weight"] && head["c.weight"].data_offsets.join() === "8,14" && head["b.weight"].dtype === "F32" && lines[lines.length - 1] === "0102030405060708090a0b0c0d0e" && /bitGen/.test((head.__metadata__ || {}).bitgen), lines.slice(-2));
  let card = null; try { card = JSON.parse(fs.readFileSync(path.join(T, "dm", "trained", "me.bitgen.json"), "utf8")); } catch { card = null; }
  check("finish_full: diffusion_models/trained/me.safetensors + its card (every weight, Load Diffusion Model) + preview + installed.json",
    card && /every weight/.test(card.user.description) && card.user.keywords[0] === "zz" && fs.existsSync(path.join(T, "dm", "trained", "me.preview.png")) && JSON.parse(fs.readFileSync(path.join(T, "installed.json"), "utf8")).kind === "checkpoint", card);

  /* ---- the real ft_unsloth.py against the stand-in Unsloth */
  const FX = require("./ftfixture521.js").make(T);
  const vpy = FX.venv(path.join(T, "venv"));
  const jd = path.join(T, "llmjob"); fs.mkdirSync(path.join(jd, "dataset"), { recursive: true });
  FTM.writeChat(jd, P.chats);
  const cfgL = FTM.buildFtConfig({ kind: "llm", name: "me", preset: "qwen35_4b", system: "Be kind.", max_steps: 4 }, { data: FTM.chatFile(jd), output: path.join(jd, "output") });
  fs.writeFileSync(path.join(jd, "config.json"), JSON.stringify(cfgL));
  const env = Object.assign({}, process.env, { FT_FAKE_LOG: FX.log });
  const r1 = spawnSync(vpy, [path.join(ROOT, "scripts", "ft_unsloth.py"), path.join(jd, "config.json")], { encoding: "utf8", env, cwd: jd });
  const calls = () => fs.readFileSync(FX.log, "utf8").trim().split("\n").map((l) => JSON.parse(l));
  const cl = calls();
  check("ft_unsloth.py (LLM): it runs, prints [ft] step N/M loss lines, ends with the merged model", r1.status === 0 && /\[ft\] step 4\/4 loss 0\.5/.test(r1.stdout) && /merged model is in/.test(r1.stdout), (r1.stdout + r1.stderr).slice(-600));
  const fp = cl.find((c) => c.what === "from_pretrained");
  check("…FastLanguageModel in 16-bit, the repo, 2048 tokens; get_peft_model with r 16 + the 7 targets", fp && fp.loader === "language" && fp.load_in_16bit === true && fp.model_name === "Qwen/Qwen3.5-4B" && fp.max_seq_length === 2048
    && cl.find((c) => c.what === "get_peft_model").target_modules.length === 7, cl.slice(0, 2));
  const tr = cl.find((c) => c.what === "SFTTrainer");
  check("…every chat as one text, the job's system prompt in front of those without their own, no doubled <bos>; TRL's max_length; max_steps 4; adamw_8bit",
    tr && tr.n === 5 && tr.first === "<|system|>s<|user|>q1<|assistant|>a1" && /^<\|system\|>Be kind\.<\|user\|>q2/.test(tr.second) && tr.args.max_length === 2048 && tr.args.max_steps === 4 && tr.args.optim === "adamw_8bit" && tr.args.report_to === "none", tr);
  check("…the LoRA saved alone (adapter/) and merged into a 16-bit model (merged/)", cl.some((c) => c.what === "save_pretrained" && c.dir === "adapter") && cl.some((c) => c.what === "save_pretrained_merged" && c.save_method === "merged_16bit") && fs.existsSync(path.join(jd, "output", "merged", "config.json")));
  fs.writeFileSync(FX.log, "");
  const cfgG = FTM.buildFtConfig({ kind: "llm", name: "g", preset: "gemma4_e2b", method: "qlora" }, { data: FTM.chatFile(jd), output: path.join(jd, "out_g") });
  fs.writeFileSync(path.join(jd, "g.json"), JSON.stringify(cfgG));
  const r2 = spawnSync(vpy, [path.join(ROOT, "scripts", "ft_unsloth.py"), path.join(jd, "g.json")], { encoding: "utf8", env, cwd: jd });
  const cg = calls();
  check("ft_unsloth.py (Gemma 4, QLoRA): FastModel in 4-bit (no 16-bit flag), the gemma-4 chat template, 2 epochs", r2.status === 0 && cg.find((c) => c.what === "from_pretrained").loader === "model" && cg.find((c) => c.what === "from_pretrained").load_in_4bit === true
    && !("load_in_16bit" in cg.find((c) => c.what === "from_pretrained")) && cg.find((c) => c.what === "get_chat_template").chat_template === "gemma-4" && cg.find((c) => c.what === "SFTTrainer").args.num_train_epochs === 2, (r2.stdout + r2.stderr).slice(-400));
  fs.writeFileSync(FX.log, "");
  const cfgF = FTM.buildFtConfig({ kind: "llm", name: "f", preset: "qwen35_0_8b" }, { data: FTM.chatFile(jd), output: path.join(jd, "out_f") });
  fs.writeFileSync(path.join(jd, "f.json"), JSON.stringify(cfgF));
  const r3 = spawnSync(vpy, [path.join(ROOT, "scripts", "ft_unsloth.py"), path.join(jd, "f.json")], { encoding: "utf8", env, cwd: jd });
  const cf = calls();
  check("ft_unsloth.py (full fine-tune): full_finetuning, no LoRA, the whole model saved (no merge step)", r3.status === 0 && cf.find((c) => c.what === "from_pretrained").full_finetuning === true && !cf.some((c) => c.what === "get_peft_model")
    && !cf.some((c) => c.what === "save_pretrained_merged") && fs.existsSync(path.join(jd, "out_f", "merged", "config.json")), (r3.stdout + r3.stderr).slice(-400));
  // vision
  fs.writeFileSync(FX.log, "");
  const vd = path.join(T, "visjob"); fs.mkdirSync(path.join(vd, "dataset"), { recursive: true });
  const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAGUlEQVR4nGM8oaHBQApgIkn1qIZRDUNKAwCMLQE4ZidSiAAAAABJRU5ErkJggg==", "base64");
  for (const n of ["a", "b", "c"]) fs.writeFileSync(path.join(vd, "dataset", n + ".png"), PNG);
  fs.writeFileSync(path.join(vd, "dataset", "a.txt"), "A red square."); fs.writeFileSync(path.join(vd, "dataset", "b.txt"), "Another square.");
  const cfgV = FTM.buildFtConfig({ kind: "vision", name: "v", preset: "qwen35_4b_vl", instruction: "What is it?", max_steps: 2 }, { images: path.join(vd, "dataset"), output: path.join(vd, "output") });
  fs.writeFileSync(path.join(vd, "config.json"), JSON.stringify(cfgV));
  const r4 = spawnSync(vpy, [path.join(ROOT, "scripts", "ft_unsloth.py"), path.join(vd, "config.json")], { encoding: "utf8", env, cwd: vd });
  const cv = calls(), tv = cv.find((c) => c.what === "SFTTrainer") || {};
  check("ft_unsloth.py (vision): FastVisionModel + vision layers, only the pictures WITH an answer (2 of 3), the picture before the instruction, the vision collator",
    r4.status === 0 && cv.find((c) => c.what === "from_pretrained").loader === "vision" && cv.find((c) => c.what === "get_peft_model").finetune_vision_layers === true && cv.some((c) => c.what === "for_training")
    && tv.n === 2 && tv.collator === true && /"type": "image".*"text": "What is it\?".*"A red square\."/.test(tv.first) && tv.args.remove_unused_columns === false && tv.args.dataset_kwargs.skip_prepare_dataset === true, (r4.stdout + r4.stderr).slice(-500));

  /* ---- finetune_worker.to_gguf: convert -> quantize -> the LLM folder; vision + mmproj */
  const src = FX.llamaSrc(path.join(T, "llama.cpp")), qb = FX.quantize(path.join(T, "bin"));
  const dest = path.join(T, "llm-models");
  const F1 = { output: path.join(jd, "output"), llama_src: src, files: FTM.ggufNames("me", "q4_k_m"), quant: "q4_k_m", python: vpy, quantize: qb, kind: "llm", dest_dir: dest, job_dir: jd };
  const g = py("import finetune_worker as w; print(w.to_gguf(json.loads(sys.argv[2])))", JSON.stringify(F1));
  check("to_gguf (LLM): F16 -> llama-quantize Q4_K_M -> llm-models/me-Q4_K_M.gguf (the F16 removed), installed.json", g.status === 0 && fs.existsSync(path.join(dest, "me-Q4_K_M.gguf")) && !fs.existsSync(path.join(jd, "output", "gguf", "me-F16.gguf"))
    && JSON.parse(fs.readFileSync(path.join(jd, "installed.json"), "utf8")).quant === "Q4_K_M", (g.stdout + g.stderr).slice(-500));
  const F2 = Object.assign({}, F1, { files: FTM.ggufNames("me", "q8_0"), quant: "q8_0", quantize: "" });
  const g2b = py("import finetune_worker as w; print(w.to_gguf(json.loads(sys.argv[2])))", JSON.stringify(F2));
  check("to_gguf: Q8_0 straight from the converter (no quantize step)", g2b.status === 0 && /"outtype": "q8_0"/.test(fs.readFileSync(path.join(dest, "me-Q8_0.gguf"), "utf8")), (g2b.stdout + g2b.stderr).slice(-300));
  const F3 = Object.assign({}, F1, { files: FTM.ggufNames("me2", "q5_k_m"), quant: "q5_k_m", quantize: "" });
  const g3 = py("import finetune_worker as w; print(w.to_gguf(json.loads(sys.argv[2])))", JSON.stringify(F3));
  check("to_gguf: no llama-quantize -> says so and keeps the F16", g3.status === 0 && /no llama-quantize/.test(g3.stdout) && fs.existsSync(path.join(dest, "me2-F16.gguf")));
  const vdest = path.join(T, "llm-models", "vision", "v");
  const F4 = { output: path.join(vd, "output"), llama_src: src, files: FTM.ggufNames("v", "q4_k_m"), quant: "q4_k_m", python: vpy, quantize: qb, kind: "vision", dest_dir: vdest, job_dir: vd };
  const g4 = py("import finetune_worker as w; print(w.to_gguf(json.loads(sys.argv[2])))", JSON.stringify(F4));
  check("to_gguf (vision): the model + mmproj-v-F16.gguf (--mmproj) side by side in llm-models/vision/v/ - where the captioner scans", g4.status === 0 && fs.existsSync(path.join(vdest, "v-Q4_K_M.gguf"))
    && /"kind": "mmproj"/.test(fs.readFileSync(path.join(vdest, "mmproj-v-F16.gguf"), "utf8")), (g4.stdout + g4.stderr).slice(-400));
  const pair = require("../lib/captioner.js");
  check("…and the captioner pairs them (pairFiles)", typeof pair.pairFiles !== "function" || JSON.stringify(pair.pairFiles(fs.readdirSync(vdest))) === JSON.stringify([{ model: "mmproj-v-F16.gguf", mmproj: "" }, { model: "v-Q4_K_M.gguf", mmproj: "mmproj-v-F16.gguf" }]), fs.readdirSync(vdest));

  /* ---- finetune_worker.bake against a stand-in ComfyUI */
  const outDir = path.join(T, "comfy", "output"), gotGraph = [];
  const srv = http.createServer((q, s) => {
    let b = ""; q.on("data", (c) => { b += c; }); q.on("end", () => {
      s.setHeader("Content-Type", "application/json");
      if (q.url === "/system_stats") return s.end("{}");
      if (q.url === "/prompt") { const j = JSON.parse(b); gotGraph.push(j.prompt); const pre = j.prompt[3].inputs.filename_prefix; fs.mkdirSync(path.join(outDir, path.dirname(pre)), { recursive: true }); fs.writeFileSync(path.join(outDir, pre + "_00001_.safetensors"), "baked"); return s.end(JSON.stringify({ prompt_id: "p1" })); }
      if (q.url === "/history/p1") return s.end(JSON.stringify({ p1: { status: { status_str: "success", completed: true }, outputs: {} } }));
      s.statusCode = 404; s.end("{}");
    });
  });
  await new Promise((r) => srv.listen(0, "127.0.0.1", r));
  const lf = path.join(T, "loras", "trained", "me.safetensors"); fs.mkdirSync(path.dirname(lf), { recursive: true }); fs.writeFileSync(lf, "lora"); fs.writeFileSync(lf.replace(/\.safetensors$/, ".preview.png"), "png");
  const BF = { name: "me", out: "me_merged", cat: "checkpoints", base: "sdxl/base.safetensors", lora: "trained/me.safetensors", lora_file: lf, strength: 0.8, prefix: "bitgen_bake/me_merged",
    graph: FTM.mergeGraph({ cat: "checkpoints", base: "sdxl/base.safetensors", lora: "trained/me.safetensors", strength: 0.8, prefix: "bitgen_bake/me_merged" }), comfy_url: "http://127.0.0.1:" + srv.address().port, comfy_outputs: [outDir], dest_dir: path.join(T, "ckpt", "trained"), job_dir: T, trigger: "zz", family: "sdxl" };
  const bk = await new Promise((res) => { const p = require("child_process").spawn(PY, ["-c", "import sys,json; sys.dont_write_bytecode=True; sys.path.insert(0, sys.argv[1]); sys.path.insert(0, sys.argv[1] + '/misc'); import finetune_worker as w; print(w.bake(json.loads(sys.argv[2])))", ROOT, JSON.stringify(BF)]); let o = ""; p.stdout.on("data", (d) => { o += d; }); p.stderr.on("data", (d) => { o += d; }); p.on("close", (code) => res({ code, o })); });
  srv.close();
  let bcard = null; try { bcard = JSON.parse(fs.readFileSync(path.join(T, "ckpt", "trained", "me_merged.bitgen.json"), "utf8")); } catch { bcard = null; }
  check("bake: ComfyUI gets the graph; finished on history status (CheckpointSave has no outputs); the file moved into checkpoints/trained/me_merged.safetensors",
    bk.code === 0 && gotGraph.length === 1 && gotGraph[0][3].class_type === "CheckpointSave" && (() => { try { return fs.readFileSync(path.join(T, "ckpt", "trained", "me_merged.safetensors"), "utf8") === "baked"; } catch { return false; } })() && !fs.existsSync(path.join(outDir, "bitgen_bake", "me_merged_00001_.safetensors")), bk.o.slice(-500));
  check("…with a card (the trigger, 'baked into') + the LoRA's preview + baked.json in the job", bcard && /baked into base\.safetensors at strength 0\.8/.test(bcard.user.description) && bcard.user.keywords[0] === "zz"
    && fs.existsSync(path.join(T, "ckpt", "trained", "me_merged.preview.png")) && JSON.parse(fs.readFileSync(path.join(T, "baked.json"), "utf8")).length === 1, bcard);

  /* ---- wiring */
  const CORE = read("lib", "core.js"), R = read("routes", "loraTrain.js"), SRV = read("misc/server.js"), U = read("lib", "usageLog.js");
  check("core: install_unsloth / ft_llm / ft_vision / lora_merge are tool modes run by finetune_worker.py; the Unsloth install skips the preset wait",
    /"install_unsloth", "ft_llm", "ft_vision", "lora_merge"\]/.test(CORE) && /install_unsloth: "finetune_worker\.py", ft_llm: "finetune_worker\.py", ft_vision: "finetune_worker\.py", lora_merge: "finetune_worker\.py"/.test(CORE) && /"install_aitoolkit", "install_unsloth"\]\.includes/.test(CORE));
  check("routes: chat get / import, bases, merge, install {engine}; not server.js", ["/api/loratrain/chat/:name\"", "/api/loratrain/chat/:name/import", "/api/loratrain/bases", "/api/loratrain/merge/:name"].every((u) => R.includes(u)) && /LT\.install\(String\(\(req\.body \|\| \{\}\)\.engine/.test(R) && !/fineTune/.test(SRV));
  check("the import route reads TEXT (not the 100 kb JSON parser) - big chat files fit", /express\.text\(\{ type: \(\) => true, limit: "64mb" \}\)/.test(R));
  check("the usage log names them (Fine-tune / Bake)", /"Fine-tune "/.test(U) && /"Bake "/.test(U));
  const IGN = fs.existsSync(path.join(ROOT, "misc", "_gitignore")) ? read("misc/_gitignore") : "tools/";
  check("tools/ (llama.cpp's source) is not shipped (ignored)", /^\/?tools\/?$/m.test(IGN));
  const TP = JSON.parse(read("lib", "testPlan.json"));
  const g521 = TP.groups.find((g) => g.id === "g521");   /* 2.522.0: a newer release's group is first now */
  check("the testing checklist has the 2.521 items", !!g521 && g521.items.length >= 6);

  fs.rmSync(T, { recursive: true, force: true });
  console.log(`RESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
