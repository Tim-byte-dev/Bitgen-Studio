#!/usr/bin/env node
/* bitGen Studio — 2.773.1: A POD IS NOT USED BEFORE ITS COMFYUI IS THERE. Tim's log: qwen2_1 "cannot render on the pod yet …
 * bitGen could not find the pod's ComfyUI folder … tried port 8188: HTTP 502, 8080: a web page, not ComfyUI" + "ComfyUI on the
 * new pod was not updated … paste its password" though bitGen made the pod and holds its password. The render went on as soon as
 * the pod's Jupyter answered. Now (lib/podRevive.js waitReady, lib/podInstall.js looksBlank):
 *   - a pod whose image has no ComfyUI is blank by what it is (even unmarked) - it is marked and gets bitGen's install;
 *   - a ComfyUI template still setting itself up (no folder, nothing on 8188) is waited for, with its own note;
 *   - a ComfyUI that is on the pod but not running goes on (its update / start starts it);
 *   - the update's words when there is no ComfyUI yet say so (no "paste its password").
 * Stubbed config, RunPod and the pod.
 * Tim (verbatim): "it was working in the previous version - we screwed something up" */
"use strict";
const path = require("path"), Module = require("module");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const stub = (rel, exp) => { const p = require.resolve(rel); const m = new Module(p); m.filename = p; m.loaded = true; m.exports = exp; require.cache[p] = m; };
let CFG = { rgpu: { pod_made: {}, runpod: { key: "k" } } };
stub("../lib/core", { getConfig: () => CFG, setConfig: (c) => { CFG = c; }, BASE: ROOT, STYLES_DIR: path.join(ROOT, "styles") });
process.env.H3_POD_REVIVE_POLL = "1"; process.env.H3_POD_REVIVE_MAX = "400";
const PI = require("../lib/podInstall"), PM = require("../lib/podModels"), RV = require("../lib/podRevive"), CU = require("../lib/podComfyUpdate"), A = require("../lib/runpodApi");

