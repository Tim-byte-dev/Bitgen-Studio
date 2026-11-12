#!/usr/bin/env node
/* bitGen Studio — 2.766.2 units: Basic Settings' Local / Remote switches the app over (lib/modeSwitch.js): local = this
 * computer's model folders + ComfyUI started when it is not running; remote = the ComfyUI bitGen started here stopped, the
 * remote models listed, the folder filter = their model families (lib/remoteModels.js familyOf / asComfyModels, index.html
 * cmFolderKey).
 * Tim (verbatim): "when local is selected in basic settings go to local mode . show all the local model folders in folder
 * filter, check if comfyui is running, start it if it is not running. and continue as normal local mode. in remote mode stop
 * comfyi if it is running, clear the folders in folder filer in basic settings and show the model families instead, list the
 * models in the remote models list, filter by family" */
"use strict";
const fs = require("fs"), os = require("os"), path = require("path"), Module = require("module");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const T = fs.mkdtempSync(path.join(os.tmpdir(), "modeswitch7662-"));
process.env.H3_REMOTE_MODELS = path.join(T, "remote_models.json");
let CFG = { rgpu: { enabled: true, engine: { provider: "runpod", runpod: "pods" }, split: { where: "remote" } } };
const coreP = require.resolve("../lib/core");
const fake = new Module(coreP); fake.filename = coreP; fake.loaded = true;
fake.exports = { getConfig: () => CFG, setConfig: (c) => { CFG = c; }, BASE: ROOT, STYLES_DIR: T };
require.cache[coreP] = fake;
// a stand-in lib/comfy.js
const comfyP = require.resolve("../lib/comfy"), cf = new Module(comfyP); cf.filename = comfyP; cf.loaded = true;
const C = { up: false, managed: false, calls: [] };
cf.exports = { status: async () => ({ reachable: C.up, backend: "comfy", managed: C.managed }), stop: () => { C.calls.push("stop"); if (!C.managed) return { stopped: false }; C.managed = false; C.up = false; return { stopped: true }; },
  ensure: async (o) => { C.calls.push("ensure" + (o && o.force ? ":force" : "")); C.managed = true; return { started: true }; } };
require.cache[comfyP] = cf;
const MS = require("../lib/modeSwitch"), RM = require("../lib/remoteModels");

(async () => {
  check("remoteWhere: Remote, or Both with images / video remote; Local / Both with only the LLM remote = local", MS.remoteWhere({ where: "remote" }) && MS.remoteWhere({ where: "both", image: true }) && !MS.remoteWhere({ where: "local" }) && !MS.remoteWhere({ where: "both", llm: true }));
  check("podsMode follows Basic Settings ▸ GPU: Remote = remote; Local = local mode even with pods set up", RM.podsMode() === true && (() => { CFG.rgpu.split.where = "local"; const m = RM.podsMode(); CFG.rgpu.split.where = "remote"; return m === false; })());
  // remote -> local: ComfyUI not running -> started
  let before = MS.modeOf(); CFG.rgpu.split.where = "local";
  let r = await MS.after(before);
  check("-> Local: ComfyUI here not running -> started (in the background); the note says so", r.mode === "local" && r.changed && r.comfy === "starting" && C.calls.join() === "ensure:force" && /starting ComfyUI on this computer/.test(r.note), { r, calls: C.calls });
  C.calls.length = 0; C.up = true;
  before = "remote"; r = await MS.after(before);
  check("…already running -> left running, said", r.comfy === "running" && !C.calls.length && /ComfyUI is running/.test(r.note), r);
  // local -> remote: the ComfyUI bitGen started is stopped
  C.managed = true; C.up = true; C.calls.length = 0;
  before = MS.modeOf(); CFG.rgpu.split.where = "remote";
  r = await MS.after(before);
  check("-> Remote: the ComfyUI bitGen started here is stopped; the note says the pods render", r.mode === "remote" && r.changed && r.comfy === "stopped" && C.calls.join() === "stop" && /ComfyUI on this computer was stopped/.test(r.note), r);
  C.managed = false; C.up = true; r = await MS.after("local");
  check("…a ComfyUI started some other way: left open - said (bitGen cannot close it)", r.comfy === "left" && /not started by bitGen, so it is still open/.test(r.note), r);
  C.calls.length = 0; r = await MS.after("remote");
  check("no change of mode -> nothing done", !r.changed && r.comfy === "" && !C.calls.length);
  // the families
  RM.save([]);
  RM.add({ folder: "diffusion_models", name: "krea2_raw_fp8_scaled.safetensors", url: "https://x.io/k" });
  RM.add({ folder: "checkpoints", name: "my_merge.safetensors", url: "https://x.io/m", base_model: "Flux.1 D" });
  RM.add({ folder: "loras", name: "pony_style.safetensors", url: "https://x.io/p" });
  RM.add({ folder: "checkpoints", name: "zzz.safetensors", url: "https://x.io/z" });
  const L = RM.load(), fam = L.map((e) => RM.familyOf(e));
  check("familyOf: by the name (krea2 -> Krea, pony -> Pony), else Civitai's base model (Flux.1 D -> Flux), else Other", /Krea/.test(fam[0]) && /Flux/.test(fam[1]) && /Pony/.test(fam[2]) && fam[3] === "Other", fam);
  const cm = RM.asComfyModels(L);
  check("asComfyModels: each model's folder = its family (Basic Settings' folder filter lists families)", cm.categories.diffusion_models.files[0].folder === fam[0] && cm.categories.checkpoints.files.find((f) => f.name === "my_merge.safetensors").folder === fam[1]);
  const card = RM.cardOf(L[1], require("../lib/modelCards").cardFrom);
  check("…Model manager's folder tabs too", card.folder === fam[1]);
  // the page
  const src = (f) => fs.readFileSync(path.join(ROOT, f), "utf8"), IX = src("static/index.html");
  check("index.html: remote mode = one choice per family across checkpoints / diffusion models ('fam:<family>'), 'All model families'; local = category/folder as before",
    /function cmFolderKey\(f\) \{ return cmData && cmData\.remote \? "fam:" \+ f\.folder : f\.category \+ "\/" \+ f\.folder; \}/.test(IX) && /All model families/.test(IX) && (IX.match(/cmFolderKey\(f\)/g) || []).length >= 4 && !/f\.category \+ "\/" \+ f\.folder === filter/.test(IX));
  check("routes: POST /api/gpusplit and /api/remotegen/enabled switch the app over (mode_switch in the answer)", /mode_switch: await MS\.after\(before\)/.test(src("routes/gpuSplit.js")) && /mode_switch: await MS\.after\(before\)/.test(src("routes/remoteDock.js")));
  check("Basic Settings ▸ GPU: the note, and the page's model lists read again at once (H3RemoteModels.recheck)", /if \(v\.mode_switch && v\.mode_switch\.changed\)/.test(src("static/gpusplit.js")) && /H3RemoteModels\.recheck\(true\)/.test(src("static/gpusplit.js")) && /recheck: recheck/.test(src("static/remotemodels.js")));
  fs.rmSync(T, { recursive: true, force: true });
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log("FAIL: crashed " + (e && e.stack)); console.log("RESULT: FAIL"); process.exit(1); });
