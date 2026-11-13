#!/usr/bin/env node
/* bitGen Studio — 2.764.1 units: Basic Settings ▸ GPU on Local hides every remote detail (static/gpusplit.js).
 * Tim (verbatim): "if local is selected in basic settings, hide all the remote gpu details and options. the remote gpu radio
 * group ☁ Remote generation docker🖥 PODS 💲 RunPod pods: none running · $0.00 today · $1.31 this month." */
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 500))); } };
const G = require("../static/gpusplit.js");
check("isReady: Remote needs a remote GPU or RunPod ▸ Pods", G.isReady("remote", { remote: { label: "x" } }) && G.isReady("remote", { engine: { pods: true } }) && !G.isReady("remote", { engine: { pods: false } }));
check("isReady: Both also takes a remote LLM; Local always", G.isReady("both", { vllm_ready: true }) && !G.isReady("both", {}) && G.isReady("local", {}));
check("localView: Local = hidden; a Remote / Both waiting for its set-up shows them", G.localView({ where: "local" }, null) && !G.localView({ where: "local" }, "remote") && !G.localView({ where: "both" }, null));
const S = fs.readFileSync(path.join(ROOT, "static", "gpusplit.js"), "utf8");
check("Local hides: the Remote servers / RunPod groups, the Both boxes, ☁ Remote generation docker, 🖥 PODS, 💲 RunPod, the old 💲 line, ⚙ Settings ▸ Remote generation",
  G.LOCAL_HIDE.join() === "gpuEngine,gpuBoxes,gpuDock,gpuPods,gpuRpDock,gpuPodCost,gpuSetup" && /"#sec-gpu\.gpuLocal #" \+ id/.test(S) && /\{display:none!important\}/.test(S) && /classList\.toggle\("gpuLocal", loc\)/.test(S));
check("…its line: \"Every job runs on this computer.\"; picking Local closes the Remote generation / PODS dockers (2.771.0: not 💲 Costs - this computer's costs are in it)",
  /loc \? "Every job runs on this computer\."/.test(S) && /\["rgen", "pods"\]/.test(S) && /if \(w === "local" && r && !r\.error\) closeRemote\(\)/.test(S));
check("Remote / Both always pickable: not set up = it waits (S.pick), the engine choice saves it when it can", /i\.disabled = false;/.test(S) && /S\.pick = w;/.test(S) && /function waiting\(v\)/.test(S) && /\.then\(waiting\)/.test(S));
// 2.764.1: a model sent to the pod - how far, and the Queue card says it instead of "waiting for the GPU"
const SD = require("../lib/podSend");
const t1 = SD.progressText("Krea2/krea2WRC10.safetensors", 1.2e9, 6.5e9, 350), t0 = SD.progressText("Krea2/a.safetensors", 0, 6.5e9, 0);
check("progressText: name, GB of GB, %, MB/s, time left", t1 === "sending krea2WRC10.safetensors to the pod - 1.2 GB of 6.5 GB (18%) · 3.4 MB/s · about 26 min left" && t0 === "sending a.safetensors to the pod - 0 MB of 6.5 GB (0%)" && SD.progressText("x.pt", 0, 0, 0) === "sending x.pt to the pod", [t1, t0]);
check("…near the end: under 2 min left; slow: hours", /under 2 min left$/.test(SD.progressText("m", 6.4e9, 6.5e9, 600)) && /about \d+\.\d h left$/.test(SD.progressText("m", 1e8, 6.5e9, 600)));
const QR = require("../static/queuerun.js");
check("Queue card: a render waiting for its pod says what the pod is doing (job.pod_note), not \"waiting for the GPU\"", QR.runText(null, "queued", "making Krea ready: sending a.safetensors to the pod - 1.2 GB of 6.5 GB (18%)") === "🖥 making Krea ready: sending a.safetensors to the pod - 1.2 GB of 6.5 GB (18%)" && QR.runText(null, "queued") === "waiting for the GPU"
  && /runText\(job\.progress, job\.status, job\.pod_note\)/.test(fs.readFileSync(path.join(ROOT, "static", "queuerun.js"), "utf8")));
const PSd = fs.readFileSync(path.join(ROOT, "lib", "podSend.js"), "utf8"), PP = fs.readFileSync(path.join(ROOT, "lib", "podPrep.js"), "utf8"), RV = fs.readFileSync(path.join(ROOT, "lib", "podRevive.js"), "utf8");
check("…the progress reaches the job: podSend.sendOne tells it every few seconds, podPrep passes its say, Override's checkpoint (modelGate) too",
  /tell\(progressText\(name, f \? f\.done \|\| 0 : 0/.test(PSd) && /async function ensure\(id, port, cats, name, say\)/.test(PSd) && /D\.send\(pod, port, f\.cats, f\.name, \(t\) => say\(t\)\)/.test(PP) && /await SD\.ensure\(podId, \+port \|\| \+st\.pod_port \|\| 0, it\.cats, it\.name, \(t\) => \{ m\.note = t/.test(RV));
console.log(`\n${pass} passed, ${fail} failed`);
console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
process.exit(fail ? 1 : 0);
