#!/usr/bin/env node
/* bitGen Studio — 2.520.0 units: the 🎓 LORA TRAINER (lib/loraTrain.js, lib/loraTrainPresets.json, lib/zipWrite.js,
 * lora_worker.py, routes/loraTrain.js, static/loratrain.js, core's lora_train / install_aitoolkit modes).
 * Tim (verbatim): "please build a lora floating docker for creating lora's like ai toolkit by ostris. keep our theme."
 * The YAML the trainer writes is read back with PyYAML (what ai-toolkit itself uses); the export zip is read back with
 * lib/unzip.js and Python's zipfile; lora_worker.py's finish step runs against a fake training folder. */
"use strict";
const fs = require("fs"), os = require("os"), path = require("path"), { execFileSync, spawnSync } = require("child_process");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, cond, got) => { if (cond) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
const LT = require("../lib/loraTrain.js"), ZW = require("../lib/zipWrite.js"), UZ = require("../lib/unzip.js"), UI = require("../static/loratrain.js");
const PY = process.platform === "win32" ? "python" : "python3";

/* ---- presets */
const ids = LT.PRESETS.map((p) => p.id);
check("presets: Z-Image Turbo first (the default), FLUX dev/schnell, Qwen-Image, SDXL, SD 1.5, Chroma, Wan 2.1",
  ids[0] === "zimage_turbo" && ["zimage", "flux_dev", "flux_schnell", "qwen_image", "sdxl", "sd15", "chroma", "wan21_14b"].every((i) => ids.includes(i)) && LT.DEFAULTS.preset === "zimage_turbo", ids);
check("every preset has a label, a VRAM figure, a model path and the train/sample settings",
  LT.PRESETS.every((p) => p.label && p.vram_gb > 0 && p.model && p.model.name_or_path && p.train && p.train.lr > 0 && p.train.steps > 0 && p.sample), LT.PRESETS.filter((p) => !(p.model && p.model.name_or_path)).map((p) => p.id));
const zt = LT.PRESETS.find((p) => p.id === "zimage_turbo");
check("Z-Image Turbo trains with ostris' training adapter (the de-distill assistant LoRA)", /zimage_turbo_training_adapter/.test(JSON.stringify(zt.model)), zt.model);
check("FLUX.1 presets set is_flux", LT.PRESETS.filter((p) => /^flux_/.test(p.id)).every((p) => p.model.is_flux === true)   /* 2.521.0: flux2_klein_* is not FLUX.1 */);

/* ---- normalize */
const n0 = LT.normalize({});
check("normalize({}): the default preset, its steps + lr, rank 16, 512/768/1024, adamw8bit", n0.preset === "zimage_turbo" && n0.steps === zt.train.steps && n0.lr === zt.train.lr && n0.rank === 16 && n0.resolutions.join() === "512,768,1024" && n0.optimizer === "adamw8bit", n0);
const n1 = LT.normalize({ name: "my lora!!", preset: "nope", rank: 9999, alpha: -3, steps: "1500", resolutions: "1024, 512 333 512", optimizer: "evil", device: "rm -rf", trigger: "t1m\nx", sample_prompts: "a\n\n b \n" });
check("normalize: names made safe, unknown preset -> the default, numbers clamped, bad resolutions dropped, sorted",
  n1.name === "my_lora" && n1.preset === "zimage_turbo" && n1.rank === 256 && n1.alpha === 1 && n1.steps === 1500 && n1.resolutions.join() === "512,1024", n1);
check("normalize: optimizer + device allow-listed, trigger one line, prompts split + trimmed",
  n1.optimizer === "adamw8bit" && n1.device === "cuda:0" && n1.trigger === "t1m x" && n1.sample_prompts.join("|") === "a|b", n1);
check("cleanName", LT.cleanName(" a b/../c ") === "a_b_c" && LT.cleanName("___") === "" && LT.cleanName("x".repeat(99)).length === 60);

/* ---- trigger in captions */
check("withTrigger: put in front once", LT.withTrigger("a man smiling", "t1m") === "t1m, a man smiling" && LT.withTrigger("t1m, a man", "t1m") === "t1m, a man"
  && LT.withTrigger("photo of T1M smiling", "t1m") === "photo of T1M smiling" && LT.withTrigger("", "t1m") === "t1m" && LT.withTrigger("x", "") === "x");
check("withTrigger: a word that only contains the trigger is not it", LT.withTrigger("t1mber wood", "t1m") === "t1m, t1mber wood");

/* ---- the ai-toolkit config */
const paths = { dataset: "C:\\proj\\lora\\me\\dataset", training_folder: "C:\\proj\\lora\\me\\output" };
const cfg = LT.buildConfig({ name: "me", preset: "sdxl", trigger: "t1m", rank: 32, alpha: 16, steps: 1200, flip: true, sample_prompts: ["[trigger] portrait"] }, paths);
const pr = cfg.config.process[0];
check("buildConfig: job extension, one sd_trainer process, forward slashes in paths", cfg.job === "extension" && cfg.config.name === "me" && pr.type === "sd_trainer"
  && pr.training_folder === "C:/proj/lora/me/output" && pr.datasets[0].folder_path === "C:/proj/lora/me/dataset", cfg);
check("buildConfig: network lora rank/alpha, save, trigger_word, flip, steps", pr.network.type === "lora" && pr.network.linear === 32 && pr.network.linear_alpha === 16
  && pr.trigger_word === "t1m" && pr.datasets[0].flip_x === true && pr.train.steps === 1200 && pr.save.max_step_saves_to_keep === 4 && pr.datasets[0].caption_ext === "txt", pr);
check("buildConfig: sample prompts keep [trigger] (ai-toolkit fills it from trigger_word)", pr.sample.prompts[0] === "[trigger] portrait", pr.sample);
const cte = LT.PRESETS.find((p) => p.train.cache_text_embeddings);
if (cte) {
  const c2 = LT.buildConfig({ name: "x", preset: cte.id, trigger: "zz", sample_prompts: ["[trigger] dog"] }, paths).config.process[0];
  check(`buildConfig (${cte.id}, cached text embeddings): no trigger_word (ai-toolkit refuses both) - the prompts get the word itself`, c2.trigger_word === undefined && c2.sample.prompts[0] === "zz dog", c2);
} else check("a preset caches text embeddings (Qwen-Image)", false, LT.PRESETS.map((p) => p.id));
const c3 = LT.buildConfig({ name: "y", preset: "flux_dev", quantize: false, low_vram: true, model_path: "D:\\models\\flux1-dev", sample_every: 0 }, paths).config.process[0];
check("buildConfig: quantize off removes qtype, low VRAM on, your own model path, sample_every 0 = no samples",
  !("quantize" in c3.model) && c3.model.low_vram === true && c3.model.name_or_path === "D:/models/flux1-dev" && !c3.sample, c3.model);
const wan = LT.buildConfig({ name: "w", preset: "wan21_14b" }, paths).config.process[0];
check("buildConfig (Wan 2.1, video): still pictures train as 1 frame, samples are clips", wan.datasets[0].num_frames === 1 && wan.sample.num_frames > 1, wan.sample);

/* ---- YAML through PyYAML */
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lt520-"));
const yml = LT.toYaml(LT.buildConfig({ name: "me", preset: "zimage_turbo", trigger: "t1m", lr: 0.00002 }, paths));
fs.writeFileSync(path.join(tmp, "c.yaml"), yml);
const hasYaml = spawnSync(PY, ["-c", "import yaml"]).status === 0;
if (hasYaml) {
  const back = JSON.parse(execFileSync(PY, ["-c", "import yaml,json,sys; print(json.dumps(yaml.safe_load(open(sys.argv[1]))))", path.join(tmp, "c.yaml")]).toString());
  const want = JSON.parse(JSON.stringify(LT.buildConfig({ name: "me", preset: "zimage_turbo", trigger: "t1m", lr: 0.00002 }, paths)));
  check("toYaml: PyYAML reads back exactly the config object", JSON.stringify(back) === JSON.stringify(want), { back: JSON.stringify(back).slice(0, 300), yml: yml.slice(0, 300) });
  check("toYaml: a small learning rate is a NUMBER for PyYAML (not the string '2e-05')", typeof back.config.process[0].train.lr === "number" && back.config.process[0].train.lr === 0.00002, back.config.process[0].train.lr);
  const all = LT.PRESETS.every((p) => {
    fs.writeFileSync(path.join(tmp, "p.yaml"), LT.toYaml(LT.buildConfig({ name: "p", preset: p.id, trigger: "q" }, paths)));
    return spawnSync(PY, ["-c", "import yaml,sys; d=yaml.safe_load(open(sys.argv[1])); assert d['config']['process'][0]['network']['type']=='lora'", path.join(tmp, "p.yaml")]).status === 0;
  });
  check("toYaml: every preset's config parses", all);
} else console.log("SKIP: PyYAML is not installed here - the YAML round trip");

/* ---- progress + final file */
const ps = LT.parseSteps("my_lora:  12%|█▏ | 240/2000 [05:12<38:00, 1.3s/it, lr: 1.0e-04 loss: 3.2e-01]");
check("parseSteps: the tqdm line -> step, total, loss", ps && ps.step === 240 && ps.total === 2000 && Math.abs(ps.loss - 0.32) < 1e-9, ps);
check("parseSteps: not a progress line -> null", LT.parseSteps("Loading model") === null);
check("finalName: <name>.safetensors wins, else the newest checkpoint, else null",
  LT.finalName(["me_000000500.safetensors", "me.safetensors"], "me") === "me.safetensors" && LT.finalName(["me_000000250.safetensors", "me_000000500.safetensors", "x.txt"], "me") === "me_000000500.safetensors" && LT.finalName(["a.txt"], "me") === null);

/* ---- the export zip */
const z = ZW.zip([{ name: "me/config.yaml", data: "job: extension\n" }, { name: "me\\dataset\\1.txt", data: Buffer.from("t1m, a man") }]);
check("zipWrite.crc32 = the standard CRC-32 ('123456789' -> cbf43926)", ZW.crc32(Buffer.from("123456789")).toString(16) === "cbf43926");
fs.writeFileSync(path.join(tmp, "e.zip"), z);
let names = [];
try { names = UZ.entries(z).map((e) => e.name); } catch (e) { names = ["unzip threw " + e.message]; }
check("lib/unzip reads the export zip back (backslashes become /)", names.join() === "me/config.yaml,me/dataset/1.txt", names);
const pz = spawnSync(PY, ["-c", "import zipfile,sys; z=zipfile.ZipFile(sys.argv[1]); assert z.testzip() is None; print(z.read('me/dataset/1.txt').decode())", path.join(tmp, "e.zip")]);
check("Python's zipfile opens it too (CRCs right)", pz.status === 0 && pz.stdout.toString().trim() === "t1m, a man", pz.stderr.toString().slice(0, 300));

/* ---- lora_worker.py finish(): the LoRA lands in loras/trained with its Model manager card + preview */
const out = path.join(tmp, "output", "me"), loras = path.join(tmp, "loras"), jd = path.join(tmp, "job");
fs.mkdirSync(path.join(out, "samples"), { recursive: true }); fs.mkdirSync(jd);
fs.writeFileSync(path.join(out, "me_000000250.safetensors"), "a"); fs.writeFileSync(path.join(out, "me.safetensors"), "final");
fs.writeFileSync(path.join(out, "samples", "1_000000250_0.jpg"), "jpg");
const fin = spawnSync(PY, ["-c", `import sys,json; sys.dont_write_bytecode = True; sys.path.insert(0, sys.argv[1]); sys.path.insert(0, sys.argv[1] + '/misc'); import lora_worker as w; print(w.finish(json.loads(sys.argv[2])))`, ROOT,
  JSON.stringify({ output: out, name: "me", loras_dir: loras, job_dir: jd, trigger: "t1m", family: "SDXL", base: "SDXL 1.0", images: 12, steps: 1200 })]);
const tdir = path.join(loras, "trained");
check("lora_worker.finish: me.safetensors (the final one) copied to loras/trained", fin.status === 0 && fs.existsSync(path.join(tdir, "me.safetensors")) && fs.readFileSync(path.join(tdir, "me.safetensors"), "utf8") === "final", fin.stdout.toString() + fin.stderr.toString());
let card = {}; try { card = JSON.parse(fs.readFileSync(path.join(tdir, "me.bitgen.json"), "utf8")); } catch { /* */ }
check("…with its Model manager card: title, family, the trigger as its keyword, a description", card.v === 1 && card.user && card.user.title === "me" && card.user.family === "SDXL" && card.user.keywords[0] === "t1m" && /12 pictures, 1200 steps/.test(card.user.description), card);
check("…the last sample as its preview (.jpg -> .preview.jpeg) and installed.json in the job", fs.existsSync(path.join(tdir, "me.preview.jpeg")) && fs.existsSync(path.join(jd, "installed.json")));
const nof = spawnSync(PY, ["-c", `import sys,json; sys.dont_write_bytecode = True; sys.path.insert(0, sys.argv[1]); sys.path.insert(0, sys.argv[1] + '/misc'); import lora_worker as w; print(w.train(json.loads(sys.argv[2])))`, ROOT, JSON.stringify({ python: "/nope/python", aitk_dir: "/nope", name: "x", config: "c" })]);
check("lora_worker.train without ai-toolkit: says to install it, exit 1", /Install ai-toolkit/.test(nof.stdout.toString()) && /\n1\s*$/.test(nof.stdout.toString()), nof.stdout.toString());

/* ---- the docker's pure parts */
check("fitText: fits / does not / no NVIDIA card", /✓/.test(UI.fitText({ vram_gb: 12 }, { name: "RTX 4090", vram_gb: 24 })) && /Low VRAM/.test(UI.fitText({ vram_gb: 24 }, { name: "RTX 3060", vram_gb: 12 })) && /Export/.test(UI.fitText({ vram_gb: 12 }, null)));
check("stepText + lossOf", UI.stepText({ step: 250, total: 1000 }) === "step 250 / 1000 (25 %)" && UI.stepText(null) === "" && UI.lossOf(["[lora] step 1/9 loss 0.5", "x", "[lora] step 2/9 loss 0.25", "done"]) === 0.25 && UI.lossOf([]) === null);

/* ---- wiring */
const CORE = read("lib", "core.js"), IDX = read("routes", "index.js"), SRV = read("misc/server.js"), HTML = read("static", "index.html"), R = read("routes", "loraTrain.js");
check("core: lora_train + install_aitoolkit are tool modes run by lora_worker.py; installs skip the pump's preset wait",
  /"install_aitoolkit", "lora_train"/.test(CORE) && /lora_train: "lora_worker\.py", install_aitoolkit: "lora_worker\.py"/.test(CORE) && /"install_aitoolkit"(, "install_unsloth")?\]\.includes/.test(CORE));
