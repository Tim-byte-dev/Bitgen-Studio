#!/usr/bin/env node
/* bitGen Studio — 2.756.2 units: the start-up "restart a ComfyUI left running" (lib/comfyBoot.js) never ends bitGen Studio
 * itself.
 * Tim: "bitgen has crashed - i rebooted the pc" + start.bat's window:
 *   [server] [comfy] a ComfyUI is already running at http://127.0.0.1:8311/rpsl (left from before) - restarting it ...
 *   [server] [comfy] ending process 23800 (port 8311)
 *   [electron] server exited 1
 * With Basic Settings on RunPod Serverless, ComfyUI's address is the studio's OWN adapter (/rpsl on the studio's port), which
 * answers - so the check ended the process on that port: the studio. Every start. */
"use strict";
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 400))); } };
const B = require("../lib/comfyBoot");

function mk(o) {
  const killed = [], said = [];
  const deps = {
    status: async () => ({ reachable: !!o.up, managed: false }),
    start: async () => { o.started = true; },
    sleep: async () => {},
    pidsOn: () => o.pids || [4242],
    kill: (pid) => { killed.push(pid); o.up = false; return true; },
    ownPort: o.ownPort || 8311,
    selfPids: o.self || [23800],
  };
  return { deps, killed, said, o };
}
const cfg = (c) => ({ engine: { comfy: Object.assign({ url: "http://127.0.0.1:8188", dir: "D:/Bitgen-Studio/comfy", restart_on_start: true }, c || {}) } });

(async () => {
  // Tim's case, exactly
  let m = mk({ up: true, pids: [23800] }), log = [];
  let r = await B.run(cfg({ url: "http://127.0.0.1:8311/rpsl" }), m.deps, (x) => log.push(x));
  check("Tim's case: ComfyUI's address = http://127.0.0.1:8311/rpsl (RunPod Serverless) -> left alone, nothing ended, no 'left from before' line",
    r.action === "none" && /own server/.test(r.reason) && m.killed.length === 0 && !log.some((x) => /left from before|ending process/.test(x)), { r, killed: m.killed, log });
  m = mk({ up: true });
  r = await B.run(cfg({ url: "http://127.0.0.1:8311/rpsl/ep/ohkr3evlck2bxn" }), m.deps, () => {});
  check("…a style's own endpoint (/rpsl/ep/<id>) too", r.action === "none" && m.killed.length === 0, r);
  m = mk({ up: true, ownPort: 8411 });
  r = await B.run(cfg({ url: "http://localhost:8411/" }), m.deps, () => {});
  check("…any address on the studio's own port (H3_PORT, here 8411) is the studio", r.action === "none" && m.killed.length === 0, r);
  m = mk({ up: true, pids: [23800, 23801], self: [23800, 23801] });
  r = await B.run(cfg(), m.deps, (x) => log.push(x));
  check("…whatever the address: the studio's own process (and the app that started it) is never ended", r.action === "none" && m.killed.length === 0 && /itself/.test(r.reason), r);
  m = mk({ up: true, pids: [23800, 5555], self: [23800] });
  r = await B.run(cfg(), m.deps, () => {});
  check("…a real ComfyUI beside it on the same port: only that one is ended, then started again", m.killed.join() === "5555" && r.action === "restarted" && m.o.started, { r, killed: m.killed });
  m = mk({ up: true });
  r = await B.run(cfg(), m.deps, () => {});
  check("…a ComfyUI left running on 8188 is still restarted (2.603.0 unchanged)", r.action === "restarted" && m.killed.join() === "4242", r);
  check("ownServer (pure): the studio's port or /rpsl - not ComfyUI's own 8188, not /rpslx",
    B.ownServer("http://127.0.0.1:8311/rpsl", 8311) && B.ownServer("http://127.0.0.1:9000/rpsl/", 8311) && B.ownServer("http://localhost:8311", 8311)
    && !B.ownServer("http://127.0.0.1:8188", 8311) && !B.ownServer("http://127.0.0.1:8188/rpslx", 8311) && !B.ownServer("not a url", 8311));
  const real = require("fs").readFileSync(require("path").join(__dirname, "..", "lib", "comfyBoot.js"), "utf8");
  check("the real side effects know the studio: ownPort = H3_PORT or 8311, selfPids = this process + its parent",
    /ownPort: \+\(process\.env\.H3_PORT \|\| 8311\)/.test(real) && /selfPids: \[process\.pid, process\.ppid\]/.test(real));
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log("FAIL: " + (e && e.stack || e)); process.exit(1); });
