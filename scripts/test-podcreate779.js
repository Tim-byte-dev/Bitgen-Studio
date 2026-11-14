#!/usr/bin/env node
/* bitGen Studio — 2.779.0: A POD THAT COULD NOT BE CREATED SAYS WHY, IN A DIALOG. RunPod's template ids (runpod-torch-v280,
 * tpl_abc) taken (lib/pods.js createBody refused them: "pick a template first" - RunPod was never asked); RunPod's own words kept
 * (lib/runpodApi.js saidOf / e.said / e.httpStatus); explained (lib/podCreateErr.js: busy / money / key / template / cuda);
 * returned as `problem` (routes/pods.js, podPresets.js, stylePods.js) and shown (static/poderr.js).
 * Tim (verbatim): "when creating a pod, it asks me to create a template first...can you report the real error in a dialog so the
 * user can see that there is a problem. i suspect it is because the gpu i selected was busy" */
"use strict";
const fs = require("fs"), os = require("os"), path = require("path"), Module = require("module");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
let CFG = { rgpu: { runpod: { key: "rpa_TEST" } } };
const coreP = require.resolve("../lib/core"); const fake = new Module(coreP); fake.filename = coreP; fake.loaded = true;
fake.exports = { getConfig: () => CFG, setConfig: (c) => { CFG = c; }, BASE: ROOT, STYLES_DIR: os.tmpdir() };
require.cache[coreP] = fake;
const P = require("../lib/pods"), A = require("../lib/runpodApi"), X = require("../lib/podCreateErr"), UI = require("../static/poderr.js");
const rd = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const BUSY = "There are no longer any instances available with the requested specifications. Please refresh and try again.";

