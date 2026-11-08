#!/usr/bin/env node
/* bitGen Studio — 2.720.0 in a REAL browser: A RENDER THAT STOPPED ON MISSING MODELS ASKS TO DOWNLOAD THEM (static/modelsfound.js
 * watchJobs, fed by the queue's poll - refreshJobs every 5 s).
 * Tim: "if worker exits with code 1 , check for models if models are not found ask if user wants to dl models"
 *   1. a job that failed (its worker exited with code 1) with models_missing: the box opens - "The render stopped: … Download
 *      it?", the file, "(ComfyUI refused it)", its download; asked ONCE (the next polls do not ask again)
 *   2. Cancel: closed, nothing downloaded
 *   3. another failed job: ⬇ Download -> /api/setup/download with its id, the job checked again ({job_id}) -> closed, the
 *      console says ↻ Retry
 *   4. a job that failed BEFORE the page opened, a failed job without missing models, a done job: no box
 *   5. THE REAL THING: the stub ComfyUI refusing a missing LoRA (STUB_CHECK_LORAS - in ComfyUI's own words), the Qwen Image
 *      2.1 edit Turbo8 style rendered without its LoRA -> the worker exits with code 1 -> the job carries models_missing
 *      (the LoRA, its catalogue download) + a [models] log line -> the app's own poll opens the box for it
 * 1-4: the jobs are played by the page (route /api/jobs). Against the running app (H3_URL, default :8311). No Playwright = SKIP. */
