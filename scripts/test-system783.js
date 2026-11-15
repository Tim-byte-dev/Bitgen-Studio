#!/usr/bin/env node
/* bitGen Studio — 2.783.0: THE LEFT DOCKER IS SYSTEM; POD + LOCAL STATS; BASIC SETTINGS ▸ GPU GONE; REMOTE / PODS ON THE STATUS
 * BAR; ALL LOCAL / ALL REMOTE / BOTH AT THE TOP OF THE ☁ REMOTE GENERATION DOCKER.
 * Tim (verbatim): "in the left docker, rename it to system - when using a pod show pod stats, if using pod + local show all the
 * stats of hardware being used including remote - remove the gpu menuitem in basic settings, add remote docker button to the
 * statusbar, if any of the tools use remote generation show Pods button in statusbar for the pods docker if everything is in
 * local mode then hide the pods button. add a radio group to the top of the remote generation docker for all Local, all remote,
 * both"
 * Pure + source checks (no server): lib/remoteStats which (mixed), static/remotestats.js podRows / heading, static/remotebtns.js
 * anyRemote, static/gpusplit.js bodyOf, static/remotetypes.js rowBody, static/index.html.
 */
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
function check(name, ok) { if (ok) { pass++; console.log("PASS: " + name); } else { fail++; console.log("FAIL: " + name); } }
const src = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");

const RS = require("../lib/remoteStats");
const pods = { provider: "runpod", pods: true }, rp = { runpod: { pod_id: "p1", pod_name: "Krea pod" } };
const per = (o) => Object.assign({ where: "remote", per: true, image: true, video: true, music: true }, o);
check("which: All remote (every type remote) = the pod alone (not mixed)", RS.which(rp, true, per({}), pods).mixed === false);
check("which: a type still Local = mixed (this computer + the pod)", RS.which(rp, true, per({ music: false }), pods).mixed === true);
check("which: Both = mixed", RS.which(rp, true, { where: "both", per: true, image: true }, pods).mixed === true);
check("which: Both with no pod in use / not on Pods = this computer only (null, no complaint)",
  RS.which({}, true, { where: "both" }, pods) === null && RS.which(rp, true, { where: "both" }, { provider: "runpod", pods: false }) === null);
check("which: All local = null", RS.which(rp, true, { where: "local" }, pods) === null);

const ST = require("../static/remotestats.js");
const rows = ST.podRows({ cpu: 37, ram_used: 4096, ram_total: 65536, gpus: [{ name: "NVIDIA A40", util: 88, temp: 61, mem_used: 20480, mem_total: 46068 }], disks: [{ path: "/workspace", used: 5e10, total: 1e11 }] });
check("podRows: CPU, RAM, the GPU's load + temperature, its VRAM, the disks", rows.map((r) => r.label).join("|") === "CPU|RAM|GPU0 · A40|GPU0 VRAM|Disk /workspace"
  && rows[2].text === "88% · 61°C" && rows[3].text === "20.0/45GB" && Math.round(rows[4].pct) === 50);
check("podRows: a GPU that does not say its load = n/a", ST.podRows({ gpus: [{ name: "X", util: null, mem_total: 0 }] })[0].text === "n/a");
check("heading: mixed = just System (the pod has its own frame)", ST.heading({ remote: { pod_id: "p1", name: "Krea pod", mixed: true } }).text === "System");
check("heading: the pod alone = System · ☁ pod (as before)", ST.heading({ remote: { pod_id: "p1", name: "Krea pod" } }).text === "System · ☁ Krea pod");
const rsj = src("static/remotestats.js");
check("remotestats: mixed keeps this computer's figures and paints the pod's frame (#statsPod)", /if \(r\.remote\.mixed\) \{ paintPod\(r, Bar\); return s; \}/.test(rsj) && /statsPod/.test(rsj));

const RB = require("../static/remotebtns.js");
check("anyRemote: All local = no Pods button", !RB.anyRemote({ where: "local", types: { image: "remote" } }));
check("anyRemote: Both with every type Local and the LLMs here = no Pods button", !RB.anyRemote({ where: "both", types: { image: "local", video: "local" }, routes: { llm: "local", vlm: "local" } }));
check("anyRemote: one type Remote = Pods", RB.anyRemote({ where: "both", types: { stems: "remote" } }));
check("anyRemote: the LLM on Remote = Pods", RB.anyRemote({ where: "both", types: {}, routes: { llm: "remote" } }));
check("anyRemote: nothing known yet = no Pods", !RB.anyRemote(null));

const GS = require("../static/gpusplit.js");
const all = GS.bodyOf("remote");
check("bodyOf: All remote = where remote + every type remote (per)", all.where === "remote" && all.per === true && GS.TYPES_ALL.every((k) => all[k] === true));
check("bodyOf: Both = the rows decide (per, no type changed)", JSON.stringify(GS.bodyOf("both")) === JSON.stringify({ where: "both", per: true }));
check("bodyOf: All local", JSON.stringify(GS.bodyOf("local")) === JSON.stringify({ where: "local" }));
const gsj = src("static/gpusplit.js");
check("gpusplit: the labels are All local / All remote / Both", /"All local"/.test(gsj) && /"All remote"/.test(gsj) && /\["both", "Both"/.test(gsj));
check("gpusplit: All remote also puts the LLM / Vision LLM on Remote", /if \(w === "remote"\) llmAll\("remote"\)/.test(gsj));
check("gpusplit: All local closes only 🖥 PODS (not the docker it was picked in)", /\["pods"\]\.forEach/.test(gsj) && !/\["rgen", "pods"\]/.test(gsj));

const RT = require("../static/remotetypes.js");
check("rowBody: a row put to Local while All remote = Both", RT.rowBody("remote", "image", false).where === "both");
check("rowBody: a row put to Remote on Both stays Both (no where sent)", !("where" in RT.rowBody("both", "image", true)));

const html = src("static/index.html");
check("index.html: the left docker's title is System", /<div class="dockhead"><h1 style="font-size:\.8rem">System<\/h1><\/div>/.test(html) && !/<h1 style="font-size:\.8rem">Settings<\/h1>/.test(html));
check("index.html: no Basic Settings ▸ GPU item (#sec-gpu a hidden host only)", !/data-sec="gpu"/.test(html) && /<div id="sec-gpu" hidden/.test(html));
check("index.html: remotebtns.js loaded after podsdock.js", html.indexOf("/static/remotebtns.js") > html.indexOf("/static/podsdock.js"));
const rd = src("static/remotedock.js");
check("remotedock: the radio group section first in the docker, the choices moved into it", /d\.innerHTML = '<section class="rgdWhere" id="rgdWhere"/.test(rd) && /\["gpuWhere", "gpuLine", "gpuMsg"\]/.test(rd));
check("remotedock: no ☁ button in Basic Settings any more", !/gpuDock/.test(rd));
const rbj = src("static/remotebtns.js");
check("remotebtns: Remote shown while Use remote generation is on, Pods only while something runs remotely", /r\.style\.display = S\.on \? "" : "none"/.test(rbj) && /useP = !!S\.on && anyRemote\(S\.v\)/.test(rbj));

console.log(`\n${pass} passed, ${fail} failed`);
console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
process.exit(fail ? 1 : 0);
