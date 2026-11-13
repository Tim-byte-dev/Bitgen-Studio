#!/usr/bin/env node
/* bitGen Studio — 2.769.0: a pod bitGen makes has its ComfyUI updated automatically when it first loads (lib/podComfyUpdate.js
 * auto / waitAuto, lib/remoteGpu.js podState, lib/podPrep.js), and files ComfyUI does not list after a download are looked
 * for on the pod and linked, or the reason said (lib/podPrep.js locateCode / locateRead / locateWords). Pure + stubbed pod.
 * Tim (verbatim): "update comfy automatically when the pod is created as well" + his log: "[pod] making qwen2_1 ready:
 * downloading on the pod: qwen_image_2.1_int8_convrot.safetensors, qwen3vl_8b_int8_convrot.safetensors,
 * qwen_image_2.1_vae_bf16.safetensors / [pod] making qwen2_1 ready: waiting for the pod's ComfyUI to list the new files / [pod]
 * qwen2_1 cannot render on the pod yet - these files are not on it: …" */
"use strict";
const fs = require("fs"), path = require("path"), Module = require("module");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const stub = (rel, exp) => { const p = require.resolve(rel); const m = new Module(p); m.filename = p; m.loaded = true; m.exports = exp; require.cache[p] = m; return m; };
let CFG = { rgpu: { pod_made: { podNew: { port: 8188 } } } };
stub("../lib/core", { getConfig: () => CFG, setConfig: (c) => { CFG = c; }, BASE: ROOT });
const K = { calls: 0, status: { running: false, state: "done", same: false } };
stub("../lib/podModels", Object.assign({}, require("../lib/podModels"), {
  ways: async (id) => ({ pod_id: id, jupyter: true, jupyter_url: "j", comfy_dir: "/ComfyUI", comfy_port: 8188, comfy_version: "0.30.0", model_dirs: {} }),
  runKernel: async () => { K.calls++; await new Promise((r) => setTimeout(r, 30)); return "bitgen-cupd-started"; },
  jupyterOf: () => "pw", readCwdJson: async () => K.status,
  comfyAt: async () => ({ url: "http://pod", j: { system: { comfyui_version: "0.40.0" } } }),
}));
stub("../lib/podSend", { whenUp: async (fn) => fn() });
process.env.H3_POD_REVIVE_POLL = "1";
const CU = require("../lib/podComfyUpdate"), PP = require("../lib/podPrep");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  /* ---- auto: once, for a pod bitGen made */
  check("auto(): a pod bitGen did not make - nothing", CU.auto("podOther", 8188) === null);
  const R = CU.auto("podNew", 8188);
  check("auto(): a pod bitGen made (rgpu.pod_made) - its ComfyUI update starts, marked so it runs once", R && R.running && R.auto && CFG.rgpu.pod_made.podNew.comfy_auto > 0, R);
  check("…a second call (the docker's poll, the first job) - the same run, no second one", CU.auto("podNew", 8188) === R);
  const W = await CU.waitAuto("podNew", 8188, null);
  check("waitAuto(): a job waits for it; the result: updated to the version ComfyUI answers with", W === R && !R.running && R.ok && R.version === "0.40.0" && /ComfyUI on the pod is updated \(0\.40\.0\)/.test(R.note) && K.calls === 1, R);
  check("…done once: auto() again = nothing (the pod is not updated on every load)", CU.auto("podNew", 8188) === null);
  CFG.rgpu.pod_made.podX = { port: 8188 }; CFG.rgpu.pod_comfy_auto = false;
  check("rgpu.pod_comfy_auto false = never", CU.auto("podX", 8188) === null && !CFG.rgpu.pod_made.podX.comfy_auto);
  delete CFG.rgpu.pod_comfy_auto;
  // a job's own update (a node built into a newer ComfyUI) while the new pod's update runs: waited for, not run twice
  K.status = { running: false, state: "done", same: true };
  const R2 = CU.auto("podX", 8188), k0 = K.calls;
  const u = await CU.update({ pod_id: "podX", jupyter: true, comfy_dir: "/ComfyUI" }, 8188, null, {});
  check("update() while the new pod's update runs: waited for and its result used (no second update on the pod); 'already the latest' when nothing was new",
    R2 && u.ok && u.same === true && K.calls === k0 + 1 && /already the latest/.test(R2.note), { u, note: R2.note, calls: K.calls - k0 });

  /* ---- podPrep: the new pod's update first, then the files */
  const files = { diffusion_models: [] }; const said = [];
  let listed = false, located = 0;
  const D = {
    ways: async () => ({ pod_id: "p", jupyter: true, manager: false, comfy_dir: "/ComfyUI", comfy_version: "0.40.0", jupyter_url: "j", comfy_url: "c", model_dirs: { diffusion_models: ["/workspace/models/diffusion_models"] } }),
    contents: async () => ({ models: listed ? { diffusion_models: ["q.safetensors"] } : JSON.parse(JSON.stringify(files)), warnings: [] }),
    download: async () => ({ started: 1 }), state: async () => ({ running: false, files: [{ name: "q.safetensors", state: "there already", done: 5, size: 5 }] }),
    send: async () => ({}), local: () => null, objectInfo: async () => ({ UNETLoader: {} }), kernel: async () => "", nodeState: async () => null, reboot: async () => true,
    catalog: () => ({ models: [{ file: "q.safetensors", repo: "r/q", dest: "comfy/diffusion_models", size: 5 }] }), packs: () => [], graph: () => ({}), classesOf: () => ["UNETLoader"],
    needs: () => [{ name: "q.safetensors", cat: "diffusion_models" }], cfg: () => ({}), localFolders: null, sleep: async () => {},
    autoUpdate: async (pod, port, say) => { say("updating ComfyUI on the new pod first - git pull"); return { ok: true, version: "0.40.0" }; },
    locate: async (w, code) => { located++; check("locateCode: names the file, ComfyUI's folder and the folder ComfyUI reads diffusion models from", /q\.safetensors/.test(code) && /\/workspace\/models\/diffusion_models/.test(code) && /\/ComfyUI/.test(code)); listed = true; return { "q.safetensors": { hits: [{ path: "/ComfyUI/models/unet/q.safetensors", size: 5, part: false }], linked: "/workspace/models/diffusion_models/q.safetensors" } }; },
  };
  const r = await PP.prepare("p", 8188, [{ id: "s", name: "qwen2_1", kind: "image", workflow: "w.json" }], { deps: D, say: (t) => said.push(t) });
  check("prepare(): the new pod's ComfyUI update first (said), then its files", said[1] && /updating ComfyUI on the new pod first/.test(said[1]) && said.some((t) => /ComfyUI on the pod is updated to 0\.40\.0/.test(t)), said);
  check("files ComfyUI does not list after the download: looked for on the pod - one outside the folders ComfyUI reads is linked in, then listed (no 'not on it')", located === 1 && r.notThere.length === 0 && said.some((t) => /linked into the folders the pod's ComfyUI reads: q\.safetensors/.test(t)), { r, said });
  // not found / partly downloaded: the reason in the problems
  listed = false; D.locate = async () => ({ "q.safetensors": { hits: [{ path: "/workspace/models/diffusion_models/q.safetensors.part", size: 3e9, part: true }] } });
  D.autoUpdate = async () => ({ ok: false, why: "pip install -r requirements.txt did not work - No matching distribution" });
  D.objectInfo = async () => { throw new Error("HTTP 500"); };
  D.contents = async () => ({ models: {}, warnings: ["UNETLoader: timed out"] });
  const r2 = await PP.prepare("p", 8188, [{ id: "s", name: "qwen2_1", kind: "image", workflow: "w.json" }], { deps: D });
  check("…a half-downloaded file: 'only partly downloaded (3 GB at …part) - its download stopped'; the new pod's failed update, a ComfyUI that does not list its nodes / models: each said",
    r2.notThere.join() === "q.safetensors" && r2.problems.some((p) => /q\.safetensors is only partly downloaded \(3 GB at \/workspace\/models\/diffusion_models\/q\.safetensors\.part\)/.test(p))
    && r2.problems.some((p) => /ComfyUI on the new pod was not updated: pip install/.test(p)) && r2.problems.some((p) => /did not list its nodes \(\/object_info - HTTP 500\)/.test(p))
    && r2.problems.some((p) => /did not answer all its model lists \(UNETLoader: timed out\)/.test(p)), r2.problems);

  /* ---- pure */
  const dirs = { a: "/w/d", b: "/w/d", c: "/w/d", d: "/w/d" };
  const words = PP.locateWords({ a: {}, b: { in_dir: "/w/d", hits: [{ path: "/w/d/b", size: 2e9 }] }, c: { hits: [{ path: "/x/c", size: 0 }] }, d: { error: "read-only", hits: [{ path: "/x/d", size: 1 }] } }, ["a", "b", "c", "d"], dirs);
  check("locateWords: nowhere / in the folder ComfyUI reads but not listed / empty / could not link - each in words",
    /a is not anywhere on the pod/.test(words[0]) && /b is in \/w\/d \(2 GB\) but the pod's ComfyUI does not list it/.test(words[1]) && /c is on the pod but empty/.test(words[2]) && /could not link it into \/w\/d: read-only/.test(words[3]), words);
  check("locateRead: the kernel's BITGEN_LOCATE line; anything else = null", PP.locateRead("noise\nBITGEN_LOCATE {\"a\": {\"hits\": []}}\n").a.hits.length === 0 && PP.locateRead("Traceback …") === null);
  const ps = fs.readFileSync(path.join(ROOT, "static", "podsetup.js"), "utf8"), rg = fs.readFileSync(path.join(ROOT, "lib", "remoteGpu.js"), "utf8");
  check("PODS ▸ My pods shows a new pod's own update (asked once per row); the docker watching a pod load starts it when it first loads",
    /row\.dataset\.cuAsked = "1"; getj\("\/api\/pods\/" \+ encodeURIComponent\(p\.id\) \+ "\/comfy-update"\)/.test(ps) && /\(j\.auto \? "new pod: " : ""\)/.test(ps) && /require\("\.\/podComfyUpdate"\)\.auto\(m\.id, port \|\| 0\)/.test(rg));
  await sleep(10);
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log("FAIL: crashed " + (e && e.stack)); console.log("RESULT: FAIL"); process.exit(1); });
