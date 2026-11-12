#!/usr/bin/env node
/* bitGen Studio — 2.764.6: a pod job outlives its Jupyter kernel - the Python bitGen sends runs here for real (python3): the
 * "kernel" ends straight after it answers (as runKernel shuts it down) and the download still finishes; Hugging Face's gated
 * answer is said in words on the pod; a job that cannot start says why.
 * Tim (verbatim): "if the model is gated, i am guessing krea2 is gated, downloading for 5 minutes so far and still 0%, check
 * to see if it is gated and report to the user" */
"use strict";
const http = require("http"), fs = require("fs"), os = require("os"), path = require("path"), crypto = require("crypto");
const { spawnSync } = require("child_process");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
if (spawnSync("python3", ["--version"]).status !== 0) { console.log("SKIP: no python3"); console.log("RESULT: PASS"); process.exit(0); }
const T = fs.mkdtempSync(path.join(os.tmpdir(), "podjob7646-")), COMFY = path.join(T, "ComfyUI"), CWD = path.join(T, "jroot");
fs.mkdirSync(path.join(COMFY, "models"), { recursive: true }); fs.mkdirSync(CWD);
const BLOB = crypto.randomBytes(600000);
const srv = http.createServer(async (q, s) => {
  if (/gated/.test(q.url)) { s.writeHead(q.headers.authorization ? 403 : 401, { "X-Error-Code": "GatedRepo" }); return s.end("Access to model is restricted"); }
  if (/missing/.test(q.url)) { s.writeHead(404, { "X-Error-Code": "EntryNotFound" }); return s.end("Entry not found"); }
  // slow: 6 parts over ~1.5 s, so the "kernel" has long gone when it ends
  s.writeHead(200, { "Content-Length": BLOB.length });
  for (let i = 0; i < 6; i++) { s.write(BLOB.subarray(i * 100000, (i + 1) * 100000)); await sleep(250); }
  s.end();
});
srv.listen(0, "127.0.0.1", async () => {
  const P = srv.address().port;
  process.env.H3_HF_BASE = "http://127.0.0.1:" + P + "/hf";
  process.env.H3_POD_JOB_BEAT = "1";
  const PM = require("../lib/podModels"), J = require("../lib/podJob");
  const kernel = (code) => { const t0 = Date.now(); const r = spawnSync("python3", ["-c", code], { cwd: CWD, encoding: "utf8", timeout: 30000 }); return { out: r.stdout, err: r.stderr, status: r.status, ms: Date.now() - t0 }; };
  const status = () => { try { return JSON.parse(fs.readFileSync(path.join(CWD, ".bitgen_dl.json"), "utf8")); } catch { return null; } };
  try {
    const files = [{ name: "krea2_raw_fp8_scaled.safetensors", folder: "diffusion_models", url: PM.HF + "/Comfy-Org/Krea-2/resolve/main/krea2_raw_fp8_scaled.safetensors", size: BLOB.length },
      { name: "flux1-dev.safetensors", folder: "diffusion_models", url: PM.HF + "/black-forest-labs/gated/resolve/main/flux1-dev.safetensors", size: 5 },
      { name: "old.safetensors", folder: "vae", url: PM.HF + "/x/missing/resolve/main/old.safetensors", size: 5 }];
    fs.writeFileSync(path.join(CWD, ".bitgen_dl.json"), JSON.stringify({ running: true, files: [{ name: "stale", state: "downloading", done: 0 }] }));   // left by an older job
    const k = kernel(J.detach(PM.dlCode(files, COMFY, "")));
    check("the kernel answers bitgen-started and ENDS at once (as bitGen shuts it down) - well before the download is through", k.status === 0 && /bitgen-started/.test(k.out) && k.ms < 1500, k);
    const s0 = status();
    check("…the old status file was replaced by the new job's (no 'stale' row)", s0 && s0.files && s0.files[0].name === "krea2_raw_fp8_scaled.safetensors", s0);
    let s = null;
    for (let i = 0; i < 80; i++) { await sleep(150); s = status(); if (s && !s.running) break; }
    const dst = path.join(COMFY, "models", "diffusion_models", "krea2_raw_fp8_scaled.safetensors");
    check("the job carried on without its kernel: the file is whole on the 'pod', done (before 2.764.6: 0% forever)", s && !s.running && s.files[0].state === "done" && fs.existsSync(dst) && fs.readFileSync(dst).equals(BLOB), s);
    check("…a heartbeat was kept while it ran", s && +s.beat >= 1, s && s.beat);
    check("…a gated file: said in words on the pod (accept its license, add the Hugging Face token)", /^failed: gated or private - open huggingface\.co\/black-forest-labs\/gated, accept its license, then add your Hugging Face token in Settings > Models and try again \(HTTP 401\)/.test(s.files[1].state), s.files[1]);
    check("…a file that is not there: not found (HTTP 404)", /^failed: not found - huggingface\.co\/x\/missing does not have this file \(HTTP 404\)/.test(s.files[2].state), s.files[2]);
    check("…its output went to .bitgen_job_dl.log; the job is .bitgen_job_dl.py", fs.existsSync(path.join(CWD, ".bitgen_job_dl.log")) && fs.existsSync(path.join(CWD, ".bitgen_job_dl.py")));
    // a job that cannot start
    const broken = PM.dlCode(files.slice(0, 1), COMFY, "").replace("import json, os, threading, urllib.request, time", "import json, os, threading, urllib.request, time, no_such_module_7646");
    const k2 = kernel(J.detach(broken));
    check("a job that cannot start: bitgen-job-failed + the reason from its log (not 'started' and silence)", /bitgen-job-failed .*no_such_module_7646/.test(k2.out) && !/bitgen-started/.test(k2.out) && J.failed(k2.out).includes("no_such_module_7646"), k2);
    // the PC-side check against the same stand-in
    const r = await require("../lib/hfCheck").check(files, "", { base: PM.HF });
    check("hfCheck against the stand-in: Krea-2 goes; the gated and the missing file held back with their reasons", r.ok.length === 1 && /^gated/.test(r.blocked[0].why) && /^not found/.test(r.blocked[1].why), r);
  } catch (e) { check("no error", false, String(e && e.stack)); }
  srv.close(); fs.rmSync(T, { recursive: true, force: true });
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
  process.exit(fail ? 1 : 0);
});
