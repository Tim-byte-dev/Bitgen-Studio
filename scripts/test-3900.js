#!/usr/bin/env node
/* bitGen Studio — 3.9.0: 🧩 MING LAYERED DESIGN - Ming-Image makes a design from the image editor's layer list (0.2-Design) and
 * splits it into those layers (0.1-Design-Layer): lib/mingLayers.js, lib/mingAddon.js, routes/ming.js, misc/ming_worker.py
 * (mode "ming"), ext/imageeditdock/pcming.js - pure + the wiring. The worker itself: scripts/test-ming-3900.py; the dialog in a
 * real browser: scripts/test-ui3900-ui.js.
 * Tim: "can u add this to image editor please. https://huggingface.co/inclusionAI/Ming-Image-0.2-Design . with a dialog with
 * add layer, this will have layer name and description of what goes in that layer for ming image. it is supposed to be able to
 * generate separate layers. please check it" */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const ML = require(path.join(ROOT, "lib/mingLayers.js"));
const PM = require(path.join(ROOT, "ext/imageeditdock/pcming.js"));

(async () => {
  /* ---------------- the words both models read */
  const rows = [{ name: "Title", desc: 'The words "SUMMER SALE" in bold #FFFFFF letters', where: "top" }, { name: "Shoe", desc: "A red running shoe, three-quarter view, #D62828", where: "centre" },
    { name: "", desc: "" }, { name: "Background", desc: "Sunny beach gradient", where: "nowhere" }];
  const C = ML.clean(rows);
  check("clean: empty rows dropped, an unknown place = the whole canvas, front first kept", C.length === 3 && C[0].name === "Title" && C[2].where === "all" && C[1].where === "centre", C);
  check("clean: a name or a description alone is enough (the other filled from it); 12 at most", ML.clean([{ desc: "only words" }])[0].name === "Layer 1" && ML.clean([{ name: "Logo" }])[0].desc === "Logo" && ML.clean(Array.from({ length: 20 }, (_, i) => ({ name: "L" + i }))).length === 12);
  const J = JSON.parse(ML.t2iPrompt(rows, { w: 1536, h: 1024, style: "flat poster", lighting: "" }));
  check("0.2-Design's prompt: exactly canvas_settings + layers (its schema)", JSON.stringify(Object.keys(J)) === '["canvas_settings","layers"]' && JSON.stringify(Object.keys(J.canvas_settings)) === '["aspect_ratio","ambient_lighting","image_style"]', Object.keys(J));
  check("…its layers from the BACKGROUND up (the list is front first)", J.layers.length === 3 && /^Background:/.test(J.layers[0].description) && /^Title:/.test(J.layers[2].description), J.layers.map((l) => l.description));
  check("…each with the four fields, coordinates as Ming's string", J.layers.every((l) => JSON.stringify(Object.keys(l)) === '["description","coordinates","hierarchy_and_relation","color_specs"]') && J.layers[2].coordinates === "cx: 0.500, cy: 0.200, w: 1.000, h: 0.400" && J.layers[0].coordinates === "cx: 0.500, cy: 0.500, w: 1.000, h: 1.000", J.layers.map((l) => l.coordinates));
  check("…the order said in words; the colours written as #hex picked up", /background/i.test(J.layers[0].hierarchy_and_relation) && /front-most/.test(J.layers[2].hierarchy_and_relation) && JSON.stringify(J.layers[2].color_specs) === '["#FFFFFF"]' && JSON.stringify(J.layers[1].color_specs) === '["#D62828"]', J.layers.map((l) => [l.hierarchy_and_relation, l.color_specs]));
  check("…the quoted words kept verbatim, the canvas 3:2 1536 × 1024, your style; a lighting line when none is given", J.layers[2].description.includes('"SUMMER SALE"') && J.canvas_settings.aspect_ratio === "3:2, 1536 × 1024 px" && J.canvas_settings.image_style === "flat poster" && J.canvas_settings.ambient_lighting.length > 10, J.canvas_settings);
  const P = ML.layerPlan(rows);
  check("0.1-Design-Layer's plan: the count line both ways + Layer 1 the front, the last the background (its own format)", /^Decompose this image into 3 layers with the following specifications:/.test(P) && /\nNumber of layers: 3\n/.test(P) && /\nLayer 1: Title - The words "SUMMER SALE"/.test(P) && /\nLayer 3: Background - Sunny beach gradient \(the background\)$/.test(P), P);
  const s1 = ML.sizeFor(1920, 1080, 1024), s2 = ML.sizeFor(1000, 1000, 2048), s3 = ML.sizeFor(5000, 100, 1024);
  check("sizeFor: the canvas's shape at ~1 MP / ~4 MP, 16-px steps, held to 1:4 .. 4:1", s1.w % 16 === 0 && s1.h % 16 === 0 && Math.abs(s1.w / s1.h - 16 / 9) < 0.02 && Math.abs(s1.w * s1.h / 1048576 - 1) < 0.03 && s2.w === 2048 && s2.h === 2048 && s3.w / s3.h === 4, [s1, s2, s3]);
  check("stem: a safe file name", ML.stem("Summer sale / 2026!") === "Summer_sale_2026" && ML.stem("") === "design");

  /* ---------------- the add-on */
  const A = require(path.join(ROOT, "lib/mingAddon.js"));
  const rq = A.reqLines("torch==2.4.0\ntorchvision==0.19.0\ntransformers==4.57.1\ndiffusers==0.36.0\ntransformer-engine[pytorch]==1.11.0\nnumpy==1.23.1\n# flash-attn==2.7.3\nPillow==10.4.0\n");
  check("requirements: torch / torchvision / transformer-engine / its numpy pin out (bitGen's torch 2.8 for RTX 50; no TE wheels on Windows; numpy 1.23 has none past Python 3.11), numpy < 2 in", rq.join() === "transformers==4.57.1,diffusers==0.36.0,Pillow==10.4.0,numpy>=1.26,<2", rq);
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "ming-")), p = A.paths(base);
  check("not installed: the code, its Python, its packages and both models missing; the note says so", A.missing(base).length === 5 && !A.ready(base) && /not installed/.test(A.status(base).note) && /80 GB/.test(A.status(base).note));
  check("the Download box ticks: 0.2-Design and 0.1-Design-Layer, both ticked by default", JSON.stringify(A.status(base).items.map((i) => [i.id, i.dflt, i.present])) === '[["gen",true,false],["layer",true,false]]');
  // the install with a fake runner: only the layer model ticked
  const SA = require(path.join(ROOT, "lib/speechAddons.js")), realOk = SA.pythonOk; SA.pythonOk = async () => ({ ver: "3.12" });
  const calls = [];
  const run = async (exe, args, o) => {
    calls.push(path.basename(exe) + " " + args.join(" ") + (o && o.env && o.env.HF_TOKEN ? " [token]" : ""));
    if (args[0] === "-m" && args[1] === "venv") { fs.mkdirSync(path.dirname(p.python), { recursive: true }); fs.writeFileSync(p.python, "#!"); return 0; }
    return 0;
  };
  const fetchRepo = async (_u, dest) => { fs.mkdirSync(dest, { recursive: true }); fs.writeFileSync(path.join(dest, "infer.py"), "x"); fs.writeFileSync(path.join(dest, "requirements.txt"), "torch==2.4.0\ntransformers==4.57.1\nnumpy==1.23.1\n"); return { ok: true }; };
  let r;
  try { r = await A.install({ base, run, python: "/usr/bin/python3", gpu: { cuda: true, torch: ["cu128"] }, uv: "uv", log: () => {}, fetchRepo, hfToken: "hf_x", picks: ["layer"] }); } finally { SA.pythonOk = realOk; }
  const txt = calls.join("\n");
  check("install: its venv, torch 2.8 + cu128 (RTX 50), its packages, only the ticked model downloaded (with your token)", r && r.ok && /torch==2\.8\.0 torchvision==0\.23\.0 --index-url https:\/\/download\.pytorch\.org\/whl\/cu128/.test(txt) && /Ming-Image-0\.1-Design-Layer.*\[token\]/.test(txt) && !/Ming-Image-0\.2-Design/.test(txt), { r, txt: txt.slice(0, 600) });
  check("…the requirements file written without torch, with numpy < 2", /transformers==4\.57\.1/.test(fs.readFileSync(path.join(p.dir, "requirements-bitgen.txt"), "utf8")) && !/^torch/m.test(fs.readFileSync(path.join(p.dir, "requirements-bitgen.txt"), "utf8")) && /numpy>=1\.26,<2/.test(fs.readFileSync(path.join(p.dir, "requirements-bitgen.txt"), "utf8")));
  check("…ready with one model: it splits pictures; the note says to tick the other", A.ready(base) && A.haveWeights(base).layer && !A.haveWeights(base).gen && /splits pictures into layers/.test(A.status(base).note) && /Tick the other/.test(A.status(base).note), A.status(base).note);

  /* ---------------- the job */
  process.env.BITGEN_ADDON_BASE = base;
  check("no rows -> refused in words", /add at least one layer/.test(A.jobParams({ rows: [] }).error));
  check("making a design here without 0.2-Design -> 409 with what is missing (the Download box)", (() => { const j = A.jobParams({ rows, engine: "local", w: 800, h: 600 }); return j.status === 409 && j.missing.some((m) => m.id === "w_gen") && /OpenRouter/.test(j.error); })());
  const pic = path.join(base, "in.png"); fs.writeFileSync(pic, "png");
  const sp = A.jobParams({ rows, engine: "local", input: pic, layer_res: 512, gpus: "1" });
  check("splitting the open picture here (0.1-Design-Layer installed): no design step, the plan, 512, the first card", sp.params && sp.params.mode === "ming" && !sp.params.generate && sp.params.split && sp.params.input === pic && sp.params.t2i_prompt === null && /Number of layers: 3/.test(sp.params.layer_plan) && sp.params.layer_res === 512 && sp.params.gpus === 1 && sp.params.ming.python === p.python, sp);
  check("splitting needs two layers at least", /at least two layers/.test(A.jobParams({ rows: [rows[0]], engine: "local", input: pic }).error));
  check("☁ OpenRouter without your key -> how to add it", /API key/.test(A.jobParams({ rows, engine: "openrouter" }).error));
  const oj = A.jobParams({ rows, engine: "openrouter", orKey: "sk-or-x", w: 1920, h: 1080, level: 2048, seed: "7", style: "flat poster" });
  check("☁ OpenRouter: the design + the layers, 0.2-Design first then 0.1 (what OpenRouter has), the key NOT in the params (lib/orRender.js jobApis)",
    oj.params && oj.params.generate && oj.params.split && oj.params.engine === "openrouter" && oj.params.ming.gen[0] === "inclusionai/ming-image-0.2-design" && oj.params.ming.gen[1] === "inclusionai/ming-image-0.1-design" && oj.params.ming.layer === "inclusionai/ming-image-0.1-design-layer"
    && oj.params.style.api_id === require(path.join(ROOT, "lib/orRender.js")).API_ID && !JSON.stringify(oj.params).includes("sk-or-x") && oj.params.seed === 7 && oj.params.width / oj.params.height > 1.7, oj);
  check("…the design's prompt at the size it will be made", JSON.parse(oj.params.t2i_prompt).canvas_settings.aspect_ratio.endsWith(`${oj.params.width} × ${oj.params.height} px`));
  check("one layer, or Separate layers unticked: the design only", !A.jobParams({ rows: [rows[0]], engine: "openrouter", orKey: "k" }).params.split && !A.jobParams({ rows, engine: "openrouter", orKey: "k", split: false }).params.split);
  const cfg = { rgpu: { openrouter: { key: "sk-or-x" } } };
  check("lib/orRender.js jobApis puts the OpenRouter key in job.json for it (only there)", require(path.join(ROOT, "lib/orRender.js")).jobApis(cfg, oj.params) === true && cfg.apis.__openrouter.key === "sk-or-x");
  delete process.env.BITGEN_ADDON_BASE;

  /* ---------------- the dialog's pure parts */
  check("pcming check: a list, 12 at most, splitting needs a picture and two layers", PM.check({ rows: [] }) !== "" && PM.check({ rows: PM.DEFAULT_ROWS, mode: "make" }) === "" && /two layers/.test(PM.check({ rows: [{ name: "a" }], mode: "split", hasPicture: true })) && /open a picture/.test(PM.check({ rows: PM.DEFAULT_ROWS, mode: "split", hasPicture: false })));
  const so = PM.sortOutputs(["Title_ming.png", "Title_ming_L03_Background.png", "Title_ming_L01_Title.png", "Title_ming_L02_Shoe.png"]);
  check("pcming sortOutputs: the design + the layers front first", so.flat === "Title_ming.png" && so.layers.join() === "Title_ming_L01_Title.png,Title_ming_L02_Shoe.png,Title_ming_L03_Background.png", so);

  /* ---------------- the wiring */
  const core = read("lib/core.js"), idx = read("routes/index.js"), rt = read("routes/ming.js"), wk = read("misc/ming_worker.py"), ui = read("ext/imageeditdock/pcming.js");
  const EJ = JSON.parse(read("ext/imageeditdock/ext.json")).scripts;
  check("mode ming -> misc/ming_worker.py; the route mounted from routes/index.js (server.js untouched)", /ming: "ming_worker\.py"/.test(core) && /require\("\.\/ming"\)\.mount\(app\)/.test(idx) && !/ming/i.test(read("misc/server.js")));
  check("Settings ▸ Add-ons lists it (ticks passed to its install)", (() => { const L = require(path.join(ROOT, "lib/addons.js")).LIST, a = L.find((x) => x.id === "ming"); return !!a && typeof a.install === "function" && /picks/.test(a.install.toString()) && a.links().length === 3; })());
  check("the route: 409 needs ming when not installed; the picture to split comes as a data URL into the project's temp", /needs: jp\.status === 409 \? "ming"/.test(rt) && /core\.tempDir\(\)/.test(rt) && /data:image\\\/\(png\|jpeg\|webp\);base64/.test(rt));
  check("the worker runs Ming-Image's own infer.py (text-to-image, then layer-decompose), offline, spread over the cards; OpenRouter by /images", /"--task", "text-to-image"/.test(wk) && /"--task", "layer-decompose"/.test(wk) && /HF_HUB_OFFLINE="1"/.test(wk) && /"--device-map", "balanced", "--num-gpus"/.test(wk) && /base \+ "\/images"/.test(wk) && /input_references/.test(wk));
  check("the worker drops the composite OpenRouter may send first, names each layer after its row, says when the count differs", /len\(pics\) == want \+ 1/.test(wk) && /_ming_L\{i \+ 1:02d\}_/.test(wk) && /the model gave/.test(wk));
  check("the editor: Layer ▸ 🧩 Ming Layered Design… with ＋ Add layer rows (name, description, where), the 409 opens the add-on's Download box", /"layer\.ming", "🧩 Ming Layered Design…"/.test(ui) && /＋ Add layer/.test(ui) && /class="pmName"/.test(ui) && /class="pmDesc"/.test(ui) && /class="pmWhere"/.test(ui) && /A\.act\("ming", "install"\)/.test(ui));
  check("…the layers come in a 🧩 group, the background first so the front is on top, one undo step", /E\.structOp\(imgs\.length \? "🧩 Ming layers"/.test(ui) && /for \(let i = imgs\.length - 1; i >= 0; i--\)/.test(ui) && /makeLayer\(name, S\.w, S\.h, "group"\)/.test(ui));
  check("pcming.js loads before the editor installs it", EJ.includes("pcming.js") && EJ.indexOf("pcming.js") < EJ.indexOf("imageedit.js") && /win\.PCMing\.install\(E\)/.test(read("ext/imageeditdock/imageedit.js")));
  console.log("\n" + pass + " passed, " + fail + " failed");
  console.log("RESULT: " + fail + " failed");
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log("FAIL: threw " + (e && e.stack || e)); console.log("RESULT: 1 failed"); process.exit(1); });
