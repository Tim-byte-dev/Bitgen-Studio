#!/usr/bin/env node
/* bitGen Studio — 2.756.0 units: THE PODS DOCKER's server side (lib/pods.js) + the generation engine (lib/gpuSplit.js
 * engineOf / setEngine).
 * Tim (verbatim): "show the remote servers, runpod and openrouter, if user selects runpod show serverless or pods radio
 * group" + "can we get the list of public pods from runpod in a docker called PODS(like model manager) ... the user can
 * choose/create a pod" */
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 500))); } };
const rd = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
const P = require("../lib/pods");
check("isComfy: the name, the image, or an HTTP port 8188 / 3000", P.isComfy({ name: "ComfyUI Flux" }) && P.isComfy({ image: "x/comfyui:1" }) && P.isComfy({ ports: ["3000/http"] }) && P.isComfy({ ports: "8188/http,22/tcp" })
  && !P.isComfy({ name: "PyTorch", ports: ["8888/http"] }) && !P.isComfy({ ports: ["8188/tcp"] }));
check("comfyPort: 8188, else 3000, else the first HTTP port, else 8188", P.comfyPort({ ports: ["3000/http", "8188/http"] }) === 8188 && P.comfyPort({ ports: ["3000/http"] }) === 3000 && P.comfyPort({ ports: ["7860/http"] }) === 7860 && P.comfyPort({}) === 8188);
const tv = P.templateView({ id: "abc123", name: "ComfyUI", image: "runpod/comfyui", disk: 40, ports: ["8188/http", "22/tcp"] }, "official");
check("templateView: id, name, image, disk, ports, comfy, its port, the source, its page on RunPod", tv.id === "abc123" && tv.comfy && tv.port === 8188 && tv.ports.join() === "8188/http,22/tcp" && tv.source === "official" && tv.page === "https://www.runpod.io/console/explore/abc123", tv);
const g = { id: "NVIDIA GeForce RTX 4090", name: "RTX 4090", memory: 24, secure: true, community: true, price: { secure: 0.69, community: 0.34 }, availability: "HIGH", maxCount: { secure: 8, community: 4 } };
check("gpuView: the price on the cloud picked, memory, availability, offered, max", P.gpuView(g, "SECURE").price === 0.69 && P.gpuView(g, "community").price === 0.34 && P.gpuView(g, "COMMUNITY").max === 4
  && P.gpuView(Object.assign({}, g, { availability: "NONE" }), "SECURE").offered === false && P.gpuView(Object.assign({}, g, { community: false }), "COMMUNITY").offered === false);
const cb = P.createBody({ templateId: "abc123", name: "My pod!", gpu: "NVIDIA GeForce RTX 4090", count: "2", cloud: "community", disk: "80", volume: "60" });
check("createBody: name (cleaned), template, GPU + count, cloud, container disk, /workspace size", cb.name === "My pod" && cb.templateId === "abc123" && cb.gpu.id === "NVIDIA GeForce RTX 4090" && cb.gpu.count === 2 && cb.cloud === "COMMUNITY" && cb.disk === 80
  && cb.mounts.persistent.size === 60 && cb.mounts.persistent.path === "/workspace", cb);
const lim = P.createBody({ templateId: "abc123", gpu: "x", count: 99, disk: 1, volume: 99999 });
check("…kept in RunPod's limits (1-8 GPUs, disk 10+, /workspace 10-2000 GB), a name when none", lim.gpu.count === 8 && lim.disk === 10 && lim.mounts.persistent.size === 2000 && lim.name === "bitGen pod" && lim.cloud === "SECURE");
const bad = (b) => { try { P.createBody(b); return null; } catch (e) { return e; } };
check("…refused with a plain reason: no template, no GPU", /no template was picked/.test((bad({ gpu: "x" }) || {}).message) && /pick a GPU/.test((bad({ templateId: "abc123" }) || {}).message) && (bad({ gpu: "x" }) || {}).status === 400);
const G = require("../lib/gpuSplit");
check("engineOf: saved; never saved = from what is in use (a pod = Pods; OpenRouter's LLM alone = OpenRouter; else RunPod Serverless)",
  JSON.stringify(G.engineOf({})) === JSON.stringify({ provider: "runpod", runpod: "serverless", pods: false }) && G.engineOf({ mode: "runpod" }).pods === true
  && G.engineOf({ llm_provider: "openrouter" }).provider === "openrouter" && G.engineOf({ engine: { provider: "runpod", runpod: "pods" } }).pods === true && G.engineOf({ remote_mode: "runpod" }).runpod === "pods");
