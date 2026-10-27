#!/usr/bin/env node
/* bitGen Studio — scripts/test-comfyboot603.js (2.603.0): A COMFYUI ALREADY RUNNING WHEN THE APP STARTS IS RESTARTED
 * (lib/comfyBoot.js). Tim: "check if comfyui is open onstart if it is then restart comfyui".
 * Stand-in status / pids / kill / start: running + not ours + local + a folder = its port's process ended, waited free,
 * started by the app; off in Settings / another computer / ours / no folder / not running = left alone. */
"use strict";
const fs = require("fs");
const path = require("path");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
(async () => {
  try {
    const B = require("../lib/comfyBoot");
    check("isLocal: 127.0.0.1 / localhost / [::1] / 0.0.0.0 yes, a LAN or remote address no", B.isLocal("http://127.0.0.1:8188") && B.isLocal("http://localhost:8000") && B.isLocal("http://[::1]:8188") && B.isLocal("http://0.0.0.0:8188") && !B.isLocal("http://192.168.1.20:8188") && !B.isLocal("https://gpu.example.com"));
    check("portOf: the address's port (8188 when none can be read)", B.portOf("http://127.0.0.1:8000") === 8000 && B.portOf("nonsense") === 8188);
    const ns = "  Proto  Local Address          Foreign Address        State           PID\n  TCP    0.0.0.0:8188           0.0.0.0:0              LISTENING       4412\n  TCP    127.0.0.1:8188         127.0.0.1:50122        ESTABLISHED     4412\n  TCP    0.0.0.0:81880          0.0.0.0:0              LISTENING       99\n  TCP    [::]:8188              [::]:0                 LISTENING       4412\n";
    check("pidsFromNetstat: the LISTENING owner of :8188 once (not :81880, not a connection)", JSON.stringify(B.pidsFromNetstat(ns, 8188)) === "[4412]", B.pidsFromNetstat(ns, 8188));
    check("pidsFromLsof: the numbers", JSON.stringify(B.pidsFromLsof("123\n456\n")) === "[123,456]");
    const mk = (o) => { const L = { killed: [], started: 0, up: o.up, n: 0 }; return { L, deps: {
      status: async () => ({ reachable: L.up, managed: !!o.managed }), start: async () => { L.started++; }, sleep: async () => {},
      pidsOn: () => o.pids || [4412], kill: (pid) => { L.killed.push(pid); if (!o.stuck) L.up = false; return true; } } }; };
    const cfg = (c) => ({ engine: { comfy: Object.assign({ url: "http://127.0.0.1:8188", dir: "C:/ComfyUI" }, c || {}) } });
    let m = mk({ up: true }), r = await B.run(cfg(), m.deps, () => {});
    check("running, not ours, on this computer, a folder set: its process ended, then started by the app", r.action === "restarted" && JSON.stringify(m.L.killed) === "[4412]" && m.L.started === 1, { r, L: m.L });
    m = mk({ up: false }); r = await B.run(cfg(), m.deps, () => {});
    check("not running: nothing to do", r.action === "none" && !m.L.killed.length && !m.L.started);
    m = mk({ up: true }); r = await B.run(cfg({ restart_on_start: false }), m.deps, () => {});
    check("off in Settings: left alone", r.action === "none" && !m.L.killed.length);
    m = mk({ up: true }); r = await B.run(cfg({ url: "http://192.168.1.20:8188" }), m.deps, () => {});
    check("another computer's ComfyUI: left alone", r.action === "none" && !m.L.killed.length);
    m = mk({ up: true, managed: true }); r = await B.run(cfg(), m.deps, () => {});
    check("one the app started: left alone", r.action === "none" && !m.L.killed.length);
    m = mk({ up: true }); r = await B.run(cfg({ dir: "", launch: "" }), m.deps, () => {});
    check("no ComfyUI folder / launch command: left running (the app could not start its own)", r.action === "skipped" && !m.L.killed.length);
    m = mk({ up: true, stuck: true }); r = await B.run(cfg(), m.deps, () => {});
    check("a port that keeps answering: not started twice - it says so", r.action === "failed" && m.L.started === 0);
    const RI = fs.readFileSync(path.join(__dirname, "..", "routes", "index.js"), "utf8"), IH = fs.readFileSync(path.join(__dirname, "..", "static", "index.html"), "utf8");
    check("wired: at startup before the autostart; Settings ▸ ComfyUI checkbox (default on) saved as engine.comfy.restart_on_start",
      /require\("\.\.\/lib\/comfyBoot"\)\.run\(core\.getConfig\(\), null, say\)[\s\S]{0,120}autostart\.run/.test(RI) && /id="s_crestart" checked/.test(IH) && /restart_on_start: \$\("s_crestart"\)/.test(IH));
  } catch (e) { fail++; console.log("FAIL: crashed - " + (e && e.stack || e)); }
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
  process.exit(fail ? 1 : 0);
})();
