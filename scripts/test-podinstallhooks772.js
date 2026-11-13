#!/usr/bin/env node
/* bitGen Studio — 2.772.0: WHERE THE COMFYUI INSTALL HAPPENS - a pod made from RunPod's PyTorch template is marked for it (port
 * 8188 opened, a host for its CUDA, the mark in rgpu.pod_made); its setup installs ComfyUI first, then goes on as for any pod
 * (lib/podMade.js); a render waiting for it gets ComfyUI installed / started first (lib/podRevive.js waitReady); making styles
 * ready on it waits for the install and stops with the reason when it failed (lib/podPrep.js); each step in the pod's activity.
 * Stubbed config and RunPod.
 * Tim (verbatim): "is there an empty pod template that we can install our comfy ui on from scratch" + "lets do that, also in
 * the pod that is installing and being used show what is being done …" */
"use strict";
const path = require("path"), Module = require("module");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const stub = (rel, exp) => { const p = require.resolve(rel); const m = new Module(p); m.filename = p; m.loaded = true; m.exports = exp; require.cache[p] = m; };
let CFG = { rgpu: { pod_made: {}, runpod: { key: "k" } } };
stub("../lib/core", { getConfig: () => CFG, setConfig: (c) => { CFG = c; }, BASE: ROOT, STYLES_DIR: path.join(ROOT, "styles") });
const PMd = require("../lib/podMade"), PI = require("../lib/podInstall"), PA = require("../lib/podActivity"), PP = require("../lib/podPrep");
const A = require("../lib/runpodApi"), P = require("../lib/pods"), PM = require("../lib/podModels"), RV = require("../lib/podRevive");

