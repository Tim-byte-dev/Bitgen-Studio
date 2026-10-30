#!/usr/bin/env node
/* bitGen Studio — 2.622.0 (pure + fixtures + wiring): THE COMFYUI INSTALLED HERE, IN THE MODEL LISTS.
 * Tim: "if comfyui is installed add the diffusion models and checkpoint folder models to our model list in basic settings
 * and the model manager"
 *   lib/comfyDetect.js finds a ComfyUI when Settings ▸ ComfyUI ▸ Folder is empty (env vars, beside the app, the home
 *   folder, Pinokio, Stability Matrix, drive tops, ComfyUI Desktop); /api/comfymodels (Basic Settings' checkpoint + video
 *   Model lists) and lib/modelCards.js (the 🧩 Model manager) scan it - its checkpoints AND diffusion models (+ unet). */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const R = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const read = (p) => fs.readFileSync(path.join(R, p), "utf8");
delete process.env.BITGEN_NO_COMFY_DETECT;
const CD = require(path.join(R, "lib", "comfyDetect.js"));
const T = fs.mkdtempSync(path.join(os.tmpdir(), "cd622_"));
const mk = (p, data) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, data == null ? "" : data); };
const comfy = (d) => { mk(path.join(d, "main.py")); fs.mkdirSync(path.join(d, "comfy"), { recursive: true });
  mk(path.join(d, "models", "checkpoints", "SDXL", "juggernaut.safetensors"), "x".repeat(64)); mk(path.join(d, "models", "diffusion_models", "flux1-dev.safetensors"), "x".repeat(64));
  mk(path.join(d, "models", "unet", "wan-q4.gguf"), "x".repeat(64)); mk(path.join(d, "models", "loras", "detail.safetensors"), "x".repeat(64)); return d; };

/* what a folder is */
const plain = comfy(path.join(T, "home", "ComfyUI"));
const port = path.join(T, "drive", "ComfyUI_windows_portable"); comfy(path.join(port, "ComfyUI")); fs.mkdirSync(path.join(port, "python_embeded"), { recursive: true });
check("check(): a ComfyUI folder (main.py + comfy/), a portable build (ComfyUI/main.py + python_embeded), not a random folder",
  CD.check(plain).kind === "folder" && CD.check(plain).models === path.join(plain, "models") && CD.check(port).kind === "portable" && CD.check(port).main === path.join(port, "ComfyUI") && CD.check(T) === null && CD.check(path.join(T, "nope")) === null);

/* where it looks */
const sm = path.join(T, "appdata", "StabilityMatrix", "Packages", "ComfyUI"); comfy(sm);
const C = CD.candidates({ COMFYUI_PATH: "/env/comfy", APPDATA: path.join(T, "appdata") }, { home: path.join(T, "home"), app: path.join(T, "apps", "bitgen"), drives: [path.join(T, "drive") + path.sep] });
const dirs = C.map((c) => c.dir);
check("candidates: $COMFYUI_PATH first, then beside bitGen Studio, the home folder (ComfyUI, the portable build, Documents / Desktop / Downloads), Pinokio, Stability Matrix's packages, the drive tops",
  dirs[0] === path.resolve("/env/comfy") && dirs.includes(path.join(T, "apps", "bitgen", "ComfyUI")) && dirs.includes(path.join(T, "apps", "ComfyUI")) && dirs.includes(plain) && dirs.includes(path.join(T, "home", "Documents", "ComfyUI"))
  && dirs.includes(path.join(T, "home", "pinokio", "api", "comfy.git", "app")) && dirs.includes(sm) && dirs.includes(port), dirs.slice(0, 8));
let d = CD.detect({ refresh: true, env: { APPDATA: path.join(T, "appdata") }, home: path.join(T, "home"), drives: [] });
check("detect(): the first one that IS a ComfyUI - ~/ComfyUI here (Settings has no folder)", d && d.root === plain && d.kind === "folder" && d.configured === false && /home folder/.test(d.source), d);
d = CD.detect({ refresh: true, env: {}, home: path.join(T, "nobody"), drives: [path.join(T, "drive") + path.sep] });
check("…on a drive top: the portable build (its ComfyUI folder scanned)", d && d.kind === "portable" && d.root === port && d.main === path.join(port, "ComfyUI"), d);
// ComfyUI Desktop: config.json's basePath + extra_models_config.yaml in the per-user folder
const base = path.join(T, "Documents", "ComfyUI"); mk(path.join(base, "models", "checkpoints", "dreamshaper.safetensors"), "x"); mk(path.join(base, "models", "diffusion_models", "qwen-image.safetensors"), "x");
const ad = path.join(T, "desk-appdata"); mk(path.join(ad, "ComfyUI", "config.json"), JSON.stringify({ basePath: base })); mk(path.join(ad, "ComfyUI", "extra_models_config.yaml"), "comfyui:\n  base_path: " + base + "\n");
d = CD.detect({ refresh: true, env: { APPDATA: ad }, home: path.join(T, "nobody"), drives: [] });
check("ComfyUI Desktop: its basePath (models there) + its extra_models_config.yaml", d && d.kind === "desktop" && d.root === base && /extra_models_config\.yaml$/.test(d.yaml) && /ComfyUI Desktop/.test(d.source), d);
check("nothing installed: null (the lists stay as they were)", CD.detect({ refresh: true, env: {}, home: path.join(T, "nobody"), drives: [] }) === null);

