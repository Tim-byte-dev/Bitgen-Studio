#!/usr/bin/env node
/* bitGen Studio — 2.758.0 LIVE: P_ styles made from a pod's ComfyUI (lib/podStyles.js contents / make) against a stand-in
 * pod on this computer (H3_RUNPOD_PROXY), like the "ComfyUI - Qwen Image - ZiT - Boogu - Krea" template: its model files,
 * its saved workflows (one in ComfyUI's API format, one UI export, one with a node the pod lacks, one video).
 * Tim (verbatim): "I am trying with this pod ComfyUI - Qwen Image - ZiT - Boogu - Krea , how can i choose the model?" */
"use strict";
const http = require("http"), fs = require("fs"), os = require("os"), path = require("path"), Module = require("module");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };

const BASE = fs.mkdtempSync(path.join(os.tmpdir(), "pods758l-"));
fs.mkdirSync(path.join(BASE, "comfy_workflows"), { recursive: true });
for (const f of ["img_nf2_t2i.json", "img_qwen21_edit_10.json"]) fs.copyFileSync(path.join(ROOT, "comfy_workflows", f), path.join(BASE, "comfy_workflows", f));
const STYLES = path.join(BASE, "styles");
let CFG = { rgpu: { runpod: { pod_id: "pod758", port: 3000 } } };
const coreP = require.resolve("../lib/core");
const fake = new Module(coreP); fake.filename = coreP; fake.loaded = true;
fake.exports = { getConfig: () => CFG, setConfig: (c) => { CFG = c; }, STYLES_DIR: STYLES, BASE };
require.cache[coreP] = fake;

const MODELS = { UNETLoader: ["qwen_image_2512_int8_convrot.safetensors", "z_image_turbo_bf16.safetensors", "boogu_v1.safetensors"],
  CheckpointLoaderSimple: [], CLIPLoader: ["qwen_3_4b.safetensors", "qwen3vl_8b_int8_convrot.safetensors"], DualCLIPLoader: [], VAELoader: ["ae.safetensors", "qwen_image_vae.safetensors"] };
const KEYS = { UNETLoader: "unet_name", CheckpointLoaderSimple: "ckpt_name", CLIPLoader: "clip_name", DualCLIPLoader: "clip_name1", VAELoader: "vae_name" };
const API_WF = { 3: { class_type: "KSampler", inputs: { seed: 1, steps: 8, cfg: 1, model: ["1", 0], positive: ["6", 0], negative: ["7", 0], latent_image: ["5", 0] } },
  1: { class_type: "UNETLoader", inputs: { unet_name: "boogu_v1.safetensors", weight_dtype: "default" } }, 6: { class_type: "CLIPTextEncode", inputs: { text: "a cat" } },
  7: { class_type: "CLIPTextEncode", inputs: { text: "" } }, 5: { class_type: "EmptyLatentImage", inputs: { width: 1024, height: 1024, batch_size: 1 } },
  9: { class_type: "SaveImage", inputs: { images: ["8", 0], filename_prefix: "x" } } };
const UI_WF = { nodes: [{ id: 1, type: "EmptyLatentImage", widgets_values: [768, 512, 1], inputs: [], outputs: [{ name: "LATENT", type: "LATENT", links: [1] }], mode: 0 },
  { id: 2, type: "SaveLatentAsImageish", widgets_values: [], inputs: [{ name: "samples", type: "LATENT", link: 1 }], outputs: [], mode: 0 }], links: [[1, 1, 0, 2, 0, "LATENT"]] };
const UI_OK = { nodes: [{ id: 1, type: "EmptyLatentImage", widgets_values: [768, 512, 1], inputs: [], outputs: [{ name: "LATENT", type: "LATENT", links: [] }], mode: 0 },
  { id: 2, type: "SaveImage", widgets_values: ["pod"], inputs: [{ name: "images", type: "IMAGE", link: null }], outputs: [], mode: 0 }], links: [] };
const VIDEO_WF = { 1: { class_type: "VHS_VideoCombine", inputs: {} } };
const FILES = { "Boogu fast.json": API_WF, "ui/Latent test.json": UI_OK, "Missing node.json": UI_WF, "Wan video.json": VIDEO_WF };
const INFO = { EmptyLatentImage: { input: { required: { width: ["INT", {}], height: ["INT", {}], batch_size: ["INT", {}] } }, output: ["LATENT"] },
  SaveImage: { input: { required: { images: ["IMAGE"], filename_prefix: ["STRING", {}] } }, output: [] } };
