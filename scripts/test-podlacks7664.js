#!/usr/bin/env node
/* bitGen Studio — 2.766.4 units: a node the pod's ComfyUI still lacks stops the render before it is sent (lib/podPrep.js lacks
 * -> lib/stylePods.js), and files just put on the pod are listed again before they are called missing.
 * Tim (verbatim): "[worker] ERROR: ComfyUI does not have these node types: TextEncodeQwenImage21 … i think the download wasn't
 * completed before... the timining is off, but the custom nodes didn't get installed" */
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const PP = require("../lib/podPrep");
(async () => {
  process.env.H3_POD_REVIVE_POLL = "1"; process.env.H3_POD_LIST_WAIT = "1";
  let listed = 0;
  const base = (over) => Object.assign({
    ways: async () => ({ pod_id: "p", jupyter: true, manager: false, comfy_dir: "/ComfyUI", comfy_version: "0.34.0", jupyter_url: "j", comfy_url: "c" }),
    contents: async () => ({ models: {} }), download: async () => ({ started: 1 }), state: async () => ({ running: false, files: [{ name: "q.safetensors", state: "done" }] }),
    send: async () => ({}), local: () => null, objectInfo: async () => ({ UNETLoader: {} }), kernel: async () => "", nodeState: async () => null, reboot: async () => true,
    catalog: () => ({ models: [{ id: "q", repo: "o/r", file: "q.safetensors", dest: "comfy/diffusion_models", size: 5 }] }), packs: () => [], graph: () => ({}),
    classesOf: () => ["UNETLoader"], needs: () => [{ name: "q.safetensors", cat: "diffusion_models" }], cfg: () => ({}), localFolders: null, sleep: async () => {},
    updateComfy: async () => ({ ok: false, why: "it is not a git checkout" }),
  }, over || {});
  // files ComfyUI lists only on the 3rd look
  const r1 = await PP.prepare("p", 8188, [{ id: "s", name: "qwen2_1", kind: "image", workflow: "w.json" }], { deps: base({ contents: async () => { listed++; return { models: { diffusion_models: listed >= 4 ? ["q.safetensors"] : [] } }; } }) });
  check("files just downloaded that ComfyUI lists a moment later: looked at again - not called missing", r1.notThere.length === 0 && listed >= 4, { r1, listed });
  const r2 = await PP.prepare("p", 8188, [{ id: "s", name: "qwen2_1", kind: "image", workflow: "w.json" }], { deps: base({ contents: async () => ({ models: { diffusion_models: ["q.safetensors"] } }), classesOf: () => ["UNETLoader", "TextEncodeQwenImage21", "SomeUnknownPackNode"] }) });
  check("a node still lacking (ComfyUI not updated / a pack bitGen does not know): in lacks", r2.lacks.join() === "TextEncodeQwenImage21,SomeUnknownPackNode" && r2.problems.some((p) => /was not updated: it is not a git checkout/.test(p)), r2);
  const r3 = await PP.prepare("p", 8188, [{ id: "s", name: "qwen2_1", kind: "image", workflow: "w.json" }], { deps: base({ contents: async () => ({ models: { diffusion_models: ["q.safetensors"] } }), classesOf: () => ["UNETLoader", "TextEncodeQwenImage21"], updateComfy: async () => ({ ok: true }), objectInfo: (() => { let n = 0; return async () => (++n > 1 ? { UNETLoader: {}, TextEncodeQwenImage21: {} } : { UNETLoader: {} }); })() }) });
  check("…updated and now there: nothing lacking", r3.lacks.length === 0, r3);
  const SP = fs.readFileSync(path.join(ROOT, "lib", "stylePods.js"), "utf8");
  check("stylePods.ready: a node lacking stops the render with why (cannot render on the pod yet - its ComfyUI lacks …), not kept as ready", /if \(\(r\.lacks \|\| \[\]\)\.length\) throw new Error\(`\$\{st\.name\} cannot render on the pod yet - its ComfyUI lacks/.test(SP) && SP.indexOf("r.lacks") < SP.indexOf("READY[key] = { at: Date.now(), problems: r.problems }"));
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log("FAIL: crashed " + (e && e.stack)); console.log("RESULT: FAIL"); process.exit(1); });