/* the lists scan it */
const comfyModels = require(path.join(R, "lib", "comfyModels.js"));
const tg = CD.scanTarget({}, { root: port, main: path.join(port, "ComfyUI"), kind: "portable", yaml: "", source: "x" });
const sc = comfyModels.scan(tg.dirAbs, { extraPaths: tg.extraPaths });
const names = (cat) => ((sc.categories[cat] || {}).files || []).map((f) => f.name).sort().join();
check("scanTarget(): the found ComfyUI's folder (a portable build's ComfyUI/) - its checkpoints and diffusion models (unet too) are listed",
  tg.dirAbs === path.join(port, "ComfyUI") && names("checkpoints") === "SDXL/juggernaut.safetensors" && names("diffusion_models") === "flux1-dev.safetensors,wan-q4.gguf", { tg, c: names("checkpoints"), d: names("diffusion_models") });
const set = CD.scanTarget({ dir: plain, extra_paths: "" }, null);
check("…Settings' own folder always wins (nothing detected over it)", set.dirAbs === plain && set.detected === null);
const tgd = CD.scanTarget({}, { root: base, main: "", kind: "desktop", yaml: path.join(ad, "ComfyUI", "extra_models_config.yaml"), source: "d" });
const scd = comfyModels.scan(tgd.dirAbs, { extraPaths: tgd.extraPaths });
check("…a Desktop install: its basePath scanned with its yaml", ((scd.categories.checkpoints || {}).files || []).some((f) => f.name === "dreamshaper.safetensors") && ((scd.categories.diffusion_models || {}).files || []).some((f) => f.name === "qwen-image.safetensors"));

// the Model manager's cards (lib/modelCards.js) from a found ComfyUI ($COMFYUI_PATH) when Settings has no folder
const core = require(path.join(R, "lib", "core.js"));
const cfg = core.getConfig(); cfg.engine = cfg.engine || {}; cfg.engine.comfy = cfg.engine.comfy || {};
const keepDir = cfg.engine.comfy.dir; cfg.engine.comfy.dir = "";
process.env.COMFYUI_PATH = plain; CD.reset();
const cards = require(path.join(R, "lib", "modelCards.js")).list({ refresh: true, live: { roots: [], names: {}, at: 0 } });
cfg.engine.comfy.dir = keepDir; delete process.env.COMFYUI_PATH; CD.reset();
const cn = cards.models.map((c) => c.cat + ":" + c.name).sort();
check("🧩 Model manager: a card for every checkpoint and diffusion model of the ComfyUI found (+ its LoRAs), and it says where it was found",
  cn.join() === "checkpoints:SDXL/juggernaut.safetensors,diffusion_models:flux1-dev.safetensors,diffusion_models:wan-q4.gguf" && cards.loras.length === 1 && cards.detected && cards.detected.root === plain && /ComfyUI found at/.test(cards.warnings[0]), { cn, det: cards.detected, w: cards.warnings });

/* the wiring */
const RI = read("routes/index.js"), RD = read("routes/comfyDetect.js"), MC = read("lib/modelCards.js"), JS = read("static/comfydetect.js"), IH = read("static/index.html");
check("/api/comfymodels (Basic Settings' checkpoint + video Model lists) and the Model manager's scan use it; the route mounted from routes/index.js",
  /require\("\.\.\/lib\/comfyDetect"\)\.scanTarget\(c\)/.test(RI) && /data\.detected = /.test(RI) && /require\("\.\/comfyDetect"\)\.scanTarget\(c\)/.test(MC) && /require\("\.\/comfyDetect"\)\.mount\(app\)/.test(RI)
  && /app\.get\("\/api\/comfy\/detect"/.test(RD) && /app\.post\("\/api\/comfy\/detect\/use"/.test(RD) && /H3_E2E !== "1"/.test(RD));
check("Settings ▸ ComfyUI ▸ Folder: \"ComfyUI found … · Use this folder\" (static/comfydetect.js, loaded by the page)", /\/api\/comfy\/detect\/use/.test(JS) && /Use this folder/.test(JS) && /<script src="\/static\/comfydetect\.js"><\/script>/.test(IH));
check("server.js untouched by this release", !/comfyDetect|\/api\/comfy\/detect/.test(read("misc/server.js")));
fs.rmSync(T, { recursive: true, force: true });
console.log(`\n${pass} passed, ${fail} failed`);
console.log("RESULT: " + fail + " failed");
process.exit(fail ? 1 : 0);
