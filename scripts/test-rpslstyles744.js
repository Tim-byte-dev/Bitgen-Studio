#!/usr/bin/env node
/* bitGen Studio — 2.744.0 units: WHICH STYLES A RUNPOD SERVERLESS ENDPOINT CAN RENDER (lib/rpslStyles.js,
 * lib/comfyCoreNodes.json) + the Settings ▸ Save guard (lib/remoteGpu.js guardComfy).
 * Tim (verbatim): "if user is using runpod only show the styles that will work with runpod" - and his RunPod test that
 * rendered on this computer ("[worker] engine=comfy url=http://127.0.0.1:8188"): Settings ▸ Save had put the ComfyUI
 * tab's local address back over the Remote GPU one.
 *   the node lists: ComfyUI 0.34.0 (RunPod's worker 5.10.0) and a newer one, read from ComfyUI's source; the newer has
 *   every 0.34.0 node; the nodes the studio's own workflows need are where they belong
 *   classesOf (API / UI format), checkStyle on the REAL workflows: image / music / video (own workflow, per-mode own,
 *   the templates), the engine, a chain, LTX / Wan (their workers need /object_info), a UI export, a missing file
 *   guardComfy: remote = the ComfyUI tab's address / autostart become this computer's (prev), the remote one stays;
 *   local = untouched */
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");

let CFG = { engine: { comfy: { url: "http://127.0.0.1:8188", workflows: { t2va: "comfy_workflows/t2va.json", ref2va: "comfy_workflows/ref2va.json", fl2va: "comfy_workflows/fl2va.json" } } }, rgpu: { mode: "local" } };
const corePath = require.resolve("../lib/core.js");
require.cache[corePath] = { id: corePath, filename: corePath, loaded: true, exports: { BASE: ROOT, STYLES_DIR: path.join(ROOT, "nonexistent-styles"), getConfig: () => JSON.parse(JSON.stringify(CFG)), setConfig: (c) => { CFG = JSON.parse(JSON.stringify(c)); } } };
const R = require("../lib/rpslStyles.js");
const G = require("../lib/remoteGpu.js");

const N = JSON.parse(read("lib", "comfyCoreNodes.json"));
const v34 = new Set(N.versions["0.34.0"].nodes), lat = new Set(N.versions.latest.nodes);
check("the node lists: ComfyUI 0.34.0 (v0.34.0, 2026-08-25) and a newer one; the newer has every 0.34.0 node", N.versions["0.34.0"].ref === "v0.34.0" && v34.size > 600
  && lat.size > v34.size && [...v34].every((c) => lat.has(c)), { a: v34.size, b: lat.size });
check("…what the studio's workflows need: MiniMax H3, ACE-Step 1.5, SaveVideo / CreateVideo / EmptyImage in 0.34.0; Fibo 2 / YuE2 only in the newer; no node pack's", ["MiniMaxH3ReferenceToVideo", "MiniMaxH3ImageToVideo", "TextEncodeAceStepAudio1.5", "EmptyAceStep1.5LatentAudio", "SaveAudioAdvanced", "CreateVideo", "SaveVideo", "EmptyImage", "ModelSamplingAuraFlow", "CheckpointLoaderSimple"].every((c) => v34.has(c))
  && ["TextEncodeFibo2", "YuE2GenerateMusic", "TextEncodeQwenImage21"].every((c) => !v34.has(c) && lat.has(c)) && !["VHS_VideoCombine", "UnetLoaderGGUF", "PathchSageAttentionKJ", "Power Lora Loader (rgthree)"].some((c) => lat.has(c)));