(async () => {
  // ---- pure: which images are blank
  check("blankImage: RunPod's PyTorch image is blank; a ComfyUI image or an unknown one is not",
    PI.blankImage("runpod/pytorch:2.8.0-py3.11-cuda12.8.1-cudnn-devel-ubuntu22.04") && !PI.blankImage("runpod/comfyui:cuda13.0") && !PI.blankImage("runpod/comfyui-base:slim") && !PI.blankImage(""));

  const JUP = { jupyter: true, jupyter_url: "http://j", comfy_answers: false, comfy_dir: "" };
  // ---- looksBlank: by the pod's image
  check("looksBlank: a pod marked for the install - yes, RunPod not even asked", (CFG.rgpu.pod_made.m1 = { install: true }) && await PI.looksBlank("m1", JUP, { image: async () => { throw new Error("asked"); } }));
  CFG.rgpu.pod_made.p2 = { port: 8188, install: false };
  const y = await PI.looksBlank("p2", JUP, { image: async () => "runpod/pytorch:2.8.0-py3.11-cuda12.8.1" });
  check("…an unmarked pod (made elsewhere / before 2.772.0) whose image is PyTorch: blank - and marked so it stays installable", y && CFG.rgpu.pod_made.p2.install === true && PI.installable("p2"), CFG.rgpu.pod_made.p2);
  const y2 = await PI.looksBlank("x3", JUP, { image: async () => "runpod/pytorch:2.4.0" });
  check("…a pod this computer has no record of: blank, remembered in rgpu.pod_install", y2 && CFG.rgpu.pod_install && CFG.rgpu.pod_install.x3 === true && PI.installable("x3"), CFG.rgpu.pod_install);
  check("…a ComfyUI template's pod still setting up: not blank (it is waited for)", !(await PI.looksBlank("c4", JUP, { image: async () => "runpod/comfyui:cuda13.0" })) && !PI.installable("c4"));
  check("…RunPod not answering / no image: not blank (never installed on a guess)", !(await PI.looksBlank("c5", JUP, { image: async () => { throw new Error("502"); } })) && !(await PI.looksBlank("c6", JUP, { image: async () => "" })));
  let asked = 0; const ask = async () => { asked++; return "runpod/pytorch:2.8.0"; };
  check("…a pod whose ComfyUI answers, or has a ComfyUI folder, or no Jupyter: never asked, not blank",
    !(await PI.looksBlank("c7", Object.assign({}, JUP, { comfy_answers: true }), { image: ask })) && !(await PI.looksBlank("c7", Object.assign({}, JUP, { comfy_dir: "/workspace/ComfyUI" }), { image: ask })) && !(await PI.looksBlank("c7", Object.assign({}, JUP, { jupyter: false }), { image: ask })) && asked === 0, asked);
  // the default asks RunPod's pod (v2 has image, v1 imageName)
  const oldPod = A.pod; A.pod = async (id) => (id === "v2pod" ? { id, image: "runpod/pytorch:2.8.0" } : { id, imageName: "runpod/comfyui:latest" });
  check("…by default RunPod's own pod is asked (v2 image / v1 imageName)", await PI.looksBlank("v2pod", JUP) && !(await PI.looksBlank("v1pod", JUP)));
  A.pod = oldPod;

  // ---- waitReady: Jupyter answering is not enough
  const oldWays = PM.ways, oldEnsure = PI.ensure, oldLooks = PI.looksBlank;
  const says = [];
  // (a) the template is still setting ComfyUI up: two polls with Jupyter only, then its ComfyUI answers
  let n = 0; PM.ways = async () => (++n <= 2 ? Object.assign({}, JUP) : { jupyter: true, comfy_answers: true, comfy_dir: "/workspace/runpod-slim/ComfyUI", comfy_url: "http://c" });
  PI.looksBlank = async () => false;
  const wa = await RV.waitReady("tplpod", 8188, (t) => says.push(t));
  check("a ComfyUI template still setting up (Jupyter answers, 8188 does not, no folder): waited for - not handed to the render until its ComfyUI answers",
    wa && wa.comfy_answers && n === 3 && says.filter((t) => /being set up by the template/.test(t)).length === 2, { n, says });
  // (b) ComfyUI on the pod but down (crashed): goes on - its start is lib/podComfyUpdate.js's
  n = 0; PM.ways = async () => { n++; return Object.assign({}, JUP, { comfy_dir: "/workspace/ComfyUI" }); };
  const wb = await RV.waitReady("downpod", 8188, () => {});
  check("…ComfyUI on the pod but not running: goes on at once (its update / start starts it)", wb && wb.comfy_dir === "/workspace/ComfyUI" && n === 1, { n });
  // (c) a blank pod nobody marked: installed first
  let ens = 0; n = 0;
  PM.ways = async () => (ens ? { jupyter: true, comfy_answers: true, comfy_dir: "/workspace/ComfyUI", comfy_url: "http://c" } : (n++, Object.assign({}, JUP)));
  PI.looksBlank = async () => true; PI.ensure = async () => { ens++; return { ok: true }; };
  const wc = await RV.waitReady("blankpod", 8188, () => {});
  check("…a blank pod nobody marked (its image has no ComfyUI): bitGen's install first, then on", wc && wc.comfy_answers && ens === 1, { ens, n });
  // (d) the install fails: the render stops with why
  ens = 0; PI.ensure = async () => ({ ok: false, why: "git clone did not work - fatal: unable to access" });
  let err = null; try { await RV.waitReady("blankpod2", 8188, () => {}); } catch (e) { err = e; }
  check("…its install fails: stops with the reason (no render on a pod without ComfyUI)", err && /ComfyUI is not on the pod yet: git clone/.test(err.message), err && err.message);
  // (e) never there: stops after the limit with a clear reason
  PI.looksBlank = async () => false; PM.ways = async () => Object.assign({}, JUP);
  err = null; try { await RV.waitReady("neverpod", 8188, () => {}); } catch (e) { err = e; }
  check("…a template whose ComfyUI never comes: stops after the wait with why", err && /did not answer in/.test(err.message), err && err.message);
  // ---- making styles ready straight on a pod (pod setup, a style's ⬆ prepare, remote prep): the same wait first
  const PP = require("../lib/podPrep"), oldWR = RV.waitReady, DI = PP.defaults().install;
  let wr = 0; RV.waitReady = async () => { wr++; return {}; };
  PM.ways = async () => Object.assign({}, JUP);
  const i1 = await DI("tplpod2", 8188, () => {});
  PM.ways = async () => Object.assign({}, JUP, { comfy_answers: true, comfy_dir: "/workspace/ComfyUI" });
  const i2 = await DI("okpod", 8188, () => {});
  PM.ways = async () => { throw Object.assign(new Error("not answering"), { status: 409 }); };
  const i3 = await DI("offpod", 8188, () => {});
  RV.waitReady = async () => { throw new Error("the pod's ComfyUI did not answer in 45 minutes"); }; PM.ways = async () => Object.assign({}, JUP);
  const i4 = await DI("tplpod3", 8188, () => {});
  check("podPrep (styles made ready straight on a pod): a pod with only its Jupyter waits for its ComfyUI first; a pod with ComfyUI or not answering at all as before; a wait that ends says why",
    i1 && i1.ok && wr === 1 && i2 === null && i3 === null && i4 && !i4.ok && /did not answer in 45/.test(i4.why), { i1, i2, i3, i4, wr });
  RV.waitReady = oldWR;
  PM.ways = oldWays; PI.ensure = oldEnsure; PI.looksBlank = oldLooks;

  // ---- the update's words
  const u1 = await CU.update(Object.assign({ pod_id: "q" }, JUP), 8188, () => {});
  const u2 = await CU.update({ pod_id: "q", jupyter: false }, 8188, () => {});
  check("the update when ComfyUI is not on the pod yet: says so - no 'paste its password' (bitGen has it)", !u1.ok && /no ComfyUI on the pod yet/.test(u1.why) && !/password/.test(u1.why) && /paste its password/.test(u2.why), { u1, u2 });

  console.log("\n" + pass + " passed, " + fail + " failed");
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
