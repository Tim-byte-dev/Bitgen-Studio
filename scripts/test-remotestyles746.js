#!/usr/bin/env node
/* bitGen Studio — 2.746.0 units: REMOTE STYLES (lib/styles.js gpuFields, lib/gpuSplit.js decide / forJob, lib/rpslStyles.js
 * hideWhy, the adapter's /rpsl/ep/<endpoint>).
 * Tim (verbatim): "when radio is selected for local show local styles, remote show remote styles (create remote styles),
 * both , show all styles" + "A Runs on setting per style ... add text input in styles for endpoints if remote style is
 * selected, prefix remote style names with R_ add this on save if it is not there" + "The style decides" (Both).
 *   styles   runs_on local|remote on every kind; a remote style's endpoint (cleaned), its name "R_" + name (never twice);
 *            back to local = the endpoint dropped and the "R_" taken off; a local "R_x" keeps its name
 *   lists    Local = this computer's styles; Remote = the remote ones; Both = all - and a remote style a serverless
 *            endpoint cannot render is hidden (unless "my image has node packs")
 *   routing  Local here; Remote there; Both: the STYLE decides, a job with no style follows the boxes; a remote style's
 *            own endpoint wins (/rpsl/ep/<id>); no remote and no endpoint = here, said why
 *   adapter  /rpsl/ep/<id> sends /run, /status and /cancel to THAT endpoint (a stand-in RunPod) */
"use strict";
const fs = require("fs"), path = require("path"), os = require("os"), http = require("http");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "rs746-"));
let CFG = { engine: { comfy: { url: "http://127.0.0.1:8188", autostart: true } }, rgpu: { mode: "local", runpod: { key: "rpa_K" }, serverless: { endpoint: "epmain", cost_hr: 1.5 } } };
const corePath = require.resolve("../lib/core.js");
require.cache[corePath] = { id: corePath, filename: corePath, loaded: true, exports: { BASE: ROOT, WORKSPACE: TMP, STYLES_DIR: path.join(TMP, "styles"),
  getConfig: () => JSON.parse(JSON.stringify(CFG)), setConfig: (c) => { CFG = JSON.parse(JSON.stringify(c)); } } };
const S = require("../lib/styles.js"), G = require("../lib/gpuSplit.js"), RS = require("../lib/rpslStyles.js"), R = require("../lib/remoteGpu.js");

