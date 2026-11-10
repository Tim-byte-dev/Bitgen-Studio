#!/usr/bin/env node
/* bitGen Studio — 2.749.0 units: READY-MADE REMOTE STYLES for RunPod's stock worker images + WHERE A JOB RAN IN ITS LOG.
 * Tim (verbatim): "it is still not using runpod ... [comfy] VRAM kept ... [power] 1.1 Wh (GPU ...) ... please add the remote
 * styles - but actually looks like it ran on runpod"
 *   starters   R_SDXL, R_SDXL img2img, R_FLUX.1 schnell / dev / dev fp8, R_SD3 Medium, R_Z-Image Turbo: remote, the image
 *              each needs (runpod_image), workflows of ComfyUI 0.34.0 core nodes only, the model files RunPod's Dockerfile
 *              downloads; the studio's own patcher finds the prompt, seed, steps, size (and the model override)
 *   image      runpodImage.parse ("runpod/worker-comfyui:5.10.0-sdxl" -> sdxl ...); detect = GET <rest>/endpoints/<id>?
 *              includeTemplate=true with Bearer <key> -> template.imageName (a stand-in RunPod); kept for THAT endpoint
 *              (2.755.0: RunPod's REST v2 - GET /v2/serverless, paged, each endpoint's image)
 *   lists      Remote / Both on a serverless endpoint with a known stock image: a starter for another image hidden (why);
 *              its own endpoint, base / own / not known, "node packs": shown
 *   log        [power] on a remote GPU: "rendered on <label> - about $x ...; this computer while it waited: ..."; the
 *              VRAM keep / free step skipped on the /rpsl adapter (said) */
"use strict";
const fs = require("fs"), path = require("path"), os = require("os"), http = require("http"), { execFileSync } = require("child_process");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "rs749-"));
let CFG = { engine: { comfy: { url: "http://127.0.0.1:8188" } }, rgpu: { mode: "serverless", remote_mode: "serverless", url: "", runpod: { key: "rpa_K" }, serverless: { endpoint: "ep749", cost_hr: 1.9 }, split: { where: "remote" } } };
const corePath = require.resolve("../lib/core.js");
require.cache[corePath] = { id: corePath, filename: corePath, loaded: true, exports: { BASE: ROOT, WORKSPACE: TMP, STYLES_DIR: path.join(TMP, "styles"),
  getConfig: () => JSON.parse(JSON.stringify(CFG)), setConfig: (c) => { CFG = JSON.parse(JSON.stringify(c)); } } };
const S = require("../lib/styles.js"), RS = require("../lib/rpslStyles.js"), I = require("../lib/runpodImage.js"), PW = require("../lib/power.js"), G = require("../lib/gpuSplit.js");

