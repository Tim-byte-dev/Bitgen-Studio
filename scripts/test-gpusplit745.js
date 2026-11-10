#!/usr/bin/env node
/* bitGen Studio — 2.745.0 units: BASIC SETTINGS ▸ GPU (lib/gpuSplit.js, routes/gpuSplit.js, the LLM call sites, core.js's
 * job config, the usage log, lib/remoteGpu.js use(), lib/rpslStyles.js kinds).
 * Tim (verbatim): "add a accordian menu item to basic settings - GPU - add checkboxes remote,local, both - if both, add
 * checkboxes - llm,vllm,image,video" -> vllm = the vision LLM; ticked = on the remote GPU; LLMs = a RunPod vLLM endpoint.
 *   pure     kindOf (image / video incl. songs / never), routeOf, slsChatUrl
 *   set()    Remote needs a remote GPU; Remote = its address; Local / Both = this computer's (the remote remembered)
 *   forJob   Both: a ticked kind's job.json gets the remote's address (+ where it ran for the usage log), an unticked one
 *            stays here, an ffmpeg job never moves
 *   use()    Settings ▸ Remote GPU's Use it = Remote, This computer = Local
 *   the LLMs against a stand-in RunPod vLLM endpoint: llmTarget (the model asked of /openai/v1/models), lib/llmChat.js
 *            and lib/captioner.js send to it with the key - and nothing starts here */
"use strict";
const fs = require("fs"), path = require("path"), http = require("http"), os = require("os");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "gpu745-"));
let CFG = { engine: { comfy: { url: "http://127.0.0.1:8188", autostart: true } }, llm: { port: 8090, external_url: "" }, captioner: {}, rgpu: { mode: "local", runpod: { key: "rpa_K" }, serverless: { endpoint: "epimg", cost_hr: 2 } } };
let started = [];
const corePath = require.resolve("../lib/core.js");
require.cache[corePath] = { id: corePath, filename: corePath, loaded: true, exports: { BASE: ROOT, WORKSPACE: TMP, STYLES_DIR: path.join(TMP, "styles"),
  getConfig: () => JSON.parse(JSON.stringify(CFG)), setConfig: (c) => { CFG = JSON.parse(JSON.stringify(c)); },
  ensureLlama: async (f) => { started.push("llama " + f); }, llamaState: () => ({}), llmPaths: () => ({ dir: TMP }) } };
const G = require("../lib/gpuSplit.js");
const R = require("../lib/remoteGpu.js");