"use strict";
const path = require("path");
const fs = require("fs");
const os = require("os");
const { execSync, spawn } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the failed-render download browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
let pass = 0, fail = 0;
const check = (n, cond, got) => { if (cond) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const T8 = { id: "qwen21_turbo8", label: "Qwen Image 2.1 Turbo8 LoRA (8 steps)", size: 1360000000, repo: "chriswritescode/Turbo8-LoRA-Qwen-Image-2.1", dest: "comfy/loras" };
const MISS = [{ name: "turbo8_lora_step2500.safetensors", cat: "loras", folder: "models/loras", from: "comfyui", source: T8 }];
const now = () => Date.now() / 1000;
const job = (id, o) => Object.assign({ id, status: "failed", project: null, created: now() - 20, started: now() - 15, finished: now(), output: null, params: { mode: "image", prompt: "x" },
  chunk: null, meta: {}, progress: null, energy: null, remote: null, farm: null, models_missing: null }, o || {});

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  const ev = (f, a) => p.evaluate(f, a);
  const S = { jobs: [], checks: [], downloads: [], state: [] };
  try {
    await p.route("**/api/jobs", (r) => r.fulfill({ json: S.jobs }));
    await p.route("**/api/models/check", async (r) => { S.checks.push(JSON.parse(r.request().postData() || "{}")); await r.fulfill({ json: { checked: true, missing: [] } }); });
    await p.route("**/api/setup/download", async (r) => { S.downloads.push(JSON.parse(r.request().postData() || "{}")); await r.fulfill({ json: { ok: true } }); });
    await p.route("**/api/setup/state", (r) => r.fulfill({ json: S.state.length > 1 ? S.state.shift() : S.state[0] || { busy: false } }));
    // 4 (first): failed before the page opened - never asked
    S.jobs = [job("old1", { finished: now() - 3600, models_missing: { at: now() - 3600, missing: MISS } }), job("nomm"), job("ok1", { status: "done", output: "a.png" })];
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3ModelsFound && H3ModelsFound.watchJobs, null, { timeout: 60000 });
    await ev(() => refreshJobs()); await p.waitForTimeout(400);
    check("a job that failed before the page opened, one without missing models, a done one: no box", !(await ev(() => !!document.getElementById("mfDlg"))));

    // 1. a job that just failed with models missing
    S.jobs = [job("f1", { models_missing: { at: now(), missing: MISS } })].concat(S.jobs);
    await ev(() => refreshJobs());
    await p.waitForSelector("#mfDlg[open]", { timeout: 6000 }).catch(() => {});
    const box = await ev(() => { const d = document.getElementById("mfDlg"); return d && { lead: d.querySelector(".mfnote").textContent, name: d.querySelector(".mfname").textContent, where: d.querySelector(".mfwhere").textContent,
      src: d.querySelector(".mfsrc").textContent, dl: document.getElementById("mfDownload").textContent, focus: document.activeElement && document.activeElement.id }; });
    check("a job whose worker exited with an error, models missing: 'The render stopped: 1 model file it needs is not in any of ComfyUI's model paths. Download it?'",
      box && /^The render stopped: 1 model file it needs is not in any of ComfyUI's model paths\. Download it\?$/.test(box.lead), box);
    check("…the file, 'goes in models/loras (ComfyUI refused it)', its download (1.4 GB, the repo); ⬇ Download (1.4 GB), Cancel has the focus",
      box && box.name === "turbo8_lora_step2500.safetensors" && box.where === "goes in models/loras (ComfyUI refused it)" && /1\.4 GB - Hugging Face: chriswritescode/.test(box.src) && box.dl === "⬇ Download (1.4 GB)" && box.focus === "mfCancel", box);
    check("…said in the console too", /job f1 stopped - 1 model file\(s\) not found: turbo8_lora_step2500\.safetensors/.test(await ev(() => document.getElementById("log").textContent)));
    // 2. Cancel
    await p.click("#mfCancel"); await p.waitForTimeout(200);
    check("Cancel: closed, nothing downloaded", !(await ev(() => !!document.getElementById("mfDlg"))) && S.downloads.length === 0);
    await ev(() => refreshJobs()); await p.waitForTimeout(400);
    check("…asked once: the next poll does not ask again for that job", !(await ev(() => !!document.getElementById("mfDlg"))));

    // 3. ⬇ Download
    S.state = [{ busy: false, result: { ok: true, done: [], failed: [] }, files: { qwen21_turbo8: { state: "ok", got: 1, total: 1 } } }];
    S.jobs = [job("f2", { models_missing: { at: now(), missing: MISS } })].concat(S.jobs);
    await ev(() => refreshJobs());
    await p.waitForSelector("#mfDlg[open]", { timeout: 6000 }).catch(() => {});
    await p.click("#mfDownload").catch(() => {});
    await p.waitForFunction(() => !document.getElementById("mfDlg"), null, { timeout: 8000 }).catch(() => {});
    const logT = await ev(() => document.getElementById("log").textContent);
    check("another failed job: ⬇ Download fetches its catalogue id, the JOB is checked again ({job_id}), the box closes, the console says ↻ Retry",
      JSON.stringify(S.downloads[0]) === '{"ids":["qwen21_turbo8"]}' && S.checks.some((c) => c.job_id === "f2") && !(await ev(() => !!document.getElementById("mfDlg")))
      && /press ↻ Retry on the job in the Queue docker, or Generate again/.test(logT), { d: S.downloads, c: S.checks });
    check("no page errors", errs.length === 0, errs);
  } catch (e) { check("the run finished", false, String(e && e.stack || e)); }

  // 5. the real thing
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ui720-"));
  const md = path.join(tmp, "ComfyUI", "models");
  for (const [d, f] of [["diffusion_models", "qwen_image_2.1_int8_convrot.safetensors"], ["vae", "qwen_image_2.1_vae_bf16.safetensors"], ["text_encoders", "qwen3vl_8b_int8_convrot.safetensors"]]) {
    fs.mkdirSync(path.join(md, d), { recursive: true }); fs.writeFileSync(path.join(md, d, f), "x"); }
  fs.mkdirSync(path.join(md, "loras"), { recursive: true });
  const CPORT = 8724 + Math.floor(Math.random() * 200);
  const stub = spawn("python3", [path.join(__dirname, "stub-comfy.py"), String(CPORT), path.join(tmp, "out")], { stdio: "ignore", env: Object.assign({}, process.env, { STUB_CHECK_LORAS: "1", STUB_MODELS_ROOT: md }) });
  const api = async (u, body) => (await fetch(URL_ + u.replace(/^\//, ""), body === undefined ? {} : { method: "POST", headers: { "Content-Type": "application/json", "X-Models-Check": "skip" }, body: JSON.stringify(body) })).json();
  const cfg0 = await api("/api/config");
  const p2 = await b.newPage({ viewport: { width: 1600, height: 1000 } });
  try {
    for (let i = 0; i < 40; i++) { try { if ((await fetch(`http://127.0.0.1:${CPORT}/system_stats`)).ok) break; } catch { /* not yet */ } await new Promise((r) => setTimeout(r, 250)); }
    await api("/api/config", { engine: { backend: "comfy", comfy: Object.assign({}, (cfg0.engine || {}).comfy || {}, { url: `http://127.0.0.1:${CPORT}`, dir: path.join(tmp, "ComfyUI") }) } });
    await p2.goto(URL_, { waitUntil: "domcontentloaded" });
    await p2.waitForFunction(() => typeof dsReady !== "undefined" && dsReady && window.H3ModelsFound, null, { timeout: 60000 });
    const sts = await api("/api/styles?kind=image");
    const t8 = (sts.styles || sts).find((x) => x.name === "Qwen Image 2.1 edit Turbo8");
    const j0 = await api("/api/genimage", { prompt: "a red fox", style_id: t8.id });     // X-Models-Check: skip - straight to the worker
    let jj = {};
    for (let i = 0; i < 120; i++) { jj = await api(`/api/jobs/${j0.id}?log_from=0`); if (jj.status === "failed" || jj.status === "done") break; await new Promise((r) => setTimeout(r, 500)); }
    const lg = (jj.log || []).join("\n");
    check("the real render (Turbo8 style, no LoRA on disk, the stub refusing it as ComfyUI does): the worker exits with code 1",
      jj.status === "failed" && /Value not in list \[lora_name\] = turbo8_lora_step2500\.safetensors/.test(lg) && /worker exited with code 1/.test(lg), { st: jj.status, log: (jj.log || []).slice(-6) });
    const mm = (jj.models_missing || {}).missing || [];
    check("…the job carries models_missing: the LoRA, refused by ComfyUI, its catalogue download; a [models] line in its log",
      mm.length === 1 && mm[0].name === "turbo8_lora_step2500.safetensors" && mm[0].from === "comfyui" && mm[0].source && mm[0].source.id === "qwen21_turbo8"
      && /\[models\] 1 model file\(s\) it needs are not in ComfyUI's model paths: turbo8_lora_step2500\.safetensors/.test(lg), jj.models_missing);
    await p2.evaluate(() => refreshJobs());
    await p2.waitForSelector("#mfDlg[open]", { timeout: 8000 }).catch(() => {});
    const bx = await p2.evaluate(() => { const d = document.getElementById("mfDlg"); return d && { lead: d.querySelector(".mfnote").textContent, name: d.querySelector(".mfname").textContent }; });
    check("…the app's own poll opens the box for it: 'The render stopped: … Download it?' with the LoRA", bx && /^The render stopped: 1 model file/.test(bx.lead) && bx.name === "turbo8_lora_step2500.safetensors", bx);
    await p2.click("#mfCancel").catch(() => {});
  } catch (e) { check("the real run finished", false, String(e && e.stack || e)); }
  finally {
    try { await api("/api/config", { engine: cfg0.engine || {} }); } catch { /* best effort */ }
    try { stub.kill(); } catch { /* gone */ }
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* fine */ }
    try { await b.close(); } catch { /* fine */ }
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
  process.exit(fail ? 1 : 0);
})();