(async () => {
  // ---- a pod made from the PyTorch template
  const TPL = [{ id: "pt28", name: "Runpod Pytorch 2.8.0", imageName: "runpod/pytorch:2.8.0-py3.11-cuda12.8.1-cudnn-devel-ubuntu22.04", ports: "8888/http,22/tcp", isServerless: false },
    { id: "cf13", name: "ComfyUI - CUDA 13.0", imageName: "runpod/comfyui:cuda13.0", ports: "8188/http,8888/http", isServerless: false }];
  const bodies = [];
  A.templates = async () => TPL.map((t) => ({ id: t.id, name: t.name, image: t.imageName, ports: t.ports.split(","), serverless: false }));
  A.createPod = async (b) => { bodies.push(b); return { id: "newpod" + bodies.length, name: b.name }; };
  PMd.watch = () => null;   // (no background watch in the test - a fresh podMade is loaded below for its own checks)
  const made = await P.create({ templateId: "pt28", name: "bitGen Krea", gpu: "NVIDIA GeForce RTX 4090", count: 1, cloud: "SECURE", port: 8888 });
  const b0 = bodies[0], rec = CFG.rgpu.pod_made.newpod1;
  check("create on RunPod's PyTorch template: ComfyUI's 8188/http opened, a host for its CUDA 12.8, Jupyter's password; marked for the install with ComfyUI on 8188 (not the template's 8888)",
    JSON.stringify(b0.ports) === JSON.stringify(["8888/http", "22/tcp", "8188/http"]) && b0.gpu.minCudaVersion === "12.8" && !!b0.env.JUPYTER_PASSWORD && rec.install === true && rec.port === 8188 && made.port === 8188 && PI.installable("newpod1"), { b0, rec });
  await P.create({ templateId: "cf13", name: "bitGen C", gpu: "X", count: 1, cloud: "SECURE", port: 8188 });
  check("…a ComfyUI template: no install (its own ComfyUI), its own ports", CFG.rgpu.pod_made.newpod2.install === false && !PI.installable("newpod2") && bodies[1].ports.includes("8188/http") && bodies[1].gpu.minCudaVersion === "13.0", { rec: CFG.rgpu.pod_made.newpod2, ports: bodies[1].ports });

  // ---- the setup of a new blank pod: ComfyUI installed, then as any pod
  CFG.rgpu.pod_made.podI = { port: 8188, install: true };
  const seen = [];
  const D = { up: async () => false, sleep: async () => {}, installable: (id) => PI.installable(id),
    install: async (id, port, say) => { seen.push("install " + id); say("installing what ComfyUI needs - collecting av (3)"); return { ok: true, version: "0.42.0" }; },
    autoUpdate: async (id) => { seen.push("update " + id); return null; }, styles: () => [{ id: "s1", name: "Krea 2" }],
    prepare: async (id, port, st) => { seen.push("prepare " + st.map((x) => x.name).join()); return { problems: [], notThere: [] }; }, useIfNone: (id) => { seen.push("use " + id); return true; } };
  PA.clear("podI");
  delete require.cache[require.resolve("../lib/podMade")];
  const PMd2 = require("../lib/podMade");
  const W = PMd2.watch("podI", 8188, D);
  await W.promise;
  check("a new pod on the PyTorch template: its ComfyUI is installed first (its ComfyUI never answered), then set up as any pod - update check, its styles made ready, used",
    seen.join("|") === "install podI|update podI|prepare Krea 2|use podI" && W.phase === "ready" && CFG.rgpu.pod_made.podI.setup_at > 0, { seen, W: { phase: W.phase, note: W.note } });
  const v = PA.view("podI");
  check("…the pod's activity: waiting for it to load, its styles made ready, used; ✓ set up and ready last", v && v.last && v.last.ok && /set up and ready/.test(v.last.text) && v.done.some((x) => /waiting for the pod to load/.test(x.text)) && v.done.some((x) => x.verb === "Preparing"), v && v.done.map((x) => x.verb + ":" + x.text));
  CFG.rgpu.pod_made.podJ = { port: 8188, install: true };
  const W2 = PMd2.watch("podJ", 8188, Object.assign({}, D, { install: async () => ({ ok: false, why: "pip install -r requirements.txt did not work - ERROR: No matching distribution" }) }));
  await W2.promise;
  check("…an install that fails: the setup stops with why (failed), nothing else done", W2.phase === "failed" && /ComfyUI was not installed on the pod: pip install/.test(W2.note), { phase: W2.phase, note: W2.note });
  CFG.rgpu.pod_made.podK = { port: 8188 };
  let inst = 0; const W3 = PMd2.watch("podK", 8188, Object.assign({}, D, { up: (() => { let n = 0; return async () => ++n >= 2; })(), install: async () => { inst++; return { ok: true }; } }));
  await W3.promise;
  check("…a pod from a ComfyUI template is never installed on (it waits for its own ComfyUI)", inst === 0 && W3.phase === "ready");

  // ---- making styles ready waits for the install / stops with its reason
  const Dp = { ways: async () => { throw new Error("should not be asked"); }, install: async () => ({ ok: false, why: "the pod's Jupyter did not answer in 20 minutes" }), autoUpdate: null, sleep: async () => {} };
  PA.clear("podP");
  const r = await PP.prepare("podP", 8188, [{ id: "s1", name: "Krea 2", kind: "image" }], { deps: Dp });
  check("podPrep: the install failed - the styles are not made ready, the reason is the problem; ✗ in the pod's activity",
    r.problems.length === 1 && /^ComfyUI is not on the pod: the pod's Jupyter did not answer/.test(r.problems[0]) && PA.view("podP").last.ok === false, [r, PA.view("podP")]);
  let asked = 0;
  const r2 = await PP.prepare("podP", 8188, [{ id: "s1", name: "Krea 2", kind: "image" }], { deps: Object.assign({}, Dp, { install: async () => ({ ok: true }), ways: async () => { asked++; return { jupyter: false, comfy_dir: "" }; },
    cfg: () => ({}), catalog: () => ({ models: [] }), graph: () => null, objectInfo: async () => ({}), contents: async () => ({ models: {} }), local: () => null, needs: () => [] }) });
  check("…installed (or nothing to install): it goes on - asks the pod what it has", asked >= 1 && Array.isArray(r2.problems), r2);

  // ---- a render waiting for its pod
  CFG.rgpu.pod_made.podR = { port: 8188, install: true };
  let wn = 0, en = 0;
  PM.ways = async () => { wn++; if (wn === 1) return { comfy_answers: false, jupyter: true }; return { comfy_answers: true, jupyter: true, comfy_url: "u" }; };
  PI.ensure = async (id, port, say) => { en++; say("loading ComfyUI - Import times for custom nodes:"); return { ok: true }; };
  const said = [];
  const w = await RV.waitReady("podR", 8188, (t) => said.push(t));
  check("a render's pod (podRevive.waitReady): its Jupyter answers but ComfyUI does not - bitGen installs / starts it, then the render goes on with the pod's ComfyUI", en === 1 && w.comfy_answers === true && said.some((t) => /^loading ComfyUI/.test(t)), { en, w, said });
  wn = 0; en = 0; CFG.rgpu.pod_made.podR.install = false;
  PM.ways = async () => { wn++; if (wn === 1) return { comfy_answers: false, jupyter: true }; return { comfy_answers: true, jupyter: true }; };
  const w2 = await RV.waitReady("podR", 8188, () => {});
  check("…not on a pod with its own ComfyUI (the Jupyter answer is enough, as before)", en === 0 && wn === 1 && w2.jupyter === true);
  CFG.rgpu.pod_made.podR.install = true;
  PI.ensure = async () => ({ ok: false, why: "git clone did not work - fatal: unable to access" });
  PM.ways = async () => ({ comfy_answers: false, jupyter: true });
  let err = ""; try { await RV.waitReady("podR", 8188, () => {}); } catch (e) { err = String(e.message); }
  check("…an install that fails stops the render with why", /^ComfyUI is not on the pod yet: git clone did not work/.test(err), err);

  console.log("\n" + pass + " passed, " + fail + " failed");
  console.log("RESULT: " + (fail ? "FAIL" : "PASS"));
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log("FAIL: " + (e && e.stack || e)); console.log("RESULT: FAIL"); process.exit(1); });
