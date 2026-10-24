#!/usr/bin/env node
/* bitGen Studio — 2.517.0 units: ⚡ POWER DRAW + CLOCK SPEEDS in the System stats, the ENERGY a job used (lib/power.js,
 * static/powerstats.js, core.js) and the ANIMA workflows.
 * Tim (verbatim): "create workflow for anima safetensors . Can we add powerdraw and clockspeed to the system stats. when a
 * job is completed add total power consumed?"
 * The live part runs lib/power.js against a stand-in nvidia-smi (a script on PATH printing a card at 250 W, then 350 W)
 * and checks the watt-seconds it counts. */
"use strict";
const fs = require("fs"), os = require("os"), path = require("path");
const { spawnSync } = require("child_process");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, cond, got) => { if (cond) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
const near = (a, b, e) => Math.abs(a - b) <= e;
const PW = require("../lib/power.js"), H = require("../static/powerstats.js");

/* ---- pure */
check("parseLine: an nvidia-smi csv line -> index, watts, the limit, the clocks; '[N/A]' = not known; junk = null",
  JSON.stringify(PW.parseLine("0, 312.45, 450.00, 2520, 10501, 2850")) === JSON.stringify({ index: 0, power_w: 312.45, power_limit_w: 450, clock_mhz: 2520, mem_clock_mhz: 10501, max_clock_mhz: 2850, temp_c: null })   // 2.518.0: + temp_c (a 7th field)
  && PW.parseLine("1, [N/A], [N/A], 1395, 7000, 1980").power_w === null && PW.parseLine("NVIDIA-SMI has failed") === null);
check("integrate: the trapezoid of two readings (200 W -> 300 W over 2 s = 500 J); a gap over 10 s counts 2 s of the last power",
  PW.integrate({ t: 0, w: 200 }, { t: 2000, w: 300 }) === 500 && PW.integrate({ t: 0, w: 200 }, { t: 60000, w: 300 }) === 400 && PW.integrate(null, { t: 1, w: 5 }) === 0);
const sm = PW.summary({ t: 0, gpu_j: 1000, cpu_j: 500, gpu_known: true, cpu_known: true }, { t: 60000, gpu_j: 19000, cpu_j: 3500, gpu_known: true, cpu_known: true }, 400);
check("summary: Wh of the GPUs + CPU between two marks, the average and peak watts, the seconds", sm.wh === 5.833 && sm.gpu_wh === 5 && sm.cpu_wh === 0.833 && sm.cpu_measured && sm.avg_w === 350 && sm.peak_w === 400 && sm.secs === 60, sm);
const sg = PW.summary({ t: 0, gpu_j: 0, cpu_j: 0, gpu_known: true, cpu_known: false }, { t: 1000, gpu_j: 360, cpu_j: 0, gpu_known: true, cpu_known: false }, null);
check("summary without a CPU meter: the GPUs only (cpu_measured false); no meter at all = null", sg.wh === 0.1 && !sg.cpu_measured && PW.summary({ t: 0, gpu_j: 0, cpu_j: 0 }, { t: 1, gpu_j: 0, cpu_j: 0 }) === null, sg);
check("words: the job's log line", PW.words(sm) === "5.8 Wh (GPU 5.0 Wh + CPU 0.8 Wh) - avg 350 W, peak 400 W over 60 s" && /GPU - the CPU is not measured/.test(PW.words(sg)), PW.words(sm));
check("the page's words: Wh / kWh, MHz / GHz, the card's ⚡ and its tooltip", H.fmtWh(0.42) === "0.4 Wh" && H.fmtWh(125.4) === "125 Wh" && H.fmtWh(2500) === "2.50 kWh" && H.fmtMhz(2520) === "2.52 GHz" && H.fmtMhz(800) === "800 MHz" && H.fmtMhz(null) === "n/a"
  && H.badgeText(sm) === "⚡ 5.8 Wh" && /GPU 5\.0 Wh \+ CPU 0\.8 Wh/.test(H.badgeTitle(sm)) && /peak 400 W/.test(H.badgeTitle(sm)));

/* ---- live: a stand-in nvidia-smi */
const T = fs.mkdtempSync(path.join(os.tmpdir(), "bg517-"));
const fake = path.join(T, process.platform === "win32" ? "nvidia-smi.cmd" : "nvidia-smi");
if (process.platform !== "win32") {
  fs.writeFileSync(fake, `#!/usr/bin/env node
const a = process.argv.slice(2).join(" ");
if (/-lms/.test(a)) { let i = 0; const t = setInterval(() => { console.log("0, " + (i++ < 2 ? 250 : 350) + ".00, 450.00, 2520, 10501, 2850"); }, 1000); setTimeout(() => clearInterval(t), 60000); }
else console.log("NVIDIA GeForce RTX 3090, 8000, 24576, 55, 60");
`);
  fs.chmodSync(fake, 0o755);
  const code = `const P = require(${JSON.stringify(path.join(ROOT, "lib", "power.js"))}); P.start(); const m = P.mark();
setTimeout(() => { const s = P.stats(), e = P.since(m); console.log(JSON.stringify({ s, e })); process.exit(0); }, 4600);`;
  const r = spawnSync(process.execPath, ["-e", code], { encoding: "utf8", env: { ...process.env, PATH: T + path.delimiter + process.env.PATH }, timeout: 20000 });
  let L = null; try { L = JSON.parse((r.stdout || "").trim().split("\n").pop()); } catch { L = null; }
  check("live: the card's power, limit, clocks read from one nvidia-smi -lms 1000 (no process a poll); the CPU's clock",
    L && L.s.gpus.length === 1 && L.s.gpus[0].power_limit_w === 450 && L.s.gpus[0].clock_mhz === 2520 && L.s.gpus[0].max_clock_mhz === 2850 && (process.platform !== "linux" || L.s.cpu_mhz > 0), L || r.stderr);
  check("live: the energy counted - 250 W, 250 W, 350 W, 350 W a second apart = about 0.25 Wh over the mark (the GPU measured, the peak 350 W)",
    L && L.e && L.e.gpu_measured && near(L.e.gpu_wh, (250 + 300 + 350) / 3600, 0.04) && L.e.peak_w >= 350 && L.e.secs >= 4, L && L.e);
}
try { fs.rmSync(T, { recursive: true, force: true }); } catch { /* fine */ }

/* ---- wiring */
const CORE = read("lib", "core.js"), JI = read("lib", "jobsInfo.js"), IDX = read("routes", "index.js"), HT = read("static", "index.html"), SRV = (() => { try { return read("misc/server.js"); } catch { return ""; } })();
check("core.js: a job's energy marked when it starts, counted when it ends (done / failed / cancelled), logged [power], on its record + /api/jobs",
  /job\._energy0 = require\("\.\/power"\)\.mark\(\)/.test(CORE) && /pw\.since\(job\._energy0\)/.test(CORE) && /log\(job, `\[power\] \$\{pw\.words\(e(, pw\.priceOf\(config\))?\)\}`\)/.test(CORE) && /energy: job\.energy \|\| null/.test(CORE) && /if \(job\.energy\) e\.energy = job\.energy;/.test(JI));
check("/api/stats has power (lib/power.js stats); server.js untouched", /power: \(\(\) => \{ try \{ return require\("\.\.\/lib\/power"\)\.stats\(\); \}/.test(IDX) && !/lib\/power|powerstats/.test(SRV));
check("the page: powerstats.js loaded; refreshStats paints power + clocks; a finished job's card (live and from the project's history) shows ⚡",
  /<script src="\/static\/powerstats\.js"><\/script>/.test(HT) && /H3Power\.paint\(s, charts\)/.test(HT) && (HT.match(/H3Power\.badge\((j|h)\.energy\)/g) || []).length === 2);

/* ---- ANIMA */
const wf = (n) => JSON.parse(read("comfy_workflows", n)), nodes = (g) => Object.entries(g).filter(([k]) => !k.startsWith("_")), cls = (g, k) => nodes(g).filter(([, v]) => v.class_type === k);
const A1 = wf("img_anima_aesthetic_t2i.json"), A2 = wf("img_anima_base_t2i.json");
check("Anima workflows: Aesthetic v1.1 / Base v1.0 on UNETLoader, Qwen3 0.6B on CLIPLoader, the Qwen-Image VAE, 4 model-only LoRA slots, EmptyLatentImage",
  cls(A1, "UNETLoader")[0][1].inputs.unet_name === "anima-aesthetic-v1.1.safetensors" && cls(A2, "UNETLoader")[0][1].inputs.unet_name === "anima-base-v1.0.safetensors"
  && [A1, A2].every((g) => cls(g, "CLIPLoader")[0][1].inputs.clip_name === "qwen_3_06b_base.safetensors" && cls(g, "VAELoader")[0][1].inputs.vae_name === "qwen_image_vae.safetensors" && cls(g, "LoraLoaderModelOnly").length === 4 && cls(g, "EmptyLatentImage").length === 1));
check("the model card's settings: 30 steps, cfg 4, er_sde, a real negative prompt (score_1 ...)", [A1, A2].every((g) => { const k = cls(g, "KSampler")[0][1].inputs; return k.steps === 30 && k.cfg === 4 && k.sampler_name === "er_sde" && cls(g, "CLIPTextEncode").length === 2 && Object.values(g).some((v) => v && v.inputs && /score_1, score_2, score_3/.test(v.inputs.text || "")); }));
const py = process.env.PYTHON || (process.platform === "win32" ? "python" : "python3");
const PATCH = `
import sys, json
sys.path.insert(0, ${JSON.stringify(path.join(ROOT, "scripts"))})
import comfy_image as ci
g = ci.load_workflow(${JSON.stringify(path.join(ROOT, "comfy_workflows", "img_anima_aesthetic_t2i.json"))})
r = ci.patch(g, {"arch": "anima", "engine": "comfy", "steps": 40, "cfg": 5, "negative": "bad hands", "loras": [{"path": "anima_style.safetensors", "weight": 0.7}]}, {"prompt": "masterpiece, best quality, a fox girl", "seed": 9, "width": 832, "height": 1216})
g2 = r[0] if isinstance(r, tuple) else r
g2 = g2.get("graph", g2)
print(json.dumps({k: v for k, v in g2.items() if not k.startswith("_")}))`;
const pp = spawnSync(py, ["-c", PATCH], { encoding: "utf8" });
let G = null; try { G = JSON.parse((pp.stdout || "").trim().split("\n").pop()); } catch { G = null; }
check("the style patcher fills it: the prompt, the negative, seed, 832 x 1216, steps / cfg, slot 1's LoRA (the rest bypassed)",
  G && Object.values(G).some((v) => v.class_type === "CLIPTextEncode" && /a fox girl/.test(v.inputs.text)) && Object.values(G).some((v) => v.class_type === "CLIPTextEncode" && v.inputs.text === "bad hands")
  && Object.values(G).some((v) => v.class_type === "KSampler" && v.inputs.seed === 9 && v.inputs.steps === 40 && v.inputs.cfg === 5) && Object.values(G).some((v) => v.class_type === "EmptyLatentImage" && v.inputs.width === 832 && v.inputs.height === 1216)
  && Object.values(G).filter((v) => v.class_type === "LoraLoaderModelOnly").length === 1, (pp.stderr || "").slice(-400) || G);
const ST = read("lib", "styles.js"), ARCH = JSON.parse(read("lib", "imageArch.json")).archs.find((a) => a.id === "anima"), CAT = JSON.parse(read("lib", "modelCatalog.json")).models;
check("the starters (Anima, Anima base), the arch (ComfyUI only, a negative prompt), the catalogue (circlestone-labs/Anima: both models + Qwen3 0.6B; the Qwen-Image VAE)",
  ST.includes('name: "Anima", arch: "anima"') && ST.includes('name: "Anima base", arch: "anima"') && ARCH && ARCH.comfy_only && ARCH.negative && ARCH.defaults.steps === 30
  && ["anima_aesthetic", "anima_base", "anima_te"].every((id) => CAT.some((m) => m.id === id && m.repo === "circlestone-labs/Anima")) && /Anima/.test(CAT.find((m) => m.id === "qwen_vae").for));
console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
