#!/usr/bin/env node
/* bitGen Studio — 2.770.0: a pod's ComfyUI that answers but lists NO nodes (/object_info empty - newer code without its
 * requirements) is repaired before its files are checked: its requirements, a restart, then asked again (lib/podPrep.js); a
 * pod's reason is written one part per log line (lib/core.js podLines). Stubbed pod.
 * Tim's log (verbatim): "… (the pod's ComfyUI did not list its nodes (/object_info was empty) - bitGen could not check them;
 * qwen_image_2.1_int8_convrot.safetensors is in /workspace/runpod-slim/ComfyUI/models/diffusion_models (7.3 GB) but the pod'" */
"use strict";
const fs = require("fs"), path = require("path"), Module = require("module");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const cp = require.resolve("../lib/core"), fk = new Module(cp); fk.filename = cp; fk.loaded = true; fk.exports = { getConfig: () => ({ rgpu: {} }), setConfig: () => {}, BASE: ROOT }; require.cache[cp] = fk;
const PP = require("../lib/podPrep");
(async () => {
  let repaired = false, opts = null; const said = [];
  const D = {
    ways: async () => ({ pod_id: "p", jupyter: true, comfy_dir: "/workspace/runpod-slim/ComfyUI", comfy_version: "0.40.0", jupyter_url: "j", comfy_url: "c", model_dirs: {} }),
    contents: async () => ({ models: repaired ? { diffusion_models: ["q.safetensors"] } : {}, warnings: [] }),
    download: async () => ({}), state: async () => ({ running: false, files: [] }), send: async () => ({}), local: () => null,
    objectInfo: async () => (repaired ? { UNETLoader: {} } : {}), kernel: async () => "", nodeState: async () => null, reboot: async () => true,
    catalog: () => ({ models: [] }), packs: () => [], graph: () => ({}), classesOf: () => ["UNETLoader"], needs: () => [{ name: "q.safetensors", cat: "diffusion_models" }],
    cfg: () => ({}), localFolders: null, sleep: async () => {}, autoUpdate: async () => null, locate: async () => null,
    updateComfy: async (w, port, say, o) => { opts = o; say("installing what the new ComfyUI needs (pip)"); repaired = true; return { ok: true, version: "0.40.0" }; },
  };
  const r = await PP.prepare("p", 8188, [{ id: "s", name: "qwen2_1", kind: "image", workflow: "w.json" }], { deps: D, say: (t) => said.push(t) });
  check("ComfyUI answers with NO nodes: repaired first (its requirements + a restart, forced), said; then its nodes and files are seen - nothing missing",
    opts && opts.force === true && said.some((t) => /lists no nodes - repairing it/.test(t)) && said.some((t) => /ComfyUI on the pod is repaired/.test(t)) && r.notThere.length === 0 && !r.problems.some((p) => /did not list its nodes/.test(p)), { said, r });
  repaired = false; D.updateComfy = async () => ({ ok: false, why: "pip install -r requirements.txt did not work - torch" });
  const r2 = await PP.prepare("p", 8188, [{ id: "s", name: "qwen2_1", kind: "image", workflow: "w.json" }], { deps: D });
  check("…the repair fails: why, and what to do (restart the pod / its log)", r2.problems.some((p) => /lists no nodes and was not repaired: pip install/.test(p)) && r2.problems.some((p) => /restart the pod \(PODS ▸ My pods\), or look at its log/.test(p)), r2.problems);
  const core = fs.readFileSync(path.join(ROOT, "lib", "core.js"), "utf8");
  const pl = new Function("log", core.slice(core.indexOf("function podLines"), core.indexOf("function log(job, line)")) + "; return podLines;");
  const out = []; pl((j, l) => out.push(l))({}, "qwen2_1 cannot render on the pod yet - these files are not on it: a, b (one; two is long; three)");
  check("podLines: the reason's parts one per line (a long reason is not cut off)", out.join("|") === "[pod] qwen2_1 cannot render on the pod yet - these files are not on it: a, b:|[pod]   • one|[pod]   • two is long|[pod]   • three", out);
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log("FAIL: crashed " + (e && e.stack)); console.log("RESULT: FAIL"); process.exit(1); });
