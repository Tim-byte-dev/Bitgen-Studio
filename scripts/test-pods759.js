#!/usr/bin/env node
/* bitGen Studio — 2.759.0 units: ⬇ Models onto a RunPod pod + pods for a style (lib/podModels.js).
 * Tim (verbatim): "if i select a pod, how do i choose what model comfyui template to use and to dl it?" (asked: "Both"). */
"use strict";
const fs = require("fs"), os = require("os"), path = require("path"), Module = require("module");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 600))); } };
const rd = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "pods759-"));
let CFG = { rgpu: {} };
const coreP = require.resolve("../lib/core");
const fake = new Module(coreP); fake.filename = coreP; fake.loaded = true;
fake.exports = { getConfig: () => CFG, setConfig: (c) => { CFG = c; }, STYLES_DIR: TMP, BASE: ROOT };
require.cache[coreP] = fake;
const PM = require("../lib/podModels"), SEC = require("../lib/secrets"), P = require("../lib/pods"), S = require("../lib/styles");
const CAT = JSON.parse(rd("lib", "modelCatalog.json"));

check("urlOf / folderOf: a catalogue entry -> its Hugging Face address and its ComfyUI folder",
  PM.urlOf({ repo: "Comfy-Org/Krea-2", file: "diffusion_models/krea2_turbo_fp8_scaled.safetensors" }) === "https://huggingface.co/Comfy-Org/Krea-2/resolve/main/diffusion_models/krea2_turbo_fp8_scaled.safetensors"
  && PM.folderOf({ dest: "comfy/diffusion_models" }) === "diffusion_models" && PM.folderOf({ dest: "hf-cache" }) === "");