check("routes/index mounts loraTrain (not server.js)", /require\("\.\/loraTrain"\)/.test(IDX) && !/loraTrain/.test(SRV));
check("routes: list, job save/delete, dataset add/from/caption/remove, autocaption, yaml, start, install, export",
  ["/api/loratrain", "/api/loratrain/job", "/api/loratrain/dataset/:name/add", "/api/loratrain/dataset/:name/from", "/api/loratrain/dataset/:name/autocaption", "/api/loratrain/yaml/:name", "/api/loratrain/start", "/api/loratrain/install", "/api/loratrain/export/:name"].every((u) => R.includes('"' + u)),
  ["/api/loratrain", "/api/loratrain/job", "/api/loratrain/dataset/:name/add", "/api/loratrain/dataset/:name/from", "/api/loratrain/dataset/:name/autocaption", "/api/loratrain/yaml/:name", "/api/loratrain/start", "/api/loratrain/install", "/api/loratrain/export/:name"].filter((u) => !R.includes('"' + u)));
check("the page loads static/loratrain.js (statusbar 🎓 LoRA)", /<script src="\/static\/loratrain\.js/.test(HTML) && /ltBtn/.test(read("static", "loratrain.js")));
check("job folders can't escape the project (cleanName on every name)", (() => { try { LT.jobDir("../../x"); return path.basename(LT.jobDir("../../x")) === "x"; } catch { return false; } })());
const IGN = fs.existsSync(path.join(ROOT, "misc", "_gitignore")) ? read("misc/_gitignore") : fs.existsSync(path.join(ROOT, ".gitignore")) ? read(".gitignore") : "ai-toolkit/";
check("ai-toolkit/ is not shipped (ignored)", /^\/?ai-toolkit\/?$/m.test(IGN), IGN.slice(0, 200));

fs.rmSync(tmp, { recursive: true, force: true });
console.log(`RESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