let up = true;
const srv = http.createServer((q, s) => {
  const m = /^\/proxy\/(\w+)-(\d+)(\/.*)$/.exec(q.url); const send = (c, j) => { s.writeHead(c, { "Content-Type": "application/json" }); s.end(JSON.stringify(j)); };
  if (!m || m[1] !== "pod758" || m[2] !== "3000") return send(404, {});
  const p = decodeURIComponent(m[3]);
  if (!up) return send(502, {});
  if (p === "/system_stats") return send(200, { system: { comfyui_version: "0.3.70" } });
  const oi = /^\/object_info\/(\w+)$/.exec(p);
  if (oi) { const cls = oi[1]; if (!(cls in MODELS)) return send(404, {}); return send(200, { [cls]: { input: { required: { [KEYS[cls]]: [MODELS[cls]] } } } }); }
  if (p === "/object_info") return send(200, INFO);
  if (p.startsWith("/api/userdata?dir=workflows")) return send(200, Object.keys(FILES));
  const f = /^\/api\/userdata\/workflows\/(.+)$/.exec(p);
  if (f && FILES[f[1]]) return send(200, FILES[f[1]]);
  send(404, { error: p });
});
srv.listen(0, "127.0.0.1", async () => {
  process.env.H3_RUNPOD_PROXY = "http://127.0.0.1:" + srv.address().port + "/proxy/{id}-{port}";
  const PS = require("../lib/podStyles"), S = require("../lib/styles");
  try {
    up = false;
    let err = null; try { await PS.contents("pod758", 3000); } catch (e) { err = e; }
    check("a pod whose ComfyUI is not up yet: 409 'wait for \"pod loaded\"'", err && err.status === 409 && /wait for "pod loaded"/.test(err.message), err && err.message);
    up = true;
    const c = await PS.contents("pod758", 3000);
    check("contents: the pod's model files (its own ComfyUI's lists), the bitGen style each fits (Boogu: none), its saved workflows",
      c.known.map((k) => k.file + "=" + k.starter).join("|") === "qwen_image_2512_int8_convrot.safetensors=qwen2_1|z_image_turbo_bf16.safetensors=R_Z-Image Turbo|boogu_v1.safetensors="
      && c.models.vae.join() === "ae.safetensors,qwen_image_vae.safetensors" && c.workflows.length === 4, c);
    const r = await PS.make("pod758", { models: ["z_image_turbo_bf16.safetensors", "qwen_image_2512_int8_convrot.safetensors", "boogu_v1.safetensors"],
      workflows: ["Boogu fast.json", "ui/Latent test.json", "Missing node.json", "Wan video.json"], pod_name: "Qwen-ZiT-Boogu-Krea", port: 3000 });
    check("make: P_ styles for the two models bitGen knows and the two picture workflows; Boogu's model, the workflow with a missing node and the video one skipped - each with its reason",
      r.made.join("|") === "P_z_image_turbo_bf16|P_qwen_image_2512_int8_convrot|P_Boogu fast|P_Latent test"
      && /no workflow for this model type/.test(r.skipped.find((x) => x.what === "boogu_v1.safetensors").why) && /SaveLatentAsImageish/.test(r.skipped.find((x) => x.what === "Missing node.json").why)
      && /a video workflow - P_ styles are pictures for now/.test(r.skipped.find((x) => x.what === "Wan video.json").why), r);
    const all = S.read(STYLES), zi = all.find((s) => s.name === "P_z_image_turbo_bf16"), bf = all.find((s) => s.name === "P_Boogu fast");
    const g = JSON.parse(fs.readFileSync(path.join(BASE, zi.workflow), "utf8")), L = Object.values(g).filter((n) => /^(UNETLoader|CLIPLoader|VAELoader)$/.test(n.class_type)).map((n) => n.inputs.unet_name || n.inputs.clip_name || n.inputs.vae_name);
    check("…P_z_image_turbo_bf16: bitGen's Z-Image workflow with the pod's model, text encoder and VAE; runs on the pod (id, name, port), made from it",
      zi.runs_on === "pod" && zi.pod_id === "pod758" && zi.pod_name === "Qwen-ZiT-Boogu-Krea" && zi.pod_port === 3000 && zi.pod_auto && /^comfy_workflows\/pod\//.test(zi.workflow)
      && L.join() === "z_image_turbo_bf16.safetensors,qwen_3_4b.safetensors,ae.safetensors", { zi, L });
    check("…P_Boogu fast: the pod's own workflow as it is (its own Boogu model, 8 steps)", bf.runs_on === "pod" && JSON.parse(fs.readFileSync(path.join(BASE, bf.workflow), "utf8"))[1].inputs.unet_name === "boogu_v1.safetensors"
      && JSON.parse(fs.readFileSync(path.join(BASE, bf.workflow), "utf8"))[3].inputs.steps === 8, bf);
    const lt = JSON.parse(fs.readFileSync(path.join(BASE, all.find((s) => s.name === "P_Latent test").workflow), "utf8"));
    check("…a UI export saved in the pod: turned into ComfyUI's API format with the pod's own node list", lt["1"].class_type === "EmptyLatentImage" && lt["1"].inputs.width === 768, lt);
    const r2 = await PS.make("pod758", { models: ["z_image_turbo_bf16.safetensors"], pod_name: "Qwen-ZiT-Boogu-Krea", port: 3000 });
    check("made again: the same style updated, not a second one", r2.made.join() === "P_z_image_turbo_bf16" && S.read(STYLES).filter((s) => s.name === "P_z_image_turbo_bf16").length === 1);
  } catch (e) { fail++; console.log("FAIL: " + (e && e.stack || e)); }
  srv.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
});