(async () => {
  /* ---- the styles */
  const a = S.normalize({ kind: "image", name: "SDXL", runs_on: "remote", endpoint: " ohkr3evlck2bxn/!" }, null);
  check("a remote image style: runs_on remote, its endpoint cleaned, its name R_SDXL", a.runs_on === "remote" && a.endpoint === "ohkr3evlck2bxn" && a.name === "R_SDXL", a);
  check("…saved again: R_ never twice", S.normalize({ name: "R_SDXL" }, a).name === "R_SDXL");
  const b = S.normalize({ runs_on: "local" }, a);
  check("…back to this computer: local, the endpoint dropped, the R_ taken off", b.runs_on === "local" && b.endpoint === "" && b.name === "SDXL", b);
  check("a local style named R_mine keeps its name; a style with no runs_on is local", S.normalize({ kind: "image", name: "R_mine" }, null).name === "R_mine" && S.normalize({ kind: "image", name: "x" }, null).runs_on === "local");
  check("every kind: music and video styles too", S.normalize({ kind: "music", name: "Song", runs_on: "remote" }, null).name === "R_Song" && S.normalize({ kind: "video", name: "H3", runs_on: "remote", endpoint: "epv" }, null).endpoint === "epv");
  check("a local style's endpoint is not kept", S.normalize({ kind: "image", name: "x", endpoint: "ep" }, null).endpoint === "");

  /* ---- the lists */
  const ok = { ok: true }, no = { ok: false, why: "needs a node" };
  const H = (st, c, w, sls, all) => RS.hideWhy(st, c, { where: w, sls: !!sls, show_all: !!all });
  check("Local: the remote styles hidden, this computer's shown", /GPU is on Local/.test(H({ runs_on: "remote" }, ok, "local")) && H({ runs_on: "local" }, no, "local") === null);
  check("Remote: this computer's styles hidden, the remote ones shown - unless a serverless endpoint cannot render them", /GPU is on Remote/.test(H({ runs_on: "local" }, ok, "remote", true))
    && H({ runs_on: "remote" }, ok, "remote", true) === null && H({ runs_on: "remote" }, no, "remote", true) === "needs a node" && H({ runs_on: "remote" }, no, "remote", false) === null
    && H({ runs_on: "remote", endpoint: "ep" }, no, "remote", false) === "needs a node" && H({ runs_on: "remote" }, no, "remote", true, true) === null);
  check("Both: every style shown, but a remote style a serverless endpoint cannot render", H({ runs_on: "local" }, no, "both", true) === null && H({ runs_on: "remote" }, ok, "both", true) === null && H({ runs_on: "remote" }, no, "both", true) === "needs a node");

  /* ---- the routing (pure) */
  const rm = { mode: "serverless", url: "http://127.0.0.1:8311/rpsl", label: "RunPod Serverless epmain", cost_hr: 1.5 };
  const sls = { base: "http://127.0.0.1:8311/rpsl", key: "rpa_K", cost_hr: 1.5 };
  const D = (kind, st, sp, r) => G.decide(kind, st, sp, r === undefined ? rm : r, sls);
  const loc = { runs_on: "local" }, rem = { runs_on: "remote" }, remEp = { runs_on: "remote", endpoint: "epstyle" };
  check("Both: the STYLE decides - a remote style there, a local style here, whatever the boxes say", D("image", rem, { where: "both", image: false }).route === "remote" && D("image", loc, { where: "both", image: true }).route === "local");
  check("…a job with no style follows the boxes", D("image", null, { where: "both", image: true }).route === "remote" && D("video", null, { where: "both", video: false }).route === "local");
  check("Local: here, even a remote style; Remote: there, even a local style", D("image", rem, { where: "local" }).route === "local" && D("image", loc, { where: "remote" }).route === "remote");
  const de = D("image", remEp, { where: "both" });
  check("a remote style's own endpoint wins: /rpsl/ep/<its endpoint>", de.route === "remote" && de.target.url === "http://127.0.0.1:8311/rpsl/ep/epstyle" && /epstyle/.test(de.target.label) && de.target.cost_hr === 1.5, de);
  const dn = D("image", rem, { where: "both" }, null);
  check("…no remote GPU and no endpoint of its own: here, and the log says why", dn.route === "local" && /no remote GPU is set up/.test(dn.why));
  check("…no remote GPU but its own endpoint: there", D("image", remEp, { where: "both" }, null).route === "remote");

  /* ---- forJob with a real style file */
  const sty = S.normalize({ kind: "image", name: "Pic", runs_on: "remote", endpoint: "epstyle", workflow: "comfy_workflows/img_sdxl_t2i.json" }, null);
  S.writeStyle(path.join(TMP, "styles"), sty);
  const loc2 = S.normalize({ kind: "image", name: "Here", workflow: "comfy_workflows/img_sdxl_t2i.json" }, null);
  S.writeStyle(path.join(TMP, "styles"), loc2);
  R.use("serverless"); G.set({ where: "both", image: true });
  const f1 = G.forJob(JSON.parse(JSON.stringify(CFG)), { mode: "image", style_id: sty.id });
  const f2 = G.forJob(JSON.parse(JSON.stringify(CFG)), { mode: "image", style_id: loc2.id });
  check("forJob (Both): R_Pic renders on ITS endpoint (/rpsl/ep/epstyle), said in the log with the style", /\/rpsl\/ep\/epstyle$/.test(f1.config.engine.comfy.url) && /this image job \(R_Pic - a remote style\) renders on RunPod Serverless epstyle/.test(f1.note) && f1.gpu.mode === "serverless", f1.note);
  check("…a local style renders here (Image ticked or not)", f2.config.engine.comfy.url === "http://127.0.0.1:8188" && /\(Here\) renders on this computer/.test(f2.note));
  G.set({ where: "remote" });
  const f3 = G.forJob(JSON.parse(JSON.stringify(CFG)), { mode: "image", style_id: sty.id });
  const f4 = G.forJob(JSON.parse(JSON.stringify(CFG)), { mode: "image", style_id: loc2.id });
  check("forJob (Remote): a style's own endpoint still wins; another style takes the remote GPU in use (no change)", /\/rpsl\/ep\/epstyle$/.test(f3.config.engine.comfy.url) && f4.config.engine.comfy.url === CFG.engine.comfy.url && !f4.note);

  /* ---- the adapter: /rpsl/ep/<id> */
  const seen = [];
  const srv = http.createServer((q, s) => { let bd = ""; q.on("data", (d) => { bd += d; }); q.on("end", () => {
    seen.push(q.method + " " + q.url);
    s.writeHead(200, { "Content-Type": "application/json" });
    if (/\/run$/.test(q.url)) return s.end(JSON.stringify({ id: "jobX", status: "IN_QUEUE" }));
    if (/\/status\//.test(q.url)) return s.end(JSON.stringify({ id: "jobX", status: "IN_PROGRESS" }));
    if (/\/cancel\//.test(q.url)) return s.end(JSON.stringify({ id: "jobX", status: "CANCELLED" }));
    s.end("{}");
  }); });
  await new Promise((r) => srv.listen(0, "127.0.0.1", r));
  process.env.H3_RUNPOD_SLS_API = `http://127.0.0.1:${srv.address().port}/v2`;
  const SL = require("../lib/runpodServerless.js");
  const pr = await SL.prompt({ prompt: { 1: { class_type: "EmptyImage", inputs: {} }, 2: { class_type: "SaveImage", inputs: { images: ["1", 0], filename_prefix: "x" } } } }, "epstyle");
  await new Promise((r) => setTimeout(r, 2600));
  await SL.interrupt();
  check("the adapter with a style's endpoint: /run, /status and /cancel all go to /v2/epstyle (not the tab's epmain)", pr.prompt_id && seen.some((x) => x === "POST /v2/epstyle/run") && seen.some((x) => /^GET \/v2\/epstyle\/status\/jobX$/.test(x))
    && seen.some((x) => x === "POST /v2/epstyle/cancel/jobX") && !seen.some((x) => /epmain/.test(x)), seen);
  check("…/system_stats names that endpoint", /endpoint epstyle/.test(SL.stats("epstyle").system.comfyui_version) && /endpoint epmain/.test(SL.stats().system.comfyui_version));
  srv.close();
  const RT = fs.readFileSync(path.join(ROOT, "routes", "runpodServerless.js"), "utf8");
  check("routes: /rpsl/ep/:ep mounted BEFORE /rpsl (the same router)", RT.indexOf('app.use("/rpsl/ep/:ep", r)') > 0 && RT.indexOf('app.use("/rpsl/ep/:ep", r)') < RT.indexOf('app.use("/rpsl", r)'));
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch { /* fine */ }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log("FAIL: crashed " + (e && e.stack || e)); process.exit(1); });
