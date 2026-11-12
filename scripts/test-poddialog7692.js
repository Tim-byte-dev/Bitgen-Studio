#!/usr/bin/env node
/* bitGen Studio — 2.769.2: the "no pod renders <style> yet" question lists only the pods in My pods now - none terminated or
 * being terminated, no presets of gone pods (lib/stylePods.js offer, static/podpick.js). Stubbed RunPod.
 * Tim (verbatim): "if pods have been terminated or does not exist in my pods remove them from the dialog when a style is chosen
 * and no pod is selected for the style" */
"use strict";
const fs = require("fs"), os = require("os"), path = require("path"), Module = require("module");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const stub = (rel, exp) => { const p = require.resolve(rel); const m = new Module(p); m.filename = p; m.loaded = true; m.exports = exp; require.cache[p] = m; };
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "poddialog7692-"));
let CFG = { rgpu: { style_pods: {} } };
stub("../lib/core", { getConfig: () => CFG, setConfig: (c) => { CFG = c; }, BASE: ROOT, STYLES_DIR: TMP });
const A = require("../lib/runpodApi");
const RAW = [{ id: "live1", name: "bitGen live", status: "RUNNING", desiredStatus: "RUNNING" }, { id: "stop1", name: "bitGen stopped", status: "EXITED", desiredStatus: "EXITED" },
  { id: "dying", name: "bitGen going", status: "EXITED", desiredStatus: "TERMINATED" }, { id: "dead", name: "bitGen gone", status: "TERMINATED" }];
let fails = false;
stub("../lib/pods", { gpus: async () => ({ gpus: [] }), templates: async () => ({ templates: [] }), mine: async () => { if (fails) throw new Error("RunPod refused the API key"); return { pods: RAW.map((p) => A.mapPod(p, 8188)) }; } });
stub("../lib/podPresets", { all: () => [{ name: "old pod", pod_id: "dead", gpu: "A40", count: 1, cloud: "SECURE", styles: [] }], ofPod: () => null });
const SP = require("../lib/stylePods");
(async () => {
  check("mapPod keeps RunPod's desiredStatus (a pod being terminated still says EXITED)", A.mapPod(RAW[2], 8188).desired === "TERMINATED");
  const a = SP.askFor({ id: "st1", name: "qwen2_1" }, "image");
  const o = await SP.offer(a.id || a, "SECURE");
  check("the question lists only the pods in My pods now: running and stopped ones - not a terminated one or one being terminated; no presets of gone pods",
    o.pods.map((p) => p.id).join() === "live1,stop1" && o.presets.length === 0 && o.pods_error === "", { pods: o.pods.map((p) => p.id), presets: o.presets });
  fails = true;
  const o2 = await SP.offer(a.id || a, "SECURE");
  check("…RunPod's list not read: no pods, and why (not 'no pods')", o2.pods.length === 0 && /refused the API key/.test(o2.pods_error), o2.pods_error);
  const pk = fs.readFileSync(path.join(ROOT, "static", "podpick.js"), "utf8");
  check("the box: no 'its pod is gone' line; an empty list says to create one, or why RunPod did not list them", !/is gone on RunPod/.test(pk) && /No pods in My pods - create one for /.test(pk) && /RunPod did not list your pods \(/.test(pk));
  fs.rmSync(TMP, { recursive: true, force: true });
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log("FAIL: crashed " + (e && e.stack)); console.log("RESULT: FAIL"); process.exit(1); });