const krea = S.STARTER_STYLES.find((s) => s.name === "Krea 2 Turbo");
const pl = PM.plan([{ style: krea, graph: JSON.parse(rd(krea.workflow)), kind: "image" }], CAT);
check("plan: Krea 2 Turbo's files from its workflow - the model, its text encoder, its VAE - each with its folder and address from bitGen's download list",
  pl.files.some((f) => f.name === "krea2_turbo_fp8_scaled.safetensors" && f.folder === "diffusion_models" && /^https:\/\/huggingface\.co\/Comfy-Org\/Krea-2\/resolve\/main\//.test(f.url))
  && pl.files.length >= 2 && pl.files.every((f) => f.folder && f.size > 0), pl);
check("…a file bitGen's list lacks is named, not guessed", PM.plan([{ style: {}, graph: { 1: { class_type: "UNETLoader", inputs: { unet_name: "nobody_has_this.safetensors" } } }, kind: "image" }], CAT).unknown.join() === "nobody_has_this.safetensors");
const MLIST = { models: [{ name: "Qwen-Image", filename: "qwen_image_bf16.safetensors", save_path: "default", type: "diffusion_model", base: "Qwen-Image", url: "https://huggingface.co/x/y/resolve/main/qwen_image_bf16.safetensors" }] };
check("managerMatch: ComfyUI-Manager can fetch only what its own list holds", !!PM.managerMatch({ name: "qwen_image_bf16.safetensors", folder: "diffusion_models" }, MLIST) && PM.managerMatch({ name: "z_image_turbo_bf16.safetensors" }, MLIST) === null);
check("comfyDir: ComfyUI's folder from its /system_stats argv (main.py) - or none", PM.comfyDir({ system: { argv: ["/workspace/ComfyUI/main.py", "--listen"] } }) === "/workspace/ComfyUI" && PM.comfyDir({ system: { argv: ["main.py"] } }) === "" && PM.comfyDir({}) === "");
const code = PM.dlCode([{ name: "a.safetensors", folder: "vae", url: "https://huggingface.co/r/f/resolve/main/a.safetensors", size: 5 }], "/workspace/ComfyUI", "hf_x");
check("dlCode: the Python a pod's Jupyter runs - a background thread, each file to <comfy>/models/<folder>, a .part then renamed, one already there skipped, progress in .bitgen_dl.json, the token only as a header",
  /threading\.Thread\(target=run, daemon=True\)\.start\(\)/.test(code) && /os\.path\.join\(J\['comfy'\], 'models', f\['folder'\]\)/.test(code) && /os\.replace\(dst \+ '\.part', dst\)/.test(code)
  && /'there already'/.test(code) && /\.bitgen_dl\.json/.test(code) && /J\['token'\] if f\['url'\]\.startswith\(J\['hf'\] \+ '\/'\)/.test(code) && /h\['Authorization'\] = 'Bearer ' \+ tk/.test(code) && /print\('bitgen-started'\)/.test(code));
check("templateScore: a template whose name / image carries the style's model family comes first (ComfyUI ones a little higher); others 0",
  PM.templateScore({ name: "ComfyUI - Qwen Image - ZiT - Boogu - Krea", image: "ls250824/run-comfyui-image", comfy: true }, { arch: "krea2" }) === 13
  && PM.templateScore({ name: "ComfyUI - Qwen Image - ZiT - Boogu - Krea", comfy: true }, { arch: "z-image" }) === 13 && PM.templateScore({ name: "PyTorch 2.8" }, { arch: "krea2" }) === 0);
const PD = rd("static", "podsdock.js"), vm = require("vm"), ctx = { window: { document: null } }; ctx.window.window = ctx.window; vm.createContext(ctx);
const W = new Function(PD.slice(PD.indexOf("var WORDS = "), PD.indexOf("function loadStyles")) + "return { WORDS, templateScore };")();
check("…the PODS docker scores the same (its words = the server's)", JSON.stringify(W.WORDS) === JSON.stringify(PM.WORDS)
  && [{ name: "Krea dev ComfyUI", comfy: true }, { name: "wan 2.2" }, { name: "x" }].every((t) => ["krea2", "wan", "z-image", "sdxl"].every((a) => W.templateScore(t, { arch: a }) === PM.templateScore(t, { arch: a }))));
// creating a pod
const b = P.createBody({ templateId: "abcd1234", gpu: "X", jupyter: "pw", ports: ["3000/http", "22/tcp", "bad"] });
check("createBody: a pod bitGen creates gets bitGen's own Jupyter password (env) and the template's ports + 8888/http (ports replace the template's)",
  b.env.JUPYTER_PASSWORD === "pw" && b.ports.join() === "3000/http,22/tcp,8888/http" && !("env" in P.createBody({ templateId: "abcd1234", gpu: "X" })), b);
check("…the password kept encrypted per pod (rgpu.pod_jupyter.<id> - lib/secrets.js), dropped from custom.settings",
  SEC.isKeyPath("rgpu.pod_jupyter.abc123") && SEC.pathsOf({ rgpu: { pod_jupyter: { abc123: "x" } } }).includes("rgpu.pod_jupyter.abc123") && !JSON.stringify(SEC.strip({ rgpu: { pod_jupyter: { abc123: "secretpw" } } })).includes("secretpw"));
const PJ = rd("lib", "pods.js");
check("lib/pods.js create: the template's ports from RunPod's list, a random password, kept with setJupyter; for_style remembered (rgpu.pod_for)",
  /o\.jupyter = require\("crypto"\)\.randomBytes\(18\)\.toString\("base64url"\)/.test(PJ) && /require\("\.\/podModels"\)\.setJupyter\(p\.id, o\.jupyter\)/.test(PJ) && /c\.rgpu\.pod_for = /.test(PJ));
check("lib/remoteGpu.js: a pod made for a style makes its P_ style once loaded (lib/podStyles.js autoFor)", /require\("\.\/podStyles"\)\.autoFor\(m\.id, want/.test(rd("lib", "remoteGpu.js")));
const RT = rd("routes", "pods.js");
check("routes/pods.js: catalog / plan / ways / models (GET state, POST start), before /:id/:action",
  ["/api/pods/catalog", "/api/pods/plan", "/api/pods/:id/ways", "/api/pods/:id/models"].every((r) => RT.includes('"' + r + '"') && RT.indexOf('"' + r + '"') < RT.indexOf('"/api/pods/:id/:action"')));
const PL = rd("static", "podload.js");
check("the PODS docker: ⬇ Models on a running pod (a style ticks its files, a search of bitGen's list, the Jupyter password box when needed, a bar per file, then 🎨 Make P_ styles); For style + ✓ fits on the cards; Create sends for_style",
  /data-pdmod/.test(PD) && /H3PodLoad\.models\(host, p,/.test(PD) && /id="pdFor"/.test(PD) && /✓ fits /.test(PD) && /for_style: S\.forStyle/.test(PD)
  && /data-pmstyle/.test(PL) && /data-pmq/.test(PL) && /data-pmpw/.test(PL) && /data-pmsty/.test(PL) && /\/api\/pods\/plan/.test(PL));
check("+ \"add mounting the model in the pod from the hdd or link?\": nameFromLink (the link's file name, a model extension added when it has none), only ComfyUI model folders; the routes; the panel's link box, folder list and ⬆ From this computer… (bitGen's Open dialog)",
  PM.nameFromLink("https://civitai.com/api/download/models/12345") === "12345.safetensors" && PM.nameFromLink("https://h/x/my%20lora.safetensors?x=1") === "my lora.safetensors"
  && PM.FOLDERS.includes("loras") && !PM.FOLDERS.includes("..") && RT.includes('"/api/pods/:id/link"') && RT.includes('"/api/pods/:id/upload"')
  && /data-pmlink/.test(PL) && /data-pmfold/.test(PL) && /FileDialog\.open\(\{ mode: "file"/.test(PL) && /\/api\/pods\/" \+ encodeURIComponent\(pod\.id\) \+ "\/upload"/.test(PL));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
