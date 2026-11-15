#!/usr/bin/env node
/* bitGen Studio — 2.782.3: ▶ on a pod that already runs says "running" in green (not RunPod's 409 "action start is not valid for
 * status RUNNING"); ⏹ on a stopped one says stopped (lib/pods.js act, static/podsdock.js act).
 * Tim (verbatim): "remove this message from pods docker - RunPod: not possible in the pod's state now - action "start" is not valid
 * for status "RUNNING" - if pod is running, just say running in green" */
"use strict";
const path = require("path"), fs = require("fs");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got))); } };
let CFG = { rgpu: { runpod: { key: "k" } } };
require.cache[require.resolve("../lib/core")] = { id: "core", filename: "core", loaded: true, exports: { BASE: "/nowhere", getConfig: () => CFG, setConfig: (c) => { CFG = c; } } };
const RA = require("../lib/runpodApi");
const busy = (said) => { const e = new Error("RunPod: not possible in the pod's state now - " + said); e.status = 409; e.said = said; return e; };
(async () => {
  const P = require("../lib/pods");
  RA.action = async () => { throw busy('action "start" is not valid for status "RUNNING"'); };
  const r = await P.act("pod1", "start");
  check("▶ on a running pod: ok, running - no error", r.ok && r.running && r.note === "running", r);
  RA.action = async () => { throw busy('action "stop" is not valid for status "EXITED"'); };
  const s = await P.act("pod1", "stop");
  check("⏹ on a stopped pod: ok, stopped", s.ok && s.stopped, s);
  RA.action = async () => { throw busy("something else"); };
  let er = ""; try { await P.act("pod1", "start"); } catch (e) { er = e.message; }
  check("any other refusal is still said", /something else/.test(er));
  const PD = fs.readFileSync(path.join(__dirname, "..", "static", "podsdock.js"), "utf8");
  check("the docker: \"<pod> - running\" in green", /if \(r\.running \|\| r\.stopped\) \{ delete S\.watch\[p\.id\]; say\(p\.name \+ \(r\.running \? " - running" : " - stopped"\), r\.running \? true : null\)/.test(PD));
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