(async () => {
  /* ---- the template check */
  const ok = (id) => { try { return P.createBody({ templateId: id, gpu: "NVIDIA GeForce RTX 4090" }).templateId === id; } catch { return false; } };
  check("RunPod's own template ids are taken (runpod-torch-v280, tpl_abc, 9x4m2p7v) - the old letters-and-digits check refused them", ok("runpod-torch-v280") && ok("tpl_abc") && ok("9x4m2p7v") && ok("30zmvf89kd"));
  let e1 = null; try { P.createBody({ gpu: "x" }); } catch (e) { e1 = e; }
  let e2 = null; try { P.createBody({ templateId: "../etc", gpu: "x" }); } catch (e) { e2 = e; }
  check("…no template = said as that (local), a made-up id refused", e1 && e1.local === "template" && /no template was picked/.test(e1.message) && e2 && /not one RunPod gives/.test(e2.message), [e1 && e1.message, e2 && e2.message]);

  /* ---- RunPod's words kept */
  check("saidOf: detail / message / error / a list of errors / plain text - an HTML page is not words", A.saidOf({ detail: "a" }) === "a" && A.saidOf({ error: "b" }) === "b" && A.saidOf({ errors: [{ message: "c" }, { msg: "d" }] }) === "c; d" && A.saidOf(null, "plain text") === "plain text" && A.saidOf(null, "<html>x") === "");
  let ce = null;
  try { await A.call("POST", "/pods", "k", {}, { fetch: async () => ({ status: 500, ok: false, text: async () => JSON.stringify({ error: "create pod: " + BUSY }) }) }); } catch (e) { ce = e; }
  check("a refused create keeps RunPod's whole words + its HTTP status on the error", ce && ce.said === "create pod: " + BUSY && ce.httpStatus === 500 && ce.message.includes(BUSY), ce && { m: ce.message, said: ce.said, st: ce.httpStatus });

  /* ---- explained */
  const body = { templateId: "runpod-torch-v280", template_name: "Runpod Pytorch 2.8.0", gpu: { id: "NVIDIA GeForce RTX 5090", count: 1, minCudaVersion: "12.8" }, cloud: "SECURE", disk: 50, mounts: { persistent: { size: 100 } } };
  const b = X.explain({ said: BUSY, httpStatus: 500 }, body);
  check("busy: 'The GPU you picked is busy', the GPU + cloud + CUDA named, what to do, nothing charged", b.kind === "busy" && b.title === "The GPU you picked is busy" && /no free NVIDIA GeForce RTX 5090 on Secure cloud right now with CUDA 12\.8/.test(b.hint) && /try Community cloud/.test(b.hint) && /nothing was charged/.test(b.hint), b);
  check("…what was asked for: template, GPU, cloud, host, disks", JSON.stringify(b.asked) === JSON.stringify([["Template", "Runpod Pytorch 2.8.0"], ["GPU", "NVIDIA GeForce RTX 5090"], ["Cloud", "Secure"], ["Host", "CUDA 12.8 or newer only"], ["Disks", "50 GB container + 100 GB /workspace"]]), b.asked);
  check("money / key / template / cuda / other", X.explain({ said: "Insufficient balance to deploy this pod" }).kind === "money" && X.explain({ httpStatus: 401, said: "x" }).kind === "key"
    && X.explain({ local: "template", message: "no template" }).kind === "template" && X.explain({ said: "no host with the CUDA driver" }).kind === "cuda" && X.explain({ said: "server exploded" }).kind === "other");

  /* ---- pods.create: the problem goes with the error */
  A.templates = async () => [{ id: "runpod-torch-v280", name: "Runpod Pytorch 2.8.0", imageName: "runpod/pytorch:2.8.0-py3.11-cuda12.8.1", isRunpod: true }];
  let sent = null;
  A.createPod = async (bd) => { sent = bd; const e = new Error("RunPod answered HTTP 500: " + BUSY); e.said = BUSY; e.httpStatus = 500; e.status = 502; throw e; };
  let pe = null; try { await P.create({ templateId: "runpod-torch-v280", gpu: "NVIDIA GeForce RTX 5090", cloud: "SECURE" }); } catch (e) { pe = e; }
  check("create: RunPod asked (the template id sent as it is), its refusal comes back with problem = busy", sent && sent.templateId === "runpod-torch-v280" && pe && pe.problem && pe.problem.kind === "busy" && pe.problem.said === BUSY && pe.problem.status === 500, pe && pe.problem);
  let le = null; try { await P.create({ templateId: "", gpu: "x" }); } catch (e) { le = e; }
  // 2.780.0: no template named = the bitGen pod's own; none in RunPod's list = said as a template problem
  check("…no template named and the bitGen pod's not in RunPod's list - problem kind template", le && le.problem && le.problem.kind === "template" && /PyTorch template .* is not in its template list/.test(le.problem.said) && /🔄/.test(le.problem.hint), le && le.problem);

  /* ---- the routes hand it over */
  const R = {}; require("../routes/pods").mount({ get: () => {}, post: (u, f) => { R[u] = f; }, delete: () => {} });
  let out = null, code = 0; await R["/api/pods/create"]({ body: { templateId: "runpod-torch-v280", gpu: "NVIDIA GeForce RTX 5090" } }, { json: (j) => { out = j; }, status: (c) => { code = c; return { json: (j) => { out = j; } }; } });
  check("POST /api/pods/create answers {error, problem} (502)", code === 502 && out && /no longer any instances/.test(out.error) && out.problem && out.problem.title === "The GPU you picked is busy", { code, out });
  check("the presets' ▶ and the 'no pod yet' box answer with problem too", /e && e\.problem \? \{ problem: e\.problem \}/.test(rd("routes/podPresets.js")) && /e && e\.problem \? \{ problem: e\.problem \}/.test(rd("routes/stylePods.js")));

  /* ---- the dialog */
  const t = UI.textOf(b, "x");
  check("static/poderr.js textOf (📋 Copy): title, what to do, RunPod said (HTTP 500), asked for", /^The GPU you picked is busy\n\nRunPod has no free/.test(t) && /RunPod said \(HTTP 500\): There are no longer/.test(t) && /Asked for:\n  Template: Runpod Pytorch 2\.8\.0/.test(t), t);
  check("shown from PODS ▸ Create pod, 📦 Presets ▸ ▶ and the 'no pod yet' box; the page loads static/poderr.js",
    /if \(r\.error\) \{ say\(r\.error, false\); if \(root\.H3PodErr\) H3PodErr\.show\(r\); return; \}/.test(rd("static/podsdock.js")) && /H3PodErr\.show\(r\)/.test(rd("static/podpresets.js")) && /H3PodErr\.show\(r\)/.test(rd("static/stylepodask.js")) && /<script src="\/static\/poderr\.js">/.test(rd("static/index.html")));
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