(async () => {
  /* ---- pure */
  check("kindOf: pictures = image (image, upscale, a graph, 3D); video jobs and songs = video; ffmpeg / native / training = never",
    ["image", "imgupscale", "graph", "mesh3d"].every((m) => G.kindOf(m) === "image") && ["t2va", "ref2va", "fl2va", "swap", "ltx", "wan", "music", "seedvr2"].every((m) => G.kindOf(m) === "video")
      && ["export", "karaoke", "bridge", "viggle_native", "lora_train", "ft_llm", "install_whatever"].every((m) => G.kindOf(m) === null));
  const sp = { where: "both", image: true, video: false };
  check("routeOf: both = the ticked kinds remote; remote = all; local = none; no remote set up = local", G.routeOf("image", sp, true) === "remote" && G.routeOf("video", sp, true) === "local"
    && G.routeOf("video", { where: "remote" }, true) === "remote" && G.routeOf("image", { where: "local" }, true) === "local" && G.routeOf("image", { where: "remote" }, false) === "local" && G.routeOf(null, { where: "remote" }, true) === "local");
  check("slsChatUrl: RunPod's vLLM worker's OpenAI route", G.slsChatUrl("ab c1/2") === "https://api.runpod.ai/v2/abc12/openai/v1/chat/completions");

  /* ---- set() */
  let err = null; try { G.set({ where: "remote" }); } catch (e) { err = e; }
  check("Remote with no remote GPU set up: refused, saying where to set one up", err && err.status === 400 && /Settings ▸ Remote generation/.test(err.message));
  R.use("serverless");                              // Settings ▸ Remote GPU ▸ Use it
  check("Remote GPU's Use it = Remote (split), the remote remembered, ComfyUI's address the endpoint's", CFG.rgpu.split.where === "remote" && CFG.rgpu.remote_mode === "serverless" && /\/rpsl$/.test(CFG.engine.comfy.url));
  let v = G.set({ where: "both", image: true });
  check("Both: ComfyUI's address back to this computer's (its ComfyUI starts as before), the remote still known; routes image remote / video here",
    CFG.engine.comfy.url === "http://127.0.0.1:8188" && CFG.engine.comfy.autostart === true && CFG.rgpu.mode === "local" && CFG.rgpu.remote_mode === "serverless"
      && v.remote && v.remote.mode === "serverless" && v.routes.image === "remote" && v.routes.video === "local", v);
  /* ---- forJob */
  const jI = G.forJob(JSON.parse(JSON.stringify(CFG)), { mode: "image" });
  const jV = G.forJob(JSON.parse(JSON.stringify(CFG)), { mode: "ref2va" });
  const jE = G.forJob(JSON.parse(JSON.stringify(CFG)), { mode: "export" });
  check("forJob (Both, Image ticked): the image job's config = the endpoint's ComfyUI, not started here; where it ran for the usage log", /\/rpsl$/.test(jI.config.engine.comfy.url) && jI.config.engine.comfy.autostart === false
    && /image job renders on RunPod Serverless epimg/.test(jI.note) && jI.gpu.mode === "serverless" && jI.gpu.cost_hr === 2 && CFG.engine.comfy.url === "http://127.0.0.1:8188", jI);
  check("…a video job (Video not ticked) stays here; an export never moves", jV.config.engine.comfy.url === "http://127.0.0.1:8188" && /video job renders on this computer/.test(jV.note) && jV.gpu.mode === "local"
    && jE.config.engine.comfy.url === "http://127.0.0.1:8188" && !jE.note && jE.gpu === null);
  // the RunPod style filter: only the kinds Both sends to the endpoint (songs go with video)
  const RS = require("../lib/rpslStyles.js");
  // 2.746.0: in Both every style is listed - a remote style the endpoint cannot render is the only one hidden
  check("rpslStyles in Both: on, a serverless remote; a local style never hidden, a remote one only when the endpoint cannot render it", RS.settings().on && RS.settings().where === "both" && RS.settings().sls
    && RS.hideWhy({ runs_on: "local" }, { ok: false, why: "x" }, RS.settings()) === null && RS.hideWhy({ runs_on: "remote" }, { ok: false, why: "x" }, RS.settings()) === "x" && RS.hideWhy({ runs_on: "remote" }, { ok: true }, RS.settings()) === null);
  G.set({ where: "local" });
  check("Local: this computer's address; only the remote styles hidden (2.746.0); the remote still remembered", CFG.engine.comfy.url === "http://127.0.0.1:8188" && CFG.rgpu.remote_mode === "serverless" && !RS.settings().on && /GPU is on Local/.test(RS.hideWhy({ runs_on: "remote" }, { ok: true }, RS.settings()))
    && G.forJob(JSON.parse(JSON.stringify(CFG)), { mode: "image" }).config.engine.comfy.url === "http://127.0.0.1:8188");
  v = G.set({ where: "remote" });
  check("Remote again: the remembered remote back in use", /\/rpsl$/.test(CFG.engine.comfy.url) && CFG.rgpu.mode === "serverless" && v.where === "remote");
  R.use("local");
  check("Remote GPU's This computer = Local", CFG.rgpu.split.where === "local" && G.view().where === "local");

  /* ---- the LLMs: a stand-in RunPod vLLM endpoint */
  const seen = [];
  const srv = http.createServer((req, res) => {
    let body = ""; req.on("data", (d) => { body += d; });
    req.on("end", () => {
      seen.push({ url: req.url, auth: req.headers.authorization, body: body ? JSON.parse(body) : null });
      const j = (o) => { res.writeHead(200, { "Content-Type": "application/json" }); res.end(JSON.stringify(o)); };
      if (/\/openai\/v1\/models$/.test(req.url)) return j({ object: "list", data: [{ id: /vlmep/.test(req.url) ? "Qwen/Qwen2.5-VL-7B-Instruct" : "Qwen/Qwen3-8B" }] });
      if (/\/openai\/v1\/chat\/completions$/.test(req.url)) {
        const b = JSON.parse(body), img = JSON.stringify(b.messages).includes("image_url");
        return j({ choices: [{ message: { content: img ? "a red square on white" : "Hello from RunPod" } }] });
      }
      if (/\/health$/.test(req.url)) return j({ workers: { idle: 1 }, jobs: {} });
      j({});
    });
  });
  await new Promise((r) => srv.listen(0, "127.0.0.1", r));
  process.env.H3_RUNPOD_SLS_API = `http://127.0.0.1:${srv.address().port}/v2`;
  check("no vLLM endpoint: the LLMs stay here (llmTarget null) even on Remote", (G.set({ where: "remote" }), (await G.llmTarget("llm")) === null) && G.view().vllm_ready === false);
  G.saveVllm({ endpoint: "llmep", vlm_endpoint: "vlmep" });
  G.set({ where: "both", llm: true, vlm: false });
  let t = await G.llmTarget("llm");
  check("Both + LLM ticked: llmTarget = the endpoint's OpenAI route, the model asked of /openai/v1/models, the key as Bearer", t && /\/v2\/llmep\/openai\/v1\/chat\/completions$/.test(t.url) && t.model === "Qwen/Qwen3-8B" && t.headers.Authorization === "Bearer rpa_K", t);
  check("…Vision LLM not ticked: it stays here", (await G.llmTarget("vlm")) === null);
  started = [];
  const r1 = await require("../lib/llmChat.js").complete(require("../lib/core.js"), { messages: [{ role: "user", content: "hi" }] });
  const last = seen.filter((x) => /chat\/completions/.test(x.url)).pop();
  check("lib/llmChat.js: the chat goes to the vLLM endpoint (its model, the key) and no llama-server starts here", r1.ok && /Hello from RunPod/.test(r1.text) && last.auth === "Bearer rpa_K" && last.body.model === "Qwen/Qwen3-8B" && started.length === 0, { r1, started });
  G.set({ vlm: true });
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==", "base64");
  const d = await require("../lib/captioner.js").describe(require("../lib/core.js"), [{ buffer: png, mimetype: "image/png", originalname: "x.png" }]);
  const lastV = seen.filter((x) => /chat\/completions/.test(x.url)).pop();
  check("lib/captioner.js (Vision LLM ticked): the picture goes to the vision endpoint (its own model) - no vision model loads here", d[0] === "a red square on white" && /\/v2\/vlmep\//.test(lastV.url)
    && lastV.body.model === "Qwen/Qwen2.5-VL-7B-Instruct" && /image_url/.test(JSON.stringify(lastV.body.messages)) && started.length === 0, { d, url: lastV.url });
  const tv = await G.testVllm("vlm");
  check("✓ Test (vision): RunPod's health line + the model it serves", tv.ok && /1 ready/.test(tv.line) && tv.model === "Qwen/Qwen2.5-VL-7B-Instruct", tv);
  srv.close();

  /* ---- the wiring */
  const CORE = read("lib", "core.js"), RI = read("routes", "index.js"), UL = read("lib", "usageLog.js");
  check("core.js writes each job's config through gpuSplit.forJob (+ its note in the log, job._gpu); the usage log takes job._gpu first",
    /require\("\.\/gpuSplit"\)\.forJob\(jobCfg, job\.params\)/.test(CORE) && /config: jobCfg,/.test(CORE) && /job\._gpu = sp\.gpu/.test(CORE) && /entryFor\(job, priceNow\(\), job\._gpu \|\| remoteNow\(\)\)/.test(UL));
  check("quickPrompt.js asks llmTarget too; routes mounted from routes/index.js; Basic Settings has the GPU item + its script; nothing in server.js",
    /require\("\.\/gpuSplit"\)\.llmTarget\("llm"\)/.test(read("lib", "quickPrompt.js")) && /require\("\.\/gpuSplit"\)\.mount\(app\)/.test(RI)
      && /<h2 class="sec drop" data-sec="gpu"[^>]*><span class="caret">▾<\/span>GPU( <span id="gpuNow"[^>]*><\/span>)?<\/h2>\s*<div class="secbody" id="sec-gpu"/.test(read("static", "index.html")) && /<script src="\/static\/gpusplit\.js"><\/script>/.test(read("static", "index.html"))
      && !/gpuSplit|gpusplit/.test(read("misc", "server.js")));
  const BC = require("../static/basiccfg.js");
  check("the GPU choice is NOT one of Basic Settings' remembered fields (basic.cfg / per style) - put back, it re-routed the renders",
    /#sec-gpu/.test(BC.SKIP) && !BC.keepable({ id: "gpu_image", tagName: "INPUT", type: "checkbox", closest: (q) => (/#sec-gpu/.test(q) ? {} : null) }));
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch { /* fine */ }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log("FAIL: crashed " + (e && e.stack || e)); process.exit(1); });