const core = require("../lib/core");
let CFG = { rgpu: { mode: "local", split: { where: "local" }, enabled: true } };
const gc = core.getConfig, sc = core.setConfig; core.getConfig = () => CFG; core.setConfig = (c) => { CFG = c; };
try {
  G.setEngine({ provider: "openrouter" });
  check("setEngine OpenRouter: saved, and the LLM goes to OpenRouter", CFG.rgpu.engine.provider === "openrouter" && CFG.rgpu.llm_provider === "openrouter");
  G.setEngine({ provider: "runpod", runpod: "pods" });
  // 2.770.0 (Tim: "the remote platform will be selected in settings with openrouter as default"): the render engine no longer moves the LLM
  check("setEngine RunPod ▸ Pods: saved; the LLM's platform stays Settings' own (2.770.0)", CFG.rgpu.engine.runpod === "pods" && CFG.rgpu.llm_provider !== "runpod" && G.view().engine.pods === true);
  G.set({ where: "remote" });
  check("…Pods: Remote can be picked with no pod yet (a pod comes from the PODS docker)", G.split().where === "remote");
  G.set({ where: "local" }); G.setEngine({ runpod: "serverless" });
  let err = null; try { G.set({ where: "remote" }); } catch (e) { err = e; }
  check("…Serverless with nothing set up: Remote still refused, saying where to set one up", err && err.status === 400 && /set up a remote GPU first/.test(err.message));
  // the bitGen pods list (the exit rule)
  P.remember("p1", "One", "created"); P.remember("p2", "Two", "started"); P.remember("p1", "One", "started");
  check("remember: the pods bitGen created / started (one entry a pod, the latest how)", P.started().map((x) => x.id + ":" + x.how).join() === "p2:started,p1:started");
  P.forget("p2");
  check("…forget (terminated)", P.started().map((x) => x.id).join() === "p1");
} finally { core.getConfig = gc; core.setConfig = sc; }
const IDX = rd("routes", "index.js"), RP = rd("routes", "pods.js"), HTML = rd("static", "index.html"), JS = rd("static", "podsdock.js"), GS = rd("static", "gpusplit.js");
check("routes/pods.js mounted: templates, gpus, create, mine, start / stop / terminate", /require\("\.\/pods"\)\.mount\(app\)/.test(IDX) && ["/api/pods/templates", "/api/pods/gpus", "/api/pods/create", "/api/pods/mine", "/api/pods/:id/:action"].every((u) => RP.includes(u)));
check("the page loads static/podsdock.js: a SecFloat docker \"PODS\"; its 🖥 PODS button in Basic Settings ▸ GPU, shown only for RunPod ▸ Pods", HTML.indexOf("/static/podsdock.js") > HTML.indexOf("/static/remotedock.js")
  && /SecFloat\.add\(\{ id: "pods", title: "PODS"/.test(JS) && /b\.id = "gpuPods"/.test(JS) && /g\.enabled && g\.engine && g\.engine\.pods/.test(JS) && /name: grp\[0\]/.test(GS) && /"gpuProv", "Remote servers"/.test(GS) && /"gpuRunpod", "RunPod"/.test(GS));
check("lib/runpodApi.js: templates (GET /catalog/templates?source=), gpus (GET /catalog/gpus …POD&cloud=), createPod (POST /pods)", /\/catalog\/templates\?source=/.test(rd("lib", "runpodApi.js")) && /\/catalog\/gpus\?include=AVAILABILITY&product=POD&cloud=/.test(rd("lib", "runpodApi.js")) && /call\("POST", "\/pods"/.test(rd("lib", "runpodApi.js")));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
