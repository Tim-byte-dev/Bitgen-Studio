#!/usr/bin/env node
/* bitGen Studio — 2.781.0: A NEW POD WITH NO SIGN OF LIFE FOR 5 MINUTES ON ITS FIRST START IS TERMINATED AND MADE AGAIN
 * (lib/podWatchdog.js; started by lib/podMade.js watch; lib/podRetry.js move; RunPod's template ids kept by podRevive / podPresets);
 * a pod's Jupyter still starting is waited for (lib/podModels.js runKernel, lib/podRevive.js waitReady).
 * Tim (verbatim): "seems the pod may have been faulty, check pod for activity, if no activity after 5 minutes terminate the pod and
 * start a new pod (this is only on first run for the pod, if the pod successfully installs and runs then terminate only when user
 * presses terminate button)" */
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
process.env.H3_POD_DOG_MS = "300000"; process.env.H3_POD_DOG_POLL = "1";
const W = require("../lib/podWatchdog"), R = require("../lib/podRetry");
const rd = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");

(async () => {
  check("quiet: bitGen's own waiting lines are not activity", W.quiet("waiting for the pod to load") && W.quiet("loading pod - its Jupyter is still starting (3 min)") && !W.quiet("installing ComfyUI's requirements"));
  check("signOf: a clock is not activity; a new install line, RunPod's state, the container, Jupyter are",
    W.signOf({ status: "RUNNING", lines: ["installing torch (1 min)"] }) === W.signOf({ status: "RUNNING", lines: ["installing torch (4 min)"] })
    && W.signOf({ lines: ["cloning ComfyUI"] }) !== W.signOf({ lines: ["installing requirements"] })
    && W.signOf({ status: "PROVISIONING" }) !== W.signOf({ status: "RUNNING" }) && W.signOf({ status: "RUNNING" }) !== W.signOf({ status: "RUNNING", runtime: true })
    && W.signOf({ runtime: true }) !== W.signOf({ runtime: true, jupyter: true }));

  // a pod that never does anything: replaced after 5 minutes (a fake clock)
  let clock = 0, made = { p1: { template_id: "runpod-torch-v280" } }, said = [], replaced = [], marks = [];
  const base = { made: (id) => made[id] || null, mark: (id, f) => { marks.push([id, f]); made[id] = Object.assign({}, made[id], f); }, say: (id, t) => said.push(id + ": " + t),
    now: () => clock, sleep: async () => { clock += 30000; }, replace: async (id, port, gen) => { replaced.push([id, gen]); return { ok: true, id: "p2", name: "bitGen pod" }; } };
  W.setDeps(Object.assign({}, base, { look: async () => ({ status: "RUNNING", runtime: true, jupyter: true, lines: ["waiting for the pod to load", "loading pod - its Jupyter is still starting (" + Math.round(clock / 60000) + " min)"] }) }));
  let w = W.start("p1", 8188); await w.promise;
  check("no activity for 5 minutes on its first start: said, replaced (generation 1)", w.phase === "replaced" && replaced.length === 1 && replaced[0][1] === 1 && clock >= 300000 && clock < 360000 && said.some((t) => /no activity from the pod for 5 minutes on its first start - it looks faulty: terminating it and making a new one the same way/.test(t)) && said.some((t) => /replaced by the pod p2/.test(t)), { w: W.status("p1"), clock, said });

  // a pod that installs (lines change) and then runs: never replaced, proven
  clock = 0; replaced = []; said = []; made = { p3: {} }; let n = 0;
  W.setDeps(Object.assign({}, base, { look: async () => { n++; return n < 30 ? { status: "RUNNING", runtime: true, jupyter: true, lines: ["installing step " + "abcdefghijklmnopqrstuvwxyz"[Math.floor(n / 5)]] } : { status: "RUNNING", runtime: true, jupyter: true, comfy: true }; } }));
  w = W.start("p3", 8188); await w.promise;
  check("a pod that keeps doing things (its install lines change) and then runs: never replaced - proven, only Terminate ends it now", w.phase === "proven" && !replaced.length && marks.some((m) => m[0] === "p3" && m[1].proven_at), { st: W.status("p3"), replaced });
  check("…a proven / set-up pod is not watched again (first run only)", W.start("p3", 8188).phase === "proven" && (made.p5 = { setup_at: 1 }) && W.start("p5", 8188) === null);

  // made again twice already: left for you
  clock = 0; replaced = []; said = []; made = { p6: { dog_gen: 2 } };
  W.setDeps(Object.assign({}, base, { look: async () => ({ status: "RUNNING", lines: [] }) }));
  w = W.start("p6", 8188); await w.promise;
  check("made again twice already: not again - said, left for you", w.phase === "gave up" && !replaced.length && /made again 2 times already/.test(W.status("p6").note), W.status("p6"));
  // gone on RunPod: stop
  made = { p7: {} }; W.setDeps(Object.assign({}, base, { look: async () => ({ gone: true }) }));
  w = W.start("p7", 8188); await w.promise;
  check("terminated on RunPod (by you): the watch stops", w.phase === "stopped");
  W.setDeps(null);

  // the renders waiting for it follow the new pod
  R.HOLD.clear(); R.HOLD.set("j1", { id: "j1", pod: "p1", at: 1, tries: 0 }); R.HOLD.set("j2", { id: "j2", pod: "pX", at: 1, tries: 0 });
  check("podRetry.move: the renders waiting for the old pod wait for the new one", R.move("p1", "p2") === 1 && R.HOLD.get("j1").pod === "p2" && R.HOLD.get("j2").pod === "pX");
  R.HOLD.clear();
  const WD = rd("lib/podWatchdog.js");
  check("replace: terminate first (charges end; nothing new if that fails), then the same recipe, then styles / kinds / audio / preset / waiting renders move", /await P\.act\(old, "terminate"\)/.test(WD) && /nothing new was made/.test(WD) && /templateId: rc\.template_id/.test(WD)
    && /PR\.moveStyles\(old, nid, name\)/.test(WD) && /podAudio"\)\.setKinds\(nid, audio\)/.test(WD) && /pod_id: nid/.test(WD) && /podRetry"\)\.move\(old, nid\)/.test(WD));
  check("started for every pod bitGen made and has not set up (lib/podMade.js watch)", /require\("\.\/podWatchdog"\)\.start\(k, port\)/.test(rd("lib/podMade.js")));
  // RunPod's template ids survive the recipe and the presets
  const PR = require("../lib/podRevive");
  check("RunPod's template ids keep their - _ . in a pod's recipe and a preset (runpod-torch-v280 was stripped to runpodtorchv280)", PR.cleanRecipe({ template_id: "runpod-torch-v280", gpu: "x" }).template_id === "runpod-torch-v280" && /template_id: str\(x\.template_id, 80\)\.replace\(\/\[\^\\w\.-\]\/g, ""\)/.test(rd("lib/podPresets.js")));
  check("the watch asks only short questions (podModels.alive: ComfyUI + Jupyter's /api/status - no kernel, no 2-minute wait)", /podModels"\)\.alive\(id, port\)/.test(WD) && !/podModels"\)\.ways\(/.test(WD) && typeof require("../lib/podModels").alive === "function");
  // the pod's Jupyter still starting
  const PM = rd("lib/podModels.js"), RV = rd("lib/podRevive.js");
  check("a kernel refused with 404 / 502 / 503 while the pod's Jupyter starts is asked again (2 min) and then said as loading - the pod is waited for",
    /\[0, 404, 502, 503, 504\]\.includes\(k\.status\)/.test(PM) && /H3_POD_KERNEL_WAIT \|\| 120000/.test(PM) && /did not start a kernel \\\(HTTP \(0\|404\|502\|503\|504\)\\\)/.test(RV) && /its Jupyter is still starting/.test(RV));
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
