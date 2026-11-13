#!/usr/bin/env node
/* bitGen Studio — 2.773.0: THE LEFT DOCKER'S SYSTEM STATS ARE THE POD'S IN REMOTE MODE (lib/remoteStats.js shape / which / now,
 * static/remotestats.js merge / heading / diskRows, lib/podStats.js parse with the GPU temperature).
 * Tim (verbatim): "when in remote mode , show the remote gpus/ram/cpu/hdd stats in the left docker instead of the local stats" */
"use strict";
const path = require("path"), Module = require("module");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const stub = (rel, exp) => { const p = require.resolve(rel); const m = new Module(p); m.filename = p; m.loaded = true; m.exports = exp; require.cache[p] = m; };
let CFG = { rgpu: {} };
stub("../lib/core", { getConfig: () => CFG, setConfig: (c) => { CFG = c; }, BASE: ROOT });
const RS = require("../lib/remoteStats"), PS = require("../lib/podStats"), H = require("../static/remotestats.js");
const MB = 1048576, GB = 1e9;

(async () => {
  const said = 'bitgen-stats {"gpus": [{"name": "NVIDIA GeForce RTX 4090", "util": 87.0, "mem_used": ' + 12000 * MB + ', "mem_total": ' + 24564 * MB + ', "temp": 71.0}], "ram": {"total": ' + 64 * 1024 * MB + ', "used": ' + 20 * 1024 * MB + '}, "cpu": {"load": 6.0, "cores": 16}, "disks": [{"path": "/", "used": ' + 12 * GB + ', "total": ' + 50 * GB + '}, {"path": "/workspace", "used": ' + 80 * GB + ', "total": ' + 100 * GB + '}]}';
  const ps = PS.parse(said);
  check("podStats: nvidia-smi asked for the temperature too, and it is read (71 °C)", /temperature\.gpu/.test(PS.CODE) && ps.gpus[0].temp === 71 && ps.gpus[0].util === 87);
  check("…an older answer without a temperature: null (not 0)", PS.parse('bitgen-stats {"gpus": [{"name": "A", "util": 1, "mem_used": 1, "mem_total": 2}]}').gpus[0].temp === null);
  const sh = RS.shape(ps);
  check("shape: /api/stats' own units - CPU load % (6 / 16 cores = 38%), RAM and VRAM in MB, the disks in bytes",
    sh.cpu === 38 && sh.ram_used === 20480 && sh.ram_total === 65536 && sh.gpus[0].mem_used === 12000 && sh.gpus[0].mem_total === 24564 && sh.gpus[0].temp === 71 && sh.disks.length === 2 && sh.disks[1].total === 100 * GB, sh);
  const on = true, rem = { where: "remote" }, pods = { provider: "runpod", runpod: "pods", pods: true };
  check("which: Local / Both / remote generation off = this computer (null)",
    RS.which({ runpod: { pod_id: "p1" } }, on, { where: "local" }, pods) === null && RS.which({ runpod: { pod_id: "p1" } }, on, { where: "both" }, pods) === null && RS.which({ runpod: { pod_id: "p1" } }, false, rem, pods) === null);
  check("…Remote + RunPod ▸ Pods + a pod in use = that pod (its name, its ComfyUI port)", JSON.stringify(RS.which({ runpod: { pod_id: "p1", pod_name: "Krea pod", port: 3000 } }, on, rem, pods)) === JSON.stringify({ pod_id: "p1", name: "Krea pod", port: 3000 }));
  check("…Remote with no pod in use, Serverless or OpenRouter: why there is no machine to show",
    /no pod in use/.test(RS.which({}, on, rem, pods).none) && /Serverless/.test(RS.which({}, on, rem, { provider: "runpod", pods: false }).none) && /OpenRouter/.test(RS.which({}, on, rem, { provider: "openrouter" }).none));
  // live now(): stubbed split + pod stats
  const G = require("../lib/gpuSplit");
  G.enabled = () => true; G.split = () => ({ where: "remote" }); G.engineOf = () => pods;
  PS.stats = async () => ps;
  CFG.rgpu = { runpod: { pod_id: "p1", pod_name: "Krea pod", port: 8188 } };
  let r = await RS.now();
  check("now(): {remote: {pod_id, name}, stats} in remote mode", r.remote.pod_id === "p1" && r.remote.name === "Krea pod" && r.stats.gpus[0].name === "NVIDIA GeForce RTX 4090", r);
  PS.stats = async () => ({ gpus: [], ram: null, cpu: null, disks: [], how: "", error: "the pod is not answering yet" });
  r = await RS.now();
  check("…a pod not answering: its name + the error, no stats (the docker keeps this computer's)", r.remote.error && !r.stats, r);
  G.split = () => ({ where: "local" });
  check("…Local: {remote: null}", (await RS.now()).remote === null);
  // the page's part
  const local = { cpu: 12, cpu_temp: 55, ram_used: 9000, ram_total: 32000, gpus: [{ name: "RTX 5090", util: 3, temp: 40, mem_used: 2000, mem_total: 32000 }], running: { id: "j1" }, queue: 2, power: { gpus: [{ index: 0, power_w: 30 }], cpu_mhz: 4800, since: { wh: 12 } } };
  const remote = { remote: { pod_id: "p1", name: "Krea pod" }, stats: sh };
  const m = H.merge(local, remote);
  check("merge: CPU / RAM / GPUs are the pod's; the queue, the running job and ⚡ since start stay this computer's; no local GPU power on the pod's GPUs",
    m.cpu === 38 && m.cpu_temp === null && m.ram_total === 65536 && m.gpus.length === 1 && m.gpus[0].name === "NVIDIA GeForce RTX 4090" && m.running.id === "j1" && m.queue === 2
    && m.power.since.wh === 12 && m.power.gpus.length === 0 && m.power.cpu_mhz === null && m.remote.disks.length === 2 && local.gpus[0].name === "RTX 5090", m);
  check("…nothing from the pod = this computer's, untouched", H.merge(local, { remote: null }) === local);
  const hd = (r) => H.heading(r).text + " | " + H.heading(r).title;
  check("heading: System · ☁ <pod> | System · this computer (the why in its tooltip - one short line, the docker's layout stays) | not answering yet",
    hd(remote).startsWith("System · ☁ Krea pod | the pod's figures") && hd({ remote: null }) === "System | " && hd({ remote: { none: "no pod in use yet - PODS ▸ My pods ▸ Use it" } }) === "System · this computer | Remote mode - no pod in use yet - PODS ▸ My pods ▸ Use it"
    && hd({ remote: { pod_id: "p1", name: "Krea pod", error: "x" } }) === "System · this computer | Remote mode - ☁ Krea pod is not answering yet");
  const dr = H.diskRows(sh.disks);
  check("diskRows: the container disk + /workspace as bars, GB used / total, what each is", dr.length === 2 && dr[0].label === "Disk /" && dr[0].text === "12.0/50.0GB" && Math.round(dr[1].pct) === 80 && /kept while the pod is stopped/.test(dr[1].title) && /wiped/.test(dr[0].title), dr);
  console.log("\n" + pass + " passed, " + fail + " failed");
  console.log("RESULT: " + (fail ? "FAIL" : "PASS"));
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log("FAIL: " + (e && e.stack || e)); console.log("RESULT: FAIL"); process.exit(1); });