(async () => {
  /* ---- the starters */
  const want = { "R_SDXL": "sdxl", "R_SDXL img2img": "sdxl", "R_FLUX.1 schnell": "flux1-schnell", "R_FLUX.1 dev": "flux1-dev", "R_FLUX.1 dev fp8": "flux1-dev-fp8", "R_SD3 Medium": "sd3", "R_Z-Image Turbo": "z-image-turbo" };
  S.seedStarters(path.join(TMP, "styles"));
  const img = S.read(path.join(TMP, "styles"), "image");
  const got = Object.fromEntries(img.filter((s) => s.runs_on === "remote").map((s) => [s.name, s.runpod_image]));
  check("the ready-made remote styles are seeded: remote, each with the RunPod image it needs", JSON.stringify(Object.entries(got).sort()) === JSON.stringify(Object.entries(want).sort()), got);
  // the files RunPod's Dockerfile downloads for each image (runpod-workers/worker-comfyui)
  const FILES = { "sdxl": ["sd_xl_base_1.0.safetensors"], "flux1-schnell": ["flux1-schnell.safetensors", "clip_l.safetensors", "t5xxl_fp8_e4m3fn.safetensors", "ae.safetensors"],
    "flux1-dev": ["flux1-dev.safetensors", "clip_l.safetensors", "t5xxl_fp8_e4m3fn.safetensors", "ae.safetensors"], "flux1-dev-fp8": ["flux1-dev-fp8.safetensors"],
    "sd3": ["sd3_medium_incl_clips_t5xxlfp8.safetensors"], "z-image-turbo": ["z_image_turbo_bf16.safetensors", "qwen_3_4b.safetensors", "ae.safetensors"] };
  const cfg0 = {};
  const have = (() => { const j = require("../lib/comfyCoreNodes.json"); const v = j.versions["0.34.0"]; return new Set(Array.isArray(v) ? v : v.nodes); })();
  const bad = [];
  for (const s of img.filter((x) => x.runs_on === "remote")) {
    const wf = JSON.parse(fs.readFileSync(path.join(ROOT, s.workflow), "utf8"));
    const nodes = Object.values(wf).filter((n) => n && n.class_type).map((n) => n.class_type);   // (a "_comment" entry is not a node)
    const unknown = nodes.filter((n) => !have.has(n));
    // the model files the graph loads after the style's model override
    const loads = new Set(Object.values(wf).filter((n) => n && n.class_type).flatMap((n) => Object.entries(n.inputs || {}).filter(([k, v]) => typeof v === "string" && /_name\d?$/.test(k) && /\.safetensors$/.test(v)).map(([, v]) => v)));
    if (s.model) { for (const n of Object.values(wf)) if (n && n.class_type === "UNETLoader") loads.delete(n.inputs.unet_name); loads.add(s.model); }
    const missing = [...loads].filter((f) => !FILES[s.runpod_image].includes(f));
    if (unknown.length || missing.length) bad.push({ name: s.name, unknown, missing });
  }
  check("…each workflow: ComfyUI 0.34.0 core nodes only, and every model file it loads is in its RunPod image", bad.length === 0, bad);
  const chk = img.filter((x) => x.runs_on === "remote").map((s) => [s.name, RS.checkStyle(Object.assign({ kind: "image" }, s), RS.available("0.34.0"), cfg0)]);
  check("…the RunPod Serverless check (2.744.0) passes every one", chk.every(([, c]) => c.ok), chk.filter(([, c]) => !c.ok));
  const py = execFileSync("python3", ["-c", `
import json, sys
sys.path.insert(0, ${JSON.stringify(path.join(ROOT, "scripts"))})
import comfy_image as C
out = {}
for f, st in json.loads(sys.argv[1]):
    g = C.load_workflow(${JSON.stringify(ROOT)} + "/" + f)
    g2, rep = C.patch(g, st, {"prompt": "a red fox", "seed": 77, "width": 1024, "height": 768, "batch": 1})
    out[st["name"]] = rep
print(json.dumps(out))`, JSON.stringify(img.filter((x) => x.runs_on === "remote" && !/img2img/.test(x.name)).map((s) => [s.workflow, s]))], { encoding: "utf8" });
  const rep = JSON.parse(py);
  const okRep = Object.entries(rep).every(([n, r]) => r.some((l) => /^prompt: node/.test(l)) && r.some((l) => /^seed 77:/.test(l)) && r.some((l) => /^steps \d+:/.test(l)) && r.some((l) => /^size 1024x768:/.test(l)));
  check("…the studio's patcher finds the prompt, the seed, the steps and the size in each (text to image)", okRep, rep);
  check("…the model override lands: FLUX.1 dev = flux1-dev in the UNET loader, Z-Image Turbo = z_image_turbo_bf16", rep["R_FLUX.1 dev"].some((l) => /model: node 1\.unet_name = flux1-dev\.safetensors/.test(l)) && rep["R_Z-Image Turbo"].some((l) => /unet_name = z_image_turbo_bf16\.safetensors/.test(l)), [rep["R_FLUX.1 dev"], rep["R_Z-Image Turbo"]]);

  /* ---- the endpoint's image */
  const P = (n) => I.parse(n);
  check("parse: runpod/worker-comfyui:<version>-<image> -> the image (flux1-dev-fp8 not read as flux1-dev); no suffix = base; another image = own",
    P("runpod/worker-comfyui:5.10.0-sdxl") === "sdxl" && P("runpod/worker-comfyui:5.10.0-flux1-dev-fp8") === "flux1-dev-fp8" && P("runpod/worker-comfyui:5.10.0-flux1-dev") === "flux1-dev"
    && P("runpod/worker-comfyui:5.10.0") === "base" && P("runpod/worker-comfyui:5.10.0-base") === "base" && P("tim/comfy:1") === "own" && P("") === "");
  const seen = [];
  const srv = http.createServer((q, s) => {
    seen.push({ url: q.url, auth: q.headers.authorization });
    if (q.headers.authorization !== "Bearer rpa_K") { s.writeHead(401); return s.end("{}"); }
    // 2.755.0: RunPod's REST API v2 - the endpoints listed with their image (two pages here)
    if (/^\/v2\/serverless\?limit=1000$/.test(q.url)) { s.writeHead(200, { "Content-Type": "application/json" }); return s.end(JSON.stringify({ endpoints: [{ id: "epA", image: "x/y:1" }], pagination: { nextCursor: "c2", hasNextPage: true } })); }
    if (/^\/v2\/serverless\?limit=1000&cursor=c2$/.test(q.url)) { s.writeHead(200, { "Content-Type": "application/json" }); return s.end(JSON.stringify({ endpoints: [{ id: "ep749", image: "runpod/worker-comfyui:5.10.0-sdxl" }], pagination: { nextCursor: null, hasNextPage: false } })); }
    s.writeHead(404); s.end("{}");
  });
  await new Promise((r) => srv.listen(0, "127.0.0.1", r));
  process.env.H3_RUNPOD_REST_API = `http://127.0.0.1:${srv.address().port}/v2`;
  const k = await I.detect();
  check("detect (2.755.0: REST v2): GET <rest>/serverless, every page, with Authorization: Bearer <key> -> the endpoint's image -> sdxl, kept for that endpoint",
    k.image === "sdxl" && k.image_name === "runpod/worker-comfyui:5.10.0-sdxl" && CFG.rgpu.serverless.image_ep === "ep749" && seen[0].auth === "Bearer rpa_K", { k, seen });
  CFG.rgpu.runpod.key = "rpa_WRONG";
  let e1 = ""; try { await I.detect(); } catch (e) { e1 = e.message; }
  CFG.rgpu.runpod.key = "rpa_K";
  check("…a wrong key: \"RunPod refused the API key\"; the image known before stays", /RunPod refused the API key/.test(e1) && I.known().image === "sdxl", e1);
  srv.close();
  CFG.rgpu.serverless.endpoint = "epOTHER";
  check("…another endpoint: its image is not known (asked again)", I.known().image === "");
  CFG.rgpu.serverless.endpoint = "ep749";
  check("set: the user's pick (or base / own / not known); anything else refused", I.set("flux1-dev").image === "flux1-dev" && I.set("own").image === "own" && (() => { try { I.set("sdxl2"); return false; } catch { return true; } })());
  I.set("sdxl");

  /* ---- the lists */
  const st = RS.settings();
  const H = (s, extra) => RS.hideWhy(s, { ok: true }, Object.assign({}, st, extra || {}));
  const flux = { runs_on: "remote", runpod_image: "flux1-dev" }, sdxl = { runs_on: "remote", runpod_image: "sdxl" };
  check("settings: Remote, on a serverless endpoint, its image sdxl", st.where === "remote" && st.sls && st.image === "sdxl", st);
  check("Remote / Both: a starter for another image hidden, saying why; the sdxl ones shown", /made for RunPod's flux1-dev worker image - your endpoint runs the sdxl one/.test(H(flux)) && H(sdxl) === null && /flux1-dev/.test(H(flux, { where: "both" })) || false, H(flux));
  check("…shown: with its own endpoint, on base / own / not known, with \"node packs\", or a style the user made (no image)",
    H(Object.assign({ endpoint: "epX" }, flux)) === null && ["base", "own", ""].every((i) => H(flux, { image: i }) === null) && H(flux, { show_all: true }) === null && H({ runs_on: "remote" }) === null);

  /* ---- the log */
  const rw = PW.remoteWords({ wh: 1.1, secs: 33, gpu_measured: true, gpu_wh: 1.1, w_avg: 125, w_peak: 135 }, { label: "RunPod Serverless ep749", cost_hr: 1.9 }, { price_kwh: 0.28, currency: "AUD" });
  check("[power] for a remote render: where it rendered and about what it cost ($/h as RunPod lists it), then this computer while it waited",
    /^rendered on RunPod Serverless ep749 - about \$0\.0174 for 33 s at \$1\.90\/h; this computer while it waited: 1\.1 Wh/.test(rw), rw);
  check("ranOn: the remote this job was sent to; else the remote GPU in use when ComfyUI's address is its; this computer = null",
    G.ranOn({}, { mode: "serverless", label: "X", cost_hr: 1 }).label === "X" && G.ranOn({ engine: { comfy: { url: "http://127.0.0.1:8188" } } }, null) === null);
  const CORE = fs.readFileSync(path.join(ROOT, "lib", "core.js"), "utf8");
  check("core.js: job._ranOn at the start, the [power] line says it", /job\._ranOn = require\("\.\/gpuSplit"\)\.ranOn\(jobCfg, sp\.gpu\)/.test(CORE) && /job\._ranOn \? pw\.remoteWords\(e, job\._ranOn/.test(CORE));
  const pyv = execFileSync("python3", ["-c", `
import sys
sys.path.insert(0, ${JSON.stringify(path.join(ROOT, "scripts"))})
import comfy_client as C
said = []
r = C.clear_before_gen("http://127.0.0.1:8311/rpsl", {}, said.append, {"1": {"class_type": "KSampler", "inputs": {}}})
print(r, "|", " ".join(said))`], { encoding: "utf8" }).trim();
  check("the VRAM keep / free step on RunPod Serverless (/rpsl): skipped, and the log says the worker loads the models", /^False \| \[comfy\] RunPod Serverless: the endpoint's worker loads the models itself/.test(pyv), pyv);

  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch { /* fine */ }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log("FAIL: crashed " + (e && e.stack || e)); process.exit(1); });