check("versions(): the two, labelled", R.versions().map((v) => v.id).join() === "0.34.0,latest" && /RunPod's worker image 5\.10\.0/.test(R.versions()[0].label));

check("classesOf: an API workflow -> its classes; a UI one -> ui true", JSON.stringify(R.classesOf({ 1: { class_type: "B" }, 2: { class_type: "A" }, _c: {} })) === '{"classes":["A","B"],"ui":false}' && R.classesOf({ nodes: [{ type: "X" }], links: [] }).ui === true);
const H = R.available("0.34.0"), HL = R.available("latest");
const C = (st, have) => R.checkStyle(st, have || H, CFG);
check("image: SDXL (core nodes) works; Fibo 2 needs TextEncodeFibo2 (0.34.0) but works on a newer ComfyUI; a GGUF style needs UnetLoaderGGUF either way",
  C({ kind: "image", engine: "comfy", workflow: "comfy_workflows/img_sdxl_t2i.json" }).ok && !C({ kind: "image", engine: "comfy", workflow: "comfy_workflows/img_fibo2_dev.json" }).ok
  && C({ kind: "image", engine: "comfy", workflow: "comfy_workflows/img_fibo2_dev.json" }, HL).ok && JSON.stringify(C({ kind: "image", engine: "comfy", workflow: "comfy_workflows/img_krea2_raw_gguf_t2i.json" }, HL).missing) === '["UnetLoaderGGUF"]');
check("music: ACE-Step 1.5 + MiniMax Music3 work; YuE2 needs the newer ComfyUI", C({ kind: "music", engine: "comfy", workflow: "comfy_workflows/audio_ace_step_1_5.json" }).ok && C({ kind: "music", engine: "comfy", workflow: "comfy_workflows/audio_minimax_music3.json" }).ok
  && !C({ kind: "music", engine: "comfy", workflow: "comfy_workflows/audio_yue2.json" }).ok && C({ kind: "music", engine: "comfy", workflow: "comfy_workflows/audio_yue2.json" }, HL).ok);
const tmpl = C({ kind: "video", arch: "minimax-h3", engine: "comfy", workflows: { t2va: "", ref2va: "", fl2va: "" } });
check("video, no workflow of its own: the templates - Ref and F/L work, Text's t2va.json is a UI export (said why); the style works", tmpl.ok && JSON.stringify(tmpl.modes) === '{"t2va":false,"ref2va":true,"fl2va":true}' && /UI format/.test(tmpl.why), tmpl);
const swap = C({ kind: "video", arch: "minimax-h3", engine: "comfy", workflows: { t2va: "", ref2va: "comfy_workflows/MiniMax_H3_Swap.json", fl2va: "" } });
check("video with its own workflow for ONE mode (the swap style): only that mode counts - VideoHelperSuite / rgthree nodes missing = hidden", !swap.ok && JSON.stringify(swap.modes) === '{"ref2va":false}' && swap.missing.includes("VHS_LoadVideo") && swap.missing.includes("Power Lora Loader (rgthree)"), swap);
check("video with one workflow for every mode (minimaxH3-I's h3_scene_api.json) works; FastH3 Omni needs BlockSparseAttention (newer ComfyUI)",
  C({ kind: "video", arch: "minimax-h3", engine: "comfy", workflow: "comfy_workflows/h3_scene_api.json" }).ok && !C({ kind: "video", arch: "minimax-h3", engine: "comfy", workflow: "comfy_workflows/fasth3_omni_r2v.json" }).ok
  && C({ kind: "video", arch: "minimax-h3", engine: "comfy", workflow: "comfy_workflows/fasth3_omni_r2v.json" }, HL).ok);
check("LTX 2.3 / 2.5 and Wan 2.1 / 2.2: no - their workers need /object_info (said why)", ["ltx-2.3", "ltx-2.5", "wan21", "wan22"].every((a) => { const r = C({ kind: "video", arch: a, engine: "comfy" }, HL); return !r.ok && /object_info/.test(r.why); }));
check("an engine other than ComfyUI, a ControlNet chain, a UI export, a file not in the install: no, each with its reason",
  /own engine/.test(C({ kind: "image", engine: "sdcli" }).why) && /chain/.test(C({ kind: "image", engine: "comfy", chain: [1] }).why)
  && /UI format/.test(R.checkStyle({ kind: "image", engine: "comfy", workflow: "x.json" }, H, CFG, () => ({ classes: ["A"], ui: true })).why)
  && /not in this install/.test(C({ kind: "image", engine: "comfy", workflow: "comfy_workflows/nope_744.json" }).why));
check("settings(): off on this computer; on with mode serverless; an unknown ComfyUI version = 0.34.0", R.settings().on === false
  && (CFG.rgpu = { mode: "serverless", serverless: { comfy: "9.9", show_all: false } }, R.settings().on && R.settings().comfy === "0.34.0"));
CFG.rgpu = { mode: "serverless", serverless: { endpoint: "ep", comfy: "0.34.0" } };
const a = R.all();
check("all(): filter on in serverless; the template's modes; (no styles folder here = none)", a.on && a.filter && a.template.modes.ref2va === true && a.styles && typeof a.styles === "object");
CFG.rgpu.serverless.show_all = true;
check("…\"my image has node packs\" = no filter", R.all().filter === false);

/* ---- the Settings ▸ Save guard */
let cfg = { engine: { comfy: { url: "http://127.0.0.1:8311/rpsl", autostart: false } }, rgpu: { mode: "serverless", prev: { url: "http://127.0.0.1:8188", autostart: true } } };
let out = G.guardComfy({ url: "http://127.0.0.1:8188", autostart: true, dir: "C:/ComfyUI", keep_alive: true }, cfg);
check("guardComfy (remote): the ComfyUI tab's address / autostart are dropped (the remote one stays), its other fields go through", !("url" in out) && !("autostart" in out) && out.dir === "C:/ComfyUI" && out.keep_alive === true, out);
out = G.guardComfy({ url: "http://192.168.1.9:8188", autostart: false }, cfg);
check("…a NEW address typed there becomes this computer's (what This computer puts back)", cfg.rgpu.prev.url === "http://192.168.1.9:8188" && cfg.rgpu.prev.autostart === false, cfg.rgpu.prev);
G.guardComfy({ url: "http://127.0.0.1:8311/rpsl" }, cfg);
check("…the remote address itself (the tab shows the one in use) is not taken as this computer's", cfg.rgpu.prev.url === "http://192.168.1.9:8188");
cfg = { engine: { comfy: { url: "http://127.0.0.1:8188" } }, rgpu: { mode: "local" } };
out = G.guardComfy({ url: "http://127.0.0.1:8200", autostart: false }, cfg);
check("guardComfy (this computer): untouched", out.url === "http://127.0.0.1:8200" && out.autostart === false);
const RI = read("routes", "index.js");
check("POST /api/config runs it before the merge; GET /api/remotegpu/serverless/styles; the page script after basictabs.js; nothing in server.js",
  RI.indexOf("guardComfy(data.engine.comfy, config)") > RI.indexOf("const prevComfy") && RI.indexOf("guardComfy(data.engine.comfy, config)") < RI.indexOf('for (const s of ["models"')
  && /\/api\/remotegpu\/serverless\/styles/.test(read("routes", "runpodServerless.js")) && /<script src="\/static\/rpstyles\.js"><\/script>/.test(read("static", "index.html")) && !/rpslStyles|guardComfy/.test(read("misc", "server.js")));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
